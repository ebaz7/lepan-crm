const axios = require('axios');
async function run() {
    try {
        const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
            query: `SELECT * FROM ACT_TBL_008 WHERE Field_005 = '10312' OR Field_006 = '10312'`
        }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
        console.log("10312 matches:", res.data.data);
    } catch(e) {}
}
run();
