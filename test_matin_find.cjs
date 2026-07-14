const axios = require('axios');
async function run() {
  const url = 'http://80.210.31.176:5000/api/external/v1/query';
  const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' };
  
  try {
    const q1 = `SELECT TABLE_NAME, COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE COLUMN_NAME IN ('Field_003', 'Field_004')`;
    const res1 = await axios.post(url, { query: q1 }, { headers });
    const tables = new Set(res1.data.data.map(r => r.TABLE_NAME));
    
    for(const t of Array.from(tables).slice(0, 30)) {
        try {
            const q = `SELECT TOP 1 * FROM ${t} WHERE Field_003 = '112127' OR Field_004 = '112127'`;
            const r = await axios.post(url, { query: q }, { headers });
            if(r.data.data && r.data.data.length > 0) {
                console.log(`FOUND in ${t}`);
            }
        } catch(e) {}
    }
  } catch(e) {
    console.error("Error:", e.message);
  }
}
run();
