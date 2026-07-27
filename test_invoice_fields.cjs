const axios = require('axios');
async function run() {
    const sql = `
        SELECT TOP 10 * FROM STR_TBL_011 WHERE Field_007 IS NOT NULL AND Field_007 > 0
    `;
    try {
        const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
            query: sql
        }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
        console.log("Non-null STR_TBL_011 rows:");
        console.log(JSON.stringify(res.data.data, null, 2));
    } catch(e) {
        console.error("Error:", e.message);
    }
}
run();
