const axios = require('axios');
async function run() {
  const url = 'http://80.210.31.176:5000/api/external/v1/query';
  const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' };
  
  try {
    const q1 = `SELECT 
      t8.Field_004 as DocType, 
      t8.Field_005 as DocNum,
      CAST(t9.Field_009 as FLOAT) as Debit,
      CAST(t9.Field_010 as FLOAT) as Credit,
      t8.Field_008 as GregDate
      FROM ACT_TBL_009 t9
      LEFT JOIN ACT_TBL_008 t8 ON t8.Field_004 = t9.Field_003 AND t8.Field_005 = t9.Field_004
      WHERE (t9.Field_015 LIKE '%:112127-%' OR t9.Field_015 LIKE '%-112127-%' OR t9.Field_015 LIKE '%:112127' OR t9.Field_015 LIKE '112127:%')
      AND t8.Field_013 = '1dbfc4c5-2a62-47f8-b8bf-e7ef3e3bf2e0'
      `;
    const res1 = await axios.post(url, { query: q1 }, { headers });
    let bal = 0;
    res1.data.data.forEach(r => {
        bal += (parseFloat(r.Debit) || 0) - (parseFloat(r.Credit) || 0);
    });
    console.log("Balance for FinYear 1405:", bal);
  } catch(e) {
    console.error("Error:", e.message);
  }
}
run();
