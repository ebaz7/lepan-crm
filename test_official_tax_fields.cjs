const axios = require('axios');
async function run() {
    // Let's query recent STR_TBL_010 and STR_TBL_011 where Notes or Customer indicates official, or any invoice that might have a tax amount
    const sql = `
        SELECT TOP 30
            t10.Field_001 as DocId,
            t10.Field_006 as InvoiceNum,
            t10.Field_008 as Date,
            t10.Field_029 as Notes,
            t07.Field_006 as CustomerName,
            t11.Field_005 as ItemCode,
            t11.Field_006 as Quantity,
            t11.Field_007 as Amount,
            t11.Field_008,
            t11.Field_009,
            t11.Field_010,
            t11.Field_011,
            t11.Field_012,
            t11.Field_013,
            t11.Field_014,
            t11.Field_015,
            t11.Field_016,
            t11.Field_017,
            t11.Field_018,
            t11.Field_019,
            t11.Field_020,
            t11.Field_024,
            t11.Field_025,
            t11.Field_027,
            t11.Field_028,
            t11.Field_029,
            t11.Field_030,
            t11.Field_031 as ItemNotes,
            t11.Field_032,
            t11.Field_033,
            t11.Field_034,
            t11.Field_035,
            t11.Field_036,
            t11.Field_037,
            t11.Field_038
        FROM STR_TBL_010 t10
        INNER JOIN STR_TBL_011 t11 ON t11.Field_004 = t10.Field_006 
                                  AND t11.Field_003 = t10.Field_004
                                  AND t11.Field_036 = t10.Field_009
        LEFT JOIN ACT_TBL_007 t07 ON t10.Field_010 = t07.Field_005 AND (t07.Field_004 = '11' OR t07.Field_004 = '31')
        WHERE t10.Field_009 IN ('3', '12', '23')
          AND t11.Field_007 IS NOT NULL AND t11.Field_007 > 0
          AND (t10.Field_029 LIKE '%رسمی%' OR t07.Field_006 LIKE '%رایکا%' OR t10.Field_029 LIKE '%ارزش افزوده%')
        ORDER BY t10.Field_008 DESC
    `;
    try {
        const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
            query: sql
        }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
        console.log("Found official rows:", res.data.data.length);
        if (res.data.data.length > 0) {
            res.data.data.forEach((row, i) => {
                console.log(`\n--- Official Row ${i} ---`);
                console.log(`InvoiceNum: ${row.InvoiceNum}, Date: ${row.Date}, Notes: ${row.Notes}, Customer: ${row.CustomerName}`);
                console.log(`Qty: ${row.Quantity}, Amount (Field_007): ${row.Amount}, ItemNotes: ${row.ItemNotes}`);
                
                // Let's check which fields are non-null and print them
                const nonNullFields = {};
                for (const key in row) {
                    if (row[key] !== null && row[key] !== undefined && row[key] !== '') {
                        nonNullFields[key] = row[key];
                    }
                }
                console.log("Non-null fields:", nonNullFields);
            });
        }
    } catch(e) {
        console.error("Error:", e.message);
    }
}
run();
