
import 'dotenv/config'; 
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import compression from 'compression'; 
import { fileURLToPath } from 'url';
import cron from 'node-cron'; 

// --- STATIC IMPORTS FOR BOTS ---
import * as TelegramBotModule from './backend/telegram.js';
import * as BaleBotModule from './backend/bale.js';
import * as WhatsAppModule from './backend/whatsapp.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = __dirname; 

const DB_FILE = path.join(ROOT_DIR, 'database.json');
const UPLOADS_DIR = path.join(ROOT_DIR, 'uploads');
const BACKUPS_DIR = path.join(ROOT_DIR, 'backups'); 
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const WAUTH_DIR = path.join(ROOT_DIR, 'wauth');

const LOG_FILE = path.join(ROOT_DIR, 'service_debug.log');
const logToFile = (msg) => {
    const timestamp = new Date().toISOString();
    const logMsg = `[${timestamp}] ${msg}\n`;
    try { fs.appendFileSync(LOG_FILE, logMsg); } catch(e){}
    process.stdout.write(logMsg);
};

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(BACKUPS_DIR)) fs.mkdirSync(BACKUPS_DIR, { recursive: true });
if (!fs.existsSync(WAUTH_DIR)) fs.mkdirSync(WAUTH_DIR, { recursive: true });

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors()); 
app.use(compression()); 
app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use('/uploads', express.static(UPLOADS_DIR));

// --- DB HELPERS ---
const DEFAULT_DB = { 
    settings: { currentTrackingNumber: 1000, currentExitPermitNumber: 1000, companyNames: [], companies: [], rolePermissions: {}, customRoles: [], operatingBankNames: [], commodityGroups: [], warehouseSequences: {}, companyNotifications: {}, insuranceCompanies: [], printTemplates: [], dailySecurityMeta: {}, savedContacts: [] }, 
    orders: [], exitPermits: [], warehouseItems: [], warehouseTransactions: [], tradeRecords: [], messages: [], groups: [], tasks: [], securityLogs: [], personnelDelays: [], securityIncidents: [], 
    users: [{ id: '1', username: 'admin', password: '123', fullName: 'مدیر سیستم', role: 'admin' }]
};

const sanitizeDb = (data) => {
    if (!data || typeof data !== 'object') return { ...DEFAULT_DB };
    const cleanData = { ...DEFAULT_DB };
    if (data.settings) cleanData.settings = { ...DEFAULT_DB.settings, ...data.settings };
    const arrayKeys = ['orders', 'exitPermits', 'warehouseItems', 'warehouseTransactions', 'tradeRecords', 'messages', 'groups', 'tasks', 'securityLogs', 'personnelDelays', 'securityIncidents', 'users'];
    arrayKeys.forEach(key => { if (Array.isArray(data[key])) cleanData[key] = data[key]; else cleanData[key] = []; });
    return cleanData;
};

const getDb = () => {
    try {
        if (!fs.existsSync(DB_FILE)) { const newDb = { ...DEFAULT_DB }; saveDb(newDb); return newDb; }
        const data = fs.readFileSync(DB_FILE, 'utf8');
        if (!data.trim()) return { ...DEFAULT_DB };
        return sanitizeDb(JSON.parse(data));
    } catch (e) { logToFile(`❌ DB Read Failed: ${e.message}`); return { ...DEFAULT_DB }; }
};

const saveDb = (data) => {
    try {
        const safeData = sanitizeDb(data);
        const tempFile = `${DB_FILE}.tmp`;
        fs.writeFileSync(tempFile, JSON.stringify(safeData, null, 2));
        fs.renameSync(tempFile, DB_FILE);
    } catch (e) { logToFile(`❌ DB Save Failed: ${e.message}`); }
};

const calculateNextNumber = (db, type, companyName = null) => {
    let max = 0;
    const safeCompany = companyName ? companyName.trim() : (db.settings.defaultCompany || '');
    if (type === 'payment') { max = db.settings.currentTrackingNumber || 1000; return max + 1; }
    else if (type === 'exit') { max = db.settings.currentExitPermitNumber || 1000; return max + 1; }
    else if (type === 'bijak') { const seq = db.settings.warehouseSequences?.[safeCompany] || 1000; return seq; }
    return 1001;
};

// ================= API ROUTES & NOTIFICATIONS =================

app.post('/api/restart-bot', async (req, res) => {
    const { type } = req.body;
    try {
        const db = getDb(); 
        if (type === 'telegram') { await TelegramBotModule.initTelegram(db.settings.telegramBotToken); } 
        else if (type === 'bale') { await BaleBotModule.restartBaleBot(db.settings.baleBotToken); } 
        else if (type === 'whatsapp') { await WhatsAppModule.restartSession(WAUTH_DIR); } 
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/version', (req, res) => res.json({ version: Date.now().toString() }));
app.post('/api/login', (req, res) => { const db = getDb(); const u = db.users.find(x => x.username === req.body.username && x.password === req.body.password); u ? res.json(u) : res.status(401).send('Invalid'); });
app.get('/api/settings', (req, res) => res.json(getDb().settings));
app.post('/api/settings', (req, res) => { const db = getDb(); db.settings = { ...db.settings, ...req.body }; saveDb(db); res.json(db.settings); });
app.get('/api/users', (req, res) => res.json(getDb().users));
app.post('/api/users', (req, res) => { const db = getDb(); db.users.push(req.body); saveDb(db); res.json(db.users); });
app.put('/api/users/:id', (req, res) => { const db = getDb(); const idx = db.users.findIndex(u => u.id === req.params.id); if(idx > -1) { db.users[idx] = { ...db.users[idx], ...req.body }; saveDb(db); res.json(db.users); } else res.status(404).send('Not Found'); });
app.delete('/api/users/:id', (req, res) => { const db = getDb(); db.users = db.users.filter(u => u.id !== req.params.id); saveDb(db); res.json(db.users); });

// --- ORDERS ---
app.get('/api/orders', (req, res) => res.json(getDb().orders));
app.post('/api/orders', (req, res) => { 
    const db = getDb(); 
    const order = req.body; 
    order.id = order.id || Date.now().toString(); 
    order.trackingNumber = calculateNextNumber(db, 'payment', order.payingCompany);
    db.settings.currentTrackingNumber = order.trackingNumber; 
    db.orders.unshift(order); 
    saveDb(db); 
    
    // Notify Financial via Bale
    BaleBotModule.notifyUser(db, 'role:financial', `📢 *درخواست پرداخت جدید*\nشماره: ${order.trackingNumber}\nمبلغ: ${new Intl.NumberFormat('fa-IR').format(order.totalAmount)} ریال\nدرخواست کننده: ${order.requester}`);
    
    res.json(db.orders); 
});
app.put('/api/orders/:id', (req, res) => { 
    const db = getDb(); 
    const idx = db.orders.findIndex(o => o.id === req.params.id); 
    if(idx > -1) { 
        const updated = { ...db.orders[idx], ...req.body };
        db.orders[idx] = updated; 
        saveDb(db); 
        
        // Notify Next Role via Bale
        let targetRole = '';
        let msg = '';
        if (updated.status === 'تایید مالی / در انتظار مدیریت') { targetRole = 'role:manager'; msg = `✅ تایید مالی شد. دستور ${updated.trackingNumber} منتظر تایید شماست.`; }
        else if (updated.status === 'تایید مدیریت / در انتظار مدیرعامل') { targetRole = 'role:ceo'; msg = `✅ تایید مدیریت شد. دستور ${updated.trackingNumber} منتظر تایید شماست.`; }
        else if (updated.status === 'تایید نهایی') { targetRole = 'role:financial'; msg = `💰 دستور ${updated.trackingNumber} تایید نهایی شد. لطفا پرداخت کنید.`; }
        else if (updated.status === 'رد شده') { targetRole = updated.requester; msg = `❌ دستور ${updated.trackingNumber} رد شد.`; }

        if (targetRole) BaleBotModule.notifyUser(db, targetRole, msg);

        res.json(db.orders); 
    } else res.status(404).send('Not Found'); 
});
app.delete('/api/orders/:id', (req, res) => { const db = getDb(); db.orders = db.orders.filter(o => o.id !== req.params.id); saveDb(db); res.json(db.orders); });
app.get('/api/next-tracking-number', (req, res) => res.json({ nextTrackingNumber: calculateNextNumber(getDb(), 'payment', req.query.company) }));

// --- EXIT PERMITS ---
app.get('/api/exit-permits', (req, res) => res.json(getDb().exitPermits));
app.post('/api/exit-permits', (req, res) => {
    const db = getDb();
    const permit = req.body;
    permit.id = permit.id || Date.now().toString();
    permit.permitNumber = calculateNextNumber(db, 'exit', permit.company);
    db.settings.currentExitPermitNumber = permit.permitNumber;
    db.exitPermits.push(permit);
    saveDb(db);

    // Notify CEO via Bale
    BaleBotModule.notifyUser(db, 'role:ceo', `🚛 *درخواست خروج جدید*\nشماره: ${permit.permitNumber}\nگیرنده: ${permit.recipientName}\nکالا: ${permit.goodsName}`);

    res.json(db.exitPermits);
});
app.put('/api/exit-permits/:id', (req, res) => {
    const db = getDb();
    const idx = db.exitPermits.findIndex(p => p.id === req.params.id);
    if (idx > -1) { 
        const updated = { ...db.exitPermits[idx], ...req.body };
        db.exitPermits[idx] = updated; 
        saveDb(db); 
        
        // Notify Next Role
        let targetRole = '';
        if (updated.status === 'در انتظار مدیر کارخانه') targetRole = 'role:factory_manager';
        else if (updated.status === 'در انتظار تایید انبار') targetRole = 'role:warehouse_keeper';
        else if (updated.status === 'در انتظار خروج') targetRole = 'role:security_head';
        
        if (targetRole) BaleBotModule.notifyUser(db, targetRole, `🚛 مجوز خروج ${updated.permitNumber} به کارتابل شما ارسال شد.`);

        res.json(db.exitPermits); 
    } else res.status(404).json({ error: "Permit not found" });
});
app.delete('/api/exit-permits/:id', (req, res) => { const db = getDb(); db.exitPermits = db.exitPermits.filter(p => p.id !== req.params.id); saveDb(db); res.json(db.exitPermits); });
app.get('/api/next-exit-permit-number', (req, res) => res.json({ nextNumber: calculateNextNumber(getDb(), 'exit', req.query.company) }));

// --- CHAT MESSAGES ---
app.get('/api/chat', (req, res) => res.json(getDb().messages));
app.post('/api/chat', (req, res) => { 
    const db = getDb(); 
    const msg = req.body;
    db.messages.push(msg); 
    saveDb(db); 
    
    // Notify Recipient via Bale
    if (msg.recipient) {
        BaleBotModule.notifyUser(db, msg.recipient, `📩 *پیام جدید در چت*\nفرستنده: ${msg.sender}\nمتن: ${msg.message || 'فایل ضمیمه'}`);
    } 
    // Group notification logic omitted for brevity but follows same pattern

    res.json(db.messages); 
});

// --- WAREHOUSE & OTHER MODULES ---
app.get('/api/warehouse/items', (req, res) => res.json(getDb().warehouseItems));
app.post('/api/warehouse/items', (req, res) => { const db = getDb(); db.warehouseItems.push(req.body); saveDb(db); res.json(db.warehouseItems); });
app.put('/api/warehouse/items/:id', (req, res) => { const db = getDb(); const idx = db.warehouseItems.findIndex(i => i.id === req.params.id); if(idx > -1) { db.warehouseItems[idx] = { ...db.warehouseItems[idx], ...req.body }; saveDb(db); res.json(db.warehouseItems); } else res.status(404).send('Not Found'); });
app.delete('/api/warehouse/items/:id', (req, res) => { const db = getDb(); db.warehouseItems = db.warehouseItems.filter(i => i.id !== req.params.id); saveDb(db); res.json(db.warehouseItems); });
app.get('/api/warehouse/transactions', (req, res) => res.json(getDb().warehouseTransactions));
app.post('/api/warehouse/transactions', (req, res) => { 
    const db = getDb(); 
    const tx = req.body; 
    if (tx.type === 'OUT') {
        tx.number = calculateNextNumber(db, 'bijak', tx.company);
        if (!db.settings.warehouseSequences) db.settings.warehouseSequences = {}; 
        db.settings.warehouseSequences[tx.company] = tx.number;
    }
    db.warehouseTransactions.unshift(tx); 
    saveDb(db); 
    
    if (tx.type === 'OUT' && tx.status === 'PENDING') {
        BaleBotModule.notifyUser(db, 'role:ceo', `📦 *صدور بیجک جدید (نیاز به تایید)*\nشماره: ${tx.number}\nشرکت: ${tx.company}`);
    }

    res.json(db.warehouseTransactions); 
});
app.put('/api/warehouse/transactions/:id', (req, res) => { const db = getDb(); const idx = db.warehouseTransactions.findIndex(t => t.id === req.params.id); if(idx > -1) { db.warehouseTransactions[idx] = { ...db.warehouseTransactions[idx], ...req.body }; saveDb(db); res.json(db.warehouseTransactions); } else res.status(404).send('Not Found'); });
app.delete('/api/warehouse/transactions/:id', (req, res) => { const db = getDb(); db.warehouseTransactions = db.warehouseTransactions.filter(t => t.id !== req.params.id); saveDb(db); res.json(db.warehouseTransactions); });
app.get('/api/next-bijak-number', (req, res) => res.json({ nextNumber: calculateNextNumber(getDb(), 'bijak', req.query.company) }));

app.get('/api/trade', (req, res) => res.json(getDb().tradeRecords));
app.post('/api/trade', (req, res) => { const db = getDb(); db.tradeRecords.unshift(req.body); saveDb(db); res.json(db.tradeRecords); });
app.put('/api/trade/:id', (req, res) => { const db = getDb(); const idx = db.tradeRecords.findIndex(r => r.id === req.params.id); if(idx > -1) { db.tradeRecords[idx] = { ...db.tradeRecords[idx], ...req.body }; saveDb(db); res.json(db.tradeRecords); } else res.status(404).send('Not Found'); });
app.delete('/api/trade/:id', (req, res) => { const db = getDb(); db.tradeRecords = db.tradeRecords.filter(r => r.id !== req.params.id); saveDb(db); res.json(db.tradeRecords); });

app.post('/api/upload', (req, res) => {
    try {
        const { fileName, fileData } = req.body;
        const safeName = `${Date.now()}_${fileName.replace(/[^a-z0-9.]/gi, '_')}`;
        const filePath = path.join(UPLOADS_DIR, safeName);
        const base64Data = fileData.replace(/^data:([A-Za-z-+/]+);base64,/, '');
        fs.writeFileSync(filePath, base64Data, 'base64');
        res.json({ fileName: safeName, url: `/uploads/${safeName}` });
    } catch (e) { res.status(500).json({ error: 'Upload failed' }); }
});

const startupBots = async () => {
    const db = getDb();
    if(db.settings.telegramBotToken) try { await TelegramBotModule.initTelegram(db.settings.telegramBotToken); } catch(e){}
    try { await WhatsAppModule.initWhatsApp(WAUTH_DIR); } catch(e){}
    if(db.settings.baleBotToken) try { await BaleBotModule.initBaleBot(db.settings.baleBotToken); } catch(e){}
};

app.use(express.static(DIST_DIR));
app.get('*', (req, res) => { if (req.url.startsWith('/api/')) return res.status(404).json({ error: 'API not found' }); const p = path.join(DIST_DIR, 'index.html'); if(fs.existsSync(p)) res.sendFile(p); else res.send('Server Running'); });

app.listen(PORT, '0.0.0.0', () => {
    logToFile(`✅ Server running on ${PORT}`);
    startupBots();
});
