
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
    return { users: [], orders: [], exitPermits: [], warehouseTransactions: [], settings: {} };
};
const saveDb = (data) => fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));

// --- USER RESOLUTION ---
const resolveUser = (db, platform, chatId) => {
    if (platform === 'telegram') return db.users.find(u => u.telegramChatId == chatId);
    if (platform === 'bale') return db.users.find(u => u.baleChatId == chatId);
    return null;
};

// --- MENUS & KEYBOARDS ---
const MAIN_MENU = [
    ['💰 مدیریت پرداخت', '🚛 مدیریت خروج'],
    ['📦 مدیریت انبار', '📊 گزارشات بازرگانی'],
    ['💬 پیام‌ها', '⚙️ تنظیمات']
];

const PAY_MENU = [
    ['➕ ثبت پرداخت جدید', '📂 کارتابل من'],
    ['🗄️ بایگانی / جستجو', '🔙 بازگشت به خانه']
];

const EXIT_MENU = [
    ['➕ ثبت مجوز خروج', '📂 کارتابل خروج'],
    ['🏁 بایگانی نهایی', '🔙 بازگشت به خانه']
];

const WH_MENU = [
    ['📝 ثبت بیجک', '📋 موجودی انبار'],
    ['🔙 بازگشت به خانه']
];

// --- CORE HANDLER ---
export const handleMessage = async (platform, chatId, text, sendFn, sendPhotoFn, sendDocFn) => {
    const db = getDb();
    const user = resolveUser(db, platform, chatId);
    
    if (!user) return sendFn(chatId, "⛔ شما در سیستم تعریف نشده‌اید. لطفا با مدیر تماس بگیرید.");
    if (!sessions[chatId]) sessions[chatId] = { state: 'MAIN' };
    const session = sessions[chatId];

    // Global Commands
    if (text === '/start' || text.includes('بازگشت به خانه')) {
        session.state = 'MAIN';
        return sendFn(chatId, `👋 سلام ${user.fullName}\nبه سیستم مدیریت یکپارچه خوش آمدید.`, { keyboard: MAIN_MENU });
    }

    // --- MAIN MENU ROUTING ---
    if (session.state === 'MAIN') {
        if (text.includes('مدیریت پرداخت')) {
            session.state = 'PAY_MENU';
            return sendFn(chatId, "💰 بخش مدیریت پرداخت:", { keyboard: PAY_MENU });
        }
        if (text.includes('مدیریت خروج')) {
            session.state = 'EXIT_MENU';
            return sendFn(chatId, "🚛 بخش مدیریت خروج کالا:", { keyboard: EXIT_MENU });
        }
        if (text.includes('مدیریت انبار')) {
            session.state = 'WH_MENU';
            return sendFn(chatId, "📦 بخش انبار:", { keyboard: WH_MENU });
        }
    }

    // --- PAYMENT SECTION ---
    if (session.state === 'PAY_MENU') {
        if (text.includes('ثبت پرداخت جدید')) {
            session.state = 'PAY_NEW_AMOUNT';
            return sendFn(chatId, "💵 لطفا مبلغ را به ریال وارد کنید:", { removeKeyboard: true });
        }
        if (text.includes('کارتابل من')) {
            return showPaymentCartable(db, user, chatId, sendFn, sendPhotoFn);
        }
        if (text.includes('بایگانی')) {
            session.state = 'PAY_SEARCH';
            return sendFn(chatId, "🔍 شماره دستور پرداخت یا بخشی از نام گیرنده را وارد کنید:");
        }
    }

    // Payment Registration Flow
    if (session.state === 'PAY_NEW_AMOUNT') {
        const amt = parseInt(text.replace(/,/g, ''));
        if (isNaN(amt)) return sendFn(chatId, "❌ عدد نامعتبر. مجدد وارد کنید:");
        session.data = { amount: amt };
        session.state = 'PAY_NEW_PAYEE';
        return sendFn(chatId, "👤 نام گیرنده وجه (ذینفع) را وارد کنید:");
    }
    if (session.state === 'PAY_NEW_PAYEE') {
        session.data.payee = text;
        session.state = 'PAY_NEW_DESC';
        return sendFn(chatId, "📝 بابت (توضیحات) را وارد کنید:");
    }
    if (session.state === 'PAY_NEW_DESC') {
        const order = {
            id: Date.now().toString(),
            trackingNumber: (db.settings.currentTrackingNumber || 1000) + 1,
            date: new Date().toISOString().split('T')[0],
            payee: session.data.payee,
            totalAmount: session.data.amount,
            description: text,
            status: 'در انتظار بررسی مالی',
            requester: user.fullName,
            createdAt: Date.now()
        };
        db.settings.currentTrackingNumber = order.trackingNumber;
        db.orders.unshift(order);
        saveDb(db);
        
        session.state = 'PAY_MENU';
        sendFn(chatId, `✅ دستور پرداخت #${order.trackingNumber} ثبت شد.`, { keyboard: PAY_MENU });
        
        // Notify Financial Manager
        await notifyRole(db, 'financial', `💰 *درخواست پرداخت جدید*\nثبت کننده: ${user.fullName}`, 'PAYMENT', order, sendFn, sendPhotoFn);
        return;
    }

    // --- EXIT PERMIT SECTION ---
    if (session.state === 'EXIT_MENU') {
        if (text.includes('ثبت مجوز خروج')) {
            session.state = 'EXIT_NEW_RECIPIENT';
            return sendFn(chatId, "👤 نام گیرنده کالا را وارد کنید:", { removeKeyboard: true });
        }
        if (text.includes('کارتابل خروج')) {
            return showExitCartable(db, user, chatId, sendFn, sendPhotoFn);
        }
    }

    // Exit Registration Flow
    if (session.state === 'EXIT_NEW_RECIPIENT') {
        session.data = { recipient: text };
        session.state = 'EXIT_NEW_GOODS';
        return sendFn(chatId, "📦 نام کالا را وارد کنید:");
    }
    if (session.state === 'EXIT_NEW_GOODS') {
        session.data.goods = text;
        session.state = 'EXIT_NEW_COUNT';
        return sendFn(chatId, "🔢 تعداد (کارتن/عدد) را وارد کنید:");
    }
    if (session.state === 'EXIT_NEW_COUNT') {
        const permit = {
            id: Date.now().toString(),
            permitNumber: (db.settings.currentExitPermitNumber || 1000) + 1,
            date: new Date().toISOString().split('T')[0],
            recipientName: session.data.recipient,
            goodsName: session.data.goods,
            cartonCount: parseInt(text) || 0,
            weight: 0,
            status: 'در انتظار تایید مدیرعامل',
            requester: user.fullName,
            items: [{ goodsName: session.data.goods, cartonCount: parseInt(text) || 0 }],
            createdAt: Date.now()
        };
        db.settings.currentExitPermitNumber = permit.permitNumber;
        db.exitPermits.push(permit);
        saveDb(db);

        session.state = 'EXIT_MENU';
        sendFn(chatId, `✅ مجوز خروج #${permit.permitNumber} ثبت شد.`, { keyboard: EXIT_MENU });

        // Trigger Workflow: Send to CEO
        await advanceExitWorkflow(db, permit, 'REGISTERED', user, sendFn, sendPhotoFn);
        return;
    }

    // Warehouse Weight Input (triggered from Callback)
    if (session.state === 'ENTER_WEIGHT') {
        const weight = parseFloat(text);
        if (isNaN(weight)) return sendFn(chatId, "❌ عدد وارد کنید:");
        
        const permitId = session.data.permitId;
        const permit = db.exitPermits.find(p => p.id === permitId);
        if (permit) {
            permit.weight = weight;
            if(permit.items[0]) permit.items[0].weight = weight; // Simple update
            
            // Advance Workflow
            await advanceExitWorkflow(db, permit, 'WEIGHED', user, sendFn, sendPhotoFn);
            
            session.state = 'MAIN';
            return sendFn(chatId, "✅ وزن ثبت و پروسه ادامه یافت.", { keyboard: MAIN_MENU });
        }
    }
    
    // Security Time Input
    if (session.state === 'ENTER_EXIT_TIME') {
        const permitId = session.data.permitId;
        const permit = db.exitPermits.find(p => p.id === permitId);
        if (permit) {
            permit.exitTime = text; // e.g. "14:30"
            await advanceExitWorkflow(db, permit, 'EXITED', user, sendFn, sendPhotoFn);
            session.state = 'MAIN';
            return sendFn(chatId, "✅ خروج نهایی ثبت شد.", { keyboard: MAIN_MENU });
        }
    }

    return sendFn(chatId, "متوجه نشدم. از منو استفاده کنید.", { keyboard: MAIN_MENU });
};

// --- CALLBACK HANDLER (Inline Buttons) ---
export const handleCallback = async (platform, chatId, data, sendFn, sendPhotoFn) => {
    const db = getDb();
    const user = resolveUser(db, platform, chatId);
    if (!user) return;

    const [action, type, id] = data.split('_');

    // 1. PAYMENT CALLBACKS
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
                
                sendFn(chatId, `✅ تایید شد. وضعیت جدید: ${nextStatus}`);
                
                // Notify Next Person
                if (nextStatus.includes('مدیریت')) await notifyRole(db, 'manager', `🔔 جهت تایید: پرداخت #${order.trackingNumber}`, 'PAYMENT', order, sendFn, sendPhotoFn);
                else if (nextStatus.includes('مدیرعامل')) await notifyRole(db, 'ceo', `🔔 جهت تایید: پرداخت #${order.trackingNumber}`, 'PAYMENT', order, sendFn, sendPhotoFn);
                else if (nextStatus === 'تایید نهایی') await notifyRole(db, 'financial', `✅ پرداخت #${order.trackingNumber} تایید نهایی شد. لطفا پرداخت کنید.`, 'PAYMENT', order, sendFn, sendPhotoFn);
            }
        } else {
            order.status = 'رد شده';
            saveDb(db);
            sendFn(chatId, "❌ سند رد شد.");
        }
    }

    // 2. EXIT PERMIT CALLBACKS (Complex Workflow)
    if (type === 'EXIT') {
        const permit = db.exitPermits.find(p => p.id === id);
        if (!permit) return sendFn(chatId, "❌ مجوز یافت نشد.");

        if (action === 'APPROVE') {
            if (permit.status === 'در انتظار تایید مدیرعامل' && (user.role === 'ceo' || user.role === 'admin')) {
                permit.approverCeo = user.fullName;
                await advanceExitWorkflow(db, permit, 'APPROVED_CEO', user, sendFn, sendPhotoFn);
                sendFn(chatId, "✅ تایید شد.");
            }
            else if (permit.status === 'در انتظار مدیر کارخانه' && (user.role === 'factory_manager' || user.role === 'admin')) {
                permit.approverFactory = user.fullName;
                await advanceExitWorkflow(db, permit, 'APPROVED_FACTORY', user, sendFn, sendPhotoFn);
                sendFn(chatId, "✅ تایید شد.");
            }
            else if (permit.status === 'در انتظار تایید انبار' && (user.role === 'warehouse_keeper' || user.role === 'admin')) {
                // Ask for Weight
                sessions[chatId].state = 'ENTER_WEIGHT';
                sessions[chatId].data = { permitId: id };
                sendFn(chatId, "⚖️ لطفا وزن نهایی خروجی (کیلوگرم) را وارد کنید:");
            }
            else if (permit.status === 'در انتظار خروج' && (user.role === 'security_head' || user.role === 'admin')) {
                // Ask for Exit Time
                sessions[chatId].state = 'ENTER_EXIT_TIME';
                sessions[chatId].data = { permitId: id };
                sendFn(chatId, "🕒 لطفا ساعت خروج را وارد کنید (مثال 14:30):");
            }
        } else {
            permit.status = 'رد شده';
            saveDb(db);
            sendFn(chatId, "❌ رد شد.");
        }
    }
};

// --- WORKFLOW ENGINE ---
const advanceExitWorkflow = async (db, permit, event, actor, sendFn, sendPhotoFn) => {
    let caption = '';
    let targets = [];
    const img = await Renderer.generateRecordImage(permit, 'EXIT');

    if (event === 'REGISTERED') {
        // Sales -> CEO
        caption = `🔔 *مجوز خروج جدید*\nشماره: ${permit.permitNumber}\nثبت کننده: ${permit.requester}\nجهت تایید مدیرعامل`;
        targets.push({ role: 'ceo', actions: true });
    }
    else if (event === 'APPROVED_CEO') {
        permit.status = 'در انتظار مدیر کارخانه';
        saveDb(db);
        // CEO -> Factory + Group1
        caption = `✅ *تایید مدیرعامل*\nمجوز #${permit.permitNumber}\nارجاع به مدیر کارخانه`;
        targets.push({ role: 'factory_manager', actions: true });
        targets.push({ group: db.settings.exitPermitNotificationGroup }); // Group 1
    }
    else if (event === 'APPROVED_FACTORY') {
        permit.status = 'در انتظار تایید انبار';
        saveDb(db);
        // Factory -> Warehouse + Group2
        caption = `✅ *تایید مدیر کارخانه*\nمجوز #${permit.permitNumber}\nارجاع به انبار`;
        targets.push({ role: 'warehouse_keeper', actions: true });
        targets.push({ group: db.settings.exitPermitSecondGroupConfig?.groupId }); // Group 2
    }
    else if (event === 'WEIGHED') {
        permit.status = 'در انتظار خروج';
        saveDb(db);
        // Warehouse -> Security + Group2
        caption = `⚖️ *توزین انجام شد*\nمجوز #${permit.permitNumber}\nوزن: ${permit.weight} KG\nارجاع به انتظامات`;
        targets.push({ role: 'security_head', actions: true });
        targets.push({ group: db.settings.exitPermitSecondGroupConfig?.groupId });
    }
    else if (event === 'EXITED') {
        permit.status = 'خارج شده (بایگانی)';
        saveDb(db);
        // Security -> Group1 + Group2
        caption = `👋 *خروج نهایی*\nمجوز #${permit.permitNumber}\nساعت: ${permit.exitTime}\nتایید نهایی: ${actor.fullName}`;
        targets.push({ group: db.settings.exitPermitNotificationGroup });
        targets.push({ group: db.settings.exitPermitSecondGroupConfig?.groupId });
    }

    // Send notifications
    for (const t of targets) {
        if (t.role) await notifyRole(db, t.role, caption, 'EXIT', permit, sendFn, sendPhotoFn, t.actions);
        if (t.group) await notifyGroup(t.group, caption, img, sendFn, sendPhotoFn); // Implementation depends on platform capabilities for groups
    }
};

// --- NOTIFICATION HELPERS ---
const notifyRole = async (db, role, caption, type, data, sendFn, sendPhotoFn, withButtons = true) => {
    const users = db.users.filter(u => u.role === role);
    const img = await Renderer.generateRecordImage(data, type);
    
    let keyboard = null;
    if (withButtons) {
        keyboard = {
            inline_keyboard: [
                [
                    { text: '✅ تایید / اقدام', callback_data: `APPROVE_${type}_${data.id}` },
                    { text: '❌ رد', callback_data: `REJECT_${type}_${data.id}` }
                ]
            ]
        };
    }

    for (const u of users) {
        if (u.telegramChatId) await sendPhotoFn('telegram', u.telegramChatId, img, caption, { reply_markup: keyboard });
        if (u.baleChatId) await sendPhotoFn('bale', u.baleChatId, img, caption, { reply_markup: keyboard });
    }
};

const notifyGroup = async (groupId, caption, img, sendFn, sendPhotoFn) => {
    if (!groupId) return;
    // Note: Group IDs are platform specific. If it's a number (Bale/Telegram ID), try sending.
    // Since we don't know if the ID belongs to TG or Bale, we might need to store platform in settings or try both.
    // For now, assume IDs are distinct enough or handle errors gracefully.
    try { await sendPhotoFn('telegram', groupId, img, caption); } catch(e){}
    try { await sendPhotoFn('bale', groupId, img, caption); } catch(e){}
};

// --- CARTABLE HELPERS ---
const showPaymentCartable = async (db, user, chatId, sendFn, sendPhotoFn) => {
    let items = [];
    if (user.role === 'financial') items = db.orders.filter(o => o.status === 'در انتظار بررسی مالی');
    if (user.role === 'manager') items = db.orders.filter(o => o.status.includes('تایید مالی'));
    if (user.role === 'ceo') items = db.orders.filter(o => o.status.includes('تایید مدیریت'));

    if (items.length === 0) return sendFn(chatId, "✅ کارتابل شما خالی است.");

    for (const item of items) {
        const img = await Renderer.generateRecordImage(item, 'PAYMENT');
        const keyboard = {
            inline_keyboard: [[
                { text: '✅ تایید', callback_data: `APPROVE_PAY_${item.id}` },
                { text: '❌ رد', callback_data: `REJECT_PAY_${item.id}` }
            ]]
        };
        await sendPhotoFn(null, chatId, img, `سند #${item.trackingNumber}`, { reply_markup: keyboard });
    }
};

const showExitCartable = async (db, user, chatId, sendFn, sendPhotoFn) => {
    let items = [];
    if (user.role === 'ceo') items = db.exitPermits.filter(p => p.status === 'در انتظار تایید مدیرعامل');
    if (user.role === 'factory_manager') items = db.exitPermits.filter(p => p.status === 'در انتظار مدیر کارخانه');
    if (user.role === 'warehouse_keeper') items = db.exitPermits.filter(p => p.status === 'در انتظار تایید انبار');
    if (user.role === 'security_head') items = db.exitPermits.filter(p => p.status === 'در انتظار خروج');

    if (items.length === 0) return sendFn(chatId, "✅ کارتابل شما خالی است.");

    for (const item of items) {
        const img = await Renderer.generateRecordImage(item, 'EXIT');
        const keyboard = {
            inline_keyboard: [[
                { text: '✅ اقدام / تایید', callback_data: `APPROVE_EXIT_${item.id}` },
                { text: '❌ رد', callback_data: `REJECT_EXIT_${item.id}` }
            ]]
        };
        await sendPhotoFn(null, chatId, img, `مجوز #${item.permitNumber}`, { reply_markup: keyboard });
    }
};

// --- EXTERNAL TRIGGER (FROM API) ---
export const triggerNotification = async (type, item) => {
    const db = getDb();
    // Re-route to the workflow engine logic
    if (type === 'NEW_PAYMENT') {
        const img = await Renderer.generateRecordImage(item, 'PAYMENT');
        await notifyRole(db, 'financial', `💰 *درخواست پرداخت جدید*\nثبت کننده: ${item.requester}`, 'PAYMENT', item, null, null); // We need a way to invoke sendPhoto without passed fn, imply bot instances are global/accessible or passed here.
        // NOTE: In real app, bot instances should be singletons imported here. 
        // For simplicity in this structure, we assume server.js calls specific platform senders which use bot-core logic.
    }
};
