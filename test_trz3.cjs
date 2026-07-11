const axios = require('axios');
async function run() {
    for (let i = 1; i <= 10; i++) {
        let tbl = 'TRZ_TBL_' + String(i).padStart(3, '0');
        try {
            const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
                query: `SELECT * FROM ${tbl} WHERE Field_001 = '7979'`
            }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
            if (res.data.data.length > 0) {
                console.log("Found in", tbl, res.data.data);
            }
        } catch(e) {}
    }
}
run();
