
import 'dotenv/config'; 
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import compression from 'compression'; 
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Persistence directory
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
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// THE MASTER SCHEMA - Every key required by the app
const DEFAULT_DB = { 
    settings: { 
        currentTrackingNumber: 1000, 
        currentExitPermitNumber: 1000,
        companyNames: [], 
        companies: [], 
        warehouseSequences: {}, 
        brokerageSequences: {}, 
        commodityGroups: [],
        rolePermissions: {},
        customRoles: [],
        printTemplates: [],
        fiscalYears: []
    }, 
    orders: [], 
    exitPermits: [],
    warehouseItems: [],
    warehouseTransactions: [],
    brokerageItems: [], 
    brokerageTransactions: [], 
    tradeRecords: [],
    users: [{ id: '1', username: 'admin', password: '123', fullName: 'مدیر سیستم', role: 'admin' }], 
    messages: [], 
    groups: [], 
    tasks: []
};

/**
 * DEEP SCHEMA VALIDATION
 * Ensures that even if a restore was partial, the missing keys are added.
 */
const getDb = () => {
    try {
        if (!fs.existsSync(DB_FILE)) { 
            fs.writeFileSync(DB_FILE, JSON.stringify(DEFAULT_DB, null, 2)); 
            console.log(">>> New database created.");
            return DEFAULT_DB; 
        }
        
        const data = fs.readFileSync(DB_FILE, 'utf8');
        let db = JSON.parse(data);

        // --- DEEP REPAIR ---
        let repaired = false;
        Object.keys(DEFAULT_DB).forEach(key => {
            if (db[key] === undefined) {
                console.warn(`[REPAIR] Missing table '${key}'. Initializing...`);
                db[key] = DEFAULT_DB[key];
                repaired = true;
            }
        });

        if (db.settings) {
            Object.keys(DEFAULT_DB.settings).forEach(sKey => {
                if (db.settings[sKey] === undefined) {
                    db.settings[sKey] = DEFAULT_DB.settings[sKey];
                    repaired = true;
                }
            });
        }

        if (repaired) saveDb(db);

        return db;
    } catch (e) { 
        console.error("Critical DB error:", e.message);
        return DEFAULT_DB; 
    }
};

const saveDb = (db) => {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    } catch (e) {
        console.error("DB Save Error:", e.message);
    }
};

// --- LOGGING MIDDLEWARE ---
app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
        console.log(`[API CALL] ${req.method} ${req.path}`);
    }
    next();
});

// --- CORE API ROUTES ---

// 1. SETTINGS & AUTH
app.get('/api/settings', (req, res) => res.json(getDb().settings));
app.post('/api/settings', (req, res) => { 
    const db = getDb(); db.settings = { ...db.settings, ...req.body }; 
    saveDb(db); res.json(db.settings); 
});

app.post('/api/login', (req, res) => { 
    const db = getDb(); 
    const u = db.users.find(x => x.username === req.body.username && x.password === req.body.password); 
    u ? res.json(u) : res.status(401).json({ error: 'Invalid credentials' }); 
});

// 2. USER MANAGEMENT
app.get('/api/users', (req, res) => res.json(getDb().users || []));
app.post('/api/users', (req, res) => {
    const db = getDb(); db.users.push(req.body);
    saveDb(db); res.json(db.users);
});
app.put('/api/users/:id', (req, res) => {
    const db = getDb(); const idx = db.users.findIndex(u => u.id === req.params.id);
    if (idx > -1) { db.users[idx] = req.body; saveDb(db); res.json(db.users); }
    else res.status(404).json({ error: 'Not found' });
});
app.delete('/api/users/:id', (req, res) => {
    const db = getDb(); db.users = db.users.filter(u => u.id !== req.params.id);
    saveDb(db); res.json(db.users);
});

// 3. PAYMENT ORDERS
app.get('/api/orders', (req, res) => res.json(getDb().orders || []));
app.post('/api/orders', (req, res) => {
    const db = getDb(); db.orders.unshift(req.body);
    saveDb(db); res.json(db.orders);
});
app.put('/api/orders/:id', (req, res) => {
    const db = getDb(); const idx = db.orders.findIndex(o => o.id === req.params.id);
    if (idx > -1) { db.orders[idx] = req.body; saveDb(db); res.json(db.orders); }
    else res.status(404).json({ error: 'Not found' });
});
app.delete('/api/orders/:id', (req, res) => {
    const db = getDb(); db.orders = db.orders.filter(o => o.id !== req.params.id);
    saveDb(db); res.json(db.orders);
});

// 4. TRADE MODULE (Commercial)
app.get('/api/trade', (req, res) => res.json(getDb().tradeRecords || []));
app.post('/api/trade', (req, res) => {
    const db = getDb(); db.tradeRecords.unshift(req.body);
    saveDb(db); res.json(db.tradeRecords);
});
app.put('/api/trade/:id', (req, res) => {
    const db = getDb(); const idx = db.tradeRecords.findIndex(t => t.id === req.params.id);
    if (idx > -1) { db.tradeRecords[idx] = req.body; saveDb(db); res.json(db.tradeRecords); }
    else res.status(404).json({ error: 'Not found' });
});
app.delete('/api/trade/:id', (req, res) => {
    const db = getDb(); db.tradeRecords = db.tradeRecords.filter(t => t.id !== req.params.id);
    saveDb(db); res.json(db.tradeRecords);
});

// 5. EXIT PERMITS
app.get('/api/exit-permits', (req, res) => res.json(getDb().exitPermits || []));
app.post('/api/exit-permits', (req, res) => {
    const db = getDb(); db.exitPermits.unshift(req.body);
    saveDb(db); res.json(db.exitPermits);
});
app.put('/api/exit-permits/:id', (req, res) => {
    const db = getDb(); const idx = db.exitPermits.findIndex(p => p.id === req.params.id);
    if (idx > -1) { db.exitPermits[idx] = req.body; saveDb(db); res.json(db.exitPermits); }
    else res.status(404).json({ error: 'Not found' });
});
app.delete('/api/exit-permits/:id', (req, res) => {
    const db = getDb(); db.exitPermits = db.exitPermits.filter(p => p.id !== req.params.id);
    saveDb(db); res.json(db.exitPermits);
});

// 6. CHAT & CONVERSATIONS
app.get('/api/chat', (req, res) => res.json(getDb().messages || []));
app.post('/api/chat', (req, res) => {
    const db = getDb(); db.messages.push(req.body);
    if (db.messages.length > 5000) db.messages.shift(); // Max 5k messages
    saveDb(db); res.json(db.messages);
});
app.delete('/api/chat/:id', (req, res) => {
    const db = getDb(); db.messages = db.messages.filter(m => m.id !== req.params.id);
    saveDb(db); res.json(db.messages);
});
app.put('/api/chat/:id', (req, res) => {
    const db = getDb(); const idx = db.messages.findIndex(m => m.id === req.params.id);
    if (idx > -1) { db.messages[idx] = req.body; saveDb(db); res.json(db.messages); }
    else res.status(404).json({ error: 'Not found' });
});

app.get('/api/groups', (req, res) => res.json(getDb().groups || []));
app.post('/api/groups', (req, res) => {
    const db = getDb(); db.groups.push(req.body);
    saveDb(db); res.json(db.groups);
});

app.get('/api/tasks', (req, res) => res.json(getDb().tasks || []));
app.post('/api/tasks', (req, res) => {
    const db = getDb(); db.tasks.push(req.body);
    saveDb(db); res.json(db.tasks);
});
app.put('/api/tasks/:id', (req, res) => {
    const db = getDb(); const idx = db.tasks.findIndex(t => t.id === req.params.id);
    if (idx > -1) { db.tasks[idx] = req.body; saveDb(db); res.json(db.tasks); }
    else res.status(404).json({ error: 'Not found' });
});

// 7. RESTORE ENGINE (CRITICAL)
app.post('/api/emergency-restore', (req, res) => {
    try {
        const { fileData } = req.body;
        if (!fileData) return res.status(400).json({ error: 'No data provided' });

        const base64Content = fileData.split(',')[1] || fileData;
        const jsonStr = Buffer.from(base64Content, 'base64').toString('utf8');
        const restoredData = JSON.parse(jsonStr);

        // Simple validation: must have users and settings at minimum
        if (!restoredData.users || !restoredData.settings) {
            return res.status(400).json({ error: 'Invalid database format' });
        }

        // Apply deep repair logic before saving
        Object.keys(DEFAULT_DB).forEach(key => {
            if (restoredData[key] === undefined) restoredData[key] = DEFAULT_DB[key];
        });

        saveDb(restoredData);
        console.log(">>> Database successfully restored via Emergency API.");
        res.json({ success: true });
    } catch (e) {
        console.error("Restore failed:", e.message);
        res.status(500).json({ error: 'Restore execution failed', details: e.message });
    }
});

// 8. HELPERS
app.get('/api/next-tracking-number', (req, res) => {
    const db = getDb(); const { company } = req.query;
    // Simple global increment for now, or per-company if fiscal year enabled
    let next = (db.settings.currentTrackingNumber || 1000) + 1;
    res.json({ nextTrackingNumber: next });
});

app.get('/api/next-exit-permit-number', (req, res) => {
    const db = getDb();
    let next = (db.settings.currentExitPermitNumber || 1000) + 1;
    res.json({ nextExitPermitNumber: next });
});

app.get('/api/version', (req, res) => {
    const db = getDb();
    res.json({ 
        version: '1.6.0-RECOVERY', 
        counts: {
            trade: db.tradeRecords?.length || 0,
            orders: db.orders?.length || 0,
            messages: db.messages?.length || 0,
            users: db.users?.length || 0,
            exitPermits: db.exitPermits?.length || 0
        }
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n==============================================`);
    console.log(`   BACKEND RECOVERY MODE: Port ${PORT}`);
    console.log(`   Database Path: ${DB_FILE}`);
    console.log(`==============================================\n`);
    getDb(); // Initial load/repair
});
