
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as Renderer from './renderer.js';
import * as dbManager from './db-manager.js';
import * as utils from './utils.js';

const getDb = dbManager.getDb;
const saveDb = dbManager.saveDb;
const toShamsiYearMonth = utils.toShamsiYearMonth;
const toShamsiFull = utils.toShamsiFull;
const findNextGapNumber = utils.findNextGapNumber;
const sanitizeGroupId = utils.sanitizeGroupId;
const generateUUID = utils.generateUUID;

// Session memory
export const sessions = {}; 
const lastSentIds = new Set(); // Simple de-duplication for notifications

const resolveUser = (db, platform, chatId) => {
    if (platform === 'telegram') return db.users.find(u => u.telegramChatId == chatId);
    if (platform === 'bale') return db.users.find(u => u.baleChatId == chatId);
    return null;
};

const getAvailableYears = (list) => {
    const years = new Set();
    list.forEach(o => {
        const sh = toShamsiYearMonth(o.date);
        if (sh) years.add(sh.split('/')[0]);
    });
    const sorted = Array.from(years).sort().reverse();
    if (sorted.length === 0) return ['1403'];
    return sorted;
};

// --- KEYBOARDS ---
const KEYBOARDS = {
    MAIN: {
        inline_keyboard: [
            [{ text: '💰 مدیریت پرداخت', callback_data: 'MENU_PAY' }, { text: '🚛 مدیریت خروج', callback_data: 'MENU_EXIT' }],
            [{ text: '📦 انبار و موجودی', callback_data: 'MENU_WH' }, { text: '🌍 بازرگانی', callback_data: 'MENU_TRADE' }],
            [{ text: '📊 گزارشات مدیریتی', callback_data: 'MENU_REPORTS' }, { text: '👤 پروفایل', callback_data: 'MENU_PROFILE' }]
        ]
    },
    PAYMENT: {
        inline_keyboard: [
            [{ text: '➕ ثبت دستور پرداخت', callback_data: 'ACT_PAY_NEW' }],
            [{ text: '📂 کارتابل پرداخت (تایید)', callback_data: 'ACT_PAY_CARTABLE' }],
            [{ text: '🔎 جستجو با شماره', callback_data: 'ACT_SEARCH_ID_PAY' }, { text: '🗄️ آرشیو تاریخی', callback_data: 'ACT_ARCHIVE_PAY' }],
            [{ text: '🔙 بازگشت', callback_data: 'MENU_MAIN' }]
        ]
    },
    EXIT: {
        inline_keyboard: [
            [{ text: '➕ ثبت مجوز خروج', callback_data: 'ACT_EXIT_NEW' }],
            [{ text: '📂 کارتابل خروج (تایید/رد)', callback_data: 'ACT_EXIT_CARTABLE' }],
            [{ text: '🔎 جستجو با شماره', callback_data: 'ACT_SEARCH_ID_EXIT' }, { text: '🗄️ آرشیو تاریخی', callback_data: 'ACT_ARCHIVE_EXIT' }],
            [{ text: '🔙 بازگشت', callback_data: 'MENU_MAIN' }]
        ]
    },
    WAREHOUSE: {
        inline_keyboard: [
            [{ text: '➕ ثبت بیجک خروج', callback_data: 'ACT_WH_NEW_BIJAK' }],
            [{ text: '📂 کارتابل انبار (تایید/رد)', callback_data: 'ACT_WH_CARTABLE' }], 
            [{ text: '🔎 جستجو بیجک (شماره)', callback_data: 'ACT_SEARCH_ID_WH' }],
            [{ text: '🗄️ آرشیو بیجک‌ها', callback_data: 'ACT_ARCHIVE_WH_OUT' }, { text: '🗄️ آرشیو رسیدها', callback_data: 'ACT_ARCHIVE_WH_IN' }],
            [{ text: '📦 گزارش موجودی (PDF)', callback_data: 'WH_RPT_STOCK' }],
            [{ text: '🔙 بازگشت', callback_data: 'MENU_MAIN' }]
        ]
    },
    TRADE: {
        inline_keyboard: [
            [{ text: '📂 لیست پرونده‌های فعال (PDF)', callback_data: 'TRD_RPT_ACTIVE' }],
            [{ text: '⏳ گزارش صف تخصیص ارز (PDF)', callback_data: 'TRD_RPT_ALLOCATION' }],
            [{ text: '💰 گزارش خرید ارز (PDF)', callback_data: 'TRD_RPT_CURRENCY' }],
            [{ text: '🛡️ گزارش تضامین و بیمه (PDF)', callback_data: 'TRD_RPT_INSURANCE' }],
            [{ text: '🔙 بازگشت', callback_data: 'MENU_MAIN' }]
        ]
    },
    REPORTS: { 
        inline_keyboard: [
            [{ text: '📊 خلاصه وضعیت امروز', callback_data: 'RPT_DAILY' }],
            [{ text: '🗓 عملکرد ماه جاری', callback_data: 'RPT_MONTHLY' }],
            [{ text: '⏳ وضعیت کارتابل‌ها (مانده)', callback_data: 'RPT_PENDING' }],
            [{ text: '🔙 بازگشت', callback_data: 'MENU_MAIN' }]
        ] 
    },
    BACK: { inline_keyboard: [[{ text: '🔙 انصراف', callback_data: 'MENU_MAIN' }]] }
};

// --- GENERIC SEARCH FUNCTION ---
const searchAndSendResults = async (db, company, query, mode, type, platform, chatId, sendFn, sendPhotoFn) => {
    let sourceData = [];
    let imageType = '';
    
    if (type === 'PAYMENT') { sourceData = db.orders || []; imageType = 'PAYMENT'; }
    else if (type === 'EXIT') { sourceData = db.exitPermits || []; imageType = 'EXIT'; }
    else if (type === 'WH_OUT' || type === 'WH_BIJAK') { sourceData = (db.warehouseTransactions || []).filter(t => t.type === 'OUT'); imageType = 'BIJAK'; }
    else if (type === 'WH_IN') { sourceData = (db.warehouseTransactions || []).filter(t => t.type === 'IN'); imageType = 'RECEIPT'; }

    const results = sourceData.filter(o => {
        // ID Search Logic
        if (mode === 'ID') {
            const num = (o.trackingNumber || o.permitNumber || o.number || '').toString();
            return num.includes(query);
        }

        const itemCompany = o.company || o.payingCompany;
        if (company && itemCompany !== company) return false;
        
        if (mode === 'MONTH') {
            const shamsiMonth = toShamsiYearMonth(o.date);
            return shamsiMonth === query;
        } else if (mode === 'EXACT_DAY') {
            try {
                const d = new Date(o.date);
                const formatter = new Intl.DateTimeFormat('en-US-u-ca-persian', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Tehran' });
                const parts = formatter.formatToParts(d);
                const y = parts.find(p=>p.type==='year')?.value;
                const m = parts.find(p=>p.type==='month')?.value;
                const d_ = parts.find(p=>p.type==='day')?.value;
                return `${y}/${m}/${d_}` === query;
            } catch(e) { return false; }
        }
        return false;
    });

    if (results.length === 0) {
        return sendFn(chatId, `❌ موردی یافت نشد.`);
    }

    await sendFn(chatId, `✅ تعداد ${results.length} سند یافت شد. در حال ارسال...`);

    // Limit results to 10 to avoid spamming
    const limitedResults = results.slice(0, 10);

    for (const item of limitedResults) {
        try {
            const img = await Renderer.generateRecordImage(item, imageType);
            
            let caption = '';
            let pdfCallback = '';

            if (type === 'PAYMENT') {
                caption = `📄 *سند پرداخت #${item.trackingNumber}*\n📅 تاریخ: ${toShamsiFull(item.date)}\n👤 ذینفع: ${item.payee}\n💰 مبلغ: ${parseInt(item.totalAmount).toLocaleString()}\n📝 بابت: ${item.description}\n🔄 وضعیت: ${item.status}`;
                pdfCallback = `GEN_PDF_ORDER_${item.id}`;
            } else if (type === 'EXIT') {
                caption = `🚛 *مجوز خروج #${item.permitNumber}*\n📅 تاریخ: ${toShamsiFull(item.date)}\n👤 گیرنده: ${item.recipientName}\n📦 کالا: ${item.goodsName}\n🔄 وضعیت: ${item.status}`;
                pdfCallback = `GEN_PDF_EXIT_${item.id}`;
            } else if (type === 'WH_OUT' || type === 'WH_BIJAK') {
                caption = `📦 *حواله انبار (بیجک) #${item.number}*\n📅 تاریخ: ${toShamsiFull(item.date)}\n👤 گیرنده: ${item.recipientName}\n🚛 راننده: ${item.driverName||'-'}`;
                pdfCallback = `GEN_PDF_BIJAK_${item.id}`;
            } else if (type === 'WH_IN') {
                caption = `📥 *رسید ورود #${item.proformaNumber}*\n📅 تاریخ: ${toShamsiFull(item.date)}\n📦 اقلام: ${item.items.length} ردیف`;
            }

            const kb = pdfCallback ? { inline_keyboard: [[{ text: '📥 دریافت PDF', callback_data: pdfCallback }]] } : undefined;

            if (img && img.length > 0) {
                await sendPhotoFn(platform, chatId, img, caption, { reply_markup: kb });
            } else {
                await sendFn(chatId, caption, { reply_markup: kb });
            }
        } catch (e) { console.error(e); }
    }
    
    if (results.length > 10) {
        await sendFn(chatId, `⚠️ ... و ${results.length - 10} مورد دیگر. لطفا جستجو را محدودتر کنید.`);
    }
    
    await sendFn(chatId, "✅ پایان لیست.", { reply_markup: KEYBOARDS.MAIN });
};

// --- MAIN HANDLERS ---

export const handleMessage = async (platform, chatId, text, sendFn, sendPhotoFn, sendDocFn) => {
    const db = getDb();

    if (text === '/id' || text === 'آیدی') {
        return sendFn(chatId, `🆔 شناسه چت فعلی شما در ${platform === 'telegram' ? 'تلگرام' : 'بله'}: \`${chatId}\`\n(این کد را کپی کرده و در بخش تنظیمات در مقابل نام خود وارد کنید)`);
    }

    if (text.startsWith('/start') || text === 'شروع' || text === 'منو') {
        if (!sessions[chatId]) sessions[chatId] = { state: 'IDLE', data: {} };
        const session = sessions[chatId];
        session.state = 'IDLE';
        session.data = {};
        
        const user = resolveUser(db, platform, chatId);
        if (!user) {
            return sendFn(chatId, `👋 خوش آمدید.\nشناسه چت شما: \`${chatId}\`\n\n⛔ این شناسه هنوز در سیستم ثبت نشده است. لطفاً آن را به مدیر سیستم اعلام کنید تا دسترسی شما فعال شود.\n(پس از ثبت، مجدداً /start را بزنید)`);
        }
        return sendFn(chatId, `👋 سلام ${user.fullName}\nبه سیستم مدیریت یکپارچه خوش آمدید.\nلطفاً یک گزینه را انتخاب کنید:`, { reply_markup: KEYBOARDS.MAIN });
    }

    const user = resolveUser(db, platform, chatId);
    if (!user) return sendFn(chatId, `⛔ دسترسی غیرمجاز. شناسه شما (\`${chatId}\`) در سیستم ثبت نشده است.`);

    if (!sessions[chatId]) sessions[chatId] = { state: 'IDLE', data: {} };
    const session = sessions[chatId];


    // --- SEARCH BY ID HANDLER ---
    if (session.state === 'WAIT_FOR_SEARCH_ID') {
        const num = text.replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).trim(); // Persian numbers support
        if (!num) return sendFn(chatId, "❌ لطفا شماره سند را وارد کنید:");
        
        await searchAndSendResults(db, null, num, 'ID', session.data.targetType, platform, chatId, sendFn, sendPhotoFn);
        session.state = 'IDLE';
        return;
    }

    // --- STATE MACHINES ---

    // 1. Manual Date Search
    if (session.state === 'ARCHIVE_WAIT_DATE') {
        const dateRegex = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/;
        const match = text.match(dateRegex);
        if (!match) return sendFn(chatId, "⚠️ فرمت صحیح نیست. لطفا به صورت yyyy/mm/dd وارد کنید (مثال: 1403/02/15):");
        
        const normalizedDate = `${match[1]}/${match[2].padStart(2, '0')}/${match[3].padStart(2, '0')}`;
        await sendFn(chatId, `🔎 جستجو برای ${normalizedDate}...`);
        
        await searchAndSendResults(db, session.data.company, normalizedDate, 'EXACT_DAY', session.data.targetType, platform, chatId, sendFn, sendPhotoFn);
        session.state = 'IDLE';
        return;
    }

    // 2. Payment Registration
    if (session.state === 'PAY_AMOUNT') {
        const cleanText = text.replace(/,/g, '').replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
        const amt = parseInt(cleanText);
        if (isNaN(amt) || amt <= 0) return sendFn(chatId, "❌ مبلغ نامعتبر است. لطفا عدد وارد کنید:");
        session.data.amount = amt;
        session.state = 'PAY_PAYEE';
        return sendFn(chatId, "👤 نام گیرنده وجه (ذینفع) را وارد کنید:");
    }
    if (session.state === 'PAY_PAYEE') {
        session.data.payee = text;
        session.state = 'PAY_DESC';
        return sendFn(chatId, "📝 بابت (شرح پرداخت) را وارد کنید:");
    }
    if (session.state === 'PAY_DESC') {
        const company = session.data.company || db.settings.defaultCompany || '';
        let minStart = db.settings.currentTrackingNumber || 1000;
        if (db.settings.activeFiscalYearId && company) {
            const year = (db.settings.fiscalYears || []).find(y => y.id === db.settings.activeFiscalYearId);
            if (year && year.companySequences && year.companySequences[company]) {
                minStart = year.companySequences[company].startTrackingNumber || minStart;
            }
        }
        
        let trackingNumber = utils.findNextGapNumber(db.orders, company, 'trackingNumber', minStart);
        
        // Final Duplicate Check
        while (utils.checkForDuplicate(db.orders, 'trackingNumber', trackingNumber, 'payingCompany', company)) {
            trackingNumber++;
        }

        const order = {
            id: generateUUID(),
            trackingNumber: trackingNumber,
            date: new Date().toISOString().split('T')[0],
            payee: session.data.payee,
            totalAmount: session.data.amount,
            description: text,
            status: 'در انتظار بررسی مالی',
            requester: user ? user.fullName : 'کاربر ربات',
            payingCompany: company,
            createdAt: Date.now(),
            paymentDetails: [{ id: generateUUID(), method: 'حواله بانکی', amount: session.data.amount }]
        };
        if(!db.orders) db.orders = [];
        db.orders.unshift(order);
        dbManager.saveDb(db);
        console.log(`[Bot] Registered Payment #${order.trackingNumber} for user ${user ? user.fullName : chatId}`);
        session.state = 'IDLE';
        await sendFn(chatId, `✅ دستور پرداخت #${order.trackingNumber} با موفقیت ثبت شد.`);
        return;
    }

    // 3. Exit Permit Registration
    if (session.state === 'EXIT_RECIPIENT') {
        session.data.recipient = text;
        session.state = 'EXIT_ITEM';
        return sendFn(chatId, "📦 نام کالا را وارد کنید:");
    }
    if (session.state === 'EXIT_ITEM') {
        session.data.item = text;
        session.state = 'EXIT_COUNT';
        return sendFn(chatId, "🔢 تعداد/مقدار را وارد کنید:");
    }
    if (session.state === 'EXIT_COUNT') {
        const company = session.data.company || db.settings.defaultCompany || '';
        
        let minStart = db.settings.currentExitPermitNumber || 1000;
        if (db.settings.activeFiscalYearId && company) {
            const year = (db.settings.fiscalYears || []).find(y => y.id === db.settings.activeFiscalYearId);
            if (year && year.companySequences && year.companySequences[company]) {
                minStart = year.companySequences[company].startExitPermitNumber || minStart;
            }
        }
        
        let permitNumber = utils.findNextGapNumber(db.exitPermits, company, 'permitNumber', minStart);
        
        // Final Duplicate Check
        while (utils.checkForDuplicate(db.exitPermits, 'permitNumber', permitNumber, 'company', company)) {
            permitNumber++;
        }

        const permit = {
            id: generateUUID(),
            permitNumber: permitNumber,
            date: new Date().toISOString().split('T')[0],
            company: company,
            requester: user.fullName,
            recipientName: session.data.recipient,
            goodsName: session.data.item,
            cartonCount: parseInt(text) || 0,
            weight: 0,
            status: 'در انتظار تایید مدیرعامل',
            createdAt: Date.now(),
            items: [{ id: generateUUID(), goodsName: session.data.item, cartonCount: parseInt(text) || 0, weight: 0 }],
            destinations: [{ id: generateUUID(), recipientName: session.data.recipient, address: '', phone: '' }]
        };
        if(!db.exitPermits) db.exitPermits = [];
        db.exitPermits.push(permit);
        dbManager.saveDb(db);
        session.state = 'IDLE';

        // Notify first step (CEO)
        try {
            await notifyExitPermitStep(permit, platform, chatId, sendPhotoFn, db, 'ثبت توسط ربات');
        } catch (e) { console.error("Initial Notify Error:", e); }

        return sendFn(chatId, `✅ مجوز خروج #${permit.permitNumber} ثبت شد.`);
    }

    // 4. Warehouse Bijak Registration
    if (session.state === 'WH_BIJAK_COUNT') {
        const count = parseInt(text.replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
        if(isNaN(count)) return sendFn(chatId, "❌ لطفا عدد وارد کنید:");
        session.data.count = count;
        session.state = 'WH_BIJAK_ITEM';
        return sendFn(chatId, "📦 نام کالا را وارد کنید:");
    }
    if (session.state === 'WH_BIJAK_ITEM') {
        session.data.itemName = text;
        session.state = 'WH_BIJAK_RECIPIENT';
        return sendFn(chatId, "👤 نام تحویل گیرنده:");
    }
    if (session.state === 'WH_BIJAK_RECIPIENT') {
        const company = session.data.company || db.settings.defaultCompany || '';
        let minStart = 1000;
        if (db.settings.activeFiscalYearId && company) {
            const year = (db.settings.fiscalYears || []).find(y => y.id === db.settings.activeFiscalYearId);
            if (year && year.companySequences && year.companySequences[company]) {
                minStart = year.companySequences[company].startBijakNumber || 1000;
            }
        }
        let nextSeq = utils.findNextGapNumber(db.warehouseTransactions, company, 'number', minStart);
        
        // Final Duplicate Check
        while (utils.checkForDuplicate(db.warehouseTransactions, 'number', nextSeq, 'company', company)) {
            nextSeq++;
        }

        const tx = {
            id: generateUUID(),
            type: 'OUT',
            date: new Date().toISOString(),
            company: company,
            number: nextSeq,
            recipientName: text,
            items: [{
                itemId: 'bot_gen',
                itemName: session.data.itemName,
                quantity: session.data.count,
                weight: 0,
                unitPrice: 0
            }],
            createdAt: Date.now(),
            createdBy: user.fullName + ' (Bot)',
            status: 'PENDING'
        };
        if(!db.warehouseTransactions) db.warehouseTransactions = [];
        db.warehouseTransactions.unshift(tx);
        dbManager.saveDb(db);
        session.state = 'IDLE';
        return sendFn(chatId, `✅ بیجک خروج #${nextSeq} ثبت شد.`);
    }

    return sendFn(chatId, "دستور نامفهوم. از منو استفاده کنید.", { reply_markup: KEYBOARDS.MAIN });
};

export const notifyExitPermitStep = async (p, platform, chatId, sendPhotoFn, db, stepName) => {
    try {
        const img = await Renderer.generateRecordImage(p, 'EXIT');
        const caption = `🏗️ *خروج کالا از کارخانه*\n\n🔹 *شماره مجوز:* ${p.permitNumber}\n🏢 *شرکت:* ${p.company}\n📅 *تاریخ:* ${toShamsiFull(p.date)}\n👤 *تحویل‌گیرنده:* ${p.recipientName}\n📦 *شرح کالا:* ${p.goodsName}\n🔢 *تعداد:* ${p.cartonCount} کارتن\n\n✅ *مرحله:* ${stepName}\n🔄 *آخرین وضعیت:* ${p.status}${p.exitTime ? `\n🕒 *زمان خروج:* ${p.exitTime}` : ''}`;
        
        // Notify the user who did the action (if possible)
        if (chatId && sendPhotoFn) {
            sendPhotoFn(platform, chatId, img, caption).catch(e => console.error("User Notify Error:", e));
        }

        const settings = db.settings || {};
        let targetGroups = [];

        // Group 1 logic (Default routing strictly as expected by typical logic)
        if (p.status === 'در انتظار بررسی' ||
            p.status === 'در انتظار تایید مدیرعامل' || 
            p.status === 'در انتظار مدیر کارخانه' || 
            p.status === 'خارج شد' || 
            p.status.includes('رد')) {
            targetGroups.push(1);
        }
        
        // Group 2 logic (Settings-based routing)
        const g2Config = settings.exitPermitSecondGroupConfig || { activeStatuses: [] };
        if (g2Config.activeStatuses && g2Config.activeStatuses.includes(p.status)) {
            targetGroups.push(2);
        }

        // Distinctly and separately fire off to all targets, without await to prevent blocking
        for (const gNum of targetGroups) {
            let tgGroupId = '';
            let baleGroupId = '';
            let waGroupId = '';
            let companyConfig = settings.companyNotifications?.[p.company] || {};

            if (gNum === 1) {
                tgGroupId = companyConfig.telegramChannelId || settings.exitPermitNotificationTelegramId;
                baleGroupId = companyConfig.baleChannelId || settings.exitPermitNotificationBaleId;
                waGroupId = companyConfig.warehouseGroup || settings.exitPermitNotificationGroup || settings.defaultWarehouseGroup;
            } else {
                tgGroupId = g2Config.telegramId;
                baleGroupId = g2Config.baleId;
                waGroupId = g2Config.groupId;
            }

            // Fire Telegram
            if (tgGroupId && settings.telegramBotToken) {
                const cleanId = sanitizeGroupId(tgGroupId);
                import('./telegram.js').then(mod => {
                    if (mod?.sendBotPhoto) mod.sendBotPhoto(cleanId, img, caption).catch(e => console.error("TG Group Notify Error:", e));
                }).catch(e => console.error("TG Import Error", e));
            }

            // Fire Bale
            if (baleGroupId && settings.baleBotToken) {
                const cleanId = sanitizeGroupId(baleGroupId);
                import('./bale.js').then(mod => {
                    if (mod?.sendBotPhoto) mod.sendBotPhoto(cleanId, img, caption).catch(e => console.error("Bale Group Notify Error:", e));
                }).catch(e => console.error("Bale Import Error", e));
            }

            // Fire WhatsApp
            if (waGroupId && settings.whatsappEnabled) {
                import('./whatsapp.js').then(mod => {
                    if (mod?.sendMessage) {
                        const buffer = Buffer.from(img);
                        const b64 = buffer.toString('base64');
                        mod.sendMessage(waGroupId, caption, { data: b64, mimeType: 'image/png', filename: 'permit.png' })
                            .catch(e => console.error("WA Group Notify Error:", e));
                    }
                }).catch(e => console.error("WA Import Error", e));
            }
        }
    } catch (e) { console.error("Notification Helper Error:", e); }
};

export const handleCallback = async (platform, chatId, userId, data, sendFn, sendPhotoFn, sendDocFn) => {
    const db = getDb();
    const user = resolveUser(db, platform, userId);
    if (!user) {
        return sendFn(userId, `⛔ امکان انجام این عملیات وجود ندارد. شناسه شما (\`${userId}\`) ثبت نشده است.`);
    }

    if (!sessions[userId]) sessions[userId] = { state: 'IDLE', data: {} };
    const session = sessions[userId];

    // --- NAVIGATION ---
    if (data === 'MENU_MAIN') { session.state = 'IDLE'; return sendFn(chatId, "🏠 منوی اصلی:", { reply_markup: KEYBOARDS.MAIN }); }
    if (data === 'MENU_PAY') return sendFn(chatId, "💰 مدیریت پرداخت:", { reply_markup: KEYBOARDS.PAYMENT });
    if (data === 'MENU_EXIT') return sendFn(chatId, "🚛 مدیریت خروج:", { reply_markup: KEYBOARDS.EXIT });
    if (data === 'MENU_WH') return sendFn(chatId, "📦 مدیریت انبار:", { reply_markup: KEYBOARDS.WAREHOUSE });
    if (data === 'MENU_TRADE') return sendFn(chatId, "🌍 مدیریت بازرگانی:", { reply_markup: KEYBOARDS.TRADE });
    if (data === 'MENU_REPORTS') return sendFn(chatId, "📊 گزارشات مدیریتی:", { reply_markup: KEYBOARDS.REPORTS });

    // --- NEW: SEARCH BY ID INIT ---
    if (['ACT_SEARCH_ID_PAY', 'ACT_SEARCH_ID_EXIT', 'ACT_SEARCH_ID_WH'].includes(data)) {
        let type = 'PAYMENT';
        if (data === 'ACT_SEARCH_ID_EXIT') type = 'EXIT';
        if (data === 'ACT_SEARCH_ID_WH') type = 'WH_BIJAK';
        
        session.data.targetType = type;
        session.state = 'WAIT_FOR_SEARCH_ID';
        return sendFn(chatId, "🔢 شماره سند / حواله / بیجک را وارد کنید:");
    }

    // --- MANAGEMENT REPORTS HANDLERS ---
    if (data === 'RPT_DAILY') {
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const shamsiToday = toShamsiFull(new Date());
        
        const payToday = db.orders.filter(o => o.date.startsWith(today));
        const totalPay = payToday.reduce((sum, o) => sum + o.totalAmount, 0);
        
        const exitToday = db.exitPermits.filter(p => p.date.startsWith(today));
        const bijakToday = db.warehouseTransactions.filter(t => t.type === 'OUT' && t.date.startsWith(today));

        let msg = `📊 *گزارش خلاصه وضعیت امروز* (${shamsiToday})\n`;
        msg += `--------------------------\n`;
        msg += `💰 *پرداخت‌ها:* ${payToday.length} مورد\n`;
        msg += `💵 *جمع مبلغ:* ${parseInt(totalPay).toLocaleString()} ریال\n`;
        msg += `--------------------------\n`;
        msg += `🚛 *مجوزهای خروج:* ${exitToday.length} مورد\n`;
        msg += `📦 *بیجک‌های صادر شده:* ${bijakToday.length} مورد\n`;
        
        return sendFn(chatId, msg);
    }

    if (data === 'RPT_MONTHLY') {
        const today = new Date();
        const currentMonth = toShamsiYearMonth(today.toISOString()); // "1403/02"
        
        // Filter by Shamsi Month string comparison
        const payMonth = db.orders.filter(o => toShamsiYearMonth(o.date) === currentMonth);
        const totalPay = payMonth.reduce((sum, o) => sum + o.totalAmount, 0);
        
        const exitMonth = db.exitPermits.filter(p => toShamsiYearMonth(p.date) === currentMonth);
        const bijakMonth = db.warehouseTransactions.filter(t => t.type === 'OUT' && t.date.startsWith(today));

        let msg = `🗓 *عملکرد ماه جاری* (${currentMonth})\n`;
        msg += `--------------------------\n`;
        msg += `💰 *کل پرداخت‌ها:* ${payMonth.length} فقره\n`;
        msg += `💵 *جمع کل:* ${parseInt(totalPay).toLocaleString()} ریال\n`;
        msg += `--------------------------\n`;
        msg += `🚛 *مجوز خروج:* ${exitMonth.length} فقره\n`;
        msg += `📦 *بیجک انبار:* ${bijakMonth.length} فقره\n`;

        return sendFn(chatId, msg);
    }

    if (data === 'RPT_PENDING') {
        // Count Pending Items by Status
        const payPendingFin = db.orders.filter(o => o.status === 'در انتظار بررسی مالی').length;
        const payPendingMgr = db.orders.filter(o => o.status === 'تایید مالی / در انتظار مدیریت').length;
        const payPendingCeo = db.orders.filter(o => o.status === 'تایید مدیریت / در انتظار مدیرعامل').length;

        const exitPendingCeo = db.exitPermits.filter(p => p.status === 'در انتظار تایید مدیرعامل').length;
        const exitPendingFac = db.exitPermits.filter(p => p.status === 'در انتظار مدیر کارخانه').length;
        const exitPendingWh = db.exitPermits.filter(p => p.status === 'در انتظار تایید انبار').length;
        const exitPendingSec = db.exitPermits.filter(p => p.status === 'در انتظار خروج').length;

        let msg = `⏳ *وضعیت کارتابل‌ها (اسناد باز)*\n`;
        msg += `--------------------------\n`;
        msg += `💰 *دستور پرداخت:*\n`;
        msg += `   ▫️ مالی: ${payPendingFin}\n`;
        msg += `   ▫️ مدیریت: ${payPendingMgr}\n`;
        msg += `   ▫️ مدیرعامل: ${payPendingCeo}\n`;
        msg += `--------------------------\n`;
        msg += `🚛 *مجوز خروج:*\n`;
        msg += `   ▫️ مدیرعامل: ${exitPendingCeo}\n`;
        msg += `   ▫️ کارخانه: ${exitPendingFac}\n`;
        msg += `   ▫️ انبار: ${exitPendingWh}\n`;
        msg += `   ▫️ انتظامات: ${exitPendingSec}\n`;

        return sendFn(chatId, msg);
    }

    // --- PAYMENT ACTIONS ---
    if (data === 'ACT_PAY_NEW') {
        session.state = 'PAY_AMOUNT';
        return sendFn(chatId, "💵 مبلغ پرداختی (ریال) را وارد کنید:");
    }

    if (data === 'ACT_PAY_CARTABLE') {
        // Logic to show pending payments based on role
        let pendingOrders = [];
        if (user.role === 'financial') pendingOrders = db.orders.filter(o => o.status === 'در انتظار بررسی مالی');
        else if (user.role === 'manager') pendingOrders = db.orders.filter(o => o.status === 'تایید مالی / در انتظار مدیریت');
        else if (user.role === 'ceo') pendingOrders = db.orders.filter(o => o.status === 'تایید مدیریت / در انتظار مدیرعامل');
        else if (user.role === 'admin') pendingOrders = db.orders.filter(o => !o.status.includes('نهایی') && !o.status.includes('رد'));

        if (pendingOrders.length === 0) return sendFn(chatId, "✅ کارتابل شما خالی است.");

        for (const order of pendingOrders) {
            const caption = `🔸 سند #${order.trackingNumber}\n👤 ${order.payee}\n💰 ${parseInt(order.totalAmount).toLocaleString()} ریال\n📝 بابت: ${order.description}`;
            const kb = {
                inline_keyboard: [
                    [
                        { text: '✅ تایید', callback_data: `APP_PAY_${order.id}` },
                        { text: '❌ رد', callback_data: `REJ_PAY_${order.id}` }
                    ]
                ]
            };
            await sendFn(chatId, caption, { reply_markup: kb });
        }
        return;
    }

    // Payment Approval Logic
    if (data.startsWith('APP_PAY_')) {
        const id = data.replace('APP_PAY_', '');
        const order = db.orders.find(o => o.id === id);
        if (order) {
            let canApprove = false;
            if (order.status === 'در انتظار بررسی مالی' && ['financial', 'admin'].includes(user.role)) canApprove = true;
            else if (order.status === 'تایید مالی / در انتظار مدیریت' && ['manager', 'admin'].includes(user.role)) canApprove = true;
            else if (order.status === 'تایید مدیریت / در انتظار مدیرعامل' && ['ceo', 'admin'].includes(user.role)) canApprove = true;

            if (!canApprove) return sendFn(userId, "⛔ شما دسترسی لازم برای این مرحله را ندارید.");

            if (order.status === 'در انتظار بررسی مالی') order.status = 'تایید مالی / در انتظار مدیریت';
            else if (order.status === 'تایید مالی / در انتظار مدیریت') order.status = 'تایید مدیریت / در انتظار مدیرعامل';
            else if (order.status === 'تایید مدیریت / در انتظار مدیرعامل') order.status = 'تایید نهایی';
            
            saveDb(db);
            sendFn(chatId, `✅ سند #${order.trackingNumber} تایید شد.`);
        }
        return;
    }
    if (data.startsWith('REJ_PAY_')) {
        const id = data.replace('REJ_PAY_', '');
        const order = db.orders.find(o => o.id === id);
        if (order) {
            let canReject = false;
            if (order.status === 'در انتظار بررسی مالی' && ['financial', 'admin'].includes(user.role)) canReject = true;
            else if (order.status === 'تایید مالی / در انتظار مدیریت' && ['manager', 'admin'].includes(user.role)) canReject = true;
            else if (order.status === 'تایید مدیریت / در انتظار مدیرعامل' && ['ceo', 'admin'].includes(user.role)) canReject = true;

            if (!canReject) return sendFn(userId, "⛔ شما دسترسی لازم برای رد این مرحله را ندارید.");

            order.status = 'رد شده';
            saveDb(db);
            sendFn(chatId, `❌ سند #${order.trackingNumber} رد شد.`);
        }
        return;
    }

    // --- EXIT ACTIONS ---
    if (data === 'ACT_EXIT_NEW') {
        session.state = 'EXIT_RECIPIENT';
        return sendFn(chatId, "👤 نام گیرنده کالا را وارد کنید:");
    }

    if (data === 'ACT_EXIT_CARTABLE') {
        let pendingPermits = [];
        if (user.role === 'ceo') pendingPermits = db.exitPermits.filter(p => p.status === 'در انتظار تایید مدیرعامل');
        else if (user.role === 'factory_manager') pendingPermits = db.exitPermits.filter(p => p.status === 'در انتظار مدیر کارخانه');
        else if (user.role === 'warehouse_keeper') pendingPermits = db.exitPermits.filter(p => p.status === 'در انتظار تایید انبار');
        else if (user.role === 'security_head' || user.role === 'security_guard') pendingPermits = db.exitPermits.filter(p => p.status === 'در انتظار خروج');
        else if (user.role === 'admin') pendingPermits = db.exitPermits.filter(p => !p.status.includes('بایگانی') && !p.status.includes('رد'));

        if (pendingPermits.length === 0) return sendFn(chatId, "✅ کارتابل خروج خالی است.");

        for (const p of pendingPermits) {
            const caption = `🚛 مجوز #${p.permitNumber}\n👤 گیرنده: ${p.recipientName}\n📦 کالا: ${p.goodsName}\n🔄 وضعیت: ${p.status}`;
            const kb = {
                inline_keyboard: [
                    [
                        { text: '✅ تایید', callback_data: `APP_EXIT_${p.id}` },
                        { text: '❌ رد', callback_data: `REJ_EXIT_${p.id}` }
                    ]
                ]
            };
            await sendFn(chatId, caption, { reply_markup: kb });
        }
        return;
    }

    if (data.startsWith('APP_EXIT_')) {
        const id = data.replace('APP_EXIT_', '');
        const p = db.exitPermits.find(x => x.id === id);
        if (p) {
            let canApprove = false;
            if (p.status === 'در انتظار تایید مدیرعامل' && ['ceo', 'admin'].includes(user.role)) canApprove = true;
            else if (p.status === 'در انتظار مدیر کارخانه' && ['factory_manager', 'admin'].includes(user.role)) canApprove = true;
            else if (p.status === 'در انتظار تایید انبار' && ['warehouse_keeper', 'admin'].includes(user.role)) canApprove = true;
            else if (p.status === 'در انتظار خروج' && ['security_head', 'security_guard', 'admin'].includes(user.role)) canApprove = true;

            if (!canApprove) {
                return sendFn(userId, "⛔ شما دسترسی لازم برای تایید این مرحله را ندارید.");
            }

            const oldStatus = p.status;
            let stepName = '';

            if (p.status === 'در انتظار تایید مدیرعامل') {
                p.status = 'در انتظار مدیر کارخانه';
                stepName = 'مدیرعامل';
            } else if (p.status === 'در انتظار مدیر کارخانه') {
                p.status = 'در انتظار تایید انبار';
                stepName = 'مدیر کارخانه';
            } else if (p.status === 'در انتظار تایید انبار') {
                p.status = 'در انتظار خروج';
                stepName = 'سرپرست انبار';
            } else if (p.status === 'در انتظار خروج') {
                p.status = 'خارج شده (بایگانی)';
                p.exitTime = new Date().toLocaleTimeString('fa-IR');
                stepName = 'انتظامات';
            }
            
            saveDb(db);
            sendFn(chatId, `✅ مجوز #${p.permitNumber} تایید شد.`);

            if (stepName) {
                await notifyExitPermitStep(p, platform, chatId, sendPhotoFn, db, stepName);
            }
        }
        return;
    }

    if (data.startsWith('REJ_EXIT_')) {
        const id = data.replace('REJ_EXIT_', '');
        const p = db.exitPermits.find(x => x.id === id);
        if (p) {
            let canReject = false;
            if (p.status === 'در انتظار تایید مدیرعامل' && ['ceo', 'admin'].includes(user.role)) canReject = true;
            else if (p.status === 'در انتظار مدیر کارخانه' && ['factory_manager', 'admin'].includes(user.role)) canReject = true;
            else if (p.status === 'در انتظار تایید انبار' && ['warehouse_keeper', 'admin'].includes(user.role)) canReject = true;
            else if (p.status === 'در انتظار خروج' && ['security_head', 'security_guard', 'admin'].includes(user.role)) canReject = true;

            if (!canReject) {
                return sendFn(userId, "⛔ شما دسترسی لازم برای رد این مرحله را ندارید.");
            }

            p.status = 'رد شده';
            saveDb(db);
            sendFn(chatId, `❌ مجوز #${p.permitNumber} رد شد.`);
        }
        return;
    }

    // --- WAREHOUSE ACTIONS ---
    if (data === 'ACT_WH_NEW_BIJAK') {
        session.data.targetType = 'WH_BIJAK'; // Context for Company Select
        
        const companies = [...new Set((db.warehouseTransactions||[]).map(o=>o.company).filter(Boolean))];
        if (companies.length === 0 && db.settings.companyNames) companies.push(...db.settings.companyNames);
        
        if (companies.length === 0) {
             session.state = 'WH_BIJAK_COUNT';
             return sendFn(chatId, "تعداد کالا را وارد کنید:");
        }

        const buttons = companies.map(c => [{ text: c, callback_data: `SEL_COMP_BIJAK_${c}` }]);
        buttons.push([{ text: '🔙 بازگشت', callback_data: 'MENU_WH' }]);
        return sendFn(chatId, "🏢 شرکت صادرکننده بیجک را انتخاب کنید:", { reply_markup: { inline_keyboard: buttons } });
    }

    if (data.startsWith('SEL_COMP_BIJAK_')) {
        session.data.company = data.replace('SEL_COMP_BIJAK_', '');
        session.state = 'WH_BIJAK_COUNT';
        return sendFn(chatId, `🏢 شرکت: ${session.data.company}\n🔢 تعداد کالا را وارد کنید:`);
    }

    if (data === 'ACT_WH_CARTABLE') {
        const pendingBijaks = (db.warehouseTransactions || []).filter(t => t.type === 'OUT' && t.status === 'PENDING');
        
        if (pendingBijaks.length === 0) return sendFn(chatId, "✅ کارتابل انبار خالی است.");

        // Only Admin or CEO (or Managers with access) can approve via bot ideally, 
        // but here we allow basic check if user role fits (Admin/CEO) or if we want open access for ease.
        // Assuming Admin/CEO role check:
        const canApprove = ['admin', 'ceo', 'manager'].includes(user.role);
        
        for (const tx of pendingBijaks) {
            const caption = `📦 *بیجک انبار #${tx.number}*\n📅 ${toShamsiFull(tx.date)}\n🏢 ${tx.company}\n👤 گیرنده: ${tx.recipientName}\n🔢 اقلام: ${tx.items.length} ردیف`;
            const kb = canApprove ? {
                inline_keyboard: [
                    [
                        { text: '✅ تایید نهایی', callback_data: `APP_WH_${tx.id}` },
                        { text: '❌ رد', callback_data: `REJ_WH_${tx.id}` }
                    ]
                ]
            } : undefined;
            await sendFn(chatId, caption, { reply_markup: kb });
        }
        return;
    }

    if (data.startsWith('APP_WH_')) {
        const id = data.replace('APP_WH_', '');
        const tx = db.warehouseTransactions.find(t => t.id === id);
        if (tx) {
            tx.status = 'APPROVED';
            tx.approvedBy = user.fullName + ' (Bot)';
            saveDb(db);
            sendFn(chatId, `✅ بیجک #${tx.number} تایید نهایی شد.`);
        }
        return;
    }

    if (data.startsWith('REJ_WH_')) {
        const id = data.replace('REJ_WH_', '');
        const tx = db.warehouseTransactions.find(t => t.id === id);
        if (tx) {
            tx.status = 'REJECTED';
            tx.rejectedBy = user.fullName + ' (Bot)';
            saveDb(db);
            sendFn(chatId, `❌ بیجک #${tx.number} رد شد.`);
        }
        return;
    }

    // --- WAREHOUSE STOCK REPORT ---
    if (data === 'WH_RPT_STOCK') {
        await sendFn(chatId, "⏳ در حال محاسبه موجودی و تولید PDF...");
        try {
            // Calculate Stock Logic (simplified from WarehouseModule)
            // Fix: Check undefined arrays
            const items = Array.isArray(db.warehouseItems) ? db.warehouseItems : [];
            const txs = Array.isArray(db.warehouseTransactions) ? db.warehouseTransactions : [];
            const companies = [...new Set(txs.map(t => t.company).filter(Boolean))];
            
            const reportData = companies.map(company => {
                const companyItems = items.map(catItem => {
                    let qty = 0; let weight = 0;
                    txs.filter(t => t.company === company && t.status !== 'REJECTED').forEach(t => {
                        // Check if items array exists on transaction
                        if (Array.isArray(t.items)) {
                            t.items.forEach(ti => {
                                if (ti.itemId === catItem.id) {
                                    if (t.type === 'IN') { qty += (ti.quantity || 0); weight += (ti.weight || 0); }
                                    else { qty -= (ti.quantity || 0); weight -= (ti.weight || 0); }
                                }
                            });
                        }
                    });
                    return { name: catItem.name, quantity: qty, weight: weight };
                });
                return { company, items: companyItems };
            });

            // Generate HTML Table for PDF
            let html = `
            <!DOCTYPE html>
            <html lang="fa" dir="rtl">
            <head><meta charset="UTF-8"><style>
                body { font-family: 'Vazirmatn', sans-serif; padding: 20px; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; }
                th, td { border: 1px solid #333; padding: 8px; text-align: center; }
                th { background-color: #f3f4f6; }
                .company-header { background-color: #e5e7eb; font-weight: bold; text-align: right; padding: 10px; }
            </style></head>
            <body>
                <h2 style="text-align:center">گزارش موجودی انبار</h2>
                <div style="text-align:center; font-size:12px; margin-bottom:20px;">تاریخ: ${new Date().toLocaleDateString('fa-IR')}</div>
            `;

            reportData.forEach(grp => {
                html += `<div class="company-header">${grp.company}</div>
                <table>
                    <thead><tr><th>کالا</th><th>تعداد</th><th>وزن (KG)</th></tr></thead>
                    <tbody>
                        ${grp.items.map(i => `<tr><td>${i.name}</td><td>${i.quantity}</td><td>${i.weight}</td></tr>`).join('')}
                    </tbody>
                </table>`;
            });
            html += `</body></html>`;

            const pdfBuffer = await Renderer.generatePdfBuffer(html);
            if (pdfBuffer && pdfBuffer.length > 100) {
                await sendDocFn(chatId, pdfBuffer, `Stock_Report_${Date.now()}.pdf`, 'گزارش موجودی انبار');
            } else {
                await sendFn(chatId, "⚠️ خطا در تولید PDF.\n(خروجی خالی)");
            }

        } catch (e) {
            console.error("Stock Report Error:", e);
            await sendFn(chatId, `⚠️ خطا در تولید گزارش: ${e.message}`);
        }
        return;
    }

    // --- ARCHIVE & SEARCH LOGIC (GENERIC) ---
    const ARCHIVE_TYPES = {
        'ACT_ARCHIVE_PAY': 'PAYMENT',
        'ACT_ARCHIVE_EXIT': 'EXIT',
        'ACT_ARCHIVE_WH_OUT': 'WH_OUT',
        'ACT_ARCHIVE_WH_IN': 'WH_IN'
    };

    if (ARCHIVE_TYPES[data]) {
        const type = ARCHIVE_TYPES[data];
        session.data.targetType = type;
        
        let companies = [];
        if (type === 'PAYMENT') companies = [...new Set((db.orders||[]).map(o=>o.payingCompany).filter(Boolean))];
        else if (type === 'EXIT') companies = [...new Set((db.exitPermits||[]).map(o=>o.company).filter(Boolean))];
        else companies = [...new Set((db.warehouseTransactions||[]).map(o=>o.company).filter(Boolean))];

        if (companies.length === 0) return sendFn(chatId, "❌ داده‌ای برای جستجو یافت نشد.");
        
        const buttons = companies.map(c => [{ text: c, callback_data: `ARC_SEL_COMP_${c}` }]);
        buttons.push([{ text: '🔙 بازگشت', callback_data: 'MENU_MAIN' }]);
        
        return sendFn(chatId, `🏢 شرکت را انتخاب کنید (${type}):`, { reply_markup: { inline_keyboard: buttons } });
    }

    if (data.startsWith('ARC_SEL_COMP_')) {
        const company = data.replace('ARC_SEL_COMP_', '');
        session.data.company = company;
        const type = session.data.targetType || 'PAYMENT';

        let sourceList = [];
        if (type === 'PAYMENT') sourceList = (db.orders||[]).filter(o => o.payingCompany === company);
        else if (type === 'EXIT') sourceList = (db.exitPermits||[]).filter(o => o.company === company);
        else sourceList = (db.warehouseTransactions||[]).filter(o => o.company === company);

        const years = getAvailableYears(sourceList);
        
        const buttons = [];
        for(let i=0; i<years.length; i+=3) {
            const row = years.slice(i, i+3).map(y => ({ text: y, callback_data: `ARC_SEL_YEAR_${y}` }));
            buttons.push(row);
        }
        buttons.push([{ text: '📅 جستجوی روز دقیق', callback_data: 'ARCHIVE_INPUT_DATE' }]);
        buttons.push([{ text: '🔙 بازگشت', callback_data: 'MENU_MAIN' }]);

        return sendFn(chatId, `🗓 سال را انتخاب کنید (${company}):`, { reply_markup: { inline_keyboard: buttons } });
    }

    if (data === 'ARCHIVE_INPUT_DATE') {
        session.state = 'ARCHIVE_WAIT_DATE';
        return sendFn(chatId, "⌨️ تاریخ دقیق را وارد کنید (yyyy/mm/dd):");
    }

    if (data.startsWith('ARC_SEL_YEAR_')) {
        const year = data.replace('ARC_SEL_YEAR_', '');
        session.data.year = year;
        const months = [
            { text: 'فروردین', id: '01' }, { text: 'اردیبهشت', id: '02' }, { text: 'خرداد', id: '03' },
            { text: 'تیر', id: '04' }, { text: 'مرداد', id: '05' }, { text: 'شهریور', id: '06' },
            { text: 'مهر', id: '07' }, { text: 'آبان', id: '08' }, { text: 'آذر', id: '09' },
            { text: 'دی', id: '10' }, { text: 'بهمن', id: '11' }, { text: 'اسفند', id: '12' }
        ];
        const buttons = [];
        for(let i=0; i<months.length; i+=3) {
            const row = months.slice(i, i+3).map(m => ({ text: m.text, callback_data: `ARC_EXEC_MONTH_${m.id}` }));
            buttons.push(row);
        }
        buttons.push([{ text: '🔙 بازگشت', callback_data: 'MENU_MAIN' }]);
        return sendFn(chatId, `🗓 ماه را انتخاب کنید (${year}):`, { reply_markup: { inline_keyboard: buttons } });
    }

    if (data.startsWith('ARC_EXEC_MONTH_')) {
        const month = data.replace('ARC_EXEC_MONTH_', '');
        const targetDateStr = `${session.data.year}/${month}`;
        await sendFn(chatId, `⏳ جستجو در ${targetDateStr}...`);
        await searchAndSendResults(db, session.data.company, targetDateStr, 'MONTH', session.data.targetType, platform, chatId, sendFn, sendPhotoFn);
        return;
    }

    // --- PDF GENERATION ---
    if (data.startsWith('GEN_PDF_ORDER_')) {
        const id = data.replace('GEN_PDF_ORDER_', '');
        const item = db.orders.find(o => o.id === id);
        if(item) await sendPdf(item, 'PAYMENT', chatId, sendFn, sendDocFn);
    }
    if (data.startsWith('GEN_PDF_EXIT_')) {
        const id = data.replace('GEN_PDF_EXIT_', '');
        const item = db.exitPermits.find(o => o.id === id);
        if(item) await sendPdf(item, 'EXIT', chatId, sendFn, sendDocFn);
    }
    if (data.startsWith('GEN_PDF_BIJAK_')) {
        const id = data.replace('GEN_PDF_BIJAK_', '');
        const item = db.warehouseTransactions.find(o => o.id === id);
        if(item) await sendPdf(item, 'BIJAK', chatId, sendFn, sendDocFn);
    }
};

const sendPdf = async (item, type, chatId, sendFn, sendDocFn) => {
    await sendFn(chatId, "⏳ در حال تولید PDF...");
    try {
        let pdf = null;
        let filename = 'document.pdf';
        
        if (type === 'PAYMENT') {
            pdf = await Renderer.generateVoucherPDF(item);
            filename = `Voucher_${item.trackingNumber}.pdf`;
        } else if (type === 'EXIT') {
            pdf = await Renderer.generateExitPermitPDF(item);
            filename = `Permit_${item.permitNumber}.pdf`;
        } else if (type === 'BIJAK') {
            pdf = await Renderer.generateBijakPDF(item);
            filename = `Bijak_${item.number}.pdf`;
        }

        if (pdf && pdf.length > 100) {
            await sendDocFn(chatId, pdf, filename, 'فایل PDF سند');
        } else {
            await sendFn(chatId, "⚠️ خطا در تولید PDF: خروجی خالی است.");
        }
    } catch (e) {
        console.error("PDF Error:", e);
        // Provide the actual error message to the user for better diagnostics
        await sendFn(chatId, `⚠️ خطا در تولید PDF: ${e.message}`);
    }
};
