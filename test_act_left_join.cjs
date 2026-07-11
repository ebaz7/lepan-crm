const axios = require('axios');
async function run() {
    try {
        const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
            query: `SELECT TOP 5 t2.Field_001, t2.Field_003, t2.Field_004, t1.Field_001 as Hdr_001 FROM ACT_TBL_009 t2 LEFT JOIN ACT_TBL_008 t1 ON t2.Field_004 = t1.Field_001 WHERE t2.Field_011 LIKE N'%حافظ دریا%'`
        }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
        console.log("Left Join:", res.data.data);
    } catch(e) {}
}
run();
