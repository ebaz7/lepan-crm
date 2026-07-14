const axios = require('axios');
async function run() {
  const url = 'http://80.210.31.176:5000/api/external/v1/query';
  const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' };
  
  try {
    const q1 = `SELECT 
      SUM(CAST(t9.Field_009 as FLOAT)) as Debit, 
      SUM(CAST(t9.Field_010 as FLOAT)) as Credit 
      FROM ACT_TBL_009 t9
      LEFT JOIN ACT_TBL_008 t8 ON t8.Field_004 = t9.Field_003 AND t8.Field_005 = t9.Field_004
      WHERE (t9.Field_015 LIKE '%:112127-%' OR t9.Field_015 LIKE '%-112127-%' OR t9.Field_015 LIKE '%:112127' OR t9.Field_015 LIKE '112127:%')
        AND (t9.Field_015 LIKE '11:%' OR t9.Field_015 LIKE '%-11:%' OR t9.Field_015 LIKE '31:%' OR t9.Field_015 LIKE '%-31:%')
        AND t9.Field_015 NOT LIKE '%-12:%'
        AND t9.Field_015 NOT LIKE '%-13:%'
        AND t9.Field_007 NOT IN ('102', '103', '107', '109', '114', '116', '117')
        AND t9.Field_005 <> '9'
        AND t8.Field_004 != '4'
      `;
    const res1 = await axios.post(url, { query: q1 }, { headers });
    const data = res1.data.data[0];
    const debit = data.Debit || 0;
    const credit = data.Credit || 0;
    console.log("Filtered Debit (No 4):", debit, "Credit:", credit, "Balance:", debit - credit);
    
    const q2 = `SELECT 
      SUM(CAST(t9.Field_009 as FLOAT)) as Debit, 
      SUM(CAST(t9.Field_010 as FLOAT)) as Credit 
      FROM ACT_TBL_009 t9
      LEFT JOIN ACT_TBL_008 t8 ON t8.Field_004 = t9.Field_003 AND t8.Field_005 = t9.Field_004
      WHERE (t9.Field_015 LIKE '%:112127-%' OR t9.Field_015 LIKE '%-112127-%' OR t9.Field_015 LIKE '%:112127' OR t9.Field_015 LIKE '112127:%')
        AND (t9.Field_015 LIKE '11:%' OR t9.Field_015 LIKE '%-11:%' OR t9.Field_015 LIKE '31:%' OR t9.Field_015 LIKE '%-31:%')
        AND t9.Field_015 NOT LIKE '%-12:%'
        AND t9.Field_015 NOT LIKE '%-13:%'
        AND t9.Field_007 NOT IN ('102', '103', '107', '109', '114', '116', '117')
        AND t9.Field_005 <> '9'
        AND t8.Field_004 = '2'
      `;
    const res2 = await axios.post(url, { query: q2 }, { headers });
    const data2 = res2.data.data[0];
    const debit2 = data2.Debit || 0;
    const credit2 = data2.Credit || 0;
    console.log("Filtered Debit (Only 2):", debit2, "Credit:", credit2, "Balance:", debit2 - credit2);
  } catch(e) {
    console.error("Error:", e.response?.data || e.message);
  }
}
run();
