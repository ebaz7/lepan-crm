const axios = require('axios');
async function run() {
  const url = 'http://80.210.31.176:5000/api/external/v1/query';
  const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' };
  
  const ids = [
    '1dbfc4c5-2a62-47f8-b8bf-e7ef3e3bf2e0',
    '79d9618e-15b3-487b-bc9b-ec23fc21d75c',
    '5ab1eddd-584e-447f-8856-10b4b86595fe',
    '0cd6777f-b6d7-4e42-9bec-e6400b85d409'
  ];
  
  const tableCols = {
    'GNR_TBL_012': ['Field_001', 'Field_003', 'Field_004', 'Field_005'],
    'ACT_TBL_012': ['Field_001', 'Field_003', 'Field_004', 'Field_005', 'Field_006', 'Field_007', 'Field_008'],
    'ACT_TBL_013': ['Field_001', 'Field_003', 'Field_004', 'Field_005', 'Field_006', 'Field_007', 'Field_008', 'Field_009']
  };
  
  for (const [t, cols] of Object.entries(tableCols)) {
    try {
      for (const id of ids) {
        const clauses = cols.map(c => `${c} = '${id}'`).join(' OR ');
        const q = `SELECT * FROM ${t} WHERE ${clauses}`;
        const res = await axios.post(url, { query: q }, { headers });
        if (res.data.data.length > 0) {
          console.log(`FOUND in ${t} for ${id}:`, res.data.data);
        }
      }
    } catch(e) {
      console.error(`Error on ${t}:`, e.response?.data || e.message);
    }
  }
}
run();
