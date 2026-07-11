const axios = require('axios');
async function run() {
    try {
        const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
            query: `SELECT TOP 5 Field_001, Field_003, Field_004 FROM COM_TBL_011 WHERE Field_004 = '495797'`
        }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
        console.log("COM_TBL_011 for 495797:", res.data.data);
    } catch(e) {}
}
run();
