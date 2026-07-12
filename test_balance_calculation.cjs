const axios = require('axios');

async function testBalance() {
  const url = 'http://80.210.31.176:5000/api/external/v1/query';
  const token = 's_gate_live_vgr182bwtpoa';
  
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  };

  try {
    const code = '111147'; // شرکت پتروشیمی تندگویان

    // Let's inspect some transactions of 111147 in 1404 to see what columns they have and how codes are stored
    console.log("Inspecting a few transactions for 111147 in ACT_TBL_009...");
    const sampleQuery = `SELECT TOP 5 Field_013 as [Date], Field_010 as [Description], Field_008 as [Debit], Field_009 as [Credit], Field_014 as [Codes] FROM ACT_TBL_009 WHERE Field_014 LIKE '%${code}%' AND Field_013 >= '2025-03-21'`;
    const sampleRes = await axios.post(url, { query: sampleQuery }, { headers });
    console.log("Sample 1404 transactions:", sampleRes.data.data);

    // Let's calculate the balance for 111147 in 1404 (date >= '2025-03-21')
    console.log("\nCalculating balance for 111147 in year 1404 (date >= 2025-03-21)...");
    const balQuery1404 = `SELECT SUM(CAST(Field_008 AS DECIMAL(18,2))) as Debit, SUM(CAST(Field_009 AS DECIMAL(18,2))) as Credit FROM ACT_TBL_009 WHERE Field_014 LIKE '%${code}%' AND Field_013 >= '2025-03-21'`;
    const res1404 = await axios.post(url, { query: balQuery1404 }, { headers });
    console.log("1404 Balance:", res1404.data.data);

    // Let's calculate the balance for 111147 for ALL time
    console.log("\nCalculating balance for 111147 for ALL time...");
    const balQueryAll = `SELECT SUM(CAST(Field_008 AS DECIMAL(18,2))) as Debit, SUM(CAST(Field_009 AS DECIMAL(18,2))) as Credit FROM ACT_TBL_009 WHERE Field_014 LIKE '%${code}%'`;
    const resAll = await axios.post(url, { query: balQueryAll }, { headers });
    console.log("All-time Balance:", resAll.data.data);

  } catch (error) {
    console.error("Error:", error.message);
  }
}

testBalance();
