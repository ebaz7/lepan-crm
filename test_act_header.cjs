const axios = require('axios');
async function run() {
    try {
        const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
            query: `SELECT TOP 2 * FROM ACT_TBL_008`
        }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
        console.log("ACT_TBL_008 cols:", Object.keys(res.data.data[0]));
        console.log("Sample:", res.data.data[0]);
    } catch(e) {}
}
run();
