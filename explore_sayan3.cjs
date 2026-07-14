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

        console.log("=================== DOCUMENT TYPES IN STR_TBL_010 ===================");
        const docCounts = await querySayan(`
            SELECT 
                t10.Field_009 as TypeCode,
                t06.Field_004 as TypeName,
                COUNT(*) as DocCount
            FROM STR_TBL_010 t10
            LEFT JOIN STR_TBL_006 t06 ON t10.Field_009 = t06.Field_003
            GROUP BY t10.Field_009, t06.Field_004
            ORDER BY DocCount DESC
        `);
        console.log("Sayan Document Types with Count:", docCounts);

    } catch (e) {
        console.error("Execution error:", e);
    }
}

run();
