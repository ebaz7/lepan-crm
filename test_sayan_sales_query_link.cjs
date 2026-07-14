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

        console.log("=================== COUNT MATCHES FOR t10.Field_001 = t11.Field_004 ===================");
        const count1 = await querySayan(`
            SELECT COUNT(*) as cnt 
            FROM STR_TBL_010 t10
            INNER JOIN STR_TBL_011 t11 ON t10.Field_001 = t11.Field_004
        `);
        console.log("Matches count (t10.Field_001 = t11.Field_004):", count1);

        console.log("=================== COUNT MATCHES FOR t10.Field_001 = t11.Field_010? ===================");
        const count2 = await querySayan(`
            SELECT COUNT(*) as cnt 
            FROM STR_TBL_010 t10
            INNER JOIN STR_TBL_011 t11 ON t10.Field_001 = t11.Field_001
        `);
        console.log("Matches count (t10.Field_001 = t11.Field_001):", count2);

    } catch (e) {
        console.error("Execution error:", e);
    }
}

run();
