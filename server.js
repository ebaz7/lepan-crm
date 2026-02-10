
import 'dotenv/config'; 
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import compression from 'compression'; 
import { fileURLToPath } from 'url';

// --- GLOBAL ERROR HANDLERS (PREVENT CRASH) ---
process.on('uncaughtException', (err) => {
    console.error('CRITICAL ERROR (Uncaught Exception):', err);
    // Do not exit the process, just log it.
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('CRITICAL ERROR (Unhandled Rejection):', reason);
    // Do not exit the process.
});

// Safe Import Helper
const safeImport = async (modulePath) => {
    try {
        return await import(modulePath);
    } catch (e) {
        console.error(`⚠️ Failed to load module ${modulePath}:`, e.message);
        return null;
    }
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = __dirname; 
const DB_FILE = path.join(ROOT_DIR, 'database.json');
const UPLOADS_DIR = path.join(ROOT_DIR, 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

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

// --- API ROUTES ---

app.get('/api/orders', (req, res) => res.json(getDb().orders || []));
app.post('/api/orders', (req, res) => { 
    const db = getDb(); 
    const order = req.body; 
    order.id = order.id || Date.now().toString(); 
    if(!db.orders) db.orders = [];
    db.orders.unshift(order); 
    saveDb(db); 
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
    res.json(db.exitPermits);
});

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

app.get('/api/settings', (req, res) => res.json(getDb().settings));
app.post('/api/settings', (req, res) => { const db = getDb(); db.settings = { ...db.settings, ...req.body }; saveDb(db); res.json(db.settings); });
app.get('/api/users', (req, res) => res.json(getDb().users));
app.post('/api/users', (req, res) => { const db = getDb(); db.users.push(req.body); saveDb(db); res.json(db.users); });

// Bot Restart Endpoint
app.post('/api/restart-bot', async (req, res) => {
    const { type } = req.body;
    const db = getDb();
    
    if (type === 'telegram' && db.settings.telegramBotToken) {
        const mod = await safeImport('./backend/telegram.js');
        if(mod) mod.initTelegram(db.settings.telegramBotToken);
    }
    if (type === 'bale' && db.settings.baleBotToken) {
        const mod = await safeImport('./backend/bale.js');
        if(mod) mod.initBaleBot(db.settings.baleBotToken);
    }
    res.json({ success: true });
});

// PDF Rendering
app.post('/api/render-pdf', async (req, res) => {
    try {
        const Renderer = await safeImport('./backend/renderer.js');
        if (!Renderer) throw new Error("Renderer module failed to load.");
        
        const { html } = req.body;
        const pdf = await Renderer.generatePdfBuffer(html);
        res.contentType("application/pdf");
        res.send(pdf);
    } catch (e) { 
        console.error("PDF Render Error:", e);
        res.status(500).json({ error: e.message }); 
    }
});

// --- SERVE FRONTEND (STATIC FILES) ---
const DIST_DIR = path.join(ROOT_DIR, 'dist');

if (fs.existsSync(DIST_DIR)) {
    app.use(express.static(DIST_DIR));
    app.get('*', (req, res) => {
        if (req.path.startsWith('/api')) {
            return res.status(404).json({ error: 'API endpoint not found' });
        }
        res.sendFile(path.join(DIST_DIR, 'index.html'));
    });
} else {
    app.get('/', (req, res) => {
        res.send(`<h1>Frontend Not Built</h1><p>Run npm run build</p>`);
    });
}

// Start Server
app.listen(PORT, '0.0.0.0', async () => {
    console.log(`Server running on ${PORT}`);
    
    const db = getDb();
    if(db.settings?.telegramBotToken) {
        const tgModule = await safeImport('./backend/telegram.js');
        if(tgModule) tgModule.initTelegram(db.settings.telegramBotToken);
    }
    if(db.settings?.baleBotToken) {
        const baleModule = await safeImport('./backend/bale.js');
        if(baleModule) baleModule.initBaleBot(db.settings.baleBotToken);
    }
});
