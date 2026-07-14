const axios = require('axios');
async function run() {
  const url = 'http://80.210.31.176:5000/api/external/v1/query';
  const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' };
  
  try {
    const q1 = `SELECT 
        t9.Field_007 as MoeinCode,
        t9.Field_005 as MoeinGroup,
        t9.Field_006 as MoeinParent,
        COUNT(*) as Count,
        SUM(CAST(t9.Field_009 as FLOAT)) as Debit,
        SUM(CAST(t9.Field_010 as FLOAT)) as Credit
      FROM ACT_TBL_009 t9
      LEFT JOIN ACT_TBL_008 t8 ON t8.Field_004 = t9.Field_003 AND t8.Field_005 = t9.Field_004
      WHERE t9.Field_015 = '11:112127' AND t8.Field_008 >= '2026-03-21T00:00:00.000Z'
      GROUP BY t9.Field_007, t9.Field_005, t9.Field_006`;
    const res1 = await axios.post(url, { query: q1 }, { headers });
    console.log("Matin Baft 1405 Moein groups:");
    console.log(res1.data.data);
  } catch(e) {
    console.error("Error:", e.message);
  }
}
run();
