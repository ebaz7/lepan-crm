
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

const app = express();
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '50mb' }));

const DEFAULT_DB = { 
    settings: { currentTrackingNumber: 1000, companyNames: [], companies: [], warehouseSequences: {}, commodityGroups: [] }, 
    orders: [], 
    brokerageItems: [], 
    brokerageTransactions: [], 
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
        if (!db.brokerageItems) db.brokerageItems = [];
        if (!db.brokerageTransactions) db.brokerageTransactions = [];
        return db;
    } catch (e) { return DEFAULT_DB; }
};

const saveDb = (db) => fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));

// --- BROKERAGE API ---

app.get('/api/brokerage/next-serial', (req, res) => {
    const { company } = req.query;
    const db = getDb();
    const sequences = db.settings.brokerageSequences || {};
    const next = (sequences[company] || 1000) + 1;
    res.json({ next });
});

app.get('/api/brokerage/items', (req, res) => res.json(getDb().brokerageItems));
app.post('/api/brokerage/items', (req, res) => {
    const db = getDb();
    const item = req.body;
    item.id = item.id || Date.now().toString();
    db.brokerageItems.push(item);
    saveDb(db);
    res.json(db.brokerageItems);
});

app.get('/api/brokerage/transactions', (req, res) => res.json(getDb().brokerageTransactions));
app.post('/api/brokerage/transactions', (req, res) => {
    const db = getDb();
    const tx = req.body;
    tx.id = tx.id || Date.now().toString();
    tx.createdAt = Date.now();
    
    // Update serial sequence for company
    if (!db.settings.brokerageSequences) db.settings.brokerageSequences = {};
    db.settings.brokerageSequences[tx.companyName] = Math.max(db.settings.brokerageSequences[tx.companyName] || 1000, tx.serialNumber);
    
    db.brokerageTransactions.unshift(tx);
    saveDb(db);
    res.json(db.brokerageTransactions);
});

app.put('/api/brokerage/transactions/:id', (req, res) => {
    const db = getDb();
    const idx = db.brokerageTransactions.findIndex(t => t.id === req.params.id);
    if (idx > -1) {
        db.brokerageTransactions[idx] = { ...db.brokerageTransactions[idx], ...req.body };
        saveDb(db);
        res.json(db.brokerageTransactions);
    } else res.status(404).send('Not found');
});

// Existing routes...
app.get('/api/settings', (req, res) => res.json(getDb().settings));
app.post('/api/settings', (req, res) => { const db = getDb(); db.settings = { ...db.settings, ...req.body }; saveDb(db); res.json(db.settings); });
app.get('/api/orders', (req, res) => res.json(getDb().orders));
app.get('/api/users', (req, res) => res.json(getDb().users));
app.post('/api/login', (req, res) => { const db = getDb(); const u = db.users.find(x => x.username === req.body.username && x.password === req.body.password); u ? res.json(u) : res.status(401).send('Invalid'); });

app.listen(3000, '0.0.0.0', () => console.log('Server running on 3000'));
