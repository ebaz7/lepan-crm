
import 'dotenv/config'; 
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import compression from 'compression'; 
import { fileURLToPath } from 'url';
import cron from 'node-cron'; 

import * as TelegramBotModule from './backend/telegram.js';
import * as BaleBotModule from './backend/bale.js';
import * as WhatsAppModule from './backend/whatsapp.js';
import * as Renderer from './backend/renderer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = __dirname; 
const DB_FILE = path.join(ROOT_DIR, 'database.json');
const UPLOADS_DIR = path.join(ROOT_DIR, 'uploads');
const WAUTH_DIR = path.join(ROOT_DIR, 'wauth');

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(WAUTH_DIR)) fs.mkdirSync(WAUTH_DIR, { recursive: true });

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors()); 
app.use(compression()); 
app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use('/uploads', express.static(UPLOADS_DIR));

// DB Helpers
const getDb = () => {
    try {
        if (!fs.existsSync(DB_FILE)) return { settings: {}, orders: [], exitPermits: [], users: [] };
        return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch (e) { return {}; }
};
const saveDb = (data) => fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));

// --- NOTIFICATION TRIGGER ---
const triggerBotNotification = async (type, item) => {
    const db = getDb();
    const token = db.settings.telegramBotToken;
    // Simple logic: Notify Admins
    const admins = db.users.filter(u => u.role === 'admin' || u.role === 'ceo');
    
    try {
        // Generate Image
        const imageBuffer = await Renderer.generateRecordImage(item, type === 'NEW_PAYMENT' ? 'PAYMENT' : 'EXIT');
        const caption = type === 'NEW_PAYMENT' ? 
            `💰 *درخواست پرداخت جدید*\nشماره: ${item.trackingNumber}\nمبلغ: ${parseInt(item.totalAmount).toLocaleString()}` :
            `🚛 *مجوز خروج جدید*\nشماره: ${item.permitNumber}\nگیرنده: ${item.recipientName}`;

        for (const admin of admins) {
            if (admin.telegramChatId) {
                TelegramBotModule.sendTelegramPhoto(admin.telegramChatId, imageBuffer, caption);
            }
            // Add Bale support similar way
        }
    } catch (e) { console.error("Notification Error", e); }
};

// --- ROUTES ---

app.get('/api/orders', (req, res) => res.json(getDb().orders || []));
app.post('/api/orders', (req, res) => { 
    const db = getDb(); 
    const order = req.body; 
    order.id = order.id || Date.now().toString(); 
    if(!db.orders) db.orders = [];
    db.orders.unshift(order); 
    saveDb(db); 
    
    // Trigger Bot
    triggerBotNotification('NEW_PAYMENT', order);
    
    res.json(db.orders); 
});

app.get('/api/exit-permits', (req, res) => res.json(getDb().exitPermits || []));
app.post('/api/exit-permits', (req, res) => {
    const db = getDb();
    const permit = req.body;
    permit.id = permit.id || Date.now().toString();
    if(!db.exitPermits) db.exitPermits = [];
    db.exitPermits.push(permit);
    saveDb(db);
    
    // Trigger Bot
    triggerBotNotification('NEW_EXIT', permit);

    res.json(db.exitPermits);
});

// Update Routes (Trigger logic if status changes)
app.put('/api/orders/:id', (req, res) => { 
    const db = getDb(); 
    const idx = db.orders.findIndex(o => o.id === req.params.id); 
    if(idx > -1) { 
        db.orders[idx] = { ...db.orders[idx], ...req.body }; 
        saveDb(db); 
        res.json(db.orders); 
    } else res.status(404).send('Not Found'); 
});

app.put('/api/exit-permits/:id', (req, res) => {
    const db = getDb();
    const idx = db.exitPermits.findIndex(p => p.id === req.params.id);
    if (idx > -1) { 
        db.exitPermits[idx] = { ...db.exitPermits[idx], ...req.body }; 
        saveDb(db); 
        res.json(db.exitPermits); 
    } else res.status(404).send('Not Found');
});

// ... (Keep other existing routes for users, settings, etc.) ...
app.get('/api/settings', (req, res) => res.json(getDb().settings));
app.post('/api/settings', (req, res) => { const db = getDb(); db.settings = { ...db.settings, ...req.body }; saveDb(db); res.json(db.settings); });
app.get('/api/users', (req, res) => res.json(getDb().users));
app.post('/api/users', (req, res) => { const db = getDb(); db.users.push(req.body); saveDb(db); res.json(db.users); });

// PDF Render Endpoint
app.post('/api/render-pdf', async (req, res) => {
    try {
        const { html } = req.body;
        const pdf = await Renderer.generatePdfBuffer(html);
        res.contentType("application/pdf");
        res.send(pdf);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Start
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on ${PORT}`);
    const db = getDb();
    if(db.settings?.telegramBotToken) TelegramBotModule.initTelegram(db.settings.telegramBotToken);
    if(db.settings?.baleBotToken) BaleBotModule.initBaleBot(db.settings.baleBotToken);
});
