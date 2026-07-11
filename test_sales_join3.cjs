const axios = require('axios');
async function attemptQuery(query) {
    const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', { query }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
    return res.data.data;
}
async function run() {
    try {
        const invs = await attemptQuery("SELECT TOP 500 Field_001 FROM STR_TBL_010 ORDER BY Field_008 DESC");
        const invIds = invs.map(i => i.Field_001);
        
        let batch = invIds.slice(100, 200).map(id => `'${id}'`).join(',');
        let details = await attemptQuery(`SELECT TOP 1 Field_004 FROM STR_TBL_011 WHERE Field_004 IN (${batch})`);
        console.log("Details found for 100-200:", details.length ? details[0] : "None");
        
        batch = invIds.slice(200, 300).map(id => `'${id}'`).join(',');
        details = await attemptQuery(`SELECT TOP 1 Field_004 FROM STR_TBL_011 WHERE Field_004 IN (${batch})`);
        console.log("Details found for 200-300:", details.length ? details[0] : "None");
        
    } catch(e) {
        console.error(e.response ? e.response.data : e.message);
    }
}
run();
