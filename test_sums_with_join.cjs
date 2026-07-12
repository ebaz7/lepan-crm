const axios = require('axios');

async function testJoinSums() {
  const url = 'http://80.210.31.176:5000/api/external/v1/query';
  const token = 's_gate_live_vgr182bwtpoa';
  
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  };

  const code = '111147'; // شرکت پتروشیمی تندگویان

  try {
    console.log("Calculating sums in ACT_TBL_009 joined with ACT_TBL_008 for year 1404 (>= 2025-03-21)...");
    const query1404 = `
      SELECT 
        SUM(CAST(t9.Field_009 AS DECIMAL(18,2))) as DebitSum,
        SUM(CAST(t9.Field_010 AS DECIMAL(18,2))) as CreditSum
      FROM ACT_TBL_009 t9
      LEFT JOIN ACT_TBL_008 t8 ON t9.Field_003 = t8.Field_004 AND t9.Field_004 = t8.Field_005
      WHERE t9.Field_015 LIKE '%${code}%' AND t8.Field_008 >= '2025-03-21'
    `;
    const res1404 = await axios.post(url, { query: query1404 }, { headers });
    console.log("1404 Joined Sums:", res1404.data.data);

    console.log("\nTarget from Excel file: Debit = 1,618,884,345,966, Credit = 1,491,604,217,774");

  } catch (error) {
    console.error("Error:", error.message);
  }
}

testJoinSums();
