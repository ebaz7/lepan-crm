const axios = require('axios');
async function run() {
    try {
        const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
            query: `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS`
        }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
        console.log("Views:", res.data.data.map(d => d.TABLE_NAME));
    } catch(e) {}
}
run();
