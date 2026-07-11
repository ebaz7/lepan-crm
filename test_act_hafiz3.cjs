const axios = require('axios');
async function run() {
    try {
        const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
            query: `SELECT TOP 5 Field_001, Field_004, Field_003, Field_011, Field_015 FROM ACT_TBL_009 WHERE Field_011 LIKE N'%حافظ دریا%'`
        }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
        console.log("Hafiz ACT_TBL_009 rows:", res.data.data);
    } catch(e) {}
}
run();
