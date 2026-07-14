const axios = require('axios');
async function run() {
  const url = 'http://80.210.31.176:5000/api/external/v1/query';
  const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' };
  
  const tables = ['GNR_TBL_012', 'GNR_TBL_013', 'COM_TBL_012', 'ACT_TBL_012', 'ACT_TBL_013', 'GNR_TBL_001'];
  for (const t of tables) {
    try {
      const q1 = `SELECT TOP 1 * FROM ${t}`;
      const res1 = await axios.post(url, { query: q1 }, { headers });
      console.log(`Table ${t}:`, Object.keys(res1.data.data[0] || {}));
      
      const q2 = `SELECT * FROM ${t} WHERE Field_001 = '1dbfc4c5-2a62-47f8-b8bf-e7ef3e3bf2e0' OR Field_002 = '1dbfc4c5-2a62-47f8-b8bf-e7ef3e3bf2e0'`;
      const res2 = await axios.post(url, { query: q2 }, { headers });
      if (res2.data.data.length > 0) {
        console.log(`FOUND ID inside ${t}:`, res2.data.data);
      }
    } catch(e) {
      // ignore table not found
    }
  }
}
run();
