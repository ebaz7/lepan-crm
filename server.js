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
const UPLOADS_DIR = path.join(ROOT_DIR, 'uploads');
const LOG_FILE = path.join(ROOT_DIR, 'server_status.log');

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// --- LOGGING ---
const logToFile = (message) => {
    const timestamp = new Date().toISOString();
    try {
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
app.use(express.json({ limit: '100mb' })); 
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// --- DB HANDLERS ---
const DEFAULT_DB = { 
    settings: { currentTrackingNumber: 1000, companyNames: [], companies: [], fiscalYears: [], rolePermissions: {}, customRoles: [], operatingBankNames: [], commodityGroups: [], insuranceCompanies: [], printTemplates: [], dailySecurityMeta: {}, savedContacts: [], bankNames: [] }, 
    orders: [], 
    tradeRecords: [],
    securityLogs: [], 
    personnelDelays: [], 
    securityIncidents: [],
    users: [{ id: '1', username: 'admin', password: '123', fullName: 'مدیر سیستم', role: 'admin' }], 
    messages: [], 
    groups: [], 
    tasks: []
};

const sanitizeDb = (data) => {
    if (!data || typeof data !== 'object') return { ...DEFAULT_DB };
    const db = { ...DEFAULT_DB, ...data };
    
    // Core Module Check
    if (!Array.isArray(db.orders)) db.orders = [];
    if (!Array.isArray(db.tradeRecords)) db.tradeRecords = [];
    if (!Array.isArray(db.securityLogs)) db.securityLogs = [];
    if (!Array.isArray(db.personnelDelays)) db.personnelDelays = [];
    if (!Array.isArray(db.securityIncidents)) db.securityIncidents = [];
    if (!Array.isArray(db.messages)) db.messages = [];
    if (!Array.isArray(db.groups)) db.groups = [];
    if (!Array.isArray(db.tasks)) db.tasks = [];
    if (!Array.isArray(db.users) || db.users.length === 0) db.users = DEFAULT_DB.users;
    
    if (!db.settings) db.settings = { ...DEFAULT_DB.settings };
    return db;
};

const getDb = () => {
    try {
        if (!fs.existsSync(DB_FILE)) { saveDb(DEFAULT_DB); return DEFAULT_DB; }
        const data = fs.readFileSync(DB_FILE, 'utf8');
        return sanitizeDb(JSON.parse(data));
    } catch (e) { 
        logToFile("DB Read Failed, using default: " + e.message);
        return DEFAULT_DB; 
    }
};

const saveDb = (data) => {
    try {
        const cleanData = sanitizeDb(data);
        fs.writeFileSync(DB_FILE, JSON.stringify(cleanData, null, 2));
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
            db.orders.forEach(o => { if (Number(o.trackingNumber) > maxFoundInDb) maxFoundInDb = Number(o.trackingNumber); });
            if (activeYear?.companySequences?.[safeCompany]) fiscalStart = Number(activeYear.companySequences[safeCompany].startTrackingNumber) || 0;
            if (fiscalStart === 0) fiscalStart = Number(db.settings.currentTrackingNumber) || 1000;
        }
    } catch (e) { console.error("Sequence Calculation Error:", e); }
    
    return maxFoundInDb >= fiscalStart ? maxFoundInDb + 1 : (fiscalStart > 0 ? fiscalStart : 1001);
};

// --- API ROUTES ---

app.get('/api/version', (req, res) => res.json({ version: SERVER_BUILD_ID }));
app.post('/api/login', (req, res) => { const db = getDb(); const u = db.users.find(x => x.username === req.body.username && x.password === req.body.password); u ? res.json(u) : res.status(401).send('Invalid'); });

// Settings
app.get('/api/settings', (req, res) => res.json(getDb().settings));
app.post('/api/settings', (req, res) => { const db = getDb(); db.settings = { ...db.settings, ...req.body }; saveDb(db); res.json(db.settings); });

// Users
app.get('/api/users', (req, res) => res.json(getDb().users));
app.post('/api/users', (req, res) => { const db = getDb(); const user = req.body; db.users.push(user); saveDb(db); res.json(db.users); });
app.put('/api/users/:id', (req, res) => { const db = getDb(); const idx = db.users.findIndex(u => u.id === req.params.id); if(idx > -1) { db.users[idx] = { ...db.users[idx], ...req.body }; saveDb(db); res.json(db.users); } else res.status(404).send('Not Found'); });
app.delete('/api/users/:id', (req, res) => { const db = getDb(); db.users = db.users.filter(u => u.id !== req.params.id); saveDb(db); res.json(db.users); });

// Orders
app.get('/api/orders', (req, res) => res.json(getDb().orders));
app.post('/api/orders', (req, res) => { 
    const db = getDb(); 
    const order = req.body; 
    order.id = order.id || Date.now().toString(); 
    order.trackingNumber = calculateNextNumber(db, 'payment', order.payingCompany); 
    db.orders.unshift(order); 
    saveDb(db); 
    res.json(db.orders); 
});
app.put('/api/orders/:id', (req, res) => { const db = getDb(); const idx = db.orders.findIndex(o => o.id === req.params.id); if(idx > -1) { db.orders[idx] = { ...db.orders[idx], ...req.body }; saveDb(db); res.json(db.orders); } else res.status(404).send('Not Found'); });
app.delete('/api/orders/:id', (req, res) => { const db = getDb(); db.orders = db.orders.filter(o => o.id !== req.params.id); saveDb(db); res.json(db.orders); });
app.get('/api/next-tracking-number', (req, res) => res.json({ nextTrackingNumber: calculateNextNumber(getDb(), 'payment', req.query.company) }));

// Trade Records
app.get('/api/trade', (req, res) => res.json(getDb().tradeRecords));
app.post('/api/trade', (req, res) => { const db = getDb(); const record = req.body; record.id = record.id || Date.now().toString(); db.tradeRecords.push(record); saveDb(db); res.json(db.tradeRecords); });
app.put('/api/trade/:id', (req, res) => { const db = getDb(); const idx = db.tradeRecords.findIndex(r => r.id === req.params.id); if(idx > -1) { db.tradeRecords[idx] = { ...db.tradeRecords[idx], ...req.body }; saveDb(db); res.json(db.tradeRecords); } else res.status(404).send('Not Found'); });
app.delete('/api/trade/:id', (req, res) => { const db = getDb(); db.tradeRecords = db.tradeRecords.filter(r => r.id !== req.params.id); saveDb(db); res.json(db.tradeRecords); });

// Security
app.get('/api/security/logs', (req, res) => res.json(getDb().securityLogs));
app.post('/api/security/logs', (req, res) => { const db = getDb(); db.securityLogs.push(req.body); saveDb(db); res.json(db.securityLogs); });
app.put('/api/security/logs/:id', (req, res) => { const db = getDb(); const idx = db.securityLogs.findIndex(l => l.id === req.params.id); if(idx > -1) { db.securityLogs[idx] = { ...db.securityLogs[idx], ...req.body }; saveDb(db); res.json(db.securityLogs); } else res.status(404).send('Not Found'); });
app.delete('/api/security/logs/:id', (req, res) => { const db = getDb(); db.securityLogs = db.securityLogs.filter(l => l.id !== req.params.id); saveDb(db); res.json(db.securityLogs); });

// Delays & Incidents (Security)
app.get('/api/security/delays', (req, res) => res.json(getDb().personnelDelays));
app.post('/api/security/delays', (req, res) => { const db = getDb(); const d = req.body; d.id = d.id || Date.now().toString(); db.personnelDelays.push(d); saveDb(db); res.json(db.personnelDelays); });
app.get('/api/security/incidents', (req, res) => res.json(getDb().securityIncidents));
app.post('/api/security/incidents', (req, res) => { const db = getDb(); const i = req.body; i.id = i.id || Date.now().toString(); db.securityIncidents.push(i); saveDb(db); res.json(db.securityIncidents); });

// Chat
app.get('/api/chat', (req, res) => res.json(getDb().messages));
app.post('/api/chat', (req, res) => { const db = getDb(); const msg = req.body; msg.id = msg.id || Date.now().toString(); db.messages.push(msg); if(db.messages.length > 500) db.messages.shift(); saveDb(db); res.json(db.messages); });
app.put('/api/chat/:id', (req, res) => { const db = getDb(); const idx = db.messages.findIndex(m => m.id === req.params.id); if(idx > -1) { db.messages[idx] = { ...db.messages[idx], ...req.body }; saveDb(db); res.json(db.messages); } else res.status(404).send('Not Found'); });
app.delete('/api/chat/:id', (req, res) => { const db = getDb(); db.messages = db.messages.filter(m => m.id !== req.params.id); saveDb(db); res.json(db.messages); });

// Groups & Tasks
app.get('/api/groups', (req, res) => res.json(getDb().groups));
app.post('/api/groups', (req, res) => { const db = getDb(); const group = req.body; group.id = group.id || Date.now().toString(); db.groups.push(group); saveDb(db); res.json(db.groups); });
app.get('/api/tasks', (req, res) => res.json(getDb().tasks));
app.post('/api/tasks', (req, res) => { const db = getDb(); const task = req.body; task.id = task.id || Date.now().toString(); db.tasks.push(task); saveDb(db); res.json(db.tasks); });

// WhatsApp Integration
app.post('/api/send-whatsapp', async (req, res) => {
    const { number, message, mediaData } = req.body;
    if (integrations.whatsapp) {
        try {
            await integrations.whatsapp.sendMessage(number, message, mediaData);
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: e.message }); }
    } else res.status(503).json({ error: "WhatsApp service not ready" });
});

// Full Backup & Restore
app.get('/api/backup', (req, res) => res.json(getDb()));
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

// File Upload
app.post('/api/upload', (req, res) => {
    try {
        const { fileName, fileData } = req.body;
        const base64 = fileData.split(';base64,').pop();
        const filePath = path.join(UPLOADS_DIR, `${Date.now()}_${fileName}`);
        fs.writeFileSync(filePath, base64, { encoding: 'base64' });
        res.json({ fileName, url: `/api/uploads/${path.basename(filePath)}` });
    } catch (e) { res.status(500).send(e.message); }
});

// PDF Rendering
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

// --- SERVING STATIC FILES (LAST) ---
app.use('/api/uploads', express.static(UPLOADS_DIR));
app.use(express.static(path.join(ROOT_DIR, 'dist')));

app.get('*', (req, res) => { 
    if (req.url.startsWith('/api/')) return res.status(404).json({ error: 'Endpoint Not Found' });
    const p = path.join(ROOT_DIR, 'dist', 'index.html'); 
    if(fs.existsSync(p)) res.sendFile(p); else res.send('Frontend build missing. Please run build.');
});

app.listen(PORT, '0.0.0.0', () => logToFile(`Server listening on port ${PORT}`));
