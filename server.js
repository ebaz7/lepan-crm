
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

// --- ANTI-CACHE MIDDLEWARE (CRITICAL FIX) ---
// This forces all clients to fetch fresh data every time, solving the stale number issue.
app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    next();
});

app.use('/uploads', express.static(UPLOADS_DIR));

// --- ROBUST DATABASE HANDLER (GUARANTEED DATA INTEGRITY) ---
const getDb = () => {
    try {
        const defaultDb = { 
            settings: {}, 
            users: [],
            orders: [], 
            exitPermits: [], 
            warehouseItems: [], 
            warehouseTransactions: [], 
            tradeRecords: [], 
            securityLogs: [], 
            personnelDelays: [], 
            securityIncidents: [],
            messages: [], 
            groups: [], 
            tasks: [] 
        };

        if (!fs.existsSync(DB_FILE)) return defaultDb;
        
        const fileContent = fs.readFileSync(DB_FILE, 'utf8');
        if (!fileContent.trim()) return defaultDb;

        const data = JSON.parse(fileContent);
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
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16); 
        const filename = `AutoBackup_Full_${timestamp}.zip`;
        const filePath = path.join(BACKUPS_DIR, filename);
        
        const output = fs.createWriteStream(filePath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        output.on('close', () => {
            console.log(`✅ Auto Backup Created: ${filename} (${(archive.pointer() / 1024 / 1024).toFixed(2)} MB)`);
        });

        archive.on('error', (err) => {
            throw err;
        });

        archive.pipe(output);

        if (fs.existsSync(DB_FILE)) {
            archive.file(DB_FILE, { name: 'database.json' });
        }

        if (fs.existsSync(UPLOADS_DIR)) {
            archive.directory(UPLOADS_DIR, 'uploads');
        }

        archive.finalize();
        
        setTimeout(() => {
            try {
                const files = fs.readdirSync(BACKUPS_DIR).filter(f => f.startsWith('AutoBackup_')).sort();
                if (files.length > 20) {
                    const toDelete = files.slice(0, files.length - 20);
                    toDelete.forEach(f => fs.unlinkSync(path.join(BACKUPS_DIR, f)));
                    console.log(`🧹 Cleaned up ${toDelete.length} old backups.`);
                }
            } catch(e) { console.error("Cleanup error", e); }
        }, 10000); 

    } catch (e) {
        console.error("❌ Automatic Backup Failed:", e);
    }
};

cron.schedule('0 */3 * * *', performAutoBackup);
setTimeout(performAutoBackup, 10000); 

// --- HELPER: Find Next Sequence Number (Filling Gaps) ---
const findNextGapNumber = (items, company, field, settingsStart) => {
    let startNum = settingsStart || 1000;
    const relevantItems = items && Array.isArray(items) 
        ? items.filter(i => {
            const itemCompany = i.company || i.payingCompany || '';
            const targetCompany = company || '';
            return itemCompany === targetCompany;
        })
        : [];
    
    const existingNumbers = relevantItems
        .map(i => parseInt(i[field]))
        .filter(n => !isNaN(n) && n >= startNum) 
        .sort((a, b) => a - b);
    
    let expected = startNum + 1; 
    const numSet = new Set(existingNumbers);
    while (numSet.has(expected)) { expected++; }
    return expected;
};

// --- HELPER: Strict Duplicate Checker ---
// Checks if (NumberField + Company) already exists.
// excludeId is used for Edit (PUT) operations to ignore self.
const checkForDuplicate = (list, numField, numValue, companyField, companyValue, excludeId = null) => {
    if (!list || !Array.isArray(list)) return false;
    return list.some(item => 
        Number(item[numField]) === Number(numValue) &&
        (item[companyField] || '') === (companyValue || '') &&
        item.id !== excludeId
    );
};

// --- API ROUTES ---

// 1. SEQUENCE GENERATORS
app.get('/api/next-tracking-number', (req, res) => {
    const db = getDb();
    const company = req.query.company;
    let minStart = 1000;
    if (db.settings.activeFiscalYearId && company) {
        const year = (db.settings.fiscalYears || []).find(y => y.id === db.settings.activeFiscalYearId);
        if (year && year.companySequences && year.companySequences[company]) {
            minStart = year.companySequences[company].startTrackingNumber || 1000;
        }
    } 
    const nextNum = findNextGapNumber(db.orders, company, 'trackingNumber', minStart);
    res.json({ nextTrackingNumber: nextNum });
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
    const nextNum = findNextGapNumber(db.exitPermits, company, 'permitNumber', minStart);
    res.json({ nextNumber: nextNum });
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
            minStart = db.settings.warehouseSequences[company]; 
        }
    }
    const outTxs = (db.warehouseTransactions || []).filter(t => t.type === 'OUT');
    const nextNum = findNextGapNumber(outTxs, company, 'number', minStart);
    res.json({ nextNumber: nextNum });
});

// 2. PAYMENT ORDERS
app.get('/api/orders', (req, res) => {
    res.json(getDb().orders || []);
});
app.post('/api/orders', (req, res) => { 
    const db = getDb(); 
    const order = req.body; 
    
    // STRICT DUPLICATE CHECK (Create)
    if (checkForDuplicate(db.orders, 'trackingNumber', order.trackingNumber, 'payingCompany', order.payingCompany)) {
        return res.status(409).json({ error: "Duplicate tracking number" });
    }

    order.id = order.id || Date.now().toString(); 
    if(!db.orders) db.orders = []; 
    db.orders.unshift(order); 
    
    saveDb(db); 
    res.json(db.orders); 
});
app.put('/api/orders/:id', (req, res) => { 
    const db = getDb(); 
    const idx = db.orders.findIndex(o => o.id === req.params.id); 
    if(idx > -1) { 
        // STRICT DUPLICATE CHECK (Update)
        const currentOrder = db.orders[idx];
        const newTracking = req.body.trackingNumber !== undefined ? req.body.trackingNumber : currentOrder.trackingNumber;
        const newCompany = req.body.payingCompany !== undefined ? req.body.payingCompany : currentOrder.payingCompany;

        if (checkForDuplicate(db.orders, 'trackingNumber', newTracking, 'payingCompany', newCompany, req.params.id)) {
            return res.status(409).json({ error: "Duplicate tracking number" });
        }

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

    // STRICT DUPLICATE CHECK (Create)
    if (checkForDuplicate(db.exitPermits, 'permitNumber', permit.permitNumber, 'company', permit.company)) {
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
        // STRICT DUPLICATE CHECK (Update)
        const currentPermit = db.exitPermits[idx];
        const newPermitNum = req.body.permitNumber !== undefined ? req.body.permitNumber : currentPermit.permitNumber;
        const newCompany = req.body.company !== undefined ? req.body.company : currentPermit.company;
        
        if (checkForDuplicate(db.exitPermits, 'permitNumber', newPermitNum, 'company', newCompany, req.params.id)) {
             return res.status(409).json({ error: "Duplicate permit number" });
        }

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

    // STRICT DUPLICATE CHECK (Create - Bijak Only)
    if (tx.type === 'OUT') {
        if (checkForDuplicate(db.warehouseTransactions.filter(t => t.type === 'OUT'), 'number', tx.number, 'company', tx.company)) {
             return res.status(409).json({ error: "Duplicate bijak number" });
        }
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
        // STRICT DUPLICATE CHECK (Update - Bijak Only)
        const currentTx = db.warehouseTransactions[idx];
        // Only check if it's an OUT transaction or becoming one (though type change is rare)
        if (currentTx.type === 'OUT' || req.body.type === 'OUT') {
            const newNumber = req.body.number !== undefined ? req.body.number : currentTx.number;
            const newCompany = req.body.company !== undefined ? req.body.company : currentTx.company;
            
            // Pass the whole filtered list of OUT transactions to checker, BUT since checkForDuplicate takes a list,
            // we should pass the whole list but the checker logic handles fields.
            // However, we only care about uniqueness among OUT transactions usually for 'number'.
            const outTransactions = db.warehouseTransactions.filter(t => t.type === 'OUT');
            
            // Check within OUT transactions context
            if (checkForDuplicate(outTransactions, 'number', newNumber, 'company', newCompany, req.params.id)) {
                 return res.status(409).json({ error: "Duplicate bijak number" });
            }
        }

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
        
        if (fs.existsSync(DB_FILE)) archive.file(DB_FILE, { name: 'database.json' });
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
