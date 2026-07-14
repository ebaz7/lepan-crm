const axios = require('axios');
async function run() {
  const url = 'http://80.210.31.176:5000/api/external/v1/query';
  const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' };
  
  try {
    const q1 = `
      SELECT 
          t9.Field_015 as TafsiliRaw,
          SUM(CAST(t9.Field_009 AS FLOAT)) as TotalBed,
          SUM(CAST(t9.Field_010 AS FLOAT)) as TotalBes
      FROM ACT_TBL_009 t9
      LEFT JOIN ACT_TBL_008 t8 ON t8.Field_004 = t9.Field_003 AND t8.Field_005 = t9.Field_004
      WHERE (t9.Field_015 LIKE '11:%' OR t9.Field_015 LIKE '%-11:%' OR t9.Field_015 LIKE '31:%' OR t9.Field_015 LIKE '%-31:%') 
        AND t9.Field_015 NOT LIKE '%-12%'
        AND t9.Field_015 NOT LIKE '%-13%'
        AND t9.Field_007 NOT IN ('102', '103', '107', '109', '114', '116', '117') 
        AND t9.Field_005 <> '9'
      GROUP BY t9.Field_015
    `;
    const res1 = await axios.post(url, { query: q1 }, { headers });
    const row = res1.data.data.find(r => r.TafsiliRaw.includes('112127'));
    console.log("AccountingReports result (ALL TIME):", row);
    
    const q2 = `
      SELECT 
          t9.Field_015 as TafsiliRaw,
          SUM(CAST(t9.Field_009 AS FLOAT)) as TotalBed,
          SUM(CAST(t9.Field_010 AS FLOAT)) as TotalBes
      FROM ACT_TBL_009 t9
      LEFT JOIN ACT_TBL_008 t8 ON t8.Field_004 = t9.Field_003 AND t8.Field_005 = t9.Field_004
      WHERE (t9.Field_015 LIKE '11:%' OR t9.Field_015 LIKE '%-11:%' OR t9.Field_015 LIKE '31:%' OR t9.Field_015 LIKE '%-31:%') 
        AND t9.Field_015 NOT LIKE '%-12%'
        AND t9.Field_015 NOT LIKE '%-13%'
        AND t9.Field_007 NOT IN ('102', '103', '107', '109', '114', '116', '117') 
        AND t9.Field_005 <> '9'
        AND t8.Field_008 >= '2026-03-21T00:00:00.000Z' 
      GROUP BY t9.Field_015
    `;
    const res2 = await axios.post(url, { query: q2 }, { headers });
    const row2 = res2.data.data.find(r => r.TafsiliRaw.includes('112127'));
    console.log("AccountingReports result (1405):", row2);
  } catch(e) {
    console.error("Error:", e.response?.data || e.message);
  }
}
run();
