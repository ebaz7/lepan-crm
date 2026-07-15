const axios = require('axios');
async function run() {
    const tables = ['COM_TBL_011', 'ACT_TBL_008', 'ACT_TBL_009', 'STR_TBL_011'];
    for(let t of tables) {
        try {
            const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
                query: `SELECT * FROM ${t} WHERE Field_004 = '415182' OR Field_001 = '415182' OR Field_003 = '415182' OR Field_005 = '415182'`
            }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
            if(res.data.data && res.data.data.length > 0) {
                console.log(t, res.data.data.slice(0, 1));
            }
        } catch(e) {}
    }
}
run();
