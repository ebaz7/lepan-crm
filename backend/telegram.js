
import TelegramBot from 'node-telegram-bot-api';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseMessage } from './whatsapp/parser.js';
import * as Actions from './whatsapp/actions.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '..', 'database.json');

let bot = null;

const getDb = () => {
    try {
        if (fs.existsSync(DB_PATH)) return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    } catch (e) { console.error("DB Read Error", e); }
    return null;
};

const saveDb = (data) => {
    try { fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2)); } catch (e) { console.error("DB Write Error", e); }
};

const getUserByTelegramId = (db, chatId) => {
    return db.users.find(u => u.telegramChatId && u.telegramChatId.toString() === chatId.toString());
};

export const initTelegram = async (token) => {
    if (!token) return;
    console.log(">>> Initializing Telegram Bot...");

    if (bot) {
        try { await bot.stopPolling(); } catch(e){}
        bot = null;
    }

    // --- PROXY CONFIGURATION ---
    const requestOptions = {
        agentOptions: { keepAlive: true, family: 4 },
        timeout: 30000 
    };

    // Check for Proxy in Environment Variables
    if (process.env.PROXY_URL) {
        console.log(`>>> Telegram using Proxy: ${process.env.PROXY_URL}`);
        requestOptions.proxy = process.env.PROXY_URL;
    }

    try {
        bot = new TelegramBot(token, { 
            polling: true, 
            request: requestOptions
        });

        bot.on('polling_error', (error) => {
            if (!['ETIMEDOUT','EFATAL','ECONNRESET'].includes(error.code)) {
                console.log(`[Telegram Error] ${error.code}: ${error.message}`);
            }
        });
        
        console.log(">>> Telegram Bot Module Loaded ✅");

        bot.on('message', async (msg) => {
            const chatId = msg.chat.id;
            const text = msg.text ? msg.text.trim() : '';
            if (!text) return;
            
            const db = getDb();
            const user = getUserByTelegramId(db, chatId);
            
            if (text === '/start' || text === 'منو') {
                if (!user) return bot.sendMessage(chatId, "⛔ عدم دسترسی. شناسه شما: " + chatId);
                return bot.sendMessage(chatId, `سلام ${user.fullName} 👋\n\nدستوراتی مثل 'تایید 1001' یا 'گزارش' را ارسال کنید.`);
            }
            
            if (!user) return;

            // --- UNIFIED LOGIC ---
            try {
                const result = await parseMessage(text, db);
                if (result) {
                    const { intent, args } = result;
                    let replyText = '';

                    switch (intent) {
                        case 'AMBIGUOUS': replyText = `⚠️ شماره تکراری است. (تایید پرداخت... / تایید خروج...)`; break;
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

                    if (replyText) bot.sendMessage(chatId, replyText);
                }
            } catch (e) { console.error(e); }
        });

    } catch (e) { 
        console.error(">>> Telegram Init Error:", e.message); 
    }
};

export const sendMessage = async (chatId, text) => { 
    if (bot && chatId) {
        try { await bot.sendMessage(chatId, text); } catch (e) {} 
    }
};
