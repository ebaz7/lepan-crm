const axios = require('axios');
async function run() {
    const sql = `
        SELECT * FROM STR_TBL_011 
        WHERE Field_004 = '460' AND Field_003 = '4' AND Field_036 = '12'
    `;
    try {
        const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
            query: sql
        }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
        console.log("STR_TBL_011 rows:", JSON.stringify(res.data.data, null, 2));
    } catch(e) {
        console.error("Error:", e.message);
    }
}
run();
