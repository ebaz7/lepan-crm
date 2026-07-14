const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function run() {
    try {
        const sayanApiUrl = "http://80.210.31.176:5000/api/external/v1";
        const sayanApiKey = "s_gate_live_vgr182bwtpoa";
        const queryUrl = `${sayanApiUrl.replace(/\/$/, '')}/query`;

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

        console.log("=================== 1. COLUMNS OF STR_TBL_006 ===================");
        const cols006 = await querySayan("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'STR_TBL_006'");
        console.log("STR_TBL_006 Columns:", cols006);

        console.log("=================== 2. STR_TBL_006 SAMPLE ===================");
        const sample006 = await querySayan("SELECT TOP 10 * FROM STR_TBL_006");
        console.log("STR_TBL_006 Sample:", sample006);

        console.log("=================== 3. IND_TBL_021 COLUMNS AND SAMPLE ===================");
        const cols021 = await querySayan("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'IND_TBL_021'");
        console.log("IND_TBL_021 Columns:", cols021);
        const sample021 = await querySayan("SELECT TOP 5 * FROM IND_TBL_021");
        console.log("IND_TBL_021 Sample:", sample021);

        console.log("=================== 4. WHAT ARE VALUES OF Field_009 IN STR_TBL_010? ===================");
        // Let's list some rows of STR_TBL_010 for Field_009 = '3' and Field_009 = '12' or '23' or '28'
        const sampleSales = await querySayan("SELECT TOP 2 * FROM STR_TBL_010 WHERE Field_009 = '3'");
        console.log("STR_TBL_010 Field_009 = 3 (Sales?) Sample:", sampleSales);

        const sampleReturn = await querySayan("SELECT TOP 2 * FROM STR_TBL_010 WHERE Field_009 = '12'");
        console.log("STR_TBL_010 Field_009 = 12 (Sales Return?) Sample:", sampleReturn);

    } catch (e) {
        console.error("Execution error:", e);
    }
}

run();
