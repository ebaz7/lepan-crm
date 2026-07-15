const axios = require('axios');
async function run() {
    try {
        const comTables = ['COM_TBL_001', 'COM_TBL_003', 'COM_TBL_008', 'COM_TBL_009', 'COM_TBL_010', 'COM_TBL_011', 'COM_TBL_014', 'COM_TBL_019', 'COM_TBL_032'];
        for (const tbl of comTables) {
            const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
                query: `SELECT TOP 2 * FROM ${tbl}`
            }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
            console.log(`--- ${tbl} ---`);
            if(res.data.data && res.data.data.length > 0) {
                console.log(res.data.data[0]);
            } else {
                console.log("No data");
            }
        }
    } catch(e) { console.error(e.response ? e.response.data : e.message); }
}
run();
