const axios = require('axios');
async function run() {
  const url = 'http://80.210.31.176:5000/api/external/v1/query';
  const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' };
  
  try {
    const q1 = `SELECT SUM(CAST(Field_010 as FLOAT)) as Cred FROM ACT_TBL_009 WHERE Field_015 LIKE '%112127%' AND Field_003 = '4'`;
    const res1 = await axios.post(url, { query: q1 }, { headers });
    console.log("No JOIN Cred (DocStatus 4):", res1.data.data[0]);
    
    const q2 = `SELECT SUM(CAST(t9.Field_010 as FLOAT)) as Cred 
      FROM ACT_TBL_009 t9
      LEFT JOIN ACT_TBL_008 t8 ON t8.Field_004 = t9.Field_003 AND t8.Field_005 = t9.Field_004
      WHERE t9.Field_015 LIKE '%112127%' AND t9.Field_003 = '4'`;
    const res2 = await axios.post(url, { query: q2 }, { headers });
    console.log("With JOIN Cred (DocStatus 4):", res2.data.data[0]);
  } catch(e) {
    console.error("Error:", e.message);
  }
}
run();
