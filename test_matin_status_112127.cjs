const axios = require('axios');
async function run() {
  const url = 'http://80.210.31.176:5000/api/external/v1/query';
  const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' };
  
  try {
    const q1 = `SELECT Field_005, CAST(Field_009 as FLOAT) as Deb, CAST(Field_010 as FLOAT) as Cred FROM ACT_TBL_009 WHERE Field_015 LIKE '%112127%'`;
    const res1 = await axios.post(url, { query: q1 }, { headers });
    const groups = {};
    res1.data.data.forEach(r => {
        groups[r.Field_005] = groups[r.Field_005] || { count: 0, deb: 0, cred: 0 };
        groups[r.Field_005].count++;
        groups[r.Field_005].deb += r.Deb;
        groups[r.Field_005].cred += r.Cred;
    });
    console.log(groups);
  } catch(e) {
    console.error("Error:", e.message);
  }
}
run();
