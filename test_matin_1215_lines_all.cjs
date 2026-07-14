const axios = require('axios');
async function run() {
  const url = 'http://80.210.31.176:5000/api/external/v1/query';
  const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' };
  
  try {
    const q1 = `SELECT Field_004 as DocNum, Field_001 as LineId, Field_007 as Moein, Field_015 as Tafsili, CAST(Field_009 as FLOAT) as Debit, CAST(Field_010 as FLOAT) as Credit, Field_011 as Description
      FROM ACT_TBL_009 
      WHERE Field_004 IN ('1814', '2211') AND Field_003 = '4'`;
    const res1 = await axios.post(url, { query: q1 }, { headers });
    console.log("Lines for Docs 1814 and 2211:", res1.data.data);
  } catch(e) {
    console.error("Error:", e.message);
  }
}
run();
