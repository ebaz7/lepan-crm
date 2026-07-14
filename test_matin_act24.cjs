const axios = require('axios');
async function run() {
  const url = 'http://80.210.31.176:5000/api/external/v1/query';
  const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' };
  
  try {
    const q1 = `SELECT Field_010 as TafsiliRaw, Field_006 as Bed, Field_007 as Bes, Field_001, Field_003, Field_004, Field_005 
      FROM ACT_TBL_024 
      WHERE Field_010 LIKE '%112127%'`;
    const res1 = await axios.post(url, { query: q1 }, { headers });
    console.log("ACT_TBL_024 for 112127:", res1.data.data);
  } catch(e) {
    console.error("Error:", e.response?.data || e.message);
  }
}
run();
