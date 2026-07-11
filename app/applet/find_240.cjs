const axios = require('axios');
async function run() {
    try {
        const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
            query: `SELECT * FROM ACT_TBL_009 WHERE Field_009 = 240000000 OR Field_010 = 240000000`
        }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
        console.log("ACT_TBL_009 240,000,000 rows:", res.data.data);
    } catch(e) {
        console.log(e.message);
    }
}
run();
