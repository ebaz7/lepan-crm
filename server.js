
import 'dotenv/config'; 
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import compression from 'compression'; 
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- TERMINAL DECORATION ---
const LOG_PREFIX = "\x1b[36m[SYSTEM DEBUG]\x1b[0m";
const ERR_PREFIX = "\x1b[31m[CRITICAL ERROR]\x1b[0m";

// --- INTELLIGENT PATH FINDER ---
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
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// --- THE MASTER SCHEMA ---
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
        printTemplates: [] 
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

/**
 * DEEP REPAIR ENGINE
 * Investigates the restored DB and fixes broken dependencies/missing tables.
 */
const performDeepRepair = (data) => {
    console.log(`${LOG_PREFIX} Running data integrity check...`);
    if (!data || typeof data !== 'object') {
        console.log(`${ERR_PREFIX} Database file is invalid or empty. Restoring factory defaults.`);
        return { ...DEFAULT_DB };
    }
    
    let repairCount = 0;
    Object.keys(DEFAULT_DB).forEach(key => {
        // If key is missing or is not the correct type (most should be Arrays)
        if (data[key] === undefined || data[key] === null) {
            console.log(`${LOG_PREFIX} Missing table detected: [${key}]. Re-initializing...`);
            data[key] = DEFAULT_DB[key];
            repairCount++;
        } else if (key !== 'settings' && !Array.isArray(data[key])) {
            console.log(`${ERR_PREFIX} Table [${key}] is corrupted (Not an Array). Converting to empty list.`);
            data[key] = [];
            repairCount++;
        }
    });

    // Deep check settings
    if (!data.settings || typeof data.settings !== 'object') {
        data.settings = DEFAULT_DB.settings;
        repairCount++;
    } else {
        Object.keys(DEFAULT_DB.settings).forEach(sKey => {
            if (data.settings[sKey] === undefined) {
                data.settings[sKey] = DEFAULT_DB.settings[sKey];
                repairCount++;
            }
        });
    }

    if (repairCount > 0) {
        console.log(`${LOG_PREFIX} Integrity Check Finished. Total repairs performed: ${repairCount}`);
        saveDb(data);
    } else {
        console.log(`${LOG_PREFIX} Integrity Check: Status Green. No schema mismatches found.`);
    }

    return data;
};

const getDb = () => {
    try {
        if (!fs.existsSync(DB_FILE)) { 
            console.log(`${LOG_PREFIX} No database file found. Creating new instance.`);
            saveDb(DEFAULT_DB); 
            return DEFAULT_DB; 
        }
        const data = fs.readFileSync(DB_FILE, 'utf8');
        let parsed;
        try {
            parsed = JSON.parse(data);
        } catch (jsonErr) {
            console.log(`${ERR_PREFIX} JSON Parse Failed! Data file is likely corrupted.`);
            throw jsonErr;
        }
        return performDeepRepair(parsed);
    } catch (e) { 
        console.error(`${ERR_PREFIX} Database Read Failure:`, e.message);
        // Return a safe minimal object to prevent route crashes
        return JSON.parse(JSON.stringify(DEFAULT_DB)); 
    }
};

const saveDb = (data) => {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    } catch (e) { 
        console.error(`${ERR_PREFIX} Database WRITE Failure:`, e.message); 
    }
};

// --- TERMINAL TRACE MIDDLEWARE ---
app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
        const timestamp = new Date().toLocaleTimeString();
        console.log(`${LOG_PREFIX} [${timestamp}] ${req.method} ${req.path}`);
        if (['POST', 'PUT'].includes(req.method)) {
            console.log(`${LOG_PREFIX} Body Sample:`, JSON.stringify(req.body).substring(0, 150) + "...");
        }
    }
    next();
});

// --- SAFE ROUTE WRAPPER ---
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(err => {
        console.error(`${ERR_PREFIX} Error in route [${req.method} ${req.path}]:`);
        console.error(err.stack); // PRINT FULL STACK TO CMD
        res.status(500).json({ 
            error: "Internal Server Error", 
            message: err.message,
            stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
    });
};

// --- CORE API ROUTES (NOW PROTECTED) ---

app.get('/api/version', (req, res) => {
    const db = getDb();
    res.json({ 
        version: '1.6.0-RECOVERY',
        stats: {
            orders: db.orders.length,
            warehouse: db.warehouseItems.length,
            trade: db.tradeRecords.length,
            chat: db.messages.length
        }
    });
});

app.post('/api/login', asyncHandler(async (req, res) => {
    const db = getDb();
    const { username, password } = req.body;
    const u = db.users.find(x => x.username === username && x.password === password);
    if (u) res.json(u); else res.status(401).send('Invalid Credentials');
}));

app.get('/api/settings', (req, res) => res.json(getDb().settings));
app.post('/api/settings', asyncHandler(async (req, res) => {
    const db = getDb();
    db.settings = { ...db.settings, ...req.body };
    saveDb(db);
    res.json(db.settings);
}));

app.get('/api/users', (req, res) => res.json(getDb().users));

// --- MODULE: WAREHOUSE (HEALED) ---
app.get('/api/warehouse/items', (req, res) => res.json(getDb().warehouseItems || []));
app.post('/api/warehouse/items', asyncHandler(async (req, res) => {
    const db = getDb();
    const item = req.body;
    item.id = item.id || Date.now().toString();
    db.warehouseItems.push(item);
    saveDb(db);
    console.log(`${LOG_PREFIX} Warehouse Item Created: ${item.name}`);
    res.json(db.warehouseItems);
}));

app.get('/api/warehouse/transactions', (req, res) => res.json(getDb().warehouseTransactions || []));
app.post('/api/warehouse/transactions', asyncHandler(async (req, res) => {
    const db = getDb();
    const tx = req.body;
    tx.id = tx.id || Date.now().toString();
    db.warehouseTransactions.unshift(tx);
    saveDb(db);
    res.json(db.warehouseTransactions);
}));

// --- MODULE: CONVERSATIONS (HEALED) ---
app.get('/api/chat', (req, res) => res.json(getDb().messages || []));
app.post('/api/chat', asyncHandler(async (req, res) => {
    const db = getDb();
    const msg = req.body;
    msg.id = msg.id || Date.now().toString();
    db.messages.push(msg);
    // Auto-prune old messages to prevent DB bloating
    if (db.messages.length > 3000) db.messages.shift();
    saveDb(db);
    res.json(db.messages);
}));

app.get('/api/groups', (req, res) => res.json(getDb().groups || []));
app.post('/api/groups', asyncHandler(async (req, res) => {
    const db = getDb();
    const group = req.body;
    group.id = group.id || Date.now().toString();
    db.groups.push(group);
    saveDb(db);
    res.json(db.groups);
}));

// --- MODULE: TRADE (HEALED) ---
app.get('/api/trade', (req, res) => res.json(getDb().tradeRecords || []));
app.post('/api/trade', asyncHandler(async (req, res) => {
    const db = getDb();
    const record = req.body;
    record.id = record.id || Date.now().toString();
    db.tradeRecords.unshift(record);
    saveDb(db);
    res.json(db.tradeRecords);
}));
app.put('/api/trade/:id', asyncHandler(async (req, res) => {
    const db = getDb();
    const idx = db.tradeRecords.findIndex(r => r.id === req.params.id);
    if (idx > -1) {
        db.tradeRecords[idx] = { ...db.tradeRecords[idx], ...req.body };
        saveDb(db);
        res.json(db.tradeRecords);
    } else res.status(404).send('Not Found');
}));

// --- EMERGENCY RESTORE ENDPOINT ---
app.post('/api/emergency-restore', asyncHandler(async (req, res) => {
    const { fileData } = req.body;
    if (!fileData) return res.status(400).send('No data provided');
    
    console.log(`${LOG_PREFIX} Emergency Restore Request Received.`);
    const base64 = fileData.includes(',') ? fileData.split(',')[1] : fileData;
    const jsonStr = Buffer.from(base64, 'base64').toString('utf-8');
    const parsed = JSON.parse(jsonStr);
    
    // The repair engine will handle schema mismatches in the restored file
    const repaired = performDeepRepair(parsed);
    saveDb(repaired);
    
    console.log(`${LOG_PREFIX} Emergency Restore Completed Successfully.`);
    res.json({ success: true });
}));

// --- START SERVER ---
app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n==============================================`);
    console.log(`   PAYMENT SYSTEM BACKEND - RECOVERY MODE`);
    console.log(`   Port: ${PORT}`);
    console.log(`   Database Path: ${DB_FILE}`);
    console.log(`==============================================\n`);
    
    // Initialize & Repair on startup
    const db = getDb();
    console.log(`${LOG_PREFIX} System Ready. Summary:`);
    console.log(`  - Users: ${db.users.length}`);
    console.log(`  - Orders: ${db.orders.length}`);
    console.log(`  - Warehouse Items: ${db.warehouseItems.length}`);
    console.log(`  - Trade Records: ${db.tradeRecords.length}`);
    console.log(`  - Chat History: ${db.messages.length}`);
});
