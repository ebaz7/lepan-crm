
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
            [{ text: '🗄️ گزارش بایگانی (جستجو)', callback_data: 'ACT_ARCHIVE_PAY' }],
            [{ text: '🔙 بازگشت', callback_data: 'MENU_MAIN' }]
        ]
    },
    EXIT: {
        inline_keyboard: [
            [{ text: '➕ ثبت مجوز خروج', callback_data: 'ACT_EXIT_NEW' }],
            [{ text: '📂 کارتابل خروج', callback_data: 'ACT_EXIT_CARTABLE' }],
            [{ text: '🗄️ جستجو و بایگانی خروج', callback_data: 'ACT_ARCHIVE_EXIT' }],
            [{ text: '🔙 بازگشت', callback_data: 'MENU_MAIN' }]
        ]
    },
    WAREHOUSE: {
        inline_keyboard: [
            [{ text: '🗄️ آرشیو بیجک‌های خروج', callback_data: 'ACT_ARCHIVE_WH_OUT' }],
            [{ text: '🗄️ آرشیو رسیدهای ورود', callback_data: 'ACT_ARCHIVE_WH_IN' }],
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
    REPORTS: { inline_keyboard: [[{ text: '🔙 بازگشت', callback_data: 'MENU_MAIN' }]] },
    BACK: { inline_keyboard: [[{ text: '🔙 انصراف', callback_data: 'MENU_MAIN' }]] }
};

// --- GENERIC SEARCH & SEND ---
const searchAndSendResults = async (db, company, dateQuery, mode, type, platform, chatId, sendFn, sendPhotoFn) => {
    let sourceData = [];
    let imageType = '';
    
    if (type === 'PAYMENT') { sourceData = db.orders || []; imageType = 'PAYMENT'; }
    else if (type === 'EXIT') { sourceData = db.exitPermits || []; imageType = 'EXIT'; }
    else if (type === 'WH_OUT') { sourceData = (db.warehouseTransactions || []).filter(t => t.type === 'OUT'); imageType = 'BIJAK'; }
    else if (type === 'WH_IN') { sourceData = (db.warehouseTransactions || []).filter(t => t.type === 'IN'); imageType = 'RECEIPT'; }

    // Filter Logic
    const results = sourceData.filter(o => {
        const itemCompany = o.company || o.payingCompany;
        if (itemCompany !== company) return false;
        
        const shamsiMonth = toShamsiYearMonth(o.date);
        
        if (mode === 'MONTH') {
            return shamsiMonth === dateQuery;
        } else {
            // Exact Day
            try {
                const d = new Date(o.date);
                const formatter = new Intl.DateTimeFormat('en-US-u-ca-persian', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Tehran' });
                const parts = formatter.formatToParts(d);
                const y = parts.find(p=>p.type==='year')?.value;
                const m = parts.find(p=>p.type==='month')?.value;
                const d_ = parts.find(p=>p.type==='day')?.value;
                return `${y}/${m}/${d_}` === dateQuery;
            } catch(e) { return false; }
        }
    });

    if (results.length === 0) {
        return sendFn(chatId, `❌ موردی برای تاریخ ${dateQuery} یافت نشد.`);
    }

    await sendFn(chatId, `✅ تعداد ${results.length} سند یافت شد. در حال ارسال...`);

    for (const item of results) {
        try {
            const img = await Renderer.generateRecordImage(item, imageType);
            
            // Build Caption based on Type
            let caption = '';
            let pdfCallback = '';

            if (type === 'PAYMENT') {
                caption = `📄 *سند پرداخت #${item.trackingNumber}*\n📅 تاریخ: ${toShamsiFull(item.date)}\n👤 ذینفع: ${item.payee}\n💰 مبلغ: ${parseInt(item.totalAmount).toLocaleString()}\n📝 بابت: ${item.description}\n🔄 وضعیت: ${item.status}`;
                pdfCallback = `GEN_PDF_ORDER_${item.id}`;
            } else if (type === 'EXIT') {
                caption = `🚛 *مجوز خروج #${item.permitNumber}*\n📅 تاریخ: ${toShamsiFull(item.date)}\n👤 گیرنده: ${item.recipientName}\n📦 کالا: ${item.goodsName}\n🔄 وضعیت: ${item.status}`;
                pdfCallback = `GEN_PDF_EXIT_${item.id}`;
            } else if (type === 'WH_OUT') {
                caption = `📦 *حواله انبار (بیجک) #${item.number}*\n📅 تاریخ: ${toShamsiFull(item.date)}\n👤 گیرنده: ${item.recipientName}\n🚛 راننده: ${item.driverName||'-'}`;
                pdfCallback = `GEN_PDF_BIJAK_${item.id}`;
            } else if (type === 'WH_IN') {
                caption = `📥 *رسید ورود #${item.proformaNumber}*\n📅 تاریخ: ${toShamsiFull(item.date)}\n📦 اقلام: ${item.items.length} ردیف`;
                // Receipt PDF not implemented yet, just show image
            }

            const kb = pdfCallback ? { inline_keyboard: [[{ text: '📥 دریافت PDF', callback_data: pdfCallback }]] } : undefined;

            if (img && img.length > 0) {
                await sendPhotoFn(platform, chatId, img, caption, { reply_markup: kb });
            } else {
                await sendFn(chatId, caption, { reply_markup: kb });
            }
        } catch (e) { console.error(e); }
    }
    
    await sendFn(chatId, "✅ پایان لیست.", { reply_markup: KEYBOARDS.MAIN });
};

// --- HANDLERS ---

export const handleMessage = async (platform, chatId, text, sendFn, sendPhotoFn, sendDocFn) => {
    const db = getDb();
    const user = resolveUser(db, platform, chatId);
    if (!user) return sendFn(chatId, "⛔ دسترسی غیرمجاز.");

    if (!sessions[chatId]) sessions[chatId] = { state: 'IDLE', data: {} };
    const session = sessions[chatId];

    if (text === '/start' || text === 'شروع' || text === 'منو') {
        session.state = 'IDLE';
        return sendFn(chatId, `👋 سلام ${user.fullName}\nمنوی اصلی:`, { reply_markup: KEYBOARDS.MAIN });
    }

    // --- FORM HANDLERS ---
    
    // Manual Date Entry (Generic)
    if (session.state === 'ARCHIVE_WAIT_DATE') {
        const dateRegex = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/;
        const match = text.match(dateRegex);
        if (!match) return sendFn(chatId, "⚠️ فرمت صحیح نیست (yyyy/mm/dd):");
        
        const normalizedDate = `${match[1]}/${match[2].padStart(2, '0')}/${match[3].padStart(2, '0')}`;
        await sendFn(chatId, `🔎 جستجو برای ${normalizedDate}...`);
        
        // Execute Generic Search
        await searchAndSendResults(db, session.data.company, normalizedDate, 'EXACT_DAY', session.data.targetType, platform, chatId, sendFn, sendPhotoFn);
        session.state = 'IDLE';
        return;
    }

    // Payment Registration (Simplified)
    if (session.state === 'PAY_AMOUNT') {
        const amt = parseInt(text.replace(/,/g, '').replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
        if (isNaN(amt)) return sendFn(chatId, "❌ مبلغ نامعتبر.");
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
        await sendFn(chatId, `✅ سند #${order.trackingNumber} ثبت شد.`);
        await notifyRole(db, 'financial', `🔔 پرداخت جدید #${order.trackingNumber}`, 'PAYMENT', order, sendFn, sendPhotoFn);
        return;
    }

    return sendFn(chatId, "دستور نامعتبر.", { reply_markup: KEYBOARDS.MAIN });
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
    if (data === 'ACT_PAY_NEW') { session.state = 'PAY_AMOUNT'; return sendFn(chatId, "💵 مبلغ (ریال):"); }
    
    // --- GENERIC ARCHIVE SELECTORS ---
    // Mapping: Callback -> TargetType
    const ARCHIVE_TYPES = {
        'ACT_ARCHIVE_PAY': 'PAYMENT',
        'ACT_ARCHIVE_EXIT': 'EXIT',
        'ACT_ARCHIVE_WH_OUT': 'WH_OUT',
        'ACT_ARCHIVE_WH_IN': 'WH_IN'
    };

    if (ARCHIVE_TYPES[data]) {
        const type = ARCHIVE_TYPES[data];
        session.data.targetType = type; // Store type in session
        
        // Find companies based on type
        let companies = [];
        if (type === 'PAYMENT') companies = [...new Set((db.orders||[]).map(o=>o.payingCompany).filter(Boolean))];
        else if (type === 'EXIT') companies = [...new Set((db.exitPermits||[]).map(o=>o.company).filter(Boolean))];
        else companies = [...new Set((db.warehouseTransactions||[]).map(o=>o.company).filter(Boolean))];

        if (companies.length === 0) return sendFn(chatId, "❌ شرکتی یافت نشد.");
        
        const buttons = companies.map(c => [{ text: c, callback_data: `ARC_SEL_COMP_${c}` }]);
        buttons.push([{ text: '🔙 بازگشت', callback_data: 'MENU_MAIN' }]);
        
        return sendFn(chatId, `🏢 شرکت را انتخاب کنید (${type}):`, { reply_markup: { inline_keyboard: buttons } });
    }

    if (data.startsWith('ARC_SEL_COMP_')) {
        const company = data.replace('ARC_SEL_COMP_', '');
        session.data.company = company;
        const type = session.data.targetType || 'PAYMENT';

        // Find available years
        let sourceList = [];
        if (type === 'PAYMENT') sourceList = (db.orders||[]).filter(o => o.payingCompany === company);
        else if (type === 'EXIT') sourceList = (db.exitPermits||[]).filter(o => o.company === company);
        else sourceList = (db.warehouseTransactions||[]).filter(o => o.company === company);

        const years = getAvailableYears(sourceList);
        if (years.length === 0) years.push('1403');

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

    // --- PDF GENERATION CALLBACKS ---
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

    // --- CARTABLES (Existing Logic) ---
    if (data === 'ACT_PAY_CARTABLE') { /* ... (Keep existing payment cartable) ... */ }
    if (data === 'ACT_EXIT_CARTABLE') { /* ... (Keep existing exit cartable) ... */ }
    if (data.startsWith('APP_PAY_') || data.startsWith('REJ_PAY_')) { /* ... (Keep existing approvals) ... */ }
    
    // --- LEGACY REPORTS ---
    if (data === 'WH_RPT_STOCK') { /* ... Stock PDF ... */ }
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
            await sendFn(chatId, "⚠️ خطا در تولید PDF.");
        }
    } catch (e) {
        console.error("PDF Error:", e);
        await sendFn(chatId, "⚠️ خطا در تولید PDF.");
    }
};

const notifyRole = async (db, role, caption, type, data, sendFn, sendPhotoFn) => { /* ... (Existing) ... */ };
