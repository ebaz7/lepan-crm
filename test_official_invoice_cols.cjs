const axios = require('axios');
async function run() {
    const sql = `
        SELECT TOP 20
            t10.Field_001 as DocId,
            t10.Field_006 as InvoiceNum,
            t10.Field_008 as Date,
            t10.Field_009 as DocType,
            t10.Field_029 as Notes,
            t11.Field_001 as ItemDocId,
            t11.Field_005 as ItemCode,
            t11.Field_006 as Quantity,
            t11.Field_007 as ItemField07,
            t11.Field_008 as ItemField08,
            t11.Field_009 as ItemField09,
            t11.Field_010 as ItemField10,
            t11.Field_011 as ItemField11,
            t11.Field_012 as ItemField12,
            t11.Field_013 as ItemField13,
            t11.Field_014 as ItemField14,
            t11.Field_015 as ItemField15,
            t11.Field_016 as ItemField16,
            t11.Field_017 as ItemField17,
            t11.Field_018 as ItemField18,
            t11.Field_019 as ItemField19,
            t11.Field_020 as ItemField20,
            t11.Field_024 as ItemField24,
            t11.Field_025 as ItemField25,
            t11.Field_027 as ItemField27,
            t11.Field_028 as ItemField28,
            t11.Field_029 as ItemField29,
            t11.Field_030 as ItemField30,
            t11.Field_031 as ItemNotes,
            t11.Field_032 as ItemField32,
            t11.Field_033 as ItemField33,
            t11.Field_034 as ItemField34,
            t11.Field_035 as ItemField35,
            t11.Field_036 as ItemField36,
            t11.Field_037 as ItemField37,
            t11.Field_038 as ItemField38,
            t07.Field_006 as CustomerName
        FROM STR_TBL_010 t10
        INNER JOIN STR_TBL_011 t11 ON t11.Field_004 = t10.Field_006 
                                  AND t11.Field_003 = t10.Field_004
                                  AND t11.Field_036 = t10.Field_009
        LEFT JOIN ACT_TBL_007 t07 ON t10.Field_010 = t07.Field_005 AND (t07.Field_004 = '11' OR t07.Field_004 = '31')
        WHERE t10.Field_009 IN ('3', '12', '23')
        ORDER BY t10.Field_008 DESC
    `;
    try {
        const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
            query: sql
        }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
        console.log("Found rows:", res.data.data.length);
        if (res.data.data.length > 0) {
            // Let's filter some rows that might be official or have non-zero item values
            res.data.data.forEach((row, i) => {
                console.log(`Row ${i}: InvoiceNum=${row.InvoiceNum}, Date=${row.Date}, Notes=${row.Notes}, Customer=${row.CustomerName}`);
                console.log(`  Qty=${row.Quantity}, Field07=${row.ItemField07}, Field11=${row.ItemField11}, Field37=${row.ItemField37}, ItemNotes=${row.ItemNotes}`);
            });
        }
    } catch(e) {
        console.error("Error:", e.message);
    }
}
run();
