const axios = require('axios');
async function run() {
    try {
        const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
            query: `
            SELECT TOP 5 t1.Field_001, t1.Field_008
            FROM STR_TBL_010 t1
            INNER JOIN STR_TBL_011 t2 ON t1.Field_001 = t2.Field_004
            ORDER BY t1.Field_008 DESC
            `
        }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
        console.log("Latest date with details:", res.data.data);
    } catch(e) {}
}
run();
