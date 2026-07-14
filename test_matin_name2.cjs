const axios = require('axios');
async function run() {
  const url = 'http://80.210.31.176:5000/api/external/v1/query';
  const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' };
  
  try {
    const q3 = `SELECT Field_001, Field_003, Field_004, Field_005 FROM COM_TBL_002 WHERE Field_005 LIKE N'%متين%' OR Field_005 LIKE N'%متین%'`;
    const res3 = await axios.post(url, { query: q3 }, { headers });
    console.log("COM_TBL_002:", res3.data.data);
    
    const q4 = `SELECT Field_001, Field_003, Field_004, Field_005 FROM ACT_TBL_004 WHERE Field_005 LIKE N'%متين%' OR Field_005 LIKE N'%متین%'`;
    const res4 = await axios.post(url, { query: q4 }, { headers });
    console.log("ACT_TBL_004:", res4.data.data);
  } catch(e) {
    console.error("Error:", e.message);
  }
}
run();
