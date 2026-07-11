const axios = require('axios');
async function run() {
    try {
        const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
            query: `
                SELECT TOP 10 
                    t1.Field_008 as Date, 
                    t2.Field_011 as Description, 
                    t2.Field_009 as Debit, 
                    t2.Field_010 as Credit, 
                    t2.Field_015 as Codes,
                    t1.Field_004 as SanadNumber
                FROM ACT_TBL_008 t1 
                INNER JOIN ACT_TBL_009 t2 ON t1.Field_001 = t2.Field_004 
                WHERE t2.Field_011 LIKE N'%حافظ دریا%' OR t2.Field_018 LIKE N'%حافظ دریا%'
                ORDER BY t1.Field_008 DESC
            `
        }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
        console.log("Hafiz with Date:", res.data.data);
    } catch(e) {
        console.log(e.response ? e.response.data : e.message);
    }
}
run();
