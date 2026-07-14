const axios = require('axios');
async function run() {
  const url = 'http://80.210.31.176:5000/api/external/v1/query';
  const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' };
  
  try {
    const q1 = `SELECT Field_001, Field_004, Field_005, Field_013, Field_008 FROM ACT_TBL_008 WHERE Field_005 = '6155' AND Field_004 = '3'`;
    const res1 = await axios.post(url, { query: q1 }, { headers });
    console.log(res1.data.data);
  } catch(e) {
    console.error("Error:", e.message);
  }
}
run();
