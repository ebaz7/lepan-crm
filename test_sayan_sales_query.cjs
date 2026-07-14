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

        const categories = {
            'SALES': "12",          // فاکتور فروش
            'SALES_RETURN': "13",   // مرجوعی فروش
            'PURCHASE': "14",       // فاکتور خرید
            'PURCHASE_RETURN': "15" // مرجوعی خرید
        };

        for (const [name, code] of Object.entries(categories)) {
            console.log(`\n=================== TESTING CATEGORY: ${name} (Code: ${code}) ===================`);
            const sql = `
                SELECT TOP 5
                    t10.Field_001 as DocId,
                    t10.Field_008 as Date,
                    t10.Field_029 as Notes,
                    t10.Field_010 as PersonCode,
                    t11.Field_005 as ItemCode,
                    t22.Field_004 as ItemName,
                    t11.Field_006 as Quantity, -- Weight
                    t11.Field_012 as QuantitySecondary, -- Box/Count
                    t11.Field_031 as ItemNotes,
                    t11.Field_037 as Amount,
                    t02.Field_003 as GroupName
                FROM STR_TBL_010 t10
                INNER JOIN STR_TBL_011 t11 ON t10.Field_001 = t11.Field_004
                LEFT JOIN IND_TBL_022 t22 ON t11.Field_005 = t22.Field_005
                LEFT JOIN IND_TBL_021 t21 ON t11.Field_005 = t21.Field_004
                LEFT JOIN IND_TBL_002 t02 ON t21.Field_003 = t02.Field_003
                WHERE t10.Field_009 = '${code}'
                ORDER BY t10.Field_008 DESC
            `;
            const result = await querySayan(sql);
            console.log(`Results for ${name} (Count: ${Array.isArray(result) ? result.length : 'Error'}):`);
            if (Array.isArray(result) && result.length > 0) {
                console.log("Sample row:", result[0]);
            } else {
                console.log("No rows found or error:", result);
            }
        }

    } catch (e) {
        console.error("Execution error:", e);
    }
}

run();
