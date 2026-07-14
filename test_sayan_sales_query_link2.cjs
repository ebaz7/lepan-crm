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

        console.log("=================== SAMPLE JOINED SALES DOCS ===================");
        const sampleDocs = await querySayan(`
            SELECT TOP 5
                t10.Field_001 as DocId,
                t10.Field_008 as Date,
                t10.Field_009 as TypeId,
                t11.Field_005 as ItemCode,
                t11.Field_006 as QuantityWeight
            FROM STR_TBL_010 t10
            INNER JOIN STR_TBL_011 t11 ON t10.Field_001 = t11.Field_004
            WHERE t10.Field_009 = '12'
            ORDER BY t10.Field_008 DESC
        `);
        console.log("Joined sales docs:", sampleDocs);

    } catch (e) {
        console.error("Execution error:", e);
    }
}

run();
