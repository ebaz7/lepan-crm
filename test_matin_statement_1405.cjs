const axios = require('axios');
async function run() {
  const url = 'http://80.210.31.176:5000/api/external/v1/query';
  const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' };
  
  try {
    const q1 = `SELECT 
        t9.Field_001 as LineId,
        t9.Field_004 as DocNum,
        t9.Field_003 as DocType,
        t8.Field_008 as Date,
        CAST(t9.Field_009 as FLOAT) as Debit,
        CAST(t9.Field_010 as FLOAT) as Credit,
        t9.Field_011 as LineDesc,
        t8.Field_007 as HeaderDesc
      FROM ACT_TBL_009 t9
      LEFT JOIN ACT_TBL_008 t8 ON t8.Field_004 = t9.Field_003 AND t8.Field_005 = t9.Field_004
      WHERE t9.Field_015 = '11:112127' AND t8.Field_008 >= '2026-03-21T00:00:00.000Z'
      ORDER BY t8.Field_008 ASC`;
    const res1 = await axios.post(url, { query: q1 }, { headers });
    console.log("Matin Baft 1405 Transactions:");
    res1.data.data.forEach((r, idx) => {
      console.log(`${idx + 1}. DocNum: ${r.DocNum}, Date: ${r.Date.substring(0, 10)}, Deb: ${r.Debit}, Cred: ${r.Credit}, Desc: ${r.LineDesc || r.HeaderDesc || ''}`);
    });
  } catch(e) {
    console.error("Error:", e.message);
  }
}
run();
