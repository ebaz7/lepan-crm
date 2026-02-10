
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

// 1. GET NEXT TRACKING NUMBER (CRITICAL FIX)
app.get('/api/next-tracking-number', (req, res) => {
    const db = getDb();
    const company = req.query.company;
    
    let currentMax = 1000;

    // Check Fiscal Year Logic
    if (db.settings.activeFiscalYearId && company) {
        const year = (db.settings.fiscalYears || []).find(y => y.id === db.settings.activeFiscalYearId);
        if (year && year.companySequences && year.companySequences[company]) {
            currentMax = year.companySequences[company].startTrackingNumber || 1000;
        } else {
            // If no specific config for company in this year, fall back to global
            currentMax = db.settings.currentTrackingNumber || 1000;
        }
    } else {
        // Global Sequence
        currentMax = db.settings.currentTrackingNumber || 1000;
    }

    res.json({ nextTrackingNumber: currentMax + 1 });
});

// 2. GET NEXT EXIT PERMIT NUMBER
app.get('/api/next-exit-permit-number', (req, res) => {
    const db = getDb();
    const company = req.query.company;
    let currentMax = 1000;

    if (db.settings.activeFiscalYearId && company) {
        const year = (db.settings.fiscalYears || []).find(y => y.id === db.settings.activeFiscalYearId);
        if (year && year.companySequences && year.companySequences[company]) {
            currentMax = year.companySequences[company].startExitPermitNumber || 1000;
        } else {
            currentMax = db.settings.currentExitPermitNumber || 1000;
        }
    } else {
        currentMax = db.settings.currentExitPermitNumber || 1000;
    }

    res.json({ nextNumber: currentMax + 1 });
});

// 3. GET NEXT BIJAK NUMBER
app.get('/api/next-bijak-number', (req, res) => {
    const db = getDb();
    const company = req.query.company;
    let currentMax = 1000;

    if (db.settings.activeFiscalYearId && company) {
        const year = (db.settings.fiscalYears || []).find(y => y.id === db.settings.activeFiscalYearId);
        if (year && year.companySequences && year.companySequences[company]) {
            currentMax = year.companySequences[company].startBijakNumber || 1000;
        } else {
            // Fallback to warehouse sequences in settings
            currentMax = (db.settings.warehouseSequences && db.settings.warehouseSequences[company]) ? db.settings.warehouseSequences[company] : 1000;
        }
    } else {
        // Use global warehouse sequence per company
        if (company && db.settings.warehouseSequences && db.settings.warehouseSequences[company]) {
            currentMax = db.settings.warehouseSequences[company];
        } else {
            currentMax = 1000;
        }
    }

    res.json({ nextNumber: currentMax + 1 });
});


app.get('/api/orders', (req, res) => res.json(getDb().orders || []));

app.post('/api/orders', (req, res) => { 
    const db = getDb(); 
    const order = req.body; 
    order.id = order.id || Date.now().toString(); 
    
    // UPDATE SEQUENCE LOGIC (CRITICAL FIX)
    const trackNum = parseInt(order.trackingNumber);
    if (!isNaN(trackNum)) {
        let updated = false;

        // 1. Update Fiscal Year Sequence if active
        if (db.settings.activeFiscalYearId && order.payingCompany) {
            const yearIndex = (db.settings.fiscalYears || []).findIndex(y => y.id === db.settings.activeFiscalYearId);
            if (yearIndex > -1) {
                if (!db.settings.fiscalYears[yearIndex].companySequences) db.settings.fiscalYears[yearIndex].companySequences = {};
                if (!db.settings.fiscalYears[yearIndex].companySequences[order.payingCompany]) db.settings.fiscalYears[yearIndex].companySequences[order.payingCompany] = {};
                
                const currentSeq = db.settings.fiscalYears[yearIndex].companySequences[order.payingCompany].startTrackingNumber || 0;
                if (trackNum > currentSeq) {
                    db.settings.fiscalYears[yearIndex].companySequences[order.payingCompany].startTrackingNumber = trackNum;
                    updated = true;
                }
            }
        }

        // 2. Always Update Global Sequence as fallback/master
        const currentGlobal = db.settings.currentTrackingNumber || 0;
        if (trackNum > currentGlobal) {
            db.settings.currentTrackingNumber = trackNum;
        }
    }

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
    
    // Update Sequence Logic for Exit Permit
    const permitNum = parseInt(permit.permitNumber);
    if (!isNaN(permitNum)) {
        if (db.settings.activeFiscalYearId && permit.company) {
            const yearIndex = (db.settings.fiscalYears || []).findIndex(y => y.id === db.settings.activeFiscalYearId);
            if (yearIndex > -1) {
                if (!db.settings.fiscalYears[yearIndex].companySequences) db.settings.fiscalYears[yearIndex].companySequences = {};
                if (!db.settings.fiscalYears[yearIndex].companySequences[permit.company]) db.settings.fiscalYears[yearIndex].companySequences[permit.company] = {};
                
                const currentSeq = db.settings.fiscalYears[yearIndex].companySequences[permit.company].startExitPermitNumber || 0;
                if (permitNum > currentSeq) {
                    db.settings.fiscalYears[yearIndex].companySequences[permit.company].startExitPermitNumber = permitNum;
                }
            }
        }
        // Global Update
        const currentGlobal = db.settings.currentExitPermitNumber || 0;
        if (permitNum > currentGlobal) {
            db.settings.currentExitPermitNumber = permitNum;
        }
    }

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

// WAREHOUSE ROUTES
app.get('/api/warehouse/items', (req, res) => res.json(getDb().warehouseItems || []));
app.post('/api/warehouse/items', (req, res) => { const db = getDb(); if(!db.warehouseItems) db.warehouseItems=[]; db.warehouseItems.push(req.body); saveDb(db); res.json(db.warehouseItems); });
app.put('/api/warehouse/items/:id', (req, res) => { const db = getDb(); const idx = db.warehouseItems.findIndex(i => i.id === req.params.id); if(idx > -1) { db.warehouseItems[idx] = { ...db.warehouseItems[idx], ...req.body }; saveDb(db); res.json(db.warehouseItems); } else res.status(404).send('Not Found'); });
app.delete('/api/warehouse/items/:id', (req, res) => { const db = getDb(); db.warehouseItems = db.warehouseItems.filter(i => i.id !== req.params.id); saveDb(db); res.json(db.warehouseItems); });

app.get('/api/warehouse/transactions', (req, res) => res.json(getDb().warehouseTransactions || []));
app.post('/api/warehouse/transactions', (req, res) => { 
    const db = getDb(); 
    const tx = req.body;
    
    // Update Bijak Number Sequence
    if (tx.type === 'OUT' && tx.number) {
        const bijakNum = parseInt(tx.number);
        if(!isNaN(bijakNum)) {
             if (db.settings.activeFiscalYearId && tx.company) {
                const yearIndex = (db.settings.fiscalYears || []).findIndex(y => y.id === db.settings.activeFiscalYearId);
                if (yearIndex > -1) {
                    if (!db.settings.fiscalYears[yearIndex].companySequences) db.settings.fiscalYears[yearIndex].companySequences = {};
                    if (!db.settings.fiscalYears[yearIndex].companySequences[tx.company]) db.settings.fiscalYears[yearIndex].companySequences[tx.company] = {};
                    
                    const currentSeq = db.settings.fiscalYears[yearIndex].companySequences[tx.company].startBijakNumber || 0;
                    if (bijakNum > currentSeq) {
                        db.settings.fiscalYears[yearIndex].companySequences[tx.company].startBijakNumber = bijakNum;
                    }
                }
            }
            // Global/Legacy Update
            if(!db.settings.warehouseSequences) db.settings.warehouseSequences = {};
            const currentSeq = db.settings.warehouseSequences[tx.company] || 0;
            if(bijakNum > currentSeq) {
                db.settings.warehouseSequences[tx.company] = bijakNum;
            }
        }
    }

    if(!db.warehouseTransactions) db.warehouseTransactions=[];
    db.warehouseTransactions.unshift(tx); 
    saveDb(db); 
    res.json(db.warehouseTransactions); 
});
app.put('/api/warehouse/transactions/:id', (req, res) => { const db = getDb(); const idx = db.warehouseTransactions.findIndex(t => t.id === req.params.id); if(idx > -1) { db.warehouseTransactions[idx] = { ...db.warehouseTransactions[idx], ...req.body }; saveDb(db); res.json(db.warehouseTransactions); } else res.status(404).send('Not Found'); });
app.delete('/api/warehouse/transactions/:id', (req, res) => { const db = getDb(); db.warehouseTransactions = db.warehouseTransactions.filter(t => t.id !== req.params.id); saveDb(db); res.json(db.warehouseTransactions); });

// TRADE ROUTES
app.get('/api/trade', (req, res) => res.json(getDb().tradeRecords || []));
app.post('/api/trade', (req, res) => { const db = getDb(); if(!db.tradeRecords) db.tradeRecords=[]; db.tradeRecords.unshift(req.body); saveDb(db); res.json(db.tradeRecords); });
app.put('/api/trade/:id', (req, res) => { const db = getDb(); const idx = db.tradeRecords.findIndex(r => r.id === req.params.id); if(idx > -1) { db.tradeRecords[idx] = { ...db.tradeRecords[idx], ...req.body }; saveDb(db); res.json(db.tradeRecords); } else res.status(404).send('Not Found'); });
app.delete('/api/trade/:id', (req, res) => { const db = getDb(); db.tradeRecords = db.tradeRecords.filter(r => r.id !== req.params.id); saveDb(db); res.json(db.tradeRecords); });

// SECURITY ROUTES
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
    if (user) {
        const { password, ...userWithoutPass } = user;
        res.json(userWithoutPass);
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
    }
});

app.post('/api/upload', (req, res) => {
    const { fileName, fileData } = req.body;
    if (!fileName || !fileData) return res.status(400).send('Missing data');
    
    const base64Data = fileData.replace(/^data:([A-Za-z-+/]+);base64,/, '');
    const uniqueName = `${Date.now()}_${fileName}`;
    const filePath = path.join(UPLOADS_DIR, uniqueName);
    
    fs.writeFile(filePath, base64Data, 'base64', (err) => {
        if (err) return res.status(500).send('Upload failed');
        // Return a relative path that can be served by the static middleware
        res.json({ fileName, url: `/uploads/${uniqueName}` });
    });
});

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
    if (type === 'whatsapp') {
        const mod = await safeImport('./backend/whatsapp.js');
        if (mod) mod.restartSession(path.join(ROOT_DIR, 'wauth'));
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

// WHATSAPP API WRAPPER
app.get('/api/whatsapp/status', async (req, res) => {
    const mod = await safeImport('./backend/whatsapp.js');
    if(mod) res.json(mod.getStatus());
    else res.status(500).json({error: 'Module missing'});
});
app.post('/api/whatsapp/restart', async (req, res) => {
    const mod = await safeImport('./backend/whatsapp.js');
    if(mod) {
        mod.restartSession(path.join(ROOT_DIR, 'wauth'));
        res.json({success: true});
    } else res.status(500).json({error: 'Module missing'});
});
app.post('/api/whatsapp/logout', async (req, res) => {
    const mod = await safeImport('./backend/whatsapp.js');
    if(mod) { await mod.logout(); res.json({success: true}); }
    else res.status(500).json({error: 'Module missing'});
});
app.get('/api/whatsapp/groups', async (req, res) => {
    const mod = await safeImport('./backend/whatsapp.js');
    if(mod) {
        try {
            const groups = await mod.getGroups();
            res.json({ success: true, groups });
        } catch(e) { res.status(500).json({error: e.message}); }
    } else res.status(500).json({error: 'Module missing'});
});
app.post('/api/send-whatsapp', async (req, res) => {
    const { number, message, mediaData } = req.body;
    const mod = await safeImport('./backend/whatsapp.js');
    if (mod) {
        try {
            await mod.sendMessage(number, message, mediaData);
            res.json({ success: true });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    } else res.status(500).json({ error: 'Module missing' });
});

// CHAT ROUTES
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

// AI PROXY
app.post('/api/ai-request', async (req, res) => {
    const { message } = req.body;
    const db = getDb();
    const apiKey = db.settings.geminiApiKey;
    
    if (!apiKey) return res.json({ reply: 'کلید هوش مصنوعی تنظیم نشده است.' });

    try {
        const { GoogleGenAI } = await import('@google/genai');
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ role: 'user', parts: [{ text: message }] }]
        });
        res.json({ reply: response.text });
    } catch (e) {
        console.error("AI Error:", e);
        res.json({ reply: 'خطا در ارتباط با هوش مصنوعی.' });
    }
});

// FULL BACKUP DOWNLOAD
app.get('/api/full-backup', (req, res) => {
    if (fs.existsSync(DB_FILE)) {
        res.download(DB_FILE, `Backup_${Date.now()}.json`);
    } else {
        res.status(404).send('Database not found');
    }
});

// EMERGENCY RESTORE
app.post('/api/emergency-restore', (req, res) => {
    const { fileData } = req.body;
    if (!fileData) return res.status(400).json({ success: false, error: 'No data' });

    try {
        const base64Data = fileData.replace(/^data:.*,/, '');
        const jsonStr = Buffer.from(base64Data, 'base64').toString('utf-8');
        
        // Validation check
        const parsed = JSON.parse(jsonStr);
        if (!parsed.settings && !parsed.users) throw new Error("Invalid backup file");

        fs.writeFileSync(DB_FILE, jsonStr);
        res.json({ success: true });
    } catch (e) {
        console.error("Restore failed:", e);
        res.status(500).json({ success: false, error: e.message });
    }
});

// Version Check
app.get('/api/version', (req, res) => {
    // Read package.json or defined const
    res.json({ version: '1.0.0' });
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
    
    // Auto-Start WhatsApp if Session Exists
    const waAuthPath = path.join(ROOT_DIR, 'wauth');
    if (fs.existsSync(waAuthPath)) {
        const waModule = await safeImport('./backend/whatsapp.js');
        if (waModule) waModule.initWhatsApp(waAuthPath);
    }
});
