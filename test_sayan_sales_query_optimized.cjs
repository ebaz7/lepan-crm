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

        console.log("=================== TESTING OPTIMIZED JOIN WITH DATE FILTER ===================");
        const sql = `
            SELECT TOP 10
                t10.Field_001 as DocId,
                t10.Field_008 as Date,
                t10.Field_009 as TypeId,
                t10.Field_010 as PersonCode,
                t11.Field_005 as ItemCode,
                t22.Field_004 as ItemName,
                t11.Field_006 as Quantity,
                t11.Field_016 as TotalPrice
            FROM STR_TBL_010 t10
            INNER JOIN STR_TBL_011 t11 ON t10.Field_001 = t11.Field_004
            LEFT JOIN IND_TBL_022 t22 ON t11.Field_005 = t22.Field_005
            WHERE t10.Field_009 = '12'
              AND t10.Field_008 >= '2024-04-15T00:00:00.000Z'
              AND t10.Field_008 <= '2024-04-20T23:59:59.000Z'
            ORDER BY t10.Field_008 DESC
        `;
        const result = await querySayan(sql);
        console.log("Query Results:", result);

    } catch (e) {
        console.error("Execution error:", e);
    }
}

run();
