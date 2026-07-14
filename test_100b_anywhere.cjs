const axios = require('axios');
async function run() {
  const url = 'http://80.210.31.176:5000/api/external/v1/query';
  const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' };
  
  try {
    const q1 = `SELECT Field_001, Field_003, Field_004, Field_009, Field_010, Field_011, Field_015 
      FROM ACT_TBL_009 
      WHERE (Field_009 = '100000000000' OR Field_010 = '100000000000' OR Field_009 = '100000000000.0' OR Field_010 = '100000000000.0')
      `;
    const res1 = await axios.post(url, { query: q1 }, { headers });
    console.log("Found 100B in ACT_TBL_009:", res1.data.data);
  } catch(e) {
    console.error("Error:", e.response?.data || e.message);
  }
}
run();
