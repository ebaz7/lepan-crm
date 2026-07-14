const axios = require('axios');
async function run() {
  const url = 'http://80.210.31.176:5000/api/external/v1/query';
  const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' };
  
  try {
    const q1 = `SELECT TOP 1 * FROM ACT_TBL_008 WHERE Field_005 = '1215' AND Field_004 = '4'`;
    const res1 = await axios.post(url, { query: q1 }, { headers });
    const r1 = res1.data.data[0];
    
    const q2 = `SELECT TOP 1 * FROM ACT_TBL_008 WHERE Field_005 = '2604' AND Field_004 = '4'`;
    const res2 = await axios.post(url, { query: q2 }, { headers });
    const r2 = res2.data.data[0];
    
    for (const key in r1) {
        if (r1[key] !== r2[key]) {
            console.log(`Diff ${key}: 1215=${r1[key]} | 2604=${r2[key]}`);
        }
    }
  } catch(e) {
    console.error("Error:", e.message);
  }
}
run();
