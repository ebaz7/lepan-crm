const axios = require('axios');
async function run() {
  const url = 'http://80.210.31.176:5000/api/external/v1/query';
  const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' };
  
  try {
    const q1 = `SELECT 
        Field_001, Field_003 as DocStatus, Field_004 as DocNum, 
        CAST(Field_009 as FLOAT) as Debit, Field_011 
      FROM ACT_TBL_009 
      WHERE Field_015 LIKE '%112127%' AND CAST(Field_009 as FLOAT) > 0
      ORDER BY Debit DESC`;
    const res1 = await axios.post(url, { query: q1 }, { headers });
    console.log("All Debits:", res1.data.data);
  } catch(e) {
    console.error("Error:", e.response?.data || e.message);
  }
}
run();
