const axios = require('axios');
async function run() {
  const url = 'http://80.210.31.176:5000/api/external/v1/query';
  const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' };
  
  try {
    const q1 = `SELECT Field_005 as DocNum, Field_016 as CreateUser, Field_020 as UpdateUser FROM ACT_TBL_008 WHERE Field_005 IN ('1215', '1370', '1438', '1631', '1609', '1814', '2211', '2604', '2601') AND Field_004 = '4'`;
    const res1 = await axios.post(url, { query: q1 }, { headers });
    console.log(res1.data.data);
  } catch(e) {
    console.error("Error:", e.message);
  }
}
run();
