
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

        bot.on('message', (msg) => {
            const chatId = msg.chat.id;
            const text = msg.text || '';
            
            // Standard Send Function Wrapper
            const sendFn = (id, txt, opts) => bot.sendMessage(id, txt, opts);
            const sendPhotoFn = (p, id, buf, cap, opts) => bot.sendPhoto(id, buf, { caption: cap, reply_markup: opts });

            BotCore.handleMessage('telegram', chatId, text, sendFn, sendPhotoFn);
        });

        bot.on('callback_query', (query) => {
            const chatId = query.message.chat.id;
            const data = query.data;
            const sendFn = (id, txt, opts) => bot.sendMessage(id, txt, opts);
            
            BotCore.handleCallback('telegram', chatId, data, sendFn);
            bot.answerCallbackQuery(query.id);
        });

    } catch (e) { console.error("Telegram Error", e); }
};

export const sendTelegramMessage = (chatId, text, opts) => { if(bot) bot.sendMessage(chatId, text, opts); };
export const sendTelegramPhoto = (chatId, buffer, caption, opts) => { if(bot) bot.sendPhoto(chatId, buffer, { caption, ...opts }); };
