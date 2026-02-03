import TelegramBot from 'node-telegram-bot-api';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';
import * as Actions from './whatsapp/actions.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '..', 'database.json');

let bot = null;
const userSessions = new Map();

const getDb = () => { try { if (fs.existsSync(DB_PATH)) return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); } catch (e) {} return null; };
const saveDb = (data) => { try { fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2)); } catch (e) {} };
const getUserByTelegramId = (db, chatId) => db.users.find(u => u.telegramChatId && u.telegramChatId.toString() === chatId.toString());
const fmt = (num) => new Intl.NumberFormat('fa-IR').format(num);
const generateUUID = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

const getMainMenu = (user) => {
    const keys = [];
    if (['admin', 'ceo', 'financial', 'manager', 'sales_manager'].includes(user.role)) keys.push(['➕ ثبت دستور پرداخت جدید']);
    const approvalRow = [];
    if (['admin', 'ceo', 'financial', 'manager'].includes(user.role)) approvalRow.push('💰 کارتابل پرداخت');
    if (approvalRow.length > 0) keys.push(approvalRow);
    const reportRow = ['💰 بایگانی دستور پرداخت'];
    if (user.canManageTrade || ['admin', 'ceo', 'manager'].includes(user.role)) reportRow.push('🌍 گزارشات بازرگانی');
    keys.push(reportRow);
    return { keyboard: keys, resize_keyboard: true };
};

export const initTelegram = (token) => {
    if (!token) return;
    bot = new TelegramBot(token, { polling: true });
    bot.on('message', async (msg) => {
        const chatId = msg.chat.id;
        const text = msg.text ? msg.text.trim() : '';
        const db = getDb();
        const user = getUserByTelegramId(db, chatId);
        if (text === '/start' || text === 'منو') {
            if (!user) return bot.sendMessage(chatId, "⛔ عدم دسترسی. شناسه: " + chatId);
            return bot.sendMessage(chatId, `سلام ${user.fullName} 👋`, { reply_markup: getMainMenu(user) });
        }
        if (text === '💰 کارتابل پرداخت') {
            const pending = db.orders.filter(o => o.status !== 'تایید نهایی' && o.status !== 'رد شده');
            if (pending.length === 0) return bot.sendMessage(chatId, "✅ کارتابل خالی است.");
            for (const o of pending) {
                bot.sendMessage(chatId, `💰 دستور پرداخت #${o.trackingNumber}\n👤 ذینفع: ${o.payee}\n💵 مبلغ: ${fmt(o.totalAmount)} ریال`, { reply_markup: { inline_keyboard: [[{ text: '✅ تایید', callback_data: `pay_approve_${o.trackingNumber}` }, { text: '❌ رد', callback_data: `pay_reject_${o.trackingNumber}` }]] } });
            }
        }
    });
    bot.on('callback_query', async (query) => {
        const db = getDb();
        const [type, action, num] = query.data.split('_');
        if (type === 'pay') {
            const result = action === 'approve' ? Actions.handleApprovePayment(db, num) : Actions.handleRejectPayment(db, num);
            bot.answerCallbackQuery(query.id, { text: result });
            bot.editMessageText(query.message.text + `\n\nنتیجه: ${result}`, { chat_id: query.message.chat.id, message_id: query.message.message_id });
        }
    });
};
