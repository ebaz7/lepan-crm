
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

    // Enforce Arrays
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
        // Enforce nested settings arrays
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
        
        // AUTO-REPAIR: Sanitize structure on every load to fix runtime issues immediately
        const safeData = sanitizeDb(parsed);
        
        // Optional: If we fixed something critical (like null orders), save it back to sync disk
        if (parsed.orders === null || parsed.exitPermits === null) {
            logToFile("Auto-repaired DB structure in memory.");
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
        // Ensure data is valid before saving
        const safeData = sanitizeDb(data);
        fs.writeFileSync(tempFile, JSON.stringify(safeData, null, 2));
        fs.renameSync(tempFile, DB_FILE);
    } catch (e) {
        logToFile("!!! Error saving DB: " + e.message);
    }
};

// --- AUTOMATIC BACKUP SYSTEM (HOURLY) ---
const scheduleAutoBackup = () => {
    logToFile(">>> Initializing Auto-Backup System (Every Hour)");
    cron.schedule('0 * * * *', () => {
        try {
            const now = new Date();
            const timestamp = now.toISOString().replace(/[:.]/g, '-');
            const backupPath = path.join(BACKUPS_DIR, `auto_backup_${timestamp}.json`);
            
            if (fs.existsSync(DB_FILE)) {
                fs.copyFileSync(DB_FILE, backupPath);
                
                const files = fs.readdirSync(BACKUPS_DIR);
                const nowMs = Date.now();
                const retentionMs = 48 * 60 * 60 * 1000; 
                
                files.forEach(file => {
                    if (file.startsWith('auto_backup_')) {
                        const filePath = path.join(BACKUPS_DIR, file);
                        const stats = fs.statSync(filePath);
                        if (nowMs - stats.mtimeMs > retentionMs) {
                            fs.unlinkSync(filePath);
                        }
                    }
                });
            }
        } catch (e) {
            logToFile(`[AutoBackup] Failed: ${e.message}`);
        }
    });
};
scheduleAutoBackup();


// --- ROBUST NUMBER GENERATOR (SCAN MODE) ---
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
                    if (o.payingCompany && o.payingCompany.trim() === safeCompany) {
                        const num = parseInt(o.trackingNumber);
                        if (!isNaN(num) && num > maxFoundInDb) maxFoundInDb = num;
                    }
                });
            }
            if (activeYear && activeYear.companySequences && activeYear.companySequences[safeCompany]) {
                fiscalStart = parseInt(activeYear.companySequences[safeCompany].startTrackingNumber) || 0;
            }
            if (maxFoundInDb === 0 && fiscalStart === 0) {
                fiscalStart = parseInt(db.settings.currentTrackingNumber) || 1000;
            }

        } else if (type === 'exit') {
            if (Array.isArray(db.exitPermits)) {
                db.exitPermits.forEach(p => {
                    if (p.company && p.company.trim() === safeCompany) {
                        const num = parseInt(p.permitNumber);
                        if (!isNaN(num) && num > maxFoundInDb) maxFoundInDb = num;
                    }
                });
            }
            if (activeYear && activeYear.companySequences && activeYear.companySequences[safeCompany]) {
                fiscalStart = parseInt(activeYear.companySequences[safeCompany].startExitPermitNumber) || 0;
            }
            if (maxFoundInDb === 0 && fiscalStart === 0) {
                fiscalStart = parseInt(db.settings.currentExitPermitNumber) || 1000;
            }

        } else if (type === 'bijak') {
            if (Array.isArray(db.warehouseTransactions)) {
                db.warehouseTransactions
                    .filter(t => t.type === 'OUT' && t.company && t.company.trim() === safeCompany)
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
        // Fallback random to prevent block, but ensure > 1000
        return 1000 + Math.floor(Math.random() * 100); 
    }
    
    let nextNum = 0;
    
    if (maxFoundInDb > 0) {
        nextNum = Math.max(maxFoundInDb + 1, fiscalStart);
    } else {
        nextNum = fiscalStart > 0 ? fiscalStart : 1001;
    }
    
    logToFile(`[NumberGen] ${type} for ${safeCompany}: DB_Max=${maxFoundInDb}, Fiscal=${fiscalStart} -> Next=${nextNum}`);
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

// --- SAFE BACKUP RESTORE (FIXED) ---
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

        // SANITIZE AND MERGE
        // We use sanitizeDb on the parsed data to fix any null arrays BEFORE merging
        const safeParsed = sanitizeDb(parsed);
        
        // Merge with defaults to ensure missing new fields exist, but prioritize backup data
        const finalDb = { ...DEFAULT_DB, ...safeParsed };
        
        // Double check deep merge for settings to avoid losing new settings features
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
        
        // Ensure array exists
        if (!Array.isArray(db.orders)) db.orders = [];

        // FORCE SERVER-SIDE CALCULATION
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
        
        // Ensure array exists
        if (!Array.isArray(db.exitPermits)) db.exitPermits = [];

        // FORCE SERVER-SIDE CALCULATION
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
        
        // If OUT transaction, calculate number based on company
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
