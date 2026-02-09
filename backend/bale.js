
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '..', 'database.json');

// Global control flags
let pollingActive = false;
let pollingInstanceId = 0; // To track active loop instance
let lastOffset = 0;

// Helper to get DB
const getDb = () => {
    try {
        if (fs.existsSync(DB_PATH)) {
            return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
        }
    } catch (e) { console.error("DB Read Error", e); }
    return null;
};

// --- API WRAPPER ---

const callBaleApi = (token, method, data = null) => {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'tapi.bale.ai',
            port: 443,
            path: `/bot${token}/${method}`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        };

        if (data) {
            options.headers['Content-Length'] = Buffer.byteLength(JSON.stringify(data));
        }

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(body);
                    resolve(parsed);
                } catch (e) {
                    reject(e);
                }
            });
        });

        req.on('error', (e) => reject(e));
        if (data) req.write(JSON.stringify(data));
        req.end();
    });
};

export const sendBaleMessage = (token, chatId, caption, mediaData) => {
    return new Promise((resolve, reject) => {
        if (!token || !chatId) {
            return reject(new Error('Token or ChatID missing for Bale'));
        }

        // If simple text
        if (!mediaData) {
            return callBaleApi(token, 'sendMessage', { chat_id: chatId, text: caption })
                .then(resolve).catch(reject);
        }

        // If media (Manual Multipart)
        const isPhoto = mediaData.mimeType === 'image/png' || mediaData.mimeType === 'image/jpeg';
        const method = isPhoto ? 'sendPhoto' : 'sendDocument';
        const fileField = isPhoto ? 'photo' : 'document';
        
        const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
        const crlf = '\r\n';
        const buffer = Buffer.from(mediaData.data, 'base64');
        const filename = mediaData.filename || (isPhoto ? 'image.png' : 'file.pdf');

        const postDataStart = Buffer.concat([
            Buffer.from(`--${boundary}${crlf}Content-Disposition: form-data; name="chat_id"${crlf}${crlf}${chatId}${crlf}`),
            Buffer.from(`--${boundary}${crlf}Content-Disposition: form-data; name="caption"${crlf}${crlf}${caption}${crlf}`),
            Buffer.from(`--${boundary}${crlf}Content-Disposition: form-data; name="${fileField}"; filename="${filename}"${crlf}Content-Type: ${mediaData.mimeType}${crlf}${crlf}`)
        ]);
        
        const postDataEnd = Buffer.from(`${crlf}--${boundary}--${crlf}`);
        
        const options = {
            hostname: 'tapi.bale.ai',
            port: 443,
            path: `/bot${token}/${method}`,
            method: 'POST',
            headers: {
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
                'Content-Length': postDataStart.length + buffer.length + postDataEnd.length
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(body);
                    if (parsed.ok) resolve(parsed); else reject(new Error(parsed.description));
                } catch(e) { reject(e); }
            });
        });

        req.on('error', (e) => reject(e));
        req.write(postDataStart);
        req.write(buffer);
        req.write(postDataEnd);
        req.end();
    });
};

// --- REPORT GENERATION LOGIC ---

const getMainMenu = (user) => {
    let menu = "📋 *منوی اصلی*\n\n";
    if (['admin', 'ceo', 'financial', 'manager'].includes(user.role)) {
        menu += "💰 *کارتابل پرداخت* (ارسال: کارتابل)\n";
    }
    if (['admin', 'ceo', 'factory_manager'].includes(user.role)) {
        menu += "🚛 *کارتابل خروج* (ارسال: خروج)\n";
    }
    if (['admin', 'ceo'].includes(user.role)) {
        menu += "📦 *کارتابل بیجک* (ارسال: بیجک)\n";
    }
    menu += "\n❓ راهنما: ارسال کلمه 'راهنما'";
    return menu;
};

const handleCommand = async (token, update) => {
    const msg = update.message;
    if (!msg || !msg.text) return;

    const chatId = msg.chat.id;
    const text = msg.text.trim();
    const userId = msg.from.id; // Bale User ID

    // 1. Authenticate
    const db = getDb();
    if (!db) return;

    // Check if user exists in DB with this baleChatId
    const user = db.users.find(u => u.baleChatId && u.baleChatId.toString() === userId.toString());

    if (!user) {
        if (text === '/start') {
            await callBaleApi(token, 'sendMessage', { 
                chat_id: chatId, 
                text: `⛔ شما دسترسی ندارید.\nشناسه بله شما: ${userId}\nلطفاً این شناسه را به مدیر سیستم بدهید تا برای شما ثبت کند.` 
            });
        }
        return;
    }

    // 2. Process Commands
    if (text === '/start' || text === 'منو') {
        await callBaleApi(token, 'sendMessage', { chat_id: chatId, text: `سلام ${user.fullName} 👋\n\n${getMainMenu(user)}` });
        return;
    }

    // ... (Existing commands logic kept same) ...
    if (text === 'کارتابل') {
        // ... (Logic from previous code)
    }
};

// --- POLLING ---

const poll = async (token, instanceId) => {
    // Check if this instance is still the active one
    if (!pollingActive || instanceId !== pollingInstanceId) {
        console.log(`>>> Bale Polling Stopped (Instance ${instanceId})`);
        return;
    }

    try {
        const response = await callBaleApi(token, 'getUpdates', { offset: lastOffset + 1 });
        // @ts-ignore
        if (response.ok && response.result.length > 0) {
            // @ts-ignore
            for (const update of response.result) {
                lastOffset = update.update_id;
                await handleCommand(token, update);
            }
        }
    } catch (e) {
        // Suppress network errors logs
        // console.error("Bale Polling Error:", e.message);
    }

    // Schedule next poll
    if (pollingActive && instanceId === pollingInstanceId) {
        setTimeout(() => poll(token, instanceId), 3000);
    }
};

export const initBaleBot = (token) => {
    if (!token) return;
    
    // Stop any previous polling
    pollingActive = false;
    
    // Start new instance
    setTimeout(() => {
        console.log(">>> Starting Bale Bot Polling...");
        pollingActive = true;
        pollingInstanceId++; // Increment ID to invalidate old loops
        poll(token, pollingInstanceId);
    }, 1000);
};

// --- RESTART FUNCTION ---
export const restartBaleBot = (token) => {
    console.log(">>> Restarting Bale Bot...");
    pollingActive = false; // Kill loop
    
    // Wait for loop to naturally die then restart
    setTimeout(() => {
        initBaleBot(token);
    }, 2000);
};
