
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '..', 'database.json');

let pollingActive = false;
let lastOffset = 0;
let pollingTimeout = null;

const getDb = () => {
    try {
        if (fs.existsSync(DB_PATH)) return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    } catch (e) { console.error("DB Read Error", e); }
    return null;
};

const saveDb = (data) => {
    try { fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2)); } catch (e) {}
};

const callBaleApi = (token, method, data = null) => {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'tapi.bale.ai',
            port: 443,
            path: `/bot${token}/${method}`,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        };
        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
            });
        });
        req.on('error', e => reject(e));
        if (data) req.write(JSON.stringify(data));
        req.end();
    });
};

// --- ACTION LOGIC (Shared with Telegram logic structure) ---
const handleApproval = (type, id, action, user) => {
    const db = getDb();
    if (!db) return "خطای دیتابیس";
    
    if (type === 'pay') {
        const order = db.orders.find(o => o.trackingNumber == id);
        if (!order) return "سند یافت نشد";
        
        if (action === 'approve') {
            if (order.status === 'در انتظار بررسی مالی') order.status = 'تایید مالی / در انتظار مدیریت';
            else if (order.status === 'تایید مالی / در انتظار مدیریت') order.status = 'تایید مدیریت / در انتظار مدیرعامل';
            else if (order.status === 'تایید مدیریت / در انتظار مدیرعامل') order.status = 'تایید نهایی';
            else return "این مرحله قبلا انجام شده است.";
            saveDb(db);
            return `✅ دستور پرداخت ${id} تایید شد.`;
        } else {
            order.status = 'رد شده';
            saveDb(db);
            return `❌ دستور پرداخت ${id} رد شد.`;
        }
    }
    
    if (type === 'exit') {
        const permit = db.exitPermits.find(p => p.permitNumber == id);
        if (!permit) return "مجوز یافت نشد";
        
        if (action === 'approve') {
            if (permit.status === 'در انتظار تایید مدیرعامل') permit.status = 'تایید مدیرعامل / در انتظار خروج (کارخانه)';
            else if (permit.status === 'تایید مدیرعامل / در انتظار خروج (کارخانه)') permit.status = 'خارج شده (بایگانی)';
            else return "وضعیت قابل تغییر نیست.";
            saveDb(db);
            return `✅ مجوز خروج ${id} تایید شد.`;
        } else {
            permit.status = 'رد شده';
            saveDb(db);
            return `❌ مجوز خروج ${id} رد شد.`;
        }
    }
    
    return "دستور نامعتبر";
};

// --- COMMAND HANDLER ---
const handleUpdate = async (token, update) => {
    // 1. Handle Text Commands
    if (update.message && update.message.text) {
        const chatId = update.message.chat.id;
        const userId = update.message.from.id;
        const text = update.message.text.trim();
        const db = getDb();
        const user = db.users.find(u => u.baleChatId && u.baleChatId.toString() === userId.toString());

        if (!user) {
            if (text === '/start') await callBaleApi(token, 'sendMessage', { chat_id: chatId, text: `⛔ شناسه شما: ${userId}\nبرای دسترسی با مدیر تماس بگیرید.` });
            return;
        }

        if (text === '/start' || text === 'منو') {
            const keys = [];
            // Build dynamic keyboard based on role
            if (['admin', 'ceo', 'financial', 'manager'].includes(user.role)) keys.push([{ text: "💰 کارتابل پرداخت", callback_data: "list_pay" }]);
            if (['admin', 'ceo', 'factory_manager'].includes(user.role)) keys.push([{ text: "🚛 کارتابل خروج", callback_data: "list_exit" }]);
            
            await callBaleApi(token, 'sendMessage', { 
                chat_id: chatId, 
                text: `سلام ${user.fullName} 👋\nبه بات سیستم مالی خوش آمدید.`,
                reply_markup: { inline_keyboard: keys }
            });
        }
    }

    // 2. Handle Callbacks (Buttons)
    if (update.callback_query) {
        const chatId = update.callback_query.message.chat.id;
        const data = update.callback_query.data;
        const userId = update.callback_query.from.id;
        const db = getDb();
        const user = db.users.find(u => u.baleChatId && u.baleChatId.toString() === userId.toString());

        if (data === 'list_pay') {
            let pending = [];
            if (user.role === 'financial') pending = db.orders.filter(o => o.status === 'در انتظار بررسی مالی');
            else if (user.role === 'manager') pending = db.orders.filter(o => o.status === 'تایید مالی / در انتظار مدیریت');
            else if (user.role === 'ceo') pending = db.orders.filter(o => o.status === 'تایید مدیریت / در انتظار مدیرعامل');
            else if (user.role === 'admin') pending = db.orders.filter(o => o.status !== 'تایید نهایی');

            if (pending.length === 0) {
                await callBaleApi(token, 'sendMessage', { chat_id: chatId, text: "✅ کارتابل پرداخت خالی است." });
            } else {
                for (const o of pending) {
                    const msg = `💰 *پرداخت #${o.trackingNumber}*\n👤 ${o.payee}\n💵 ${new Intl.NumberFormat('fa-IR').format(o.totalAmount)} ریال\n📝 ${o.description}`;
                    await callBaleApi(token, 'sendMessage', {
                        chat_id: chatId,
                        text: msg,
                        reply_markup: { inline_keyboard: [[{text: "✅ تایید", callback_data: `act_pay_approve_${o.trackingNumber}`}, {text: "❌ رد", callback_data: `act_pay_reject_${o.trackingNumber}`}]] }
                    });
                }
            }
        }

        if (data === 'list_exit') {
            let pending = [];
            if (user.role === 'ceo') pending = db.exitPermits.filter(p => p.status === 'در انتظار تایید مدیرعامل');
            else if (user.role === 'factory_manager') pending = db.exitPermits.filter(p => p.status === 'تایید مدیرعامل / در انتظار خروج (کارخانه)');
            else if (user.role === 'admin') pending = db.exitPermits.filter(p => p.status !== 'خارج شده (بایگانی)');

            if (pending.length === 0) {
                await callBaleApi(token, 'sendMessage', { chat_id: chatId, text: "✅ کارتابل خروج خالی است." });
            } else {
                for (const p of pending) {
                    const msg = `🚛 *خروج #${p.permitNumber}*\n👤 ${p.recipientName}\n📦 ${p.goodsName}`;
                    await callBaleApi(token, 'sendMessage', {
                        chat_id: chatId,
                        text: msg,
                        reply_markup: { inline_keyboard: [[{text: "✅ تایید", callback_data: `act_exit_approve_${p.permitNumber}`}, {text: "❌ رد", callback_data: `act_exit_reject_${p.permitNumber}`}]] }
                    });
                }
            }
        }

        if (data.startsWith('act_')) {
            const parts = data.split('_'); // act, type, action, id
            const type = parts[1];
            const action = parts[2];
            const id = parts[3];
            const result = handleApproval(type, id, action, user);
            await callBaleApi(token, 'sendMessage', { chat_id: chatId, text: result });
        }
    }
};

const poll = async (token) => {
    if (!pollingActive) return;
    try {
        const res = await callBaleApi(token, 'getUpdates', { offset: lastOffset + 1 });
        if (res.ok && res.result.length > 0) {
            for (const update of res.result) {
                lastOffset = update.update_id;
                await handleUpdate(token, update);
            }
        }
    } catch (e) { console.error("Bale Poll Error", e.message); }
    pollingTimeout = setTimeout(() => poll(token), 2000);
};

export const stopBale = () => {
    pollingActive = false;
    if (pollingTimeout) clearTimeout(pollingTimeout);
    console.log(">>> Bale Bot Stopped.");
};

export const initBaleBot = (token) => {
    if (!token) return;
    if (pollingActive) stopBale(); // Reset if already running

    console.log(">>> Bale Bot Started 🚀");
    pollingActive = true;
    poll(token);
};
