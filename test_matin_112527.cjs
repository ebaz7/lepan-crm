const axios = require('axios');
async function run() {
  const url = 'http://80.210.31.176:5000/api/external/v1/query';
  const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' };
  
  try {
    const q1 = `SELECT Field_001, Field_003, Field_004, Field_005 FROM COM_TBL_002 WHERE Field_003 = '112527' OR Field_004 = '112527'`;
    const res1 = await axios.post(url, { query: q1 }, { headers });
    console.log("COM_TBL_002:", res1.data.data);
    
    // Also try ACT_TBL_009 to see descriptions
    const q2 = `SELECT Field_011 FROM ACT_TBL_009 WHERE Field_015 LIKE '%112527%'`;
    const res2 = await axios.post(url, { query: q2 }, { headers });
    console.log("ACT_TBL_009 Desc:", res2.data.data);
  } catch(e) {
    console.error("Error:", e.response?.data || e.message);
  }
}
run();
