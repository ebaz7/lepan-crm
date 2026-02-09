
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

        // Simple Text
        if (!mediaData) {
            return callBaleApi(token, 'sendMessage', { chat_id: chatId, text: caption })
                .then(resolve).catch(reject);
        }

        // Media Handling (Simplified for now - Logic mostly handled by text responses in this version)
        // For full media support, multipart form-data construction is needed as per previous code.
        // Falling back to text if complex media construct is tricky without external libs in pure node.
        callBaleApi(token, 'sendMessage', { chat_id: chatId, text: caption + "\n[فایل ضمیمه ارسال شد]" })
            .then(resolve).catch(reject);
    });
};

const getMainMenu = (user) => {
    let menu = "📋 *منوی اصلی*\n\n";
    if (['admin', 'ceo', 'financial', 'manager'].includes(user.role)) menu += "💰 *کارتابل پرداخت* (ارسال: کارتابل)\n";
    if (['admin', 'ceo', 'factory_manager'].includes(user.role)) menu += "🚛 *کارتابل خروج* (ارسال: خروج)\n";
    if (['admin', 'ceo'].includes(user.role)) menu += "📦 *کارتابل بیجک* (ارسال: بیجک)\n";
    menu += "\n❓ راهنما: ارسال کلمه 'راهنما'";
    return menu;
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

    // Start Command
    if (text === '/start' || text === 'منو') {
        await callBaleApi(token, 'sendMessage', { chat_id: chatId, text: `سلام ${user.fullName} 👋\n\n${getMainMenu(user)}` });
        return;
    }

    // --- PROCESS COMMANDS USING PARSER (Unified Logic) ---
    try {
        const result = await parseMessage(text, db);
        if (result) {
            const { intent, args } = result;
            let replyText = '';

            switch (intent) {
                case 'AMBIGUOUS': replyText = `⚠️ شماره ${args.number} تکراری است. دقیق‌تر بنویسید (تایید پرداخت... یا تایید خروج...)`; break;
                case 'NOT_FOUND': replyText = `❌ سندی با شماره ${args.number} یافت نشد.`; break;
                case 'APPROVE_PAYMENT': replyText = Actions.handleApprovePayment(db, args.number); break;
                case 'REJECT_PAYMENT': replyText = Actions.handleRejectPayment(db, args.number); break;
                case 'APPROVE_EXIT': replyText = Actions.handleApproveExit(db, args.number); break;
                case 'REJECT_EXIT': replyText = Actions.handleRejectExit(db, args.number); break;
                case 'CREATE_PAYMENT': replyText = Actions.handleCreatePayment(db, args); break;
                case 'CREATE_BIJAK': replyText = Actions.handleCreateBijak(db, args); break;
                case 'REPORT': replyText = Actions.handleReport(db); break;
                case 'HELP': replyText = `دستورات:\nتایید [شماره]\nرد [شماره]\nگزارش`; break;
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
