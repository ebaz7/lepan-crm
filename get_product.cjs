const axios = require('axios');
async function run() {
    try {
        const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
            query: `SELECT * FROM IND_TBL_021 WHERE Field_004 = '010301011001'`
        }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
        console.log("IND_TBL_021:", res.data.data);
        
        const res2 = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
            query: `SELECT * FROM IND_TBL_022 WHERE Field_005 = '010301011001'`
        }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
        console.log("IND_TBL_022:", res2.data.data);
    } catch(e) {}
}
run();
