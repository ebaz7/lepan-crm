
import 'dotenv/config'; 
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import compression from 'compression'; 
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';
import { GoogleGenAI } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- INTELLIGENT PATH FINDER ---
const findRootDirectory = () => {
    const candidates = [
        "C:\\PaymentSystem", 
        __dirname,           
        process.cwd(),       
        path.resolve(__dirname, '..') 
    ];
    for (const dir of candidates) {
        if (fs.existsSync(path.join(dir, 'package.json'))) {
            return dir;
        }
    }
    return "C:\\PaymentSystem";
};

const ROOT_DIR = findRootDirectory();
const DB_FILE = path.join(ROOT_DIR, 'database.json');
const UPLOADS_DIR = path.join(ROOT_DIR, 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// --- INTEGRATIONS ---
let integrations = { whatsapp: null, telegram: null, bale: null };
(async () => {
    try { integrations.telegram = await import('./backend/telegram.js'); } catch (e) {}
    try { integrations.whatsapp = await import('./backend/whatsapp.js'); } catch (e) {}
    try { integrations.bale = await import('./backend/bale.js'); } catch (e) {}
})();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors()); 
app.use(compression()); 
app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use('/api/uploads', express.static(UPLOADS_DIR));

// --- DB HANDLERS ---
const getDb = () => {
    if (!fs.existsSync(DB_FILE)) return { settings: {}, exitPermits: [], orders: [], users: [] };
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
};

const saveDb = (data) => {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
};

// --- CORE API ROUTES ---
app.get('/api/version', (req, res) => res.json({ version: Date.now().toString() }));

// Settings
app.get('/api/settings', (req, res) => res.json(getDb().settings || {}));
app.post('/api/settings', (req, res) => { 
    const db = getDb(); 
    db.settings = { ...db.settings, ...req.body }; 
    saveDb(db); 
    res.json(db.settings); 
});

// Users
app.get('/api/users', (req, res) => res.json(getDb().users || []));
app.post('/api/login', (req, res) => { 
    const db = getDb(); 
    const u = db.users.find(x => x.username === req.body.username && x.password === req.body.password); 
    u ? res.json(u) : res.status(401).send('Invalid'); 
});

// Exit Permits (Fixing 404s and handling updates)
app.get('/api/exit-permits', (req, res) => res.json(getDb().exitPermits || []));

app.post('/api/exit-permits', (req, res) => {
    const db = getDb();
    const permit = req.body;
    permit.id = permit.id || Date.now().toString();
    if (!db.exitPermits) db.exitPermits = [];
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
    } else res.status(404).json({ error: "Permit not found" });
});

app.delete('/api/exit-permits/:id', (req, res) => {
    const db = getDb();
    db.exitPermits = (db.exitPermits || []).filter(p => p.id !== req.params.id);
    saveDb(db);
    res.json(db.exitPermits);
});

app.get('/api/next-exit-permit-number', (req, res) => {
    const db = getDb();
    const permits = db.exitPermits || [];
    const max = permits.reduce((acc, p) => Math.max(acc, Number(p.permitNumber) || 0), 1000);
    res.json({ nextNumber: max + 1 });
});

// --- MULTI-CHANNEL MESSAGING ---
app.post('/api/send-multichannel', async (req, res) => {
    const { targets, message, mediaData } = req.body;
    const db = getDb();
    const settings = db.settings;
    
    const results = [];
    for (const target of targets) {
        try {
            // WhatsApp
            if (target.type === 'whatsapp' && integrations.whatsapp) {
                await integrations.whatsapp.sendMessage(target.id, message, mediaData);
            }
            // Telegram
            if (target.type === 'telegram' && integrations.telegram && settings.telegramBotToken) {
                // Assuming telegram integration has sendDocument or sendPhoto
                await integrations.telegram.sendMessage(target.id, message, mediaData);
            }
            // Bale
            if (target.type === 'bale' && integrations.bale && settings.baleBotToken) {
                await integrations.bale.sendBaleMessage(settings.baleBotToken, target.id, message, mediaData);
            }
            results.push({ target: target.id, success: true });
        } catch (e) {
            results.push({ target: target.id, success: false, error: e.message });
        }
    }
    res.json({ success: true, results });
});

// Standard Fallbacks
app.use(express.static(path.join(ROOT_DIR, 'dist')));
app.get('*', (req, res) => {
    if (req.url.startsWith('/api/')) return res.status(404).json({ error: 'Not Found' });
    res.sendFile(path.join(ROOT_DIR, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
