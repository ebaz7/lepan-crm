const axios = require('axios');
async function attemptQuery(query) {
    const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', { query }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
    return res.data.data;
}
async function run() {
    try {
        const invs = await attemptQuery("SELECT TOP 50 Field_001, Field_004 FROM STR_TBL_010 ORDER BY Field_008 DESC");
        const invIds = invs.map(i => i.Field_001);
        const invIdsStr = invIds.map(id => `'${id}'`).join(',');
        
        const details = await attemptQuery(`SELECT Field_001, Field_004, Field_005 FROM STR_TBL_011 WHERE Field_004 IN (${invIdsStr})`);
        
        console.log("Invoices:", invIds.length);
        console.log("Details found:", details.length);
    } catch(e) {
        console.error(e.response ? e.response.data : e.message);
    }
}
run();
