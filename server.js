
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

// --- CRITICAL ERROR LOGGING ---
const logToFile = (message) => {
    const timestamp = new Date().toISOString();
    try {
        if (!fs.existsSync(ROOT_DIR)) fs.mkdirSync(ROOT_DIR, { recursive: true });
        fs.appendFileSync(LOG_FILE, `[${timestamp}] ${message}\n`);
        console.log(message);
    } catch (e) {
        console.error("Logger failed:", e);
    }
};

// --- PREVENT CRASH ON UNCAUGHT ERRORS ---
process.on('uncaughtException', (err) => {
    logToFile(`!!! UNCAUGHT EXCEPTION: ${err.message}`);
    console.error(err);
});

process.on('unhandledRejection', (reason, promise) => {
    logToFile(`!!! UNHANDLED REJECTION: ${reason}`);
});

// Ensure critical directories exist
[UPLOADS_DIR, BACKUPS_DIR, WAUTH_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
        try { fs.mkdirSync(dir, { recursive: true }); } catch(e) { logToFile(`Error creating dir ${dir}: ${e.message}`); }
    }
});

const app = express();
const PORT = process.env.PORT || 3000;
const SERVER_BUILD_ID = Date.now().toString();

// --- INTEGRATION IMPORTS (WRAPPED SAFE) ---
let integrations = {
    whatsapp: null,
    telegram: null,
    bale: null
};

(async () => {
    try {
        integrations.telegram = await import('./backend/telegram.js');
    } catch (e) { logToFile("Telegram Import Warning: " + e.message); }
    
    try {
        integrations.whatsapp = await import('./backend/whatsapp.js');
    } catch (e) { logToFile("WhatsApp Import Warning: " + e.message); }
    
    try {
        integrations.bale = await import('./backend/bale.js');
    } catch (e) { logToFile("Bale Import Warning: " + e.message); }
})();

app.use(cors()); 
app.use(compression()); 
app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(ROOT_DIR, 'dist')));
app.use('/uploads', express.static(UPLOADS_DIR));

// --- DEFAULT DB STRUCTURE (The Source of Truth) ---
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
    users: [{ id: '1', username: 'admin', password: '123', fullName: 'مدیر سیستم', role: 'admin' }], 
    messages: [], 
    groups: [], 
    tasks: [], 
    tradeRecords: [], 
    securityLogs: [], 
    personnelDelays: [], 
    securityIncidents: []
};

// --- DATA SANITIZER (CRITICAL FIX FOR CORRUPT RESTORES) ---
const sanitizeDb = (data) => {
    if (!data || typeof data !== 'object') return { ...DEFAULT_DB };

    // Enforce Arrays (Fixes "push is not a function" error)
    if (!Array.isArray(data.orders)) data.orders = [];
    if (!Array.isArray(data.exitPermits)) data.exitPermits = [];
    if (!Array.isArray(data.warehouseItems)) data.warehouseItems = [];
    if (!Array.isArray(data.warehouseTransactions)) data.warehouseTransactions = [];
    if (!Array.isArray(data.users)) data.users = DEFAULT_DB.users;
    if (!Array.isArray(data.tradeRecords)) data.tradeRecords = [];
    if (!Array.isArray(data.securityLogs)) data.securityLogs = [];
    if (!Array.isArray(data.personnelDelays)) data.personnelDelays = [];
    if (!Array.isArray(data.securityIncidents)) data.securityIncidents = [];
    
    // Enforce Settings Object
    if (!data.settings || typeof data.settings !== 'object') {
        data.settings = { ...DEFAULT_DB.settings };
    } else {
        if (!Array.isArray(data.settings.companies)) data.settings.companies = [];
        if (!Array.isArray(data.settings.fiscalYears)) data.settings.fiscalYears = [];
        if (!Array.isArray(data.settings.printTemplates)) data.settings.printTemplates = [];
        if (!data.settings.warehouseSequences) data.settings.warehouseSequences = {};
        if (!data.settings.rolePermissions) data.settings.rolePermissions = {};
    }

    return data;
};

// --- FAIL-SAFE DATABASE LOADER ---
const getDb = () => {
    try {
        if (!fs.existsSync(DB_FILE)) {
            logToFile("DB Missing. Creating new.");
            saveDb(DEFAULT_DB);
            return DEFAULT_DB;
        }
        
        const data = fs.readFileSync(DB_FILE, 'utf8');
        if (!data || data.trim() === '') throw new Error("Empty DB File");
        
        let parsed;
        try {
            parsed = JSON.parse(data);
        } catch (jsonErr) {
            logToFile("DB JSON Corrupt. Backup created. Resetting.");
            fs.copyFileSync(DB_FILE, `${DB_FILE}.corrupt`);
            return DEFAULT_DB;
        }
        
        // AUTO-REPAIR: Sanitize structure on every load
        const safeData = sanitizeDb(parsed);
        
        // Save back if fixed critical errors
        if (parsed.orders === null || parsed.exitPermits === null) {
            logToFile("Auto-repaired DB structure in memory.");
            saveDb(safeData);
        }
        
        return safeData;

    } catch (e) {
        logToFile(`!!! CRITICAL DB ERROR: ${e.message}`);
        return DEFAULT_DB; 
    }
};

const saveDb = (data) => {
    try {
        const tempFile = `${DB_FILE}.tmp`;
        const safeData = sanitizeDb(data);
        fs.writeFileSync(tempFile, JSON.stringify(safeData, null, 2));
        fs.renameSync(tempFile, DB_FILE);
    } catch (e) {
        logToFile("!!! Error saving DB: " + e.message);
    }
};

// --- ROBUST NUMBER GENERATOR (SCAN MODE - THE FIX) ---
// Scans the DB for the highest number to recover from bad backups/settings
const calculateNextNumber = (db, type, companyName = null) => {
    let maxFoundInDb = 0;
    
    // Normalize inputs
    const safeCompany = companyName ? companyName.trim() : (db.settings.defaultCompany || '');
    const activeYearId = db.settings.activeFiscalYearId;
    const activeYear = activeYearId ? db.settings.fiscalYears?.find(y => y.id === activeYearId) : null;
    let fiscalStart = 0;

    try {
        if (type === 'payment') {
            if (Array.isArray(db.orders)) {
                db.orders.forEach(o => {
                    // Check Global OR Company sequence depending on logic.
                    // Assuming global sequence for orders usually, but if fiscal year has company specifics:
                    if (activeYear && activeYear.companySequences?.[safeCompany]) {
                        if (o.payingCompany === safeCompany) {
                             const num = parseInt(o.trackingNumber);
                             if (!isNaN(num) && num > maxFoundInDb) maxFoundInDb = num;
                        }
                    } else {
                        // Global Sequence Fallback
                        const num = parseInt(o.trackingNumber);
                        if (!isNaN(num) && num > maxFoundInDb) maxFoundInDb = num;
                    }
                });
            }
            // Fiscal override
            if (activeYear && activeYear.companySequences && activeYear.companySequences[safeCompany]) {
                fiscalStart = parseInt(activeYear.companySequences[safeCompany].startTrackingNumber) || 0;
            }
            // Global setting fallback
            if (maxFoundInDb === 0 && fiscalStart === 0) {
                fiscalStart = parseInt(db.settings.currentTrackingNumber) || 1000;
            }

        } else if (type === 'exit') {
            if (Array.isArray(db.exitPermits)) {
                db.exitPermits.forEach(p => {
                    // Exit Permits usually company specific or global? Let's Assume Global unless filtered
                    // To be safe, find MAX globally to avoid collision if not strictly scoped
                    const num = parseInt(p.permitNumber);
                    if (!isNaN(num) && num > maxFoundInDb) maxFoundInDb = num;
                });
            }
            if (activeYear && activeYear.companySequences && activeYear.companySequences[safeCompany]) {
                fiscalStart = parseInt(activeYear.companySequences[safeCompany].startExitPermitNumber) || 0;
            }
            if (maxFoundInDb === 0 && fiscalStart === 0) {
                fiscalStart = parseInt(db.settings.currentExitPermitNumber) || 1000;
            }

        } else if (type === 'bijak') {
            // Bijaks ARE Company Specific usually
            if (Array.isArray(db.warehouseTransactions)) {
                db.warehouseTransactions
                    .filter(t => t.type === 'OUT' && t.company === safeCompany)
                    .forEach(t => {
                        const num = parseInt(t.number);
                        if (!isNaN(num) && num > maxFoundInDb) maxFoundInDb = num;
                    });
            }
            if (activeYear && activeYear.companySequences && activeYear.companySequences[safeCompany]) {
                fiscalStart = parseInt(activeYear.companySequences[safeCompany].startBijakNumber) || 0;
            }
            if (maxFoundInDb === 0 && fiscalStart === 0) {
                fiscalStart = parseInt(db.settings.warehouseSequences?.[safeCompany]) || 1000;
            }
        }
    } catch (e) {
        logToFile(`[NumberGen] Error calculating ${type}: ${e.message}`);
        return 1000 + Math.floor(Math.random() * 100); 
    }
    
    let nextNum = 0;
    
    // Algorithm: Look at Max in DB. If Max >= FiscalStart, next is Max+1. 
    // If Max < FiscalStart (new year), next is FiscalStart.
    if (maxFoundInDb > 0) {
        nextNum = Math.max(maxFoundInDb + 1, fiscalStart);
    } else {
        nextNum = fiscalStart > 0 ? fiscalStart : 1001;
    }
    
    // Update settings cache to reflect reality (Fixes the settings lag)
    if (type === 'payment' && !activeYear) db.settings.currentTrackingNumber = nextNum;
    if (type === 'exit' && !activeYear) db.settings.currentExitPermitNumber = nextNum;
    if (type === 'bijak' && !activeYear && safeCompany) {
         if (!db.settings.warehouseSequences) db.settings.warehouseSequences = {};
         db.settings.warehouseSequences[safeCompany] = nextNum;
    }

    logToFile(`[NumberGen] ${type} (Co: ${safeCompany}): MaxDB=${maxFoundInDb}, Fiscal=${fiscalStart} -> NEXT=${nextNum}`);
    return nextNum;
};

// --- ROUTES ---
app.get('/api/version', (req, res) => res.json({ version: SERVER_BUILD_ID }));

// Convert Render HTML to PDF
app.post('/api/render-pdf', async (req, res) => {
    try {
        const { html, landscape, format, width, height } = req.body;
        if (!html) return res.status(400).json({ error: "HTML content required" });
        
        const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
        const page = await browser.newPage();
        
        if (width && height) {
            await page.setViewport({ width: 1200, height: 800 }); 
        }

        await page.setContent(html, { waitUntil: 'networkidle0' });

        const pdfOptions = { printBackground: true, landscape: !!landscape };
        if (width && height) { pdfOptions.width = width; pdfOptions.height = height; }
        else { pdfOptions.format = format || 'A4'; }

        const pdfBuffer = await page.pdf(pdfOptions);
        await browser.close();
        res.contentType("application/pdf");
        res.send(pdfBuffer);
    } catch (e) {
        logToFile(`PDF Error: ${e.message}`);
        res.status(500).json({ error: "Failed to generate PDF", details: e.message });
    }
});

// AI Request Proxy
app.post('/api/ai-request', async (req, res) => {
    try {
        const { message } = req.body;
        const db = getDb();
        if (!db.settings.geminiApiKey) throw new Error("API Key Missing");
        const { GoogleGenAI } = await import('@google/genai');
        const ai = new GoogleGenAI({ apiKey: db.settings.geminiApiKey });
        const result = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: [{ role: 'user', parts: [{ text: message }] }]
        });
        res.json({ reply: result.text });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/login', (req, res) => { 
    const db = getDb();
    const u = db.users.find(x => x.username === req.body.username && x.password === req.body.password); 
    u ? res.json(u) : res.status(401).send('Invalid'); 
});

// --- SAFE BACKUP RESTORE ---
app.post('/api/emergency-restore', (req, res) => {
    try {
        const { fileData } = req.body;
        if (!fileData) throw new Error("No data");
        
        const base64 = fileData.includes(',') ? fileData.split(',')[1] : fileData;
        const jsonStr = Buffer.from(base64, 'base64').toString('utf-8');
        let parsed;
        try {
            parsed = JSON.parse(jsonStr);
        } catch(e) {
            throw new Error("Invalid JSON File");
        }

        const safeParsed = sanitizeDb(parsed);
        const finalDb = { ...DEFAULT_DB, ...safeParsed };
        finalDb.settings = { ...DEFAULT_DB.settings, ...safeParsed.settings };

        saveDb(finalDb);
        
        logToFile("Database Restored & Sanitized Successfully via Emergency Route");
        res.json({ success: true });
    } catch (e) {
        logToFile(`Restore Failed: ${e.message}`);
        res.status(500).json({ success: false, error: e.message });
    }
});

// --- ORDERS ---
app.get('/api/orders', (req, res) => res.json(getDb().orders || []));
app.post('/api/orders', (req, res) => { 
    try {
        const db = getDb(); 
        const order = req.body; 
        order.id = Date.now().toString(); 
        
        // FORCE SERVER-SIDE CALCULATION (DB Scan)
        const finalNum = calculateNextNumber(db, 'payment', order.payingCompany);
        order.trackingNumber = finalNum;
        
        db.orders.unshift(order); 
        saveDb(db); 
        res.json(db.orders);
    } catch(e) {
        logToFile("Order Save Error: " + e.message);
        res.status(500).json({ error: "Failed to save order" });
    }
});

app.get('/api/next-tracking-number', (req, res) => {
    const db = getDb();
    const company = req.query.company; 
    const nextNum = calculateNextNumber(db, 'payment', company);
    res.json({ nextTrackingNumber: nextNum });
});

// --- EXIT PERMITS ---
app.get('/api/exit-permits', (req, res) => res.json(getDb().exitPermits || []));
app.post('/api/exit-permits', (req, res) => { 
    try {
        const db = getDb(); 
        const permit = req.body; 
        
        // FORCE SERVER-SIDE CALCULATION (DB Scan)
        const finalNum = calculateNextNumber(db, 'exit', permit.company);
        permit.permitNumber = finalNum;

        db.exitPermits.push(permit); 
        saveDb(db); 
        res.json(db.exitPermits);
    } catch(e) {
        logToFile("Exit Permit Save Error: " + e.message);
        res.status(500).json({ error: "Failed to save permit" });
    }
});

app.get('/api/next-exit-permit-number', (req, res) => {
    const db = getDb();
    const company = req.query.company;
    const nextNum = calculateNextNumber(db, 'exit', company);
    res.json({ nextNumber: nextNum });
});

// --- WAREHOUSE ---
app.get('/api/next-bijak-number', (req, res) => {
    const db = getDb();
    const company = req.query.company;
    // For Bijak, company is mandatory for sequence tracking
    if (!company) return res.json({ nextNumber: 1000 });
    const nextNum = calculateNextNumber(db, 'bijak', company);
    res.json({ nextNumber: nextNum });
});

app.get('/api/settings', (req, res) => res.json(getDb().settings));
app.post('/api/settings', (req, res) => { const db = getDb(); db.settings = { ...db.settings, ...req.body }; saveDb(db); res.json(db.settings); });
app.get('/api/users', (req, res) => res.json(getDb().users || []));

// Warehouse transactions
app.get('/api/warehouse/transactions', (req, res) => res.json(getDb().warehouseTransactions || []));
app.post('/api/warehouse/transactions', (req, res) => { 
    try {
        const db = getDb(); 
        const tx = req.body; 

        if (!Array.isArray(db.warehouseTransactions)) db.warehouseTransactions = [];
        
        // If OUT transaction (Bijak), calculate number based on company
        if (tx.type === 'OUT') {
            const finalNum = calculateNextNumber(db, 'bijak', tx.company);
            tx.number = finalNum;
        }
        
        db.warehouseTransactions.unshift(tx); 
        saveDb(db); 
        res.json(db.warehouseTransactions); 
    } catch (e) {
        logToFile("Warehouse Tx Save Error: " + e.message);
        res.status(500).json({ error: "Failed to save transaction" });
    }
});

// Serve React App
app.get('*', (req, res) => { 
    const p = path.join(ROOT_DIR, 'dist', 'index.html'); 
    if(fs.existsSync(p)) res.sendFile(p); 
    else res.send('System is running. React build not found in dist/.'); 
});

const server = app.listen(PORT, '0.0.0.0', () => {
    logToFile(`\n>>> Server successfully running on port ${PORT}`);
});
