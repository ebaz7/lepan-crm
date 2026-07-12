const axios = require('axios');

async function searchHeader() {
  const url = 'http://80.210.31.176:5000/api/external/v1/query';
  const token = 's_gate_live_vgr182bwtpoa';
  
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  };

  try {
    console.log("Searching ACT_TBL_008 for potential matching fields of LineID 17958...");
    // Let's search where any field is '3558' or '3554'
    const q1 = "SELECT * FROM ACT_TBL_008 WHERE Field_001 = '3558' OR Field_005 = '3558' OR Field_006 = '3558' OR Field_001 = '3554' OR Field_005 = '3554' OR Field_006 = '3554'";
    const res1 = await axios.post(url, { query: q1 }, { headers });
    console.log("Matches:", res1.data.data);

  } catch (error) {
    console.error("Error:", error.message);
  }
}

searchHeader();
