
import 'dotenv/config'; 
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import compression from 'compression'; 
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- DB CONFIG ---
const findRootDirectory = () => {
    const candidates = ["C:\\PaymentSystem", __dirname, process.cwd()];
    for (const dir of candidates) {
        if (fs.existsSync(path.join(dir, 'package.json'))) return dir;
    }
    return "C:\\PaymentSystem";
};

const ROOT_DIR = findRootDirectory();
const DB_FILE = path.join(ROOT_DIR, 'database.json');
const UPLOADS_DIR = path.join(ROOT_DIR, 'uploads');

const app = express();
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '50mb' }));

const DEFAULT_DB = { 
    settings: { currentTrackingNumber: 1000, companyNames: [], companies: [], warehouseSequences: {}, commodityGroups: [] }, 
    orders: [], 
    warehouseItems: [], 
    warehouseTransactions: [], 
    tradeRecords: [],
    users: [{ id: '1', username: 'admin', password: '123', fullName: 'مدیر سیستم', role: 'admin' }], 
    messages: [], 
    groups: [], 
    tasks: []
};

const getDb = () => {
    try {
        if (!fs.existsSync(DB_FILE)) { fs.writeFileSync(DB_FILE, JSON.stringify(DEFAULT_DB, null, 2)); return DEFAULT_DB; }
        const data = fs.readFileSync(DB_FILE, 'utf8');
        const db = JSON.parse(data);
        // Ensure warehouse arrays exist
        if (!db.warehouseItems) db.warehouseItems = [];
        if (!db.warehouseTransactions) db.warehouseTransactions = [];
        return db;
    } catch (e) { return DEFAULT_DB; }
};

const saveDb = (db) => fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));

// --- API ROUTES ---

// Next Number Helper for Warehouse
app.get('/api/warehouse/next-number', (req, res) => {
    const { company, type } = req.query;
    const db = getDb();
    const sequences = db.settings.warehouseSequences || {};
    const key = `${company}_${type}`;
    const next = (sequences[key] || 1000) + 1;
    res.json({ next });
});

// Warehouse Items
app.get('/api/warehouse/items', (req, res) => res.json(getDb().warehouseItems));
app.post('/api/warehouse/items', (req, res) => {
    const db = getDb();
    const item = req.body;
    item.id = item.id || Date.now().toString();
    db.warehouseItems.push(item);
    saveDb(db);
    res.json(db.warehouseItems);
});

// Warehouse Transactions (IN/OUT)
app.get('/api/warehouse/transactions', (req, res) => res.json(getDb().warehouseTransactions));
app.post('/api/warehouse/transactions', (req, res) => {
    const db = getDb();
    const tx = req.body;
    tx.id = tx.id || Date.now().toString();
    tx.createdAt = Date.now();
    
    // Update company sequence
    const key = `${tx.company}_${tx.type}`;
    if (!db.settings.warehouseSequences) db.settings.warehouseSequences = {};
    db.settings.warehouseSequences[key] = Math.max(db.settings.warehouseSequences[key] || 1000, tx.number);
    
    db.warehouseTransactions.unshift(tx);
    saveDb(db);
    res.json(db.warehouseTransactions);
});

app.put('/api/warehouse/transactions/:id', (req, res) => {
    const db = getDb();
    const idx = db.warehouseTransactions.findIndex(t => t.id === req.params.id);
    if (idx > -1) {
        db.warehouseTransactions[idx] = { ...db.warehouseTransactions[idx], ...req.body };
        saveDb(db);
        res.json(db.warehouseTransactions);
    } else res.status(404).send('Not found');
});

// Settings & Users (Standard)
app.get('/api/settings', (req, res) => res.json(getDb().settings));
app.post('/api/settings', (req, res) => { const db = getDb(); db.settings = { ...db.settings, ...req.body }; saveDb(db); res.json(db.settings); });
app.get('/api/orders', (req, res) => res.json(getDb().orders));
app.get('/api/users', (req, res) => res.json(getDb().users));
app.post('/api/login', (req, res) => { const db = getDb(); const u = db.users.find(x => x.username === req.body.username && x.password === req.body.password); u ? res.json(u) : res.status(401).send('Invalid'); });

// Version
app.get('/api/version', (req, res) => res.json({ version: '2.0.0_warehouse' }));

// Messaging Integration Placeholder
app.post('/api/send-whatsapp', async (req, res) => {
    const { number, message, mediaData } = req.body;
    // Relay to your whatsapp module (e.g. backend/whatsapp.js)
    console.log(`Relaying notification to ${number}`);
    res.json({ success: true });
});

// Serving App
app.use(express.static(path.join(ROOT_DIR, 'dist')));
app.get('*', (req, res) => res.sendFile(path.join(ROOT_DIR, 'dist', 'index.html')));

app.listen(3000, '0.0.0.0', () => console.log('Server running on 3000'));
