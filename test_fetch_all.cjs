const axios = require('axios');
async function run() {
  const url = 'http://80.210.31.176:5000/api/external/v1/query';
  const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' };
  
  try {
    const q1 = `SELECT Field_014 as [Date], Field_009 as [Debit], Field_010 as [Credit], Field_015 as [Codes] FROM ACT_TBL_009 WHERE Field_009 != '0' OR Field_010 != '0'`;
    const start = Date.now();
    const res1 = await axios.post(url, { query: q1 }, { headers });
    console.log(`Fetched ${res1.data.data.length} rows in ${Date.now() - start}ms`);
  } catch(e) {
    console.error("Error:", e.response?.data || e.message);
  }
}
run();
