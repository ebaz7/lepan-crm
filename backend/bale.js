
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '..', 'database.json');

let pollingActive = false;
let lastOffset = 0;
let currentToken = null;

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
            headers: { 'Content-Type': 'application/json' }
        };
        if (data) options.headers['Content-Length'] = Buffer.byteLength(JSON.stringify(data));

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(body);
                    resolve(parsed);
                } catch (e) { reject(e); }
            });
        });
        req.on('error', (e) => reject(e));
        if (data) req.write(JSON.stringify(data));
        req.end();
    });
};

export const sendBaleMessage = (token, chatId, caption, mediaData) => {
    // ... (Your existing send logic, no change needed here)
    // Keeping it brief for the update block
    return new Promise((resolve, reject) => {
        if (!token || !chatId) return reject(new Error('Token/ChatID missing'));
        callBaleApi(token, 'sendMessage', { chat_id: chatId, text: caption }).then(resolve).catch(reject);
    });
};

const handleCommand = async (token, update) => {
    const msg = update.message;
    if (!msg || !msg.text) return;
    console.log(`>>> 💬 Bale Msg from ${msg.chat.id}: ${msg.text}`); // LOG MSG
    
    // ... (Your command handling logic)
    if (msg.text === '/start') {
        await callBaleApi(token, 'sendMessage', { chat_id: msg.chat.id, text: "سلام! ربات بله فعال است." });
    }
};

// --- POLLING ---
const poll = async (token) => {
    if (!pollingActive) {
        console.log(">>> 🛑 Bale Polling Stopped.");
        return;
    }

    try {
        const response = await callBaleApi(token, 'getUpdates', { offset: lastOffset + 1 });
        if (response.ok && response.result.length > 0) {
            for (const update of response.result) {
                lastOffset = update.update_id;
                await handleCommand(token, update);
            }
        }
    } catch (e) {
        // Suppress timeout errors to keep console clean
        if (!e.message.includes('timeout')) console.error("Bale Error:", e.message);
    }

    if (pollingActive) {
        setTimeout(() => poll(token), 3000);
    }
};

export const initBaleBot = (token) => {
    if (!token) return;
    
    // If polling is already active with SAME token, ignore
    if (pollingActive && currentToken === token) return;
    
    // If polling active with DIFFERENT token (re-config), stop first
    if (pollingActive) {
        pollingActive = false;
        setTimeout(() => initBaleBot(token), 4000);
        return;
    }

    console.log("\n>>> 🟢 STARTING BALE BOT POLLING...");
    currentToken = token;
    pollingActive = true;
    poll(token);
    console.log(">>> 🚀 Bale Bot is Active!");
};

// --- RESTART FUNCTION ---
export const restartBaleBot = async (token) => {
    console.log("\n>>> ⚠️ FORCE RESTARTING BALE BOT...");
    
    // 1. Stop
    pollingActive = false;
    
    // 2. Wait
    return new Promise((resolve) => {
        setTimeout(() => {
            console.log(">>> 2. Restarting Bale Polling Loop...");
            initBaleBot(token);
            resolve(true);
        }, 3000);
    });
};
