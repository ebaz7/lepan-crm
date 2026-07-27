
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_FILE = path.join(__dirname, '..', 'database.json');

let MEMORY_DB_CACHE = null;
let saveTimeout = null;
let isSaving = false;

// Helper to generate a stable, deterministic ID for a company name
function getStableCompanyId(name, existingId) {
    if (existingId && typeof existingId === 'string' && existingId.trim() && !existingId.startsWith('comp_ext_')) {
        return existingId.trim();
    }
    const clean = (name || '').trim();
    if (!clean) return 'comp_default';
    let hash = 0;
    for (let i = 0; i < clean.length; i++) {
        hash = ((hash << 5) - hash) + clean.charCodeAt(i);
        hash |= 0;
    }
    return 'comp_' + Math.abs(hash).toString(36);
}

// Helper to extract company & bank details from Sayan schema files, dump files, and internal DB
function extractExternalCompanyDetails(dbState) {
    const map = new Map();

    function getComp(name) {
        if (!name || typeof name !== 'string') return null;
        const clean = name.trim();
        // Skip junk / generic / test names
        if (!clean || clean === 'تامین کننده' || clean === 'd _' || clean === 'e' || clean.length < 2) return null;

        if (!map.has(clean)) {
            map.set(clean, {
                id: getStableCompanyId(clean),
                name: clean,
                registrationNumber: '',
                nationalId: '',
                address: '',
                phone: '',
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
                    if (!Array.isArray(r)) return;
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
                    if (!Array.isArray(r)) return;
                    const name = String(r[2] || r[1] || '').trim();
                    if (name && !name.startsWith('11') && !name.startsWith('31') && name.length >= 3) {
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
                    id: getStableCompanyId(nameKey, c.id),
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
            if (ext.name === 'شرکت اصلی' || ext.name === 'تامین کننده' || ext.name === 'd _' || ext.name === 'e' || ext.name.length < 2) return;
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
                    id: ext.id || getStableCompanyId(ext.name),
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
        Array.from(dbCompanies).forEach((name) => {
            if (name && name.trim() && name !== 'شرکت اصلی' && name !== 'تامین کننده' && name !== 'd _' && name !== 'e' && name.trim().length >= 2) {
                const clean = name.trim();
                if (!companyMap.has(clean)) {
                    companyMap.set(clean, {
                        id: getStableCompanyId(clean),
                        name: clean,
                        showInWarehouse: true,
                        banks: []
                    });
                }
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

function sanitizeAndMergeCompanies(existingCompanies = [], newCompanies = []) {
    const map = new Map();

    (existingCompanies || []).forEach(c => {
        if (c && c.name && c.name.trim()) {
            const key = c.name.trim();
            map.set(key, { ...c, name: key });
        }
    });

    (newCompanies || []).forEach(nc => {
        if (!nc || !nc.name || !nc.name.trim()) return;
        const key = nc.name.trim();
        if (key === 'd _' || key === 'e' || key === 'تامین کننده') return;

        if (map.has(key)) {
            const ex = map.get(key);
            map.set(key, {
                ...ex,
                id: nc.id || ex.id || getStableCompanyId(key),
                name: key,
                showInWarehouse: nc.showInWarehouse !== undefined ? nc.showInWarehouse : (ex.showInWarehouse !== false),
                logo: nc.logo || ex.logo || "",
                registrationNumber: nc.registrationNumber || ex.registrationNumber || "",
                nationalId: nc.nationalId || ex.nationalId || "",
                address: nc.address || ex.address || "",
                phone: nc.phone || ex.phone || "",
                fax: nc.fax || ex.fax || "",
                postalCode: nc.postalCode || ex.postalCode || "",
                economicCode: nc.economicCode || ex.economicCode || "",
                letterhead: nc.letterhead || ex.letterhead || "",
                banks: (Array.isArray(nc.banks) && nc.banks.length > 0) ? nc.banks : (ex.banks || [])
            });
        } else {
            map.set(key, {
                id: nc.id || getStableCompanyId(key),
                name: key,
                showInWarehouse: nc.showInWarehouse !== false,
                banks: Array.isArray(nc.banks) ? nc.banks : [],
                logo: nc.logo || "",
                registrationNumber: nc.registrationNumber || "",
                nationalId: nc.nationalId || "",
                address: nc.address || "",
                phone: nc.phone || "",
                fax: nc.fax || "",
                postalCode: nc.postalCode || "",
                economicCode: nc.economicCode || "",
                letterhead: nc.letterhead || ""
            });
        }
    });

    return Array.from(map.values());
}

export const saveDb = (data) => {
    if (data && data.settings && Array.isArray(data.settings.companies)) {
        const merged = sanitizeAndMergeCompanies(MEMORY_DB_CACHE?.settings?.companies, data.settings.companies);
        data.settings.companies = merged;
        data.settings.companyNames = merged.map(c => c.name);
    }
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
        if (data && data.settings && Array.isArray(data.settings.companies)) {
            const merged = sanitizeAndMergeCompanies(MEMORY_DB_CACHE?.settings?.companies, data.settings.companies);
            data.settings.companies = merged;
            data.settings.companyNames = merged.map(c => c.name);
        }
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

