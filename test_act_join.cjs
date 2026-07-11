const axios = require('axios');
async function run() {
    try {
        const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
            query: `SELECT TOP 2 t1.Field_008, t2.Field_011 FROM ACT_TBL_008 t1 INNER JOIN ACT_TBL_009 t2 ON t1.Field_001 = t2.Field_004`
        }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
        console.log("Join result:", res.data.data);
    } catch(e) {
        console.log(e.message);
    }
}
run();
