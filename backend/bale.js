
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

export const sendBaleMessage = (token, chatId, caption, mediaData) => {
    return new Promise((resolve, reject) => {
        if (!token || !chatId) return reject(new Error('Token or ChatID missing for Bale'));

        if (!mediaData) {
            return callBaleApi(token, 'sendMessage', { chat_id: chatId, text: caption })
                .then(resolve).catch(reject);
        }
        // Basic Text Fallback for Media in simplified mode
        callBaleApi(token, 'sendMessage', { chat_id: chatId, text: caption + "\n[فایل ضمیمه ارسال شد]" })
            .then(resolve).catch(reject);
    });
};

// --- KEYBOARD BUILDER (Matches Telegram) ---
const getKeyboardForUser = (role) => {
    const keyboard = [];
    
    if (['admin', 'ceo', 'financial', 'manager'].includes(role)) {
        keyboard.push([{ text: "💰 کارتابل پرداخت" }]);
    }
    
    const logisticsRow = [];
    if (['admin', 'ceo', 'factory_manager', 'sales_manager'].includes(role)) {
        logisticsRow.push({ text: "🚛 کارتابل خروج" });
    }
    if (['admin', 'ceo', 'warehouse_keeper'].includes(role)) {
        logisticsRow.push({ text: "📦 کارتابل بیجک" });
    }
    if (logisticsRow.length > 0) keyboard.push(logisticsRow);

    keyboard.push([{ text: "❓ راهنما" }, { text: "📊 گزارش کلی" }]);

    return {
        keyboard: keyboard,
        resize_keyboard: true
    };
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
            await callBaleApi(token, 'sendMessage', { 
                chat_id: chatId, 
                text: `⛔ عدم دسترسی.\nشناسه بله شما: ${userId}\nاین شناسه را به مدیر سیستم بدهید.` 
            });
        }
        return;
    }

    // Start Command (Show Menu)
    if (text === '/start' || text === 'منو') {
        await callBaleApi(token, 'sendMessage', { 
            chat_id: chatId, 
            text: `سلام ${user.fullName} 👋\nبرای استفاده از دکمه‌های زیر استفاده کنید:`,
            reply_markup: getKeyboardForUser(user.role)
        });
        return;
    }

    // --- PROCESS COMMANDS ---
    try {
        let filterRole = null;
        if (user.role === 'financial') filterRole = 'financial';
        if (user.role === 'manager') filterRole = 'manager';
        if (user.role === 'ceo') filterRole = 'ceo';

        const result = await parseMessage(text, db);
        if (result) {
            const { intent, args } = result;
            let replyText = '';

            switch (intent) {
                case 'REPORT_PAYMENT':
                    replyText = Actions.handlePaymentReport(db, filterRole);
                    break;
                case 'REPORT_EXIT':
                    replyText = Actions.handleExitReport(db);
                    break;
                case 'REPORT_BIJAK':
                    replyText = Actions.handleBijakReport(db);
                    break;
                case 'REPORT_GENERAL':
                    replyText = Actions.handleReport(db);
                    break;
                case 'AMBIGUOUS': replyText = `⚠️ شماره تکراری است. دقیق‌تر بنویسید (تایید پرداخت... یا تایید خروج...)`; break;
                case 'NOT_FOUND': replyText = `❌ سندی با شماره ${args.number} یافت نشد.`; break;
                case 'APPROVE_PAYMENT': replyText = Actions.handleApprovePayment(db, args.number); break;
                case 'REJECT_PAYMENT': replyText = Actions.handleRejectPayment(db, args.number); break;
                case 'APPROVE_EXIT': replyText = Actions.handleApproveExit(db, args.number); break;
                case 'REJECT_EXIT': replyText = Actions.handleRejectExit(db, args.number); break;
                case 'CREATE_PAYMENT': replyText = Actions.handleCreatePayment(db, args); break;
                case 'CREATE_BIJAK': replyText = Actions.handleCreateBijak(db, args); break;
                case 'HELP': replyText = `دستورات متنی:\nتایید [شماره]\nرد [شماره]\nگزارش`; break;
            }

            if (replyText) {
                await callBaleApi(token, 'sendMessage', { chat_id: chatId, text: replyText });
            }
        }
    } catch (e) {
        console.error("Bale Command Error:", e);
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
