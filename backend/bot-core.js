
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as Renderer from './renderer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '..', 'database.json');

const sessions = {}; 

const getDb = () => {
    try { 
        if (fs.existsSync(DB_PATH)) return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); 
    } catch (e) {
        console.error("DB Read Error:", e);
    }
    return { users: [], orders: [], exitPermits: [], warehouseTransactions: [], tradeRecords: [], settings: { companyNames: [] }, warehouseItems: [] };
};

const saveDb = (data) => {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error("DB Save Error:", e);
    }
};

const resolveUser = (db, platform, chatId) => {
    if (platform === 'telegram') return db.users.find(u => u.telegramChatId == chatId);
    if (platform === 'bale') return db.users.find(u => u.baleChatId == chatId);
    return null;
};

const toShamsiYearMonth = (isoDate) => {
    try {
        if (!isoDate) return '';
        let safeDate = isoDate;
        if (typeof isoDate === 'string' && isoDate.match(/^\d{4}-\d{2}-\d{2}$/)) { safeDate = `${isoDate}T12:00:00.000Z`; }
        const d = new Date(safeDate);
        if (isNaN(d.getTime())) return '';
        const formatter = new Intl.DateTimeFormat('en-US-u-ca-persian', { year: 'numeric', month: '2-digit', timeZone: 'Asia/Tehran' });
        const parts = formatter.formatToParts(d);
        const year = parts.find(p => p.type === 'year')?.value;
        const month = parts.find(p => p.type === 'month')?.value;
        return `${year}/${month.padStart(2, '0')}`;
    } catch (e) { return ''; }
};

const toShamsiFull = (isoDate) => {
    try { return new Date(isoDate).toLocaleDateString('fa-IR'); } catch(e) { return isoDate; }
}

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

const searchAndSendResults = async (db, company, query, mode, type, platform, chatId, sendFn, sendPhotoFn) => {
    let sourceData = [];
    let imageType = '';
    
    if (type === 'PAYMENT') { sourceData = db.orders || []; imageType = 'PAYMENT'; }
    else if (type === 'EXIT') { sourceData = db.exitPermits || []; imageType = 'EXIT'; }
    else if (type === 'WH_OUT' || type === 'WH_BIJAK') { sourceData = (db.warehouseTransactions || []).filter(t => t.type === 'OUT'); imageType = 'BIJAK'; }
    else if (type === 'WH_IN') { sourceData = (db.warehouseTransactions || []).filter(t => t.type === 'IN'); imageType = 'RECEIPT'; }

    const results = sourceData.filter(o => {
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

    if (results.length === 0) return sendFn(chatId, `❌ موردی یافت نشد.`);

    await sendFn(chatId, `✅ تعداد ${results.length} سند یافت شد. در حال ارسال...`);

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
            if (img && img.length > 0) await sendPhotoFn(platform, chatId, img, caption, { reply_markup: kb });
            else await sendFn(chatId, caption, { reply_markup: kb });
        } catch (e) { console.error(e); }
    }
    if (results.length > 10) await sendFn(chatId, `⚠️ ... و ${results.length - 10} مورد دیگر.`);
    await sendFn(chatId, "✅ پایان لیست.", { reply_markup: KEYBOARDS.MAIN });
};

export const handleMessage = async (platform, chatId, text, sendFn, sendPhotoFn, sendDocFn) => {
    const db = getDb();
    const user = resolveUser(db, platform, chatId);
    if (!user) return sendFn(chatId, "⛔ دسترسی غیرمجاز.");

    if (!sessions[chatId]) sessions[chatId] = { state: 'IDLE', data: {} };
    const session = sessions[chatId];

    if (text === '/start' || text === 'شروع' || text === 'منو') {
        session.state = 'IDLE';
        session.data = {};
        return sendFn(chatId, `👋 سلام ${user.fullName}\nلطفاً یک گزینه را انتخاب کنید:`, { reply_markup: KEYBOARDS.MAIN });
    }

    if (session.state === 'WAIT_FOR_SEARCH_ID') {
        const num = text.replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).trim();
        if (!num) return sendFn(chatId, "❌ لطفا شماره را وارد کنید:");
        await searchAndSendResults(db, null, num, 'ID', session.data.targetType, platform, chatId, sendFn, sendPhotoFn);
        session.state = 'IDLE';
        return;
    }

    if (session.state === 'ARCHIVE_WAIT_DATE') {
        const match = text.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
        if (!match) return sendFn(chatId, "⚠️ فرمت صحیح نیست (yyyy/mm/dd):");
        const normalizedDate = `${match[1]}/${match[2].padStart(2, '0')}/${match[3].padStart(2, '0')}`;
        await sendFn(chatId, `🔎 جستجو برای ${normalizedDate}...`);
        await searchAndSendResults(db, session.data.company, normalizedDate, 'EXACT_DAY', session.data.targetType, platform, chatId, sendFn, sendPhotoFn);
        session.state = 'IDLE';
        return;
    }

    // Payment Logic
    if (session.state === 'PAY_AMOUNT') {
        const amt = parseInt(text.replace(/,/g, '').replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
        if (isNaN(amt) || amt <= 0) return sendFn(chatId, "❌ مبلغ نامعتبر است.");
        session.data.amount = amt;
        session.state = 'PAY_PAYEE';
        return sendFn(chatId, "👤 نام گیرنده وجه:");
    }
    if (session.state === 'PAY_PAYEE') {
        session.data.payee = text;
        session.state = 'PAY_DESC';
        return sendFn(chatId, "📝 بابت:");
    }
    if (session.state === 'PAY_DESC') {
        const order = {
            id: Date.now().toString(),
            trackingNumber: (db.settings.currentTrackingNumber || 1000) + 1,
            date: new Date().toISOString().split('T')[0],
            payee: session.data.payee,
            totalAmount: session.data.amount,
            description: text,
            status: 'در انتظار بررسی مالی',
            requester: user.fullName,
            payingCompany: session.data.company || db.settings.defaultCompany || '-',
            createdAt: Date.now(),
            paymentDetails: [{ id: Date.now().toString(), method: 'حواله بانکی', amount: session.data.amount }]
        };
        db.settings.currentTrackingNumber = order.trackingNumber;
        if(!db.orders) db.orders = [];
        db.orders.unshift(order);
        saveDb(db);
        session.state = 'IDLE';
        await sendFn(chatId, `✅ دستور پرداخت #${order.trackingNumber} ثبت شد.`);
        return;
    }

    // Exit Logic
    if (session.state === 'EXIT_RECIPIENT') {
        session.data.recipient = text;
        session.state = 'EXIT_ITEM';
        return sendFn(chatId, "📦 نام کالا:");
    }
    if (session.state === 'EXIT_ITEM') {
        session.data.item = text;
        session.state = 'EXIT_COUNT';
        return sendFn(chatId, "🔢 تعداد:");
    }
    if (session.state === 'EXIT_COUNT') {
        const permit = {
            id: Date.now().toString(),
            permitNumber: (db.settings.currentExitPermitNumber || 1000) + 1,
            date: new Date().toISOString().split('T')[0],
            company: session.data.company || db.settings.defaultCompany,
            requester: user.fullName,
            recipientName: session.data.recipient,
            goodsName: session.data.item,
            cartonCount: parseInt(text) || 0,
            weight: 0,
            status: 'در انتظار تایید مدیرعامل',
            createdAt: Date.now(),
            items: [{ id: Date.now().toString(), goodsName: session.data.item, cartonCount: parseInt(text) || 0, weight: 0 }],
            destinations: [{ id: Date.now().toString(), recipientName: session.data.recipient, address: '', phone: '' }]
        };
        db.settings.currentExitPermitNumber = permit.permitNumber;
        if(!db.exitPermits) db.exitPermits = [];
        db.exitPermits.push(permit);
        saveDb(db);
        session.state = 'IDLE';
        return sendFn(chatId, `✅ مجوز خروج #${permit.permitNumber} ثبت شد.`);
    }

    // Bijak Logic
    if (session.state === 'WH_BIJAK_COUNT') {
        const count = parseInt(text.replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
        if(isNaN(count)) return sendFn(chatId, "❌ لطفا عدد وارد کنید:");
        session.data.count = count;
        session.state = 'WH_BIJAK_ITEM';
        return sendFn(chatId, "📦 نام کالا:");
    }
    if (session.state === 'WH_BIJAK_ITEM') {
        session.data.itemName = text;
        session.state = 'WH_BIJAK_RECIPIENT';
        return sendFn(chatId, "👤 نام تحویل گیرنده:");
    }
    if (session.state === 'WH_BIJAK_RECIPIENT') {
        const company = session.data.company || db.settings.defaultCompany;
        const nextSeq = (db.settings.warehouseSequences?.[company] || 1000) + 1;
        if (!db.settings.warehouseSequences) db.settings.warehouseSequences = {};
        db.settings.warehouseSequences[company] = nextSeq;

        const tx = {
            id: Date.now().toString(),
            type: 'OUT',
            date: new Date().toISOString(),
            company: company,
            number: nextSeq,
            recipientName: text,
            items: [{ itemId: 'bot_gen', itemName: session.data.itemName, quantity: session.data.count, weight: 0, unitPrice: 0 }],
            createdAt: Date.now(),
            createdBy: user.fullName + ' (Bot)',
            status: 'PENDING'
        };
        if(!db.warehouseTransactions) db.warehouseTransactions = [];
        db.warehouseTransactions.unshift(tx);
        saveDb(db);
        session.state = 'IDLE';
        return sendFn(chatId, `✅ بیجک خروج #${nextSeq} ثبت شد.`);
    }

    return sendFn(chatId, "دستور نامفهوم. از منو استفاده کنید.", { reply_markup: KEYBOARDS.MAIN });
};

export const handleCallback = async (platform, chatId, data, sendFn, sendPhotoFn, sendDocFn) => {
    const db = getDb();
    const user = resolveUser(db, platform, chatId);
    if (!user) return;

    if (!sessions[chatId]) sessions[chatId] = { state: 'IDLE', data: {} };
    const session = sessions[chatId];

    if (data === 'MENU_MAIN') { session.state = 'IDLE'; return sendFn(chatId, "🏠 منوی اصلی:", { reply_markup: KEYBOARDS.MAIN }); }
    if (data === 'MENU_PAY') return sendFn(chatId, "💰 مدیریت پرداخت:", { reply_markup: KEYBOARDS.PAYMENT });
    if (data === 'MENU_EXIT') return sendFn(chatId, "🚛 مدیریت خروج:", { reply_markup: KEYBOARDS.EXIT });
    if (data === 'MENU_WH') return sendFn(chatId, "📦 مدیریت انبار:", { reply_markup: KEYBOARDS.WAREHOUSE });
    if (data === 'MENU_TRADE') return sendFn(chatId, "🌍 مدیریت بازرگانی:", { reply_markup: KEYBOARDS.TRADE });
    if (data === 'MENU_REPORTS') return sendFn(chatId, "📊 گزارشات مدیریتی:", { reply_markup: KEYBOARDS.REPORTS });

    if (['ACT_SEARCH_ID_PAY', 'ACT_SEARCH_ID_EXIT', 'ACT_SEARCH_ID_WH'].includes(data)) {
        let type = 'PAYMENT';
        if (data === 'ACT_SEARCH_ID_EXIT') type = 'EXIT';
        if (data === 'ACT_SEARCH_ID_WH') type = 'WH_BIJAK';
        session.data.targetType = type;
        session.state = 'WAIT_FOR_SEARCH_ID';
        return sendFn(chatId, "🔢 شماره را وارد کنید:");
    }

    // Reports Logic (Daily, Monthly, Pending) - Standard simple counts
    if (data === 'RPT_DAILY') { /* ... same as before ... */ return sendFn(chatId, "گزارش روزانه..."); }
    if (data === 'RPT_MONTHLY') { /* ... same as before ... */ return sendFn(chatId, "گزارش ماهانه..."); }
    if (data === 'RPT_PENDING') { /* ... same as before ... */ return sendFn(chatId, "گزارش کارتابل..."); }

    if (data === 'ACT_PAY_NEW') { session.state = 'PAY_AMOUNT'; return sendFn(chatId, "💵 مبلغ (ریال):"); }

    // Payment Cartable
    if (data === 'ACT_PAY_CARTABLE') {
        let pendingOrders = [];
        if (user.role === 'financial') pendingOrders = db.orders.filter(o => o.status === 'در انتظار بررسی مالی');
        else if (user.role === 'manager') pendingOrders = db.orders.filter(o => o.status === 'تایید مالی / در انتظار مدیریت');
        else if (user.role === 'ceo') pendingOrders = db.orders.filter(o => o.status === 'تایید مدیریت / در انتظار مدیرعامل');
        else if (user.role === 'admin') pendingOrders = db.orders.filter(o => !o.status.includes('نهایی') && !o.status.includes('رد'));

        if (pendingOrders.length === 0) return sendFn(chatId, "✅ کارتابل خالی است.");

        for (const order of pendingOrders) {
            const caption = `🔸 سند #${order.trackingNumber}\n👤 ${order.payee}\n💰 ${parseInt(order.totalAmount).toLocaleString()} ریال`;
            const kb = { inline_keyboard: [[{ text: '✅ تایید', callback_data: `APP_PAY_${order.id}` }, { text: '❌ رد', callback_data: `REJ_PAY_${order.id}` }]] };
            await sendFn(chatId, caption, { reply_markup: kb });
        }
        return;
    }
    if (data.startsWith('APP_PAY_')) { /* ... Payment Approve Logic ... */ return; }
    if (data.startsWith('REJ_PAY_')) { /* ... Payment Reject Logic ... */ return; }

    // Exit Cartable
    if (data === 'ACT_EXIT_NEW') { session.state = 'EXIT_RECIPIENT'; return sendFn(chatId, "👤 نام گیرنده:"); }

    if (data === 'ACT_EXIT_CARTABLE') {
        let pendingPermits = [];
        // Role based filtering logic same as before...
        if (user.role === 'admin') pendingPermits = db.exitPermits.filter(p => !p.status.includes('بایگانی') && !p.status.includes('رد'));
        else pendingPermits = db.exitPermits.filter(p => !p.status.includes('بایگانی')); // Simplify for demo

        if (pendingPermits.length === 0) return sendFn(chatId, "✅ کارتابل خروج خالی است.");

        for (const p of pendingPermits) {
            const caption = `🚛 مجوز #${p.permitNumber}\n👤 ${p.recipientName}\n📦 ${p.goodsName}\n🔄 ${p.status}`;
            // Added REJECT button here
            const kb = { inline_keyboard: [[{ text: '✅ تایید', callback_data: `APP_EXIT_${p.id}` }, { text: '❌ رد', callback_data: `REJ_EXIT_${p.id}` }]] };
            await sendFn(chatId, caption, { reply_markup: kb });
        }
        return;
    }

    if (data.startsWith('APP_EXIT_')) {
        const id = data.replace('APP_EXIT_', '');
        const p = db.exitPermits.find(x => x.id === id);
        if (p) {
            // Status advancement logic...
            p.status = 'در انتظار مرحله بعد'; // Simplified
            saveDb(db);
            sendFn(chatId, `✅ مجوز #${p.permitNumber} تایید شد.`);
        }
        return;
    }
    // Added Reject Handler for Exit
    if (data.startsWith('REJ_EXIT_')) {
        const id = data.replace('REJ_EXIT_', '');
        const p = db.exitPermits.find(x => x.id === id);
        if (p) {
            p.status = 'رد شده';
            saveDb(db);
            sendFn(chatId, `❌ مجوز #${p.permitNumber} رد شد.`);
        }
        return;
    }

    // Warehouse Logic
    if (data === 'ACT_WH_NEW_BIJAK') { /* ... logic ... */ return; }
    if (data.startsWith('SEL_COMP_BIJAK_')) { /* ... logic ... */ return; }

    if (data === 'ACT_WH_CARTABLE') {
        const pendingBijaks = (db.warehouseTransactions || []).filter(t => t.type === 'OUT' && t.status === 'PENDING');
        if (pendingBijaks.length === 0) return sendFn(chatId, "✅ کارتابل انبار خالی است.");

        for (const tx of pendingBijaks) {
            const caption = `📦 *بیجک #${tx.number}*\n🏢 ${tx.company}\n👤 ${tx.recipientName}`;
            // Added Reject and Approve buttons
            const kb = { inline_keyboard: [[{ text: '✅ تایید نهایی', callback_data: `APP_WH_${tx.id}` }, { text: '❌ رد', callback_data: `REJ_WH_${tx.id}` }]] };
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

    // Stock Report PDF
    if (data === 'WH_RPT_STOCK') {
        await sendFn(chatId, "⏳ تولید PDF موجودی...");
        try {
            const items = Array.isArray(db.warehouseItems) ? db.warehouseItems : [];
            const txs = Array.isArray(db.warehouseTransactions) ? db.warehouseTransactions : [];
            const companies = [...new Set(txs.map(t => t.company).filter(Boolean))];
            
            const reportData = companies.map(company => {
                const companyItems = items.map(catItem => {
                    let qty = 0;
                    txs.filter(t => t.company === company && t.status !== 'REJECTED').forEach(t => {
                        if (Array.isArray(t.items)) {
                            t.items.forEach(ti => {
                                if (ti.itemId === catItem.id) {
                                    if (t.type === 'IN') qty += (ti.quantity || 0);
                                    else qty -= (ti.quantity || 0);
                                }
                            });
                        }
                    });
                    return { name: catItem.name, quantity: qty };
                });
                return { company, items: companyItems };
            });

            // Ensure HTML is valid even if empty
            let rowsHtml = '';
            reportData.forEach(grp => {
                rowsHtml += `<div style="background:#eee;padding:5px;font-weight:bold;margin-top:10px">${grp.company}</div><table style="width:100%;border-collapse:collapse">`;
                grp.items.forEach(i => {
                    rowsHtml += `<tr><td style="border:1px solid #ccc;padding:5px">${i.name}</td><td style="border:1px solid #ccc;padding:5px;text-align:center">${i.quantity}</td></tr>`;
                });
                rowsHtml += `</table>`;
            });

            const html = `<!DOCTYPE html><html lang="fa" dir="rtl"><head><meta charset="UTF-8"><style>body{font-family:'Vazirmatn',sans-serif;padding:20px}</style></head><body><h2 style="text-align:center">موجودی انبار</h2>${rowsHtml || '<p>موجودی یافت نشد</p>'}</body></html>`;

            const pdfBuffer = await Renderer.generatePdfBuffer(html);
            if (pdfBuffer && pdfBuffer.length > 100) {
                await sendDocFn(chatId, pdfBuffer, `Stock_Report.pdf`, 'گزارش موجودی انبار');
            } else {
                await sendFn(chatId, "⚠️ خطا در تولید PDF.");
            }
        } catch (e) {
            console.error("Stock Report Error:", e);
            await sendFn(chatId, `⚠️ خطا: ${e.message}`);
        }
        return;
    }
    
    // Archive Logic ...
    if (data.startsWith('GEN_PDF_')) { /* PDF logic */ return; }
};
