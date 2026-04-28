
import https from 'https';
import FormData from 'form-data';
import * as BotCore from './bot-core.js';

let pollingActive = false;
let lastOffset = 0;
let botToken = null;

const callApi = (method, data, isMultipart = false) => {
    return new Promise((resolve, reject) => {
        if (!botToken) return reject("No Token");
        const options = {
            hostname: 'tapi.bale.ai',
            path: `/bot${botToken}/${method}`,
            method: 'POST',
            headers: isMultipart ? data.getHeaders() : { 'Content-Type': 'application/json' },
            timeout: 15000 // 15 seconds timeout
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', c => body += c);
            res.on('end', () => { try { resolve(JSON.parse(body)); } catch(e){ resolve({}); } });
        });

        req.on('error', (e) => reject(e));
        req.on('timeout', () => {
            req.destroy();
            reject(new Error("Request timeout"));
        });

        if (isMultipart) data.pipe(req);
        else {
            if(data) req.write(JSON.stringify(data));
            req.end();
        }
    });
};

export const initBaleBot = (token) => {
    if (!token) {
        pollingActive = false;
        botToken = null;
        return;
    }
    if (botToken === token && pollingActive) return;

    botToken = token;
    
    if (!pollingActive) {
        pollingActive = true;
        poll();
        console.log(">>> Bale Bot Started ✅");
    }

    // Try to set commands for Bale (similar to Telegram)
    callApi('setMyCommands', {
        commands: [
            { command: 'start', description: 'شروع و منوی اصلی' },
            { command: 'menu', description: 'نمایش منو' }
        ]
    }).catch(() => {});
};

const poll = async () => {
    if (!pollingActive) return;
    try {
        const res = await callApi('getUpdates', { offset: lastOffset + 1 });
        if (res.ok && res.result && res.result.length > 0) {
            for (const u of res.result) {
                lastOffset = u.update_id;
                
                const sendFn = (id, txt, opts) => callApi('sendMessage', { chat_id: id, text: txt, ...opts }).catch(e => console.error("Bale Send Err", e.message));
                
                const sendPhotoFn = (platform, id, buffer, caption, opts) => {
                    const form = new FormData();
                    form.append('chat_id', id);
                    form.append('photo', buffer, { filename: 'image.png' });
                    form.append('caption', caption);
                    if (opts && opts.reply_markup) form.append('reply_markup', JSON.stringify(opts.reply_markup));
                    return callApi('sendPhoto', form, true).catch(e => console.error("Bale Photo Err", e.message));
                };

                // FIXED: Ensure buffer is appended correctly with filename
                const sendDocFn = (id, buffer, name, caption) => {
                    const form = new FormData();
                    form.append('chat_id', id);
                    form.append('document', buffer, { filename: name || 'document.pdf' });
                    form.append('caption', caption || '');
                    return callApi('sendDocument', form, true).catch(e => console.error("Bale Doc Err", e.message));
                }

                try {
                    if (u.message && u.message.text) {
                        const text = u.message.text;
                        const chatId = u.message.chat.id;

                        // Allow /id in groups
                        if (text.startsWith('/id') || text === 'آیدی') {
                            sendFn(chatId, `🆔 شناسه این چت: ${chatId}`);
                            continue;
                        }

                        const hasActiveSession = BotCore.sessions[chatId] && BotCore.sessions[chatId].state !== 'IDLE';

                        // Ignore group messages unless it's a command or part of an active session
                        if (u.message.chat.type && u.message.chat.type !== 'private' && !text.startsWith('/') && !hasActiveSession) continue;
                        
                        await BotCore.handleMessage('bale', chatId, text, sendFn, sendPhotoFn, sendDocFn);
                    } else if (u.callback_query) {
                        const userId = u.callback_query.from ? u.callback_query.from.id : u.callback_query.message.chat.id;
                        await BotCore.handleCallback('bale', u.callback_query.message.chat.id, userId, u.callback_query.data, sendFn, sendPhotoFn, sendDocFn);
                    }
                } catch (err) {
                    console.error("Bale Message Handler Error:", err);
                }
            }
        }
    } catch (e) { /* Ignore poll errors */ }
    setTimeout(poll, 2000);
};

export const sendBotMessage = (chatId, text, opts) => {
    return callApi('sendMessage', { chat_id: chatId, text: text, ...opts });
};

export const sendBotPhoto = (chatId, buffer, caption, opts) => {
    const form = new FormData();
    form.append('chat_id', chatId);
    form.append('photo', buffer, { filename: 'image.png' });
    form.append('caption', caption);
    if (opts && opts.reply_markup) form.append('reply_markup', JSON.stringify(opts.reply_markup));
    return callApi('sendPhoto', form, true);
};
