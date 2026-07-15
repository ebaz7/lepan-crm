const axios = require('axios');
async function run() {
    try {
        const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
            query: `SELECT Field_007, COUNT(*) as cnt FROM STR_TBL_029 GROUP BY Field_007`
        }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
        console.log("Types in STR_TBL_029:", res.data.data);
    } catch(e) {}
}
run();
