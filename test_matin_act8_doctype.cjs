const axios = require('axios');
async function run() {
  const url = 'http://80.210.31.176:5000/api/external/v1/query';
  const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' };
  
  try {
    const q1 = `SELECT Field_001, Field_004, Field_005, Field_006, Field_011 FROM ACT_TBL_008 WHERE Field_005 = '1215'`;
    const res1 = await axios.post(url, { query: q1 }, { headers });
    console.log("Doc 1215:", res1.data.data);
    
    const q2 = `SELECT Field_001, Field_004, Field_005, Field_006, Field_011 FROM ACT_TBL_008 WHERE Field_005 = '6155'`;
    const res2 = await axios.post(url, { query: q2 }, { headers });
    console.log("Doc 6155:", res2.data.data);
  } catch(e) {
    console.error("Error:", e.message);
  }
}
run();
