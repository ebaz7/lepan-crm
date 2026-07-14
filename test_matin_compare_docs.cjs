const axios = require('axios');
async function run() {
  const url = 'http://80.210.31.176:5000/api/external/v1/query';
  const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' };
  
  try {
    const q1 = `SELECT 
        t9.Field_004 as DocNum,
        t9.Field_003 as DocType,
        CAST(t9.Field_009 as FLOAT) as Debit,
        CAST(t9.Field_010 as FLOAT) as Credit,
        t8.Field_006 as HeaderStatus,
        t8.Field_010 as HeaderBool,
        t8.Field_013 as HeaderYearId
      FROM ACT_TBL_009 t9
      LEFT JOIN ACT_TBL_008 t8 ON t8.Field_004 = t9.Field_003 AND t8.Field_005 = t9.Field_004
      WHERE t9.Field_015 = '11:112127'
      ORDER BY t9.Field_004 ASC`;
    const res1 = await axios.post(url, { query: q1 }, { headers });
    console.log("All Matin Baft documents with header info:");
    res1.data.data.forEach(r => {
      console.log(`DocNum: ${r.DocNum}, Type: ${r.DocType}, Deb: ${r.Debit}, Cred: ${r.Credit}, HeaderStatus: ${r.HeaderStatus}, HeaderBool: ${r.HeaderBool}, YearId: ${r.HeaderYearId}`);
    });
  } catch(e) {
    console.error("Error:", e.message);
  }
}
run();
