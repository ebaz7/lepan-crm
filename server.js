
// --- SYSTEM RESTARTED TO RESOLVE DEPLOYMENT ERROR ---
import 'dotenv/config'; 
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import compression from 'compression'; 
import { fileURLToPath } from 'url';
import cron from 'node-cron'; 
import archiver from 'archiver';
import AdmZip from 'adm-zip';
import webpush from 'web-push';
import * as dbManager from './backend/db-manager.js';
import * as utils from './backend/utils.js';
import { notifyExitPermitStep, notifyPaymentOrderStep, notifyWarehouseBijak, notifyMeetingAnnouncement, notifyMeetingMinutes, notifyPurchaseRequestStep, runDailyReport } from './backend/bot-core.js';
import * as telegram from './backend/telegram.js';
import * as bale from './backend/bale.js';
import * as Renderer from './backend/renderer.js';

const getDb = dbManager.getDb;
const saveDb = dbManager.saveDb;
const findNextGapNumber = utils.findNextGapNumber;
const checkForDuplicate = utils.checkForDuplicate;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = process.cwd(); 

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
app.use(compression({ level: 5 })); 
// INCREASED LIMIT TO 1GB TO SUPPORT FULL SYSTEM RESTORE (Files + DB)
app.use(express.json({ limit: '1024mb' })); 
app.use(express.urlencoded({ limit: '1024mb', extended: true }));

// --- ANTI-CACHE MIDDLEWARE (OPTIMIZED) ---
// We allow ETag/Last-Modified validation (no-cache) but remove no-store to allow 304 Not Modified.
// This significantly speeds up reloads on CDNs/Domains by avoiding full data transfer if unchanged.
app.use((req, res, next) => {
    if (req.method === 'GET') {
        res.set('Cache-Control', 'no-cache, must-revalidate, private');
        // Remove Pragma and Expires to allow ETag validation
    } else {
        // For mutations, we still want to be strict
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
    }
    next();
});

// --- DYNAMIC MANIFEST.JSON ---
app.get('/manifest.json', (req, res) => {
    const db = getDb();
    const settings = db.settings || {};
    const appName = settings.appName || 'مدیریت کارخانه';
    const pwaIcon = settings.pwaIcon || '/icons/icon-512x512.png';

    const manifest = {
        name: appName,
        short_name: appName,
        description: appName,
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#0d9488',
        icons: [
            {
                src: pwaIcon,
                sizes: "192x192",
                type: "image/png"
            },
            {
                src: pwaIcon,
                sizes: "512x512",
                type: "image/png"
            }
        ],
        share_target: {
            action: "/api/share-target",
            method: "POST",
            enctype: "multipart/form-data",
            params: {
                title: "title",
                text: "text",
                url: "url",
                files: [
                    {
                        name: "files",
                        accept: [
                            "image/*",
                            "video/*",
                            "audio/*",
                            "application/*",
                            "text/*"
                        ]
                    }
                ]
            }
        }
    };
    res.json(manifest);
});

app.use('/uploads', express.static(UPLOADS_DIR, { maxAge: '7d' })); // Cache uploads for speed

// --- SHARE TARGET FOR ANDROID AND PWA ---
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, UPLOADS_DIR);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '_' + file.originalname;
        cb(null, uniqueSuffix);
    }
});
const upload = multer({ storage: storage });

app.post('/api/share-target', upload.single('files'), (req, res) => {
    const text = req.body.text || req.body.url || '';
    let sharedUrl = '';
    if (req.file) {
        sharedUrl = `/uploads/${req.file.filename}`;
    }
    const redirectUrl = `/?sharedFileUrl=${encodeURIComponent(sharedUrl)}&sharedText=${encodeURIComponent(text)}`;
    res.redirect(redirectUrl);
});

// Shared data logic moved to db-manager.js and utils.js

// --- AUTOMATIC BACKUP LOGIC ---
let activeBackupJob = null;

const performAutoBackup = () => {
    const db = getDb();
    const settings = db.settings || {};
    const mode = settings.backupMode || 'full'; // 'full' or 'db-only'
    
    console.log(`>>> Starting Automatic Backup (Mode: ${mode})...`);
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16); 
        const filename = `AutoBackup_${mode === 'full' ? 'Full' : 'DB'}_${timestamp}.zip`;
        const filePath = path.join(BACKUPS_DIR, filename);
        
        const output = fs.createWriteStream(filePath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        output.on('close', () => {
            console.log(`✅ Auto Backup Created: ${filename} (${(archive.pointer() / 1024 / 1024).toFixed(2)} MB)`);
        });

        archive.on('error', (err) => { throw err; });
        archive.pipe(output);

        if (fs.existsSync(DB_FILE)) {
            archive.file(DB_FILE, { name: 'database.json' });
        }

        if (mode === 'full' && fs.existsSync(UPLOADS_DIR)) {
            archive.directory(UPLOADS_DIR, 'uploads');
        }

        archive.finalize();
        
        // Cleanup old backups (keep last 20)
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

const setupAutoBackup = () => {
    if (activeBackupJob) {
        activeBackupJob.stop();
        activeBackupJob = null;
    }
    
    const db = getDb();
    const intervalHours = Number(db.settings.backupIntervalHours) || 3;
    console.log(`>>> Scheduling Auto Backup every ${intervalHours} hours.`);
    
    // Convert hours to cron expression: 0 */X * * *
    activeBackupJob = cron.schedule(`0 */${intervalHours} * * *`, performAutoBackup);
};

const setupDailyReports = () => {
    // Schedule daily reports for 23:45 Tehran time
    // Cron runs in UTC. Tehran is UTC+3:30. So 23:45 Tehran is 20:15 UTC.
    cron.schedule('15 20 * * *', async () => {
        console.log(">>> Running Automatic Daily Reports...");
        const db = getDb();
        const settings = db.settings || {};
        
        // Get Tehran current date in Shamsi format for the report
        const now = new Date();
        const dateStr = utils.toShamsiFull(now.toISOString()).split(' ')[0].replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)); // Normalize to English digits
        
        // Groups to notify
        const targets = [];
        
        // 1. Accounting Groups
        if (settings.botAccountingGroupIdTele) targets.push({ platform: 'telegram', id: settings.botAccountingGroupIdTele, type: 'accounting' });
        if (settings.botAccountingGroupIdBale) targets.push({ platform: 'bale', id: settings.botAccountingGroupIdBale, type: 'accounting' });
        if (settings.botAccountingGroupId) targets.push({ platform: 'telegram', id: settings.botAccountingGroupId, type: 'accounting' }); // Fallback

        // 2. Bijak Groups
        if (settings.botBijakGroupId) targets.push({ platform: 'telegram', id: settings.botBijakGroupId, type: 'bijak' });
        if (settings.botBijakGroupIdBale) targets.push({ platform: 'bale', id: settings.botBijakGroupIdBale, type: 'bijak' });

        // 3. Exit Permit Groups (First & Second)
        if (settings.exitPermitNotificationTelegramId) targets.push({ platform: 'telegram', id: settings.exitPermitNotificationTelegramId, type: 'exit' });
        if (settings.exitPermitNotificationBaleId) targets.push({ platform: 'bale', id: settings.exitPermitNotificationBaleId, type: 'exit' });
        
        if (settings.exitPermitFirstGroupConfig?.telegramId) targets.push({ platform: 'telegram', id: settings.exitPermitFirstGroupConfig.telegramId, type: 'exit' });
        if (settings.exitPermitFirstGroupConfig?.baleId) targets.push({ platform: 'bale', id: settings.exitPermitFirstGroupConfig.baleId, type: 'exit' });
        
        if (settings.exitPermitSecondGroupConfig?.telegramId) targets.push({ platform: 'telegram', id: settings.exitPermitSecondGroupConfig.telegramId, type: 'exit' });
        if (settings.exitPermitSecondGroupConfig?.baleId) targets.push({ platform: 'bale', id: settings.exitPermitSecondGroupConfig.baleId, type: 'exit' });

        // Remove duplicates
        const uniqueTargets = Array.from(new Set(targets.map(t => `${t.platform}:${t.id}`)))
            .map(uid => targets.find(t => `${t.platform}:${t.id}` === uid));

        for (const target of uniqueTargets) {
            try {
                const sendFn = async (id, txt, opts) => {
                    if (target.platform === 'telegram') return telegram.sendBotMessage(id, txt, opts);
                    if (target.platform === 'bale') return bale.sendBotMessage(id, txt, opts);
                };
                const sendDocFn = async (id, buf, name, cap) => {
                    if (target.platform === 'telegram') return telegram.sendBotDocument(id, buf, name, cap);
                    if (target.platform === 'bale') return bale.sendBotDocument(id, buf, name, cap);
                };
                
                console.log(`[Cron] Sending daily report to ${target.platform} group ${target.id}`);
                await runDailyReport(target.platform, target.id, dateStr, sendFn, sendDocFn);
            } catch (e) {
                console.error(`[Cron] Failed to send daily report to ${target.id}:`, e.message);
            }
        }
    });
};

setupAutoBackup();
setupDailyReports();
setTimeout(performAutoBackup, 15000); 

// --- STARTUP CLEANUP: Deduplicate Subscriptions ---
try {
    const db = getDb();
    if (db.subscriptions && db.subscriptions.length > 0) {
        const initialCount = db.subscriptions.length;
        const seen = new Set();
        db.subscriptions = db.subscriptions.filter(s => {
            if (!s.endpoint || seen.has(s.endpoint)) return false;
            seen.add(s.endpoint);
            return true;
        });
        if (db.subscriptions.length < initialCount) {
            console.log(`🧹 Startup Cleanup: Removed ${initialCount - db.subscriptions.length} duplicate subscriptions.`);
            saveDb(db);
        }
    }
} catch(e) { console.error("Startup Cleanup Err:", e); }

// Shared helpers moved to utils.js

// --- NOTIFICATION HELPER ---
const broadcastNotification = async (title, body, url = '/', targetRoles = null, targetUsernames = null, excludeUsernames = null) => {
    const notifId = utils.generateUUID();
    try {
        const notifDb = getDb();
        if (!notifDb.notifications) notifDb.notifications = [];
        const newNotif = {
            id: notifId,
            title, body, url, targetRoles, targetUsernames, excludeUsernames,
            createdAt: Date.now(), readBy: []
        };
        notifDb.notifications.push(newNotif);
        if (notifDb.notifications.length > 2000) notifDb.notifications = notifDb.notifications.slice(-1000);
        saveDb(notifDb);
    } catch(e) { console.error("Notification DB Error", e); }

    try {
        const db = getDb();
        const subs = db.subscriptions || [];
        
        // Deduplicate within this broadcast attempt to be absolutely sure
        const seenEndpoints = new Set();
        const uniqueSubs = subs.filter(sub => {
            if (!sub.endpoint || seenEndpoints.has(sub.endpoint)) return false;
            seenEndpoints.add(sub.endpoint);
            return true;
        });

        const filteredSubs = uniqueSubs.filter(sub => {
            // 1. EXPLICIT EXCLUSION (e.g. Sender)
            if (excludeUsernames && excludeUsernames.includes(sub.username)) return false;

            // 2. PRIVACY FILTER: If targetUsernames is provided, only notify those users.
            // Even admins shouldn't see private/targeted notifications unless they are in the target list.
            if (targetUsernames && !targetUsernames.includes(sub.username)) return false;

            // 3. ALWAYS NOTIFY ADMIN for general system notifications (where targetUsernames is not specified)
            if (sub.role === 'admin' && !targetUsernames) return true;
            
            // 4. TARGET ROLES
            if (targetRoles && !targetRoles.includes(sub.role)) return false;
            
            return true;
        });

        // Deliver to all active registered devices of matching subscribers
        const finalSendSubs = filteredSubs;

        console.log(`>>> Broadcasting Notification: "${title}" (ID: ${notifId}) to ${finalSendSubs.length} unique devices (Filtered from ${subs.length} total active devices).`);

        const payload = JSON.stringify({ id: notifId, title, body, url, tab: url.replace('/', '') });

        const sendPromises = finalSendSubs.map(sub => {
            if (sub.type === 'android') {
                const fcmServerKey = db.settings?.fcmServerKey || process.env.FCM_SERVER_KEY;
                if (!fcmServerKey) {
                    console.log(`Skipping Android push notification for ${sub.username} because FCM_SERVER_KEY is not configured.`);
                    return Promise.resolve();
                }
                
                const fcmPayload = {
                    to: sub.endpoint,
                    priority: 'high',
                    notification: {
                        title: title,
                        body: body,
                        sound: 'default',
                        badge: '1'
                    },
                    data: {
                        id: notifId,
                        title: title,
                        body: body,
                        url: url,
                        tab: url.replace('/', ''),
                        click_action: 'FLUTTER_NOTIFICATION_CLICK'
                    }
                };

                return fetch('https://fcm.googleapis.com/fcm/send', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `key=${fcmServerKey}`
                    },
                    body: JSON.stringify(fcmPayload)
                }).then(async res => {
                    const txt = await res.text();
                    console.log(`FCM send result for ${sub.username}: ${res.status} - ${txt}`);
                }).catch(err => {
                    console.error(`FCM send error for ${sub.username}:`, err);
                });
            }
            return webpush.sendNotification(sub, payload).catch(err => {
                if (err.statusCode === 404 || err.statusCode === 410) {
                    console.log(`Removing expired subscription for ${sub.username}`);
                    const db = getDb();
                    db.subscriptions = (db.subscriptions || []).filter(s => s.endpoint !== sub.endpoint);
                    saveDb(db);
                } else {
                    console.error("Push error:", err);
                }
            });
        });

        await Promise.all(sendPromises);
    } catch (e) {
        console.error("Global Broadcast Error:", e);
    }
};

// --- API ROUTES ---

// 1. SEQUENCE GENERATORS
app.get('/api/vapid-key', (req, res) => {
    res.json({ publicKey: vapidKeys.publicKey });
});

// --- NOTIFICATIONS API ---
app.get('/api/notifications', (req, res) => {
    const { username, role } = req.query;
    if (!username || !role) return res.status(400).json({error: "username and role required"});
    const db = getDb();
    const notifs = (db.notifications || []).filter(n => {
         // 1. EXPLICIT EXCLUSION
         if (n.excludeUsernames && n.excludeUsernames.includes(username)) return false;
         
         // 2. PRIVACY FILTER: If targeted users are specified, must be in that list
         if (n.targetUsernames) {
             return n.targetUsernames.includes(username);
         }
         
         // 3. TARGET ROLES: If targeted roles are specified, must be in that list
         if (n.targetRoles) {
             return n.targetRoles.includes(role);
         }

         // 4. ALWAYS ALLOW ADMIN for standard untargeted alerts
         if (role === 'admin') return true;
         
         // Non-admin users should NOT receive notifications that are general unless they are specifically targeted
         return false;
    });
    res.json(notifs.sort((a,b)=>b.createdAt - a.createdAt).slice(0, 100));
});

/**
 * SAYAN API PROXY
 * Used to bypass CORS and Mixed Content (HTTPS -> HTTP) issues.
 */
app.post('/api/sayan-proxy', async (req, res) => {
    const { url, headers, method = 'GET', body } = req.body;
    
    if (!url) return res.status(400).json({ error: 'URL is required' });
    
    try {
        console.log(`[Sayan Proxy] ${method} -> ${url}`);
        
        const fetchOptions = {
            method,
            headers: {
                ...headers,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        };

        if (body && (method === 'POST' || method === 'PUT')) {
            fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
        }

        const response = await fetch(url, fetchOptions);
        const data = await response.json().catch(async () => {
            const text = await response.text().catch(() => '');
            return { rawBody: text };
        });

        res.status(response.status).json(data);
    } catch (error) {
        console.error('[Sayan Proxy Error]', error);
        res.status(500).json({ 
            error: 'Sayan Bridge Connection Failed', 
            details: error.message,
            isLocalIp: url.includes('192.168.') || url.includes('10.') || url.includes('127.0.0.1')
        });
    }
});

app.post('/api/notifications/read', (req, res) => {
    const { username, id } = req.body;
    const db = getDb();
    if (!db.notifications) db.notifications = [];
    if (id === 'all') {
         db.notifications.forEach(n => {
             if (!n.readBy) n.readBy = [];
             if (!n.readBy.includes(username)) n.readBy.push(username);
         });
    } else {
         const n = db.notifications.find(n => n.id === id);
         if (n) {
             if (!n.readBy) n.readBy = [];
             if (!n.readBy.includes(username)) n.readBy.push(username);
         }
    }
    saveDb(db);
    res.json({success: true});
});

app.post('/api/notifications/delete', (req, res) => {
    const { username, id } = req.body;
    const db = getDb();
    if (!db.notifications) db.notifications = [];
    if (id === 'all') {
         db.notifications.forEach(n => {
             if (!n.excludeUsernames) n.excludeUsernames = [];
             if (!n.excludeUsernames.includes(username)) n.excludeUsernames.push(username);
         });
    } else {
         const n = db.notifications.find(n => n.id === id);
         if (n) {
             if (!n.excludeUsernames) n.excludeUsernames = [];
             if (!n.excludeUsernames.includes(username)) n.excludeUsernames.push(username);
         }
    }
    saveDb(db);
    res.json({success: true});
});

// --- PRODUCT MANAGEMENT API ---
app.get('/api/products', (req, res) => {
    const db = getDb();
    res.json(db.products || []);
});

app.post('/api/products', (req, res) => {
    const db = getDb();
    if (!db.products) db.products = [];
    const newProduct = { ...req.body, id: utils.generateUUID() };
    db.products.push(newProduct);
    saveDb(db);
    res.json({ success: true, product: newProduct });
});

app.put('/api/products/:id', (req, res) => {
    const db = getDb();
    if (!db.products) db.products = [];
    const idx = db.products.findIndex(p => p.id === req.params.id);
    if (idx > -1) {
        db.products[idx] = { ...db.products[idx], ...req.body };
        saveDb(db);
        res.json({ success: true, product: db.products[idx] });
    } else {
        res.status(404).json({ error: 'Not found' });
    }
});

app.delete('/api/products/:id', (req, res) => {
    const db = getDb();
    if (!db.products) db.products = [];
    db.products = db.products.filter(p => p.id !== req.params.id);
    saveDb(db);
    res.json({ success: true });
});

app.get('/api/customer-orders', (req, res) => {
    const db = getDb();
    res.json(db.customerOrders || []);
});

app.put('/api/customer-orders/:id', (req, res) => {
    const db = getDb();
    if (!db.customerOrders) db.customerOrders = [];
    const idx = db.customerOrders.findIndex(o => o.id === req.params.id);
    if (idx > -1) {
        db.customerOrders[idx] = { ...db.customerOrders[idx], ...req.body };
        saveDb(db);
        res.json({ success: true, order: db.customerOrders[idx] });
    } else {
        res.status(404).json({ error: 'Not found' });
    }
});

app.delete('/api/customer-orders/:id', (req, res) => {
    const db = getDb();
    if (!db.customerOrders) db.customerOrders = [];
    db.customerOrders = db.customerOrders.filter(o => o.id !== req.params.id);
    saveDb(db);
    res.json({ success: true });
});

app.post('/api/subscribe', (req, res) => {
    const db = getDb();
    if (!db.subscriptions) db.subscriptions = [];
    
    const newSub = req.body;
    newSub.updatedAt = Date.now(); // Record when this subscription was registered/refreshed
    
    // Prevent duplicates and CLEANUP existing duplicates for this endpoint
    const idx = db.subscriptions.findIndex(s => s.endpoint === newSub.endpoint);
    
    if (idx === -1) {
        db.subscriptions.push(newSub);
    } else {
        // Update user info and keep it fresh
        db.subscriptions[idx] = { ...db.subscriptions[idx], ...newSub };
    }
    
    // Global deduplication check: ensure no two entries have the same endpoint
    const seen = new Set();
    const unique = [];
    for (const s of db.subscriptions) {
        if (!seen.has(s.endpoint)) {
            // Prune subscriptions older than 7 days (stale systems auto-disconnected)
            const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
            const subTime = s.updatedAt || Date.now();
            if (subTime > cutoff) {
                seen.add(s.endpoint);
                unique.push(s);
            }
        }
    }
    db.subscriptions = unique;

    saveDb(db);
    res.status(201).json({});
});

app.post('/api/unsubscribe', (req, res) => {
    const db = getDb();
    if (!db.subscriptions) return res.json({});
    
    const { endpoint, username } = req.body;
    
    // Unsubscribe by endpoint preferentially. 
    // This allows logging out of one machine without disconnecting all of the user's devices.
    if (endpoint) {
        db.subscriptions = db.subscriptions.filter(s => s.endpoint !== endpoint);
    } else if (username) {
        // If no endpoint is specified, only then do we prune all devices for this username.
        db.subscriptions = db.subscriptions.filter(s => s.username !== username);
    }
    
    saveDb(db);
    res.json({});
});

app.get('/api/next-tracking-number', (req, res) => {
    const db = getDb();
    const company = req.query.company || '';
    let minStart = db.settings.currentTrackingNumber || 1000;
    if (db.settings.activeFiscalYearId && company) {
        const year = (db.settings.fiscalYears || []).find(y => y.id === db.settings.activeFiscalYearId);
        if (year && year.companySequences && year.companySequences[company]) {
            minStart = year.companySequences[company].startTrackingNumber || minStart;
        }
    } 
    let nextNum = findNextGapNumber(db.orders, company, 'trackingNumber', minStart);
    while (checkForDuplicate(db.orders, 'trackingNumber', nextNum, 'payingCompany', company)) {
        nextNum++;
    }
    res.json({ nextTrackingNumber: nextNum });
});

app.get('/api/next-exit-permit-number', (req, res) => {
    const db = getDb();
    const company = req.query.company || '';
    let minStart = db.settings.currentExitPermitNumber || 1000;
    if (db.settings.activeFiscalYearId && company) {
        const year = (db.settings.fiscalYears || []).find(y => y.id === db.settings.activeFiscalYearId);
        if (year && year.companySequences && year.companySequences[company]) {
            minStart = year.companySequences[company].startExitPermitNumber || minStart;
        }
    }
    let nextNum = findNextGapNumber(db.exitPermits, company, 'permitNumber', minStart);
    while (checkForDuplicate(db.exitPermits, 'permitNumber', nextNum, 'company', company)) {
        nextNum++;
    }
    res.json({ nextNumber: nextNum });
});

app.get('/api/next-bijak-number', (req, res) => {
    const db = getDb();
    const company = req.query.company || '';
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
    let nextNum = findNextGapNumber(outTxs, company, 'number', minStart);
    while (checkForDuplicate(outTxs, 'number', nextNum, 'company', company)) {
        nextNum++;
    }
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
    res.json(db.orders || []); 
    
    // Send bot group notifications
    notifyPaymentOrderStep(order, db, 'ثبت اولیه', false).catch(e => console.error("Bot Order Notify Error:", e));

    // Notify relevant roles
    broadcastNotification(
        `دستور پرداخت ثبت شد`,
        `دستور پرداخت شماره ${order.trackingNumber} ثبت شد.`,
        '/payment-approvals',
        ['FINANCIAL', 'ADMIN'],
        null,
        [order.requester] // Exclude requester
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

        const isExplicitEdit = req.body.isEdit === true;
        const updatedOrder = { ...db.orders[idx], ...req.body };
        delete updatedOrder.isEdit;
        const isFinal = updatedOrder.status === 'تایید نهایی' || updatedOrder.status === 'پرداخت شده';
        
        // Notification Logic for Status Change
        if (isExplicitEdit) {
            notifyPaymentOrderStep(updatedOrder, db, updatedOrder.status, isFinal, 'EDIT').catch(e => console.error("Bot Order Notify Error:", e));
        } else if (currentOrder.status !== updatedOrder.status) {
            
            // Send bot group notifications
            notifyPaymentOrderStep(updatedOrder, db, updatedOrder.status, isFinal).catch(e => console.error("Bot Order Notify Error:", e));

            // Notify Requestor
            if (updatedOrder.requester) {
                broadcastNotification(
                    'تغییر وضعیت درخواست پرداخت',
                    `درخواست پرداخت #${updatedOrder.trackingNumber} به وضعیت "${updatedOrder.status}" تغییر یافت.`,
                    '/payment-orders',
                    null,
                    [updatedOrder.requester]
                );
            }

            // Workflow Notifications
            if (updatedOrder.status === 'تایید مالی / در انتظار مدیریت') {
                broadcastNotification('تایید مالی پرداخت', `سند #${updatedOrder.trackingNumber} تایید مالی شد و در انتظار تایید مدیریت است.`, '/payment-approvals', ['MANAGER']);
            } else if (updatedOrder.status === 'تایید مدیریت / در انتظار مدیرعامل') {
                broadcastNotification('تایید مدیریت پرداخت', `سند #${updatedOrder.trackingNumber} تایید مدیریت شد و در انتظار تایید مدیرعامل است.`, '/payment-approvals', ['CEO']);
            } else if (updatedOrder.status === 'تایید نهایی') {
                broadcastNotification('تایید نهایی پرداخت', `سند #${updatedOrder.trackingNumber} تایید نهایی شد. لطفا نسبت به پرداخت اقدام کنید.`, '/payment-orders', ['FINANCIAL']);
            } else if (updatedOrder.status === 'رد شده') {
                broadcastNotification('رد درخواست پرداخت', `سند #${updatedOrder.trackingNumber} رد شد.`, '/payment-orders', ['ADMIN'], [updatedOrder.requester]);
            }
        }

        db.orders[idx] = updatedOrder; 
        saveDb(db); 
        res.json(db.orders); 
    } else res.status(404).send('Not Found'); 
});
app.delete('/api/orders/:id', (req, res) => { 
    const db = getDb(); 
    const order = db.orders.find(o => o.id === req.params.id);
    if (order) {
        notifyPaymentOrderStep(order, db, 'حذف شده', false, 'DELETE').catch(e => {});
    }
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

    // Bot Group Notification
    notifyExitPermitStep(permit, null, null, null, db, 'ثبت اولیه').catch(e => console.error("Bot Notify Creation Error:", e));

    broadcastNotification(
        'درخواست خروج کالا',
        `مجوز شماره ${permit.permitNumber} برای ${permit.customerName}`,
        '/exit-approvals',
        ['CEO', 'ADMIN'],
        null,
        [permit.requester] // Exclude requester
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

        const isExplicitEdit = req.body.isEdit === true;
        const updatedPermit = { ...db.exitPermits[idx], ...req.body };
        // Delete transient flag so it doesn't get persisted
        delete updatedPermit.isEdit;

        // Notification Logic
        if (isExplicitEdit) {
            // It's definitely an edit from the Edit form
            notifyExitPermitStep(updatedPermit, null, null, null, db, updatedPermit.status, 'EDIT').catch(e => {});
        } else if (currentPermit.status !== updatedPermit.status) {
            // 1. Bot Group Notifications
            notifyExitPermitStep(updatedPermit, null, null, null, db, updatedPermit.status).catch(e => console.error("Bot Notify Error in server.js:", e));
        }

        // 2. Web Browser Push Notifications (for both status change and edits)
        if (updatedPermit.requester) {
            const title = currentPermit.status !== updatedPermit.status ? 'تغییر وضعیت مجوز خروج' : 'ویرایش مجوز خروج';
            const body = currentPermit.status !== updatedPermit.status 
                ? `مجوز خروج ${updatedPermit.permitNumber} به وضعیت "${updatedPermit.status}" تغییر یافت.`
                : `مجوز خروج ${updatedPermit.permitNumber} ویرایش شد.`;
            
            broadcastNotification(title, body, '/exit-permits', null, [updatedPermit.requester]);
        }

        // Workflow Notifications (only on status change)
        if (currentPermit.status !== updatedPermit.status) {
            if (updatedPermit.status === 'در انتظار مدیر کارخانه') {
                broadcastNotification('تایید مدیرعامل خروج', `مجوز #${updatedPermit.permitNumber} تایید مدیرعامل شد و در انتظار مدیر کارخانه است.`, '/exit-approvals', ['FACTORY_MANAGER']);
            } else if (updatedPermit.status === 'در انتظار تایید انبار') {
                broadcastNotification('تایید مدیر کارخانه خروج', `مجوز #${updatedPermit.permitNumber} تایید مدیر کارخانه شد و در انتظار تایید انبار است.`, '/exit-approvals', ['WAREHOUSE_KEEPER']);
            } else if (updatedPermit.status === 'در انتظار خروج') {
                broadcastNotification('تایید انبار خروج', `مجوز #${updatedPermit.permitNumber} تایید انبار شد و در انتظار خروج است.`, '/security-panel', ['SECURITY_HEAD', 'SECURITY_GUARD']);
            } else if (updatedPermit.status === 'خارج شده (بایگانی)') {
                broadcastNotification('خروج نهایی کالا', `مجوز #${updatedPermit.permitNumber} از کارخانه خارج شد.`, '/exit-permits', ['CEO', 'FACTORY_MANAGER', 'WAREHOUSE_KEEPER', 'SECURITY_HEAD', 'ADMIN'], [updatedPermit.requester]);
            } else if (updatedPermit.status === 'رد شده') {
                broadcastNotification('رد مجوز خروج', `مجوز #${updatedPermit.permitNumber} رد شد.`, '/exit-permits', ['ADMIN'], [updatedPermit.requester]);
            }
        }

        db.exitPermits[idx] = updatedPermit; 
        saveDb(db); 
        res.json(db.exitPermits); 
    } else res.status(404).send('Not Found'); 
});
app.delete('/api/exit-permits/:id', (req, res) => { 
    const db = getDb(); 
    const permit = db.exitPermits.find(p => p.id === req.params.id);
    if (permit) {
        notifyExitPermitStep(permit, null, null, null, db, 'حذف شده', 'DELETE').catch(e => {});
    }
    db.exitPermits = db.exitPermits.filter(p => p.id !== req.params.id); 
    saveDb(db); 
    res.json(db.exitPermits); 
});

// 3.5 PURCHASE & PART MASTER DATA
app.get('/api/part-master-data', (req, res) => res.json(getDb().partMasterData || []));
app.post('/api/part-master-data', (req, res) => { const db = getDb(); if(!db.partMasterData) db.partMasterData=[]; db.partMasterData.push(req.body); saveDb(db); res.json(db.partMasterData); });
app.put('/api/part-master-data/:id', (req, res) => { const db = getDb(); const idx = (db.partMasterData||[]).findIndex(p => p.id === req.params.id); if(idx > -1) { db.partMasterData[idx] = { ...db.partMasterData[idx], ...req.body }; saveDb(db); res.json(db.partMasterData); } else res.status(404).send('Not Found'); });
app.delete('/api/part-master-data/:id', (req, res) => { const db = getDb(); db.partMasterData = (db.partMasterData||[]).filter(p => p.id !== req.params.id); saveDb(db); res.json(db.partMasterData); });

// --- NOTES API ---
app.get('/api/notes', (req, res) => {
    res.json(getDb().notes || []);
});
app.post('/api/notes', (req, res) => {
    const db = getDb();
    if (!db.notes) db.notes = [];
    db.notes.unshift(req.body);
    saveDb(db);
    res.json(db.notes);
});
app.put('/api/notes/:id', (req, res) => {
    const db = getDb();
    const idx = (db.notes || []).findIndex(n => n.id === req.params.id);
    if (idx > -1) {
        db.notes[idx] = { ...db.notes[idx], ...req.body };
        saveDb(db);
        res.json(db.notes);
    } else res.status(404).send('Not Found');
});
app.delete('/api/notes/:id', (req, res) => {
    const db = getDb();
    db.notes = (db.notes || []).filter(n => n.id !== req.params.id);
    saveDb(db);
    res.json(db.notes);
});

app.get('/api/part-kardex/:partId', (req, res) => {
    const db = getDb();
    const kardex = (db.partKardex || []).filter(k => k.partId === req.params.partId);
    res.json(kardex);
});

app.get('/api/purchase-requests', (req, res) => res.json(getDb().purchaseRequests || []));
app.post('/api/purchase-requests', (req, res) => { 
    const db = getDb(); 
    if(!db.purchaseRequests) db.purchaseRequests=[]; 
    db.purchaseRequests.unshift(req.body); 
    saveDb(db); 
    notifyPurchaseRequestStep(req.body, null, null, null, db, 'ثبت درخواست خرید').catch(e => console.error("Purchase Notification POST:", e));
    res.json(db.purchaseRequests); 
});
app.put('/api/purchase-requests/:id', (req, res) => { 
    const db = getDb(); 
    const idx = (db.purchaseRequests||[]).findIndex(r => r.id === req.params.id); 
    if(idx > -1) { 
        const oldReq = db.purchaseRequests[idx];
        db.purchaseRequests[idx] = { ...db.purchaseRequests[idx], ...req.body }; 
        saveDb(db); 
        if (req.body.status !== oldReq.status) {
            notifyPurchaseRequestStep(db.purchaseRequests[idx], null, null, null, db, req.body.status + ' (تغییر وضعیت)').catch(e => console.error("Purchase Notification PUT:", e));
        }
        res.json(db.purchaseRequests); 
    } else res.status(404).send('Not Found'); 
});
app.delete('/api/purchase-requests/:id', (req, res) => { 
    const db = getDb(); 
    db.purchaseRequests = (db.purchaseRequests||[]).filter(r => r.id !== req.params.id); 
    saveDb(db); 
    res.json(db.purchaseRequests); 
});

app.get('/api/next-purchase-request-number', (req, res) => {
    const db = getDb();
    const lastNum = db.purchaseRequests && db.purchaseRequests.length > 0 
        ? Math.max(...db.purchaseRequests.map(r => {
            const match = r.requestNumber.match(/\d+/);
            return match ? parseInt(match[0]) : 0;
        }))
        : 1000;
    res.json({ nextNumber: `PR-${lastNum + 1}` });
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
        notifyWarehouseBijak(tx, db, 'ثبت اولیه').catch(e => console.error("Bot Bijak Notify Error:", e));
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

        const isExplicitEdit = req.body.isEdit === true;
        const updatedTx = { ...db.warehouseTransactions[idx], ...req.body };
        delete updatedTx.isEdit;

        if (updatedTx.type === 'OUT') {
            if (isExplicitEdit) {
                notifyWarehouseBijak(updatedTx, db, updatedTx.status || 'PENDING', 'EDIT').catch(e => console.error("Bot Bijak Notify Error:", e));
            } else if (currentTx.status !== updatedTx.status) {
                notifyWarehouseBijak(updatedTx, db, updatedTx.status === 'APPROVED' ? 'تایید نهایی' : updatedTx.status).catch(e => console.error("Bot Bijak Notify Error:", e));
            }
        }

        db.warehouseTransactions[idx] = updatedTx; 
        saveDb(db); 
        res.json(db.warehouseTransactions); 
    } else res.status(404).send('Not Found'); 
});
app.delete('/api/warehouse/transactions/:id', (req, res) => { 
    const db = getDb(); 
    const tx = db.warehouseTransactions.find(t => t.id === req.params.id);
    if (tx && tx.type === 'OUT') {
        notifyWarehouseBijak(tx, db, 'حذف شده', 'DELETE').catch(e => {});
    }
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

// 6.5 MEETINGS
app.get('/api/meetings', (req, res) => {
    res.json(getDb().meetings || []);
});
app.post('/api/meetings', (req, res) => {
    const db = getDb();
    if (!db.meetings) db.meetings = [];
    db.meetings.push(req.body);
    saveDb(db);
    res.json(db.meetings);
});
app.put('/api/meetings/:id', (req, res) => {
    const db = getDb();
    const idx = db.meetings.findIndex(m => m.id === req.params.id);
    if (idx > -1) {
        const oldMeeting = db.meetings[idx];
        db.meetings[idx] = { ...oldMeeting, ...req.body };
        saveDb(db);
        
        // AUTO-NOTIFICATION: If status becomes 'تایید شده' for the first time
        if (oldMeeting.status !== 'تایید شده' && db.meetings[idx].status === 'تایید شده' && !db.meetings[idx].minutesSent) {
            notifyMeetingMinutes(db.meetings[idx], db).catch(e => console.error("Bot Meeting Auto-Minutes Error:", e));
            db.meetings[idx].minutesSent = true;
            saveDb(db);
        }
        res.json(db.meetings);
    } else res.status(404).send('Not Found');
});
app.delete('/api/meetings/:id', (req, res) => {
    const db = getDb();
    db.meetings = db.meetings.filter(m => m.id !== req.params.id);
    saveDb(db);
    res.json(db.meetings);
});
app.get('/api/next-meeting-number', (req, res) => {
    const db = getDb();
    const lastNum = db.meetings && db.meetings.length > 0 
        ? Math.max(...db.meetings.map(m => {
            const match = m.meetingNumber.match(/\d+/);
            return match ? parseInt(match[0]) : 0;
        }))
        : 100;
    res.json({ nextNumber: `M-${lastNum + 1}` });
});

// BOT SENDING ENDPOINTS
app.get('/api/meetings/:id/pdf', async (req, res) => {
    const db = getDb();
    const meeting = (db.meetings || []).find(m => m.id === req.params.id);
    if (!meeting) return res.status(404).send('Meeting not found');
    try {
        const pdf = await Renderer.generateMeetingMinutesPDF(meeting);
        res.set('Content-Type', 'application/pdf');
        res.set('Content-Disposition', `attachment; filename="Meeting_${meeting.meetingNumber}.pdf"`);
        res.send(pdf);
    } catch(e) {
        console.error("PDF Generation Error:", e);
        res.status(500).send('Error generating PDF');
    }
});

app.post('/api/meetings/:id/announce', async (req, res) => {
    const db = getDb();
    const meeting = db.meetings.find(m => m.id === req.params.id);
    if (meeting) {
        notifyMeetingAnnouncement(meeting, db).catch(e => console.error("Bot Meeting Announce Error:", e));
        meeting.announcementSent = true;
        saveDb(db);
        res.json({ success: true });
    } else res.status(404).send('Not Found');
});

app.post('/api/meetings/:id/send-minutes', async (req, res) => {
    const db = getDb();
    const meeting = db.meetings.find(m => m.id === req.params.id);
    if (meeting) {
        notifyMeetingMinutes(meeting, db).catch(e => console.error("Bot Meeting Minutes Error:", e));
        meeting.minutesSent = true;
        saveDb(db);
        res.json({ success: true });
    } else res.status(404).send('Not Found');
});

app.post('/api/bot/send-by-phone', async (req, res) => {
    try {
        const { phone, text, photoBase64 } = req.body;
        const botCore = await import('./backend/bot-core.js');
        const success = await botCore.sendBotMessageByPhone(phone, text, photoBase64);
        res.json({ success });
    } catch (e) {
        console.error("API Send Bot Phone Error:", e);
        res.status(500).json({ success: false, error: e.message });
    }
});

// 7. SYSTEM (Settings, Users, Login)
app.get('/api/settings', (req, res) => {
    res.json(getDb().settings);
});
app.post('/api/settings', (req, res) => { 
    const db = getDb(); 
    const newSettings = { ...req.body };

    // Sanitize Group IDs (Handle "123-" typo from RTL input)
    const sanitizeId = (id) => {
        if (!id) return '';
        let str = id.toString().trim();
        // If ends with minus, move it to front
        if (str.endsWith('-')) {
            str = '-' + str.slice(0, -1);
        }
        // Remove any other non-numeric chars (except minus at start)
        // This regex allows optional minus at start, then digits
        const match = str.match(/^-?\d+/);
        return match ? match[0] : str;
    };

    if (newSettings.reportsGroupId) newSettings.reportsGroupId = utils.sanitizeGroupId(newSettings.reportsGroupId);
    if (newSettings.telegramReportsGroupId) newSettings.telegramReportsGroupId = utils.sanitizeGroupId(newSettings.telegramReportsGroupId);
    if (newSettings.baleReportsGroupId) newSettings.baleReportsGroupId = utils.sanitizeGroupId(newSettings.baleReportsGroupId);
    
    if (newSettings.reportsGroupId2) newSettings.reportsGroupId2 = utils.sanitizeGroupId(newSettings.reportsGroupId2);
    if (newSettings.telegramReportsGroupId2) newSettings.telegramReportsGroupId2 = utils.sanitizeGroupId(newSettings.telegramReportsGroupId2);
    if (newSettings.baleReportsGroupId2) newSettings.baleReportsGroupId2 = utils.sanitizeGroupId(newSettings.baleReportsGroupId2);
    if (newSettings.whatsappReportsGroupId2) newSettings.whatsappReportsGroupId2 = utils.sanitizeGroupId(newSettings.whatsappReportsGroupId2);

    if (newSettings.botMeetingMinutesTelegramId) newSettings.botMeetingMinutesTelegramId = utils.sanitizeGroupId(newSettings.botMeetingMinutesTelegramId);
    if (newSettings.botMeetingMinutesSecondGroupIdTele) newSettings.botMeetingMinutesSecondGroupIdTele = utils.sanitizeGroupId(newSettings.botMeetingMinutesSecondGroupIdTele);
    if (newSettings.botMeetingMinutesBaleId) newSettings.botMeetingMinutesBaleId = utils.sanitizeGroupId(newSettings.botMeetingMinutesBaleId);
    if (newSettings.botMeetingMinutesSecondGroupIdBale) newSettings.botMeetingMinutesSecondGroupIdBale = utils.sanitizeGroupId(newSettings.botMeetingMinutesSecondGroupIdBale);
    if (newSettings.botMeetingMinutesWhatsAppId) newSettings.botMeetingMinutesWhatsAppId = utils.sanitizeGroupId(newSettings.botMeetingMinutesWhatsAppId);
    if (newSettings.botMeetingMinutesSecondGroupIdWhatsApp) newSettings.botMeetingMinutesSecondGroupIdWhatsApp = utils.sanitizeGroupId(newSettings.botMeetingMinutesSecondGroupIdWhatsApp);

    const oldSettings = db.settings || {};
    db.settings = { ...db.settings, ...newSettings }; 
    saveDb(db); 

    // Auto-restart bots if tokens changed
    if (newSettings.telegramBotToken && newSettings.telegramBotToken !== oldSettings.telegramBotToken) {
        safeImport('./backend/telegram.js').then(m => m && m.initTelegram(newSettings.telegramBotToken));
    }
    if (newSettings.baleBotToken && newSettings.baleBotToken !== oldSettings.baleBotToken) {
        safeImport('./backend/bale.js').then(m => m && m.initBaleBot(newSettings.baleBotToken));
    }
    
    // Reschedule backup if interval changed
    if (newSettings.backupIntervalHours !== undefined) {
        setupAutoBackup();
    }
    
    res.json(db.settings); 
});
app.get('/api/users', (req, res) => {
    res.json(getDb().users);
});

// --- BOT SUBSCRIBERS API ---
app.get('/api/bot-subscribers', (req, res) => {
    res.json(getDb().botSubscribers || []);
});

app.delete('/api/bot-subscribers/:id', (req, res) => {
    const db = getDb();
    db.botSubscribers = (db.botSubscribers || []).filter(s => s.id !== req.params.id);
    saveDb(db);
    res.json({ success: true });
});

// --- CUSTOMER BALANCES API ---
app.get('/api/customer-balances', (req, res) => {
    const db = getDb();
    res.json({
        balances: db.customerBalances || [],
        lastXlsxUploadAt: db.lastXlsxUploadAt || null
    });
});

app.post('/api/customer-balances/bulk', (req, res) => {
    const db = getDb();
    let records = req.body;
    if (records && !Array.isArray(records) && Array.isArray(records.records)) {
        records = records.records;
    }
    if (Array.isArray(records)) {
        db.customerBalances = records.map(r => ({
            id: r.id || Date.now().toString() + Math.random().toString(36).substring(2, 7),
            accountCode: String(r.accountCode || '').trim(),
            name: String(r.name || r.customerName || '').trim(),
            balance: Number(r.balance || 0),
            type: String(r.type || 'تسویه').trim(), // 'بدهکار' | 'بستانکار' | 'تسویه'
            updatedAt: Date.now()
        })).filter(r => r.name || r.accountCode); // Keep valid items
        db.lastXlsxUploadAt = Date.now();
        saveDb(db);
        res.json({ success: true, count: db.customerBalances.length, lastXlsxUploadAt: db.lastXlsxUploadAt });
    } else {
        res.status(400).json({ error: "Invalid data format (must be array or have records array)" });
    }
});

app.get('/api/customer-balances/chat-codes', (req, res) => {
    res.json(getDb().customerChatCodes || []);
});

app.post('/api/customer-balances/chat-code', (req, res) => {
    const db = getDb();
    const { chatId, platform, accountCode } = req.body;
    if (!chatId || !platform || !accountCode) {
        return res.status(400).json({ error: "chatId, platform, and accountCode are required" });
    }
    if (!db.customerChatCodes) db.customerChatCodes = [];
    
    // Check if accountCode exists in balance database or list to map correctly
    db.customerChatCodes = db.customerChatCodes.filter(c => !(c.chatId === String(chatId) && c.platform === String(platform)));
    db.customerChatCodes.push({
        chatId: String(chatId),
        platform: String(platform),
        accountCode: String(accountCode).trim(),
        updatedAt: Date.now()
    });
    saveDb(db);
    res.json({ success: true, count: db.customerChatCodes.length });
});

app.delete('/api/customer-balances/chat-code/:chatId/:platform', (req, res) => {
    const db = getDb();
    if (!db.customerChatCodes) db.customerChatCodes = [];
    const beforeCount = db.customerChatCodes.length;
    db.customerChatCodes = db.customerChatCodes.filter(c => !(c.chatId === String(req.params.chatId) && c.platform === String(req.params.platform)));
    saveDb(db);
    res.json({ success: true, deleted: beforeCount - db.customerChatCodes.length });
});

// --- CUSTOMER STATEMENT STATEMENTS API ---
app.get('/api/customer-balances/statements/:accountCode', (req, res) => {
    const db = getDb();
    const list = db.customerStatements || [];
    if (req.params.accountCode === 'all') {
        res.json(list);
    } else {
        res.json(list.filter(s => s.accountCode === req.params.accountCode));
    }
});

app.post('/api/customer-balances/statement', (req, res) => {
    const db = getDb();
    const { accountCode, fileName, fileType, fileData } = req.body;
    if (!accountCode || !fileName || !fileData) {
        return res.status(400).json({ error: "Missing required fields: accountCode, fileName, and fileData" });
    }
    if (!db.customerStatements) db.customerStatements = [];
    
    const statement = {
        id: Date.now().toString() + Math.random().toString(36).substring(2, 7),
        accountCode: String(accountCode).trim(),
        fileName: String(fileName).trim(),
        fileType: String(fileType || 'pdf').toLowerCase(),
        fileData: String(fileData), // Base64 representation
        uploadedAt: Date.now()
    };
    db.customerStatements.push(statement);
    saveDb(db);
    res.json({ success: true, statementId: statement.id });
});

app.delete('/api/customer-balances/statement/:id', (req, res) => {
    const db = getDb();
    if (!db.customerStatements) db.customerStatements = [];
    const beforeCount = db.customerStatements.length;
    db.customerStatements = db.customerStatements.filter(s => s.id !== req.params.id);
    saveDb(db);
    res.json({ success: true, deleted: beforeCount - db.customerStatements.length });
});

app.get('/api/customer-balances/statement-download/:id', (req, res) => {
    const db = getDb();
    const statement = (db.customerStatements || []).find(s => s.id === req.params.id);
    if (!statement) {
        return res.status(404).send("Statement not found");
    }
    const buffer = Buffer.from(statement.fileData, 'base64');
    let contentType = 'application/octet-stream';
    if (statement.fileType === 'pdf') {
        contentType = 'application/pdf';
    } else if (statement.fileType === 'xlsx') {
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    } else if (statement.fileType === 'xls') {
        contentType = 'application/vnd.ms-excel';
    }
    res.set('Content-Type', contentType);
    res.set('Content-Disposition', `attachment; filename="${encodeURIComponent(statement.fileName)}"`);
    res.send(buffer);
});

// PDF Report: Debtors (بدهکاران) sorted from highest to lowest balance
app.get('/api/customer-balances/reports/debtors/pdf', async (req, res) => {
    try {
        const db = getDb();
        const hideZero = req.query.hideZero === 'true';
        let list = (db.customerBalances || [])
            .filter(b => b.type === 'بدهکار' || b.type?.includes('بدهکار'));

        if (hideZero) {
            list = list.filter(b => b.balance !== 0);
        }

        list = list.sort((a, b) => b.balance - a.balance);

        const lastUpload = db.lastXlsxUploadAt ? new Date(db.lastXlsxUploadAt) : null;
        const uploadStr = lastUpload ? new Intl.DateTimeFormat('fa-IR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tehran' }).format(lastUpload) : 'ثبت نشده';

        const title = `گزارش بدهکاران - مبنای اکسل: ${uploadStr}`;
        const columns = ['کد حسابداری', 'نام مشتری', 'مانده بدهکار (ریال)', 'تشخیص'];
        const formatNumber = (num) => Number(num).toLocaleString('fa-IR');
        const rows = list.map(item => [
            item.accountCode,
            item.name,
            formatNumber(item.balance),
            'بدهکار'
        ]);

        // Add Total row
        const total = list.reduce((sum, item) => sum + item.balance, 0);
        rows.push(['---', 'جمع کل بدهکاران', formatNumber(total), '---']);

        const pdf = await Renderer.generateReportPDF(title, columns, rows);
        res.set('Content-Type', 'application/pdf');
        res.set('Content-Disposition', 'attachment; filename="Debtors_Report.pdf"');
        res.send(pdf);
    } catch (e) {
        console.error("Debtors PDF Export Error:", e);
        res.status(500).send("Error generating PDF: " + e.message);
    }
});

// PDF Report: Creditors (بستانکاران) sorted from highest to lowest balance
app.get('/api/customer-balances/reports/creditors/pdf', async (req, res) => {
    try {
        const db = getDb();
        const hideZero = req.query.hideZero === 'true';
        let list = (db.customerBalances || [])
            .filter(b => b.type === 'بستانکار' || b.type?.includes('بستانکار'));

        if (hideZero) {
            list = list.filter(b => b.balance !== 0);
        }

        list = list.sort((a, b) => b.balance - a.balance);

        const lastUpload = db.lastXlsxUploadAt ? new Date(db.lastXlsxUploadAt) : null;
        const uploadStr = lastUpload ? new Intl.DateTimeFormat('fa-IR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tehran' }).format(lastUpload) : 'ثبت نشده';

        const title = `گزارش بستانکاران - مبنای اکسل: ${uploadStr}`;
        const columns = ['کد حسابداری', 'نام مشتری', 'مانده بستانکار (ریال)', 'تشخیص'];
        const formatNumber = (num) => Number(num).toLocaleString('fa-IR');
        const rows = list.map(item => [
            item.accountCode,
            item.name,
            formatNumber(item.balance),
            'بستانکار'
        ]);

        // Add Total row
        const total = list.reduce((sum, item) => sum + item.balance, 0);
        rows.push(['---', 'جمع کل بستانکاران', formatNumber(total), '---']);

        const pdf = await Renderer.generateReportPDF(title, columns, rows);
        res.set('Content-Type', 'application/pdf');
        res.set('Content-Disposition', 'attachment; filename="Creditors_Report.pdf"');
        res.send(pdf);
    } catch (e) {
        console.error("Creditors PDF Export Error:", e);
        res.status(500).send("Error generating PDF: " + e.message);
    }
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
        
        // Keep active subscription timestamps fresh
        if (db.subscriptions) {
            let subUpdated = false;
            db.subscriptions.forEach(s => {
                if (s.username === username) {
                    s.updatedAt = Date.now();
                    subUpdated = true;
                }
            });
        }
        
        saveDb(db);
    }
    res.json({ success: true });
});

// BROADCAST TO BOT USERS
app.post('/api/bot/broadcast', async (req, res) => {
    try {
        const { message, platform = 'all', target = 'all' } = req.body;
        const db = getDb();
        
        let targetTargets = [];
        
        if (target === 'users') {
            targetTargets = db.users || [];
        } else if (target === 'contacts') {
            targetTargets = db.settings.savedContacts || [];
        } else if (target === 'all_subscribers') {
            const users = db.users || [];
            const contacts = db.settings.savedContacts || [];
            const subscribers = db.botSubscribers || []; // We'll add this
            targetTargets = [...users, ...contacts, ...subscribers];
        } else {
            // Default: All registered users who have linked their chat IDs
            targetTargets = db.users || [];
        }

        const botUsers = targetTargets.filter(u => u.telegramChatId || u.baleChatId || u.whatsappChatId || u.telegramId || u.baleId);
        
        let telegramCount = 0;
        let baleCount = 0;
        
        if (platform === 'all' || platform === 'telegram') {
            const telUsers = botUsers.filter(u => u.telegramChatId || u.telegramId);
            if (telUsers.length > 0) {
                const tgModule = await import('./backend/telegram.js');
                const uniqueIds = [...new Set(telUsers.map(u => u.telegramChatId || u.telegramId))];
                for (const chatId of uniqueIds) {
                    try { await tgModule.sendBotMessage(chatId, message); telegramCount++; } catch (e) { }
                }
            }
        }
        
        if (platform === 'all' || platform === 'bale') {
            const baleUsers = botUsers.filter(u => u.baleChatId || u.baleId);
            if (baleUsers.length > 0) {
                const baleModule = await import('./backend/bale.js');
                const uniqueIds = [...new Set(baleUsers.map(u => u.baleChatId || u.baleId))];
                for (const chatId of uniqueIds) {
                    try { await baleModule.sendBotMessage(chatId, message); baleCount++; } catch (e) { }
                }
            }
        }
        
        res.json({ success: true, count: telegramCount + baleCount });
    } catch (e) {
        console.error("Broadcast failed:", e);
        res.status(500).json({ error: 'Broadcast failed' });
    }
});

// 8. CHAT & COMMUNICATION
app.get('/api/chat', (req, res) => {
    res.json(getDb().messages || []);
});

app.get('/api/tickets', (req, res) => {
    res.json(getDb().tickets || []);
});

app.post('/api/tickets/:id/reply', async (req, res) => {
    const db = getDb();
    const ticketId = req.params.id;
    const { text, senderName } = req.body;
    
    db.tickets = db.tickets || [];
    const ticket = db.tickets.find(t => t.id === ticketId);
    if (!ticket) return res.status(404).json({ error: "Ticket not found" });

    const newMsg = {
        id: "msg_" + Math.random().toString(36).substr(2, 9),
        sender: 'admin',
        senderName: senderName || 'پشتیبانی',
        text: text,
        timestamp: new Date().toISOString()
    };
    ticket.messages.push(newMsg);
    ticket.updatedAt = Date.now();
    ticket.status = 'OPEN';
    saveDb(db);

    // Send to customer
    try {
        const replyMarkup = { inline_keyboard: [[{ text: '➕ ارسال پاسخ', callback_data: `GUEST_TICKET_REPLY_${ticket.id}` }]] };
        if (ticket.platform === 'telegram') {
            const tg = await safeImport('./backend/telegram.js');
            if (tg?.sendBotMessage) await tg.sendBotMessage(ticket.chatId, `📩 *پاسخ پشتیبانی به درخواست #${ticket.id}:*\n\n${text}`, { reply_markup: replyMarkup });
        } else if (ticket.platform === 'bale') {
            const bale = await safeImport('./backend/bale.js');
            if (bale?.sendBotMessage) await bale.sendBotMessage(ticket.chatId, `📩 *پاسخ پشتیبانی به درخواست #${ticket.id}:*\n\n${text}`, { reply_markup: replyMarkup });
        }
    } catch (e) { console.error("Ticket reply err:", e); }

    res.json(ticket);
});

app.put('/api/tickets/:id/status', (req, res) => {
    const db = getDb();
    const ticket = (db.tickets || []).find(t => t.id === req.params.id);
    if (!ticket) return res.status(404).json({ error: "Ticket not found" });
    ticket.status = req.body.status;
    ticket.updatedAt = Date.now();
    saveDb(db);
    res.json(ticket);
});

app.delete('/api/tickets/:id', (req, res) => {
    const db = getDb();
    db.tickets = (db.tickets || []).filter(t => t.id !== req.params.id);
    saveDb(db);
    res.json({ success: true });
});

app.post('/api/chat', async (req, res) => { 
    const db = getDb(); 
    const msg = req.body;
    if(!db.messages) db.messages=[]; 

    // Instantly append and resave database
    db.messages.push(msg); 
    saveDb(db); 
    
    // Instantly respond to client to maximize UI speed and responsiveness
    res.json(db.messages); 

    // Synchronize with external bots asynchronously in the background so it never blocks the user
    if (msg.recipient) {
        (async () => {
            const targetUser = db.users?.find(u => u.username === msg.recipient || u.fullName === msg.recipient);
            if (targetUser) {
                try {
                    let botRes = null;
                    let mutated = false;
                    if (targetUser.telegramChatId && db.settings?.telegramBotToken) {
                        const tg = await safeImport('./backend/telegram.js');
                        if (tg && tg.sendBotMessage) {
                            botRes = await tg.sendBotMessage(targetUser.telegramChatId, msg.message || '📎 فایل');
                            msg.botPlatform = 'telegram';
                            msg.botChatId = targetUser.telegramChatId;
                            msg.botMessageId = botRes?.message_id;
                            mutated = true;
                        }
                    } else if (targetUser.baleChatId && db.settings?.baleBotToken) {
                        const bale = await safeImport('./backend/bale.js');
                        if (bale && bale.sendBotMessage) {
                            botRes = await bale.sendBotMessage(targetUser.baleChatId, msg.message || '📎 فایل');
                            msg.botPlatform = 'bale';
                            msg.botChatId = targetUser.baleChatId;
                            msg.botMessageId = botRes?.result?.message_id;
                            mutated = true;
                        }
                    }
                    if (mutated) {
                        saveDb(db);
                    }
                } catch (e) {
                    console.error("Async Bot Sync Error:", e);
                }
            }
        })().catch(console.error);
    }

    // Broadcast notifications asynchronously in the background
    try {
        if (msg.recipient) {
            broadcastNotification(
                `پیام از ${msg.sender}`,
                `${msg.sender} پیام داد: ${msg.message || (msg.audioUrl ? '🎤 پیام صوتی' : '📎 فایل')}`,
                `/chat?pv=${msg.senderUsername}`,
                null,
                [msg.recipient],
                [msg.senderUsername] // Exclude sender
            );
        } else if (msg.groupId) {
            const group = db.groups?.find(g => g.id === msg.groupId);
            if (group) {
                broadcastNotification(
                    `${group.name}`,
                    `${msg.sender}: ${msg.message || (msg.audioUrl ? '🎤 پیام صوتی' : '📎 فایل')}`,
                    `/chat?group=${msg.groupId}`,
                    null,
                    group.members.filter(m => m !== msg.senderUsername),
                    [msg.senderUsername] // Exclude sender
                );
            }
        } else {
            // Public channel
            broadcastNotification(
                `گروه عمومی`,
                `${msg.sender}: ${msg.message || (msg.audioUrl ? '🎤 پیام صوتی' : '📎 فایل')}`,
                '/chat',
                null,
                null,
                [msg.senderUsername] // Exclude sender
            );
        }
    } catch (e) {
        console.error("Async broadcast notification error:", e);
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
app.delete('/api/chat/:id', async (req, res) => { 
    const db = getDb(); 
    const id = req.params.id;
    const msgToDelete = (db.messages || []).find(m => m.id === id);

    if (msgToDelete) {
        const forEveryone = req.query.forEveryone === 'true';

        // Two-way deletion from Bots
        if (forEveryone && msgToDelete.botMessageId && msgToDelete.botChatId && msgToDelete.botPlatform) {
            try {
                if (msgToDelete.botPlatform === 'telegram') {
                    const tg = await safeImport('./backend/telegram.js');
                    if (tg && tg.deleteBotMessage) await tg.deleteBotMessage(msgToDelete.botChatId, msgToDelete.botMessageId);
                } else if (msgToDelete.botPlatform === 'bale') {
                    const bale = await safeImport('./backend/bale.js');
                    if (bale && bale.deleteBotMessage) await bale.deleteBotMessage(msgToDelete.botChatId, msgToDelete.botMessageId);
                }
            } catch (e) { console.error("Bot Remove Error:", e); }
        }

        // Collect file URLs to potentially delete
        const fileUrls = [];
        if (msgToDelete.attachment?.url) fileUrls.push(msgToDelete.attachment.url);
        if (msgToDelete.audioUrl) fileUrls.push(msgToDelete.audioUrl);

        // Delete from database
        db.messages = db.messages.filter(m => m.id !== id); 
        saveDb(db); 

        // Physical file deletion logic
        fileUrls.forEach(url => {
            // Only try to delete local uploads
            if (url.startsWith('/uploads/')) {
                // Check if any other message still references this file
                const stillInUse = db.messages.some(m => 
                    m.attachment?.url === url || m.audioUrl === url
                );

                if (!stillInUse) {
                    const fileName = url.replace('/uploads/', '');
                    const filePath = path.join(UPLOADS_DIR, fileName);
                    if (fs.existsSync(filePath)) {
                        try {
                            fs.unlinkSync(filePath);
                            console.log(`Deleted file: ${fileName}`);
                        } catch (err) {
                            console.error(`Error deleting file ${fileName}:`, err);
                        }
                    }
                }
            }
        });
    }

    res.json(db.messages || []); 
});

app.get('/api/groups', (req, res) => res.json(getDb().groups || []));
app.post('/api/groups', (req, res) => { const db = getDb(); if(!db.groups) db.groups=[]; db.groups.push(req.body); saveDb(db); res.json(db.groups); });
app.put('/api/groups/:id', (req, res) => { const db = getDb(); const idx = db.groups.findIndex(g => g.id === req.params.id); if(idx > -1) { db.groups[idx] = { ...db.groups[idx], ...req.body }; saveDb(db); res.json(db.groups); } else res.status(404).send('Not Found'); });
app.delete('/api/groups/:id', (req, res) => { const db = getDb(); db.groups = db.groups.filter(g => g.id !== req.params.id); saveDb(db); res.json(db.groups); });

app.get('/api/task-groups', (req, res) => res.json(getDb().taskGroups || []));
app.post('/api/task-groups', (req, res) => { const db = getDb(); if(!db.taskGroups) db.taskGroups=[]; db.taskGroups.push(req.body); saveDb(db); res.json(db.taskGroups); });
app.put('/api/task-groups/:id', (req, res) => { const db = getDb(); const idx = db.taskGroups.findIndex(g => g.id === req.params.id); if(idx > -1) { db.taskGroups[idx] = { ...db.taskGroups[idx], ...req.body }; saveDb(db); res.json(db.taskGroups); } else res.status(404).send('Not Found'); });
app.delete('/api/task-groups/:id', (req, res) => { const db = getDb(); db.taskGroups = db.taskGroups.filter(g => g.id !== req.params.id); saveDb(db); res.json(db.taskGroups); });

app.get('/api/tasks', (req, res) => res.json(getDb().tasks || []));
app.post('/api/tasks', (req, res) => { const db = getDb(); if(!db.tasks) db.tasks=[]; db.tasks.push(req.body); saveDb(db); res.json(db.tasks); });
app.put('/api/tasks/:id', (req, res) => { const db = getDb(); const idx = db.tasks.findIndex(t => t.id === req.params.id); if(idx > -1) { db.tasks[idx] = { ...db.tasks[idx], ...req.body }; saveDb(db); res.json(db.tasks); } else res.status(404).send('Not Found'); });
app.delete('/api/tasks/:id', (req, res) => { const db = getDb(); db.tasks = db.tasks.filter(t => t.id !== req.params.id); saveDb(db); res.json(db.tasks); });

app.get('/api/announcements', (req, res) => res.json(getDb().announcements || []));
app.post('/api/announcements', (req, res) => { const db = getDb(); if(!db.announcements) db.announcements=[]; db.announcements.push(req.body); saveDb(db); res.json(db.announcements); });
app.delete('/api/announcements/:id', (req, res) => { const db = getDb(); db.announcements = db.announcements.filter(a => a.id !== req.params.id); saveDb(db); res.json(db.announcements); });

// 9. FILE UPLOAD
app.post('/api/upload', (req, res) => {
    const { fileName, fileData } = req.body;
    if (!fileName || !fileData) return res.status(400).send('Missing data');
    // Fix Regex to handle complex MIME types (e.g. audio/webm;codecs=opus)
    const base64Data = fileData.replace(/^data:.*;base64,/, '');
    const uniqueName = `${Date.now()}_${fileName}`;
    const filePath = path.join(UPLOADS_DIR, uniqueName);
    fs.writeFile(filePath, base64Data, 'base64', (err) => {
        if (err) return res.status(500).send('Upload failed');
        res.json({ fileName, url: `/uploads/${uniqueName}` });
    });
});

const chunkTempDir = path.join(ROOT_DIR, 'chunk-temp');
if (!fs.existsSync(chunkTempDir)) fs.mkdirSync(chunkTempDir, { recursive: true });

app.post('/api/upload-chunk', (req, res) => {
    const { uploadId, chunkIndex, chunkData } = req.body;
    if (!uploadId || chunkIndex === undefined || !chunkData) return res.status(400).send('Missing chunk data');
    const base64Data = chunkData.replace(/^data:.*;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const filePath = path.join(chunkTempDir, `${uploadId}_${chunkIndex}`);
    fs.writeFileSync(filePath, buffer);
    res.json({ success: true });
});

app.post('/api/upload-finish', async (req, res) => {
    const { uploadId, fileName, totalChunks } = req.body;
    if (!uploadId || !fileName || !totalChunks) return res.status(400).send('Missing finish data');
    const uniqueName = `${Date.now()}_${fileName}`;
    const finalPath = path.join(UPLOADS_DIR, uniqueName);
    const writeStream = fs.createWriteStream(finalPath);
    
    // Append all chunks sequentially, using async/await to avoid blocking event loop
    try {
        // Verify all chunks exist first
        for(let i = 0; i < totalChunks; i++) {
            const chunkPath = path.join(chunkTempDir, `${uploadId}_${i}`);
            if(!fs.existsSync(chunkPath)) {
                console.error(`Missing chunk ${i} for upload ${uploadId}`);
                return res.status(400).send(`Chunk ${i} missing. Please try again.`);
            }
        }

        for(let i = 0; i < totalChunks; i++) {
            const chunkPath = path.join(chunkTempDir, `${uploadId}_${i}`);
            await new Promise((resolve, reject) => {
                const readStream = fs.createReadStream(chunkPath);
                readStream.pipe(writeStream, { end: false });
                readStream.on('end', () => {
                    try { fs.unlinkSync(chunkPath); } catch(e) {}
                    resolve();
                });
                readStream.on('error', reject);
            });
        }
        writeStream.end();
        
        writeStream.on('finish', () => {
            res.json({ fileName, url: `/uploads/${uniqueName}` });
        });
        writeStream.on('error', (err) => {
            res.status(500).send('Finalize failed');
        });
    } catch (err) {
        console.error('Error combining chunks:', err);
        res.status(500).send('Server Error');
    }
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
    const { platform, chatId, caption, mediaData } = req.body;
    try {
        if (platform === 'telegram') {
            const tg = await safeImport('./backend/telegram.js');
            if (tg && tg.sendBotPhoto && mediaData) {
                const buffer = Buffer.from(mediaData.data, 'base64');
                await tg.sendBotPhoto(chatId, buffer, caption, { filename: mediaData.filename || 'image.png' });
            } else if (tg && tg.sendBotMessage) {
                await tg.sendBotMessage(chatId, caption);
            }
        } else if (platform === 'bale') {
            const bale = await safeImport('./backend/bale.js');
            if (bale && bale.sendBotPhoto && mediaData) {
                const buffer = Buffer.from(mediaData.data, 'base64');
                await bale.sendBotPhoto(chatId, buffer, caption, { filename: mediaData.filename || 'image.png' });
            } else if (bale && bale.sendBotMessage) {
                await bale.sendBotMessage(chatId, caption);
            }
        }
        res.json({ success: true });
    } catch (e) {
        console.error("Bot Send Error:", e);
        res.status(500).json({ error: e.message });
    }
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
                const parsed = JSON.parse(dbContent);
                dbManager.saveDbImmediate(parsed); 
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
            
            dbManager.saveDbImmediate(parsed);
            
            res.json({ success: true, mode: 'json' });
        }
    } catch (e) {
        console.error("Restore failed:", e);
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/api/version', (req, res) => { res.json({ version: '1.3.1' }); });

app.get('/manifest.json', (req, res) => {
    const db = getDb();
    const settings = db.settings || {};
    const iconUrl = settings.pwaIcon || "https://cdn-icons-png.flaticon.com/512/3135/3135706.png";
    const appName = settings.appName || "سامانه مالی و بازرگانی";
    
    const manifest = {
        name: appName,
        short_name: settings.appName || "سامانه مالی",
        description: "سیستم جامع مدیریت پرداخت ها و مجوزهای خروج کالا",
        id: "/",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#f8fafc",
        theme_color: "#2563eb",
        orientation: "portrait",
        lang: "fa",
        dir: "rtl",
        categories: ["finance", "business", "productivity"],
        icons: [
            {
                src: iconUrl,
                sizes: "192x192",
                type: "image/png",
                purpose: "any"
            },
            {
                src: iconUrl,
                sizes: "192x192",
                type: "image/png",
                purpose: "maskable"
            },
            {
                src: iconUrl,
                sizes: "512x512",
                type: "image/png",
                purpose: "any"
            },
            {
                src: iconUrl,
                sizes: "512x512",
                type: "image/png",
                purpose: "maskable"
            }
        ],
        screenshots: [
            {
                src: iconUrl,
                sizes: "512x512",
                type: "image/png",
                form_factor: "wide",
                label: appName
            },
            {
                src: iconUrl,
                sizes: "512x512",
                type: "image/png",
                form_factor: "narrow",
                label: appName
            }
        ],
        prefer_related_applications: false,
        share_target: {
            action: "/api/share-target",
            method: "POST",
            enctype: "multipart/form-data",
            params: {
                title: "title",
                text: "text",
                url: "url",
                files: [
                    {
                        name: "files",
                        accept: [
                            "image/*",
                            "video/*",
                            "audio/*",
                            "application/*",
                            "text/*"
                        ]
                    }
                ]
            }
        }
    };
    res.setHeader('Content-Type', 'application/manifest+json');
    res.send(JSON.stringify(manifest));
});

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
