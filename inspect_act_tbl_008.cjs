const axios = require('axios');

async function inspect008() {
  const url = 'http://80.210.31.176:5000/api/external/v1/query';
  const token = 's_gate_live_vgr182bwtpoa';
  
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  };

  try {
    console.log("Fetching TOP 5 rows of ACT_TBL_008 (Document Headers)...");
    const q1 = "SELECT TOP 5 * FROM ACT_TBL_008";
    const res1 = await axios.post(url, { query: q1 }, { headers });
    console.log("ACT_TBL_008 Rows:", JSON.stringify(res1.data.data, null, 2));

  } catch (error) {
    console.error("Error:", error.message);
  }
}

inspect008();
