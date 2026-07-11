const axios = require('axios');
async function run() {
    try {
        const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
            query: `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE COLUMN_NAME = 'Field_001'`
        }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
        
        const tables = res.data.data.map(d => d.TABLE_NAME);
        for (let tbl of tables) {
            if (tbl.includes('ACT_TBL_009')) continue;
            try {
                const checkRes = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
                    query: `SELECT * FROM ${tbl} WHERE Field_001 = '7979'`
                }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
                if (checkRes.data.data.length > 0) {
                    console.log("Found 7979 in", tbl);
                }
            } catch(e) {}
        }
        console.log("Done");
    } catch(e) {}
}
run();
