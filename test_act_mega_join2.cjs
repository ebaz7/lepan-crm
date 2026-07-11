const axios = require('axios');
async function run() {
    try {
        const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
            query: `
                SELECT
                    t2.Field_011 as Description, 
                    t2.Field_009 as Debit, 
                    t2.Field_010 as Credit, 
                    COALESCE(t1a.Field_008, t1b.Field_008) as Date,
                    t2.Field_005 as Status
                FROM ACT_TBL_009 t2
                LEFT JOIN ACT_TBL_008 t1a ON t2.Field_003 = '4' AND t2.Field_004 = t1a.Field_001
                LEFT JOIN ACT_TBL_008 t1b ON (t2.Field_003 = '2' OR t2.Field_003 = '3') AND t2.Field_004 = t1b.Field_005 AND t2.Field_003 = t1b.Field_004
                WHERE t2.Field_015 LIKE N'%112447%' OR t2.Field_018 LIKE N'%112447%'
            `
        }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
        console.log("Mega Join 112447:", res.data.data);
    } catch(e) {
        console.log(e.response ? e.response.data : e.message);
    }
}
run();
