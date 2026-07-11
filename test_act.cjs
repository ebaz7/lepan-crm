const axios = require('axios');
async function run() {
    try {
        const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
            query: `SELECT DISTINCT Field_003 FROM ACT_TBL_009`
        }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
        console.log("ACT_TBL_009 Field_003:", res.data.data);
    } catch(e) {}
}
run();
