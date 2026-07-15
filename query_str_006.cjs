const axios = require('axios');
async function run() {
    try {
        const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
            query: `SELECT Field_001, Field_004, Field_011 FROM STR_TBL_006`
        }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
        console.log("Doc Types:");
        res.data.data.forEach(r => console.log(r.Field_001, r.Field_004, r.Field_011));
    } catch(e) { console.error(e.response ? e.response.data : e.message); }
}
run();
