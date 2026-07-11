const axios = require('axios');
async function run() {
    try {
        const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
            query: `SELECT * FROM ACT_TBL_008 WHERE Field_005 = '10065' OR Field_001 = '10065'`
        }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
        console.log("ACT_TBL_008 rows:", res.data.data);
    } catch(e) {
        console.log(e.message);
    }
}
run();
