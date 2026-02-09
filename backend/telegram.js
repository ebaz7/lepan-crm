
import TelegramBot from 'node-telegram-bot-api';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '..', 'database.json');

let bot = null;
const userSessions = new Map();

// --- HELPERS ---
const getDb = () => {
    try {
        if (fs.existsSync(DB_PATH)) {
            return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
        }
    } catch (e) { console.error("DB Read Error", e); }
    return null;
};

const saveDb = (data) => {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
    } catch (e) { console.error("DB Write Error", e); }
};

const getUserByTelegramId = (db, chatId) => {
    return db.users.find(u => u.telegramChatId && u.telegramChatId.toString() === chatId.toString());
};

const safeAnswerCallback = async (queryId, options = {}) => {
    if (!bot) return;
    try {
        await bot.answerCallbackQuery(queryId, options);
    } catch (e) {
        // Ignore "query is too old" errors
    }
};

const getMainMenu = (user) => {
    // ... (Menu logic - simplified for brevity in this block, keeping original logic is fine)
    return {
        keyboard: [
            ['💰 ثبت پرداخت جدید', '🚛 ثبت خروج بار'],
            ['📦 صدور بیجک', '📊 گزارش وضعیت'],
            ['راهنما']
        ],
        resize_keyboard: true
    };
};

// --- INIT & RESTART ---
export const initTelegram = async (token) => {
    if (!token) return;
    
    console.log("\n>>> 🔵 STARTING TELEGRAM BOT...");

    // 1. Stop existing bot if running
    if (bot) {
        try { 
            console.log(">>> 🛑 Stopping previous Telegram instance...");
            await bot.stopPolling();
            await bot.close(); // Ensure connection closed
            console.log(">>> ✅ Previous Telegram instance stopped.");
        } catch(e) {
            console.warn(">>> Warning stopping Telegram:", e.message);
        }
        bot = null;
    }

    // 2. Start new instance
    try {
        bot = new TelegramBot(token, { 
            polling: true, // Enable polling immediately
            request: {
                agentOptions: { keepAlive: true, family: 4 },
                timeout: 30000 
            }
        });

        // Error Handlers
        bot.on('polling_error', (error) => {
            if (!error.message.includes('EFATAL') && !error.message.includes('ETIMEDOUT')) {
                console.log(`[Telegram Error] ${error.code}: ${error.message}`);
            }
        });
        
        console.log(">>> 🚀 Telegram Bot Started & Polling! ✅");

        // --- MESSAGE HANDLERS ---
        bot.on('message', async (msg) => {
            const chatId = msg.chat.id;
            const text = msg.text ? msg.text.trim() : '';
            console.log(`>>> 📩 Telegram Msg from ${chatId}: ${text}`); // LOG RECEIVED MESSAGE

            if (!text) return;
            const db = getDb();
            const user = getUserByTelegramId(db, chatId);

            if (!user) {
                return bot.sendMessage(chatId, `⛔ شما دسترسی ندارید. شناسه شما: ${chatId}\nلطفاً این شناسه را به مدیر سیستم بدهید.`);
            }

            if (text === '/start' || text === 'منو') {
                userSessions.delete(chatId);
                return bot.sendMessage(chatId, `سلام ${user.fullName} 👋\nبه سیستم مالی خوش آمدید.`, { reply_markup: getMainMenu(user) });
            }
            
            // ... (Your existing command logic here) ...
            if (text === '📊 گزارش وضعیت') {
                bot.sendMessage(chatId, "گزارش در حال آماده سازی...");
                // Add report logic
            }
        });

        // Callback Handler
        bot.on('callback_query', async (query) => {
            const chatId = query.message.chat.id;
            const data = query.data;
            console.log(`>>> 🖱️ Telegram Callback: ${data}`); // LOG CALLBACK

            const db = getDb();
            // ... (Your callback logic) ...
            await safeAnswerCallback(query.id);
        });

    } catch (e) { 
        console.error(">>> ❌ Telegram Init Error:", e.message); 
    }
};

export const sendMessage = async (chatId, text) => { if (bot && chatId) try { await bot.sendMessage(chatId, text); } catch (e) {} };
export const sendDocument = async (chatId, filePath, caption) => { if (bot && chatId) try { await bot.sendDocument(chatId, fs.createReadStream(filePath), { caption }); } catch (e) {} };
