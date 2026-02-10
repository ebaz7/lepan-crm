
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as Renderer from './renderer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '..', 'database.json');

// Session Store: { userId: { state: 'MAIN_MENU', data: {} } }
const sessions = {};

const getDb = () => {
    try {
        if (fs.existsSync(DB_PATH)) return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    } catch (e) { console.error("DB Read Error", e); }
    return { users: [], orders: [], exitPermits: [], settings: {} };
};

const saveDb = (data) => {
    try { fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2)); } catch (e) { console.error("DB Write Error", e); }
};

const getUser = (db, platform, chatId) => {
    if (platform === 'telegram') return db.users.find(u => u.telegramChatId == chatId);
    if (platform === 'bale') return db.users.find(u => u.baleChatId == chatId);
    return null;
};

const getSession = (userId) => {
    if (!sessions[userId]) sessions[userId] = { state: 'MAIN_MENU', data: {} };
    return sessions[userId];
};

// --- MENUS ---
const MENUS = {
    MAIN: [
        ['💰 پرداخت‌ها', '🚛 خروج کالا'],
        ['📦 انبار / بیجک', '📊 گزارشات'],
        ['💬 پیام‌ها', '⚙️ تنظیمات']
    ],
    PAYMENTS: [
        ['➕ ثبت دستور پرداخت', '📂 کارتابل پرداخت'],
        ['🔍 جستجو و آرشیو', '🔙 بازگشت']
    ],
    EXIT: [
        ['➕ ثبت مجوز خروج', '📂 کارتابل خروج'],
        ['🏁 آرشیو نهایی', '🔙 بازگشت']
    ],
    WAREHOUSE: [
        ['📦 ثبت بیجک', '📥 رسید انبار'],
        ['📈 کاردکس کالا', '🔙 بازگشت']
    ]
};

// --- PERMISSIONS ---
const checkPermission = (user, requiredRoles) => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    return requiredRoles.includes(user.role);
};

// --- CORE HANDLER ---
export const handleMessage = async (platform, chatId, text, sendFn, sendPhotoFn) => {
    const db = getDb();
    const user = getUser(db, platform, chatId);
    const session = getSession(chatId);

    if (!user) {
        return sendFn(chatId, "⛔ شما به سیستم دسترسی ندارید. لطفا با مدیر تماس بگیرید.");
    }

    // Global Commands
    if (text === '/start' || text === '🔙 بازگشت') {
        session.state = 'MAIN_MENU';
        return sendFn(chatId, `سلام ${user.fullName} 👋\nبه سیستم جامع خوش آمدید.`, { keyboard: MENUS.MAIN });
    }

    // --- MAIN MENU ROUTING ---
    if (session.state === 'MAIN_MENU') {
        if (text === '💰 پرداخت‌ها') {
            session.state = 'MENU_PAYMENTS';
            return sendFn(chatId, "بخش مدیریت پرداخت‌ها", { keyboard: MENUS.PAYMENTS });
        }
        if (text === '🚛 خروج کالا') {
            session.state = 'MENU_EXIT';
            return sendFn(chatId, "بخش مدیریت خروج کالا", { keyboard: MENUS.EXIT });
        }
        if (text === '📦 انبار / بیجک') {
            session.state = 'MENU_WAREHOUSE';
            return sendFn(chatId, "بخش مدیریت انبار", { keyboard: MENUS.WAREHOUSE });
        }
        // ... Add other menus
    }

    // --- PAYMENT FLOW ---
    if (session.state === 'MENU_PAYMENTS') {
        if (text === '➕ ثبت دستور پرداخت') {
            session.state = 'PAY_ENTER_AMOUNT';
            return sendFn(chatId, "💰 مبلغ را به ریال وارد کنید:", { removeKeyboard: true });
        }
        if (text === '📂 کارتابل پرداخت') {
            return listPaymentCartable(db, user, chatId, sendFn);
        }
    }

    // Payment Registration Wizard
    if (session.state === 'PAY_ENTER_AMOUNT') {
        const amount = parseInt(text.replace(/,/g, ''));
        if (isNaN(amount)) return sendFn(chatId, "❌ مبلغ نامعتبر. لطفا عدد وارد کنید:");
        session.data.amount = amount;
        session.state = 'PAY_ENTER_PAYEE';
        return sendFn(chatId, "👤 نام گیرنده (ذینفع) را وارد کنید:");
    }
    if (session.state === 'PAY_ENTER_PAYEE') {
        session.data.payee = text;
        session.state = 'PAY_ENTER_DESC';
        return sendFn(chatId, "📝 بابت (شرح) را وارد کنید:");
    }
    if (session.state === 'PAY_ENTER_DESC') {
        session.data.description = text;
        
        // Save to DB
        const newOrder = {
            id: Date.now().toString(),
            trackingNumber: (db.settings.currentTrackingNumber || 1000) + 1,
            date: new Date().toISOString().split('T')[0],
            payee: session.data.payee,
            totalAmount: session.data.amount,
            description: session.data.description,
            status: 'در انتظار بررسی مالی',
            requester: user.fullName,
            payingCompany: db.settings.defaultCompany || '-',
            paymentDetails: [],
            createdAt: Date.now()
        };
        db.settings.currentTrackingNumber = newOrder.trackingNumber;
        db.orders.unshift(newOrder);
        saveDb(db);

        // Reset
        session.state = 'MAIN_MENU';
        
        // Notify Admins/Financial
        await notifyRole(db, 'financial', `درخواست پرداخت جدید:\n#${newOrder.trackingNumber}`, sendFn, null, 'PAYMENT', newOrder);
        
        return sendFn(chatId, `✅ دستور پرداخت #${newOrder.trackingNumber} ثبت شد.`, { keyboard: MENUS.MAIN });
    }

    // --- EXIT FLOW ---
    if (session.state === 'MENU_EXIT') {
        if (text === '➕ ثبت مجوز خروج') {
            if (!checkPermission(user, ['sales_manager', 'ceo', 'admin'])) return sendFn(chatId, "⛔ دسترسی ندارید");
            session.state = 'EXIT_ENTER_RECIPIENT';
            return sendFn(chatId, "👤 نام گیرنده کالا را وارد کنید:", { removeKeyboard: true });
        }
        if (text === '📂 کارتابل خروج') {
            return listExitCartable(db, user, chatId, sendFn);
        }
    }

    // Exit Registration Wizard
    if (session.state === 'EXIT_ENTER_RECIPIENT') {
        session.data.recipient = text;
        session.state = 'EXIT_ENTER_GOODS';
        return sendFn(chatId, "📦 نام کالا و اقلام را وارد کنید:");
    }
    if (session.state === 'EXIT_ENTER_GOODS') {
        session.data.goods = text;
        session.state = 'EXIT_ENTER_COUNT';
        return sendFn(chatId, "🔢 تعداد/مقدار را وارد کنید:");
    }
    if (session.state === 'EXIT_ENTER_COUNT') {
        session.data.count = text;
        
        const newPermit = {
            id: Date.now().toString(),
            permitNumber: (db.settings.currentExitPermitNumber || 1000) + 1,
            date: new Date().toISOString().split('T')[0],
            recipientName: session.data.recipient,
            goodsName: session.data.goods,
            cartonCount: session.data.count,
            status: 'در انتظار تایید مدیرعامل',
            requester: user.fullName,
            company: db.settings.defaultCompany || '-',
            items: [], destinations: [],
            createdAt: Date.now()
        };
        db.settings.currentExitPermitNumber = newPermit.permitNumber;
        db.exitPermits.push(newPermit);
        saveDb(db);

        session.state = 'MAIN_MENU';
        
        // Workflow Notification: Sales -> CEO
        const image = await Renderer.generateRecordImage(newPermit, 'EXIT');
        await notifyRole(db, 'ceo', `🚛 مجوز خروج جدید #${newPermit.permitNumber}`, sendFn, sendPhotoFn, 'EXIT', newPermit, image);

        return sendFn(chatId, `✅ درخواست خروج #${newPermit.permitNumber} ثبت شد.`, { keyboard: MENUS.MAIN });
    }

    return sendFn(chatId, "دستور نامعتبر. از منو استفاده کنید.", { keyboard: MENUS.MAIN });
};

export const handleCallback = async (platform, chatId, data, sendFn) => {
    const db = getDb();
    const user = getUser(db, platform, chatId);
    if (!user) return;

    const [action, type, id] = data.split('_'); // e.g. APPROVE_PAYMENT_123

    if (type === 'PAYMENT') {
        const order = db.orders.find(o => o.id === id);
        if (!order) return sendFn(chatId, "❌ سند یافت نشد");

        if (action === 'APPROVE') {
            let nextStatus = '';
            if (order.status === 'در انتظار بررسی مالی' && checkPermission(user, ['financial', 'admin'])) nextStatus = 'تایید مالی / در انتظار مدیریت';
            else if (order.status.includes('تایید مالی') && checkPermission(user, ['manager', 'admin'])) nextStatus = 'تایید مدیریت / در انتظار مدیرعامل';
            else if (order.status.includes('تایید مدیریت') && checkPermission(user, ['ceo', 'admin'])) nextStatus = 'تایید نهایی';
            else return sendFn(chatId, "⛔ نوبت تایید شما نیست یا دسترسی ندارید.");

            order.status = nextStatus;
            saveDb(db);
            sendFn(chatId, `✅ وضعیت سند #${order.trackingNumber} به "${nextStatus}" تغییر یافت.`);
            
            // Notify Next Step
            if (nextStatus.includes('مدیریت')) notifyRole(db, 'manager', `جهت تایید: پرداخت #${order.trackingNumber}`, sendFn, null, 'PAYMENT', order);
            else if (nextStatus.includes('مدیرعامل')) notifyRole(db, 'ceo', `جهت تایید: پرداخت #${order.trackingNumber}`, sendFn, null, 'PAYMENT', order);
        } else if (action === 'REJECT') {
            order.status = 'رد شده';
            saveDb(db);
            sendFn(chatId, `❌ سند #${order.trackingNumber} رد شد.`);
        }
    } else if (type === 'EXIT') {
        const permit = db.exitPermits.find(p => p.id === id);
        if (!permit) return sendFn(chatId, "❌ مجوز یافت نشد");

        if (action === 'APPROVE') {
            let nextStatus = '';
            let notifyRoles = [];
            
            if (permit.status === 'در انتظار تایید مدیرعامل' && checkPermission(user, ['ceo', 'admin'])) {
                nextStatus = 'در انتظار تایید مدیر کارخانه'; // Label match UI
                notifyRoles = ['factory_manager'];
            } else if (permit.status.includes('مدیر کارخانه') && checkPermission(user, ['factory_manager', 'admin'])) {
                nextStatus = 'در انتظار تایید انبار';
                notifyRoles = ['warehouse_keeper'];
            } else if (permit.status.includes('انبار') && checkPermission(user, ['warehouse_keeper', 'admin'])) {
                nextStatus = 'در انتظار خروج'; // Security
                notifyRoles = ['security_head', 'security_guard'];
            } else if (permit.status === 'در انتظار خروج' && checkPermission(user, ['security_head', 'admin'])) {
                nextStatus = 'خارج شده (بایگانی)';
            } else {
                return sendFn(chatId, "⛔ نوبت شما نیست.");
            }

            permit.status = nextStatus;
            saveDb(db);
            sendFn(chatId, `✅ تایید شد. وضعیت جدید: ${nextStatus}`);

            // Image generation for next step
            const image = await Renderer.generateRecordImage(permit, 'EXIT');
            
            // Notify Next Role
            notifyRoles.forEach(role => {
                notifyRole(db, role, `🚛 مجوز #${permit.permitNumber} جهت تایید`, sendFn, null, 'EXIT', permit, image);
            });

            // Notify Groups if Configured
            // (Simplified group notification logic)
        }
    }
};

// --- HELPERS ---
const notifyRole = async (db, role, text, sendFn, photoFn, type, data, imageBuffer = null) => {
    const targets = db.users.filter(u => u.role === role);
    for (const t of targets) {
        // Prepare Inline Keyboard
        const keyboard = {
            inline_keyboard: [
                [
                    { text: "✅ تایید", callback_data: `APPROVE_${type}_${data.id}` },
                    { text: "❌ رد", callback_data: `REJECT_${type}_${data.id}` }
                ]
            ]
        };

        if (t.telegramChatId) {
            if (imageBuffer && photoFn) await photoFn('telegram', t.telegramChatId, imageBuffer, text, keyboard);
            else await sendFn(t.telegramChatId, text, { reply_markup: keyboard });
        }
        if (t.baleChatId) {
            // Bale has similar structure usually
            if (imageBuffer && photoFn) await photoFn('bale', t.baleChatId, imageBuffer, text, keyboard);
            else await sendFn(t.baleChatId, text, { reply_markup: keyboard });
        }
    }
};

const listPaymentCartable = (db, user, chatId, sendFn) => {
    let pending = [];
    if (checkPermission(user, ['financial', 'admin'])) pending = db.orders.filter(o => o.status === 'در انتظار بررسی مالی');
    else if (checkPermission(user, ['manager'])) pending = db.orders.filter(o => o.status.includes('مدیریت'));
    else if (checkPermission(user, ['ceo'])) pending = db.orders.filter(o => o.status.includes('مدیرعامل'));

    if (pending.length === 0) return sendFn(chatId, "✅ کارتابل شما خالی است.");

    pending.forEach(p => {
        const keyboard = {
            inline_keyboard: [[ { text: "✅ تایید", callback_data: `APPROVE_PAYMENT_${p.id}` }, { text: "❌ رد", callback_data: `REJECT_PAYMENT_${p.id}` } ]]
        };
        sendFn(chatId, `💰 *درخواست پرداخت*\nشماره: ${p.trackingNumber}\nمبلغ: ${parseInt(p.totalAmount).toLocaleString()}\nذینفع: ${p.payee}\nبابت: ${p.description}`, { reply_markup: keyboard });
    });
};

const listExitCartable = (db, user, chatId, sendFn) => {
    let pending = [];
    // Simplified logic
    if (user.role === 'ceo') pending = db.exitPermits.filter(p => p.status === 'در انتظار تایید مدیرعامل');
    if (user.role === 'factory_manager') pending = db.exitPermits.filter(p => p.status.includes('کارخانه'));
    
    if (pending.length === 0) return sendFn(chatId, "✅ کارتابل خروج خالی است.");
    
    pending.forEach(p => {
        const keyboard = {
            inline_keyboard: [[ { text: "✅ تایید", callback_data: `APPROVE_EXIT_${p.id}` }, { text: "❌ رد", callback_data: `REJECT_EXIT_${p.id}` } ]]
        };
        sendFn(chatId, `🚛 *مجوز خروج*\nشماره: ${p.permitNumber}\nگیرنده: ${p.recipientName}\nکالا: ${p.goodsName}`, { reply_markup: keyboard });
    });
};
