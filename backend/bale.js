
import https from 'https';
import * as BotCore from './bot-core.js';

let pollingActive = false;
let lastOffset = 0;

const callApi = (token, method, data) => {
    return new Promise((resolve, reject) => {
        const req = https.request({
            hostname: 'tapi.bale.ai',
            path: `/bot${token}/${method}`,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, (res) => {
            let body = '';
            res.on('data', c => body += c);
            res.on('end', () => { try { resolve(JSON.parse(body)); } catch(e){ reject(e); } });
        });
        if(data) req.write(JSON.stringify(data));
        req.end();
    });
};

export const initBaleBot = (token) => {
    if (!token) return;
    pollingActive = true;
    poll(token);
    console.log(">>> Bale Bot Started ✅");
};

const poll = async (token) => {
    if (!pollingActive) return;
    try {
        const res = await callApi(token, 'getUpdates', { offset: lastOffset + 1 });
        if (res.ok && res.result.length > 0) {
            for (const u of res.result) {
                lastOffset = u.update_id;
                
                const sendFn = (id, txt, opts) => callApi(token, 'sendMessage', { chat_id: id, text: txt, ...opts });
                const sendPhotoFn = (p, id, buf, cap, opts) => { /* Basic photo not impl in pure node yet without formdata, fallback text */ sendFn(id, cap + "\n[تصویر ضمیمه]"); };

                if (u.message) {
                    BotCore.handleMessage('bale', u.message.chat.id, u.message.text, sendFn, sendPhotoFn);
                } else if (u.callback_query) {
                    BotCore.handleCallback('bale', u.callback_query.message.chat.id, u.callback_query.data, sendFn);
                }
            }
        }
    } catch (e) {}
    setTimeout(() => poll(token), 2000);
};
