
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

const getUserByTelegramId = (db, chatId) => {
    return db.users.find(u => u.telegramChatId && u.telegramChatId.toString() === chatId.toString());
};

// --- DYNAMIC KEYBOARD BUILDER ---
const getKeyboardForUser = (role) => {
    const keyboard = [];
    
    // Row 1: Payments
    if (['admin', 'ceo', 'financial', 'manager'].includes(role)) {
        keyboard.push([{ text: "💰 کارتابل پرداخت" }]);
    }
    
    // Row 2: Logistics
    const logisticsRow = [];
    if (['admin', 'ceo', 'factory_manager', 'sales_manager'].includes(role)) {
        logisticsRow.push({ text: "🚛 کارتابل خروج" });
    }
    if (['admin', 'ceo', 'warehouse_keeper'].includes(role)) {
        logisticsRow.push({ text: "📦 کارتابل بیجک" });
    }
    if (logisticsRow.length > 0) keyboard.push(logisticsRow);

    // Row 3: Utility
    keyboard.push([{ text: "❓ راهنما" }, { text: "📊 گزارش کلی" }]);

    return {
        keyboard: keyboard,
        resize_keyboard: true,
        one_time_keyboard: false
    };
};

export const initTelegram = async (token) => {
    if (!token) return;
    console.log(">>> Initializing Telegram Bot...");

    if (bot) {
        try { await bot.stopPolling(); } catch(e){}
        bot = null;
    }

    const requestOptions = {
        agentOptions: { keepAlive: true, family: 4 },
        timeout: 30000 
    };

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
            
            // Check Auth
            if (!user) {
                if (text === '/start') {
                    return bot.sendMessage(chatId, `⛔ عدم دسترسی.\nشناسه تلگرام شما: ${chatId}\nاین شناسه را به مدیر سیستم بدهید.`);
                }
                return;
            }

            // Handle /start (Show Menu)
            if (text === '/start' || text === 'منو') {
                return bot.sendMessage(chatId, `سلام ${user.fullName} 👋\nبه سیستم مدیریت خوش آمدید.`, {
                    reply_markup: getKeyboardForUser(user.role)
                });
            }

            // --- PROCESS COMMANDS (Using Unified Parser) ---
            try {
                // Determine user specific cartable filter
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
                            replyText = Actions.handleExitReport(db); // Add logic in actions.js if needed
                            break;
                        case 'REPORT_BIJAK':
                            replyText = Actions.handleBijakReport(db); // Add logic in actions.js if needed
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
