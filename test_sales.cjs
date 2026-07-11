const axios = require('axios');
async function run() {
    try {
        const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
            query: `SELECT TOP 10 Field_001, Field_004, Field_008, Field_010, Field_011, Field_026, Field_027 FROM STR_TBL_010 ORDER BY Field_008 DESC`
        }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
        console.log("STR_TBL_010 (Invoices):", res.data.data);
    } catch(e) {
        console.error(e.response ? e.response.data : e.message);
    }
}
run();
