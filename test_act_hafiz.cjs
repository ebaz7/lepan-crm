const axios = require('axios');
async function run() {
    try {
        const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
            query: `SELECT TOP 50 Field_014, Field_011, Field_009, Field_010, Field_015, Field_018, Field_003, Field_005 FROM ACT_TBL_009 WHERE Field_011 LIKE N'%حافظ دریا%' OR Field_018 LIKE N'%حافظ دریا%' ORDER BY Field_014 DESC`
        }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
        console.log("Hafiz transactions:", res.data.data.map(d => ({
            Date: d.Field_014,
            Desc: d.Field_011,
            Debit: d.Field_009,
            Credit: d.Field_010,
            Type: d.Field_003,
            Status: d.Field_005,
            Details: d.Field_018
        })));
    } catch(e) {}
}
run();
