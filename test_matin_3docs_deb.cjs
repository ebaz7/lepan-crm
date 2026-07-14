const axios = require('axios');
async function run() {
  const url = 'http://80.210.31.176:5000/api/external/v1/query';
  const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' };
  
  try {
    const q1 = `SELECT Field_001, Field_004 as DocNum, Field_015 as Codes, CAST(Field_009 as FLOAT) as Deb, Field_011 as Descrip FROM ACT_TBL_009 WHERE Field_004 IN ('1215', '1814', '2211') AND Field_003 = '4' AND CAST(Field_009 as FLOAT) > 0`;
    const res1 = await axios.post(url, { query: q1 }, { headers });
    console.log(res1.data.data);
  } catch(e) {
    console.error("Error:", e.message);
  }
}
run();
