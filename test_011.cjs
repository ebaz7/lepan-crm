const axios = require('axios');
async function run() {
    try {
        const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
            query: `SELECT TOP 5 Field_001, Field_003, Field_004, Field_005, Field_006, Field_007, Field_008, Field_009 FROM STR_TBL_011 WHERE Field_001 = '495796'`
        }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
        console.log("STR_TBL_011 items:", res.data.data);
    } catch(e) {
        console.error(e.response ? e.response.data : e.message);
    }
}
run();
