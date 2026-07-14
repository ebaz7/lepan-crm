const axios = require('axios');
async function run() {
  const url = 'http://80.210.31.176:5000/api/external/v1/query';
  const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' };
  
  try {
    const q1 = `SELECT 
        Field_001, Field_003 as DocStatus, Field_004 as DocNum, 
        CAST(Field_010 as FLOAT) as Credit, Field_011 
      FROM ACT_TBL_009 
      WHERE Field_015 LIKE '%112127%' AND Field_004 IN ('1215', '1814', '2211')`;
    const res1 = await axios.post(url, { query: q1 }, { headers });
    console.log("Docs 1215, 1814, 2211 in ACT_TBL_009:");
    console.log(res1.data.data);
    
    const q2 = `SELECT 
        Field_001, Field_004 as DocStatus, Field_005 as DocNum, 
        Field_011 as HeaderDesc, Field_007 as DocType 
      FROM ACT_TBL_008 
      WHERE Field_005 IN ('1215', '1814', '2211')`;
    const res2 = await axios.post(url, { query: q2 }, { headers });
    console.log("Docs 1215, 1814, 2211 in ACT_TBL_008:");
    console.log(res2.data.data);
  } catch(e) {
    console.error("Error:", e.response?.data || e.message);
  }
}
run();
