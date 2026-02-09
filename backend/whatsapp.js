
import wwebjs from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// IMPORT NEW MODULES
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

// --- HELPERS ---
const getDb = () => {
    try {
        if (fs.existsSync(DB_PATH)) {
            return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
        }
    } catch (e) { console.error("DB Read Error", e); }
    return null;
};

// --- WHATSAPP CLIENT ---
export const initWhatsApp = (authDir) => {
    try {
        console.log(">>> Initializing WhatsApp Module...");

        // Ensure auth path is absolute
        const absoluteAuthDir = path.resolve(authDir);

        client = new Client({ 
            authStrategy: new LocalAuth({ 
                clientId: 'main_session', 
                dataPath: absoluteAuthDir
            }), 
            puppeteer: {
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--no-first-run',
                    '--no-zygote',
                    '--single-process'
                ],
                authTimeoutMs: 60000,
            },
            webVersionCache: {
                type: 'remote',
                remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
            }
        });

        // 1. QR GENERATION
        client.on('qr', (qr) => { 
            qrCode = qr; 
            isReady = false;
            clientInfo = null;
            console.log("\n>>> WHATSAPP QR CODE RECEIVED (Scan below):");
            // IMPORTANT: Print to CMD for user
            qrcode.generate(qr, { small: true }); 
        });
        
        // 2. AUTHENTICATED
        client.on('authenticated', () => {
            console.log(">>> WhatsApp Authenticated Successfully (Session Restored) ✅");
            qrCode = null; // Clear QR
        });

        // 3. READY
        client.on('ready', () => { 
            isReady = true; 
            qrCode = null; 
            clientInfo = client.info.wid.user; 
            console.log(`>>> WhatsApp Client Ready! User: ${clientInfo} ✅`); 
        });

        client.on('auth_failure', msg => {
            console.error('>>> WhatsApp Auth Failure:', msg);
            isReady = false;
        });

        client.on('disconnected', (reason) => {
            console.log('>>> WhatsApp Disconnected:', reason);
            isReady = false;
            client = null;
            clientInfo = null;
        });

        client.on('message', async msg => {
            try {
                const body = msg.body.trim();
                // Ignore group messages unless they start with !
                if (msg.from.includes('@g.us') && !body.startsWith('!')) return;
                
                const db = getDb();
                if (!db) return;

                if (body === '!راهنما' || body === 'راهنما') {
                    msg.reply(`🤖 *راهنمای دستورات*\n\n✅ *تایید دستورات:*\n"تایید پرداخت [شماره]"\n"تایید خروج [شماره]"\n\n💰 *ثبت پرداخت کامل:*\n"دستور پرداخت [مبلغ] به [نام] بابت [شرح] بانک [نام بانک]"\n\n🚛 *ثبت بیجک کامل:*\n"بیجک [تعداد] [کالا] برای [گیرنده] راننده [نام] پلاک [شماره]"\n\n📊 *گزارش کامل:* "گزارش"`);
                    return;
                }

                const result = await parseMessage(body, db);
                if (!result) return;

                const { intent, args } = result;
                let replyText = '';

                switch (intent) {
                    case 'AMBIGUOUS': replyText = `⚠️ شماره ${args.number} تکراری است. لطفا مشخص کنید:\n"تایید پرداخت ${args.number}" یا "تایید خروج ${args.number}"`; break;
                    case 'NOT_FOUND': replyText = `❌ سندی با شماره ${args.number} یافت نشد.`; break;
                    case 'APPROVE_PAYMENT': replyText = Actions.handleApprovePayment(db, args.number); break;
                    case 'REJECT_PAYMENT': replyText = Actions.handleRejectPayment(db, args.number); break;
                    case 'APPROVE_EXIT': replyText = Actions.handleApproveExit(db, args.number); break;
                    case 'REJECT_EXIT': replyText = Actions.handleRejectExit(db, args.number); break;
                    case 'CREATE_PAYMENT': replyText = Actions.handleCreatePayment(db, args); break;
                    case 'CREATE_BIJAK': replyText = Actions.handleCreateBijak(db, args); break;
                    case 'REPORT': replyText = Actions.handleReport(db); break;
                }

                if (replyText) msg.reply(replyText);

            } catch (error) { console.error("Message Error:", error); }
        });

        client.initialize().catch(e => {
            console.error("WA Init Fail (Client):", e.message);
        });
    } catch (e) { console.error("WA Module Error:", e.message); }
};

export const getStatus = () => ({ ready: isReady, qr: qrCode, user: clientInfo });

export const logout = async () => { 
    if (client) { 
        await client.logout(); 
        isReady = false; 
        qrCode = null; 
        clientInfo = null; 
    } 
};

export const getGroups = async () => { 
    if (!client || !isReady) return []; 
    const chats = await client.getChats(); 
    return chats.filter(c => c.isGroup).map(c => ({ id: c.id._serialized, name: c.name })); 
};

export const sendMessage = async (number, text, mediaData) => {
    if (!client || !isReady) throw new Error("WhatsApp not ready");
    let chatId = number.includes('@') ? number : `${number.replace(/\D/g, '').replace(/^0/, '98')}@c.us`;
    if (mediaData && mediaData.data) {
        const media = new MessageMedia(mediaData.mimeType, mediaData.data, mediaData.filename);
        await client.sendMessage(chatId, media, { caption: text || '' });
    } else if (text) await client.sendMessage(chatId, text);
};

// --- RESTART FUNCTION (Full Reset) ---
export const restartSession = async (authDir) => {
    console.log(">>> FORCE RESTARTING WHATSAPP SESSION...");
    
    // 1. Reset State
    isReady = false;
    qrCode = null;
    clientInfo = null;

    if (client) {
        try {
            console.log(">>> Destroying previous client...");
            // Use timeout to prevent hang if browser is unresponsive
            await Promise.race([
                client.destroy(),
                new Promise(resolve => setTimeout(resolve, 5000))
            ]);
        } catch (destErr) {
            console.warn("Client destroy warning (ignored):", destErr.message);
        }
        client = null;
    }
    
    // 2. Wait for resources to free up
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 3. Start New
    console.log(">>> Starting new WhatsApp instance...");
    initWhatsApp(authDir);
};
