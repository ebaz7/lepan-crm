const axios = require('axios');
async function run() {
  const url = 'http://80.210.31.176:5000/api/external/v1/query';
  const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' };
  
  try {
    const q1 = `SELECT 
      t9.Field_003 as DocType,
      t9.Field_004 as DocNum,
      t9.Field_005 as MoeinGroup,
      t9.Field_007 as MoeinCode,
      t9.Field_015 as Tafsili,
      CAST(t9.Field_009 as FLOAT) as Debit,
      CAST(t9.Field_010 as FLOAT) as Credit,
      t9.Field_011 as Description,
      t8.Field_008 as Date
      FROM ACT_TBL_009 t9
      LEFT JOIN ACT_TBL_008 t8 ON t8.Field_004 = t9.Field_003 AND t8.Field_005 = t9.Field_004
      WHERE (t9.Field_015 LIKE '%:112127-%' OR t9.Field_015 LIKE '%-112127-%' OR t9.Field_015 LIKE '%:112127' OR t9.Field_015 LIKE '112127:%')
      ORDER BY t8.Field_008 ASC
      `;
    const res1 = await axios.post(url, { query: q1 }, { headers });
    const data = res1.data.data;
    console.log("Total rows:", data.length);
    let totalDeb = 0;
    let totalCred = 0;
    for (const r of data) {
      totalDeb += r.Debit;
      totalCred += r.Credit;
      console.log(`DocType: ${r.DocType}, DocNum: ${r.DocNum}, Group: ${r.MoeinGroup}, Moein: ${r.MoeinCode}, Tafsili: ${r.Tafsili}, Deb: ${r.Debit.toLocaleString()}, Cred: ${r.Credit.toLocaleString()}, Desc: ${r.Description || ''}`);
    }
    console.log("Total Debit:", totalDeb.toLocaleString());
    console.log("Total Credit:", totalCred.toLocaleString());
    console.log("Balance (Deb - Cred):", (totalDeb - totalCred).toLocaleString());
  } catch(e) {
    console.error("Error:", e.message);
  }
}
run();
