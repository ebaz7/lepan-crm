const axios = require('axios');
async function run() {
  const url = 'http://80.210.31.176:5000/api/external/v1/query';
  const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' };
  
  try {
    const q1 = `SELECT 
      t9.Field_001,
      COUNT(t8.Field_001) as NumMatches
      FROM ACT_TBL_009 t9
      LEFT JOIN ACT_TBL_008 t8 ON t8.Field_004 = t9.Field_003 AND t8.Field_005 = t9.Field_004
      WHERE (t9.Field_015 LIKE '%:112127-%' OR t9.Field_015 LIKE '%-112127-%' OR t9.Field_015 LIKE '%:112127' OR t9.Field_015 LIKE '112127:%')
      GROUP BY t9.Field_001
      HAVING COUNT(t8.Field_001) > 1
      `;
    const res1 = await axios.post(url, { query: q1 }, { headers });
    console.log("Duplicated joins:", res1.data.data.length);
    if(res1.data.data.length > 0) {
        console.log(res1.data.data[0]);
    }
  } catch(e) {
    console.error("Error:", e.response?.data || e.message);
  }
}
run();
