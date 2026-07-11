const axios = require('axios');
async function run() {
    try {
        const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
            query: `SELECT TOP 1 * FROM STR_TBL_011`
        }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
        console.log("STR_TBL_011 columns:", Object.keys(res.data.data[0]));
    } catch(e) {
        console.error(e.response ? e.response.data : e.message);
    }
}
run();
