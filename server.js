
import 'dotenv/config'; 
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import compression from 'compression'; 
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// --- ROBUST DB SCHEMA DEFINITION ---
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
 * SELF-HEALING DATABASE LOGIC
 * Compares current DB to DEFAULT_DB and fixes missing module tables.
 */
const sanitizeDb = (data) => {
    if (!data || typeof data !== 'object') return { ...DEFAULT_DB };
    
    let repaired = false;
    Object.keys(DEFAULT_DB).forEach(key => {
        if (!data[key] || !Array.isArray(data[key]) && key !== 'settings') {
            console.log(`[SCHEMA REPAIR] Initializing missing table: ${key}`);
            data[key] = DEFAULT_DB[key];
            repaired = true;
        }
    });

    if (!data.settings) {
        data.settings = DEFAULT_DB.settings;
        repaired = true;
    }

    if (repaired) {
        console.log(">>> Database schema was repaired. Saving changes...");
        saveDb(data);
    }
    return data;
};

const getDb = () => {
    try {
        if (!fs.existsSync(DB_FILE)) { 
            console.log(`>>> Creating new database at: ${DB_FILE}`);
            saveDb(DEFAULT_DB); 
            return DEFAULT_DB; 
        }
        const data = fs.readFileSync(DB_FILE, 'utf8');
        return sanitizeDb(JSON.parse(data));
    } catch (e) { 
        console.error("CRITICAL: Failed to read database.json:", e.message);
        return DEFAULT_DB; 
    }
};

const saveDb = (data) => {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    } catch (e) { console.error("CRITICAL: Failed to write database.json:", e.message); }
};

// --- TERMINAL TRACING MIDDLEWARE ---
app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
        console.log(`[DEBUG] ${new Date().toLocaleTimeString()} | ${req.method} ${req.path}`);
    }
    next();
});

// --- API ROUTES ---

// System Version & Health
app.get('/api/version', (req, res) => {
    const db = getDb();
    res.json({ 
        version: '1.5.1-DEBUG',
        counts: {
            orders: db.orders.length,
            trade: db.tradeRecords.length,
            messages: db.messages.length,
            exitPermits: db.exitPermits.length
        }
    });
});

app.post('/api/login', (req, res) => { 
    const db = getDb(); 
    const u = db.users.find(x => x.username === req.body.username && x.password === req.body.password); 
    u ? res.json(u) : res.status(401).send('Invalid'); 
});

// Settings & Users
app.get('/api/settings', (req, res) => res.json(getDb().settings));
app.post('/api/settings', (req, res) => { 
    const db = getDb(); 
    db.settings = { ...db.settings, ...req.body }; 
    saveDb(db); 
    res.json(db.settings); 
});
app.get('/api/users', (req, res) => res.json(getDb().users));

// MODULE: PAYMENTS
app.get('/api/orders', (req, res) => res.json(getDb().orders));
app.post('/api/orders', (req, res) => { 
    const db = getDb(); 
    const order = req.body; 
    order.id = Date.now().toString(); 
    db.orders.unshift(order); 
    saveDb(db); 
    res.json(db.orders); 
});
app.put('/api/orders/:id', (req, res) => {
    const db = getDb();
    const idx = db.orders.findIndex(o => o.id === req.params.id);
    if(idx > -1) { db.orders[idx] = { ...db.orders[idx], ...req.body }; saveDb(db); res.json(db.orders); }
    else res.status(404).json({error: 'Not found'});
});

// MODULE: TRADE (Commercial) - RE-IMPLEMENTED
app.get('/api/trade', (req, res) => res.json(getDb().tradeRecords || []));
app.post('/api/trade', (req, res) => {
    const db = getDb();
    const record = req.body;
    record.id = Date.now().toString();
    db.tradeRecords.unshift(record);
    saveDb(db);
    res.json(db.tradeRecords);
});
app.put('/api/trade/:id', (req, res) => {
    const db = getDb();
    const idx = db.tradeRecords.findIndex(t => t.id === req.params.id);
    if(idx > -1) { db.tradeRecords[idx] = { ...db.tradeRecords[idx], ...req.body }; saveDb(db); res.json(db.tradeRecords); }
    else res.status(404).json({error: 'Not found'});
});

// MODULE: CHAT & CONVERSATIONS - RE-IMPLEMENTED
app.get('/api/chat', (req, res) => res.json(getDb().messages || []));
app.post('/api/chat', (req, res) => {
    const db = getDb();
    const msg = req.body;
    msg.id = Date.now().toString();
    db.messages.push(msg);
    if (db.messages.length > 2000) db.messages.shift(); // Hard cap for performance
    saveDb(db);
    res.json(db.messages);
});

app.get('/api/groups', (req, res) => res.json(getDb().groups || []));
app.post('/api/groups', (req, res) => {
    const db = getDb();
    const grp = req.body;
    grp.id = Date.now().toString();
    db.groups.push(grp);
    saveDb(db);
    res.json(db.groups);
});

app.get('/api/tasks', (req, res) => res.json(getDb().tasks || []));
app.post('/api/tasks', (req, res) => {
    const db = getDb();
    const task = req.body;
    task.id = Date.now().toString();
    db.tasks.push(task);
    saveDb(db);
    res.json(db.tasks);
});

// MODULE: WAREHOUSE & EXIT PERMITS
app.get('/api/exit-permits', (req, res) => res.json(getDb().exitPermits || []));
app.post('/api/exit-permits', (req, res) => {
    const db = getDb();
    const permit = req.body;
    permit.id = Date.now().toString();
    db.exitPermits.push(permit);
    saveDb(db);
    res.json(db.exitPermits);
});

app.get('/api/warehouse/items', (req, res) => res.json(getDb().warehouseItems || []));
app.post('/api/warehouse/items', (req, res) => {
    const db = getDb();
    const item = req.body;
    item.id = Date.now().toString();
    db.warehouseItems.push(item);
    saveDb(db);
    res.json(db.warehouseItems);
});

app.get('/api/warehouse/transactions', (req, res) => res.json(getDb().warehouseTransactions || []));
app.post('/api/warehouse/transactions', (req, res) => {
    const db = getDb();
    const tx = req.body;
    tx.id = Date.now().toString();
    db.warehouseTransactions.unshift(tx);
    saveDb(db);
    res.json(db.warehouseTransactions);
});

// MODULE: SECURITY
app.get('/api/security/logs', (req, res) => res.json(getDb().securityLogs || []));
app.get('/api/security/delays', (req, res) => res.json(getDb().personnelDelays || []));
app.get('/api/security/incidents', (req, res) => res.json(getDb().securityIncidents || []));

// EMERGENCY DATABASE RESTORE ENDPOINT (UI FIX)
app.post('/api/emergency-restore', (req, res) => {
    try {
        const { fileData } = req.body;
        const base64 = fileData.includes(',') ? fileData.split(',')[1] : fileData;
        const jsonStr = Buffer.from(base64, 'base64').toString('utf-8');
        const parsed = JSON.parse(jsonStr);
        saveDb(sanitizeDb(parsed));
        console.log(">>> [RESTORE SUCCESS] Database overwritten by emergency request.");
        res.json({ success: true });
    } catch (e) { 
        console.error(">>> [RESTORE FAILED]", e.message);
        res.status(500).json({ success: false, error: e.message }); 
    }
});

// START SERVER
app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n==============================================`);
    console.log(`   PAYMENT SYSTEM BACKEND (HEAL MODE)`);
    console.log(`   PORT: ${PORT}`);
    console.log(`   ROOT: ${ROOT_DIR}`);
    console.log(`   DB FILE: ${DB_FILE}`);
    console.log(`==============================================\n`);
    
    // Test Load
    const db = getDb();
    console.log(`[STARTUP SUMMARY]`);
    console.log(`- Orders Found: ${db.orders.length}`);
    console.log(`- Trade Records Found: ${db.tradeRecords.length}`);
    console.log(`- Chat Messages Found: ${db.messages.length}`);
    console.log(`- Warehouse Items Found: ${db.warehouseItems.length}`);
    console.log(`==============================================\n`);
});
