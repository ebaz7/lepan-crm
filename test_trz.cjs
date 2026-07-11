const axios = require('axios');
async function run() {
    try {
        const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
            query: `SELECT * FROM TRZ_TBL_001 WHERE Field_001 = '7979'`
        }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
        console.log("Found 7979 in TRZ_TBL_001:", res.data.data);
    } catch(e) {}
}
run();
