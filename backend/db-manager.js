
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_FILE = path.join(__dirname, '..', 'database.json');

let MEMORY_DB_CACHE = null;
let saveTimeout = null;
let isSaving = false;

export const getDb = () => {
    if (MEMORY_DB_CACHE) return MEMORY_DB_CACHE;
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
            tasks: [],
            subscriptions: [],
            botSubscribers: [],
            fiscalYears: {},
            sequences: {},
            notes: []
        };

        if (fs.existsSync(DB_FILE)) {
            const fileContent = fs.readFileSync(DB_FILE, 'utf8');
            if (fileContent.trim()) {
                const data = JSON.parse(fileContent);
                MEMORY_DB_CACHE = { ...defaultDb, ...data };
                
                // Ensure arrays exist
                const arrays = ['users', 'botSubscribers', 'orders', 'exitPermits', 'warehouseTransactions', 'subscriptions', 'messages', 'groups', 'tasks', 'tradeRecords', 'notes'];
                arrays.forEach(arr => {
                    if (!Array.isArray(MEMORY_DB_CACHE[arr])) MEMORY_DB_CACHE[arr] = [];
                });
                
                return MEMORY_DB_CACHE;
            }
        }
        MEMORY_DB_CACHE = defaultDb;
        return defaultDb;
    } catch (e) {
        console.error("DB Read Error:", e);
        return {};
    }
};

export const saveDb = (data) => {
    MEMORY_DB_CACHE = data;
    
    // Throttle disk writes to every 3 seconds to avoid event loop blockage
    if (saveTimeout) return true;
    
    saveTimeout = setTimeout(() => {
        try {
            if (isSaving) return;
            isSaving = true;
            fs.writeFileSync(DB_FILE, JSON.stringify(MEMORY_DB_CACHE, null, 2));
            saveTimeout = null;
            isSaving = false;
        } catch (e) {
            console.error("DB Save Error:", e);
            saveTimeout = null;
            isSaving = false;
        }
    }, 3000);
    
    return true;
};

// Immediate save for critical operations (e.g. backup, restore)
export const saveDbImmediate = (data) => {
    try {
        MEMORY_DB_CACHE = data;
        if (saveTimeout) { clearTimeout(saveTimeout); saveTimeout = null; }
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
        return true;
    } catch (e) {
        console.error("Immediate DB Save Error:", e);
        return false;
    }
};

export const refreshCache = () => {
    MEMORY_DB_CACHE = null;
    return getDb();
};
