const axios = require('axios');

async function attemptQuery(query, fallbackTableName = '') {
    const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', { query }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
    return res.data.data;
}

async function run() {
    try {
        let filters = "AND t1.Field_004 IN ('4','29') ";
        // Test sales query
        const salesQuery = `
            SELECT 
                t1.Field_001 as InvCode,
                t1.Field_008 as Date,
                t1.Field_010 as Tafsili,
                t1.Field_004 as DocType,
                t1.Field_026 as TotalPrice,
                t2.Field_002 as ProductCode,
                t2.Field_005 as Qty,
                t2.Field_006 as UnitPrice,
                t2.Field_007 as TotalRowPrice
            FROM STR_TBL_010 t1
            INNER JOIN STR_TBL_011 t2 ON t1.Field_001 = t2.Field_001
            WHERE t1.Field_026 > 0 ${filters}
            ORDER BY t1.Field_001 DESC
        `;
        const data = await attemptQuery(salesQuery);
        console.log(`Returned ${data.length} rows`);
        if(data.length > 0) console.log("Sample:", data[0]);
    } catch(e) {
        console.error(e.response ? e.response.data : e.message);
    }
}
run();
