
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
            headers: isMultipart ? data.getHeaders() : { 'Content-Type': 'application/json' }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', c => body += c);
            res.on('end', () => { try { resolve(JSON.parse(body)); } catch(e){ resolve({}); } });
        });

        req.on('error', (e) => reject(e));

        if (isMultipart) data.pipe(req);
        else {
            if(data) req.write(JSON.stringify(data));
            req.end();
        }
    });
};

export const sendBaleMessage = async (chatId, text) => {
    if (!botToken || !chatId) return;
    try {
        await callApi('sendMessage', { chat_id: chatId, text: text });
    } catch (e) {
        console.error("Bale Send Msg Err:", e.message);
    }
};

export const initBaleBot = (token) => {
    if (!token) return;
    botToken = token;
    pollingActive = true;
    poll();
    console.log(">>> Bale Bot Started ✅");
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
                        await BotCore.handleMessage('bale', u.message.chat.id, u.message.text, sendFn, sendPhotoFn, sendDocFn);
                    } else if (u.callback_query) {
                        await BotCore.handleCallback('bale', u.callback_query.message.chat.id, u.callback_query.data, sendFn, sendPhotoFn, sendDocFn);
                    }
                } catch (err) {
                    console.error("Bale Message Handler Error:", err);
                }
            }
        }
    } catch (e) { /* Ignore poll errors */ }
    setTimeout(poll, 2000);
};
