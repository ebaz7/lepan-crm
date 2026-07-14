const axios = require('axios');
async function run() {
  const url = 'http://80.210.31.176:5000/api/external/v1/query';
  const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' };
  
  try {
    const q1 = `SELECT Field_015 as [Codes], SUM(CAST(Field_009 AS DECIMAL(18,0))) as [Debit], SUM(CAST(Field_010 AS DECIMAL(18,0))) as [Credit] FROM ACT_TBL_009 GROUP BY Field_015`;
    const res1 = await axios.post(url, { query: q1 }, { headers });
    console.log(res1.data.data.length);
  } catch(e) {
    console.error("Error:", e.response?.data || e.message);
  }
}
run();
