const axios = require('axios');
async function run() {
    const sql = `
        SELECT TOP 30 Field_001, Field_006, Field_008, Field_029
        FROM STR_TBL_010
        WHERE Field_029 LIKE N'%رسم%'
        ORDER BY Field_008 DESC
    `;
    try {
        const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
            query: sql
        }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
        console.log("Found:", res.data.data.length);
        if (res.data.data.length > 0) {
            res.data.data.forEach((row, i) => {
                console.log(`Row ${i}: InvoiceNum=${row.Field_006}, Date=${row.Field_008}, Notes=${row.Field_029}`);
            });
        }
    } catch(e) {
        console.error("Error:", e.message);
    }
}
run();
