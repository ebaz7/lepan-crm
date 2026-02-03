
import 'dotenv/config'; 
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import compression from 'compression'; 
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- DIAGNOSTIC UTILS ---
const REPORT_FILE = path.join(process.cwd(), 'diagnostic_report.log');
const logToReport = (msg) => {
    const timestamp = new Date().toISOString();
    const formattedMsg = `[${timestamp}] ${msg}\n`;
    fs.appendFileSync(REPORT_FILE, formattedMsg);
    console.log(msg);
};

// Clear old report on start
if (fs.existsSync(REPORT_FILE)) fs.unlinkSync(REPORT_FILE);

const findRootDirectory = () => {
    const candidates = ["C:\\PaymentSystem", __dirname, process.cwd()];
    for (const dir of candidates) {
        if (fs.existsSync(path.join(dir, 'package.json'))) return dir;
    }
    return process.cwd();
};

const ROOT_DIR = findRootDirectory();
const DB_FILE = path.join(ROOT_DIR, 'database.json');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors()); 
app.use(compression()); 
app.use(express.json({ limit: '100mb' })); 

// --- THE MASTER SCHEMA (For Comparison) ---
const SCHEMA_TEMPLATE = { 
    settings: { companyNames: [], companies: [], warehouseSequences: {}, customRoles: [] }, 
    orders: [], 
    exitPermits: [], 
    warehouseItems: [], 
    warehouseTransactions: [], 
    users: [], 
    messages: [], 
    groups: [], 
    tasks: [], 
    tradeRecords: [], 
    securityLogs: [], 
    personnelDelays: [], 
    securityIncidents: []
};

/**
 * CORE DIAGNOSTIC ENGINE
 * Runs deep validation on the restored database
 */
const runFullDatabaseDiagnosis = (data) => {
    logToReport("=== STARTING SYSTEM DIAGNOSIS ===");
    let issues = 0;

    if (!data || typeof data !== 'object') {
        logToReport("CRITICAL: Database file is not a valid JSON object!");
        return;
    }

    // 1. Check Table Existence & Types
    Object.keys(SCHEMA_TEMPLATE).forEach(key => {
        if (data[key] === undefined) {
            logToReport(`BROKEN: Module Data [${key}] is MISSING. All related functions will fail.`);
            issues++;
        } else if (key !== 'settings' && !Array.isArray(data[key])) {
            logToReport(`BROKEN: Module Data [${key}] should be an ARRAY but is ${typeof data[key]}. This causes .map()/.filter() crashes.`);
            issues++;
        }
    });

    // 2. Warehouse Module Deep Check
    if (Array.isArray(data.warehouseItems) && Array.isArray(data.warehouseTransactions)) {
        logToReport(`Warehouse: Found ${data.warehouseItems.length} items and ${data.warehouseTransactions.length} transactions.`);
        const itemIds = new Set(data.warehouseItems.map(i => i.id));
        data.warehouseTransactions.forEach((tx, idx) => {
            tx.items?.forEach(line => {
                if (!itemIds.has(line.itemId)) {
                    logToReport(`DATA ERROR: Warehouse Transaction #${tx.number} references non-existent Item ID: ${line.itemId}`);
                    issues++;
                }
            });
        });
    }

    // 3. Commercial Module Deep Check
    if (Array.isArray(data.tradeRecords)) {
        logToReport(`Commercial: Found ${data.tradeRecords.length} trade records.`);
        data.tradeRecords.forEach((record, idx) => {
            if (!record.stages || typeof record.stages !== 'object') {
                logToReport(`DATA ERROR: Trade Record [${record.fileNumber || idx}] is missing the 'stages' object. UI will crash on load.`);
                issues++;
            }
        });
    }

    // 4. Chat Module Check
    if (Array.isArray(data.messages)) {
        logToReport(`Conversations: Found ${data.messages.length} messages.`);
    }

    logToReport(`=== DIAGNOSIS COMPLETE: ${issues} ISSUES IDENTIFIED ===`);
    if (issues > 0) {
        logToReport("NOTICE: System is unstable. See 'diagnostic_report.log' for details.");
    }
};

const getDb = () => {
    try {
        if (!fs.existsSync(DB_FILE)) return JSON.parse(JSON.stringify(SCHEMA_TEMPLATE));
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        return parsed;
    } catch (e) { 
        logToReport(`CRITICAL: Failed to read database file: ${e.message}`);
        return null; 
    }
};

// --- TRACE MIDDLEWARE ---
app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
        logToReport(`TRACE: [${req.method}] ${req.path}`);
    }
    next();
});

// --- SAFE ROUTE WRAPPER (Captures Exceptions) ---
const handle = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(err => {
        const errorDetail = `
FAILED API CALL: ${req.method} ${req.path}
ERROR: ${err.message}
STACK: ${err.stack}
----------------------------------------`;
        logToReport(errorDetail);
        res.status(500).json({ 
            diagnostic_error: true,
            message: err.message,
            module_hint: req.path.split('/')[2] 
        });
    });
};

// --- DIAGNOSTIC API ---
app.get('/api/admin/diagnose', handle(async (req, res) => {
    const db = getDb();
    runFullDatabaseDiagnosis(db);
    const report = fs.readFileSync(REPORT_FILE, 'utf8');
    res.send(`<pre dir="ltr">${report}</pre>`);
}));

// --- MODULE ROUTES (PROXIES FOR TRACING) ---

app.get('/api/warehouse/items', handle(async (req, res) => {
    const db = getDb();
    res.json(db.warehouseItems);
}));

app.get('/api/trade', handle(async (req, res) => {
    const db = getDb();
    res.json(db.tradeRecords);
}));

app.get('/api/chat', handle(async (req, res) => {
    const db = getDb();
    res.json(db.messages);
}));

app.get('/api/settings', handle(async (req, res) => {
    const db = getDb();
    res.json(db.settings);
}));

// Fallback for missing routes
app.use('/api/*', (req, res) => {
    logToReport(`ALERT: Requested non-existent API endpoint: ${req.method} ${req.originalUrl}`);
    res.status(404).json({ error: "Endpoint not found in current backend trace." });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`
===================================================
    DIAGNOSTIC SERVER STARTED on Port ${PORT}
    Database: ${DB_FILE}
    Report: ${REPORT_FILE}
===================================================
    `);
    
    // Immediate Scan on Startup
    const db = getDb();
    if (db) runFullDatabaseDiagnosis(db);
});
