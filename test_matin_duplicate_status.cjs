const axios = require('axios');
async function run() {
  const url = 'http://80.210.31.176:5000/api/external/v1/query';
  const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' };
  
  try {
    const q1 = `SELECT 
      t9.Field_001 as LineRowId,
      t9.Field_003 as DocType,
      t9.Field_004 as DocNum,
      t9.Field_010 as Credit,
      t8.Field_001 as HeaderRowId,
      t8.Field_017 as DocStatus
      FROM ACT_TBL_009 t9
      LEFT JOIN ACT_TBL_008 t8 ON t8.Field_004 = t9.Field_003 AND t8.Field_005 = t9.Field_004
      WHERE t9.Field_004 IN ('1215', '1814', '2211') AND t9.Field_015 = '11:112127'
    `;
    const res1 = await axios.post(url, { query: q1 }, { headers });
    console.log("Joined lines:", res1.data.data);
  } catch(e) {
    console.error("Error:", e.response?.data || e.message);
  }
}
run();
