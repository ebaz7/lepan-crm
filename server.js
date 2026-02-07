
import 'dotenv/config'; 
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import compression from 'compression'; 
import { fileURLToPath } from 'url';
import cron from 'node-cron';
import puppeteer from 'puppeteer';
import webpush from 'web-push'; 

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- INTELLIGENT PATH FINDER ---
const findRootDirectory = () => {
    const candidates = [
        "C:\\PaymentSystem", 
        __dirname,           
        process.cwd(),       
        path.resolve(__dirname, '..') 
    ];

    for (const dir of candidates) {
        if (fs.existsSync(path.join(dir, 'package.json'))) {
            return dir;
        }
    }
    return "C:\\PaymentSystem";
};

const ROOT_DIR = findRootDirectory();
const DB_FILE = path.join(ROOT_DIR, 'database.json');
const BACKUPS_DIR = path.join(ROOT_DIR, 'backups');
const UPLOADS_DIR = path.join(ROOT_DIR, 'uploads');
const WAUTH_DIR = path.join(ROOT_DIR, 'wauth');
const LOG_FILE = path.join(ROOT_DIR, 'server_status.log');

// --- LOGGING ---
const logToFile = (message) => {
    const timestamp = new Date().toISOString();
    try {
        if (!fs.existsSync(ROOT_DIR)) fs.mkdirSync(ROOT_DIR, { recursive: true });
        fs.appendFileSync(LOG_FILE, `[${timestamp}] ${message}\n`);
        console.log(message);
    } catch (e) { console.error("Logger failed:", e); }
};

// --- SETUP ---
const app = express();
const PORT = process.env.PORT || 3000;
const SERVER_BUILD_ID = Date.now().toString();

// --- INTEGRATIONS ---
let integrations = { whatsapp: null, telegram: null, bale: null };
(async () => {
    try { integrations.telegram = await import('./backend/telegram.js'); } catch (e) {}
    try { integrations.whatsapp = await import('./backend/whatsapp.js'); } catch (e) {}
    try { integrations.bale = await import('./backend/bale.js'); } catch (e) {}
})();

app.use(cors()); 
app.use(compression()); 
app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ limit: '50mb', extended: true }));
// Static files served AFTER API routes definition logic (see below)
app.use('/uploads', express.static(UPLOADS_DIR));

// --- DB HANDLERS ---
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
    tradeRecords: [], // Added missing array
    messages: [],     // Added missing array
    groups: [],       // Added missing array
    tasks: [],        // Added missing array
    securityLogs: [], // Added missing array
    personnelDelays: [], // Added missing array
    securityIncidents: [], // Added missing array
    users: [{ id: '1', username: 'admin', password: '123', fullName: 'مدیر سیستم', role: 'admin' }]
};

const sanitizeDb = (data) => {
    if (!data || typeof data !== 'object') return { ...DEFAULT_DB };
    // Ensure all arrays exist
    ['orders', 'exitPermits', 'warehouseItems', 'warehouseTransactions', 'tradeRecords', 'messages', 'groups', 'tasks', 'securityLogs', 'personnelDelays', 'securityIncidents', 'users'].forEach(key => {
        if (!Array.isArray(data[key])) data[key] = [];
    });
    if (!data.settings) data.settings = { ...DEFAULT_DB.settings };
    return data;
};

const getDb = () => {
    try {
        if (!fs.existsSync(DB_FILE)) { saveDb(DEFAULT_DB); return DEFAULT_DB; }
        const data = fs.readFileSync(DB_FILE, 'utf8');
        return sanitizeDb(JSON.parse(data));
    } catch (e) { return DEFAULT_DB; }
};

const saveDb = (data) => {
    try {
        const tempFile = `${DB_FILE}.tmp`;
        fs.writeFileSync(tempFile, JSON.stringify(sanitizeDb(data), null, 2));
        fs.renameSync(tempFile, DB_FILE);
    } catch (e) { logToFile("Error saving DB: " + e.message); }
};

const calculateNextNumber = (db, type, companyName = null) => {
    let maxFoundInDb = 0;
    const safeCompany = companyName ? companyName.trim() : (db.settings.defaultCompany || '');
    const activeYearId = db.settings.activeFiscalYearId;
    const activeYear = activeYearId ? db.settings.fiscalYears?.find(y => y.id === activeYearId) : null;
    let fiscalStart = 0;

    try {
        if (type === 'payment') {
            db.orders.forEach(o => { if (parseInt(o.trackingNumber) > maxFoundInDb) maxFoundInDb = parseInt(o.trackingNumber); });
            if (activeYear?.companySequences?.[safeCompany]) fiscalStart = parseInt(activeYear.companySequences[safeCompany].startTrackingNumber) || 0;
            if (fiscalStart === 0) fiscalStart = parseInt(db.settings.currentTrackingNumber) || 1000;
        } else if (type === 'exit') {
            db.exitPermits.forEach(p => { if (parseInt(p.permitNumber) > maxFoundInDb) maxFoundInDb = parseInt(p.permitNumber); });
            if (activeYear?.companySequences?.[safeCompany]) fiscalStart = parseInt(activeYear.companySequences[safeCompany].startExitPermitNumber) || 0;
            if (fiscalStart === 0) fiscalStart = parseInt(db.settings.currentExitPermitNumber) || 1000;
        } else if (type === 'bijak') {
            db.warehouseTransactions.filter(t => t.type === 'OUT' && t.company === safeCompany).forEach(t => { if (parseInt(t.number) > maxFoundInDb) maxFoundInDb = parseInt(t.number); });
            if (activeYear?.companySequences?.[safeCompany]) fiscalStart = parseInt(activeYear.companySequences[safeCompany].startBijakNumber) || 0;
            if (fiscalStart === 0) fiscalStart = parseInt(db.settings.warehouseSequences?.[safeCompany]) || 1000;
        }
    } catch (e) {}
    
    let nextNum = maxFoundInDb >= fiscalStart ? maxFoundInDb + 1 : (fiscalStart > 0 ? fiscalStart : 1001);
    if (!nextNum || nextNum < 1000) nextNum = 1001;

    // Update global cache
    if (type === 'payment' && !activeYear) db.settings.currentTrackingNumber = nextNum;
    if (type === 'exit' && !activeYear) db.settings.currentExitPermitNumber = nextNum;
    if (type === 'bijak' && !activeYear && safeCompany) { if (!db.settings.warehouseSequences) db.settings.warehouseSequences = {}; db.settings.warehouseSequences[safeCompany] = nextNum; }
    
    return nextNum;
};

// --- API ROUTES ---

// System & Users
app.get('/api/version', (req, res) => res.json({ version: SERVER_BUILD_ID }));
app.post('/api/login', (req, res) => { const db = getDb(); const u = db.users.find(x => x.username === req.body.username && x.password === req.body.password); u ? res.json(u) : res.status(401).send('Invalid'); });
app.get('/api/settings', (req, res) => res.json(getDb().settings));
app.post('/api/settings', (req, res) => { const db = getDb(); db.settings = { ...db.settings, ...req.body }; saveDb(db); res.json(db.settings); });
app.get('/api/users', (req, res) => res.json(getDb().users));
app.post('/api/users', (req, res) => { const db = getDb(); db.users.push(req.body); saveDb(db); res.json(db.users); });
app.put('/api/users/:id', (req, res) => { const db = getDb(); const idx = db.users.findIndex(u => u.id === req.params.id); if(idx > -1) { db.users[idx] = { ...db.users[idx], ...req.body }; saveDb(db); res.json(db.users); } else res.status(404).send('Not Found'); });
app.delete('/api/users/:id', (req, res) => { const db = getDb(); db.users = db.users.filter(u => u.id !== req.params.id); saveDb(db); res.json(db.users); });

// Orders (Payment)
app.get('/api/orders', (req, res) => res.json(getDb().orders));
app.post('/api/orders', (req, res) => { const db = getDb(); const order = req.body; order.id = Date.now().toString(); order.trackingNumber = calculateNextNumber(db, 'payment', order.payingCompany); db.orders.unshift(order); saveDb(db); res.json(db.orders); });
app.put('/api/orders/:id', (req, res) => { const db = getDb(); const idx = db.orders.findIndex(o => o.id === req.params.id); if(idx > -1) { db.orders[idx] = { ...db.orders[idx], ...req.body }; saveDb(db); res.json(db.orders); } else res.status(404).send('Not Found'); });
app.delete('/api/orders/:id', (req, res) => { const db = getDb(); db.orders = db.orders.filter(o => o.id !== req.params.id); saveDb(db); res.json(db.orders); });
app.get('/api/next-tracking-number', (req, res) => res.json({ nextTrackingNumber: calculateNextNumber(getDb(), 'payment', req.query.company) }));

// Exit Permits
app.get('/api/exit-permits', (req, res) => res.json(getDb().exitPermits));
app.post('/api/exit-permits', (req, res) => {
    try {
        const db = getDb();
        const permit = req.body;
        permit.id = permit.id || Date.now().toString();
        permit.permitNumber = calculateNextNumber(db, 'exit', permit.company);
        db.exitPermits.push(permit);
        saveDb(db);
        res.json(db.exitPermits);
    } catch (e) { res.status(500).json({ error: e.message }); }
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
app.post('/api/warehouse/transactions', (req, res) => { const db = getDb(); const tx = req.body; if (tx.type === 'OUT') tx.number = calculateNextNumber(db, 'bijak', tx.company); db.warehouseTransactions.unshift(tx); saveDb(db); res.json(db.warehouseTransactions); });
app.put('/api/warehouse/transactions/:id', (req, res) => { const db = getDb(); const idx = db.warehouseTransactions.findIndex(t => t.id === req.params.id); if(idx > -1) { db.warehouseTransactions[idx] = { ...db.warehouseTransactions[idx], ...req.body }; saveDb(db); res.json(db.warehouseTransactions); } else res.status(404).send('Not Found'); });
app.delete('/api/warehouse/transactions/:id', (req, res) => { const db = getDb(); db.warehouseTransactions = db.warehouseTransactions.filter(t => t.id !== req.params.id); saveDb(db); res.json(db.warehouseTransactions); });
app.get('/api/next-bijak-number', (req, res) => res.json({ nextNumber: calculateNextNumber(getDb(), 'bijak', req.query.company) }));

// Trade (Commerce)
app.get('/api/trade', (req, res) => res.json(getDb().tradeRecords));
app.post('/api/trade', (req, res) => { const db = getDb(); db.tradeRecords.unshift(req.body); saveDb(db); res.json(db.tradeRecords); });
app.put('/api/trade/:id', (req, res) => { const db = getDb(); const idx = db.tradeRecords.findIndex(r => r.id === req.params.id); if(idx > -1) { db.tradeRecords[idx] = { ...db.tradeRecords[idx], ...req.body }; saveDb(db); res.json(db.tradeRecords); } else res.status(404).send('Not Found'); });
app.delete('/api/trade/:id', (req, res) => { const db = getDb(); db.tradeRecords = db.tradeRecords.filter(r => r.id !== req.params.id); saveDb(db); res.json(db.tradeRecords); });

// Chat
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

// Security
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

// File Upload
app.post('/api/upload', (req, res) => {
    try {
        if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
        const { fileName, fileData } = req.body;
        const safeName = `${Date.now()}_${fileName.replace(/[^a-z0-9.]/gi, '_')}`;
        const filePath = path.join(UPLOADS_DIR, safeName);
        const base64Data = fileData.replace(/^data:([A-Za-z-+/]+);base64,/, '');
        fs.writeFileSync(filePath, base64Data, 'base64');
        res.json({ fileName: safeName, url: `/uploads/${safeName}` });
    } catch (e) { res.status(500).json({ error: 'Upload failed' }); }
});

// Backup & Restore
app.get('/api/full-backup', (req, res) => {
    const db = getDb();
    const backupName = `backup_${Date.now()}.json`;
    res.setHeader('Content-Disposition', `attachment; filename=${backupName}`);
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

// PDF Generation
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

// Notifications
app.post('/api/subscribe', (req, res) => {
    // Basic stub for push subscriptions
    res.json({ success: true });
});

// Integration Status
app.get('/api/whatsapp/status', (req, res) => {
    if (integrations.whatsapp && integrations.whatsapp.getStatus) {
        res.json(integrations.whatsapp.getStatus());
    } else {
        res.json({ ready: false, qr: null });
    }
});

// Serving Static Files (Must be last to avoid 404ing API routes)
app.use(express.static(path.join(ROOT_DIR, 'dist')));

app.get('*', (req, res) => { 
    if (req.url.startsWith('/api/')) {
        return res.status(404).json({ error: 'API endpoint not found' });
    }
    const p = path.join(ROOT_DIR, 'dist', 'index.html'); 
    if(fs.existsSync(p)) res.sendFile(p); else res.send('Server Running. Frontend build missing.');
});

// Initialize Integrations
const db = getDb();
if (integrations.telegram && db.settings.telegramBotToken) integrations.telegram.initTelegram(db.settings.telegramBotToken);
if (integrations.whatsapp) integrations.whatsapp.initWhatsApp(WAUTH_DIR);
if (integrations.bale && db.settings.baleBotToken) integrations.bale.initBaleBot(db.settings.baleBotToken);

app.listen(PORT, '0.0.0.0', () => logToFile(`Server running on ${PORT}`));
