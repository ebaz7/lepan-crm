const axios = require('axios');
async function run() {
  const url = 'http://80.210.31.176:5000/api/external/v1/query';
  const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' };
  
  try {
    const q1 = `SELECT TOP 1 * FROM ACT_TBL_009 WHERE Field_015 LIKE '%112127%'`;
    const res1 = await axios.post(url, { query: q1 }, { headers });
    console.log(res1.data.data[0]);
  } catch(e) {
    console.error("Error:", e.message);
  }
}
run();
