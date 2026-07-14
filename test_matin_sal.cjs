const axios = require('axios');
async function run() {
  const url = 'http://80.210.31.176:5000/api/external/v1/query';
  const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' };
  
  try {
    const q1 = `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME LIKE 'SAL_TBL%'`;
    const res1 = await axios.post(url, { query: q1 }, { headers });
    console.log(res1.data.data.map(t => t.TABLE_NAME));
  } catch(e) {
    console.error("Error:", e.message);
  }
}
run();
