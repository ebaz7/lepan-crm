
import 'dotenv/config'; 
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import compression from 'compression'; 
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';

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
app.use('/uploads', express.static(UPLOADS_DIR));

// --- DB HANDLERS ---
const DEFAULT_DB = { 
    settings: { currentTrackingNumber: 1000, currentExitPermitNumber: 1000, companyNames: [], companies: [], fiscalYears: [], rolePermissions: {}, customRoles: [], operatingBankNames: [], commodityGroups: [], warehouseSequences: {}, companyNotifications: {}, insuranceCompanies: [], printTemplates: [], dailySecurityMeta: {}, savedContacts: [], bankNames: [] }, 
    orders: [], exitPermits: [], warehouseItems: [], warehouseTransactions: [], 
    users: [{ id: '1', username: 'admin', password: '123', fullName: 'مدیر سیستم', role: 'admin' }], 
    messages: [], groups: [], tasks: [], tradeRecords: [], securityLogs: [], personnelDelays: [], securityIncidents: []
};

const getDb = () => {
    try {
        if (!fs.existsSync(DB_FILE)) { 
            fs.writeFileSync(DB_FILE, JSON.stringify(DEFAULT_DB, null, 2)); 
            return DEFAULT_DB; 
        }
        const data = fs.readFileSync(DB_FILE, 'utf8');
        const parsed = JSON.parse(data);
        // Ensure critical arrays exist
        if (!Array.isArray(parsed.exitPermits)) parsed.exitPermits = [];
        if (!Array.isArray(parsed.orders)) parsed.orders = [];
        return parsed;
    } catch (e) { 
        return DEFAULT_DB; 
    }
};

const saveDb = (data) => {
    try {
        const tempFile = `${DB_FILE}.tmp`;
        fs.writeFileSync(tempFile, JSON.stringify(data, null, 2));
        fs.renameSync(tempFile, DB_FILE);
    } catch (e) { logToFile("Error saving DB: " + e.message); }
};

const calculateNextNumber = (db, type, companyName = null) => {
    let maxFoundInDb = 0;
    const safeCompany = companyName ? companyName.trim() : (db.settings.defaultCompany || '');
    let fiscalStart = 0;

    try {
        const activeYearId = db.settings.activeFiscalYearId;
        const activeYear = activeYearId ? db.settings.fiscalYears?.find(y => y.id === activeYearId) : null;
        
        if (type === 'exit') {
            db.exitPermits.forEach(p => { if (parseInt(p.permitNumber) > maxFoundInDb) maxFoundInDb = parseInt(p.permitNumber); });
            if (activeYear?.companySequences?.[safeCompany]) fiscalStart = parseInt(activeYear.companySequences[safeCompany].startExitPermitNumber) || 0;
            if (fiscalStart === 0) fiscalStart = parseInt(db.settings.currentExitPermitNumber) || 1000;
        } else if (type === 'payment') {
            db.orders.forEach(o => { if (parseInt(o.trackingNumber) > maxFoundInDb) maxFoundInDb = parseInt(o.trackingNumber); });
            if (fiscalStart === 0) fiscalStart = parseInt(db.settings.currentTrackingNumber) || 1000;
        } else if (type === 'bijak') {
             db.warehouseTransactions.filter(t => t.type === 'OUT' && t.company === safeCompany).forEach(t => { if (parseInt(t.number) > maxFoundInDb) maxFoundInDb = parseInt(t.number); });
             if (fiscalStart === 0) fiscalStart = parseInt(db.settings.warehouseSequences?.[safeCompany]) || 1000;
        }
    } catch (e) {}
    
    let nextNum = maxFoundInDb >= fiscalStart ? maxFoundInDb + 1 : (fiscalStart > 0 ? fiscalStart : 1001);
    if (!nextNum || nextNum < 1000) nextNum = 1001;
    return nextNum;
};

// --- CORE API ROUTES ---

app.get('/api/version', (req, res) => res.json({ version: SERVER_BUILD_ID }));
app.post('/api/login', (req, res) => { const db = getDb(); const u = db.users.find(x => x.username === req.body.username && x.password === req.body.password); u ? res.json(u) : res.status(401).send('Invalid'); });

// Settings
app.get('/api/settings', (req, res) => res.json(getDb().settings));
app.post('/api/settings', (req, res) => { const db = getDb(); db.settings = { ...db.settings, ...req.body }; saveDb(db); res.json(db.settings); });
app.get('/api/users', (req, res) => res.json(getDb().users));

// Orders
app.get('/api/orders', (req, res) => res.json(getDb().orders));
app.post('/api/orders', (req, res) => { const db = getDb(); const order = req.body; order.id = Date.now().toString(); order.trackingNumber = calculateNextNumber(db, 'payment', order.payingCompany); db.orders.unshift(order); saveDb(db); res.json(db.orders); });
app.put('/api/orders/:id', (req, res) => { const db = getDb(); const idx = db.orders.findIndex(o => o.id === req.params.id); if(idx > -1) { db.orders[idx] = { ...db.orders[idx], ...req.body }; saveDb(db); res.json(db.orders); } else res.status(404).send('Not Found'); });
app.delete('/api/orders/:id', (req, res) => { const db = getDb(); db.orders = db.orders.filter(o => o.id !== req.params.id); saveDb(db); res.json(db.orders); });
app.get('/api/next-tracking-number', (req, res) => res.json({ nextTrackingNumber: calculateNextNumber(getDb(), 'payment', req.query.company) }));

// ==========================================
// *** FIX: EXPLICIT EXIT PERMIT ROUTES ***
// ==========================================

// 1. GET ALL
app.get('/api/exit-permits', (req, res) => {
    const db = getDb();
    res.json(db.exitPermits || []);
});

// 2. CREATE (POST)
app.post('/api/exit-permits', (req, res) => {
    try {
        const db = getDb();
        const permit = req.body;
        permit.id = permit.id || Date.now().toString();
        permit.permitNumber = calculateNextNumber(db, 'exit', permit.company);
        
        if (!Array.isArray(db.exitPermits)) db.exitPermits = [];
        db.exitPermits.push(permit);
        
        saveDb(db);
        res.json(db.exitPermits);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 3. UPDATE / APPROVE (PUT) - This is what fixes the 404
app.put('/api/exit-permits/:id', (req, res) => {
    try {
        const db = getDb();
        const idx = db.exitPermits.findIndex(p => p.id === req.params.id);
        if (idx > -1) {
            // Update the record with new data
            db.exitPermits[idx] = { ...db.exitPermits[idx], ...req.body };
            saveDb(db);
            res.json(db.exitPermits);
        } else {
            res.status(404).json({ error: "Permit not found" });
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 4. DELETE
app.delete('/api/exit-permits/:id', (req, res) => {
    const db = getDb();
    db.exitPermits = db.exitPermits.filter(p => p.id !== req.params.id);
    saveDb(db);
    res.json(db.exitPermits);
});

app.get('/api/next-exit-permit-number', (req, res) => {
    const nextNum = calculateNextNumber(getDb(), 'exit', req.query.company);
    res.json({ nextNumber: nextNum });
});
// ==========================================

// Warehouse
app.get('/api/warehouse/transactions', (req, res) => res.json(getDb().warehouseTransactions));
app.post('/api/warehouse/transactions', (req, res) => { const db = getDb(); const tx = req.body; if (tx.type === 'OUT') tx.number = calculateNextNumber(db, 'bijak', tx.company); db.warehouseTransactions.unshift(tx); saveDb(db); res.json(db.warehouseTransactions); });
app.put('/api/warehouse/transactions/:id', (req, res) => { const db = getDb(); const idx = db.warehouseTransactions.findIndex(t => t.id === req.params.id); if(idx > -1) { db.warehouseTransactions[idx] = { ...db.warehouseTransactions[idx], ...req.body }; saveDb(db); res.json(db.warehouseTransactions); } else res.status(404).send('Not Found'); });
app.get('/api/next-bijak-number', (req, res) => res.json({ nextNumber: calculateNextNumber(getDb(), 'bijak', req.query.company) }));

// PDF & Restore
app.post('/api/emergency-restore', (req, res) => { try { const { fileData } = req.body; const base64 = fileData.includes(',') ? fileData.split(',')[1] : fileData; const jsonStr = Buffer.from(base64, 'base64').toString('utf-8'); saveDb(JSON.parse(jsonStr)); res.json({ success: true }); } catch (e) { res.status(500).json({ success: false, error: e.message }); } });
app.post('/api/render-pdf', async (req, res) => { try { const { html, landscape, format, width, height } = req.body; const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] }); const page = await browser.newPage(); if(width && height) await page.setViewport({ width: 1200, height: 800 }); await page.setContent(html, { waitUntil: 'networkidle0' }); const pdf = await page.pdf({ printBackground: true, landscape: !!landscape, format: width ? undefined : (format || 'A4'), width, height }); await browser.close(); res.contentType("application/pdf"); res.send(pdf); } catch (e) { res.status(500).json({ error: e.message }); } });

// Static Files
app.use(express.static(path.join(ROOT_DIR, 'dist')));

// Fallback for SPA
app.get('*', (req, res) => { 
    if (req.url.startsWith('/api/')) return res.status(404).json({ error: 'API route not found' });
    const p = path.join(ROOT_DIR, 'dist', 'index.html'); 
    if(fs.existsSync(p)) res.sendFile(p); else res.send('Server Running. Frontend build missing.');
});

app.listen(PORT, '0.0.0.0', () => logToFile(`Server running on ${PORT}`));
