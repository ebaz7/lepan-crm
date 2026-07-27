const axios = require('axios');
async function run() {
    // Let's query STR_TBL_011 for InvoiceNum = '469', '464', '460'
    const sql = `
        SELECT 
            t10.Field_001 as DocId,
            t10.Field_006 as InvoiceNum,
            t10.Field_029 as Notes,
            t11.Field_001 as ItemDocId,
            t11.Field_005 as ItemCode,
            t11.Field_006 as Quantity,
            t11.Field_007 as Amount,
            t11.Field_008 as Field08,
            t11.Field_009 as Field09,
            t11.Field_010 as Field10,
            t11.Field_011 as Field11,
            t11.Field_012 as Field12,
            t11.Field_013 as Field13,
            t11.Field_014 as Field14,
            t11.Field_015 as Field15,
            t11.Field_016 as Field16,
            t11.Field_017 as Field17,
            t11.Field_018 as Field18,
            t11.Field_019 as Field19,
            t11.Field_020 as Field20,
            t11.Field_024 as Field24,
            t11.Field_025 as Field25,
            t11.Field_027 as Field27,
            t11.Field_028 as Field28,
            t11.Field_029 as Field29,
            t11.Field_030 as Field30,
            t11.Field_031 as ItemNotes,
            t11.Field_032 as Field32,
            t11.Field_033 as Field33,
            t11.Field_034 as Field34,
            t11.Field_035 as Field35,
            t11.Field_036 as Field36,
            t11.Field_037 as Field37,
            t11.Field_038 as Field38
        FROM STR_TBL_010 t10
        INNER JOIN STR_TBL_011 t11 ON t11.Field_004 = t10.Field_006 
                                  AND t11.Field_003 = t10.Field_004
                                  AND t11.Field_036 = t10.Field_009
        WHERE t10.Field_006 IN ('469', '464', '460')
          AND t10.Field_009 = '12'
    `;
    try {
        const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
            query: sql
        }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
        console.log("Count:", res.data.data.length);
        if (res.data.data.length > 0) {
            res.data.data.forEach((row, i) => {
                console.log(`\n--- Official Item ${i} (Invoice ${row.InvoiceNum}) ---`);
                console.log(`Notes: ${row.Notes}`);
                console.log(`Qty: ${row.Quantity}, Amount (Field07): ${row.Amount}, ItemNotes: ${row.ItemNotes}`);
                
                // Print all non-null fields
                const nonNull = {};
                for (const key in row) {
                    if (row[key] !== null && row[key] !== undefined && row[key] !== '') {
                        nonNull[key] = row[key];
                    }
                }
                console.log("Non-null fields:", nonNull);
            });
        }
    } catch(e) {
        console.error("Error:", e.message);
    }
}
run();
