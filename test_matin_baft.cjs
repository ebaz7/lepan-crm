const axios = require('axios');
async function run() {
  const url = 'http://80.210.31.176:5000/api/external/v1/query';
  const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' };
  
  try {
    const q1 = `SELECT SUM(CAST(Field_009 as FLOAT)) as Debit, SUM(CAST(Field_010 as FLOAT)) as Credit FROM ACT_TBL_009 WHERE Field_015 LIKE '%:112127-%' OR Field_015 LIKE '%-112127-%' OR Field_015 LIKE '%:112127'`;
    const res1 = await axios.post(url, { query: q1 }, { headers });
    const data = res1.data.data[0];
    const debit = data.Debit || 0;
    const credit = data.Credit || 0;
    console.log("Debit:", debit, "Credit:", credit, "Balance:", debit - credit);
    
    // Test alternative: 2127
    const q2 = `SELECT SUM(CAST(Field_009 as FLOAT)) as Debit, SUM(CAST(Field_010 as FLOAT)) as Credit FROM ACT_TBL_009 WHERE Field_015 LIKE '%:2127-%' OR Field_015 LIKE '%-2127-%' OR Field_015 LIKE '%:2127'`;
    const res2 = await axios.post(url, { query: q2 }, { headers });
    const data2 = res2.data.data[0];
    const debit2 = data2.Debit || 0;
    const credit2 = data2.Credit || 0;
    console.log("Alternative 2127 - Debit:", debit2, "Credit:", credit2, "Balance:", debit2 - credit2);
  } catch(e) {
    console.error("Error:", e.response?.data || e.message);
  }
}
run();
