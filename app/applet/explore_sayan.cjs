const fs = require('fs');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function run() {
    try {
        // Read Sayan settings from database.json
        const dbContent = fs.readFileSync('./database.json', 'utf8');
        const db = JSON.parse(dbContent);
        const settings = db.settings || {};
        const sayanApiUrl = settings.sayanApiUrl;
        const sayanApiKey = settings.sayanApiKey;

        if (!sayanApiUrl || !sayanApiKey) {
            console.error("Sayan settings not found in database.json");
            return;
        }

        const queryUrl = `${sayanApiUrl.replace(/\/$/, '')}/query`;
        console.log("Sayan Query URL:", queryUrl);

        async function querySayan(sql) {
            try {
                const res = await fetch(queryUrl, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${sayanApiKey}`,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({ query: sql })
                });
                if (!res.ok) {
                    const text = await res.text();
                    return { error: `HTTP ${res.status}: ${text}` };
                }
                const data = await res.json();
                return data.data || data;
            } catch (e) {
                return { error: e.message };
            }
        }

        console.log("=================== 1. DISCOVERING PRODUCTS AND GROUPS ===================");
        const prodCount1 = await querySayan("SELECT COUNT(*) as count FROM IND_TBL_022");
        console.log("IND_TBL_022 (Items) Count:", prodCount1);
        const prodSample1 = await querySayan("SELECT TOP 2 * FROM IND_TBL_022");
        console.log("IND_TBL_022 Sample:", prodSample1);

        const prodCount2 = await querySayan("SELECT COUNT(*) as count FROM STR_TBL_008");
        console.log("STR_TBL_008 (Items) Count:", prodCount2);
        const prodSample2 = await querySayan("SELECT TOP 2 * FROM STR_TBL_008");
        console.log("STR_TBL_008 Sample:", prodSample2);

        const groupCount1 = await querySayan("SELECT COUNT(*) as count FROM IND_TBL_002");
        console.log("IND_TBL_002 (Groups) Count:", groupCount1);
        const groupSample1 = await querySayan("SELECT TOP 2 * FROM IND_TBL_002");
        console.log("IND_TBL_002 Sample:", groupSample1);

        console.log("=================== 2. DISCOVERING DOCUMENT TYPES (STR_TBL_006) ===================");
        const docTypes = await querySayan("SELECT Field_001, Field_002, Field_003, Field_004 FROM STR_TBL_006");
        console.log("STR_TBL_006 (Document Types) Count:", Array.isArray(docTypes) ? docTypes.length : "Error");
        if (Array.isArray(docTypes)) {
            console.log("Document Types list:", docTypes.slice(0, 30));
        }

        console.log("=================== 3. DISCOVERING DISTINCT CODES IN STR_TBL_010 ===================");
        const distHeaderTypes = await querySayan("SELECT Field_004, Field_009, COUNT(*) as doc_count FROM STR_TBL_010 GROUP BY Field_004, Field_009 ORDER BY doc_count DESC");
        console.log("Distinct combinations of Field_004 and Field_009 in STR_TBL_010:");
        console.log(distHeaderTypes);

        console.log("=================== 4. SAMPLE ROW FROM STR_TBL_010 AND STR_TBL_011 ===================");
        const docHeader = await querySayan("SELECT TOP 1 * FROM STR_TBL_010");
        console.log("STR_TBL_010 Header Sample:", docHeader);
        const docDetail = await querySayan("SELECT TOP 1 * FROM STR_TBL_011");
        console.log("STR_TBL_011 Detail Sample:", docDetail);

    } catch (e) {
        console.error("Execution error:", e);
    }
}

run();
