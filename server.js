
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import compression from 'compression';
import { initWhatsApp, sendMessage, getGroups, getStatus, logout, restartSession } from './backend/whatsapp.js';
import { initTelegram } from './backend/telegram.js';
import { initBaleBot } from './backend/bale.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'database.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

console.log(`>>> Server Starting...`);
console.log(`>>> Database Path: ${DB_PATH}`);
console.log(`>>> Uploads Path: ${UPLOADS_DIR}`);

// Ensure DB and Uploads exist
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR);

const defaultDbStructure = { 
    users: [{ id: '1', username: 'admin', password: '123', fullName: 'مدیر سیستم', role: 'admin' }],
    orders: [],
    exitPermits: [],
    warehouseTransactions: [],
    tradeRecords: [],
    settings: { currentTrackingNumber: 1000, currentExitPermitNumber: 1000, companyNames: [] },
    chat: [],
    groups: [],
    tasks: [],
    warehouseItems: [],
    securityLogs: [],
    personnelDelays: [],
    securityIncidents: []
};

if (!fs.existsSync(DB_PATH)) {
    console.log(">>> Creating new database.json");
    fs.writeFileSync(DB_PATH, JSON.stringify(defaultDbStructure, null, 2));
}

// Middleware
app.use(cors());
app.options('*', cors()); 
app.use(compression());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/uploads', express.static(UPLOADS_DIR));
app.use(express.static(path.join(__dirname, 'dist')));

// Database Helpers
const getDb = () => {
    try {
        const raw = fs.readFileSync(DB_PATH, 'utf8');
        const data = JSON.parse(raw);
        // Merge with default structure to ensure all keys exist
        return { ...defaultDbStructure, ...data };
    } catch (e) {
        console.error(">>> CRITICAL DB READ ERROR:", e);
        return defaultDbStructure;
    }
};

const saveDb = (data) => {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error(">>> CRITICAL DB SAVE ERROR:", e);
    }
};

// --- AUTH ---
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const db = getDb();
    const user = (db.users || []).find(u => u.username === username && u.password === password);
    if (user) res.json(user);
    else res.status(401).json({ error: 'نام کاربری یا رمز عبور اشتباه است' });
});

// --- GENERIC CRUD HANDLER ---
const createCrudRoutes = (route, key) => {
    app.get(`/api/${route}`, (req, res) => {
        const db = getDb();
        res.json(db[key] || []);
    });

    app.post(`/api/${route}`, (req, res) => {
        const db = getDb();
        if (!db[key]) db[key] = [];
        db[key].push(req.body);
        saveDb(db);
        res.json(db[key]);
    });

    app.put(`/api/${route}/:id`, (req, res) => {
        const db = getDb();
        if (!db[key]) db[key] = [];
        const index = db[key].findIndex(i => String(i.id) === String(req.params.id));
        if (index !== -1) {
            db[key][index] = { ...db[key][index], ...req.body };
            saveDb(db);
        }
        res.json(db[key]);
    });

    app.delete(`/api/${route}/:id`, (req, res) => {
        const db = getDb();
        if (!db[key]) db[key] = [];
        db[key] = db[key].filter(i => String(i.id) !== String(req.params.id));
        saveDb(db);
        res.json(db[key]);
    });
};

// Initialize Standard Routes
createCrudRoutes('orders', 'orders');
createCrudRoutes('users', 'users');
createCrudRoutes('chat', 'chat');
createCrudRoutes('groups', 'groups');
createCrudRoutes('tasks', 'tasks');
createCrudRoutes('trade', 'tradeRecords');
createCrudRoutes('warehouse/items', 'warehouseItems');
createCrudRoutes('warehouse/transactions', 'warehouseTransactions');
createCrudRoutes('security/logs', 'securityLogs');
createCrudRoutes('security/delays', 'personnelDelays');
createCrudRoutes('security/incidents', 'securityIncidents');

// --- EXIT PERMITS (MANUAL ROUTES) ---
app.get('/api/exit-permits', (req, res) => res.json(getDb().exitPermits || []));

app.post('/api/exit-permits', (req, res) => {
    const db = getDb();
    if (!db.exitPermits) db.exitPermits = [];
    db.exitPermits.push(req.body);
    if (db.settings && req.body.permitNumber > (db.settings.currentExitPermitNumber || 0)) {
        db.settings.currentExitPermitNumber = req.body.permitNumber;
    }
    saveDb(db);
    res.json(db.exitPermits);
});

app.put('/api/exit-permits/:id', (req, res) => {
    const db = getDb();
    if (!db.exitPermits) db.exitPermits = [];
    const idx = db.exitPermits.findIndex(p => String(p.id) === String(req.params.id));
    if (idx !== -1) {
        db.exitPermits[idx] = { ...db.exitPermits[idx], ...req.body };
        saveDb(db);
    }
    res.json(db.exitPermits);
});

app.delete('/api/exit-permits/:id', (req, res) => {
    try {
        const db = getDb();
        const idToDelete = String(req.params.id).trim(); 
        
        if (!Array.isArray(db.exitPermits)) { db.exitPermits = []; }

        const initialLen = db.exitPermits.length;
        db.exitPermits = db.exitPermits.filter(p => String(p.id) !== idToDelete);
        
        if (db.exitPermits.length === initialLen) {
             if (!isNaN(Number(idToDelete))) {
                 db.exitPermits = db.exitPermits.filter(p => String(p.permitNumber) !== idToDelete);
             }
        }

        saveDb(db);
        res.json(db.exitPermits);
    } catch (e) {
        console.error("Delete Error:", e);
        res.status(500).json({ error: "Server Delete Error" });
    }
});

// Settings
app.get('/api/settings', (req, res) => res.json(getDb().settings || {}));
app.post('/api/settings', (req, res) => {
    const db = getDb();
    db.settings = req.body;
    saveDb(db);
    if(req.body.telegramBotToken) initTelegram(req.body.telegramBotToken);
    if(req.body.baleBotToken) initBaleBot(req.body.baleBotToken);
    res.json(db.settings);
});

// Counters
app.get('/api/next-tracking-number', (req, res) => {
    const db = getDb();
    const company = req.query.company;
    let nextNum = 1001;

    if (db.settings && db.settings.activeFiscalYearId) {
        const year = db.settings.fiscalYears?.find(y => y.id === db.settings.activeFiscalYearId);
        if (year && year.companySequences && company && year.companySequences[company]) {
            nextNum = (year.companySequences[company].startTrackingNumber || 1000) + 1;
        }
    } else if (db.settings) {
        nextNum = (db.settings.currentTrackingNumber || 1000) + 1;
    }
    res.json({ nextTrackingNumber: nextNum });
});

app.get('/api/next-exit-permit-number', (req, res) => {
    const db = getDb();
    const company = req.query.company;
    let nextNum = 1001;

    if (db.settings && db.settings.activeFiscalYearId) {
        const year = db.settings.fiscalYears?.find(y => y.id === db.settings.activeFiscalYearId);
        if (year && year.companySequences && company && year.companySequences[company]) {
            nextNum = (year.companySequences[company].startExitPermitNumber || 1000) + 1;
        }
    } else if (db.settings) {
        nextNum = (db.settings.currentExitPermitNumber || 1000) + 1;
    }
    res.json({ nextNumber: nextNum });
});

app.get('/api/next-bijak-number', (req, res) => {
    const db = getDb();
    const company = req.query.company;
    let nextNum = 1001;
    
    if (db.settings && db.settings.activeFiscalYearId) {
        const year = db.settings.fiscalYears?.find(y => y.id === db.settings.activeFiscalYearId);
        if (year && year.companySequences && company && year.companySequences[company]) {
             nextNum = (year.companySequences[company].startBijakNumber || 1000) + 1;
        }
    } else if (db.settings) {
        if (company && db.settings.warehouseSequences && db.settings.warehouseSequences[company]) {
            nextNum = db.settings.warehouseSequences[company] + 1;
        } else {
            const max = Math.max(0, ...(db.warehouseTransactions?.filter(t => t.type === 'OUT').map(t => t.number) || []));
            nextNum = max + 1;
        }
    }
    res.json({ nextNumber: nextNum });
});

// Upload
app.post('/api/upload', (req, res) => {
    try {
        const { fileName, fileData } = req.body;
        if (!fileName || !fileData) return res.status(400).json({ error: 'Missing data' });

        const base64Data = fileData.split(';base64,').pop();
        const ext = path.extname(fileName);
        const name = `${Date.now()}_${Math.floor(Math.random() * 1000)}${ext}`;
        const filePath = path.join(UPLOADS_DIR, name);

        fs.writeFileSync(filePath, base64Data, { encoding: 'base64' });
        res.json({ fileName: fileName, url: `/uploads/${name}` });
    } catch (e) {
        console.error("Upload Error:", e);
        res.status(500).json({ error: 'Upload Failed' });
    }
});

// WhatsApp
app.get('/api/whatsapp/status', (req, res) => res.json(getStatus()));
app.get('/api/whatsapp/groups', async (req, res) => {
    try {
        const groups = await getGroups();
        res.json({ success: true, groups });
    } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/whatsapp/logout', async (req, res) => { await logout(); res.json({ success: true }); });
app.post('/api/whatsapp/restart', async (req, res) => { 
    await restartSession(path.join(__dirname, 'wauth')); 
    res.json({ success: true }); 
});
app.post('/api/send-whatsapp', async (req, res) => {
    try {
        const { number, message, mediaData } = req.body;
        await sendMessage(number, message, mediaData);
        res.json({ success: true });
    } catch (e) {
        console.error("Send WA Error:", e);
        res.status(500).json({ error: e.message });
    }
});

// System
app.get('/api/version', (req, res) => res.json({ version: '2.5.2' }));

app.post('/api/restart-bot', (req, res) => {
    const { type } = req.body;
    const db = getDb();
    if (type === 'telegram' && db.settings.telegramBotToken) initTelegram(db.settings.telegramBotToken);
    if (type === 'bale' && db.settings.baleBotToken) initBaleBot(db.settings.baleBotToken);
    if (type === 'whatsapp') restartSession(path.join(__dirname, 'wauth'));
    res.json({ success: true });
});

app.post('/api/emergency-restore', (req, res) => {
    try {
        const { fileData } = req.body;
        if (!fileData) return res.status(400).json({ error: 'No data' });
        const jsonStr = Buffer.from(fileData.split(',').pop(), 'base64').toString('utf-8');
        const data = JSON.parse(jsonStr);
        if (data.users && data.settings) {
            saveDb(data);
            res.json({ success: true, mode: 'json' });
        } else {
            res.status(400).json({ error: 'Invalid DB Format' });
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Serve
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`>>> Server running on port ${PORT}`);
    const db = getDb();
    if (db.settings) {
        if (db.settings.telegramBotToken) initTelegram(db.settings.telegramBotToken);
        if (db.settings.baleBotToken) initBaleBot(db.settings.baleBotToken);
    }
    initWhatsApp(path.join(__dirname, 'wauth'));
});
