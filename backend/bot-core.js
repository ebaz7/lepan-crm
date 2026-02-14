
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as Renderer from './renderer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '..', 'database.json');

const sessions = {}; 

// --- DATA ACCESS ---
const getDb = () => {
    try { 
        if (fs.existsSync(DB_PATH)) return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); 
    } catch (e) {}
    return { users: [], orders: [], exitPermits: [], warehouseTransactions: [], tradeRecords: [], settings: { companyNames: [] }, warehouseItems: [] };
};
const saveDb = (data) => fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));

const resolveUser = (db, platform, chatId) => {
    if (platform === 'telegram') return db.users.find(u => u.telegramChatId == chatId);
    if (platform === 'bale') return db.users.find(u => u.baleChatId == chatId);
    return null;
};

// --- HELPERS ---
const toShamsiYearMonth = (isoDate) => {
    try {
        const d = new Date(isoDate);
        // Format to "1403/05"
        return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
            year: 'numeric',
            month: '2-digit'
        }).format(d).replace(/[۰-۹]/g, d => '0123456789'.indexOf(d)); // Ensure English digits for comparison
    } catch (e) {
        return '';
    }
};

const getAvailableYears = (orders) => {
    const years = new Set();
    orders.forEach(o => {
        const sh = toShamsiYearMonth(o.date);
        if (sh) years.add(sh.split('/')[0]);
    });
    return Array.from(years).sort().reverse();
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
            [{ text: '📂 کارتابل پرداخت', callback_data: 'ACT_PAY_CARTABLE' }],
            [{ text: '🗄️ گزارش بایگانی (جستجو)', callback_data: 'ACT_PAY_ARCHIVE_REPORT' }],
            [{ text: '🔙 بازگشت', callback_data: 'MENU_MAIN' }]
        ]
    },
    EXIT: {
        inline_keyboard: [
            [{ text: '➕ ثبت مجوز خروج', callback_data: 'ACT_EXIT_NEW' }],
            [{ text: '📂 کارتابل خروج', callback_data: 'ACT_EXIT_CARTABLE' }],
            [{ text: '📄 گزارش PDF خروجی‌های اخیر', callback_data: 'RPT_PDF_EXIT_RECENT' }],
            [{ text: '🔙 بازگشت', callback_data: 'MENU_MAIN' }]
        ]
    },
    WAREHOUSE: {
        inline_keyboard: [
            [{ text: '📦 موجودی انبار (Stock PDF)', callback_data: 'WH_RPT_STOCK' }],
            [{ text: '📄 کاردکس کالا (PDF)', callback_data: 'WH_RPT_KARDEX' }],
            [{ text: '🚛 آخرین بیجک‌های خروجی (PDF)', callback_data: 'WH_RPT_BIJAKS' }],
            [{ text: '📥 آخرین رسیدهای ورود (PDF)', callback_data: 'WH_RPT_RECEIPTS' }],
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
            [{ text: '🔙 بازگشت', callback_data: 'MENU_MAIN' }]
        ]
    },
    BACK: { inline_keyboard: [[{ text: '🔙 انصراف', callback_data: 'MENU_MAIN' }]] }
};

// --- HANDLERS ---

export const handleMessage = async (platform, chatId, text, sendFn, sendPhotoFn, sendDocFn) => {
    const db = getDb();
    const user = resolveUser(db, platform, chatId);
    if (!user) return sendFn(chatId, "⛔ دسترسی غیرمجاز. شما در سیستم تعریف نشده‌اید.");

    if (!sessions[chatId]) sessions[chatId] = { state: 'IDLE', data: {} };
    const session = sessions[chatId];

    if (text === '/start' || text === 'شروع' || text === 'منو') {
        session.state = 'IDLE';
        return sendFn(chatId, `👋 سلام ${user.fullName}\nبه سامانه یکپارچه مدیریت خوش آمدید.\nلطفاً یکی از بخش‌های زیر را انتخاب کنید:`, { reply_markup: KEYBOARDS.MAIN });
    }

    // --- FORMS ---
    // 1. Payment Registration
    if (session.state === 'PAY_AMOUNT') {
        const amt = parseInt(text.replace(/,/g, '').replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
        if (isNaN(amt)) return sendFn(chatId, "❌ مبلغ نامعتبر است. لطفاً عدد وارد کنید:", { reply_markup: KEYBOARDS.BACK });
        session.data.amount = amt;
        session.state = 'PAY_PAYEE';
        return sendFn(chatId, "👤 نام گیرنده وجه (ذینفع) را وارد کنید:", { reply_markup: KEYBOARDS.BACK });
    }
    if (session.state === 'PAY_PAYEE') {
        session.data.payee = text;
        session.state = 'PAY_DESC';
        return sendFn(chatId, "📝 بابت (شرح پرداخت) را وارد کنید:", { reply_markup: KEYBOARDS.BACK });
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
        await sendFn(chatId, `✅ سند #${order.trackingNumber} با موفقیت ثبت شد.`);
        await notifyRole(db, 'financial', `🔔 پرداخت جدید #${order.trackingNumber}\nمبلغ: ${order.totalAmount}\nدرخواست: ${user.fullName}`, 'PAYMENT', order, sendFn, sendPhotoFn);
        return;
    }

    // 2. Exit Registration
    if (session.state === 'EXIT_RECIPIENT') {
        session.data.recipient = text;
        session.state = 'EXIT_GOODS';
        return sendFn(chatId, "📦 نام کالا را وارد کنید:", { reply_markup: KEYBOARDS.BACK });
    }
    if (session.state === 'EXIT_GOODS') {
        session.data.goods = text;
        session.state = 'EXIT_COUNT';
        return sendFn(chatId, "🔢 تعداد (کارتن) را وارد کنید:", { reply_markup: KEYBOARDS.BACK });
    }
    if (session.state === 'EXIT_COUNT') {
        const permit = {
            id: Date.now().toString(),
            permitNumber: (db.settings.currentExitPermitNumber || 1000) + 1,
            date: new Date().toISOString().split('T')[0],
            recipientName: session.data.recipient,
            goodsName: session.data.goods,
            cartonCount: parseInt(text) || 0,
            weight: 0,
            company: session.data.company || db.settings.defaultCompany || '-',
            status: 'در انتظار تایید مدیرعامل',
            requester: user.fullName,
            items: [{ goodsName: session.data.goods, cartonCount: parseInt(text)||0, weight: 0 }],
            createdAt: Date.now()
        };
        db.settings.currentExitPermitNumber = permit.permitNumber;
        if(!db.exitPermits) db.exitPermits = [];
        db.exitPermits.push(permit);
        saveDb(db);
        session.state = 'IDLE';
        await sendFn(chatId, `✅ خروج #${permit.permitNumber} ثبت شد.`);
        await notifyRole(db, 'ceo', `🔔 خروج جدید #${permit.permitNumber}\nگیرنده: ${permit.recipientName}`, 'EXIT', permit, sendFn, sendPhotoFn);
        return;
    }

    return sendFn(chatId, "دستور نامعتبر. از منو استفاده کنید.", { reply_markup: KEYBOARDS.MAIN });
};

export const handleCallback = async (platform, chatId, data, sendFn, sendPhotoFn, sendDocFn) => {
    const db = getDb();
    const user = resolveUser(db, platform, chatId);
    if (!user) return;

    if (!sessions[chatId]) sessions[chatId] = { state: 'IDLE', data: {} };
    const session = sessions[chatId];

    // Navigation
    if (data === 'MENU_MAIN') { session.state = 'IDLE'; return sendFn(chatId, "🏠 منوی اصلی:", { reply_markup: KEYBOARDS.MAIN }); }
    if (data === 'MENU_PAY') return sendFn(chatId, "💰 مدیریت پرداخت:", { reply_markup: KEYBOARDS.PAYMENT });
    if (data === 'MENU_EXIT') return sendFn(chatId, "🚛 مدیریت خروج:", { reply_markup: KEYBOARDS.EXIT });
    if (data === 'MENU_WH') return sendFn(chatId, "📦 مدیریت انبار:", { reply_markup: KEYBOARDS.WAREHOUSE });
    if (data === 'MENU_TRADE') return sendFn(chatId, "🌍 مدیریت بازرگانی:", { reply_markup: KEYBOARDS.TRADE });
    if (data === 'MENU_REPORTS') return sendFn(chatId, "📊 گزارشات مدیریتی:", { reply_markup: KEYBOARDS.REPORTS });

    // Actions
    if (data === 'ACT_PAY_NEW') {
        session.state = 'PAY_AMOUNT';
        return sendFn(chatId, "💵 مبلغ پرداخت (ریال):");
    }
    if (data === 'ACT_EXIT_NEW') {
        session.state = 'EXIT_RECIPIENT';
        return sendFn(chatId, "👤 نام گیرنده کالا:");
    }

    // --- ARCHIVE FLOW (BUTTON BASED) ---
    if (data === 'ACT_PAY_ARCHIVE_REPORT') {
        const companies = [...new Set((db.orders || []).map(o => o.payingCompany).filter(Boolean))];
        if (companies.length === 0) return sendFn(chatId, "❌ هیچ شرکتی در سیستم یافت نشد.");
        
        const buttons = companies.map(c => [{ text: c, callback_data: `ARCHIVE_COMP_${c}` }]);
        buttons.push([{ text: '🔙 بازگشت', callback_data: 'MENU_PAY' }]);
        
        return sendFn(chatId, "🏢 لطفاً شرکت مورد نظر را انتخاب کنید:", { reply_markup: { inline_keyboard: buttons } });
    }

    if (data.startsWith('ARCHIVE_COMP_')) {
        const company = data.replace('ARCHIVE_COMP_', '');
        session.data.company = company;
        
        // Find available years for this company
        const companyOrders = (db.orders || []).filter(o => o.payingCompany === company);
        const years = getAvailableYears(companyOrders);
        
        if (years.length === 0) {
            // Add default current year if nothing found
            years.push('1403');
        }

        const buttons = [];
        // Group years 3 per row
        for(let i=0; i<years.length; i+=3) {
            const row = years.slice(i, i+3).map(y => ({ text: y, callback_data: `ARCHIVE_YEAR_${y}` }));
            buttons.push(row);
        }
        buttons.push([{ text: '🔙 بازگشت', callback_data: 'ACT_PAY_ARCHIVE_REPORT' }]);

        return sendFn(chatId, `📅 شرکت: ${company}\nلطفاً سال مورد نظر را انتخاب کنید:`, { reply_markup: { inline_keyboard: buttons } });
    }

    if (data.startsWith('ARCHIVE_YEAR_')) {
        const year = data.replace('ARCHIVE_YEAR_', '');
        session.data.year = year;

        // Month Buttons (3x4 grid)
        const months = [
            { text: 'فروردین', id: '01' }, { text: 'اردیبهشت', id: '02' }, { text: 'خرداد', id: '03' },
            { text: 'تیر', id: '04' }, { text: 'مرداد', id: '05' }, { text: 'شهریور', id: '06' },
            { text: 'مهر', id: '07' }, { text: 'آبان', id: '08' }, { text: 'آذر', id: '09' },
            { text: 'دی', id: '10' }, { text: 'بهمن', id: '11' }, { text: 'اسفند', id: '12' }
        ];

        const buttons = [];
        for(let i=0; i<months.length; i+=3) {
            const row = months.slice(i, i+3).map(m => ({ text: m.text, callback_data: `ARCHIVE_EXEC_${m.id}` }));
            buttons.push(row);
        }
        buttons.push([{ text: '🔙 بازگشت', callback_data: `ARCHIVE_COMP_${session.data.company}` }]);

        return sendFn(chatId, `🗓 سال: ${year}\nلطفاً ماه مورد نظر را انتخاب کنید:`, { reply_markup: { inline_keyboard: buttons } });
    }

    if (data.startsWith('ARCHIVE_EXEC_')) {
        const month = data.replace('ARCHIVE_EXEC_', '');
        const targetDateStr = `${session.data.year}/${month}`;
        
        await sendFn(chatId, `⏳ در حال جستجوی اسناد برای ${targetDateStr} ...`);

        const results = (db.orders || []).filter(o => {
            if (o.payingCompany !== session.data.company) return false;
            // Convert DB ISO date to Shamsi YYYY/MM
            const shamsi = toShamsiYearMonth(o.date);
            return shamsi === targetDateStr;
        });

        if (results.length === 0) {
            return sendFn(chatId, `❌ هیچ سندی برای تاریخ ${targetDateStr} یافت نشد.`, {
                reply_markup: { inline_keyboard: [[{ text: '🔙 انتخاب مجدد ماه', callback_data: `ARCHIVE_YEAR_${session.data.year}` }]] }
            });
        }

        // 1. Send Images
        for (const item of results) {
            try {
                const img = await Renderer.generateRecordImage(item, 'PAYMENT');
                const caption = `سند #${item.trackingNumber}\nمبلغ: ${parseInt(item.totalAmount).toLocaleString()}\nوضعیت: ${item.status}`;
                if (img && img.length > 0) {
                    await sendPhotoFn(platform, chatId, img, caption);
                } else {
                    await sendFn(chatId, `📋 ${caption}`);
                }
            } catch (e) { console.error(e); }
        }

        // 2. PDF Download
        session.data.foundIds = results.map(r => r.id);
        session.data.dateQuery = targetDateStr; // For PDF Title

        await sendFn(chatId, `✅ تعداد ${results.length} سند یافت شد.\nبرای دریافت فایل PDF کامل روی دکمه زیر بزنید:`, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '📄 دانلود فایل PDF گزارش', callback_data: 'GEN_ARCHIVE_PDF' }],
                    [{ text: '🔍 جستجوی جدید', callback_data: 'ACT_PAY_ARCHIVE_REPORT' }],
                    [{ text: '🏠 منوی اصلی', callback_data: 'MENU_MAIN' }]
                ]
            }
        });
        return;
    }

    // --- GENERATE ARCHIVE PDF ---
    if (data === 'GEN_ARCHIVE_PDF') {
        if (!session.data.foundIds || session.data.foundIds.length === 0) {
            return sendFn(chatId, "❌ لیست منقضی شده است. لطفا مجدد جستجو کنید.");
        }
        
        const records = db.orders.filter(o => session.data.foundIds.includes(o.id));
        const rows = records.map(o => [
            o.trackingNumber, 
            o.payee, 
            o.totalAmount.toLocaleString(), 
            o.date, 
            o.description, 
            o.status
        ]);
        
        await sendPdfSafe(
            Renderer.generateReportPDF(
                `گزارش بایگانی پرداخت - ${session.data.company} (${session.data.dateQuery})`, 
                ['شماره', 'ذینفع', 'مبلغ', 'تاریخ', 'شرح', 'وضعیت'], 
                rows
            ), 
            'Archive_Report.pdf', 
            'گزارش بایگانی پرداخت'
        );
        return;
    }

    // --- CARTABLES ---
    if (data === 'ACT_PAY_CARTABLE') {
        await sendFn(chatId, "⏳ در حال دریافت کارتابل...");
        let items = [];
        
        // ADMIN sees ALL pending
        if (user.role === 'admin') {
            items = (db.orders || []).filter(o => 
                o.status === 'در انتظار بررسی مالی' || 
                o.status === 'تایید مالی / در انتظار مدیریت' || 
                o.status === 'تایید مدیریت / در انتظار مدیرعامل' ||
                o.status.includes('ابطال')
            );
        } else {
            // Normal roles
            if (user.role === 'financial') items = (db.orders || []).filter(o => o.status === 'در انتظار بررسی مالی' || o.status.includes('ابطال'));
            if (user.role === 'manager') items = (db.orders || []).filter(o => o.status === 'تایید مالی / در انتظار مدیریت');
            if (user.role === 'ceo') items = (db.orders || []).filter(o => o.status === 'تایید مدیریت / در انتظار مدیرعامل');
        }
        
        if (items.length === 0) return sendFn(chatId, "✅ کارتابل پرداخت خالی است.");
        
        for (const item of items) {
            try {
                // Try generating image
                const img = await Renderer.generateRecordImage(item, 'PAYMENT');
                const kb = { inline_keyboard: [[{ text: '✅ تایید', callback_data: `APP_PAY_${item.id}` }, { text: '❌ رد', callback_data: `REJ_PAY_${item.id}` }]] };
                
                if (img && img.length > 0) {
                    await sendPhotoFn(platform, chatId, img, `سند #${item.trackingNumber}\nوضعیت: ${item.status}`, { reply_markup: kb });
                } else {
                    const txt = `📋 *دستور پرداخت #${item.trackingNumber}*\n👤 ذینفع: ${item.payee}\n💰 مبلغ: ${parseInt(item.totalAmount).toLocaleString()}\n📝 بابت: ${item.description}\n⏳ وضعیت: ${item.status}`;
                    await sendFn(chatId, txt, { reply_markup: kb });
                }
            } catch (e) {
                console.error("Error sending item:", e);
                await sendFn(chatId, `خطا در نمایش سند #${item.trackingNumber}. اما می‌توانید اقدام کنید.`, { 
                    reply_markup: { inline_keyboard: [[{ text: '✅ تایید', callback_data: `APP_PAY_${item.id}` }, { text: '❌ رد', callback_data: `REJ_PAY_${item.id}` }]] } 
                });
            }
        }
        return;
    }

    if (data === 'ACT_EXIT_CARTABLE') {
        let items = [];
        if (user.role === 'admin') {
            items = (db.exitPermits || []).filter(p => 
                p.status === 'در انتظار تایید مدیرعامل' || 
                p.status === 'در انتظار مدیر کارخانه' || 
                p.status === 'در انتظار تایید انبار' ||
                p.status === 'در انتظار خروج'
            );
        } else {
            if (user.role === 'ceo') items = (db.exitPermits || []).filter(p => p.status === 'در انتظار تایید مدیرعامل');
            if (user.role === 'factory_manager') items = (db.exitPermits || []).filter(p => p.status === 'در انتظار مدیر کارخانه');
            if (user.role === 'warehouse_keeper') items = (db.exitPermits || []).filter(p => p.status === 'در انتظار تایید انبار');
            if (user.role === 'security_head') items = (db.exitPermits || []).filter(p => p.status === 'در انتظار خروج');
        }

        if (items.length === 0) return sendFn(chatId, "✅ کارتابل خروج خالی است.");

        for (const item of items) {
            try {
                const img = await Renderer.generateRecordImage(item, 'EXIT');
                const kb = { inline_keyboard: [[{ text: '✅ تایید', callback_data: `APP_EXIT_${item.id}` }, { text: '❌ رد', callback_data: `REJ_EXIT_${item.id}` }]] };
                
                if (img && img.length > 0) {
                    await sendPhotoFn(platform, chatId, img, `مجوز #${item.permitNumber}\nگیرنده: ${item.recipientName}\nوضعیت: ${item.status}`, { reply_markup: kb });
                } else {
                    await sendFn(chatId, `🚛 *مجوز خروج #${item.permitNumber}*\n👤 گیرنده: ${item.recipientName}\n📦 کالا: ${item.goodsName}\n⏳ وضعیت: ${item.status}`, { reply_markup: kb });
                }
            } catch (e) { console.error(e); }
        }
        return;
    }

    // --- APPROVALS ---
    if (data.startsWith('APP_PAY_')) {
        const id = data.replace('APP_PAY_', '');
        const order = db.orders.find(o => o.id === id);
        if (order) {
            let next = '';
            if (order.status === 'در انتظار بررسی مالی') next = 'تایید مالی / در انتظار مدیریت';
            else if (order.status === 'تایید مالی / در انتظار مدیریت') next = 'تایید مدیریت / در انتظار مدیرعامل';
            else if (order.status === 'تایید مدیریت / در انتظار مدیرعامل') next = 'تایید نهایی';
            else if (order.status.includes('ابطال')) next = 'باطل شده'; // Handle revocation flow simply
            
            if (next) {
                order.status = next;
                saveDb(db);
                sendFn(chatId, `✅ تایید شد. وضعیت جدید: ${next}`);
            } else {
                sendFn(chatId, `ℹ️ وضعیت قابل تغییر نیست.`);
            }
        }
    }
    
    if (data.startsWith('REJ_PAY_')) {
        const id = data.replace('REJ_PAY_', '');
        const order = db.orders.find(o => o.id === id);
        if (order) {
            order.status = 'رد شده';
            saveDb(db);
            sendFn(chatId, `❌ سند رد شد.`);
        }
    }

    if (data.startsWith('APP_EXIT_')) {
        const id = data.replace('APP_EXIT_', '');
        const permit = db.exitPermits.find(p => p.id === id);
        if (permit) {
            let next = '';
            if (permit.status === 'در انتظار تایید مدیرعامل') next = 'در انتظار مدیر کارخانه';
            else if (permit.status === 'در انتظار مدیر کارخانه') next = 'در انتظار تایید انبار';
            else if (permit.status === 'در انتظار تایید انبار') next = 'در انتظار خروج';
            else if (permit.status === 'در انتظار خروج') next = 'خارج شده (بایگانی)';
            
            if (next) {
                permit.status = next;
                saveDb(db);
                sendFn(chatId, `✅ تایید شد. وضعیت جدید: ${next}`);
            }
        }
    }

    // --- PDF REPORTS (SAFE MODE) ---
    
    const sendPdfSafe = async (generatePromise, filename, caption) => {
        try {
            sendFn(chatId, "⏳ در حال تولید گزارش PDF...");
            const pdf = await generatePromise;
            
            // CRITICAL FIX: Check buffer validity before sending
            if (pdf && Buffer.isBuffer(pdf) && pdf.length > 100) {
                await sendDocFn(chatId, pdf, filename, caption);
            } else {
                console.error("PDF Generation Failed: Empty or invalid buffer returned");
                sendFn(chatId, "⚠️ خطا در تولید فایل PDF (فایل خالی است). لطفاً لاگ سرور را بررسی کنید.");
            }
        } catch (e) {
            console.error("PDF Send Error:", e);
            sendFn(chatId, `❌ خطا در ارسال گزارش: ${e.message}`);
        }
    };

    // 1. WAREHOUSE STOCK PDF
    if (data === 'WH_RPT_STOCK') {
        const items = db.warehouseItems || [];
        const txs = db.warehouseTransactions || [];
        const stockData = items.map(item => {
            let qty = 0;
            txs.forEach(tx => {
                if (tx.status !== 'REJECTED') {
                    const line = tx.items.find(i => i.itemId === item.id);
                    if (line) {
                        if (tx.type === 'IN') qty += line.quantity;
                        else qty -= line.quantity;
                    }
                }
            });
            return [item.name, item.code || '-', item.unit, qty];
        });
        await sendPdfSafe(Renderer.generateReportPDF('گزارش موجودی انبار', ['نام کالا', 'کد کالا', 'واحد', 'موجودی فعلی'], stockData), 'Stock_Report.pdf', 'گزارش موجودی انبار');
    }

    // 2. WAREHOUSE KARDEX
    if (data === 'WH_RPT_KARDEX') {
        const txs = (db.warehouseTransactions || []).sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0, 20);
        const rows = txs.map(tx => [tx.type === 'IN' ? 'ورود' : 'خروج', tx.number || tx.proformaNumber || '-', new Date(tx.date).toLocaleDateString('fa-IR'), tx.items.length, tx.company]);
        await sendPdfSafe(Renderer.generateReportPDF('گزارش گردش انبار (کاردکس کلی)', ['نوع', 'شماره سند', 'تاریخ', 'تعداد اقلام', 'شرکت'], rows), 'Kardex_Report.pdf', 'گزارش گردش انبار');
    }

    // 3. WAREHOUSE BIJAKS
    if (data === 'WH_RPT_BIJAKS') {
        const txs = (db.warehouseTransactions || []).filter(t => t.type === 'OUT').slice(0, 20);
        const rows = txs.map(tx => [tx.number, new Date(tx.date).toLocaleDateString('fa-IR'), tx.recipientName, tx.driverName || '-', tx.status]);
        await sendPdfSafe(Renderer.generateReportPDF('لیست بیجک‌های خروجی اخیر', ['شماره', 'تاریخ', 'گیرنده', 'راننده', 'وضعیت'], rows), 'Bijaks_Report.pdf', 'بیجک‌های خروجی');
    }

    // 4. TRADE REPORTS
    if (data === 'TRD_RPT_ALLOCATION') {
        const records = (db.tradeRecords || []).filter(r => r.status !== 'Completed');
        const rows = records.map(r => [r.fileNumber, r.goodsName, r.company, (r.stages['در صف تخصیص ارز']?.isCompleted ? 'در صف' : 'تخصیص یافته'), `${r.mainCurrency} ${r.freightCost}`]);
        await sendPdfSafe(Renderer.generateReportPDF('گزارش صف تخصیص ارز', ['شماره پرونده', 'کالا', 'شرکت', 'وضعیت', 'مبلغ'], rows, true), 'Allocation_Report.pdf', 'گزارش صف تخصیص');
    }

    if (data === 'TRD_RPT_ACTIVE') {
        const records = (db.tradeRecords || []).filter(r => r.status !== 'Completed');
        const rows = records.map(r => [r.fileNumber, r.goodsName, r.sellerName, r.company]);
        await sendPdfSafe(Renderer.generateReportPDF('لیست پرونده‌های فعال بازرگانی', ['شماره', 'کالا', 'فروشنده', 'شرکت'], rows), 'Active_Files.pdf', 'لیست پرونده‌ها');
    }

    // 5. EXIT RECENT
    if (data === 'RPT_PDF_EXIT_RECENT') {
        const recents = (db.exitPermits || []).slice(0, 20).map(p => [p.permitNumber, p.recipientName, p.goodsName, p.date, p.status]);
        await sendPdfSafe(Renderer.generateReportPDF('لیست ۲۰ مجوز خروج اخیر', ['شماره', 'گیرنده', 'کالا', 'تاریخ', 'وضعیت'], recents), 'Recent_Exits.pdf', 'گزارش خروج');
    }
};

const notifyRole = async (db, role, caption, type, data, sendFn, sendPhotoFn) => {
    const users = db.users.filter(u => u.role === role || u.role === 'admin');
    for (const u of users) {
        if (u.telegramChatId) {
            try {
                const img = await Renderer.generateRecordImage(data, type);
                const kb = { inline_keyboard: [[{ text: '✅ بررسی', callback_data: `ACT_${type}_CARTABLE` }]] };
                if (img && img.length > 0) {
                    await sendPhotoFn('telegram', u.telegramChatId, img, caption, { reply_markup: kb });
                } else {
                    await sendFn(u.telegramChatId, caption, { reply_markup: kb });
                }
            } catch(e){}
        }
        if (u.baleChatId) {
            try {
                const img = await Renderer.generateRecordImage(data, type);
                const kb = { inline_keyboard: [[{ text: '✅ بررسی', callback_data: `ACT_${type}_CARTABLE` }]] };
                if (img && img.length > 0) {
                    await sendPhotoFn('bale', u.baleChatId, img, caption, { reply_markup: kb });
                } else {
                    await sendFn(u.baleChatId, caption, { reply_markup: kb });
                }
            } catch(e){}
        }
    }
};
