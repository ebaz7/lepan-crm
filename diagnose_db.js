
import fs from 'fs';
import path from 'path';

/**
 * STANDALONE DIAGNOSTIC SCRIPT
 * Run this using: node diagnose_db.js
 * Purpose: Identify root cause of module failures after DB restore.
 */

const DB_FILE = './database.json';
const LOG_FILE = './root_cause_analysis.log';

const logger = {
    messages: [],
    log(msg, type = 'INFO') {
        const timestamp = new Date().toISOString();
        const formatted = `[${timestamp}] [${type}] ${msg}`;
        console.log(formatted);
        this.messages.push(formatted);
    },
    error(msg) { this.log(msg, 'ERROR'); },
    warn(msg) { this.log(msg, 'WARN'); },
    success(msg) { this.log(msg, 'SUCCESS'); },
    save() {
        fs.writeFileSync(LOG_FILE, this.messages.join('\n'));
        console.log(`\nDetailed log saved to: ${path.resolve(LOG_FILE)}`);
    }
};

const EXPECTED_COLLECTIONS = [
    'settings', 'orders', 'exitPermits', 'warehouseItems', 
    'warehouseTransactions', 'users', 'messages', 'groups', 
    'tasks', 'tradeRecords', 'securityLogs', 'personnelDelays', 
    'securityIncidents'
];

async function runDiagnosis() {
    logger.log('Starting System Diagnosis...');

    // 1. Check File Access
    if (!fs.existsSync(DB_FILE)) {
        logger.error(`Critical Failure: ${DB_FILE} not found in current directory.`);
        return;
    }

    // 2. Parse Test
    let data;
    try {
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        data = JSON.parse(raw);
        logger.success('JSON Parse: OK');
    } catch (e) {
        logger.error(`JSON Parse Failed: ${e.message}. The database file is likely corrupted.`);
        return;
    }

    // 3. Root Level Audit
    logger.log('--- Root Level Audit ---');
    EXPECTED_COLLECTIONS.forEach(key => {
        if (data[key] === undefined) {
            logger.error(`Missing Key: "${key}" is missing from the database root.`);
        } else if (key !== 'settings' && !Array.isArray(data[key])) {
            logger.error(`Invalid Type: "${key}" should be an Array, but is currently ${typeof data[key]}. Modules using this will CRASH.`);
        } else {
            const count = key === 'settings' ? 'Object' : data[key].length;
            logger.log(`Verified: "${key}" (${count} entries)`);
        }
    });

    // 4. Warehouse Module Depth Check
    logger.log('--- Warehouse Integrity Check ---');
    const items = data.warehouseItems || [];
    const transactions = data.warehouseTransactions || [];
    const itemMap = new Map(items.map(i => [i.id, i.name]));

    if (transactions.length > 0) {
        let orphans = 0;
        transactions.forEach(tx => {
            if (!Array.isArray(tx.items)) {
                logger.error(`Warehouse: Transaction #${tx.number} has corrupted "items" field (not an array).`);
                return;
            }
            tx.items.forEach(line => {
                if (!itemMap.has(line.itemId)) {
                    orphans++;
                    logger.warn(`Orphan Found: Transaction #${tx.number} references Item ID "${line.itemId}" which DOES NOT EXIST in this database.`);
                }
            });
        });
        if (orphans > 0) {
            logger.error(`Warehouse Failure: Found ${orphans} broken references. This usually prevents stock calculations and archive views.`);
        }
    }

    // 5. Commercial (Trade) Module Check
    logger.log('--- Commercial Module Integrity ---');
    const trade = data.tradeRecords || [];
    trade.forEach(record => {
        if (!record.stages || typeof record.stages !== 'object') {
            logger.error(`Trade Record Error: File "${record.fileNumber}" is missing the "stages" object. UI cannot render details.`);
        }
        if (!Array.isArray(record.items)) {
            logger.error(`Trade Record Error: File "${record.fileNumber}" has invalid "items" list.`);
        }
    });

    // 6. User and Session Check
    logger.log('--- User/Auth Integrity ---');
    const users = data.users || [];
    if (users.length === 0) {
        logger.warn('No users found. Admin login may be bypassed or broken.');
    }
    users.forEach(u => {
        if (!u.role) logger.warn(`User "${u.username}" has no role assigned.`);
    });

    // 7. Settings Consistency
    logger.log('--- Settings Validation ---');
    const s = data.settings || {};
    if (!s.companies || !Array.isArray(s.companies)) {
        logger.error('Settings: "companies" list is missing or invalid. This breaks Company selection globally.');
    }
    if (!s.rolePermissions || typeof s.rolePermissions !== 'object') {
        logger.warn('Settings: "rolePermissions" missing. Custom role buttons will not show up.');
    }

    // Summary logic
    const errors = logger.messages.filter(m => m.includes('[ERROR]')).length;
    const warns = logger.messages.filter(m => m.includes('[WARN]')).length;

    console.log('\n-----------------------------------------');
    if (errors > 0) {
        console.log(`DIAGNOSIS: CRITICAL ISSUES FOUND (${errors} errors, ${warns} warnings)`);
        console.log('ROOT CAUSE PROVEN: The restored database is structurally incompatible with the current code or has missing data references.');
    } else if (warns > 0) {
        console.log(`DIAGNOSIS: UNSTABLE (${warns} warnings)`);
    } else {
        console.log('DIAGNOSIS: No structural errors found in database.json.');
    }
    console.log('-----------------------------------------');

    logger.save();
}

runDiagnosis();
