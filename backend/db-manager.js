
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

                // Scan all DB collections to gather all real registered/used company names
                const dbCompanies = new Set();
                (MEMORY_DB_CACHE.settings.companies || []).forEach(c => { if (c && c.name && c.name.trim()) dbCompanies.add(c.name.trim()); });
                (MEMORY_DB_CACHE.settings.companyNames || []).forEach(n => { if (n && n.trim()) dbCompanies.add(n.trim()); });
                (MEMORY_DB_CACHE.orders || []).forEach(o => { if (o.payingCompany) dbCompanies.add(o.payingCompany.trim()); if (o.company) dbCompanies.add(o.company.trim()); });
                (MEMORY_DB_CACHE.exitPermits || []).forEach(p => { if (p.company) dbCompanies.add(p.company.trim()); });
                (MEMORY_DB_CACHE.warehouseTransactions || []).forEach(w => { if (w.company) dbCompanies.add(w.company.trim()); });
                (MEMORY_DB_CACHE.chequeReceipts || []).forEach(c => { if (c.company) dbCompanies.add(c.company.trim()); });
                (MEMORY_DB_CACHE.secretariatLetters || []).forEach(l => { if (l.company) dbCompanies.add(l.company.trim()); });
                (MEMORY_DB_CACHE.tradeRecords || []).forEach(t => { if (t.company) dbCompanies.add(t.company.trim()); });
                if (Array.isArray(MEMORY_DB_CACHE.settings.fiscalYears)) {
                    MEMORY_DB_CACHE.settings.fiscalYears.forEach(fy => {
                        if (fy && fy.companySequences) {
                            Object.keys(fy.companySequences).forEach(k => { if (k && k.trim()) dbCompanies.add(k.trim()); });
                        }
                    });
                }

                const companyMap = new Map();
                (MEMORY_DB_CACHE.settings.companies || []).forEach(c => {
                    if (c && c.name && c.name.trim()) {
                        companyMap.set(c.name.trim(), {
                            id: c.id || ('comp_' + Date.now()),
                            name: c.name.trim(),
                            showInWarehouse: c.showInWarehouse !== false,
                            banks: Array.isArray(c.banks) ? c.banks : [],
                            logo: c.logo || "",
                            registrationNumber: c.registrationNumber || "",
                            nationalId: c.nationalId || "",
                            address: c.address || "",
                            phone: c.phone || "",
                            fax: c.fax || "",
                            postalCode: c.postalCode || "",
                            economicCode: c.economicCode || "",
                            letterhead: c.letterhead || "",
                            ...c
                        });
                    }
                });

                Array.from(dbCompanies).forEach((name, idx) => {
                    if (name && !companyMap.has(name)) {
                        companyMap.set(name, {
                            id: 'comp_' + idx + '_' + Date.now(),
                            name,
                            showInWarehouse: true,
                            banks: []
                        });
                    }
                });

                let allCompanies = Array.from(companyMap.values());
                const hasCustomCompanies = allCompanies.some(c => c.name !== 'شرکت اصلی');
                if (hasCustomCompanies) {
                    allCompanies = allCompanies.filter(c => 
                        c.name !== 'شرکت اصلی' || 
                        c.logo || 
                        c.registrationNumber || 
                        c.nationalId || 
                        c.address || 
                        c.economicCode || 
                        (c.banks && c.banks.length > 0)
                    );
                }

                if (allCompanies.length === 0) {
                    allCompanies = [{ id: 'comp_default', name: 'شرکت اصلی', showInWarehouse: true, banks: [] }];
                }

                MEMORY_DB_CACHE.settings.companies = allCompanies;
                MEMORY_DB_CACHE.settings.companyNames = allCompanies.map(c => c.name);
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
