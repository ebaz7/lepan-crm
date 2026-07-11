const axios = require('axios');
async function run() {
    try {
        const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
            query: `SELECT TOP 1 STR_TBL_010.Field_001 as DocID, STR_TBL_010.Field_004 as DocType, STR_TBL_011.Field_001 as ItemID FROM STR_TBL_010 INNER JOIN STR_TBL_011 ON STR_TBL_010.Field_001 = STR_TBL_011.Field_004 WHERE STR_TBL_010.Field_004 = '3'`
        }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
        console.log("ACT_TBL_008:", res.data.data);
    } catch(e) {
        console.error(e.response ? e.response.data : e.message);
    }
}
run();
