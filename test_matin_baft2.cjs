const axios = require('axios');
async function run() {
  const url = 'http://80.210.31.176:5000/api/external/v1/query';
  const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' };
  
  try {
    const q1 = `SELECT SUM(CAST(Field_009 as FLOAT)) as Debit, SUM(CAST(Field_010 as FLOAT)) as Credit 
      FROM ACT_TBL_009 
      WHERE (Field_015 LIKE '%:112127-%' OR Field_015 LIKE '%-112127-%' OR Field_015 LIKE '%:112127' OR Field_015 LIKE '112127:%')
        AND (Field_015 LIKE '11:%' OR Field_015 LIKE '%-11:%' OR Field_015 LIKE '31:%' OR Field_015 LIKE '%-31:%')
        AND Field_015 NOT LIKE '%-12:%'
        AND Field_015 NOT LIKE '%-13:%'
        AND Field_007 NOT IN ('102', '103', '107', '109', '114', '116', '117')
        AND Field_005 <> '9'
      `;
    const res1 = await axios.post(url, { query: q1 }, { headers });
    const data = res1.data.data[0];
    const debit = data.Debit || 0;
    const credit = data.Credit || 0;
    console.log("Filtered Debit:", debit, "Credit:", credit, "Balance:", debit - credit);
  } catch(e) {
    console.error("Error:", e.response?.data || e.message);
  }
}
run();
