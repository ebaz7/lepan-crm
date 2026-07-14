const axios = require('axios');
async function run() {
  const url = 'http://80.210.31.176:5000/api/external/v1/query';
  const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' };
  
  try {
    // We already found COM_TBL_002 didn't have 112127. Let's find what tables have it.
    const q1 = `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE COLUMN_NAME IN ('Field_003', 'Field_004')`;
    // Actually just search all tables for "متین بافت".
    const q2 = `SELECT Field_001, Field_003, Field_004, Field_005 FROM GNR_TBL_008 WHERE Field_005 LIKE N'%متین بافت%'`;
    const res2 = await axios.post(url, { query: q2 }, { headers });
    console.log("GNR_TBL_008:", res2.data.data);
    
    // Check COM_TBL_002
    const q3 = `SELECT Field_001, Field_003, Field_004, Field_005 FROM COM_TBL_002 WHERE Field_005 LIKE N'%متین بافت%'`;
    const res3 = await axios.post(url, { query: q3 }, { headers });
    console.log("COM_TBL_002:", res3.data.data);
    
    // Check ACT_TBL_004
    const q4 = `SELECT Field_001, Field_003, Field_004, Field_005 FROM ACT_TBL_004 WHERE Field_005 LIKE N'%متین بافت%'`;
    const res4 = await axios.post(url, { query: q4 }, { headers });
    console.log("ACT_TBL_004:", res4.data.data);
  } catch(e) {
    console.error("Error:", e.message);
  }
}
run();
