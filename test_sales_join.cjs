const axios = require('axios');
async function run() {
    try {
        const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
            query: `SELECT Field_001, Field_004 FROM STR_TBL_010 WHERE Field_001 = '34564'`
        }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
        console.log("Invoice 34564 DocType:", res.data.data);
    } catch(e) {}
}
run();
