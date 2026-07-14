const axios = require('axios');
async function run() {
  const url = 'http://80.210.31.176:5000/api/external/v1/query';
  const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' };
  
  try {
    const q1 = `SELECT * FROM ACT_TBL_005 WHERE Field_002 LIKE N'%متین بافت%'`;
    const res1 = await axios.post(url, { query: q1 }, { headers });
    console.log(res1.data.data.map(r => ({ Code: r.Field_001, Name: r.Field_002 })));
  } catch(e) {
    console.error("Error:", e.response?.data || e.message);
  }
}
run();
