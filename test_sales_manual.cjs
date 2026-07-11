const axios = require('axios');
async function run() {
    try {
        const q1 = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
            query: `SELECT TOP 20 Field_001, Field_008 FROM STR_TBL_010 ORDER BY Field_008 DESC`
        }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
        
        const q2 = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
            query: `SELECT TOP 5000 Field_001, Field_004, Field_005, Field_006 FROM STR_TBL_011 ORDER BY Field_001 DESC`
        }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
        
        const invs = q1.data.data;
        const details = q2.data.data;
        
        console.log("Recent Invoices:", invs.map(i => i.Field_001).join(", "));
        console.log("Recent Details Invoice IDs:", [...new Set(details.slice(0, 50).map(d => d.Field_004))].join(", "));
    } catch(e) {
        console.error(e.response ? e.response.data : e.message);
    }
}
run();
