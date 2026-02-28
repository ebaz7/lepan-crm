
import wwebjs from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseMessage } from './whatsapp/parser.js';
import * as Actions from './whatsapp/actions.js';

const { Client, LocalAuth, MessageMedia } = wwebjs;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '..', 'database.json');

let client = null;
let isReady = false;
let qrCode = null;
let clientInfo = null;

const getDb = () => {
    try {
        if (fs.existsSync(DB_PATH)) return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    } catch (e) { console.error("DB Read Error", e); }
    return null;
};

export const initWhatsApp = (authDir) => {
    try {
        console.log(">>> Initializing WhatsApp Module...");
        const absoluteAuthDir = path.resolve(authDir);

        // --- PROXY CONFIG ---
        const puppeteerArgs = [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--no-first-run',
            '--no-zygote',
            '--single-process'
        ];

        if (process.env.PROXY_URL) {
            console.log(`>>> WhatsApp using Proxy: ${process.env.PROXY_URL}`);
            puppeteerArgs.push(`--proxy-server=${process.env.PROXY_URL}`);
        }

        client = new Client({ 
            authStrategy: new LocalAuth({ clientId: 'main_session', dataPath: absoluteAuthDir }), 
            puppeteer: {
                headless: true,
                args: puppeteerArgs,
                authTimeoutMs: 60000,
            }
        });

        client.on('qr', (qr) => { 
            qrCode = qr; 
            isReady = false;
            clientInfo = null;
            console.log("\n>>> WHATSAPP QR CODE RECEIVED (Scan below):");
            qrcode.generate(qr, { small: true }); 
        });
        
        client.on('authenticated', () => { console.log(">>> WhatsApp Authenticated ✅"); qrCode = null; });
        client.on('ready', () => { isReady = true; qrCode = null; clientInfo = client.info.wid.user; console.log(`>>> WhatsApp Ready! User: ${clientInfo} ✅`); });
        
        client.on('message', async msg => {
            try {
                const body = msg.body.trim();
                if (msg.from.includes('@g.us') && !body.startsWith('!')) return;
                
                const db = getDb();
                if (!db) return;

                const result = await parseMessage(body, db);
                if (!result) return;

                const { intent, args } = result;
                let replyText = '';

                switch (intent) {
                    case 'AMBIGUOUS': replyText = `⚠️ شماره ${args.number} تکراری است.`; break;
                    case 'NOT_FOUND': replyText = `❌ سندی با شماره ${args.number} یافت نشد.`; break;
                    case 'APPROVE_PAYMENT': replyText = Actions.handleApprovePayment(db, args.number); break;
                    case 'REJECT_PAYMENT': replyText = Actions.handleRejectPayment(db, args.number); break;
                    case 'APPROVE_EXIT': replyText = Actions.handleApproveExit(db, args.number); break;
                    case 'REJECT_EXIT': replyText = Actions.handleRejectExit(db, args.number); break;
                    case 'CREATE_PAYMENT': replyText = Actions.handleCreatePayment(db, args); break;
                    case 'CREATE_BIJAK': replyText = Actions.handleCreateBijak(db, args); break;
                    case 'REPORT': replyText = Actions.handleReport(db); break;
                    case 'HELP': replyText = `دستورات:\nتایید [شماره]\nرد [شماره]\nگزارش`; break;
                }

                if (replyText) msg.reply(replyText);

            } catch (error) { console.error("Message Error:", error); }
        });

        client.initialize().catch(e => console.error("WA Init Fail:", e.message));
    } catch (e) { console.error("WA Module Error:", e.message); }
};

export const getStatus = () => ({ ready: isReady, qr: qrCode, user: clientInfo });
export const logout = async () => { if (client) { await client.logout(); isReady = false; qrCode = null; } };
export const getGroups = async () => { if (!client || !isReady) return []; const chats = await client.getChats(); return chats.filter(c => c.isGroup).map(c => ({ id: c.id._serialized, name: c.name })); };
export const sendMessage = async (number, text, mediaData) => {
    if (!client || !isReady) throw new Error("WhatsApp not ready");
    let chatId = number.includes('@') ? number : `${number.replace(/\D/g, '').replace(/^0/, '98')}@c.us`;
    if (mediaData && mediaData.data) {
        const media = new MessageMedia(mediaData.mimeType, mediaData.data, mediaData.filename);
        await client.sendMessage(chatId, media, { caption: text || '' });
    } else if (text) await client.sendMessage(chatId, text);
};
export const restartSession = async (authDir) => {
    console.log(">>> FORCE RESTARTING WHATSAPP SESSION...");
    isReady = false; qrCode = null; clientInfo = null;
    if (client) { try { await client.destroy(); } catch (e) {} client = null; }
    setTimeout(() => { initWhatsApp(authDir); }, 3000);
};
