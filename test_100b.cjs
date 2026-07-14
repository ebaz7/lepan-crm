const axios = require('axios');
async function run() {
  const url = 'http://80.210.31.176:5000/api/external/v1/query';
  const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' };
  
  try {
    const q1 = `SELECT Field_001, Field_013 as Date, Field_009 as Debit, Field_010 as Credit, Field_011 as Description, Field_012, Field_005, Field_006, Field_007, Field_016, Field_017, Field_018, Field_019, Field_003, Field_004
      FROM ACT_TBL_009 
      WHERE Field_015 LIKE '%:112127-%' OR Field_015 LIKE '%-112127-%' OR Field_015 LIKE '%:112127' OR Field_015 LIKE '112127:%'
      ORDER BY Field_013 ASC
      `;
    const res1 = await axios.post(url, { query: q1 }, { headers });
    let totalDebit = 0;
    let totalCredit = 0;
    res1.data.data.forEach(r => {
        if (parseFloat(r.Credit) >= 50000000000 || parseFloat(r.Debit) >= 50000000000) {
            console.log(r);
        }
    });
  } catch(e) {
    console.error("Error:", e.response?.data || e.message);
  }
}
run();
