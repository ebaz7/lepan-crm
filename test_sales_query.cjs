const axios = require('axios');
async function run() {
    const sql = `
        SELECT *
        FROM STR_TBL_011
        WHERE Field_004 = '496359'
    `;
    try {
        const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
            query: sql
        }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
        console.log("Rows for 496359:", res.data.data);
    } catch(e) {
        console.error(e);
    }
}
run();
