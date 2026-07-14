const axios = require('axios');
async function run() {
  const url = 'http://80.210.31.176:5000/api/external/v1/query';
  const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' };
  
  const tables = ['GNR_TBL_012', 'ACT_TBL_012', 'ACT_TBL_013'];
  for (const t of tables) {
    try {
      const q = `SELECT * FROM ${t}`;
      const res = await axios.post(url, { query: q }, { headers });
      console.log(`--- Table ${t} ---`);
      console.log(res.data.data);
    } catch(e) {
      console.error(`Error on ${t}:`, e.message);
    }
  }
}
run();
