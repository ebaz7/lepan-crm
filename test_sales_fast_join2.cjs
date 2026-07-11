const axios = require('axios');
async function run() {
    try {
        const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
            query: `
            SELECT t1.Field_001 as InvID, t2.Field_004 as LinkID
            FROM (SELECT TOP 100 Field_001, Field_008 FROM STR_TBL_010 ORDER BY Field_008 DESC) t1
            INNER JOIN COM_TBL_011 t2 ON t1.Field_001 = t2.Field_004
            `
        }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
        console.log("Fast join COM_TBL_011 result:", res.data.data.length);
    } catch(e) {}
}
run();
