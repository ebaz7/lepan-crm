const axios = require('axios');
async function run() {
  const url = 'http://80.210.31.176:5000/api/external/v1/query';
  const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' };
  
  try {
    // try searching ACT_TBL_009 for '2127' or '112127' in any field
    const q1 = "SELECT TOP 5 Field_005, Field_006, Field_007, Field_008, Field_009, Field_013, Field_014 FROM ACT_TBL_009 WHERE Field_006='2127' OR Field_007='2127' OR Field_006='112127' OR Field_007='112127' OR Field_014 LIKE '%112127%'";
    const res1 = await axios.post(url, { query: q1 }, { headers });
    console.log(res1.data.data);
  } catch(e) {
    console.error("Error:", e.response?.data || e.message);
  }
}
run();
