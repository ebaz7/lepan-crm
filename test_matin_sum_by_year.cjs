const axios = require('axios');
async function run() {
  const url = 'http://80.210.31.176:5000/api/external/v1/query';
  const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' };
  
  try {
    const q1 = `SELECT 
      t9.Field_001 as RowId,
      t9.Field_003 as DocType,
      t9.Field_004 as DocNum,
      CAST(t9.Field_009 as FLOAT) as Debit,
      CAST(t9.Field_010 as FLOAT) as Credit,
      t8.Field_008 as GregDate,
      t8.Field_013 as FinYearID
      FROM ACT_TBL_009 t9
      LEFT JOIN ACT_TBL_008 t8 ON t8.Field_004 = t9.Field_003 AND t8.Field_005 = t9.Field_004
      WHERE (t9.Field_015 LIKE '%:112127-%' OR t9.Field_015 LIKE '%-112127-%' OR t9.Field_015 LIKE '%:112127' OR t9.Field_015 LIKE '112127:%')
      `;
    const res1 = await axios.post(url, { query: q1 }, { headers });
    const data = res1.data.data;
    
    const sumsByYear = {};
    for (const r of data) {
      const year = r.FinYearID || 'unknown';
      if (!sumsByYear[year]) {
        sumsByYear[year] = { deb: 0, cred: 0, count: 0 };
      }
      sumsByYear[year].deb += r.Debit;
      sumsByYear[year].cred += r.Credit;
      sumsByYear[year].count += 1;
    }
    console.log("Summary by Financial Year:", JSON.stringify(sumsByYear, null, 2));
    
    // Total sum
    let totDeb = 0, totCred = 0;
    for (const r of data) {
      totDeb += r.Debit;
      totCred += r.Credit;
    }
    console.log(`Total Debit: ${totDeb.toLocaleString()}, Total Credit: ${totCred.toLocaleString()}, Balance: ${(totDeb - totCred).toLocaleString()}`);
  } catch(e) {
    console.error("Error:", e.message);
  }
}
run();
