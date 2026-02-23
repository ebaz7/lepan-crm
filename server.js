
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
import webpush from 'web-push';
import axios from 'axios';

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

// --- WEB PUSH SETUP ---
const VAPID_FILE = path.join(ROOT_DIR, 'vapid.json');
let vapidKeys;
if (fs.existsSync(VAPID_FILE)) {
    vapidKeys = JSON.parse(fs.readFileSync(VAPID_FILE, 'utf8'));
} else {
    vapidKeys = webpush.generateVAPIDKeys();
    fs.writeFileSync(VAPID_FILE, JSON.stringify(vapidKeys));
}

webpush.setVapidDetails(
    'mailto:admin@example.com',
    vapidKeys.publicKey,
    vapidKeys.privateKey
);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors()); 
// Maximum compression for speed
app.use(compression({ level: 9 })); 
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

app.use('/uploads', express.static(UPLOADS_DIR, { maxAge: '7d' })); // Cache uploads for speed

// --- ROBUST DATABASE HANDLER (IN-MEMORY CACHING FOR SPEED) ---
let MEMORY_DB_CACHE = null;

const getDb = () => {
    // Return from RAM if available (Instant access)
    if (MEMORY_DB_CACHE) {
        return MEMORY_DB_CACHE;
    }

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

        if (!fs.existsSync(DB_FILE)) {
            MEMORY_DB_CACHE = defaultDb;
            return defaultDb;
        }
        
        const fileContent = fs.readFileSync(DB_FILE, 'utf8');
        if (!fileContent.trim()) {
            MEMORY_DB_CACHE = defaultDb;
            return defaultDb;
        }

        const data = JSON.parse(fileContent);
        // Combine with defaults to ensure structure integrity
        MEMORY_DB_CACHE = { ...defaultDb, ...data };
        
        // CRITICAL FIX: Ensure arrays exist even if DB file has null/undefined
        if (!Array.isArray(MEMORY_DB_CACHE.users)) MEMORY_DB_CACHE.users = [];
        if (!Array.isArray(MEMORY_DB_CACHE.orders)) MEMORY_DB_CACHE.orders = [];
        if (!Array.isArray(MEMORY_DB_CACHE.exitPermits)) MEMORY_DB_CACHE.exitPermits = [];
        if (!MEMORY_DB_CACHE.subscriptions) MEMORY_DB_CACHE.subscriptions = [];
        
        console.log(">>> Database loaded into memory.");
        return MEMORY_DB_CACHE;

    } catch (e) { 
        console.error("Database Read Error:", e);
        return {}; 
    }
};

const saveDb = (data) => {
    try {
        // Update Memory immediately
        MEMORY_DB_CACHE = data;
        // Write to disk
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
    
    let expected = startNum; 
    const numSet = new Set(existingNumbers);
    while (numSet.has(expected)) { expected++; }
    return expected;
};

// --- HELPER: Strict Duplicate Checker ---
const checkForDuplicate = (list, numField, numValue, companyField, companyValue, excludeId = null) => {
    if (!list || !Array.isArray(list)) return false;
    return list.some(item => 
        Number(item[numField]) === Number(numValue) &&
        (item[companyField] || '') === (companyValue || '') &&
        item.id !== excludeId
    );
};

// --- NOTIFICATION HELPER ---
const sendTelegramNotification = async (botToken, chatId, message) => {
    if (!botToken || !chatId) return;
    try {
        const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
        await axios.post(url, { chat_id: chatId, text: message, parse_mode: 'Markdown' });
    } catch (e) { console.error("Telegram Notification Error:", e.response?.data || e.message); }
};

const sendBaleNotification = async (botToken, chatId, message) => {
    if (!botToken || !chatId) return;
    try {
        const url = `https://tapi.bale.ai/bot${botToken}/sendMessage`;
        await axios.post(url, { chat_id: chatId, text: message });
    } catch (e) { console.error("Bale Notification Error:", e.response?.data || e.message); }
};

const broadcastNotification = async (title, body, url = '/', targetRoles = null, targetUsernames = null) => {
    const db = getDb();
    const subs = db.subscriptions || [];
    const settings = db.settings || {};
    
    console.log(`>>> Broadcasting Notification: "${title}" to ${subs.length} devices.`);

    const payload = JSON.stringify({ title, body, url });
    const fullMessage = `🔔 *${title}*\n\n${body}\n\n🔗 [مشاهده در سامانه](${process.env.APP_URL || ''}${url})`;

    // 1. Web Push
    const sendPromises = subs.filter(sub => {
        if (targetUsernames && !targetUsernames.includes(sub.username)) return false;
        if (targetRoles && !targetRoles.includes(sub.role)) return false;
        return true;
    }).map(sub => {
        return webpush.sendNotification(sub, payload).catch(err => {
            if (err.statusCode === 404 || err.statusCode === 410) {
                const db = getDb();
                db.subscriptions = db.subscriptions.filter(s => s.endpoint !== sub.endpoint);
                saveDb(db);
            }
        });
    });

    // 2. Telegram & Bale (Individual)
    if (targetUsernames) {
        targetUsernames.forEach(username => {
            const user = db.users.find(u => u.username === username);
            if (user) {
                if (user.telegramChatId) sendTelegramNotification(settings.telegramBotToken, user.telegramChatId, fullMessage);
                if (user.baleChatId) sendBaleNotification(settings.baleBotToken, user.baleChatId, fullMessage);
            }
        });
    }

    // 3. Telegram & Bale (Role-based)
    if (targetRoles) {
        db.users.filter(u => targetRoles.includes(u.role)).forEach(user => {
            if (user.telegramChatId) sendTelegramNotification(settings.telegramBotToken, user.telegramChatId, fullMessage);
            if (user.baleChatId) sendBaleNotification(settings.baleBotToken, user.baleChatId, fullMessage);
        });
    }

    await Promise.all(sendPromises);
};

// --- API ROUTES ---

// 1. SEQUENCE GENERATORS
app.get('/api/vapid-key', (req, res) => {
    res.json({ publicKey: vapidKeys.publicKey });
});

app.post('/api/subscribe', (req, res) => {
    const db = getDb();
    if (!db.subscriptions) db.subscriptions = [];
    
    const newSub = req.body;
    // Prevent duplicates
    const exists = db.subscriptions.find(s => s.endpoint === newSub.endpoint);
    if (!exists) {
        db.subscriptions.push(newSub);
        saveDb(db);
    } else {
        // Update user info if changed
        const idx = db.subscriptions.findIndex(s => s.endpoint === newSub.endpoint);
        db.subscriptions[idx] = { ...db.subscriptions[idx], ...newSub };
        saveDb(db);
    }
    res.status(201).json({});
});

app.get('/api/next-numbers', (req, res) => {
    const db = getDb();
    const company = req.query.company;
    if (!company) return res.status(400).json({ error: "Company is required" });

    let trackingStart = 1000;
    let exitStart = 1000;
    let bijakStart = 1000;

    if (db.settings.activeFiscalYearId) {
        const year = (db.settings.fiscalYears || []).find(y => y.id === db.settings.activeFiscalYearId);
        if (year && year.companySequences && year.companySequences[company]) {
            trackingStart = year.companySequences[company].startTrackingNumber || 1000;
            exitStart = year.companySequences[company].startExitPermitNumber || 1000;
            bijakStart = year.companySequences[company].startBijakNumber || 1000;
        }
    } else {
        if (db.settings.warehouseSequences && db.settings.warehouseSequences[company]) { 
            bijakStart = db.settings.warehouseSequences[company]; 
        }
    }

    const nextTracking = findNextGapNumber(db.orders, company, 'trackingNumber', trackingStart);
    const nextExit = findNextGapNumber(db.exitPermits, company, 'permitNumber', exitStart);
    const outTxs = (db.warehouseTransactions || []).filter(t => t.type === 'OUT');
    const nextBijak = findNextGapNumber(outTxs, company, 'number', bijakStart);

    res.json({
        trackingNumber: nextTracking,
        exitPermitNumber: nextExit,
        bijakNumber: nextBijak
    });
});

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

    // Notify relevant roles
    broadcastNotification(
        'درخواست پرداخت جدید',
        `${order.description || 'بدون شرح'} - مبلغ: ${order.amount.toLocaleString()} ریال`,
        '/payment-approvals',
        ['FINANCIAL', 'ADMIN']
    );
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

        const updatedOrder = { ...db.orders[idx], ...req.body };
        
        // Notification Logic for Status Change
        if (currentOrder.status !== updatedOrder.status) {
            // Notify Requestor
            if (updatedOrder.createdBy) {
                broadcastNotification(
                    'تغییر وضعیت درخواست پرداخت',
                    `درخواست شما به وضعیت ${updatedOrder.status === 'APPROVED' ? 'تایید شده' : updatedOrder.status === 'REJECTED' ? 'رد شده' : updatedOrder.status} تغییر یافت.`,
                    '/payment-orders',
                    null,
                    [updatedOrder.createdBy]
                );
            }
            // Notify Financial if Approved
            if (updatedOrder.status === 'APPROVED') {
                broadcastNotification(
                    'تایید نهایی پرداخت',
                    `درخواست پرداخت ${updatedOrder.trackingNumber} تایید شد.`,
                    '/payment-orders',
                    ['FINANCIAL']
                );
            }
        }

        db.orders[idx] = updatedOrder; 
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

    broadcastNotification(
        'درخواست خروج کالا',
        `مجوز شماره ${permit.permitNumber} برای ${permit.customerName}`,
        '/exit-approvals',
        ['CEO', 'ADMIN']
    );
});
app.put('/api/exit-permits/:id', (req, res) => { 
    const db = getDb(); 
    const idx = db.exitPermits.findIndex(p => p.id === req.params.id); 
    if (idx > -1) { 
        const currentPermit = db.exitPermits[idx];
        const newPermitNum = req.body.permitNumber !== undefined ? req.body.permitNumber : currentPermit.permitNumber;
        const newCompany = req.body.company !== undefined ? req.body.company : currentPermit.company;
        
        if (checkForDuplicate(db.exitPermits, 'permitNumber', newPermitNum, 'company', newCompany, req.params.id)) {
             return res.status(409).json({ error: "Duplicate permit number" });
        }

        const updatedPermit = { ...db.exitPermits[idx], ...req.body };

        // Notification Logic
        if (currentPermit.status !== updatedPermit.status) {
            // Notify Requestor
            if (updatedPermit.createdBy) {
                broadcastNotification(
                    'تغییر وضعیت مجوز خروج',
                    `مجوز خروج ${updatedPermit.permitNumber} به وضعیت ${updatedPermit.status} تغییر یافت.`,
                    '/exit-permits',
                    null,
                    [updatedPermit.createdBy]
                );
            }
            // Notify Security if Approved
            if (updatedPermit.status === 'APPROVED') {
                broadcastNotification(
                    'مجوز خروج تایید شده',
                    `مجوز ${updatedPermit.permitNumber} تایید شد و آماده خروج است.`,
                    '/security-panel',
                    ['SECURITY', 'GUARD']
                );
            }
        }

        db.exitPermits[idx] = updatedPermit; 
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

    if (tx.type === 'OUT') {
        if (checkForDuplicate(db.warehouseTransactions.filter(t => t.type === 'OUT'), 'number', tx.number, 'company', tx.company)) {
             return res.status(409).json({ error: "Duplicate bijak number" });
        }
    }

    if(!db.warehouseTransactions) db.warehouseTransactions=[]; 
    db.warehouseTransactions.unshift(tx); 
    saveDb(db); 
    res.json(db.warehouseTransactions); 

    if (tx.type === 'OUT') {
        broadcastNotification(
            'بیجک خروج جدید',
            `بیجک شماره ${tx.number} ثبت شد و منتظر تایید است.`,
            '/warehouse',
            ['CEO', 'ADMIN']
        );
    }
});
app.put('/api/warehouse/transactions/:id', (req, res) => { 
    const db = getDb(); 
    const idx = db.warehouseTransactions.findIndex(t => t.id === req.params.id); 
    if(idx > -1) { 
        const currentTx = db.warehouseTransactions[idx];
        if (currentTx.type === 'OUT' || req.body.type === 'OUT') {
            const newNumber = req.body.number !== undefined ? req.body.number : currentTx.number;
            const newCompany = req.body.company !== undefined ? req.body.company : currentTx.company;
            const outTransactions = db.warehouseTransactions.filter(t => t.type === 'OUT');
            
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
app.get('/api/app-data', (req, res) => {
    const db = getDb();
    res.json({
        settings: db.settings || {},
        orders: db.orders || [],
        messages: db.messages || [],
        exitPermits: db.exitPermits || [],
        warehouseTransactions: db.warehouseTransactions || [],
        users: (db.users || []).map(u => { const { password, ...rest } = u; return rest; })
    });
});

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
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ error: 'Missing credentials' });

        const db = getDb();
        if (!db.users || !Array.isArray(db.users)) {
            console.error("CRITICAL: Users table missing or invalid", db.users);
            return res.status(500).json({ error: 'Database integrity error' });
        }

        const user = db.users.find(u => u.username === username && u.password === password);
        if (user) { 
            // Update Last Seen
            user.lastSeen = new Date().toISOString();
            saveDb(db);

            const { password, ...userWithoutPass } = user; 
            res.json(userWithoutPass); 
        } else { 
            res.status(401).json({ error: 'Invalid credentials' }); 
        }
    } catch (e) {
        console.error("Login Error:", e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// HEARTBEAT FOR LAST SEEN
app.post('/api/heartbeat', (req, res) => {
    const { username } = req.body;
    if (!username) return res.status(400).send('Missing username');
    
    const db = getDb();
    const user = db.users.find(u => u.username === username);
    if (user) {
        user.lastSeen = new Date().toISOString();
        // We don't save to disk on every heartbeat to avoid IO thrashing, 
        // just update memory. Disk save happens on other actions or periodic backup.
        // However, if we want persistence across restarts, we should save periodically.
        // For now, let's save to memory only, and maybe trigger a debounced save?
        // Or just save. It's low frequency per user (1 min).
        // Let's save for accuracy.
        saveDb(db);
    }
    res.json({ success: true });
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

    // Chat Notification
    const msg = req.body;
    if (msg.recipient) {
        broadcastNotification(
            `پیام از ${msg.sender}`,
            msg.message || (msg.audioUrl ? '🎤 پیام صوتی' : '📎 فایل'),
            '/chat',
            null,
            [msg.recipient]
        );
    } else if (msg.groupId) {
        const group = db.groups?.find(g => g.id === msg.groupId);
        if (group) {
            broadcastNotification(
                `${msg.sender} در ${group.name}`,
                msg.message || (msg.audioUrl ? '🎤 پیام صوتی' : '📎 فایل'),
                '/chat',
                null,
                group.members.filter(m => m !== msg.senderUsername)
            );
        }
    } else {
        // Public channel
        broadcastNotification(
            `پیام عمومی از ${msg.sender}`,
            msg.message || (msg.audioUrl ? '🎤 پیام صوتی' : '📎 فایل'),
            '/chat'
        );
    }
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
                const dbContent = zip.readAsText(dbEntry);
                fs.writeFileSync(DB_FILE, dbContent);
                // UPDATE MEMORY
                MEMORY_DB_CACHE = JSON.parse(dbContent);
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
            // UPDATE MEMORY
            MEMORY_DB_CACHE = parsed;
            
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
    app.use(express.static(DIST_DIR, { maxAge: '1d' })); // Cache static assets
    app.get('*', (req, res) => {
        if (req.path.startsWith('/api')) return res.status(404).json({ error: 'API endpoint not found' });
        res.sendFile(path.join(DIST_DIR, 'index.html'));
    });
} else {
    app.get('/', (req, res) => res.send(`<h1>Frontend Not Built</h1>`));
}

app.listen(PORT, '0.0.0.0', async () => {
    console.log(`Server running on ${PORT}`);
    const db = getDb(); // Initial load to memory
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
