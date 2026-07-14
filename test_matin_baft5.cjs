const axios = require('axios');
async function run() {
  const url = 'http://80.210.31.176:5000/api/external/v1/query';
  const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' };
  
  try {
    const q1 = `SELECT Field_009 as Debit, Field_010 as Credit, Field_011 as Description, Field_014 as Date
      FROM ACT_TBL_009 
      WHERE Field_015 = '11:112127' AND (CAST(Field_009 as FLOAT) > 50000000000 OR CAST(Field_010 as FLOAT) > 50000000000)
      `;
    const res1 = await axios.post(url, { query: q1 }, { headers });
    console.log(res1.data.data);
  } catch(e) {
    console.error("Error:", e.response?.data || e.message);
  }
}
run();
