
import TelegramBot from 'node-telegram-bot-api';
import * as BotCore from './bot-core.js';

let bot = null;

export const initTelegram = async (token) => {
    if (!token) return;
    if (bot) try { await bot.stopPolling(); } catch(e){}

    const requestOptions = { agentOptions: { keepAlive: true, family: 4 }, timeout: 30000 };
    if (process.env.PROXY_URL) requestOptions.proxy = process.env.PROXY_URL;

    try {
        bot = new TelegramBot(token, { polling: true, request: requestOptions });
        console.log(">>> Telegram Bot Started ✅");

        // Adapter Functions
        const sendFn = (id, txt, opts) => bot.sendMessage(id, txt, opts);
        const sendPhotoFn = (platform, id, buf, cap, opts) => bot.sendPhoto(id, buf, { caption: cap, ...opts });
        const sendDocFn = (id, buf, name, cap) => bot.sendDocument(id, buf, { caption: cap }, { filename: name });

        bot.on('message', (msg) => {
            if (!msg.text) return;
            BotCore.handleMessage('telegram', msg.chat.id, msg.text, sendFn, sendPhotoFn, sendDocFn);
        });

        bot.on('callback_query', (query) => {
            BotCore.handleCallback('telegram', query.message.chat.id, query.data, sendFn, sendPhotoFn);
            bot.answerCallbackQuery(query.id);
        });

    } catch (e) { console.error("Telegram Error", e); }
};
