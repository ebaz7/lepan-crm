const axios = require('axios');
async function run() {
    try {
        const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
            query: `SELECT ROUTINE_NAME FROM INFORMATION_SCHEMA.ROUTINES WHERE ROUTINE_TYPE = 'PROCEDURE'`
        }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
        console.log("SPs:", res.data.data.map(d => d.ROUTINE_NAME).filter(n => n.includes('ACT') || n.includes('Rep') || n.includes('Report')));
    } catch(e) {}
}
run();
