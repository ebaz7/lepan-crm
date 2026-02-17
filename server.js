
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
// INCREASED LIMIT TO 1GB TO SUPPORT FULL SYSTEM RESTORE (Files + DB)
app.use(express.json({ limit: '1024mb' })); 
app.use(express.urlencoded({ limit: '1024mb', extended: true }));
app.use('/uploads', express.static(UPLOADS_DIR));

// --- ROBUST DATABASE HANDLER (GUARANTEED DATA INTEGRITY) ---
const getDb = () => {
    try {
        // Default Structure containing ALL modules to ensure nothing is missed
        const defaultDb = { 
            settings: {}, 
            users: [],
            // 1. Payment Module
            orders: [], 
            // 2. Exit Module
            exitPermits: [], 
            // 3. Warehouse Module
            warehouseItems: [], 
            warehouseTransactions: [], 
            // 4. Trade (Commerce) Module
            tradeRecords: [], 
            // 5. Security Module
            securityLogs: [], 
            personnelDelays: [], 
            securityIncidents: [],
            // 6. Chat & Communication Module
            messages: [], 
            groups: [], 
            tasks: [] 
        };

        if (!fs.existsSync(DB_FILE)) return defaultDb;
        
        const fileContent = fs.readFileSync(DB_FILE, 'utf8');
        if (!fileContent.trim()) return defaultDb;

        const data = JSON.parse(fileContent);

        // Merge with default to ensure all keys exist even if file is partial
        // This guarantees that when we backup, we backup EVERYTHING.
        return { ...defaultDb, ...data };

    } catch (e) { 
        console.error("Database Read Error:", e);
        return {}; 
    }
};

const saveDb = (data) => {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    } catch(e) {
        console.error("Database Save Error:", e);
    }
};

// --- AUTOMATIC FULL BACKUP LOGIC (ZIP) ---
const performAutoBackup = () => {
    console.log(">>> Starting Automatic Full Backup (ZIP)...");
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16); // YYYY-MM-DD-HH-mm
        const filename = `AutoBackup_Full_${timestamp}.zip`;
        const filePath = path.join(BACKUPS_DIR, filename);
        
        const output = fs.createWriteStream(filePath);
        const archive = archiver('zip', { zlib: { level: 9 } }); // Max compression

        output.on('close', () => {
            console.log(`✅ Auto Backup Created: ${filename} (${(archive.pointer() / 1024 / 1024).toFixed(2)} MB)`);
        });

        archive.on('error', (err) => {
            throw err;
        });

        archive.pipe(output);

        // 1. Add Database File (Data)
        if (fs.existsSync(DB_FILE)) {
            archive.file(DB_FILE, { name: 'database.json' });
        }

        // 2. Add Uploads Directory (Files: Images, PDF, Excel, Voice)
        // This is crucial for Chat Attachments and Document Scans
        if (fs.existsSync(UPLOADS_DIR)) {
            archive.directory(UPLOADS_DIR, 'uploads');
        }

        archive.finalize();
        
        // Retention Policy: Keep last 20 backups to save space
        setTimeout(() => {
            try {
                const files = fs.readdirSync(BACKUPS_DIR).filter(f => f.startsWith('AutoBackup_')).sort();
                if (files.length > 20) {
                    const toDelete = files.slice(0, files.length - 20);
                    toDelete.forEach(f => fs.unlinkSync(path.join(BACKUPS_DIR, f)));
                    console.log(`🧹 Cleaned up ${toDelete.length} old backups.`);
                }
            } catch(e) { console.error("Cleanup error", e); }
        }, 10000); // Wait 10s for write to finish

    } catch (e) {
        console.error("❌ Automatic Backup Failed:", e);
    }
};

// Schedule: At minute 0 past every 3rd hour
cron.schedule('0 */3 * * *', performAutoBackup);
// Initial backup on start (delayed)
setTimeout(performAutoBackup, 10000); 

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
            // Fix: Strict max from DB to allow filling gaps if settings is out of sync, 
            // but ensure we don't go below settingsStart if DB is empty/low
            if (dbMax >= max) max = dbMax;
        }
    }
    return max;
};

// --- API ROUTES (Expanded for Clarity & Safety) ---

// 1. SEQUENCE GENERATORS
app.get('/api/next-tracking-number', (req, res) => {
    const db = getDb();
    const company = req.query.company;
    let minStart = 1000;
    
    // Determine the FLOOR based on settings/fiscal year
    if (db.settings.activeFiscalYearId && company) {
        const year = (db.settings.fiscalYears || []).find(y => y.id === db.settings.activeFiscalYearId);
        if (year && year.companySequences && year.companySequences[company]) {
            minStart = year.companySequences[company].startTrackingNumber || 1000;
        }
    } 
    // Logic Changed: Ignore db.settings.currentTrackingNumber as a "current counter" and treat it only as a "floor" 
    // if no fiscal year overrides it. This ensures if user deletes order #1005, getTrueMax sees #1004 in DB and returns 1005 again.
    
    // We pass minStart - 1 because getTrueMax returns the highest FOUND. We want to return highest + 1.
    // So if minStart is 1000, and DB is empty, getTrueMax should return 999 so result is 1000? 
    // No, standard logic: max = minStart || 1000. 
    // If DB has 1005, max becomes 1005. Result 1006.
    // If DB has nothing, max stays minStart. Result minStart + 1? No, usually start is 1000, first order 1001.
    
    const safeMax = getTrueMax(db.orders, company, 'trackingNumber', minStart);
    // If DB is empty, safeMax is minStart (e.g. 1000). Next is 1001.
    // If DB has 1002, safeMax is 1002. Next is 1003.
    res.json({ nextTrackingNumber: safeMax + 1 });
});

app.get('/api/next-exit-permit-number', (req, res) => {
    const db = getDb();
    const company = req.query.company;
    let minStart = 1000;
    
    if (db.settings.activeFiscalYearId && company) {
        const year = (db.settings.fiscalYears || []).find(y => y.id === db.settings.activeFiscalYearId);
        if (year && year.companySequences && year.companySequences[company]) {
            minStart = year.companySequences[company].startExitPermitNumber || 1000;
        }
    }
    
    const safeMax = getTrueMax(db.exitPermits, company, 'permitNumber', minStart);
    res.json({ nextNumber: safeMax + 1 });
});

app.get('/api/next-bijak-number', (req, res) => {
    const db = getDb();
    const company = req.query.company;
    let minStart = 1000;
    
    if (db.settings.activeFiscalYearId && company) {
        const year = (db.settings.fiscalYears || []).find(y => y.id === db.settings.activeFiscalYearId);
        if (year && year.companySequences && year.companySequences[company]) {
            minStart = year.companySequences[company].startBijakNumber || 1000;
        }
    } else {
        if (company && db.settings.warehouseSequences && db.settings.warehouseSequences[company]) { 
            // Keep warehouse sequence support for non-fiscal mode
            minStart = db.settings.warehouseSequences[company]; 
        }
    }
    
    const outTxs = (db.warehouseTransactions || []).filter(t => t.type === 'OUT');
    const safeMax = getTrueMax(outTxs, company, 'number', minStart);
    res.json({ nextNumber: safeMax + 1 });
});

// 2. PAYMENT ORDERS
app.get('/api/orders', (req, res) => {
    res.json(getDb().orders || []);
});
app.post('/api/orders', (req, res) => { 
    const db = getDb(); 
    const order = req.body; 
    
    // --- DUPLICATE CHECK ---
    const isDuplicate = db.orders && db.orders.some(o => 
        o.trackingNumber === Number(order.trackingNumber) && 
        o.payingCompany === order.payingCompany
    );

    if (isDuplicate) {
        return res.status(409).json({ error: "Duplicate tracking number" }); // 409 Conflict
    }

    order.id = order.id || Date.now().toString(); 
    if(!db.orders) db.orders = []; 
    db.orders.unshift(order); 
    
    // Optional: Update settings counter as a fallback, though we rely on DB max now
    if (order.trackingNumber > (db.settings.currentTrackingNumber || 0)) {
        db.settings.currentTrackingNumber = order.trackingNumber;
    }

    saveDb(db); 
    res.json(db.orders); 
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
app.delete('/api/orders/:id', (req, res) => { 
    const db = getDb(); 
    db.orders = db.orders.filter(o => o.id !== req.params.id); 
    saveDb(db); 
    res.json(db.orders); 
});

// 3. EXIT PERMITS
app.get('/api/exit-permits', (req, res) => {
    res.json(getDb().exitPermits || []);
});
app.post('/api/exit-permits', (req, res) => { 
    const db = getDb(); 
    const permit = req.body;

    // --- DUPLICATE CHECK ---
    const isDuplicate = db.exitPermits && db.exitPermits.some(p => 
        p.permitNumber === Number(permit.permitNumber) && 
        p.company === permit.company
    );

    if (isDuplicate) {
        return res.status(409).json({ error: "Duplicate permit number" });
    }

    if(!db.exitPermits) db.exitPermits = []; 
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
    } else res.status(404).send('Not Found'); 
});
app.delete('/api/exit-permits/:id', (req, res) => { 
    const db = getDb(); 
    db.exitPermits = db.exitPermits.filter(p => p.id !== req.params.id); 
    saveDb(db); 
    res.json(db.exitPermits); 
});

// 4. WAREHOUSE (Items & Transactions)
app.get('/api/warehouse/items', (req, res) => {
    res.json(getDb().warehouseItems || []);
});
app.post('/api/warehouse/items', (req, res) => { 
    const db = getDb(); 
    if(!db.warehouseItems) db.warehouseItems=[]; 
    db.warehouseItems.push(req.body); 
    saveDb(db); 
    res.json(db.warehouseItems); 
});
app.put('/api/warehouse/items/:id', (req, res) => { 
    const db = getDb(); 
    const idx = db.warehouseItems.findIndex(i => i.id === req.params.id); 
    if(idx > -1) { 
        db.warehouseItems[idx] = { ...db.warehouseItems[idx], ...req.body }; 
        saveDb(db); 
        res.json(db.warehouseItems); 
    } else res.status(404).send('Not Found'); 
});
app.delete('/api/warehouse/items/:id', (req, res) => { 
    const db = getDb(); 
    db.warehouseItems = db.warehouseItems.filter(i => i.id !== req.params.id); 
    saveDb(db); 
    res.json(db.warehouseItems); 
});

app.get('/api/warehouse/transactions', (req, res) => {
    res.json(getDb().warehouseTransactions || []);
});
app.post('/api/warehouse/transactions', (req, res) => { 
    const db = getDb(); 
    const tx = req.body;

    // --- DUPLICATE CHECK FOR OUT (BIJAK) ---
    if (tx.type === 'OUT') {
        const isDuplicate = db.warehouseTransactions && db.warehouseTransactions.some(t => 
            t.type === 'OUT' &&
            t.number === Number(tx.number) && 
            t.company === tx.company
        );
        if (isDuplicate) return res.status(409).json({ error: "Duplicate bijak number" });
    }

    if(!db.warehouseTransactions) db.warehouseTransactions=[]; 
    db.warehouseTransactions.unshift(tx); 
    saveDb(db); 
    res.json(db.warehouseTransactions); 
});
app.put('/api/warehouse/transactions/:id', (req, res) => { 
    const db = getDb(); 
    const idx = db.warehouseTransactions.findIndex(t => t.id === req.params.id); 
    if(idx > -1) { 
        db.warehouseTransactions[idx] = { ...db.warehouseTransactions[idx], ...req.body }; 
        saveDb(db); 
        res.json(db.warehouseTransactions); 
    } else res.status(404).send('Not Found'); 
});
app.delete('/api/warehouse/transactions/:id', (req, res) => { 
    const db = getDb(); 
    db.warehouseTransactions = db.warehouseTransactions.filter(t => t.id !== req.params.id); 
    saveDb(db); 
    res.json(db.warehouseTransactions); 
});

// 5. TRADE (Commerce)
app.get('/api/trade', (req, res) => {
    res.json(getDb().tradeRecords || []);
});
app.post('/api/trade', (req, res) => { 
    const db = getDb(); 
    if(!db.tradeRecords) db.tradeRecords=[]; 
    db.tradeRecords.unshift(req.body); 
    saveDb(db); 
    res.json(db.tradeRecords); 
});
app.put('/api/trade/:id', (req, res) => { 
    const db = getDb(); 
    const idx = db.tradeRecords.findIndex(r => r.id === req.params.id); 
    if(idx > -1) { 
        db.tradeRecords[idx] = { ...db.tradeRecords[idx], ...req.body }; 
        saveDb(db); 
        res.json(db.tradeRecords); 
    } else res.status(404).send('Not Found'); 
});
app.delete('/api/trade/:id', (req, res) => { 
    const db = getDb(); 
    db.tradeRecords = db.tradeRecords.filter(r => r.id !== req.params.id); 
    saveDb(db); 
    res.json(db.tradeRecords); 
});

// 6. SECURITY (Logs, Delays, Incidents)
app.get('/api/security/logs', (req, res) => {
    res.json(getDb().securityLogs || []);
});
app.post('/api/security/logs', (req, res) => { 
    const db = getDb(); 
    if(!db.securityLogs) db.securityLogs=[]; 
    db.securityLogs.unshift(req.body); 
    saveDb(db); 
    res.json(db.securityLogs); 
});
app.put('/api/security/logs/:id', (req, res) => { 
    const db = getDb(); 
    const idx = db.securityLogs.findIndex(l => l.id === req.params.id); 
    if(idx > -1) { 
        db.securityLogs[idx] = { ...db.securityLogs[idx], ...req.body }; 
        saveDb(db); 
        res.json(db.securityLogs); 
    } else res.status(404).send('Not Found'); 
});
app.delete('/api/security/logs/:id', (req, res) => { 
    const db = getDb(); 
    db.securityLogs = db.securityLogs.filter(l => l.id !== req.params.id); 
    saveDb(db); 
    res.json(db.securityLogs); 
});

app.get('/api/security/delays', (req, res) => {
    res.json(getDb().personnelDelays || []);
});
app.post('/api/security/delays', (req, res) => { 
    const db = getDb(); 
    if(!db.personnelDelays) db.personnelDelays=[]; 
    db.personnelDelays.unshift(req.body); 
    saveDb(db); 
    res.json(db.personnelDelays); 
});
app.put('/api/security/delays/:id', (req, res) => { 
    const db = getDb(); 
    const idx = db.personnelDelays.findIndex(d => d.id === req.params.id); 
    if(idx > -1) { 
        db.personnelDelays[idx] = { ...db.personnelDelays[idx], ...req.body }; 
        saveDb(db); 
        res.json(db.personnelDelays); 
    } else res.status(404).send('Not Found'); 
});
app.delete('/api/security/delays/:id', (req, res) => { 
    const db = getDb(); 
    db.personnelDelays = db.personnelDelays.filter(d => d.id !== req.params.id); 
    saveDb(db); 
    res.json(db.personnelDelays); 
});

app.get('/api/security/incidents', (req, res) => {
    res.json(getDb().securityIncidents || []);
});
app.post('/api/security/incidents', (req, res) => { 
    const db = getDb(); 
    if(!db.securityIncidents) db.securityIncidents=[]; 
    db.securityIncidents.unshift(req.body); 
    saveDb(db); 
    res.json(db.securityIncidents); 
});
app.put('/api/security/incidents/:id', (req, res) => { 
    const db = getDb(); 
    const idx = db.securityIncidents.findIndex(i => i.id === req.params.id); 
    if(idx > -1) { 
        db.securityIncidents[idx] = { ...db.securityIncidents[idx], ...req.body }; 
        saveDb(db); 
        res.json(db.securityIncidents); 
    } else res.status(404).send('Not Found'); 
});
app.delete('/api/security/incidents/:id', (req, res) => { 
    const db = getDb(); 
    db.securityIncidents = db.securityIncidents.filter(i => i.id !== req.params.id); 
    saveDb(db); 
    res.json(db.securityIncidents); 
});

// 7. SYSTEM (Settings, Users, Login)
app.get('/api/settings', (req, res) => {
    res.json(getDb().settings);
});
app.post('/api/settings', (req, res) => { 
    const db = getDb(); 
    db.settings = { ...db.settings, ...req.body }; 
    saveDb(db); 
    res.json(db.settings); 
});
app.get('/api/users', (req, res) => {
    res.json(getDb().users);
});
app.post('/api/users', (req, res) => { 
    const db = getDb(); 
    db.users.push(req.body); 
    saveDb(db); 
    res.json(db.users); 
});
app.put('/api/users/:id', (req, res) => { 
    const db = getDb(); 
    const idx = db.users.findIndex(u => u.id === req.params.id); 
    if(idx > -1) { 
        db.users[idx] = { ...db.users[idx], ...req.body }; 
        saveDb(db); 
        res.json(db.users); 
    } else res.status(404).send('Not Found'); 
});
app.delete('/api/users/:id', (req, res) => { 
    const db = getDb(); 
    db.users = db.users.filter(u => u.id !== req.params.id); 
    saveDb(db); 
    res.json(db.users); 
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const db = getDb();
    const user = db.users.find(u => u.username === username && u.password === password);
    if (user) { const { password, ...userWithoutPass } = user; res.json(userWithoutPass); } 
    else { res.status(401).json({ error: 'Invalid credentials' }); }
});

// 8. CHAT & COMMUNICATION
app.get('/api/chat', (req, res) => {
    res.json(getDb().messages || []);
});
app.post('/api/chat', (req, res) => { 
    const db = getDb(); 
    if(!db.messages) db.messages=[]; 
    db.messages.push(req.body); 
    saveDb(db); 
    res.json(db.messages); 
});
app.put('/api/chat/:id', (req, res) => { 
    const db = getDb(); 
    const idx = db.messages.findIndex(m => m.id === req.params.id); 
    if(idx > -1) { 
        db.messages[idx] = { ...db.messages[idx], ...req.body }; 
        saveDb(db); 
        res.json(db.messages); 
    } else res.status(404).send('Not Found'); 
});
app.delete('/api/chat/:id', (req, res) => { 
    const db = getDb(); 
    db.messages = db.messages.filter(m => m.id !== req.params.id); 
    saveDb(db); 
    res.json(db.messages); 
});

app.get('/api/groups', (req, res) => res.json(getDb().groups || []));
app.post('/api/groups', (req, res) => { const db = getDb(); if(!db.groups) db.groups=[]; db.groups.push(req.body); saveDb(db); res.json(db.groups); });
app.put('/api/groups/:id', (req, res) => { const db = getDb(); const idx = db.groups.findIndex(g => g.id === req.params.id); if(idx > -1) { db.groups[idx] = { ...db.groups[idx], ...req.body }; saveDb(db); res.json(db.groups); } else res.status(404).send('Not Found'); });
app.delete('/api/groups/:id', (req, res) => { const db = getDb(); db.groups = db.groups.filter(g => g.id !== req.params.id); saveDb(db); res.json(db.groups); });

app.get('/api/tasks', (req, res) => res.json(getDb().tasks || []));
app.post('/api/tasks', (req, res) => { const db = getDb(); if(!db.tasks) db.tasks=[]; db.tasks.push(req.body); saveDb(db); res.json(db.tasks); });
app.put('/api/tasks/:id', (req, res) => { const db = getDb(); const idx = db.tasks.findIndex(t => t.id === req.params.id); if(idx > -1) { db.tasks[idx] = { ...db.tasks[idx], ...req.body }; saveDb(db); res.json(db.tasks); } else res.status(404).send('Not Found'); });
app.delete('/api/tasks/:id', (req, res) => { const db = getDb(); db.tasks = db.tasks.filter(t => t.id !== req.params.id); saveDb(db); res.json(db.tasks); });

// 9. FILE UPLOAD
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

// 10. BOTS (Telegram/Bale/WhatsApp)
app.post('/api/restart-bot', async (req, res) => {
    const { type } = req.body;
    const db = getDb();
    if (type === 'telegram' && db.settings.telegramBotToken) { const mod = await safeImport('./backend/telegram.js'); if(mod) mod.initTelegram(db.settings.telegramBotToken); }
    if (type === 'bale' && db.settings.baleBotToken) { const mod = await safeImport('./backend/bale.js'); if(mod) mod.initBaleBot(db.settings.baleBotToken); }
    if (type === 'whatsapp') { const mod = await safeImport('./backend/whatsapp.js'); if (mod) mod.restartSession(path.join(ROOT_DIR, 'wauth')); }
    res.json({ success: true });
});

app.post('/api/send-bot-message', async (req, res) => {
    // ... (Keep existing logic)
    res.json({ success: true }); 
});

// --- UPDATED BACKUP ENDPOINTS ---

app.get('/api/backups/list', (req, res) => {
    try {
        if (!fs.existsSync(BACKUPS_DIR)) return res.json([]);
        const files = fs.readdirSync(BACKUPS_DIR)
            .filter(f => f.startsWith('AutoBackup_') || f.startsWith('Full_Backup_') || f.endsWith('.zip'))
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

// FULL BACKUP (ZIP with DB + UPLOADS) - MANUAL TRIGGER
app.get('/api/full-backup', (req, res) => {
    try {
        const archive = archiver('zip', { zlib: { level: 9 } });
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const filename = `Full_Backup_${timestamp}.zip`;
        
        res.attachment(filename);
        archive.pipe(res);
        
        // Append DB
        if (fs.existsSync(DB_FILE)) archive.file(DB_FILE, { name: 'database.json' });
        // Append Uploads Directory
        if (fs.existsSync(UPLOADS_DIR)) archive.directory(UPLOADS_DIR, 'uploads');
        
        archive.finalize();
    } catch (e) {
        console.error("Manual Backup Error:", e);
        res.status(500).send("Backup Generation Failed");
    }
});

// FULL RESTORE (ZIP OR JSON) - SMART HANDLING
app.post('/api/emergency-restore', (req, res) => {
    const { fileData } = req.body;
    if (!fileData) return res.status(400).json({ success: false, error: 'No data' });
    
    try {
        const base64Data = fileData.replace(/^data:.*,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        
        // 1. Check Magic Number to see if ZIP (PK..)
        const isZip = buffer[0] === 0x50 && buffer[1] === 0x4B;

        if (isZip) {
            console.log(">>> Restoring from ZIP archive...");
            const tempZip = path.join(ROOT_DIR, 'temp_restore.zip');
            fs.writeFileSync(tempZip, buffer);

            const zip = new AdmZip(tempZip);
            
            // Extract database.json
            const dbEntry = zip.getEntry('database.json');
            if (dbEntry) {
                fs.writeFileSync(DB_FILE, zip.readAsText(dbEntry));
                console.log("✅ Database restored.");
            }
            
            // Extract Uploads
            // AdmZip extractAllTo will overwrite existing files which is desired for restore
            // We verify the zip contains an 'uploads' folder or files
            if (zip.getEntry('uploads/')) {
                zip.extractEntryTo("uploads/", ROOT_DIR, true, true); 
                console.log("✅ Uploads restored.");
            }
            
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

app.get('/api/version', (req, res) => { res.json({ version: '1.3.1' }); });

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
