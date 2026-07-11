const axios = require('axios');
async function run() {
    try {
        const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
            query: `SELECT TOP 5 t1.Field_001 as InvID, t2.Field_004 as LinkID, t2.Field_001 as RowID FROM STR_TBL_010 t1 INNER JOIN STR_TBL_011 t2 ON t1.Field_001 = t2.Field_004`
        }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
        console.log("Inner Join result:", res.data.data);
    } catch(e) {
        console.error(e.response ? e.response.data : e.message);
    }
}
run();
