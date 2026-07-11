const axios = require('axios');
async function run() {
    try {
        const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
            query: `SELECT * FROM ACT_TBL_008 WHERE Field_001 IN ('7979', '10312', '2110', '4526', '4749')`
        }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
        console.log("Header records:", res.data.data);
    } catch(e) {}
}
run();
