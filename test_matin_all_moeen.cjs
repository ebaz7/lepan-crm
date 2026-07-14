const axios = require('axios');
async function run() {
  const url = 'http://80.210.31.176:5000/api/external/v1/query';
  const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' };
  
  try {
    const q1 = `SELECT Field_015, SUM(CAST(Field_009 as FLOAT)) as Deb, SUM(CAST(Field_010 as FLOAT)) as Cred
      FROM ACT_TBL_009 
      WHERE Field_015 LIKE '%112127%'
      GROUP BY Field_015
      `;
    const res1 = await axios.post(url, { query: q1 }, { headers });
    res1.data.data.forEach(r => {
        console.log(`Code: ${r.Field_015}, Deb: ${r.Deb}, Cred: ${r.Cred}, Bal: ${r.Deb - r.Cred}`);
    });
  } catch(e) {
    console.error("Error:", e.response?.data || e.message);
  }
}
run();
