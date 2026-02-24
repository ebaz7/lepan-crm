
import TelegramBot from 'node-telegram-bot-api';
import * as BotCore from './bot-core.js';

let bot = null;

export const sendTelegramMessage = async (chatId, text) => {
    if (!bot || !chatId) return;
    try {
        await bot.sendMessage(chatId, text);
    } catch (e) {
        console.error("TG Send Msg Err:", e.message);
    }
};

export const initTelegram = async (token) => {
    if (!token) return;
    if (bot) try { await bot.stopPolling(); } catch(e){}

    const requestOptions = { agentOptions: { keepAlive: true, family: 4 }, timeout: 30000 };
    if (process.env.PROXY_URL) requestOptions.proxy = process.env.PROXY_URL;

    try {
        bot = new TelegramBot(token, { polling: true, request: requestOptions });
        console.log(">>> Telegram Bot Started ✅");

        const sendFn = (id, txt, opts) => bot.sendMessage(id, txt, opts).catch(e => console.error("TG Send Err:", e.message));
        const sendPhotoFn = (platform, id, buf, cap, opts) => bot.sendPhoto(id, buf, { caption: cap, ...opts }).catch(e => console.error("TG Photo Err:", e.message));
        
        // FIXED: Ensure options { filename } is passed as fileOptions
        const sendDocFn = (id, buf, name, cap) => {
            return bot.sendDocument(id, buf, { caption: cap }, { filename: name })
                .catch(e => {
                    console.error("TG Doc Err:", e.message);
                    throw e; // Propagate error for Core to handle
                });
        };

        bot.on('message', async (msg) => {
            try {
                if (!msg.text) return;
                await BotCore.handleMessage('telegram', msg.chat.id, msg.text, sendFn, sendPhotoFn, sendDocFn);
            } catch (e) {
                console.error("TG Msg Handle Error:", e);
                bot.sendMessage(msg.chat.id, "⚠️ خطا در پردازش درخواست.").catch(()=>{});
            }
        });

        bot.on('callback_query', async (query) => {
            try {
                await BotCore.handleCallback('telegram', query.message.chat.id, query.data, sendFn, sendPhotoFn, sendDocFn);
                await bot.answerCallbackQuery(query.id);
            } catch (e) {
                console.error("TG Callback Handle Error:", e);
                bot.answerCallbackQuery(query.id).catch(()=>{});
            }
        });
        
        bot.on('polling_error', (error) => {
            console.error(`[Telegram Polling Error] ${error.code}: ${error.message}`);
        });

    } catch (e) { console.error("Telegram Init Error", e); }
};
