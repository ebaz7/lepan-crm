const axios = require('axios');

async function inspectTndgRow() {
  const url = 'http://80.210.31.176:5000/api/external/v1/query';
  const token = 's_gate_live_vgr182bwtpoa';
  
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  };

  try {
    console.log("Inspecting full columns of 111147 transactions in ACT_TBL_009...");
    const query = "SELECT TOP 3 * FROM ACT_TBL_009 WHERE Field_015 LIKE '%111147%'";
    const res = await axios.post(url, { query }, { headers });
    console.log(JSON.stringify(res.data.data, null, 2));

  } catch (error) {
    console.error("Error:", error.message);
  }
}

inspectTndgRow();
