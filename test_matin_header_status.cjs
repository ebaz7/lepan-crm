const axios = require('axios');
async function run() {
  const url = 'http://80.210.31.176:5000/api/external/v1/query';
  const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' };
  
  try {
    const q1 = `SELECT Field_001, Field_004 as DocType, Field_005 as DocNum, Field_006 as Status, Field_008 as Date, Field_010 as BoolVal, Field_013 as YearId 
      FROM ACT_TBL_008 
      WHERE Field_005 IN ('1215', '1814', '2211') AND Field_004 = '4'`;
    const res1 = await axios.post(url, { query: q1 }, { headers });
    console.log("ACT_TBL_008 status for docs:", res1.data.data);
  } catch(e) {
    console.error("Error:", e.message);
  }
}
run();
