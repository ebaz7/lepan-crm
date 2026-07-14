const axios = require('axios');
async function run() {
  const url = 'http://80.210.31.176:5000/api/external/v1/query';
  const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' };
  
  try {
    const q1 = `SELECT Field_004, Field_005, COUNT(*) as cnt FROM ACT_TBL_008 GROUP BY Field_004, Field_005 HAVING COUNT(*) > 1`;
    const res1 = await axios.post(url, { query: q1 }, { headers });
    console.log("Duplicates:", res1.data.data.length);
  } catch(e) {
    console.error("Error:", e.response?.data || e.message);
  }
}
run();
