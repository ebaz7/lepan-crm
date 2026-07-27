const axios = require('axios');
async function run() {
    const sql = `
        SELECT * FROM STR_TBL_010 WHERE Field_006 = '460' AND Field_009 = '12'
    `;
    try {
        const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
            query: sql
        }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
        console.log("Header for 460:", JSON.stringify(res.data.data, null, 2));
    } catch(e) {
        console.error("Error:", e.message);
    }
}
run();
