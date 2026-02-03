
import 'dotenv/config'; 
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import compression from 'compression'; 
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure we find the correct root directory for persistence
const findRootDirectory = () => {
    const candidates = ["C:\\PaymentSystem", __dirname, process.cwd()];
    for (const dir of candidates) {
        if (fs.existsSync(path.join(dir, 'package.json'))) return dir;
    }
    return "C:\\PaymentSystem";
};

const ROOT_DIR = findRootDirectory();
const DB_FILE = path.join(ROOT_DIR, 'database.json');

const app = express();
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

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
        rolePermissions: {}
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
 * DEEP SCHEMA VALIDATION (Root Cause Fix)
 * Ensures that if a DB restore was partial/older, the missing keys are added.
 */
const getDb = () => {
    try {
        if (!fs.existsSync(DB_FILE)) { 
            fs.writeFileSync(DB_FILE, JSON.stringify(DEFAULT_DB, null, 2)); 
            return DEFAULT_DB; 
        }
        
        const data = fs.readFileSync(DB_FILE, 'utf8');
        let db;
        try {
            db = JSON.parse(data);
        } catch (parseError) {
            console.error("Corrupted JSON detected. Backup current and starting fresh.");
            fs.renameSync(DB_FILE, `${DB_FILE}.corrupt.${Date.now()}`);
            return DEFAULT_DB;
        }

        // --- SELF-HEALING LOGIC ---
        // Ensure all top-level keys exist
        Object.keys(DEFAULT_DB).forEach(key => {
            if (db[key] === undefined) {
                console.warn(`Missing key '${key}' detected after restore. Repairing...`);
                db[key] = DEFAULT_DB[key];
            }
        });

        // Ensure nested settings keys exist
        Object.keys(DEFAULT_DB.settings).forEach(sKey => {
            if (db.settings[sKey] === undefined) {
                db.settings[sKey] = DEFAULT_DB.settings[sKey];
            }
        });

        return db;
    } catch (e) { 
        console.error("Critical DB error:", e);
        return DEFAULT_DB; 
    }
};

const saveDb = (db) => {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    } catch (e) {
        console.error("DB Save Error:", e);
    }
};

// --- ROUTES ---

// 1. BROKERAGE MODULE
const brokerageRouter = express.Router();

brokerageRouter.get('/next-serial', (req, res) => {
    const { company } = req.query;
    if (!company) return res.status(400).json({ error: 'Company is required' });
    const db = getDb();
    const sequences = db.settings.brokerageSequences || {};
    const next = (sequences[company] || 1000) + 1;
    res.json({ next });
});

brokerageRouter.get('/items', (req, res) => res.json(getDb().brokerageItems || []));

brokerageRouter.post('/items', (req, res) => {
    const db = getDb();
    const item = req.body;
    if (!item || !item.name) return res.status(400).json({ message: 'نام کالا الزامی است.' });
    db.brokerageItems.push(item);
    saveDb(db);
    res.status(201).json(item);
});

brokerageRouter.get('/transactions', (req, res) => res.json(getDb().brokerageTransactions || []));

brokerageRouter.post('/transactions', (req, res) => {
    const db = getDb();
    const tx = req.body;
    if (!tx || !tx.companyName) return res.status(400).json({ message: 'اطلاعات ناقص.' });
    
    // Update sequences
    if (!db.settings.brokerageSequences) db.settings.brokerageSequences = {};
    db.settings.brokerageSequences[tx.companyName] = Math.max(db.settings.brokerageSequences[tx.companyName] || 1000, tx.serialNumber);
    
    db.brokerageTransactions.unshift(tx);
    saveDb(db);
    res.status(201).json(tx);
});

brokerageRouter.put('/transactions/:id', (req, res) => {
    const db = getDb();
    const idx = db.brokerageTransactions.findIndex(t => t.id === req.params.id);
    if (idx > -1) {
        db.brokerageTransactions[idx] = { ...db.brokerageTransactions[idx], ...req.body };
        saveDb(db);
        res.json(db.brokerageTransactions[idx]);
    } else res.status(404).json({ message: 'یافت نشد' });
});

// 2. WAREHOUSE MODULE
const warehouseRouter = express.Router();
warehouseRouter.get('/items', (req, res) => res.json(getDb().warehouseItems || []));
warehouseRouter.post('/items', (req, res) => {
    const db = getDb();
    db.warehouseItems.push(req.body);
    saveDb(db);
    res.json(db.warehouseItems);
});
warehouseRouter.get('/transactions', (req, res) => res.json(getDb().warehouseTransactions || []));
warehouseRouter.post('/transactions', (req, res) => {
    const db = getDb();
    db.warehouseTransactions.unshift(req.body);
    saveDb(db);
    res.json(db.warehouseTransactions);
});

// 3. PAYMENT ORDERS (Existing Logic)
app.get('/api/orders', (req, res) => res.json(getDb().orders || []));
app.post('/api/orders', (req, res) => {
    const db = getDb();
    db.orders.unshift(req.body);
    saveDb(db);
    res.json(db.orders);
});

// 4. GENERAL
app.use('/api/brokerage', brokerageRouter);
app.use('/api/warehouse', warehouseRouter);

app.get('/api/settings', (req, res) => res.json(getDb().settings));
app.post('/api/settings', (req, res) => { 
    const db = getDb(); 
    db.settings = { ...db.settings, ...req.body }; 
    saveDb(db); 
    res.json(db.settings); 
});

app.post('/api/login', (req, res) => { 
    const db = getDb(); 
    const u = db.users.find(x => x.username === req.body.username && x.password === req.body.password); 
    u ? res.json(u) : res.status(401).send('Invalid'); 
});

app.get('/api/version', (req, res) => res.json({ version: '1.5.0-STABLE', db_status: 'repaired' }));

// Global 404 for API to catch route drifts
app.use('/api/*', (req, res) => {
    console.warn(`[404] Missing Route: ${req.method} ${req.originalUrl}`);
    res.status(404).json({ error: 'Route not found on server', path: req.originalUrl });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server stable on port ${PORT}`));
