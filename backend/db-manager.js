
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_FILE = path.join(__dirname, '..', 'database.json');

let MEMORY_DB_CACHE = null;
let saveTimeout = null;
let isSaving = false;

// Helper to extract company & bank details from Sayan schema files, dump files, and internal DB
export function extractExternalCompanyDetails(dbState) {
    const map = new Map();

    function getComp(name) {
        if (!name || !name.trim()) return null;
        const clean = name.trim();
        if (clean.length < 2 || clean === 'd _' || clean === 'e' || clean === 'null' || clean === 'undefined' || clean === 'تامین کننده') return null;
        if (!map.has(clean)) {
            map.set(clean, {
                id: 'comp_ext_' + Math.random().toString(36).substring(2, 9),
                name: clean,
                registrationNumber: '',
                nationalId: '',
                address: '',
                phone: '',
                fax: '',
                postalCode: '',
                economicCode: '',
                banks: []
            });
        }
        return map.get(clean);
    }

    // 1. Scan schema files and sayan dumps on disk
    const schemaFiles = ['schema_output2.json', 'schema_output.json', 'sayan_db_dump.json'];
    schemaFiles.forEach(file => {
        const fullPath = path.join(__dirname, '..', file);
        if (!fs.existsSync(fullPath)) return;
        try {
            const schema = JSON.parse(fs.readFileSync(fullPath, 'utf8'));

            // TBL_008 (Insurance/Workshop Templates)
            if (Array.isArray(schema.TBL_008)) {
                schema.TBL_008.forEach(r => {
                    const raw = String(r[3] || r[4] || '');
                    if (raw.includes('&')) {
                        const parts = raw.split('&');
                        if (parts.length >= 5) {
                            const regNo = parts[1]?.trim();
                            const compName = parts[2]?.trim();
                            const addr = parts[4]?.trim();
                            if (compName) {
                                const comp = getComp(compName);
                                if (comp) {
                                    if (regNo && !comp.registrationNumber) comp.registrationNumber = regNo;
                                    if (addr && !comp.address) comp.address = addr;
                                }
                            }
                        }
                    }
                });
            }

            // GNR_TBL_001 (Entities / People / Companies / Customers)
            if (Array.isArray(schema.GNR_TBL_001) && schema.GNR_TBL_001.length > 1) {
                schema.GNR_TBL_001.slice(1).forEach(r => {
                    const firstName = String(r[4] || '').trim();
                    const lastName = String(r[5] || '').trim();
                    const fullName = (firstName + ' ' + lastName).trim() || lastName || firstName;
                    if (!fullName || fullName === 'تامین کننده') return;

                    const natId = String(r[7] || '').trim();
                    const phone = String(r[13] || r[14] || '').trim();
                    const addr = String(r[15] || '').trim();
                    const accNo = String(r[30] || '').trim();
                    const cardNo = String(r[31] || '').trim();
                    const sheba = String(r[32] || '').trim();

                    const comp = getComp(fullName);
                    if (comp) {
                        if (natId && natId !== '0' && !comp.nationalId) comp.nationalId = natId;
                        if (phone && !comp.phone) comp.phone = phone;
                        if (addr && !comp.address) comp.address = addr;

                        if (accNo || cardNo || sheba) {
                            const exists = comp.banks.some(b => (accNo && b.accountNumber === accNo) || (sheba && b.sheba === sheba));
                            if (!exists) {
                                comp.banks.push({
                                    id: 'bank_' + Math.random().toString(36).substring(2, 9),
                                    bankName: 'بانک',
                                    accountNumber: accNo,
                                    cardNumber: cardNo,
                                    sheba: sheba
                                });
                            }
                        }
                    }
                });
            }

            // ACT_TBL_007 (Accounts/Tafsili)
            if (Array.isArray(schema.ACT_TBL_007) && schema.ACT_TBL_007.length > 1) {
                schema.ACT_TBL_007.slice(1).forEach(r => {
                    const name = String(r[2] || r[1] || '').trim();
                    if (name && !name.startsWith('11') && !name.startsWith('31')) {
                        getComp(name);
                    }
                });
            }
        } catch (e) {
            console.error("Error parsing schema file:", file, e);
        }
    });

    // 2. Scan savedContacts in DB settings
    if (dbState && dbState.settings && Array.isArray(dbState.settings.savedContacts)) {
        dbState.settings.savedContacts.forEach(contact => {
            const compName = (contact.company || contact.name || '').trim();
            if (!compName) return;
            const comp = getComp(compName);
            if (comp) {
                if (contact.nationalId && !comp.nationalId) comp.nationalId = contact.nationalId;
                if (contact.registrationNumber && !comp.registrationNumber) comp.registrationNumber = contact.registrationNumber;
                if (contact.address && !comp.address) comp.address = contact.address;
                if ((contact.phone || contact.mobile) && !comp.phone) comp.phone = contact.phone || contact.mobile;
                if (contact.economicCode && !comp.economicCode) comp.economicCode = contact.economicCode;

                if (contact.accountNumber || contact.sheba || contact.cardNumber) {
                    const exists = comp.banks.some(b => (contact.accountNumber && b.accountNumber === contact.accountNumber) || (contact.sheba && b.sheba === contact.sheba));
                    if (!exists) {
                        comp.banks.push({
                            id: 'bank_' + Math.random().toString(36).substring(2, 9),
                            bankName: contact.bankName || 'بانک',
                            accountNumber: contact.accountNumber || '',
                            cardNumber: contact.cardNumber || '',
                            sheba: contact.sheba || ''
                        });
                    }
                }
            }
        });
    }

    return Array.from(map.values());
}

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
            } else {
                MEMORY_DB_CACHE = { ...defaultDb };
            }
        } else {
            MEMORY_DB_CACHE = { ...defaultDb };
        }

        // Ensure settings exists
        if (!MEMORY_DB_CACHE.settings) MEMORY_DB_CACHE.settings = {};
        if (!MEMORY_DB_CACHE.settings.sayanApiUrl) MEMORY_DB_CACHE.settings.sayanApiUrl = "";
        if (!MEMORY_DB_CACHE.settings.sayanApiKey) MEMORY_DB_CACHE.settings.sayanApiKey = "";

        // Ensure companies and companyNames exist
        if (!Array.isArray(MEMORY_DB_CACHE.settings.companies)) {
            MEMORY_DB_CACHE.settings.companies = [];
        }
        if (!Array.isArray(MEMORY_DB_CACHE.settings.companyNames)) {
            MEMORY_DB_CACHE.settings.companyNames = [];
        }

        // Gather all used company names across all collections
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

        // Build existing company map
        const companyMap = new Map();
        (MEMORY_DB_CACHE.settings.companies || []).forEach(c => {
            if (c && c.name && c.name.trim()) {
                const nameKey = c.name.trim();
                companyMap.set(nameKey, {
                    id: c.id || ('comp_' + Math.random().toString(36).substring(2, 9)),
                    name: nameKey,
                    showInWarehouse: c.showInWarehouse !== false,
                    banks: Array.isArray(c.banks) ? [...c.banks] : [],
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

        // Extract details from external files (Sayan dumps, schemas, contacts)
        const externalCompanies = extractExternalCompanyDetails(MEMORY_DB_CACHE);
        externalCompanies.forEach(ext => {
            if (!ext || !ext.name) return;
            dbCompanies.add(ext.name);

            if (companyMap.has(ext.name)) {
                // Enrich existing company with missing fields
                const existing = companyMap.get(ext.name);
                if (!existing.registrationNumber && ext.registrationNumber) existing.registrationNumber = ext.registrationNumber;
                if (!existing.nationalId && ext.nationalId) existing.nationalId = ext.nationalId;
                if (!existing.address && ext.address) existing.address = ext.address;
                if (!existing.phone && ext.phone) existing.phone = ext.phone;
                if (!existing.economicCode && ext.economicCode) existing.economicCode = ext.economicCode;

                // Merge bank accounts
                if (Array.isArray(ext.banks) && ext.banks.length > 0) {
                    if (!Array.isArray(existing.banks)) existing.banks = [];
                    ext.banks.forEach(eb => {
                        const hasBank = existing.banks.some(b => 
                            (eb.accountNumber && b.accountNumber === eb.accountNumber) ||
                            (eb.sheba && b.sheba === eb.sheba) ||
                            (eb.cardNumber && b.cardNumber === eb.cardNumber)
                        );
                        if (!hasBank) {
                            existing.banks.push(eb);
                        }
                    });
                }
            } else {
                companyMap.set(ext.name, {
                    id: ext.id || ('comp_' + Math.random().toString(36).substring(2, 9)),
                    name: ext.name,
                    showInWarehouse: true,
                    banks: Array.isArray(ext.banks) ? [...ext.banks] : [],
                    logo: "",
                    registrationNumber: ext.registrationNumber || "",
                    nationalId: ext.nationalId || "",
                    address: ext.address || "",
                    phone: ext.phone || "",
                    fax: "",
                    postalCode: "",
                    economicCode: ext.economicCode || "",
                    letterhead: ""
                });
            }
        });

        // Add any remaining companies discovered across collections
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
        
        // Ensure at least one admin user exists
        if (MEMORY_DB_CACHE.users.length === 0) {
            MEMORY_DB_CACHE.users.push({ id: '1', username: 'admin', password: '123', fullName: 'مدیر سیستم', role: 'admin', roles: ['admin'], canManageTrade: true });
        }

        // Immediately persist initial cache if database.json was absent or updated
        try {
            fs.writeFileSync(DB_FILE, JSON.stringify(MEMORY_DB_CACHE, null, 2));
        } catch (e) {
            console.error("Initial DB sync write error:", e);
        }
        
        return MEMORY_DB_CACHE;
    } catch (e) {
        console.error("DB Read Error:", e);
        return {};
    }
};

export const saveDb = (data) => {
    MEMORY_DB_CACHE = data;
    
    // Always perform synchronous save if saveTimeout isn't scheduled, otherwise clear and re-schedule
    if (saveTimeout) {
        clearTimeout(saveTimeout);
    }
    
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
    }, 1000);
    
    return true;
};

// Immediate save for critical operations (e.g. backup, restore, settings changes)
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

// Guarantee flush on process termination
process.on('exit', () => {
    if (MEMORY_DB_CACHE) {
        try {
            fs.writeFileSync(DB_FILE, JSON.stringify(MEMORY_DB_CACHE, null, 2));
        } catch (e) {
            console.error("On-Exit DB Save Error:", e);
        }
    }
});
process.on('SIGINT', () => {
    if (MEMORY_DB_CACHE) {
        try {
            fs.writeFileSync(DB_FILE, JSON.stringify(MEMORY_DB_CACHE, null, 2));
        } catch (e) {}
    }
    process.exit(0);
});
process.on('SIGTERM', () => {
    if (MEMORY_DB_CACHE) {
        try {
            fs.writeFileSync(DB_FILE, JSON.stringify(MEMORY_DB_CACHE, null, 2));
        } catch (e) {}
    }
    process.exit(0);
});

