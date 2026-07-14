const axios = require('axios');
async function run() {
  const url = 'http://80.210.31.176:5000/api/external/v1/query';
  const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' };
  
  try {
    const q1 = `SELECT 
      t8.Field_005 as DocNum,
      t8.Field_010 as Flag010,
      CAST(t9.Field_009 as FLOAT) as Debit,
      CAST(t9.Field_010 as FLOAT) as Credit
      FROM ACT_TBL_009 t9
      LEFT JOIN ACT_TBL_008 t8 ON t8.Field_004 = t9.Field_003 AND t8.Field_005 = t9.Field_004
      WHERE (t9.Field_015 LIKE '%:112127-%' OR t9.Field_015 LIKE '%-112127-%' OR t9.Field_015 LIKE '%:112127' OR t9.Field_015 LIKE '112127:%')
        AND t8.Field_008 >= '2026-03-21T00:00:00.000Z'
      `;
    const res1 = await axios.post(url, { query: q1 }, { headers });
    res1.data.data.forEach(r => {
        console.log(`Doc: ${r.DocNum}, Flag010: ${r.Flag010}, Deb: ${r.Debit}, Cred: ${r.Credit}`);
    });
  } catch(e) {
    console.error("Error:", e.response?.data || e.message);
  }
}
run();
