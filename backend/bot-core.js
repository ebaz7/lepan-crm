
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

const MENUS = {
    MAIN: [['💰 پرداخت‌ها', '🚛 خروج کالا'], ['📦 انبار / بیجک', '📊 گزارشات'], ['💬 پیام‌ها', '⚙️ تنظیمات']],
    PAYMENTS: [['➕ ثبت پرداخت', '📂 کارتابل پرداخت'], ['🔍 آرشیو', '🔙 بازگشت']],
    EXIT: [['➕ ثبت مجوز خروج', '📂 کارتابل خروج'], ['🏁 آرشیو نهایی', '🔙 بازگشت']],
    WAREHOUSE: [['📦 ثبت بیجک', '📥 رسید انبار'], ['🔙 بازگشت']],
    REPORTS: [['📊 گزارشات تجاری', '🔙 بازگشت']]
};

const checkPermission = (user, requiredRoles) => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    return requiredRoles.includes(user.role);
};

export const handleMessage = async (platform, chatId, text, sendFn, sendPhotoFn) => {
    const db = getDb();
    const user = getUser(db, platform, chatId);
    const session = getSession(chatId);

    if (!user) return sendFn(chatId, "⛔ عدم دسترسی. تماس با مدیر.");

    // Commands
    if (text === '/start' || text === '🔙 بازگشت') {
        session.state = 'MAIN_MENU';
        return sendFn(chatId, `سلام ${user.fullName} 👋\nمنوی اصلی:`, { keyboard: MENUS.MAIN });
    }

    // --- MAIN ROUTING ---
    if (session.state === 'MAIN_MENU') {
        if (text === '💰 پرداخت‌ها') { session.state = 'MENU_PAYMENTS'; return sendFn(chatId, "مدیریت پرداخت:", { keyboard: MENUS.PAYMENTS }); }
        if (text === '🚛 خروج کالا') { session.state = 'MENU_EXIT'; return sendFn(chatId, "مدیریت خروج:", { keyboard: MENUS.EXIT }); }
        if (text === '📦 انبار / بیجک') { session.state = 'MENU_WAREHOUSE'; return sendFn(chatId, "مدیریت انبار:", { keyboard: MENUS.WAREHOUSE }); }
        if (text === '📊 گزارشات') { session.state = 'MENU_REPORTS'; return sendFn(chatId, "گزارشات:", { keyboard: MENUS.REPORTS }); }
    }

    // --- PAYMENT FLOW ---
    if (session.state === 'MENU_PAYMENTS') {
        if (text === '➕ ثبت پرداخت') {
            session.state = 'PAY_AMOUNT';
            return sendFn(chatId, "💰 مبلغ (ریال):", { removeKeyboard: true });
        }
        if (text === '📂 کارتابل پرداخت') return listPaymentCartable(db, user, chatId, sendFn);
    }
    if (session.state === 'PAY_AMOUNT') {
        const amt = parseInt(text.replace(/,/g, ''));
        if (isNaN(amt)) return sendFn(chatId, "❌ عدد وارد کنید:");
        session.data.amount = amt;
        session.state = 'PAY_PAYEE';
        return sendFn(chatId, "👤 نام گیرنده:");
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
            payingCompany: db.settings.defaultCompany || '-',
            paymentDetails: [],
            createdAt: Date.now()
        };
        db.settings.currentTrackingNumber = order.trackingNumber;
        db.orders.unshift(order);
        saveDb(db);
        session.state = 'MAIN_MENU';
        await notifyRole(db, 'financial', `💰 درخواست پرداخت جدید #${order.trackingNumber}`, sendFn, sendPhotoFn, 'PAYMENT', order);
        return sendFn(chatId, `✅ ثبت شد: #${order.trackingNumber}`, { keyboard: MENUS.MAIN });
    }

    // --- EXIT FLOW ---
    if (session.state === 'MENU_EXIT') {
        if (text === '➕ ثبت مجوز خروج') {
            if (!checkPermission(user, ['sales_manager', 'ceo', 'admin'])) return sendFn(chatId, "⛔ عدم دسترسی");
            session.state = 'EXIT_RECIPIENT';
            return sendFn(chatId, "👤 نام گیرنده:", { removeKeyboard: true });
        }
        if (text === '📂 کارتابل خروج') return listExitCartable(db, user, chatId, sendFn);
    }
    if (session.state === 'EXIT_RECIPIENT') {
        session.data.recipient = text;
        session.state = 'EXIT_GOODS';
        return sendFn(chatId, "📦 نام کالا:");
    }
    if (session.state === 'EXIT_GOODS') {
        session.data.goods = text;
        session.state = 'EXIT_COUNT';
        return sendFn(chatId, "🔢 تعداد (کارتن):");
    }
    if (session.state === 'EXIT_COUNT') {
        session.data.count = parseInt(text) || 0;
        const permit = {
            id: Date.now().toString(),
            permitNumber: (db.settings.currentExitPermitNumber || 1000) + 1,
            date: new Date().toISOString().split('T')[0],
            recipientName: session.data.recipient,
            goodsName: session.data.goods,
            cartonCount: session.data.count,
            weight: 0,
            status: 'در انتظار تایید مدیرعامل',
            requester: user.fullName,
            company: db.settings.defaultCompany || '-',
            items: [{ id: Date.now().toString(), goodsName: session.data.goods, cartonCount: session.data.count, weight: 0 }],
            destinations: [{ id: Date.now().toString(), recipientName: session.data.recipient, address: '', phone: '' }],
            createdAt: Date.now()
        };
        db.settings.currentExitPermitNumber = permit.permitNumber;
        db.exitPermits.push(permit);
        saveDb(db);
        session.state = 'MAIN_MENU';
        
        // WORKFLOW STEP 1: Sales -> CEO
        const img = await Renderer.generateRecordImage(permit, 'EXIT');
        await notifyRole(db, 'ceo', `🚛 مجوز خروج جدید #${permit.permitNumber}\nجهت تایید مدیرعامل`, sendFn, sendPhotoFn, 'EXIT', permit, img);
        
        return sendFn(chatId, `✅ ثبت شد: #${permit.permitNumber}`, { keyboard: MENUS.MAIN });
    }

    // --- WAREHOUSE WEIGHT ENTRY (Callback continuation) ---
    if (session.state === 'ENTER_WEIGHT') {
        const weight = parseFloat(text);
        if (isNaN(weight)) return sendFn(chatId, "❌ وزن نامعتبر. عدد وارد کنید:");
        
        const permitId = session.data.permitId;
        const permit = db.exitPermits.find(p => p.id === permitId);
        if (permit) {
            permit.weight = weight;
            if (permit.items.length > 0) permit.items[0].weight = weight;
            permit.status = 'در انتظار خروج'; // Passed Warehouse -> Security
            permit.approverWarehouse = user.fullName;
            saveDb(db);
            
            session.state = 'MAIN_MENU';
            sendFn(chatId, "✅ وزن ثبت و به انتظامات ارسال شد.", { keyboard: MENUS.MAIN });

            // WORKFLOW STEP 4: Warehouse -> Security & Group 2
            const img = await Renderer.generateRecordImage(permit, 'EXIT');
            const cap = `⚖️ توزین انجام شد (انبار)\nشماره: ${permit.permitNumber}\nوزن: ${weight} KG\nجهت اقدام انتظامات`;
            
            await notifyRole(db, 'security_head', cap, sendFn, sendPhotoFn, 'EXIT', permit, img);
            await notifyGroup(db, 'group2', cap, sendFn, sendPhotoFn, img);
        } else {
            session.state = 'MAIN_MENU';
            sendFn(chatId, "❌ خطا: مجوز یافت نشد.", { keyboard: MENUS.MAIN });
        }
    }

    return sendFn(chatId, "دستور نامعتبر.", { keyboard: MENUS.MAIN });
};

export const handleCallback = async (platform, chatId, data, sendFn, sendPhotoFn) => {
    const db = getDb();
    const user = getUser(db, platform, chatId);
    const session = getSession(chatId);
    if (!user) return;

    const [action, type, id] = data.split('_');

    if (type === 'PAYMENT') {
        const order = db.orders.find(o => o.id === id);
        if (!order) return sendFn(chatId, "❌ سند یافت نشد");
        
        if (action === 'APPROVE') {
            let next = '';
            if (order.status === 'در انتظار بررسی مالی') next = 'تایید مالی / در انتظار مدیریت';
            else if (order.status.includes('تایید مالی')) next = 'تایید مدیریت / در انتظار مدیرعامل';
            else if (order.status.includes('تایید مدیریت')) next = 'تایید نهایی';
            else return sendFn(chatId, "⛔ وضعیت نامعتبر");

            order.status = next;
            if (user.role === 'financial') order.approverFinancial = user.fullName;
            if (user.role === 'manager') order.approverManager = user.fullName;
            if (user.role === 'ceo') order.approverCeo = user.fullName;
            saveDb(db);
            
            sendFn(chatId, `✅ تایید شد. وضعیت: ${next}`);
            
            const img = await Renderer.generateRecordImage(order, 'PAYMENT');
            if (next.includes('مدیریت')) notifyRole(db, 'manager', `جهت تایید: پرداخت #${order.trackingNumber}`, sendFn, sendPhotoFn, 'PAYMENT', order, img);
            else if (next.includes('مدیرعامل')) notifyRole(db, 'ceo', `جهت تایید: پرداخت #${order.trackingNumber}`, sendFn, sendPhotoFn, 'PAYMENT', order, img);
        } else {
            order.status = 'رد شده';
            order.rejectedBy = user.fullName;
            saveDb(db);
            sendFn(chatId, `❌ رد شد.`);
        }
    } 
    else if (type === 'EXIT') {
        const permit = db.exitPermits.find(p => p.id === id);
        if (!permit) return sendFn(chatId, "❌ مجوز یافت نشد");

        if (action === 'APPROVE') {
            let next = '';
            let targetRole = '';
            let targetGroup = '';
            let caption = '';

            // WORKFLOW LOGIC
            if (permit.status === 'در انتظار تایید مدیرعامل' && checkPermission(user, ['ceo', 'admin'])) {
                // Step 2: CEO -> Factory + Group1
                next = 'در انتظار مدیر کارخانه'; // UI Label: PENDING_FACTORY
                permit.approverCeo = user.fullName;
                targetRole = 'factory_manager';
                targetGroup = 'group1';
                caption = `✅ تایید مدیرعامل\nمجوز #${permit.permitNumber}\nارجاع به کارخانه`;
            } 
            else if (permit.status === 'در انتظار مدیر کارخانه' && checkPermission(user, ['factory_manager', 'admin'])) {
                // Step 3: Factory -> Warehouse + Group2
                next = 'در انتظار تایید انبار'; // UI Label: PENDING_WAREHOUSE
                permit.approverFactory = user.fullName;
                targetRole = 'warehouse_keeper';
                targetGroup = 'group2';
                caption = `✅ تایید مدیر کارخانه\nمجوز #${permit.permitNumber}\nارجاع به انبار`;
            }
            else if (permit.status === 'در انتظار تایید انبار' && checkPermission(user, ['warehouse_keeper', 'admin'])) {
                // Step 4: Warehouse Input Trigger
                session.state = 'ENTER_WEIGHT';
                session.data.permitId = id;
                return sendFn(chatId, "⚖️ لطفا وزن نهایی (کیلوگرم) را وارد کنید:");
            }
            else if (permit.status === 'در انتظار خروج' && checkPermission(user, ['security_head', 'admin'])) {
                // Step 5: Security Final -> Group1 + Group2
                const time = new Date().toLocaleTimeString('fa-IR', {hour:'2-digit', minute:'2-digit'});
                permit.exitTime = time;
                permit.status = 'خارج شده (بایگانی)';
                permit.approverSecurity = user.fullName;
                saveDb(db);
                
                const img = await Renderer.generateRecordImage(permit, 'EXIT');
                const finalCap = `👋 خروج نهایی\nمجوز #${permit.permitNumber}\nساعت: ${time}\nتوسط: ${user.fullName}`;
                
                await notifyGroup(db, 'group1', finalCap, sendFn, sendPhotoFn, img);
                await notifyGroup(db, 'group2', finalCap, sendFn, sendPhotoFn, img);
                
                return sendFn(chatId, "✅ خروج نهایی ثبت شد.");
            }
            else {
                return sendFn(chatId, "⛔ نوبت شما نیست.");
            }

            if (next) {
                permit.status = next;
                saveDb(db);
                sendFn(chatId, `✅ انجام شد: ${caption}`);
                
                const img = await Renderer.generateRecordImage(permit, 'EXIT');
                if (targetRole) await notifyRole(db, targetRole, caption, sendFn, sendPhotoFn, 'EXIT', permit, img);
                if (targetGroup) await notifyGroup(db, targetGroup, caption, sendFn, sendPhotoFn, img);
            }
        } else {
            permit.status = 'رد شده';
            permit.rejectedBy = user.fullName;
            saveDb(db);
            sendFn(chatId, "❌ رد شد.");
        }
    }
};

// --- HELPERS ---
const notifyRole = async (db, role, text, sendFn, photoFn, type, data, imageBuffer) => {
    const targets = db.users.filter(u => u.role === role);
    for (const t of targets) {
        const keyboard = { inline_keyboard: [[ { text: "✅ تایید", callback_data: `APPROVE_${type}_${data.id}` }, { text: "❌ رد", callback_data: `REJECT_${type}_${data.id}` } ]] };
        const chatId = t.baleChatId || t.telegramChatId; // Prefer Bale logic if needed, but core handles generic ID
        if (t.baleChatId) await photoFn('bale', t.baleChatId, imageBuffer, text, keyboard);
        if (t.telegramChatId) await photoFn('telegram', t.telegramChatId, imageBuffer, text, keyboard);
    }
};

const notifyGroup = async (db, groupKey, text, sendFn, photoFn, imageBuffer) => {
    // Logic to find group chat IDs from settings
    // This assumes settings has fields like 'group1_id', 'group2_id' or similar mapping
    // For now, simpler broadcast to admins or specific log
};

const listExitCartable = (db, user, chatId, sendFn) => {
    let pending = [];
    if (user.role === 'ceo') pending = db.exitPermits.filter(p => p.status === 'در انتظار تایید مدیرعامل');
    else if (user.role === 'factory_manager') pending = db.exitPermits.filter(p => p.status === 'در انتظار مدیر کارخانه');
    else if (user.role === 'warehouse_keeper') pending = db.exitPermits.filter(p => p.status === 'در انتظار تایید انبار');
    else if (user.role === 'security_head') pending = db.exitPermits.filter(p => p.status === 'در انتظار خروج');

    if (pending.length === 0) return sendFn(chatId, "✅ کارتابل خالی است.");

    pending.forEach(p => {
        const keyboard = { inline_keyboard: [[ { text: "✅ بررسی", callback_data: `APPROVE_EXIT_${p.id}` }, { text: "❌ رد", callback_data: `REJECT_EXIT_${p.id}` } ]] };
        sendFn(chatId, `🚛 مجوز #${p.permitNumber}\nگیرنده: ${p.recipientName}\nکالا: ${p.goodsName}`, { reply_markup: keyboard });
    });
};

const listPaymentCartable = (db, user, chatId, sendFn) => {
    // Similar logic for payments
    let pending = [];
    if (user.role === 'financial') pending = db.orders.filter(o => o.status === 'در انتظار بررسی مالی');
    // ... others
    if (pending.length === 0) return sendFn(chatId, "✅ کارتابل خالی است.");
    pending.forEach(p => {
        const keyboard = { inline_keyboard: [[ { text: "✅ بررسی", callback_data: `APPROVE_PAYMENT_${p.id}` } ]] };
        sendFn(chatId, `💰 پرداخت #${p.trackingNumber}\nمبلغ: ${p.totalAmount}`, { reply_markup: keyboard });
    });
};
