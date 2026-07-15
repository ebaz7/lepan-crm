const axios = require('axios');
async function run() {
    try {
        const sqlA = `
            SELECT TOP 5
                t10.Field_001 as DocId,
                t10.Field_008 as Date,
                t10.Field_029 as Notes,
                t11.Field_005 as ItemCode,
                t22.Field_004 as ItemName,
                t11.Field_006 as Quantity,
                t11.Field_031 as ItemNotes,
                t11.Field_037 as Amount,
                t02.Field_003 as GroupName
            FROM STR_TBL_010 t10
            INNER JOIN STR_TBL_011 t11 ON t10.Field_001 = t11.Field_004
            LEFT JOIN IND_TBL_022 t22 ON t11.Field_005 = t22.Field_005
            LEFT JOIN IND_TBL_021 t21 ON t11.Field_005 = t21.Field_004
            LEFT JOIN IND_TBL_002 t02 ON t21.Field_003 = t02.Field_003
            WHERE t10.Field_009 IN ('3', '12', '23', '68')
        `;
        const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
            query: sqlA
        }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
        console.log("Result:", res.data.data);
    } catch(e) { console.error(e.response ? e.response.data : e.message); }
}
run();
