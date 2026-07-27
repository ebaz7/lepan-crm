const axios = require('axios');
async function run() {
    const sql = `
        SELECT TOP 30
            Field_001 as DocId,
            Field_006 as InvoiceNum,
            Field_029 as Notes,
            Field_026 as Subtotal,
            Field_037 as TaxedTotal,
            Field_040 as Payable
        FROM STR_TBL_010
        WHERE Field_009 IN ('3', '12', '23')
          AND Field_026 IS NOT NULL AND Field_026 > 0
        ORDER BY Field_008 DESC
    `;
    try {
        const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
            query: sql
        }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
        console.log("Invoices found:", res.data.data.length);
        res.data.data.forEach((row, i) => {
            const sub = parseFloat(row.Subtotal);
            const taxed = parseFloat(row.TaxedTotal || row.Payable);
            const ratio = sub > 0 ? (taxed / sub) : 1;
            console.log(`InvoiceNum=${row.InvoiceNum}, Subtotal=${sub}, TaxedTotal=${taxed}, Ratio=${ratio.toFixed(2)}, Notes=${row.Notes}`);
        });
    } catch(e) {
        console.error("Error:", e.message);
    }
}
run();
