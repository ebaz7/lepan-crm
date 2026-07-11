const axios = require('axios');
async function run() {
    try {
        const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
            query: `SELECT TOP 1 * FROM STR_TBL_011 ORDER BY CAST(Field_001 AS INT) DESC`
        }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
        console.log("Max details:", res.data.data);
    } catch(e) {}
}
run();
