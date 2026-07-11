const axios = require('axios');
async function run() {
    try {
        const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
            query: `SELECT TOP 10 Field_001, Field_005, Field_006, Field_011, Field_012 FROM ACT_TBL_008`
        }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
        console.log("ACT_TBL_008:", res.data.data);
    } catch(e) {
        console.error(e.response ? e.response.data : e.message);
    }
}
run();
