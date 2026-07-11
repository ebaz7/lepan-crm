const axios = require('axios');
async function run() {
    try {
        const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
            query: `SELECT TOP 5 Field_001, Field_003, Field_012, Field_009, Field_008 FROM STR_TBL_010 ORDER BY Field_008 DESC`
        }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
        console.log("STR_TBL_010:", res.data.data);
    } catch(e) {
        console.error("ERROR:", e.response ? e.response.data : e.message);
    }
}
run();
