const axios = require('axios');
async function run() {
    try {
        const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
            query: `SELECT * FROM STR_TBL_010 WHERE Field_001 = '442' OR Field_010 = '442'`
        }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
        console.log("STR_TBL_010 for 442:", res.data.data.map(d => ({ ID: d.Field_001, Field_010: d.Field_010, Field_004: d.Field_004 })));
    } catch(e) {}
}
run();
