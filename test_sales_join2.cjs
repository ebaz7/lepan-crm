const axios = require('axios');
async function attemptQuery(query) {
    const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', { query }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
    return res.data.data;
}
async function run() {
    try {
        const data = await attemptQuery(`
            SELECT TOP 5 t1.Field_001 as InvID, t1.Field_008 as DateStr
            FROM STR_TBL_010 t1
            INNER JOIN STR_TBL_011 t2 ON t1.Field_001 = t2.Field_004
            ORDER BY t1.Field_008 DESC
        `);
        console.log("Joined data:", data);
    } catch(e) {
        console.error(e.response ? e.response.data : e.message);
    }
}
run();
