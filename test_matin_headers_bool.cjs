const axios = require('axios');
async function run() {
  const url = 'http://80.210.31.176:5000/api/external/v1/query';
  const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' };
  
  try {
    const q1 = `SELECT DISTINCT Field_010 as BoolVal, COUNT(*) as Count 
      FROM ACT_TBL_008 
      GROUP BY Field_010`;
    const res1 = await axios.post(url, { query: q1 }, { headers });
    console.log("ACT_TBL_008 Field_010 values in the system:", res1.data.data);
  } catch(e) {
    console.error("Error:", e.message);
  }
}
run();
