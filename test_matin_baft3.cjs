const axios = require('axios');
async function run() {
  const url = 'http://80.210.31.176:5000/api/external/v1/query';
  const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' };
  
  try {
    const q1 = `SELECT Field_009 as Debit, Field_010 as Credit, Field_015 as Codes, Field_011 as Description, Field_014 as Date
      FROM ACT_TBL_009 
      WHERE (Field_015 LIKE '%:112127-%' OR Field_015 LIKE '%-112127-%' OR Field_015 LIKE '%:112127' OR Field_015 LIKE '112127:%')
      `;
    const res1 = await axios.post(url, { query: q1 }, { headers });
    let totalDebit = 0;
    let totalCredit = 0;
    res1.data.data.forEach(r => {
        totalDebit += parseFloat(r.Debit) || 0;
        totalCredit += parseFloat(r.Credit) || 0;
    });
    console.log("Total Debit:", totalDebit, "Total Credit:", totalCredit, "Balance:", totalDebit - totalCredit);
  } catch(e) {
    console.error("Error:", e.response?.data || e.message);
  }
}
run();
