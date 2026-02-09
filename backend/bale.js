
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseMessage } from './whatsapp/parser.js';
import * as Actions from './whatsapp/actions.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '..', 'database.json');

// Global control flags
let pollingActive = false;
let pollingInstanceId = 0; 
let lastOffset = 0;

const getDb = () => {
    try {
        if (fs.existsSync(DB_PATH)) {
            return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
        }
    } catch (e) { console.error("DB Read Error", e); }
    return null;
};

// --- API WRAPPER ---
const callBaleApi = (token, method, data = null) => {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'tapi.bale.ai',
            port: 443,
            path: `/bot${token}/${method}`,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        };

        if (data) options.headers['Content-Length'] = Buffer.byteLength(JSON.stringify(data));

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(body);
                    resolve(parsed);
                } catch (e) { reject(e); }
            });
        });

        req.on('error', (e) => reject(e));
        if (data) req.write(JSON.stringify(data));
        req.end();
    });
};

// --- NOTIFICATION HELPERS (EXPORTED) ---
export const sendBaleMessage = (token, chatId, text) => {
    return callBaleApi(token, 'sendMessage', { chat_id: chatId, text: text });
};

export const notifyUser = async (db, userIdOrRole, message) => {
    if (!db.settings.baleBotToken) return;
    
    // Find target users
    let targets = [];
    if (userIdOrRole.startsWith('role:')) {
        const role = userIdOrRole.split(':')[1];
        targets = db.users.filter(u => u.role === role && u.baleChatId);
    } else {
        const user = db.users.find(u => u.username === userIdOrRole || u.id === userIdOrRole);
        if (user && user.baleChatId) targets.push(user);
    }

    for (const target of targets) {
        try {
            await sendBaleMessage(db.settings.baleBotToken, target.baleChatId, message);
            console.log(`>>> Bale Notification sent to ${target.fullName}`);
        } catch (e) {
            console.error(`Bale Send Error to ${target.fullName}:`, e.message);
        }
    }
};

// --- KEYBOARD BUILDER (GRID LAYOUT) ---
const getMainMenu = (role) => {
    const keyboard = [
        [
            { text: "➕ ثبت دستور پرداخت" },
            { text: "🚛 ثبت مجوز خروج" },
            { text: "📦 صدور بیجک" }
        ],
        [
            { text: "💰 کارتابل پرداخت" },
            { text: "🚧 کارتابل خروج" },
            { text: "📋 کارتابل بیجک" }
        ],
        [
            { text: "🗄 بایگانی دستورات" },
            { text: "📊 گزارشات کلی" },
            { text: "📦 گزارشات انبار" }
        ]
    ];

    return {
        keyboard: keyboard,
        resize_keyboard: true
    };
};

// --- DETAILED REPORT GENERATORS ---
const sendDetailedList = async (token, chatId, items, type) => {
    if (!items || items.length === 0) {
        await sendBaleMessage(token, chatId, "📂 کارتابل شما خالی است.");
        return;
    }

    await sendBaleMessage(token, chatId, `🔎 تعداد ${items.length} مورد در کارتابل یافت شد:`);

    for (const item of items) {
        let msg = "";
        if (type === 'payment') {
            msg = `💰 *دستور پرداخت*\n` +
                  `🔖 شماره: ${item.trackingNumber}\n` +
                  `👤 ذینفع: ${item.payee}\n` +
                  `💵 مبلغ: ${new Intl.NumberFormat('fa-IR').format(item.totalAmount)} ریال\n` +
                  `🏢 شرکت: ${item.payingCompany}\n` +
                  `📝 بابت: ${item.description}\n` +
                  `📅 تاریخ: ${item.date}\n` +
                  `📊 وضعیت: ${item.status}\n` +
                  `------------------------------\n` +
                  `برای تایید یا رد، روی متن زیر بزنید:\n` +
                  `✅ تایید پرداخت ${item.trackingNumber}\n` +
                  `❌ رد پرداخت ${item.trackingNumber}`;
        } else if (type === 'exit') {
            msg = `🚛 *مجوز خروج*\n` +
                  `🔖 شماره: ${item.permitNumber}\n` +
                  `👤 گیرنده: ${item.recipientName}\n` +
                  `📦 کالا: ${item.goodsName}\n` +
                  `🔢 تعداد/وزن: ${item.cartonCount} کارتن | ${item.weight} کیلو\n` +
                  `🚚 راننده: ${item.driverName || '-'}\n` +
                  `📊 وضعیت: ${item.status}\n` +
                  `------------------------------\n` +
                  `عملیات:\n` +
                  `✅ تایید خروج ${item.permitNumber}\n` +
                  `❌ رد خروج ${item.permitNumber}`;
        } else if (type === 'bijak') {
            msg = `📦 *بیجک انبار*\n` +
                  `🔖 شماره: ${item.number}\n` +
                  `🏢 شرکت: ${item.company}\n` +
                  `👤 گیرنده: ${item.recipientName}\n` +
                  `📦 اقلام: ${item.items.map(i=>i.itemName).join('، ')}\n` +
                  `📊 وضعیت: ${item.status}\n` +
                  `------------------------------\n` +
                  `عملیات:\n` +
                  `✅ تایید بیجک ${item.number}`; // Assuming simple approval for now
        }

        await sendBaleMessage(token, chatId, msg);
        // Add a small delay to ensure order
        await new Promise(r => setTimeout(r, 100)); 
    }
};

// --- CORE LOGIC ---
const handleCommand = async (token, update) => {
    const msg = update.message;
    if (!msg || !msg.text) return;

    const chatId = msg.chat.id;
    const text = msg.text.trim();
    const userId = msg.from.id;

    const db = getDb();
    if (!db) return;

    // Auth Check
    const user = db.users.find(u => u.baleChatId && u.baleChatId.toString() === userId.toString());

    if (!user) {
        if (text === '/start') {
            await sendBaleMessage(token, chatId, `⛔ عدم دسترسی.\nشناسه بله شما: ${userId}\nاین شناسه را به مدیر سیستم بدهید.`);
        }
        return;
    }

    // Start Command (Show Menu)
    if (text === '/start' || text === 'منو') {
        await callBaleApi(token, 'sendMessage', { 
            chat_id: chatId, 
            text: `سلام ${user.fullName} 👋\nبه سیستم جامع مدیریت خوش آمدید.\nیکی از گزینه‌های زیر را انتخاب کنید:`,
            reply_markup: getMainMenu(user.role)
        });
        return;
    }

    // --- BUTTON HANDLERS ---
    if (text.includes('کارتابل پرداخت')) {
        let orders = db.orders.filter(o => o.status !== 'رد شده' && o.status !== 'باطل شده' && o.status !== 'تایید نهایی');
        // Filter based on role logic
        if (user.role === 'financial') orders = orders.filter(o => o.status === 'در انتظار بررسی مالی');
        else if (user.role === 'manager') orders = orders.filter(o => o.status === 'تایید مالی / در انتظار مدیریت');
        else if (user.role === 'ceo') orders = orders.filter(o => o.status === 'تایید مدیریت / در انتظار مدیرعامل');
        else if (user.role === 'admin') { /* See all pending */ }
        else orders = [];

        await sendDetailedList(token, chatId, orders, 'payment');
        return;
    }

    if (text.includes('کارتابل خروج')) {
        let permits = db.exitPermits.filter(p => p.status !== 'خارج شده (بایگانی)' && p.status !== 'رد شده');
        // Simple logic: show all pending for authorized roles
        if (['admin', 'ceo', 'factory_manager', 'warehouse_keeper', 'security_head'].includes(user.role)) {
             // Ideally filter by specific step, but showing all active flow is better for overview
        } else {
            permits = [];
        }
        await sendDetailedList(token, chatId, permits, 'exit');
        return;
    }

    if (text.includes('کارتابل بیجک')) {
        let bijaks = db.warehouseTransactions.filter(t => t.type === 'OUT' && t.status === 'PENDING');
        if (!['admin', 'ceo', 'warehouse_keeper'].includes(user.role)) bijaks = [];
        await sendDetailedList(token, chatId, bijaks, 'bijak');
        return;
    }

    if (text.includes('بایگانی دستورات')) {
        const archived = db.orders.filter(o => o.status === 'تایید نهایی').slice(0, 5); // Last 5
        await sendDetailedList(token, chatId, archived, 'payment');
        return;
    }

    // --- ACTION PARSING (Approve/Reject via text reply) ---
    try {
        const result = await parseMessage(text, db);
        if (result) {
            const { intent, args } = result;
            let replyText = '';

            switch (intent) {
                case 'APPROVE_PAYMENT': replyText = Actions.handleApprovePayment(db, args.number); break;
                case 'REJECT_PAYMENT': replyText = Actions.handleRejectPayment(db, args.number); break;
                case 'APPROVE_EXIT': replyText = Actions.handleApproveExit(db, args.number); break;
                case 'REJECT_EXIT': replyText = Actions.handleRejectExit(db, args.number); break;
                case 'CREATE_PAYMENT': replyText = Actions.handleCreatePayment(db, args); break;
                case 'CREATE_BIJAK': replyText = Actions.handleCreateBijak(db, args); break;
                case 'REPORT_GENERAL': replyText = Actions.handleReport(db); break;
            }

            if (replyText) {
                await sendBaleMessage(token, chatId, replyText);
                // Refresh list if it was an action
                if (intent.includes('APPROVE') || intent.includes('REJECT')) {
                    // Maybe auto-show next item? For now just confirm.
                }
            }
        }
    } catch (e) {
        console.error("Bale Action Error:", e);
    }
};

// --- POLLING ---
const poll = async (token, instanceId) => {
    if (!pollingActive || instanceId !== pollingInstanceId) return;

    try {
        const response = await callBaleApi(token, 'getUpdates', { offset: lastOffset + 1 });
        // @ts-ignore
        if (response.ok && response.result.length > 0) {
            // @ts-ignore
            for (const update of response.result) {
                lastOffset = update.update_id;
                await handleCommand(token, update);
            }
        }
    } catch (e) {}

    if (pollingActive && instanceId === pollingInstanceId) {
        setTimeout(() => poll(token, instanceId), 3000);
    }
};

export const initBaleBot = (token) => {
    if (!token) return;
    pollingActive = false;
    setTimeout(() => {
        console.log(">>> Starting Bale Bot Polling...");
        pollingActive = true;
        pollingInstanceId++;
        poll(token, pollingInstanceId);
    }, 1000);
};

export const restartBaleBot = (token) => {
    console.log(">>> Restarting Bale Bot...");
    pollingActive = false;
    setTimeout(() => { initBaleBot(token); }, 2000);
};
