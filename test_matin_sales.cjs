const axios = require('axios');
async function run() {
  const url = 'http://80.210.31.176:5000/api/external/v1/query';
  const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' };
  
  try {
    const q1 = `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME LIKE '%SLS_TBL%' OR TABLE_NAME LIKE '%SL_TBL%'`;
    const res1 = await axios.post(url, { query: q1 }, { headers });
    const tables = res1.data.data.map(t => t.TABLE_NAME);
    console.log("Sales Tables:", tables);
    
    // Look for 112127 in some of these tables
    const q2 = `SELECT Field_001, Field_002, Field_003 FROM SLS_TBL_008 WHERE Field_003 = '112127' OR Field_004 = '112127'`;
    // ACT_TBL_004 has Tafsili. Sales invoices (SLS_TBL_...) usually have Customer ID.
  } catch(e) {
    console.error("Error:", e.message);
  }
}
run();
