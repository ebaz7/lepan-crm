
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_FILE = path.join(__dirname, '..', 'database.json');

let MEMORY_DB_CACHE = null;

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
            sequences: {}
        };

        if (fs.existsSync(DB_FILE)) {
            const fileContent = fs.readFileSync(DB_FILE, 'utf8');
            if (fileContent.trim()) {
                const data = JSON.parse(fileContent);
                MEMORY_DB_CACHE = { ...defaultDb, ...data };
                
                // Ensure arrays exist
                if (!Array.isArray(MEMORY_DB_CACHE.users)) MEMORY_DB_CACHE.users = [];
                if (!Array.isArray(MEMORY_DB_CACHE.botSubscribers)) MEMORY_DB_CACHE.botSubscribers = [];
                if (!Array.isArray(MEMORY_DB_CACHE.orders)) MEMORY_DB_CACHE.orders = [];
                if (!Array.isArray(MEMORY_DB_CACHE.exitPermits)) MEMORY_DB_CACHE.exitPermits = [];
                if (!Array.isArray(MEMORY_DB_CACHE.warehouseTransactions)) MEMORY_DB_CACHE.warehouseTransactions = [];
                if (!Array.isArray(MEMORY_DB_CACHE.subscriptions)) MEMORY_DB_CACHE.subscriptions = [];
                
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
    try {
        MEMORY_DB_CACHE = data;
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
        return true;
    } catch (e) {
        console.error("DB Save Error:", e);
        return false;
    }
};

export const refreshCache = () => {
    MEMORY_DB_CACHE = null;
    return getDb();
};
