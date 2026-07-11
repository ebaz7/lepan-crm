const axios = require('axios');
async function run() {
    try {
        const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
            query: `SELECT TOP 1 * FROM COM_TBL_011`
        }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
        console.log("COM_TBL_011:", res.data.data.length ? "Exists" : "Empty");
    } catch(e) {
        // ignore
    }
}
run();
