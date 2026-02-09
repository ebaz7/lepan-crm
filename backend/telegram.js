
import TelegramBot from 'node-telegram-bot-api';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as Actions from './whatsapp/actions.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '..', 'database.json');

let bot = null;
// Store user state for wizards
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

const fmt = (num) => new Intl.NumberFormat('fa-IR').format(num);
const generateUUID = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('fa-IR');
};

const formatCurrency = (val) => new Intl.NumberFormat('en-US').format(val);

// Safe Callback Answer to prevent crash on timeout
const safeAnswerCallback = async (queryId, options = {}) => {
    if (!bot) return;
    try {
        await bot.answerCallbackQuery(queryId, options);
    } catch (e) {
        if (!e.message.includes('query is too old')) {
             console.error("Callback Answer Error (Handled):", e.message);
        }
    }
};

// --- INIT ---
export const initTelegram = async (token) => {
    if (!token) return;
    
    console.log(">>> Initializing Telegram Bot...");

    // 1. CLEANUP PREVIOUS INSTANCE
    if (bot) {
        try { 
            console.log(">>> Stopping previous Telegram Bot instance...");
            await bot.stopPolling();
            await bot.close();
        } catch(e) {
            console.warn("Error stopping previous bot (non-fatal):", e.message);
        }
        bot = null;
        // Wait a small delay to ensure socket release
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    try {
        // 2. CREATE NEW INSTANCE
        bot = new TelegramBot(token, { 
            polling: true, // Auto-polling enabled
            request: {
                agentOptions: { keepAlive: true, family: 4 },
                timeout: 30000 
            }
        });

        bot.on('polling_error', (error) => {
            if (error.code === 'ETIMEDOUT' || error.code === 'EFATAL' || error.code === 'ECONNRESET') {
                // Ignore network errors logs to keep console clean
            } else {
                console.log(`[Telegram Polling Warning] ${error.code}: ${error.message}`);
            }
        });
        
        bot.on('error', (error) => {
            console.log(`[Telegram General Error] ${error.message}`);
        });
        
        console.log(">>> Telegram Bot Module Loaded & Polling ✅");

        // 3. ATTACH LISTENERS
        bot.on('message', async (msg) => {
            const chatId = msg.chat.id;
            const text = msg.text ? msg.text.trim() : '';
            if (!text) return;
            
            const db = getDb();
            const user = getUserByTelegramId(db, chatId);
            
            // Basic Auth Check
            if (text === '/start' || text === 'منو') {
                userSessions.delete(chatId);
                if (!user) return bot.sendMessage(chatId, "⛔ عدم دسترسی. شناسه شما در سیستم ثبت نشده است. ID: " + chatId);
                return bot.sendMessage(chatId, `سلام ${user.fullName} 👋\nربات به درستی متصل است.`);
            }
            
            // Simple Echo/Log for now as the full wizard logic resides in main app usually
            // but we ensure the connection is alive.
            if (!user) return;
            
            // ... (Your Wizard Logic can be expanded here if needed) ...
        });

        bot.on('callback_query', async (query) => {
            const chatId = query.message.chat.id;
            const data = query.data;
            const db = getDb();
            const user = getUserByTelegramId(db, chatId);

            if (!user) return safeAnswerCallback(query.id, { text: 'عدم دسترسی' });

            try {
                if (data.startsWith('approve_pay_')) {
                    const id = data.split('_')[2];
                    const order = db.orders.find(o => o.id === id);
                    if (order) {
                        if (order.status === 'در انتظار بررسی مالی') order.status = 'تایید مالی / در انتظار مدیریت';
                        else if (order.status === 'تایید مالی / در انتظار مدیریت') order.status = 'تایید مدیریت / در انتظار مدیرعامل';
                        else if (order.status === 'تایید مدیریت / در انتظار مدیرعامل') order.status = 'تایید نهایی';
                        saveDb(db);
                        await bot.sendMessage(chatId, `✅ دستور پرداخت ${order.trackingNumber} تایید شد.`);
                    }
                } else if (data.startsWith('reject_pay_')) {
                    const id = data.split('_')[2];
                    const order = db.orders.find(o => o.id === id);
                    if (order) {
                        order.status = 'رد شده';
                        saveDb(db);
                        await bot.sendMessage(chatId, `🚫 دستور پرداخت ${order.trackingNumber} رد شد.`);
                    }
                }
                await safeAnswerCallback(query.id);
            } catch (e) {
                console.error(e);
            }
        });

    } catch (e) { 
        console.error(">>> Telegram Init Error:", e.message); 
    }
};

export const sendMessage = async (chatId, text) => { 
    if (bot && chatId) {
        try { 
            await bot.sendMessage(chatId, text); 
        } catch (e) {
            console.error(`Telegram Send Error to ${chatId}:`, e.message);
        } 
    }
};

export const sendDocument = async (chatId, filePath, caption) => { 
    if (bot && chatId) {
        try { 
            await bot.sendDocument(chatId, fs.createReadStream(filePath), { caption }); 
        } catch (e) {
            console.error(`Telegram Document Error to ${chatId}:`, e.message);
        } 
    }
};
