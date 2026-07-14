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

        console.log("=================== PATH 1: t10.Field_001 = t11.Field_004 (Global ID) ===================");
        const matches1 = await querySayan(`
            SELECT TOP 3 t10.Field_001 as t10_001, t11.Field_004 as t11_004, t10.Field_008 as Date, t10.Field_009 as TypeId
            FROM STR_TBL_010 t10
            INNER JOIN STR_TBL_011 t11 ON t10.Field_001 = t11.Field_004
            WHERE t10.Field_009 = '12'
        `);
        console.log("Sample matches (Path 1):", matches1);

        console.log("=================== PATH 2: t10.Field_007 = t11.Field_004 (Doc Number) ===================");
        const matches2 = await querySayan(`
            SELECT TOP 3 t10.Field_001 as t10_001, t10.Field_007 as t10_007, t11.Field_004 as t11_004, t10.Field_008 as Date, t10.Field_009 as TypeId
            FROM STR_TBL_010 t10
            INNER JOIN STR_TBL_011 t11 ON t10.Field_007 = t11.Field_004
            WHERE t10.Field_009 = '12'
        `);
        console.log("Sample matches (Path 2):", matches2);

    } catch (e) {
        console.error("Execution error:", e);
    }
}

run();
