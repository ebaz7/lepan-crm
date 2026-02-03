
import 'dotenv/config'; 
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import compression from 'compression'; 
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
    settings: { currentTrackingNumber: 1000, companyNames: [], companies: [], warehouseSequences: {}, brokerageSequences: {}, commodityGroups: [] }, 
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
        if (!fs.existsSync(DB_FILE)) { 
            fs.writeFileSync(DB_FILE, JSON.stringify(DEFAULT_DB, null, 2)); 
            return DEFAULT_DB; 
        }
        const data = fs.readFileSync(DB_FILE, 'utf8');
        const db = JSON.parse(data);
        // Ensure properties exist
        if (!db.brokerageItems) db.brokerageItems = [];
        if (!db.brokerageTransactions) db.brokerageTransactions = [];
        if (!db.settings.brokerageSequences) db.settings.brokerageSequences = {};
        return db;
    } catch (e) { return DEFAULT_DB; }
};

const saveDb = (db) => fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));

// --- BROKERAGE API ROUTES ---

app.get('/api/brokerage/next-serial', (req, res) => {
    const { company } = req.query;
    if (!company) return res.status(400).json({ error: 'Company is required' });
    const db = getDb();
    const sequences = db.settings.brokerageSequences || {};
    const next = (sequences[company] || 1000) + 1;
    res.json({ next });
});

app.get('/api/brokerage/items', (req, res) => {
    const db = getDb();
    res.json(db.brokerageItems || []);
});

app.post('/api/brokerage/items', (req, res) => {
    const db = getDb();
    const item = req.body;
    if (!item.name) return res.status(400).json({ message: 'Item name is required' });
    
    item.id = item.id || Date.now().toString() + Math.random().toString(36).substr(2, 5);
    db.brokerageItems.push(item);
    saveDb(db);
    res.status(201).json(item);
});

app.get('/api/brokerage/transactions', (req, res) => {
    const db = getDb();
    res.json(db.brokerageTransactions || []);
});

app.post('/api/brokerage/transactions', (req, res) => {
    const db = getDb();
    const tx = req.body;
    if (!tx.companyName || !tx.items) return res.status(400).json({ message: 'Missing required fields' });
    
    tx.id = tx.id || Date.now().toString();
    tx.createdAt = Date.now();
    
    // Update serial sequence for company
    if (!db.settings.brokerageSequences) db.settings.brokerageSequences = {};
    db.settings.brokerageSequences[tx.companyName] = Math.max(db.settings.brokerageSequences[tx.companyName] || 1000, tx.serialNumber);
    
    db.brokerageTransactions.unshift(tx);
    saveDb(db);
    res.status(201).json(tx);
});

app.put('/api/brokerage/transactions/:id', (req, res) => {
    const db = getDb();
    const idx = db.brokerageTransactions.findIndex(t => t.id === req.params.id);
    if (idx > -1) {
        db.brokerageTransactions[idx] = { ...db.brokerageTransactions[idx], ...req.body };
        saveDb(db);
        res.json(db.brokerageTransactions[idx]);
    } else {
        res.status(404).json({ message: 'Transaction not found' });
    }
});

// --- GENERAL ROUTES ---
app.get('/api/settings', (req, res) => res.json(getDb().settings));
app.post('/api/settings', (req, res) => { 
    const db = getDb(); 
    db.settings = { ...db.settings, ...req.body }; 
    saveDb(db); 
    res.json(db.settings); 
});

app.get('/api/orders', (req, res) => res.json(getDb().orders || []));
app.get('/api/users', (req, res) => res.json(getDb().users || []));

app.post('/api/login', (req, res) => { 
    const db = getDb(); 
    const u = db.users.find(x => x.username === req.body.username && x.password === req.body.password); 
    u ? res.json(u) : res.status(401).send('Invalid'); 
});

app.get('/api/version', (req, res) => res.json({ version: '1.2.0', status: 'online' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
