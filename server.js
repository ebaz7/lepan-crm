
import 'dotenv/config'; 
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import compression from 'compression'; 
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';

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
const UPLOADS_DIR = path.join(ROOT_DIR, 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const app = express();
const PORT = process.env.PORT || 3000;

let integrations = { whatsapp: null, telegram: null, bale: null };
(async () => {
    try { integrations.telegram = await import('./backend/telegram.js'); } catch (e) {}
    try { integrations.whatsapp = await import('./backend/whatsapp.js'); } catch (e) {}
    try { integrations.bale = await import('./backend/bale.js'); } catch (e) {}
})();

app.use(cors()); 
app.use(compression()); 
app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const getDb = () => {
    if (!fs.existsSync(DB_FILE)) return { settings: { currentExitPermitNumber: 1000 }, exitPermits: [], orders: [], users: [] };
    const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    if (!data.exitPermits) data.exitPermits = [];
    return data;
};

const saveDb = (data) => fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));

// API ROUTES
app.get('/api/version', (req, res) => res.json({ version: Date.now().toString() }));

app.get('/api/settings', (req, res) => res.json(getDb().settings));
app.post('/api/settings', (req, res) => {
    const db = getDb();
    db.settings = { ...db.settings, ...req.body };
    saveDb(db);
    res.json(db.settings);
});

app.get('/api/users', (req, res) => res.json(getDb().users));
app.post('/api/login', (req, res) => {
    const db = getDb();
    const u = db.users.find(x => x.username === req.body.username && x.password === req.body.password);
    u ? res.json(u) : res.status(401).send('Invalid');
});

// EXIT PERMITS - CRITICAL FIX FOR 404
app.get('/api/exit-permits', (req, res) => res.json(getDb().exitPermits));

app.post('/api/exit-permits', (req, res) => {
    const db = getDb();
    const permit = req.body;
    permit.id = permit.id || Date.now().toString();
    if (!permit.permitNumber || permit.permitNumber === 0) {
        const max = db.exitPermits.reduce((acc, p) => Math.max(acc, p.permitNumber || 0), db.settings.currentExitPermitNumber || 1000);
        permit.permitNumber = max + 1;
    }
    db.exitPermits.push(permit);
    saveDb(db);
    res.json(db.exitPermits);
});

app.put('/api/exit-permits/:id', (req, res) => {
    const db = getDb();
    const idx = db.exitPermits.findIndex(p => p.id === req.params.id);
    if (idx > -1) {
        db.exitPermits[idx] = { ...db.exitPermits[idx], ...req.body };
        saveDb(db);
        res.json(db.exitPermits);
    } else res.status(404).json({ error: "Permit Not Found" });
});

app.delete('/api/exit-permits/:id', (req, res) => {
    const db = getDb();
    db.exitPermits = db.exitPermits.filter(p => p.id !== req.params.id);
    saveDb(db);
    res.json(db.exitPermits);
});

app.get('/api/next-exit-permit-number', (req, res) => {
    const db = getDb();
    const max = db.exitPermits.reduce((acc, p) => Math.max(acc, p.permitNumber || 0), db.settings.currentExitPermitNumber || 1000);
    res.json({ nextNumber: max + 1 });
});

// MULTICHANNEL MESSAGING
app.post('/api/send-multichannel', async (req, res) => {
    const { targets, message, mediaData } = req.body;
    const db = getDb();
    const settings = db.settings;
    
    for (const target of targets) {
        try {
            if (target.type === 'whatsapp' && integrations.whatsapp) {
                await integrations.whatsapp.sendMessage(target.id, message, mediaData);
            } else if (target.type === 'telegram' && integrations.telegram && settings.telegramBotToken) {
                await integrations.telegram.sendDocument(target.id, mediaData, message);
            } else if (target.type === 'bale' && integrations.bale && settings.baleBotToken) {
                await integrations.bale.sendBaleMessage(settings.baleBotToken, target.id, message, mediaData);
            }
        } catch (e) { console.error(`Error sending to ${target.id}:`, e.message); }
    }
    res.json({ success: true });
});

app.use(express.static(path.join(ROOT_DIR, 'dist')));
app.get('*', (req, res) => res.sendFile(path.join(ROOT_DIR, 'dist', 'index.html')));

app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
