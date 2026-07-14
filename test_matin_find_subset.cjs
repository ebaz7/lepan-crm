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
      t8.Field_008 as GregDate,
      t8.Field_013 as FinYear
      FROM ACT_TBL_009 t9
      LEFT JOIN ACT_TBL_008 t8 ON t8.Field_004 = t9.Field_003 AND t8.Field_005 = t9.Field_004
      WHERE (t9.Field_015 LIKE '%:112127-%' OR t9.Field_015 LIKE '%-112127-%' OR t9.Field_015 LIKE '%:112127' OR t9.Field_015 LIKE '112127:%')
      ORDER BY t8.Field_008 ASC
      `;
    const res1 = await axios.post(url, { query: q1 }, { headers });
    
    // Check running balances
    let bal = 0;
    console.log("Searching for -57,977,550,766 or +57,977,550,766...");
    for (const r of res1.data.data) {
        bal += (parseFloat(r.Debit) || 0) - (parseFloat(r.Credit) || 0);
        if (Math.abs(bal) === 57977550766) {
            console.log(`FOUND exactly at DocNum ${r.DocNum}, Date ${r.GregDate}!`);
        }
    }
    
    // What if we only sum FinYear = '1dbfc4c5-2a62-47f8-b8bf-e7ef3e3bf2e0' (1405)?
    bal = 0;
    for (const r of res1.data.data) {
        if (r.FinYear === '1dbfc4c5-2a62-47f8-b8bf-e7ef3e3bf2e0') {
            bal += (parseFloat(r.Debit) || 0) - (parseFloat(r.Credit) || 0);
            if (Math.abs(bal) === 57977550766) {
                console.log(`FOUND in FinYear 1405 exactly at DocNum ${r.DocNum}, Date ${r.GregDate}!`);
            }
        }
    }
    
  } catch(e) {
    console.error("Error:", e.message);
  }
}
run();
