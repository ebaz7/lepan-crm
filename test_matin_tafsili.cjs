const axios = require('axios');
async function run() {
  const url = 'http://80.210.31.176:5000/api/external/v1/query';
  const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' };
  
  try {
    const q1 = `SELECT TABLE_NAME, COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE COLUMN_NAME = 'Field_004'`;
    const res1 = await axios.post(url, { query: q1 }, { headers });
    // Try to find 112127 in some common tables
    const q2 = `SELECT Field_001, Field_004, Field_005 FROM ACT_TBL_004 WHERE Field_004 = '112127'`;
    const res2 = await axios.post(url, { query: q2 }, { headers });
    console.log("ACT_TBL_004:", res2.data.data);
    
    const q3 = `SELECT Field_001, Field_004, Field_005 FROM GNR_TBL_008 WHERE Field_004 = '112127'`;
    const res3 = await axios.post(url, { query: q3 }, { headers });
    console.log("GNR_TBL_008:", res3.data.data);
    
  } catch(e) {
    console.error("Error:", e.message);
  }
}
run();
