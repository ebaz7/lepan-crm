const axios = require('axios');

async function testSayan() {
  const baseUrl = 'http://80.210.31.176:5000/api/external/v1';
  const token = 's_gate_live_vgr182bwtpoa';
  
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  };

  const endpoints = ['/sql', '/query'];

  for (const ep of endpoints) {
    const url = baseUrl + ep;
    console.log(`\n--- Testing endpoint: ${url} ---`);
    try {
      // Search accounts (ACT_TBL_007) for our keywords
      const accountsQuery = "SELECT TOP 10 Field_003, Field_004, Field_005, Field_006 FROM ACT_TBL_007 WHERE Field_006 LIKE N'%تندگویان%'";
      const res = await axios.post(url, { query: accountsQuery, sql: accountsQuery }, { headers });
      console.log("Success on " + ep + ":");
      console.log(res.data);
      
      // Let's also fetch general counts and schemas of ACT_TBL_009
      console.log("Checking transaction count in ACT_TBL_009 for year 1404...");
      const countQuery = "SELECT COUNT(*) as cnt FROM ACT_TBL_009 WHERE Field_013 >= '2025-03-21'";
      const countRes = await axios.post(url, { query: countQuery, sql: countQuery }, { headers });
      console.log("Count from 1404:", countRes.data);
      return; // Stop if successful
    } catch (error) {
      console.error(`Failed on endpoint ${ep}:`, error.message);
      if (error.response) {
        console.error(`Response data on ${ep}:`, error.response.data);
      }
    }
  }
}

testSayan();
