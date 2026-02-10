
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
    try { if (fs.existsSync(DB_PATH)) return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); } catch (e) {}
    return { users: [], orders: [], exitPermits: [], warehouseTransactions: [], settings: {}, warehouseItems: [] };
};
const saveDb = (data) => fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));

// --- USER RESOLUTION ---
const resolveUser = (db, platform, chatId) => {
    if (platform === 'telegram') return db.users.find(u => u.telegramChatId == chatId);
    if (platform === 'bale') return db.users.find(u => u.baleChatId == chatId);
    return null;
};

// --- INLINE KEYBOARDS (GLASSY BUTTONS) ---
const KEYBOARDS = {
    MAIN: {
        inline_keyboard: [
            [
                { text: '💰 مدیریت پرداخت', callback_data: 'MENU_PAY' },
                { text: '🚛 مدیریت خروج', callback_data: 'MENU_EXIT' }
            ],
            [
                { text: '📦 انبار و موجودی', callback_data: 'MENU_WH' },
                { text: '📊 گزارشات و آمار', callback_data: 'MENU_REPORTS' }
            ],
            [
                { text: '👤 پروفایل من', callback_data: 'MENU_PROFILE' }
            ]
        ]
    },
    PAYMENT: {
        inline_keyboard: [
            [{ text: '➕ ثبت درخواست پرداخت جدید', callback_data: 'ACT_PAY_NEW' }],
            [{ text: '📂 کارتابل (منتظر تایید من)', callback_data: 'ACT_PAY_CARTABLE' }],
            [{ text: '🔙 بازگشت به منوی اصلی', callback_data: 'MENU_MAIN' }]
        ]
    },
    EXIT: {
        inline_keyboard: [
            [{ text: '➕ ثبت مجوز خروج کالا', callback_data: 'ACT_EXIT_NEW' }],
            [{ text: '📂 کارتابل خروج (تاییدیه)', callback_data: 'ACT_EXIT_CARTABLE' }],
            [{ text: '🔙 بازگشت به منوی اصلی', callback_data: 'MENU_MAIN' }]
        ]
    },
    WAREHOUSE: {
        inline_keyboard: [
            [{ text: '📦 موجودی لحظه‌ای کالاها', callback_data: 'RPT_STOCK' }],
            [{ text: '📝 آخرین بیجک‌های صادره', callback_data: 'RPT_LAST_BIJAKS' }],
            [{ text: '🔙 بازگشت به منوی اصلی', callback_data: 'MENU_MAIN' }]
        ]
    },
    REPORTS: {
        inline_keyboard: [
            [{ text: '📈 عملکرد امروز (خلاصه)', callback_data: 'RPT_DAILY_SUMMARY' }],
            [{ text: '💰 گزارش مالی (باز/بسته)', callback_data: 'RPT_FINANCIAL_STATUS' }],
            [{ text: '🔙 بازگشت به منوی اصلی', callback_data: 'MENU_MAIN' }]
        ]
    },
    BACK: {
        inline_keyboard: [
            [{ text: '🔙 انصراف / بازگشت', callback_data: 'MENU_MAIN' }]
        ]
    }
};

// --- CORE MESSAGE HANDLER ---
export const handleMessage = async (platform, chatId, text, sendFn, sendPhotoFn, sendDocFn) => {
    const db = getDb();
    const user = resolveUser(db, platform, chatId);
    
    if (!user) return sendFn(chatId, "⛔ دسترسی غیرمجاز. شما در سیستم تعریف نشده‌اید.");
    
    if (!sessions[chatId]) sessions[chatId] = { state: 'IDLE', data: {} };
    const session = sessions[chatId];

    // Global Reset
    if (text === '/start' || text === 'شروع') {
        session.state = 'IDLE';
        session.data = {};
        return sendFn(chatId, `👋 سلام ${user.fullName}\nبه ربات هوشمند مدیریت خوش آمدید.\n\n👇 لطفا یک بخش را انتخاب کنید:`, { reply_markup: KEYBOARDS.MAIN });
    }

    // --- STATE MACHINE FOR INPUTS ---

    // 1. Payment Flow
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
        const order = {
            id: Date.now().toString(),
            trackingNumber: (db.settings.currentTrackingNumber || 1000) + 1,
            date: new Date().toISOString().split('T')[0],
            payee: session.data.payee,
            totalAmount: session.data.amount,
            description: text,
            status: 'در انتظار بررسی مالی',
            requester: user.fullName,
            payingCompany: db.settings.defaultCompany || '-',
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
        
        await sendFn(chatId, `✅ *دستور پرداخت ثبت شد*\n\n🔖 شماره: ${order.trackingNumber}\n💰 مبلغ: ${order.totalAmount.toLocaleString()} ریال\n👤 ذینفع: ${order.payee}`, { reply_markup: KEYBOARDS.MAIN });
        
        // Notify Financial Team
        await notifyRole(db, 'financial', `🔔 درخواست پرداخت جدید (بات)\nشماره: ${order.trackingNumber}\nثبت: ${user.fullName}`, 'PAYMENT', order, sendFn, sendPhotoFn);
        return;
    }

    // 2. Exit Permit Flow
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
        const permit = {
            id: Date.now().toString(),
            permitNumber: (db.settings.currentExitPermitNumber || 1000) + 1,
            date: new Date().toISOString().split('T')[0],
            recipientName: session.data.recipient,
            goodsName: session.data.goods,
            cartonCount: isNaN(count) ? 0 : count,
            weight: 0,
            company: db.settings.defaultCompany || '-',
            status: 'در انتظار تایید مدیرعامل',
            requester: user.fullName,
            items: [{ goodsName: session.data.goods, cartonCount: isNaN(count) ? 0 : count, weight: 0 }],
            createdAt: Date.now()
        };

        db.settings.currentExitPermitNumber = permit.permitNumber;
        if(!db.exitPermits) db.exitPermits = [];
        db.exitPermits.push(permit);
        saveDb(db);

        session.state = 'IDLE';
        session.data = {};

        await sendFn(chatId, `✅ *مجوز خروج ثبت شد*\n\n🔖 شماره: ${permit.permitNumber}\n📦 کالا: ${permit.goodsName}\n👤 گیرنده: ${permit.recipientName}`, { reply_markup: KEYBOARDS.MAIN });
        
        // Notify CEO
        await notifyRole(db, 'ceo', `🔔 درخواست خروج جدید (بات)\nشماره: ${permit.permitNumber}\nثبت: ${user.fullName}`, 'EXIT', permit, sendFn, sendPhotoFn);
        return;
    }

    // Inputs for Actions (Weight, Time) handled in Callback section mostly, or redirected here.
    // ...

    // Fallback
    return sendFn(chatId, "متوجه نشدم. لطفا از منوی زیر انتخاب کنید:", { reply_markup: KEYBOARDS.MAIN });
};

// --- CALLBACK HANDLER (GLASSY BUTTON CLICKS) ---
export const handleCallback = async (platform, chatId, data, sendFn, sendPhotoFn) => {
    const db = getDb();
    const user = resolveUser(db, platform, chatId);
    if (!user) return;

    if (!sessions[chatId]) sessions[chatId] = { state: 'IDLE', data: {} };
    const session = sessions[chatId];

    // --- NAVIGATION ---
    if (data === 'MENU_MAIN') {
        session.state = 'IDLE';
        return sendFn(chatId, "🏠 منوی اصلی:", { reply_markup: KEYBOARDS.MAIN });
    }
    if (data === 'MENU_PAY') return sendFn(chatId, "💰 مدیریت پرداخت:", { reply_markup: KEYBOARDS.PAYMENT });
    if (data === 'MENU_EXIT') return sendFn(chatId, "🚛 مدیریت خروج کالا:", { reply_markup: KEYBOARDS.EXIT });
    if (data === 'MENU_WH') return sendFn(chatId, "📦 مدیریت انبار:", { reply_markup: KEYBOARDS.WAREHOUSE });
    if (data === 'MENU_REPORTS') return sendFn(chatId, "📊 گزارشات مدیریتی:", { reply_markup: KEYBOARDS.REPORTS });

    // --- ACTIONS: START REGISTRATION ---
    if (data === 'ACT_PAY_NEW') {
        session.state = 'PAY_WAIT_AMOUNT';
        session.data = {};
        return sendFn(chatId, "💵 لطفا مبلغ پرداخت را وارد کنید (به ریال):", { reply_markup: KEYBOARDS.BACK });
    }
    if (data === 'ACT_EXIT_NEW') {
        session.state = 'EXIT_WAIT_RECIPIENT';
        session.data = {};
        return sendFn(chatId, "👤 نام گیرنده کالا را وارد کنید:", { reply_markup: KEYBOARDS.BACK });
    }

    // --- ACTIONS: CARTABLE ---
    if (data === 'ACT_PAY_CARTABLE') {
        return showPaymentCartable(db, user, chatId, sendFn, sendPhotoFn);
    }
    if (data === 'ACT_EXIT_CARTABLE') {
        return showExitCartable(db, user, chatId, sendFn, sendPhotoFn);
    }

    // --- REPORTS ---
    if (data === 'RPT_STOCK') {
        const items = db.warehouseItems || [];
        if(items.length === 0) return sendFn(chatId, "📭 هیچ کالایی تعریف نشده است.");
        let report = "📦 *موجودی انبار:*\n\n";
        // Simple calc logic (mocked for brevity as actual calc is complex)
        items.forEach(i => {
            report += `🔹 ${i.name}: (کد ${i.code || '-'})\n`;
        });
        report += "\n⚠️ جهت مشاهده موجودی دقیق، گزارش اکسل پنل وب را دریافت کنید.";
        return sendFn(chatId, report);
    }

    if (data === 'RPT_DAILY_SUMMARY') {
        const today = new Date().toISOString().split('T')[0];
        const todayOrders = db.orders?.filter(o => o.date === today) || [];
        const todayExits = db.exitPermits?.filter(p => p.date === today) || [];
        
        let report = `📅 *خلاصه وضعیت امروز (${today}):*\n\n`;
        report += `💰 *پرداخت‌ها:* ${todayOrders.length} مورد\n`;
        report += `   مجموع: ${todayOrders.reduce((a,b)=>a+b.totalAmount,0).toLocaleString()} ریال\n\n`;
        report += `🚛 *خروج کالا:* ${todayExits.length} مجوز\n`;
        report += `   تعداد اقلام: ${todayExits.reduce((a,b)=>a+(b.cartonCount||0),0)}`;
        
        return sendFn(chatId, report);
    }

    if (data === 'RPT_FINANCIAL_STATUS') {
        const pending = db.orders?.filter(o => o.status !== 'تایید نهایی' && o.status !== 'رد شده' && o.status !== 'باطل شده').length || 0;
        const totalPending = db.orders?.filter(o => o.status !== 'تایید نهایی' && o.status !== 'رد شده').reduce((a,b)=>a+b.totalAmount,0) || 0;
        
        return sendFn(chatId, `💰 *وضعیت مالی*\n\n⏳ در انتظار پرداخت: ${pending} مورد\n💵 تعهد ایجاد شده: ${totalPending.toLocaleString()} ریال`);
    }

    // --- APPROVAL LOGIC (ACTIONS ON CARDS) ---
    if (data.startsWith('APPROVE_') || data.startsWith('REJECT_')) {
        const [action, type, id] = data.split('_');
        
        if (type === 'PAY') {
            const order = db.orders.find(o => o.id === id);
            if (!order) return sendFn(chatId, "❌ سند یافت نشد.");
            
            if (action === 'APPROVE') {
                let nextStatus = '';
                if (order.status === 'در انتظار بررسی مالی') nextStatus = 'تایید مالی / در انتظار مدیریت';
                else if (order.status.includes('تایید مالی')) nextStatus = 'تایید مدیریت / در انتظار مدیرعامل';
                else if (order.status.includes('تایید مدیریت')) nextStatus = 'تایید نهایی';
                
                if (nextStatus) {
                    order.status = nextStatus;
                    if (user.role === 'financial') order.approverFinancial = user.fullName;
                    if (user.role === 'manager') order.approverManager = user.fullName;
                    if (user.role === 'ceo') order.approverCeo = user.fullName;
                    saveDb(db);
                    
                    sendFn(chatId, `✅ دستور پرداخت ${order.trackingNumber} تایید شد.\nوضعیت جدید: ${nextStatus}`);
                    
                    // Notify Next
                    if (nextStatus.includes('مدیریت')) await notifyRole(db, 'manager', `🔔 جهت تایید: پرداخت #${order.trackingNumber}`, 'PAYMENT', order, sendFn, sendPhotoFn);
                    else if (nextStatus.includes('مدیرعامل')) await notifyRole(db, 'ceo', `🔔 جهت تایید: پرداخت #${order.trackingNumber}`, 'PAYMENT', order, sendFn, sendPhotoFn);
                    else if (nextStatus === 'تایید نهایی') await notifyRole(db, 'financial', `✅ پرداخت #${order.trackingNumber} تایید نهایی شد. لطفا پرداخت کنید.`, 'PAYMENT', order, sendFn, sendPhotoFn);
                } else {
                    sendFn(chatId, "⚠️ وضعیت این سند قابل تغییر نیست.");
                }
            } else {
                order.status = 'رد شده';
                saveDb(db);
                sendFn(chatId, `❌ دستور پرداخت ${order.trackingNumber} رد شد.`);
            }
        }
        else if (type === 'EXIT') {
            const permit = db.exitPermits.find(p => p.id === id);
            if (!permit) return sendFn(chatId, "❌ مجوز یافت نشد.");
            
            if (action === 'APPROVE') {
                // Determine next step based on current status and user role
                if (permit.status === 'در انتظار تایید مدیرعامل') {
                    permit.status = 'در انتظار مدیر کارخانه';
                    permit.approverCeo = user.fullName;
                    saveDb(db);
                    sendFn(chatId, `✅ تایید شد. ارجاع به کارخانه.`);
                    await notifyRole(db, 'factory_manager', `🔔 جهت تایید: خروج #${permit.permitNumber}`, 'EXIT', permit, sendFn, sendPhotoFn);
                } else if (permit.status === 'در انتظار مدیر کارخانه') {
                    permit.status = 'در انتظار تایید انبار';
                    permit.approverFactory = user.fullName;
                    saveDb(db);
                    sendFn(chatId, `✅ تایید شد. ارجاع به انبار.`);
                    await notifyRole(db, 'warehouse_keeper', `🔔 جهت توزین: خروج #${permit.permitNumber}`, 'EXIT', permit, sendFn, sendPhotoFn);
                } else {
                    sendFn(chatId, "⚠️ برای مراحل بعدی (وزن‌کشی/خروج) لطفا از پنل وب یا منوی مخصوص استفاده کنید.");
                }
            } else {
                permit.status = 'رد شده';
                saveDb(db);
                sendFn(chatId, "❌ مجوز خروج رد شد.");
            }
        }
    }
};

// --- HELPER FUNCTIONS ---

const showPaymentCartable = async (db, user, chatId, sendFn, sendPhotoFn) => {
    let items = [];
    // Define cartable logic based on roles
    if (user.role === 'financial' || user.role === 'admin') items = items.concat(db.orders.filter(o => o.status === 'در انتظار بررسی مالی'));
    if (user.role === 'manager' || user.role === 'admin') items = items.concat(db.orders.filter(o => o.status.includes('تایید مالی')));
    if (user.role === 'ceo' || user.role === 'admin') items = items.concat(db.orders.filter(o => o.status.includes('تایید مدیریت')));

    // Deduplicate
    items = [...new Set(items)];

    if (items.length === 0) return sendFn(chatId, "✅ کارتابل پرداخت شما خالی است.");

    for (const item of items) {
        const img = await Renderer.generateRecordImage(item, 'PAYMENT');
        const keyboard = {
            inline_keyboard: [[
                { text: '✅ تایید', callback_data: `APPROVE_PAY_${item.id}` },
                { text: '❌ رد', callback_data: `REJECT_PAY_${item.id}` }
            ]]
        };
        await sendPhotoFn(null, chatId, img, `سند #${item.trackingNumber}\nمبلغ: ${item.totalAmount.toLocaleString()}`, { reply_markup: keyboard });
    }
};

const showExitCartable = async (db, user, chatId, sendFn, sendPhotoFn) => {
    let items = [];
    if (user.role === 'ceo' || user.role === 'admin') items = items.concat(db.exitPermits.filter(p => p.status === 'در انتظار تایید مدیرعامل'));
    if (user.role === 'factory_manager' || user.role === 'admin') items = items.concat(db.exitPermits.filter(p => p.status === 'در انتظار مدیر کارخانه'));
    
    items = [...new Set(items)];

    if (items.length === 0) return sendFn(chatId, "✅ کارتابل خروج شما خالی است.");

    for (const item of items) {
        const img = await Renderer.generateRecordImage(item, 'EXIT');
        const keyboard = {
            inline_keyboard: [[
                { text: '✅ تایید', callback_data: `APPROVE_EXIT_${item.id}` },
                { text: '❌ رد', callback_data: `REJECT_EXIT_${item.id}` }
            ]]
        };
        await sendPhotoFn(null, chatId, img, `مجوز #${item.permitNumber}\nگیرنده: ${item.recipientName}`, { reply_markup: keyboard });
    }
};

const notifyRole = async (db, role, caption, type, data, sendFn, sendPhotoFn) => {
    const users = db.users.filter(u => u.role === role || u.role === 'admin');
    if (users.length === 0) return;

    const img = await Renderer.generateRecordImage(data, type);
    const keyboard = {
        inline_keyboard: [[
            { text: '✅ تایید سریع', callback_data: `APPROVE_${type}_${data.id}` },
            { text: '❌ رد', callback_data: `REJECT_${type}_${data.id}` }
        ]]
    };

    for (const u of users) {
        // Avoid sending to self if requester is same (optional, but good UX)
        // Send to Telegram
        if (u.telegramChatId) {
            try { await sendPhotoFn('telegram', u.telegramChatId, img, caption, { reply_markup: keyboard }); } catch(e){}
        }
        // Send to Bale
        if (u.baleChatId) {
            try { await sendPhotoFn('bale', u.baleChatId, img, caption, { reply_markup: keyboard }); } catch(e){}
        }
    }
};

const notifyGroup = async (groupId, caption, img, sendFn, sendPhotoFn) => {
    // Placeholder for group notification if IDs are available
};

// Workflow placeholder for detailed steps (reused from previous logic)
const advanceExitWorkflow = async () => {}; 

