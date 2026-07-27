
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
            settings: {
                sayanApiUrl: "",
                sayanApiKey: ""
            }, 
            users: [
                { id: '1', username: 'admin', password: '123', fullName: 'مدیر سیستم', role: 'admin', roles: ['admin'], canManageTrade: true }
            ],
            orders: [], 
            exitPermits: [], 
            warehouseItems: [], 
            warehouseTransactions: [], 
            tradeRecords: [], 
            chequeReceipts: [],
            securityLogs: [], 
            personnelDelays: [], 
            securityIncidents: [],
            messages: [], 
            groups: [], 
            tasks: [],
            subscriptions: [],
            botSubscribers: [],
            customerBalances: [],
            customerChatCodes: [],
            fiscalYears: {},
            sequences: {},
            notes: []
        };

        if (fs.existsSync(DB_FILE)) {
            const fileContent = fs.readFileSync(DB_FILE, 'utf8');
            if (fileContent.trim()) {
                const data = JSON.parse(fileContent);
                MEMORY_DB_CACHE = { ...defaultDb, ...data };
                
                // Populate default Sayan credentials if missing
                if (!MEMORY_DB_CACHE.settings) MEMORY_DB_CACHE.settings = {};
                if (!MEMORY_DB_CACHE.settings.sayanApiUrl) {
                    MEMORY_DB_CACHE.settings.sayanApiUrl = "";
                }
                if (!MEMORY_DB_CACHE.settings.sayanApiKey) {
                    MEMORY_DB_CACHE.settings.sayanApiKey = "";
                }

                // Ensure companies and fiscalYears exist in settings
                if (!Array.isArray(MEMORY_DB_CACHE.settings.companies)) {
                    MEMORY_DB_CACHE.settings.companies = [];
                }
                if (!Array.isArray(MEMORY_DB_CACHE.settings.companyNames)) {
                    MEMORY_DB_CACHE.settings.companyNames = [];
                }

                // Sync custom names from companyNames to companies if missing
                if (MEMORY_DB_CACHE.settings.companyNames.length > 0) {
                    const existingNames = new Set(MEMORY_DB_CACHE.settings.companies.map(c => c && c.name));
                    MEMORY_DB_CACHE.settings.companyNames.forEach((name, idx) => {
                        if (name && !existingNames.has(name)) {
                            MEMORY_DB_CACHE.settings.companies.push({
                                id: 'comp_' + idx + '_' + Date.now(),
                                name,
                                showInWarehouse: true,
                                banks: []
                            });
                            existingNames.add(name);
                        }
                    });
                }

                // If companies has only default 'شرکت اصلی' but custom company names exist, remove the default placeholder
                const hasDefaultOnly = MEMORY_DB_CACHE.settings.companies.length === 1 && MEMORY_DB_CACHE.settings.companies[0].name === 'شرکت اصلی';
                const hasCustomNames = MEMORY_DB_CACHE.settings.companyNames.some(n => n && n !== 'شرکت اصلی');

                if (hasDefaultOnly && hasCustomNames) {
                    MEMORY_DB_CACHE.settings.companies = MEMORY_DB_CACHE.settings.companyNames
                        .filter(n => n && n !== 'شرکت اصلی')
                        .map((name, idx) => ({
                            id: 'comp_' + idx + '_' + Date.now(),
                            name,
                            showInWarehouse: true,
                            banks: []
                        }));
                }

                // If still empty, default to 'شرکت اصلی'
                if (MEMORY_DB_CACHE.settings.companies.length === 0) {
                    MEMORY_DB_CACHE.settings.companies = [
                        { id: 'comp_default', name: 'شرکت اصلی', showInWarehouse: true, banks: [] }
                    ];
                }

                // Keep companyNames synced
                MEMORY_DB_CACHE.settings.companyNames = MEMORY_DB_CACHE.settings.companies.map(c => c.name);
                if (!Array.isArray(MEMORY_DB_CACHE.settings.fiscalYears) || MEMORY_DB_CACHE.settings.fiscalYears.length === 0) {
                    MEMORY_DB_CACHE.settings.fiscalYears = [
                        { id: 'fy_1402', label: '1402', isClosed: false, companySequences: {}, createdAt: Date.now() },
                        { id: 'fy_1403', label: '1403', isClosed: false, companySequences: {}, createdAt: Date.now() },
                        { id: 'fy_1404', label: '1404', isClosed: false, companySequences: {}, createdAt: Date.now() },
                        { id: 'fy_1405', label: '1405', isClosed: false, companySequences: {}, createdAt: Date.now() }
                    ];
                }
                if (!MEMORY_DB_CACHE.settings.activeFiscalYearId) {
                    MEMORY_DB_CACHE.settings.activeFiscalYearId = 'fy_1404';
                }

                // Ensure arrays exist
                const arrays = ['users', 'botSubscribers', 'orders', 'exitPermits', 'warehouseTransactions', 'subscriptions', 'messages', 'groups', 'tasks', 'tradeRecords', 'notes', 'customerBalances', 'customerChatCodes', 'chequeReceipts'];
                arrays.forEach(arr => {
                    if (!Array.isArray(MEMORY_DB_CACHE[arr])) MEMORY_DB_CACHE[arr] = [];
                });
                
                // Ensure at least one admin user exists to prevent lockout
                if (MEMORY_DB_CACHE.users.length === 0) {
                    MEMORY_DB_CACHE.users.push({ id: '1', username: 'admin', password: '123', fullName: 'مدیر سیستم', role: 'admin', roles: ['admin'], canManageTrade: true });
                }
                
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
