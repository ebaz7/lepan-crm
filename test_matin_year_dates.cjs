const axios = require('axios');
async function run() {
  const url = 'http://80.210.31.176:5000/api/external/v1/query';
  const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' };
  
  const yearIds = [
    '1dbfc4c5-2a62-47f8-b8bf-e7ef3e3bf2e0',
    '79d9618e-15b3-487b-bc9b-ec23fc21d75c',
    '5ab1eddd-584e-447f-8856-10b4b86595fe',
    '0cd6777f-b6d7-4e42-9bec-e6400b85d409'
  ];
  
  for (const yid of yearIds) {
    try {
      const q = `SELECT MIN(Field_008) as MinDate, MAX(Field_008) as MaxDate FROM ACT_TBL_008 WHERE Field_013 = '${yid}'`;
      const res = await axios.post(url, { query: q }, { headers });
      console.log(`YearId ${yid}: MinGregDate = ${res.data.data[0].MinDate}, MaxGregDate = ${res.data.data[0].MaxDate}`);
    } catch(e) {
      console.error(e.message);
    }
  }
}
run();
