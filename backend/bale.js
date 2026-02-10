
import https from 'https';
import FormData from 'form-data';
import * as BotCore from './bot-core.js';

let pollingActive = false;
let lastOffset = 0;
let botToken = null;

const callApi = (method, data, isMultipart = false) => {
    return new Promise((resolve, reject) => {
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
                
                // Adapter Functions
                const sendFn = (id, txt, opts) => callApi('sendMessage', { chat_id: id, text: txt, ...opts });
                
                const sendPhotoFn = (platform, id, buffer, caption, opts) => {
                    const form = new FormData();
                    form.append('chat_id', id);
                    form.append('photo', buffer, { filename: 'image.png' });
                    form.append('caption', caption);
                    if (opts && opts.reply_markup) form.append('reply_markup', JSON.stringify(opts.reply_markup));
                    return callApi('sendPhoto', form, true);
                };

                const sendDocFn = (id, buffer, name, caption) => {
                    const form = new FormData();
                    form.append('chat_id', id);
                    form.append('document', buffer, { filename: name });
                    form.append('caption', caption);
                    return callApi('sendDocument', form, true);
                }

                if (u.message && u.message.text) {
                    BotCore.handleMessage('bale', u.message.chat.id, u.message.text, sendFn, sendPhotoFn, sendDocFn);
                } else if (u.callback_query) {
                    BotCore.handleCallback('bale', u.callback_query.message.chat.id, u.callback_query.data, sendFn, sendPhotoFn);
                }
            }
        }
    } catch (e) { /* Ignore poll errors */ }
    setTimeout(poll, 2000);
};
