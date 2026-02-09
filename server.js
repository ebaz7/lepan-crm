
import 'dotenv/config'; 
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import compression from 'compression'; 
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';
import cron from 'node-cron'; 

// --- STATIC IMPORTS FOR BOTS (CRITICAL FIX) ---
// This ensures modules are loaded immediately on server start
import * as TelegramBotModule from './backend/telegram.js';
import * as BaleBotModule from './backend/bale.js';
import * as WhatsAppModule from './backend/whatsapp.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- PATH DEFINITIONS ---
const ROOT_DIR = process.cwd();
const DB_FILE = path.join(ROOT_DIR, 'database.json');
const UPLOADS_DIR = path.join(ROOT_DIR, 'uploads');
const BACKUPS_DIR = path.join(ROOT_DIR, 'backups'); 
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const WAUTH_DIR = path.join(ROOT_DIR, 'wauth');

console.log("================================================");
console.log("🚀 PAYMENT SYSTEM SERVER STARTING...");
console.log(`📂 Root Directory: ${ROOT_DIR}`);
console.log("================================================");

// Ensure directories exist
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(BACKUPS_DIR)) fs.mkdirSync(BACKUPS_DIR, { recursive: true });
if (!fs.existsSync(WAUTH_DIR)) fs.mkdirSync(WAUTH_DIR, { recursive: true });

const app = express();
const PORT = process.env.PORT || 3000;

app.use((req, res, next) => {
    next();
});

app.use(cors()); 
app.use(compression()); 
app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use('/uploads', express.static(UPLOADS_DIR));

// --- DB STRUCTURE ---
const DEFAULT_DB = { 
    settings: { 
        currentTrackingNumber: 1000, 
        currentExitPermitNumber: 1000, 
        companyNames: [], 
        companies: [], 
        fiscalYears: [], 
        rolePermissions: {}, 
        customRoles: [], 
        operatingBankNames: [], 
        commodityGroups: [], 
        warehouseSequences: {}, 
        companyNotifications: {}, 
        insuranceCompanies: [], 
        printTemplates: [], 
        dailySecurityMeta: {}, 
        savedContacts: [], 
        bankNames: [] 
    }, 
    orders: [], 
    exitPermits: [], 
    warehouseItems: [], 
    warehouseTransactions: [], 
    tradeRecords: [], 
    messages: [],     
    groups: [],       
    tasks: [],        
    securityLogs: [], 
    personnelDelays: [], 
    securityIncidents: [], 
    users: [{ id: '1', username: 'admin', password: '123', fullName: 'مدیر سیستم', role: 'admin' }]
};

const sanitizeDb = (data) => {
    if (!data || typeof data !== 'object') return { ...DEFAULT_DB };
    const cleanData = { ...DEFAULT_DB };
    if (data.settings) {
        cleanData.settings = { ...DEFAULT_DB.settings, ...data.settings };
    }
    const arrayKeys = [
        'orders', 'exitPermits', 'warehouseItems', 'warehouseTransactions', 
        'tradeRecords', 'messages', 'groups', 'tasks', 
        'securityLogs', 'personnelDelays', 'securityIncidents', 'users'
    ];
    arrayKeys.forEach(key => {
        if (Array.isArray(data[key])) {
            cleanData[key] = data[key];
        } else {
            cleanData[key] = [];
        }
    });
    return cleanData;
};

const getDb = () => {
    try {
        if (!fs.existsSync(DB_FILE)) { 
            const newDb = { ...DEFAULT_DB };
            saveDb(newDb); 
            return newDb; 
        }
        const data = fs.readFileSync(DB_FILE, 'utf8');
        if (!data.trim()) return { ...DEFAULT_DB };
        return sanitizeDb(JSON.parse(data));
    } catch (e) { 
        console.error("❌ DB Read Failed:", e.message);
        return { ...DEFAULT_DB }; 
    }
};

const saveDb = (data) => {
    try {
        const safeData = sanitizeDb(data);
        const tempFile = `${DB_FILE}.tmp`;
        fs.writeFileSync(tempFile, JSON.stringify(safeData, null, 2));
        fs.renameSync(tempFile, DB_FILE);
    } catch (e) { console.error("❌ DB Save Failed:", e.message); }
};

cron.schedule('0 * * * *', () => {
    try {
        const db = getDb();
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const backupFile = path.join(BACKUPS_DIR, `auto_backup_${timestamp}.json`);
        fs.writeFileSync(backupFile, JSON.stringify(db, null, 2));
        
        const files = fs.readdirSync(BACKUPS_DIR).filter(f => f.startsWith('auto_backup_'));
        if (files.length > 48) {
            files.sort();
            const toDelete = files.slice(0, files.length - 48);
            toDelete.forEach(f => fs.unlinkSync(path.join(BACKUPS_DIR, f)));
        }
    } catch (e) { console.error('❌ Backup Failed:', e.message); }
});

const calculateNextNumber = (db, type, companyName = null) => {
    let max = 0;
    const safeCompany = companyName ? companyName.trim() : (db.settings.defaultCompany || '');
    
    if (type === 'payment') {
        max = db.settings.currentTrackingNumber || 1000;
        return max + 1;
    } else if (type === 'exit') {
        max = db.settings.currentExitPermitNumber || 1000;
        return max + 1;
    } else if (type === 'bijak') {
        const seq = db.settings.warehouseSequences?.[safeCompany] || 1000;
        return seq; 
    }
    return 1001;
};

// ================= API ROUTES =================

// --- BOT RESTART ENDPOINT ---
app.post('/api/restart-bot', async (req, res) => {
    const { type } = req.body;
    console.log(`🔄 Manual Restart Request: ${type}`);

    try {
        const db = getDb(); 
        
        if (type === 'telegram') {
            const token = db.settings.telegramBotToken;
            if (!token) throw new Error("Telegram Token not set in settings.");
            await TelegramBotModule.initTelegram(token);

        } else if (type === 'bale') {
            const token = db.settings.baleBotToken;
            if (!token) throw new Error("Bale Token not set in settings.");
            await BaleBotModule.restartBaleBot(token);

        } else if (type === 'whatsapp') {
            await WhatsAppModule.restartSession(WAUTH_DIR);
        } else {
            throw new Error("Invalid bot type");
        }

        res.json({ success: true });
    } catch (e) { 
        console.error(`❌ Restart Error (${type}):`, e.message);
        res.status(500).json({ error: e.message }); 
    }
});

// --- WHATSAPP ROUTES ---
app.get('/api/whatsapp/status', async (req, res) => {
    res.json(WhatsAppModule.getStatus());
});

app.post('/api/whatsapp/logout', async (req, res) => {
    try {
        await WhatsAppModule.logout();
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/whatsapp/groups', async (req, res) => {
    try {
        const groups = await WhatsAppModule.getGroups();
        res.json({ success: true, groups });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/send-whatsapp', async (req, res) => {
    try {
        const { number, message, mediaData } = req.body;
        await WhatsAppModule.sendMessage(number, message, mediaData);
        res.json({ success: true });
    } catch (e) { 
        console.error("WA Send Error:", e.message);
        res.status(500).json({ error: e.message }); 
    }
});

// --- BASIC ROUTES ---
app.get('/api/version', (req, res) => res.json({ version: Date.now().toString() }));
app.post('/api/login', (req, res) => { const db = getDb(); const u = db.users.find(x => x.username === req.body.username && x.password === req.body.password); u ? res.json(u) : res.status(401).send('Invalid'); });
app.get('/api/settings', (req, res) => res.json(getDb().settings));
app.post('/api/settings', (req, res) => { const db = getDb(); db.settings = { ...db.settings, ...req.body }; saveDb(db); res.json(db.settings); });

// Users
app.get('/api/users', (req, res) => res.json(getDb().users));
app.post('/api/users', (req, res) => { const db = getDb(); db.users.push(req.body); saveDb(db); res.json(db.users); });
app.put('/api/users/:id', (req, res) => { const db = getDb(); const idx = db.users.findIndex(u => u.id === req.params.id); if(idx > -1) { db.users[idx] = { ...db.users[idx], ...req.body }; saveDb(db); res.json(db.users); } else res.status(404).send('Not Found'); });
app.delete('/api/users/:id', (req, res) => { const db = getDb(); db.users = db.users.filter(u => u.id !== req.params.id); saveDb(db); res.json(db.users); });

// Orders
app.get('/api/orders', (req, res) => res.json(getDb().orders));
app.post('/api/orders', (req, res) => { 
    const db = getDb(); 
    const order = req.body; 
    order.id = order.id || Date.now().toString(); 
    order.trackingNumber = calculateNextNumber(db, 'payment', order.payingCompany);
    db.settings.currentTrackingNumber = order.trackingNumber; 
    db.orders.unshift(order); 
    saveDb(db); 
    res.json(db.orders); 
});
app.put('/api/orders/:id', (req, res) => { const db = getDb(); const idx = db.orders.findIndex(o => o.id === req.params.id); if(idx > -1) { db.orders[idx] = { ...db.orders[idx], ...req.body }; saveDb(db); res.json(db.orders); } else res.status(404).send('Not Found'); });
app.delete('/api/orders/:id', (req, res) => { const db = getDb(); db.orders = db.orders.filter(o => o.id !== req.params.id); saveDb(db); res.json(db.orders); });
app.get('/api/next-tracking-number', (req, res) => res.json({ nextTrackingNumber: calculateNextNumber(getDb(), 'payment', req.query.company) }));

// Exit Permits
app.get('/api/exit-permits', (req, res) => res.json(getDb().exitPermits));
app.post('/api/exit-permits', (req, res) => {
    const db = getDb();
    const permit = req.body;
    permit.id = permit.id || Date.now().toString();
    permit.permitNumber = calculateNextNumber(db, 'exit', permit.company);
    db.settings.currentExitPermitNumber = permit.permitNumber;
    db.exitPermits.push(permit);
    saveDb(db);
    res.json(db.exitPermits);
});
app.put('/api/exit-permits/:id', (req, res) => {
    const db = getDb();
    const idx = db.exitPermits.findIndex(p => p.id === req.params.id);
    if (idx > -1) { db.exitPermits[idx] = { ...db.exitPermits[idx], ...req.body }; saveDb(db); res.json(db.exitPermits); } else res.status(404).json({ error: "Permit not found" });
});
app.delete('/api/exit-permits/:id', (req, res) => { const db = getDb(); db.exitPermits = db.exitPermits.filter(p => p.id !== req.params.id); saveDb(db); res.json(db.exitPermits); });
app.get('/api/next-exit-permit-number', (req, res) => res.json({ nextNumber: calculateNextNumber(getDb(), 'exit', req.query.company) }));

// Warehouse
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
    res.json(db.warehouseTransactions); 
});
app.put('/api/warehouse/transactions/:id', (req, res) => { const db = getDb(); const idx = db.warehouseTransactions.findIndex(t => t.id === req.params.id); if(idx > -1) { db.warehouseTransactions[idx] = { ...db.warehouseTransactions[idx], ...req.body }; saveDb(db); res.json(db.warehouseTransactions); } else res.status(404).send('Not Found'); });
app.delete('/api/warehouse/transactions/:id', (req, res) => { const db = getDb(); db.warehouseTransactions = db.warehouseTransactions.filter(t => t.id !== req.params.id); saveDb(db); res.json(db.warehouseTransactions); });
app.get('/api/next-bijak-number', (req, res) => res.json({ nextNumber: calculateNextNumber(getDb(), 'bijak', req.query.company) }));

// Other Modules
app.get('/api/trade', (req, res) => res.json(getDb().tradeRecords));
app.post('/api/trade', (req, res) => { const db = getDb(); db.tradeRecords.unshift(req.body); saveDb(db); res.json(db.tradeRecords); });
app.put('/api/trade/:id', (req, res) => { const db = getDb(); const idx = db.tradeRecords.findIndex(r => r.id === req.params.id); if(idx > -1) { db.tradeRecords[idx] = { ...db.tradeRecords[idx], ...req.body }; saveDb(db); res.json(db.tradeRecords); } else res.status(404).send('Not Found'); });
app.delete('/api/trade/:id', (req, res) => { const db = getDb(); db.tradeRecords = db.tradeRecords.filter(r => r.id !== req.params.id); saveDb(db); res.json(db.tradeRecords); });

app.get('/api/chat', (req, res) => res.json(getDb().messages));
app.post('/api/chat', (req, res) => { const db = getDb(); db.messages.push(req.body); saveDb(db); res.json(db.messages); });
app.put('/api/chat/:id', (req, res) => { const db = getDb(); const idx = db.messages.findIndex(m => m.id === req.params.id); if(idx > -1) { db.messages[idx] = { ...db.messages[idx], ...req.body }; saveDb(db); res.json(db.messages); } else res.status(404).send('Not Found'); });
app.delete('/api/chat/:id', (req, res) => { const db = getDb(); db.messages = db.messages.filter(m => m.id !== req.params.id); saveDb(db); res.json(db.messages); });

app.get('/api/groups', (req, res) => res.json(getDb().groups));
app.post('/api/groups', (req, res) => { const db = getDb(); db.groups.push(req.body); saveDb(db); res.json(db.groups); });
app.put('/api/groups/:id', (req, res) => { const db = getDb(); const idx = db.groups.findIndex(g => g.id === req.params.id); if(idx > -1) { db.groups[idx] = { ...db.groups[idx], ...req.body }; saveDb(db); res.json(db.groups); } else res.status(404).send('Not Found'); });
app.delete('/api/groups/:id', (req, res) => { const db = getDb(); db.groups = db.groups.filter(g => g.id !== req.params.id); saveDb(db); res.json(db.groups); });

app.get('/api/tasks', (req, res) => res.json(getDb().tasks));
app.post('/api/tasks', (req, res) => { const db = getDb(); db.tasks.push(req.body); saveDb(db); res.json(db.tasks); });
app.put('/api/tasks/:id', (req, res) => { const db = getDb(); const idx = db.tasks.findIndex(t => t.id === req.params.id); if(idx > -1) { db.tasks[idx] = { ...db.tasks[idx], ...req.body }; saveDb(db); res.json(db.tasks); } else res.status(404).send('Not Found'); });
app.delete('/api/tasks/:id', (req, res) => { const db = getDb(); db.tasks = db.tasks.filter(t => t.id !== req.params.id); saveDb(db); res.json(db.tasks); });

app.get('/api/security/logs', (req, res) => res.json(getDb().securityLogs));
app.post('/api/security/logs', (req, res) => { const db = getDb(); db.securityLogs.unshift(req.body); saveDb(db); res.json(db.securityLogs); });
app.put('/api/security/logs/:id', (req, res) => { const db = getDb(); const idx = db.securityLogs.findIndex(l => l.id === req.params.id); if(idx > -1) { db.securityLogs[idx] = { ...db.securityLogs[idx], ...req.body }; saveDb(db); res.json(db.securityLogs); } else res.status(404).send('Not Found'); });
app.delete('/api/security/logs/:id', (req, res) => { const db = getDb(); db.securityLogs = db.securityLogs.filter(l => l.id !== req.params.id); saveDb(db); res.json(db.securityLogs); });

app.get('/api/security/delays', (req, res) => res.json(getDb().personnelDelays));
app.post('/api/security/delays', (req, res) => { const db = getDb(); db.personnelDelays.unshift(req.body); saveDb(db); res.json(db.personnelDelays); });
app.put('/api/security/delays/:id', (req, res) => { const db = getDb(); const idx = db.personnelDelays.findIndex(d => d.id === req.params.id); if(idx > -1) { db.personnelDelays[idx] = { ...db.personnelDelays[idx], ...req.body }; saveDb(db); res.json(db.personnelDelays); } else res.status(404).send('Not Found'); });
app.delete('/api/security/delays/:id', (req, res) => { const db = getDb(); db.personnelDelays = db.personnelDelays.filter(d => d.id !== req.params.id); saveDb(db); res.json(db.personnelDelays); });

app.get('/api/security/incidents', (req, res) => res.json(getDb().securityIncidents));
app.post('/api/security/incidents', (req, res) => { const db = getDb(); db.securityIncidents.unshift(req.body); saveDb(db); res.json(db.securityIncidents); });
app.put('/api/security/incidents/:id', (req, res) => { const db = getDb(); const idx = db.securityIncidents.findIndex(i => i.id === req.params.id); if(idx > -1) { db.securityIncidents[idx] = { ...db.securityIncidents[idx], ...req.body }; saveDb(db); res.json(db.securityIncidents); } else res.status(404).send('Not Found'); });
app.delete('/api/security/incidents/:id', (req, res) => { const db = getDb(); db.securityIncidents = db.securityIncidents.filter(i => i.id !== req.params.id); saveDb(db); res.json(db.securityIncidents); });

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

app.get('/api/full-backup', (req, res) => {
    const db = getDb();
    res.setHeader('Content-Disposition', `attachment; filename=backup_${Date.now()}.json`);
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(db, null, 2));
});

app.post('/api/emergency-restore', (req, res) => {
    try {
        const { fileData } = req.body;
        const base64 = fileData.includes(',') ? fileData.split(',')[1] : fileData;
        const jsonStr = Buffer.from(base64, 'base64').toString('utf-8');
        const parsed = JSON.parse(jsonStr);
        saveDb(sanitizeDb(parsed)); 
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.post('/api/render-pdf', async (req, res) => {
    try {
        const { html, landscape, format, width, height } = req.body;
        const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
        const page = await browser.newPage();
        if(width && height) await page.setViewport({ width: 1200, height: 800 });
        await page.setContent(html, { waitUntil: 'networkidle0' });
        const pdf = await page.pdf({ printBackground: true, landscape: !!landscape, format: width ? undefined : (format || 'A4'), width, height });
        await browser.close();
        res.contentType("application/pdf");
        res.send(pdf);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/subscribe', (req, res) => res.json({ success: true }));

// --- SERVE FRONTEND ---
app.use(express.static(DIST_DIR));
app.get('*', (req, res) => { 
    if (req.url.startsWith('/api/')) return res.status(404).json({ error: 'API not found' });
    const p = path.join(DIST_DIR, 'index.html');
    if(fs.existsSync(p)) res.sendFile(p); else res.send('Server Running. Build frontend!');
});

// INITIAL BOT STARTUP (Immediate)
const startupBots = async () => {
    console.log("------------------------------------------------");
    console.log("🤖 STARTING BOTS...");
    console.log("------------------------------------------------");
    
    const db = getDb();

    // 1. Telegram
    if(db.settings.telegramBotToken) {
        try {
            await TelegramBotModule.initTelegram(db.settings.telegramBotToken);
        } catch (e) { console.error("Telegram Init Fail:", e.message); }
    } else {
        console.log("⚠️ Telegram Bot Token missing.");
    }

    // 2. WhatsApp
    try {
        await WhatsAppModule.initWhatsApp(WAUTH_DIR);
    } catch (e) { console.error("WhatsApp Init Fail:", e.message); }

    // 3. Bale
    if(db.settings.baleBotToken) {
        try {
            await BaleBotModule.initBaleBot(db.settings.baleBotToken);
        } catch (e) { console.error("Bale Init Fail:", e.message); }
    } else {
        console.log("⚠️ Bale Bot Token missing.");
    }
};

app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server running on ${PORT}`);
    // Start bots immediately
    startupBots();
});
