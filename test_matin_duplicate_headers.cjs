const axios = require('axios');
async function run() {
  const url = 'http://80.210.31.176:5000/api/external/v1/query';
  const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' };
  
  try {
    const q1 = `SELECT Field_004 as DocType, Field_005 as DocNum, COUNT(*) as Count 
      FROM ACT_TBL_008 
      GROUP BY Field_004, Field_005 
      HAVING COUNT(*) > 1`;
    const res1 = await axios.post(url, { query: q1 }, { headers });
    console.log("Duplicate headers count:", res1.data.data.length);
    console.log("Some duplicates:", res1.data.data.slice(0, 10));
  } catch(e) {
    console.error("Error:", e.message);
  }
}
run();
