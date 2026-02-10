
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as Renderer from './renderer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '..', 'database.json');

const sessions = {}; // chatId -> { state, data }

// --- DATA ACCESS ---
const getDb = () => {
    try { 
        if (fs.existsSync(DB_PATH)) return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); 
    } catch (e) {}
    // Ensure all arrays exist to prevent crashes
    return { 
        users: [], orders: [], exitPermits: [], warehouseTransactions: [], 
        tradeRecords: [], settings: { companyNames: [] }, warehouseItems: [] 
    };
};
const saveDb = (data) => fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));

// --- USER RESOLUTION ---
const resolveUser = (db, platform, chatId) => {
    if (platform === 'telegram') return db.users.find(u => u.telegramChatId == chatId);
    if (platform === 'bale') return db.users.find(u => u.baleChatId == chatId);
    return null;
};

// --- INLINE KEYBOARDS ---
const KEYBOARDS = {
    MAIN: {
        inline_keyboard: [
            [
                { text: '💰 مدیریت پرداخت', callback_data: 'MENU_PAY' },
                { text: '🚛 مدیریت خروج', callback_data: 'MENU_EXIT' }
            ],
            [
                { text: '📦 انبار', callback_data: 'MENU_WH' },
                { text: '🌍 بازرگانی', callback_data: 'MENU_TRADE' } // Added Commerce
            ],
            [
                { text: '📊 گزارشات مدیریتی', callback_data: 'MENU_REPORTS' },
                { text: '👤 پروفایل', callback_data: 'MENU_PROFILE' }
            ]
        ]
    },
    PAYMENT: {
        inline_keyboard: [
            [{ text: '➕ ثبت دستور پرداخت جدید', callback_data: 'ACT_PAY_NEW' }],
            [{ text: '📂 کارتابل (منتظر تایید)', callback_data: 'ACT_PAY_CARTABLE' }],
            [{ text: '🗄️ جستجو در بایگانی', callback_data: 'ACT_PAY_ARCHIVE' }],
            [{ text: '🔙 بازگشت', callback_data: 'MENU_MAIN' }]
        ]
    },
    EXIT: {
        inline_keyboard: [
            [{ text: '➕ ثبت مجوز خروج کالا', callback_data: 'ACT_EXIT_NEW' }],
            [{ text: '📂 کارتابل خروج (تاییدیه)', callback_data: 'ACT_EXIT_CARTABLE' }],
            [{ text: '🔙 بازگشت', callback_data: 'MENU_MAIN' }]
        ]
    },
    TRADE: {
        inline_keyboard: [
            [{ text: '📂 پرونده‌های فعال', callback_data: 'TRD_ACTIVE' }],
            [{ text: '💰 وضعیت خرید ارز', callback_data: 'TRD_CURRENCY' }],
            [{ text: '🔙 بازگشت', callback_data: 'MENU_MAIN' }]
        ]
    },
    BACK: {
        inline_keyboard: [
            [{ text: '🔙 انصراف / بازگشت', callback_data: 'MENU_MAIN' }]
        ]
    }
};

// --- CORE MESSAGE HANDLER (STATE MACHINE) ---
export const handleMessage = async (platform, chatId, text, sendFn, sendPhotoFn, sendDocFn) => {
    try {
        const db = getDb();
        const user = resolveUser(db, platform, chatId);
        
        if (!user) return sendFn(chatId, "⛔ دسترسی غیرمجاز. شما در سیستم تعریف نشده‌اید.");
        
        if (!sessions[chatId]) sessions[chatId] = { state: 'IDLE', data: {} };
        const session = sessions[chatId];

        // Global Reset
        if (text === '/start' || text === 'شروع' || text === 'لغو') {
            session.state = 'IDLE';
            session.data = {};
            return sendFn(chatId, `👋 سلام ${user.fullName}\nبه ربات هوشمند مدیریت خوش آمدید.\n\n👇 لطفا یک بخش را انتخاب کنید:`, { reply_markup: KEYBOARDS.MAIN });
        }

        // --- 1. PAYMENT REGISTRATION FLOW ---
        if (session.state === 'PAY_WAIT_AMOUNT') {
            const amt = parseInt(text.replace(/,/g, '').replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
            if (isNaN(amt)) return sendFn(chatId, "❌ مبلغ نامعتبر است. لطفا عدد وارد کنید (به ریال):", { reply_markup: KEYBOARDS.BACK });
            session.data.amount = amt;
            session.state = 'PAY_WAIT_PAYEE';
            return sendFn(chatId, "👤 نام گیرنده وجه (ذینفع) را وارد کنید:", { reply_markup: KEYBOARDS.BACK });
        }
        if (session.state === 'PAY_WAIT_PAYEE') {
            session.data.payee = text;
            session.state = 'PAY_WAIT_DESC';
            return sendFn(chatId, "📝 بابت (توضیحات پرداخت) را بنویسید:", { reply_markup: KEYBOARDS.BACK });
        }
        if (session.state === 'PAY_WAIT_DESC') {
            // Save Payment
            const order = {
                id: Date.now().toString(),
                trackingNumber: (db.settings.currentTrackingNumber || 1000) + 1,
                date: new Date().toISOString().split('T')[0],
                payee: session.data.payee,
                totalAmount: session.data.amount,
                description: text,
                status: 'در انتظار بررسی مالی',
                requester: user.fullName, // SAVE REGISTRANT NAME
                payingCompany: session.data.company || db.settings.defaultCompany || '-',
                createdAt: Date.now(),
                paymentDetails: [{
                    id: Date.now().toString(),
                    method: 'حواله بانکی',
                    amount: session.data.amount,
                    description: 'ثبت شده توسط بات'
                }]
            };
            
            db.settings.currentTrackingNumber = order.trackingNumber;
            if(!db.orders) db.orders = [];
            db.orders.unshift(order);
            saveDb(db);

            session.state = 'IDLE';
            session.data = {};
            
            await sendFn(chatId, `✅ *دستور پرداخت ثبت شد*\n\n🔖 شماره: ${order.trackingNumber}\n🏢 شرکت: ${order.payingCompany}\n💰 مبلغ: ${order.totalAmount.toLocaleString()} ریال\n👤 ذینفع: ${order.payee}\n📝 بابت: ${order.description}`, { reply_markup: KEYBOARDS.MAIN });
            await notifyRole(db, 'financial', `🔔 درخواست پرداخت جدید (بات)\nشماره: ${order.trackingNumber}\nثبت: ${user.fullName}`, 'PAYMENT', order, sendFn, sendPhotoFn);
            return;
        }

        // --- 2. EXIT PERMIT REGISTRATION FLOW ---
        if (session.state === 'EXIT_WAIT_RECIPIENT') {
            session.data.recipient = text;
            session.state = 'EXIT_WAIT_GOODS';
            return sendFn(chatId, "📦 نام کالا را وارد کنید:", { reply_markup: KEYBOARDS.BACK });
        }
        if (session.state === 'EXIT_WAIT_GOODS') {
            session.data.goods = text;
            session.state = 'EXIT_WAIT_COUNT';
            return sendFn(chatId, "🔢 تعداد (کارتن/عدد) را وارد کنید:", { reply_markup: KEYBOARDS.BACK });
        }
        if (session.state === 'EXIT_WAIT_COUNT') {
            const count = parseInt(text.replace(/,/g, ''));
            session.data.count = isNaN(count) ? 0 : count;
            session.state = 'EXIT_WAIT_WEIGHT';
            return sendFn(chatId, "⚖️ وزن تقریبی کل (کیلوگرم) را وارد کنید:\n(اگر نمی‌دانید عدد 0 بفرستید)", { reply_markup: KEYBOARDS.BACK });
        }
        if (session.state === 'EXIT_WAIT_WEIGHT') {
            const weight = parseInt(text.replace(/,/g, ''));
            session.data.weight = isNaN(weight) ? 0 : weight;
            session.state = 'EXIT_WAIT_DRIVER';
            return sendFn(chatId, "🚛 نام راننده را وارد کنید:\n(یا کلمه 'ندارد' را ارسال کنید)", { reply_markup: KEYBOARDS.BACK });
        }
        if (session.state === 'EXIT_WAIT_DRIVER') {
            session.data.driver = text;
            session.state = 'EXIT_WAIT_PLATE';
            return sendFn(chatId, "🔢 شماره پلاک خودرو را وارد کنید:\n(یا کلمه 'ندارد' را ارسال کنید)", { reply_markup: KEYBOARDS.BACK });
        }
        if (session.state === 'EXIT_WAIT_PLATE') {
            // Save Exit Permit
            const permit = {
                id: Date.now().toString(),
                permitNumber: (db.settings.currentExitPermitNumber || 1000) + 1,
                date: new Date().toISOString().split('T')[0],
                recipientName: session.data.recipient,
                goodsName: session.data.goods,
                cartonCount: session.data.count,
                weight: session.data.weight,
                plateNumber: text,
                driverName: session.data.driver,
                company: session.data.company || db.settings.defaultCompany || '-',
                status: 'در انتظار تایید مدیرعامل',
                requester: user.fullName, // SAVE REGISTRANT NAME
                items: [{ goodsName: session.data.goods, cartonCount: session.data.count, weight: session.data.weight }],
                destinations: [{ id: Date.now().toString(), recipientName: session.data.recipient, address: 'ثبت توسط بات', phone: '' }],
                createdAt: Date.now()
            };

            db.settings.currentExitPermitNumber = permit.permitNumber;
            if(!db.exitPermits) db.exitPermits = [];
            db.exitPermits.push(permit);
            saveDb(db);

            session.state = 'IDLE';
            session.data = {};

            await sendFn(chatId, `✅ *مجوز خروج ثبت شد*\n\n🔖 شماره: ${permit.permitNumber}\n🏢 شرکت: ${permit.company}\n📦 کالا: ${permit.goodsName}\n👤 گیرنده: ${permit.recipientName}\n🚛 راننده: ${permit.driverName}`, { reply_markup: KEYBOARDS.MAIN });
            await notifyRole(db, 'ceo', `🔔 درخواست خروج جدید (بات)\nشماره: ${permit.permitNumber}\nثبت: ${user.fullName}`, 'EXIT', permit, sendFn, sendPhotoFn);
            return;
        }

        // --- 3. ARCHIVE SEARCH ---
        if (session.state === 'ARCHIVE_WAIT_NUMBER') {
            const num = parseInt(text.replace(/[^0-9]/g, ''));
            const results = (db.orders || []).filter(o => o.trackingNumber === num && o.status === 'تایید نهایی');
            if (results.length === 0) return sendFn(chatId, "❌ موردی یافت نشد.", { reply_markup: KEYBOARDS.PAYMENT });
            session.state = 'IDLE';
            return showArchiveResults(results, chatId, sendFn);
        }

        // Fallback
        return sendFn(chatId, "متوجه نشدم. لطفا از منوی زیر انتخاب کنید:", { reply_markup: KEYBOARDS.MAIN });

    } catch (e) {
        console.error("Bot Core Error:", e);
        try { await sendFn(chatId, "⚠️ خطایی در سیستم رخ داده است."); } catch(err){}
    }
};

// --- CALLBACK HANDLER ---
export const handleCallback = async (platform, chatId, data, sendFn, sendPhotoFn) => {
    try {
        const db = getDb();
        const user = resolveUser(db, platform, chatId);
        if (!user) return;

        if (!sessions[chatId]) sessions[chatId] = { state: 'IDLE', data: {} };
        const session = sessions[chatId];

        // --- MENUS ---
        if (data === 'MENU_MAIN') { session.state = 'IDLE'; return sendFn(chatId, "🏠 منوی اصلی:", { reply_markup: KEYBOARDS.MAIN }); }
        if (data === 'MENU_PAY') return sendFn(chatId, "💰 مدیریت پرداخت:", { reply_markup: KEYBOARDS.PAYMENT });
        if (data === 'MENU_EXIT') return sendFn(chatId, "🚛 مدیریت خروج کالا:", { reply_markup: KEYBOARDS.EXIT });
        if (data === 'MENU_WH') return sendFn(chatId, "📦 مدیریت انبار:", { reply_markup: KEYBOARDS.WAREHOUSE });
        if (data === 'MENU_TRADE') return sendFn(chatId, "🌍 بخش بازرگانی:", { reply_markup: KEYBOARDS.TRADE });
        if (data === 'MENU_REPORTS') return sendFn(chatId, "📊 گزارشات مدیریتی:", { reply_markup: KEYBOARDS.REPORTS });

        // --- PAYMENT REGISTRATION START ---
        if (data === 'ACT_PAY_NEW') {
            // Check for multiple companies
            const companies = db.settings.companyNames || [];
            if (companies.length > 1) {
                // Show company selector
                const keyboard = {
                    inline_keyboard: [
                        ...companies.map(c => [{ text: c, callback_data: `SEL_COMP_PAY_${c}` }]),
                        [{ text: '🔙 انصراف', callback_data: 'MENU_PAY' }]
                    ]
                };
                return sendFn(chatId, "🏢 لطفاً شرکت پرداخت کننده را انتخاب کنید:", { reply_markup: keyboard });
            } else {
                // Default company, go to amount
                session.data.company = companies[0] || db.settings.defaultCompany || '-';
                session.state = 'PAY_WAIT_AMOUNT';
                return sendFn(chatId, "💵 لطفا مبلغ پرداخت را وارد کنید (به ریال):", { reply_markup: KEYBOARDS.BACK });
            }
        }
        if (data.startsWith('SEL_COMP_PAY_')) {
            session.data.company = data.replace('SEL_COMP_PAY_', '');
            session.state = 'PAY_WAIT_AMOUNT';
            return sendFn(chatId, `🏢 شرکت انتخاب شد: ${session.data.company}\n💵 لطفا مبلغ پرداخت را وارد کنید (به ریال):`, { reply_markup: KEYBOARDS.BACK });
        }

        // --- EXIT REGISTRATION START ---
        if (data === 'ACT_EXIT_NEW') {
            const companies = db.settings.companyNames || [];
            if (companies.length > 1) {
                const keyboard = {
                    inline_keyboard: [
                        ...companies.map(c => [{ text: c, callback_data: `SEL_COMP_EXIT_${c}` }]),
                        [{ text: '🔙 انصراف', callback_data: 'MENU_EXIT' }]
                    ]
                };
                return sendFn(chatId, "🏢 لطفاً شرکت صادرکننده را انتخاب کنید:", { reply_markup: keyboard });
            } else {
                session.data.company = companies[0] || db.settings.defaultCompany || '-';
                session.state = 'EXIT_WAIT_RECIPIENT';
                return sendFn(chatId, "👤 نام گیرنده کالا را وارد کنید:", { reply_markup: KEYBOARDS.BACK });
            }
        }
        if (data.startsWith('SEL_COMP_EXIT_')) {
            session.data.company = data.replace('SEL_COMP_EXIT_', '');
            session.state = 'EXIT_WAIT_RECIPIENT';
            return sendFn(chatId, `🏢 شرکت انتخاب شد: ${session.data.company}\n👤 نام گیرنده کالا را وارد کنید:`, { reply_markup: KEYBOARDS.BACK });
        }

        // --- CARTABLES ---
        if (data === 'ACT_PAY_CARTABLE') {
            return showPaymentCartable(db, user, chatId, sendFn, sendPhotoFn);
        }
        if (data === 'ACT_EXIT_CARTABLE') {
            return showExitCartable(db, user, chatId, sendFn, sendPhotoFn);
        }

        // --- APPROVAL LOGIC ---
        if (data.startsWith('APPROVE_') || data.startsWith('REJECT_')) {
            await handleApprovalAction(db, user, data, chatId, sendFn, sendPhotoFn);
        }

        // --- COMMERCE REPORTS ---
        if (data === 'TRD_ACTIVE') {
            const records = db.tradeRecords || [];
            const active = records.filter(r => r.status !== 'Completed');
            if (active.length === 0) return sendFn(chatId, "📭 هیچ پرونده بازرگانی فعالی وجود ندارد.");
            
            let msg = `🌍 *پرونده‌های بازرگانی فعال (${active.length}):*\n\n`;
            active.forEach(r => {
                // Find current stage
                const stages = ['مجوزها و پروفرما', 'بیمه', 'در صف تخصیص ارز', 'تخصیص یافته', 'خرید ارز', 'اسناد حمل', 'گواهی بازرسی', 'ترخیصیه و قبض انبار', 'برگ سبز', 'حمل داخلی', 'هزینه‌های ترخیص'];
                let current = 'شروع نشده';
                for(const s of stages) {
                    if (r.stages && r.stages[s] && !r.stages[s].isCompleted) { current = s; break; }
                }
                msg += `🔹 *${r.goodsName}* (فایل: ${r.fileNumber})\n   شرکت: ${r.company}\n   مرحله فعلی: ${current}\n----------------\n`;
            });
            return sendFn(chatId, msg);
        }

    } catch (e) {
        console.error("Bot Callback Error:", e);
        try { await sendFn(chatId, "⚠️ خطایی در عملیات رخ داد."); } catch(err){}
    }
};

// --- HELPERS ---

const showArchiveResults = async (results, chatId, sendFn) => {
    if (!results || results.length === 0) return sendFn(chatId, "📭 هیچ سندی یافت نشد.");
    
    let msg = `📂 *نتایج جستجو (${results.length} مورد):*\n\n`;
    results.forEach(r => {
        msg += `🔹 *#${r.trackingNumber}* | 💰 ${parseInt(r.totalAmount).toLocaleString()}\n`;
        msg += `   👤 ذینفع: ${r.payee}\n`;
        msg += `   📝 بابت: ${r.description}\n`;
        msg += `   👤 ثبت‌کننده: ${r.requester}\n`; // ADDED REGISTRANT
        msg += `   🏢 شرکت: ${r.payingCompany}\n----------------\n`;
    });
    
    if (msg.length > 4000) msg = msg.substring(0, 4000) + "...";
    return sendFn(chatId, msg);
};

const showPaymentCartable = async (db, user, chatId, sendFn, sendPhotoFn) => {
    let items = [];
    const role = user.role;
    const orders = db.orders || [];

    if (role === 'financial' || role === 'admin') items = items.concat(orders.filter(o => o.status === 'در انتظار بررسی مالی' || o.status === 'درخواست ابطال (مالی)'));
    if (role === 'manager' || role === 'admin') items = items.concat(orders.filter(o => o.status === 'تایید مالی / در انتظار مدیریت' || o.status === 'تایید ابطال (مدیریت)'));
    if (role === 'ceo' || role === 'admin') items = items.concat(orders.filter(o => o.status === 'تایید مدیریت / در انتظار مدیرعامل' || o.status === 'تایید ابطال (مدیرعامل)'));

    items = [...new Map(items.map(item => [item.id, item])).values()]; // Dedup

    if (items.length === 0) {
        return sendFn(chatId, "✅ کارتابل پرداخت شما خالی است.");
    }

    for (const item of items) {
        try {
            const img = await Renderer.generateRecordImage(item, 'PAYMENT');
            const keyboard = {
                inline_keyboard: [[
                    { text: '✅ تایید', callback_data: `APPROVE_PAY_${item.id}` },
                    { text: '❌ رد', callback_data: `REJECT_PAY_${item.id}` }
                ]]
            };
            await sendPhotoFn(null, chatId, img, `سند #${item.trackingNumber}\nمبلغ: ${parseInt(item.totalAmount).toLocaleString()}\nدرخواست کننده: ${item.requester}`, { reply_markup: keyboard });
        } catch (e) { console.error(e); }
    }
};

const showExitCartable = async (db, user, chatId, sendFn, sendPhotoFn) => {
    let items = [];
    const role = user.role;
    const permits = db.exitPermits || [];

    if (role === 'ceo' || role === 'admin') items = items.concat(permits.filter(p => p.status === 'در انتظار تایید مدیرعامل'));
    if (role === 'factory_manager' || role === 'admin') items = items.concat(permits.filter(p => p.status === 'در انتظار مدیر کارخانه'));
    if (role === 'warehouse_keeper' || role === 'admin') items = items.concat(permits.filter(p => p.status === 'در انتظار تایید انبار'));
    if (role === 'security_head' || role === 'admin') items = items.concat(permits.filter(p => p.status === 'در انتظار خروج'));

    items = [...new Map(items.map(item => [item.id, item])).values()];

    if (items.length === 0) {
        return sendFn(chatId, "✅ کارتابل خروج شما خالی است.");
    }

    for (const item of items) {
        try {
            const img = await Renderer.generateRecordImage(item, 'EXIT');
            const keyboard = {
                inline_keyboard: [[
                    { text: '✅ تایید', callback_data: `APPROVE_EXIT_${item.id}` },
                    { text: '❌ رد', callback_data: `REJECT_EXIT_${item.id}` }
                ]]
            };
            await sendPhotoFn(null, chatId, img, `مجوز #${item.permitNumber}\nگیرنده: ${item.recipientName}\nدرخواست کننده: ${item.requester}`, { reply_markup: keyboard });
        } catch (e) { console.error(e); }
    }
};

const handleApprovalAction = async (db, user, data, chatId, sendFn, sendPhotoFn) => {
    const [action, type, id] = data.split('_');
    
    if (type === 'PAY') {
        const order = db.orders.find(o => o.id === id);
        if (!order) return sendFn(chatId, "❌ سند یافت نشد یا قبلاً بررسی شده است.");
        
        if (action === 'APPROVE') {
            let nextStatus = '';
            if (order.status === 'در انتظار بررسی مالی') nextStatus = 'تایید مالی / در انتظار مدیریت';
            else if (order.status === 'تایید مالی / در انتظار مدیریت') nextStatus = 'تایید مدیریت / در انتظار مدیرعامل';
            else if (order.status === 'تایید مدیریت / در انتظار مدیرعامل') nextStatus = 'تایید نهایی';
            
            if (nextStatus) {
                order.status = nextStatus;
                if (user.role === 'financial' || user.role === 'admin') order.approverFinancial = user.fullName;
                if (user.role === 'manager' || user.role === 'admin') order.approverManager = user.fullName;
                if (user.role === 'ceo' || user.role === 'admin') order.approverCeo = user.fullName;
                saveDb(db);
                sendFn(chatId, `✅ تایید شد.\nوضعیت جدید: ${nextStatus}`);
                
                // Notify Next Step
                if (nextStatus.includes('مدیریت')) await notifyRole(db, 'manager', `🔔 جهت تایید: پرداخت #${order.trackingNumber}`, 'PAYMENT', order, sendFn, sendPhotoFn);
                else if (nextStatus.includes('مدیرعامل')) await notifyRole(db, 'ceo', `🔔 جهت تایید: پرداخت #${order.trackingNumber}`, 'PAYMENT', order, sendFn, sendPhotoFn);
                else if (nextStatus === 'تایید نهایی') await notifyRole(db, 'financial', `✅ پرداخت #${order.trackingNumber} تایید نهایی شد.`, 'PAYMENT', order, sendFn, sendPhotoFn);
            }
        } else {
            order.status = 'رد شده';
            saveDb(db);
            sendFn(chatId, `❌ رد شد.`);
        }
    } else if (type === 'EXIT') {
        const permit = db.exitPermits.find(p => p.id === id);
        if (!permit) return sendFn(chatId, "❌ مجوز یافت نشد.");
        
        if (action === 'APPROVE') {
            let nextStatus = '';
            if (permit.status === 'در انتظار تایید مدیرعامل') nextStatus = 'در انتظار مدیر کارخانه';
            else if (permit.status === 'در انتظار مدیر کارخانه') nextStatus = 'در انتظار تایید انبار';
            else if (permit.status === 'در انتظار تایید انبار') nextStatus = 'در انتظار خروج';
            else if (permit.status === 'در انتظار خروج') nextStatus = 'خارج شده (بایگانی)';

            if (nextStatus) {
                permit.status = nextStatus;
                if (permit.status === 'در انتظار مدیر کارخانه') permit.approverCeo = user.fullName;
                if (permit.status === 'در انتظار تایید انبار') permit.approverFactory = user.fullName;
                if (permit.status === 'در انتظار خروج') permit.approverWarehouse = user.fullName;
                if (permit.status === 'خارج شده (بایگانی)') permit.approverSecurity = user.fullName;

                saveDb(db);
                sendFn(chatId, `✅ تایید شد.\nوضعیت جدید: ${nextStatus}`);
            }
        } else {
            permit.status = 'رد شده';
            saveDb(db);
            sendFn(chatId, `❌ رد شد.`);
        }
    }
};

const notifyRole = async (db, role, caption, type, data, sendFn, sendPhotoFn) => {
    const users = db.users.filter(u => u.role === role || u.role === 'admin');
    if (users.length === 0) return;

    try {
        const img = await Renderer.generateRecordImage(data, type);
        const keyboard = {
            inline_keyboard: [[
                { text: '✅ تایید سریع', callback_data: `APPROVE_${type}_${data.id}` },
                { text: '❌ رد', callback_data: `REJECT_${type}_${data.id}` }
            ]]
        };

        // Add registrant to caption if not present
        const requester = data.requester || 'ناشناس';
        const finalCaption = `${caption}\n👤 درخواست کننده: ${requester}`;

        for (const u of users) {
            if (u.telegramChatId) {
                try { await sendPhotoFn('telegram', u.telegramChatId, img, finalCaption, { reply_markup: keyboard }); } catch(e){}
            }
            if (u.baleChatId) {
                try { await sendPhotoFn('bale', u.baleChatId, img, finalCaption, { reply_markup: keyboard }); } catch(e){}
            }
        }
    } catch(e) { console.error("Notify Error", e); }
};
