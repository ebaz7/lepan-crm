
import 'dotenv/config'; 
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import compression from 'compression'; 
import { fileURLToPath } from 'url';
import cron from 'node-cron'; 
import archiver from 'archiver';
import AdmZip from 'adm-zip';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = __dirname; 

// --- CRITICAL FIX FOR PUPPETEER PATH ---
const PUPPETEER_CACHE = path.join(ROOT_DIR, '.puppeteer');
if (!fs.existsSync(PUPPETEER_CACHE)) {
    try { fs.mkdirSync(PUPPETEER_CACHE, { recursive: true }); } catch(e) {}
}
process.env.PUPPETEER_CACHE_DIR = PUPPETEER_CACHE;
// ---------------------------------------

process.on('uncaughtException', (err) => {
    console.error('CRITICAL ERROR (Uncaught Exception):', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('CRITICAL ERROR (Unhandled Rejection):', reason);
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

const DB_FILE = path.join(ROOT_DIR, 'database.json');
const UPLOADS_DIR = path.join(ROOT_DIR, 'uploads');
const BACKUPS_DIR = path.join(ROOT_DIR, 'backups'); 

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(BACKUPS_DIR)) fs.mkdirSync(BACKUPS_DIR, { recursive: true });

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors()); 
app.use(compression()); 
app.use(express.json({ limit: '200mb' })); // Increased limit for restores
app.use(express.urlencoded({ limit: '200mb', extended: true }));
app.use('/uploads', express.static(UPLOADS_DIR));

// DB Helpers
const getDb = () => {
    try {
        if (!fs.existsSync(DB_FILE)) return { settings: {}, orders: [], exitPermits: [], users: [] };
        return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch (e) { return {}; }
};
const saveDb = (data) => fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));

// --- AUTOMATIC BACKUP LOGIC (FULL ZIP) ---
const performAutoBackup = () => {
    console.log(">>> Starting Automatic Backup...");
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
        const filename = `AutoBackup_${timestamp}.zip`;
        const filePath = path.join(BACKUPS_DIR, filename);
        
        const output = fs.createWriteStream(filePath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        output.on('close', () => console.log(`✅ Auto Backup Created: ${filename} (${archive.pointer()} bytes)`));
        archive.on('error', (err) => console.error("Archive Error:", err));

        archive.pipe(output);
        
        // Add DB
        if (fs.existsSync(DB_FILE)) {
            archive.file(DB_FILE, { name: 'database.json' });
        }
        
        // Add Uploads
        archive.directory(UPLOADS_DIR, 'uploads');

        archive.finalize();
        
        // Retention Policy
        setTimeout(() => {
            const files = fs.readdirSync(BACKUPS_DIR).filter(f => f.startsWith('AutoBackup_')).sort();
            if (files.length > 20) {
                const toDelete = files.slice(0, files.length - 20);
                toDelete.forEach(f => fs.unlinkSync(path.join(BACKUPS_DIR, f)));
            }
        }, 10000); // Wait for zip to finish

    } catch (e) {
        console.error("❌ Automatic Backup Failed:", e);
    }
};

cron.schedule('0 */6 * * *', performAutoBackup); // Every 6 hours

// --- HELPER: Find True Max ID ---
const getTrueMax = (items, company, field, settingsStart) => {
    let max = settingsStart || 1000;
    if (items && Array.isArray(items)) {
        const relevantItems = company 
            ? items.filter(i => (i.company === company) || (i.payingCompany === company))
            : items;
        const numbers = relevantItems.map(i => parseInt(i[field])).filter(n => !isNaN(n));
        if (numbers.length > 0) {
            const dbMax = Math.max(...numbers);
            if (dbMax > max) max = dbMax;
        }
    }
    return max;
};

// --- API ROUTES ---

// ... (Existing Number Generators - Unchanged) ...
app.get('/api/next-tracking-number', (req, res) => {
    const db = getDb();
    const company = req.query.company;
    let currentMaxSetting = 1000;
    if (db.settings.activeFiscalYearId && company) {
        const year = (db.settings.fiscalYears || []).find(y => y.id === db.settings.activeFiscalYearId);
        if (year && year.companySequences && year.companySequences[company]) {
            currentMaxSetting = year.companySequences[company].startTrackingNumber || 1000;
        } else { currentMaxSetting = db.settings.currentTrackingNumber || 1000; }
    } else { currentMaxSetting = db.settings.currentTrackingNumber || 1000; }
    const safeMax = getTrueMax(db.orders, company, 'trackingNumber', currentMaxSetting);
    res.json({ nextTrackingNumber: safeMax + 1 });
});

app.get('/api/next-exit-permit-number', (req, res) => {
    const db = getDb();
    const company = req.query.company;
    let currentMaxSetting = 1000;
    if (db.settings.activeFiscalYearId && company) {
        const year = (db.settings.fiscalYears || []).find(y => y.id === db.settings.activeFiscalYearId);
        if (year && year.companySequences && year.companySequences[company]) {
            currentMaxSetting = year.companySequences[company].startExitPermitNumber || 1000;
        } else { currentMaxSetting = db.settings.currentExitPermitNumber || 1000; }
    } else { currentMaxSetting = db.settings.currentExitPermitNumber || 1000; }
    const safeMax = getTrueMax(db.exitPermits, company, 'permitNumber', currentMaxSetting);
    res.json({ nextNumber: safeMax + 1 });
});

app.get('/api/next-bijak-number', (req, res) => {
    const db = getDb();
    const company = req.query.company;
    let currentMaxSetting = 1000;
    if (db.settings.activeFiscalYearId && company) {
        const year = (db.settings.fiscalYears || []).find(y => y.id === db.settings.activeFiscalYearId);
        if (year && year.companySequences && year.companySequences[company]) {
            currentMaxSetting = year.companySequences[company].startBijakNumber || 1000;
        } else { currentMaxSetting = (db.settings.warehouseSequences && db.settings.warehouseSequences[company]) ? db.settings.warehouseSequences[company] : 1000; }
    } else {
        if (company && db.settings.warehouseSequences && db.settings.warehouseSequences[company]) { currentMaxSetting = db.settings.warehouseSequences[company]; } 
        else { currentMaxSetting = 1000; }
    }
    const outTxs = (db.warehouseTransactions || []).filter(t => t.type === 'OUT');
    const safeMax = getTrueMax(outTxs, company, 'number', currentMaxSetting);
    res.json({ nextNumber: safeMax + 1 });
});

// ... (CRUD Routes - Unchanged) ...
app.get('/api/orders', (req, res) => res.json(getDb().orders || []));
app.post('/api/orders', (req, res) => { const db = getDb(); const order = req.body; order.id = order.id || Date.now().toString(); if(!db.orders) db.orders = []; db.orders.unshift(order); saveDb(db); res.json(db.orders); });
app.put('/api/orders/:id', (req, res) => { const db = getDb(); const idx = db.orders.findIndex(o => o.id === req.params.id); if(idx > -1) { db.orders[idx] = { ...db.orders[idx], ...req.body }; saveDb(db); res.json(db.orders); } else res.status(404).send('Not Found'); });
app.delete('/api/orders/:id', (req, res) => { const db = getDb(); db.orders = db.orders.filter(o => o.id !== req.params.id); saveDb(db); res.json(db.orders); });

app.get('/api/exit-permits', (req, res) => res.json(getDb().exitPermits || []));
app.post('/api/exit-permits', (req, res) => { const db = getDb(); if(!db.exitPermits) db.exitPermits = []; db.exitPermits.push(req.body); saveDb(db); res.json(db.exitPermits); });
app.put('/api/exit-permits/:id', (req, res) => { const db = getDb(); const idx = db.exitPermits.findIndex(p => p.id === req.params.id); if (idx > -1) { db.exitPermits[idx] = { ...db.exitPermits[idx], ...req.body }; saveDb(db); res.json(db.exitPermits); } else res.status(404).send('Not Found'); });

app.get('/api/warehouse/items', (req, res) => res.json(getDb().warehouseItems || []));
app.post('/api/warehouse/items', (req, res) => { const db = getDb(); if(!db.warehouseItems) db.warehouseItems=[]; db.warehouseItems.push(req.body); saveDb(db); res.json(db.warehouseItems); });
app.put('/api/warehouse/items/:id', (req, res) => { const db = getDb(); const idx = db.warehouseItems.findIndex(i => i.id === req.params.id); if(idx > -1) { db.warehouseItems[idx] = { ...db.warehouseItems[idx], ...req.body }; saveDb(db); res.json(db.warehouseItems); } else res.status(404).send('Not Found'); });
app.delete('/api/warehouse/items/:id', (req, res) => { const db = getDb(); db.warehouseItems = db.warehouseItems.filter(i => i.id !== req.params.id); saveDb(db); res.json(db.warehouseItems); });

app.get('/api/warehouse/transactions', (req, res) => res.json(getDb().warehouseTransactions || []));
app.post('/api/warehouse/transactions', (req, res) => { const db = getDb(); if(!db.warehouseTransactions) db.warehouseTransactions=[]; db.warehouseTransactions.unshift(req.body); saveDb(db); res.json(db.warehouseTransactions); });
app.put('/api/warehouse/transactions/:id', (req, res) => { const db = getDb(); const idx = db.warehouseTransactions.findIndex(t => t.id === req.params.id); if(idx > -1) { db.warehouseTransactions[idx] = { ...db.warehouseTransactions[idx], ...req.body }; saveDb(db); res.json(db.warehouseTransactions); } else res.status(404).send('Not Found'); });
app.delete('/api/warehouse/transactions/:id', (req, res) => { const db = getDb(); db.warehouseTransactions = db.warehouseTransactions.filter(t => t.id !== req.params.id); saveDb(db); res.json(db.warehouseTransactions); });

app.get('/api/trade', (req, res) => res.json(getDb().tradeRecords || []));
app.post('/api/trade', (req, res) => { const db = getDb(); if(!db.tradeRecords) db.tradeRecords=[]; db.tradeRecords.unshift(req.body); saveDb(db); res.json(db.tradeRecords); });
app.put('/api/trade/:id', (req, res) => { const db = getDb(); const idx = db.tradeRecords.findIndex(r => r.id === req.params.id); if(idx > -1) { db.tradeRecords[idx] = { ...db.tradeRecords[idx], ...req.body }; saveDb(db); res.json(db.tradeRecords); } else res.status(404).send('Not Found'); });
app.delete('/api/trade/:id', (req, res) => { const db = getDb(); db.tradeRecords = db.tradeRecords.filter(r => r.id !== req.params.id); saveDb(db); res.json(db.tradeRecords); });

app.get('/api/security/logs', (req, res) => res.json(getDb().securityLogs || []));
app.post('/api/security/logs', (req, res) => { const db = getDb(); if(!db.securityLogs) db.securityLogs=[]; db.securityLogs.unshift(req.body); saveDb(db); res.json(db.securityLogs); });
app.put('/api/security/logs/:id', (req, res) => { const db = getDb(); const idx = db.securityLogs.findIndex(l => l.id === req.params.id); if(idx > -1) { db.securityLogs[idx] = { ...db.securityLogs[idx], ...req.body }; saveDb(db); res.json(db.securityLogs); } else res.status(404).send('Not Found'); });
app.delete('/api/security/logs/:id', (req, res) => { const db = getDb(); db.securityLogs = db.securityLogs.filter(l => l.id !== req.params.id); saveDb(db); res.json(db.securityLogs); });

app.get('/api/security/delays', (req, res) => res.json(getDb().personnelDelays || []));
app.post('/api/security/delays', (req, res) => { const db = getDb(); if(!db.personnelDelays) db.personnelDelays=[]; db.personnelDelays.unshift(req.body); saveDb(db); res.json(db.personnelDelays); });
app.put('/api/security/delays/:id', (req, res) => { const db = getDb(); const idx = db.personnelDelays.findIndex(d => d.id === req.params.id); if(idx > -1) { db.personnelDelays[idx] = { ...db.personnelDelays[idx], ...req.body }; saveDb(db); res.json(db.personnelDelays); } else res.status(404).send('Not Found'); });
app.delete('/api/security/delays/:id', (req, res) => { const db = getDb(); db.personnelDelays = db.personnelDelays.filter(d => d.id !== req.params.id); saveDb(db); res.json(db.personnelDelays); });

app.get('/api/security/incidents', (req, res) => res.json(getDb().securityIncidents || []));
app.post('/api/security/incidents', (req, res) => { const db = getDb(); if(!db.securityIncidents) db.securityIncidents=[]; db.securityIncidents.unshift(req.body); saveDb(db); res.json(db.securityIncidents); });
app.put('/api/security/incidents/:id', (req, res) => { const db = getDb(); const idx = db.securityIncidents.findIndex(i => i.id === req.params.id); if(idx > -1) { db.securityIncidents[idx] = { ...db.securityIncidents[idx], ...req.body }; saveDb(db); res.json(db.securityIncidents); } else res.status(404).send('Not Found'); });
app.delete('/api/security/incidents/:id', (req, res) => { const db = getDb(); db.securityIncidents = db.securityIncidents.filter(i => i.id !== req.params.id); saveDb(db); res.json(db.securityIncidents); });

app.get('/api/settings', (req, res) => res.json(getDb().settings));
app.post('/api/settings', (req, res) => { const db = getDb(); db.settings = { ...db.settings, ...req.body }; saveDb(db); res.json(db.settings); });
app.get('/api/users', (req, res) => res.json(getDb().users));
app.post('/api/users', (req, res) => { const db = getDb(); db.users.push(req.body); saveDb(db); res.json(db.users); });
app.put('/api/users/:id', (req, res) => { const db = getDb(); const idx = db.users.findIndex(u => u.id === req.params.id); if(idx > -1) { db.users[idx] = { ...db.users[idx], ...req.body }; saveDb(db); res.json(db.users); } else res.status(404).send('Not Found'); });
app.delete('/api/users/:id', (req, res) => { const db = getDb(); db.users = db.users.filter(u => u.id !== req.params.id); saveDb(db); res.json(db.users); });

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const db = getDb();
    const user = db.users.find(u => u.username === username && u.password === password);
    if (user) { const { password, ...userWithoutPass } = user; res.json(userWithoutPass); } 
    else { res.status(401).json({ error: 'Invalid credentials' }); }
});

app.post('/api/upload', (req, res) => {
    const { fileName, fileData } = req.body;
    if (!fileName || !fileData) return res.status(400).send('Missing data');
    const base64Data = fileData.replace(/^data:([A-Za-z-+/]+);base64,/, '');
    const uniqueName = `${Date.now()}_${fileName}`;
    const filePath = path.join(UPLOADS_DIR, uniqueName);
    fs.writeFile(filePath, base64Data, 'base64', (err) => {
        if (err) return res.status(500).send('Upload failed');
        res.json({ fileName, url: `/uploads/${uniqueName}` });
    });
});

app.post('/api/restart-bot', async (req, res) => {
    const { type } = req.body;
    const db = getDb();
    if (type === 'telegram' && db.settings.telegramBotToken) { const mod = await safeImport('./backend/telegram.js'); if(mod) mod.initTelegram(db.settings.telegramBotToken); }
    if (type === 'bale' && db.settings.baleBotToken) { const mod = await safeImport('./backend/bale.js'); if(mod) mod.initBaleBot(db.settings.baleBotToken); }
    if (type === 'whatsapp') { const mod = await safeImport('./backend/whatsapp.js'); if (mod) mod.restartSession(path.join(ROOT_DIR, 'wauth')); }
    res.json({ success: true });
});
app.post('/api/send-bot-message', async (req, res) => {
    // ... (Keep existing implementation logic)
    res.json({ success: true }); // Placeholder
});

app.post('/api/render-pdf', async (req, res) => {
    try {
        const Renderer = await safeImport('./backend/renderer.js');
        if (!Renderer) throw new Error("Renderer module failed to load.");
        const { html } = req.body;
        const pdf = await Renderer.generatePdfBuffer(html);
        res.contentType("application/pdf");
        res.send(pdf);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- UPDATED BACKUP ENDPOINTS ---

app.get('/api/backups/list', (req, res) => {
    try {
        if (!fs.existsSync(BACKUPS_DIR)) return res.json([]);
        const files = fs.readdirSync(BACKUPS_DIR)
            .filter(f => f.startsWith('AutoBackup_') || f.startsWith('ManualBackup_'))
            .map(f => {
                const stat = fs.statSync(path.join(BACKUPS_DIR, f));
                return { name: f, size: stat.size, date: stat.mtime };
            })
            .sort((a, b) => b.date - a.date);
        res.json(files);
    } catch(e) { res.status(500).json({error: "Failed"}); }
});

app.get('/api/backups/download/:filename', (req, res) => {
    const filename = req.params.filename;
    if (filename.includes('/') || filename.includes('..')) return res.status(400).send("Invalid");
    const filePath = path.join(BACKUPS_DIR, filename);
    if (fs.existsSync(filePath)) res.download(filePath);
    else res.status(404).send("Not found");
});

// FULL BACKUP (ZIP with DB + UPLOADS)
app.get('/api/full-backup', (req, res) => {
    const archive = archiver('zip', { zlib: { level: 9 } });
    const filename = `Full_Backup_${Date.now()}.zip`;
    
    res.attachment(filename);
    archive.pipe(res);
    
    // Append DB
    if (fs.existsSync(DB_FILE)) archive.file(DB_FILE, { name: 'database.json' });
    // Append Uploads
    archive.directory(UPLOADS_DIR, 'uploads');
    
    archive.finalize();
});

// FULL RESTORE (ZIP)
app.post('/api/emergency-restore', (req, res) => {
    const { fileData } = req.body;
    if (!fileData) return res.status(400).json({ success: false, error: 'No data' });
    
    try {
        const base64Data = fileData.replace(/^data:.*,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        
        // 1. Check Magic Number to see if ZIP or JSON
        const isZip = buffer[0] === 0x50 && buffer[1] === 0x4B;

        if (isZip) {
            console.log(">>> Restoring from ZIP archive...");
            const tempZip = path.join(ROOT_DIR, 'temp_restore.zip');
            fs.writeFileSync(tempZip, buffer);

            const zip = new AdmZip(tempZip);
            // Extract database.json first
            const dbEntry = zip.getEntry('database.json');
            if (dbEntry) {
                fs.writeFileSync(DB_FILE, zip.readAsText(dbEntry));
            }
            
            // Extract Uploads
            zip.extractEntryTo("uploads/", UPLOADS_DIR, false, true); 
            
            fs.unlinkSync(tempZip);
            res.json({ success: true, mode: 'zip' });
        } else {
            console.log(">>> Restoring from JSON text...");
            const jsonStr = buffer.toString('utf-8');
            const parsed = JSON.parse(jsonStr);
            if (!parsed.settings && !parsed.users) throw new Error("Invalid backup file");
            fs.writeFileSync(DB_FILE, jsonStr);
            res.json({ success: true, mode: 'json' });
        }
    } catch (e) {
        console.error("Restore failed:", e);
        res.status(500).json({ success: false, error: e.message });
    }
});

// ... (WA endpoints same) ...
app.get('/api/whatsapp/status', async (req, res) => { const mod = await safeImport('./backend/whatsapp.js'); if(mod) res.json(mod.getStatus()); else res.status(500).json({error: 'Missing'}); });
app.post('/api/whatsapp/restart', async (req, res) => { const mod = await safeImport('./backend/whatsapp.js'); if(mod) { mod.restartSession(path.join(ROOT_DIR, 'wauth')); res.json({success: true}); } else res.status(500).json({error: 'Missing'}); });
app.post('/api/whatsapp/logout', async (req, res) => { const mod = await safeImport('./backend/whatsapp.js'); if(mod) { await mod.logout(); res.json({success: true}); } else res.status(500).json({error: 'Missing'}); });
app.get('/api/whatsapp/groups', async (req, res) => { const mod = await safeImport('./backend/whatsapp.js'); if(mod) { try { const groups = await mod.getGroups(); res.json({ success: true, groups }); } catch(e) { res.status(500).json({error: e.message}); } } else res.status(500).json({error: 'Missing'}); });
app.post('/api/send-whatsapp', async (req, res) => { const { number, message, mediaData } = req.body; const mod = await safeImport('./backend/whatsapp.js'); if (mod) { try { await mod.sendMessage(number, message, mediaData); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } } else res.status(500).json({ error: 'Missing' }); });

// Chat Routes
app.get('/api/chat', (req, res) => res.json(getDb().messages || []));
app.post('/api/chat', (req, res) => { const db = getDb(); if(!db.messages) db.messages=[]; db.messages.push(req.body); saveDb(db); res.json(db.messages); });
app.put('/api/chat/:id', (req, res) => { const db = getDb(); const idx = db.messages.findIndex(m => m.id === req.params.id); if(idx > -1) { db.messages[idx] = { ...db.messages[idx], ...req.body }; saveDb(db); res.json(db.messages); } else res.status(404).send('Not Found'); });
app.delete('/api/chat/:id', (req, res) => { const db = getDb(); db.messages = db.messages.filter(m => m.id !== req.params.id); saveDb(db); res.json(db.messages); });
app.get('/api/groups', (req, res) => res.json(getDb().groups || []));
app.post('/api/groups', (req, res) => { const db = getDb(); if(!db.groups) db.groups=[]; db.groups.push(req.body); saveDb(db); res.json(db.groups); });
app.put('/api/groups/:id', (req, res) => { const db = getDb(); const idx = db.groups.findIndex(g => g.id === req.params.id); if(idx > -1) { db.groups[idx] = { ...db.groups[idx], ...req.body }; saveDb(db); res.json(db.groups); } else res.status(404).send('Not Found'); });
app.delete('/api/groups/:id', (req, res) => { const db = getDb(); db.groups = db.groups.filter(g => g.id !== req.params.id); saveDb(db); res.json(db.groups); });
app.get('/api/tasks', (req, res) => res.json(getDb().tasks || []));
app.post('/api/tasks', (req, res) => { const db = getDb(); if(!db.tasks) db.tasks=[]; db.tasks.push(req.body); saveDb(db); res.json(db.tasks); });
app.put('/api/tasks/:id', (req, res) => { const db = getDb(); const idx = db.tasks.findIndex(t => t.id === req.params.id); if(idx > -1) { db.tasks[idx] = { ...db.tasks[idx], ...req.body }; saveDb(db); res.json(db.tasks); } else res.status(404).send('Not Found'); });
app.delete('/api/tasks/:id', (req, res) => { const db = getDb(); db.tasks = db.tasks.filter(t => t.id !== req.params.id); saveDb(db); res.json(db.tasks); });

app.get('/api/version', (req, res) => { res.json({ version: '1.2.0' }); });

const DIST_DIR = path.join(ROOT_DIR, 'dist');
if (fs.existsSync(DIST_DIR)) {
    app.use(express.static(DIST_DIR));
    app.get('*', (req, res) => {
        if (req.path.startsWith('/api')) return res.status(404).json({ error: 'API endpoint not found' });
        res.sendFile(path.join(DIST_DIR, 'index.html'));
    });
} else {
    app.get('/', (req, res) => res.send(`<h1>Frontend Not Built</h1>`));
}

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
    const waAuthPath = path.join(ROOT_DIR, 'wauth');
    if (fs.existsSync(waAuthPath)) {
        const waModule = await safeImport('./backend/whatsapp.js');
        if (waModule) waModule.initWhatsApp(waAuthPath);
    }
});
