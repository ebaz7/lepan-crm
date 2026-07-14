const axios = require('axios');
async function run() {
  const url = 'http://80.210.31.176:5000/api/external/v1/query';
  const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' };
  
  try {
    const q1 = `SELECT * FROM ACT_TBL_007 WHERE Field_003 = '112127' OR Field_005 = '112127' OR Field_006 LIKE '%متین%'`;
    const res1 = await axios.post(url, { query: q1 }, { headers });
    console.log("ACT_TBL_007 rows for Matin:", res1.data.data);
  } catch(e) {
    console.error("Error:", e.message);
  }
}
run();
