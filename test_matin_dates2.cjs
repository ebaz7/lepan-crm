const axios = require('axios');
async function run() {
  const url = 'http://80.210.31.176:5000/api/external/v1/query';
  const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' };
  
  try {
    const q1 = `SELECT 
      t9.Field_013 as ShamsiDate,
      CAST(t9.Field_009 as FLOAT) as Debit,
      CAST(t9.Field_010 as FLOAT) as Credit,
      t8.Field_004 as DocStatus, 
      t8.Field_005 as DocNum,
      t9.Field_011 as Description
      FROM ACT_TBL_009 t9
      LEFT JOIN ACT_TBL_008 t8 ON t8.Field_004 = t9.Field_003 AND t8.Field_005 = t9.Field_004
      WHERE (t9.Field_015 LIKE '%:112127-%' OR t9.Field_015 LIKE '%-112127-%' OR t9.Field_015 LIKE '%:112127' OR t9.Field_015 LIKE '112127:%')
      ORDER BY t8.Field_008 ASC
      `;
    const res1 = await axios.post(url, { query: q1 }, { headers });
    let bal = 0;
    res1.data.data.forEach(r => {
        bal += (parseFloat(r.Debit) || 0) - (parseFloat(r.Credit) || 0);
        console.log(`Stat: ${r.DocStatus}, Doc: ${r.DocNum}, Desc: ${r.Description}, Deb: ${r.Debit}, Cred: ${r.Credit}, Bal: ${bal}`);
    });
  } catch(e) {
    console.error("Error:", e.response?.data || e.message);
  }
}
run();
