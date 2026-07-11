const axios = require('axios');
async function run() {
    for (let i = 1; i <= 24; i++) {
        let tbl = 'ACT_TBL_' + String(i).padStart(3, '0');
        if (tbl === 'ACT_TBL_009') continue;
        try {
            const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
                query: `SELECT * FROM ${tbl} WHERE Field_001 = '7979'`
            }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
            if (res.data.data.length > 0) {
                console.log("Found 7979 in", tbl);
                break;
            }
        } catch(e) {}
    }
}
run();
