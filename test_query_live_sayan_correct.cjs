const axios = require('axios');

async function checkCorrectBalances() {
  const url = 'http://80.210.31.176:5000/api/external/v1/query';
  const token = 's_gate_live_vgr182bwtpoa';
  
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  };

  const code = '111147'; // شرکت پتروشیمی تندگویان

  try {
    console.log("Fetching sum of Field_009 (Debit) and Field_010 (Credit) for code 111147 in ACT_TBL_009...");
    // Let's query the sums for all time
    const queryAll = `
      SELECT 
        SUM(CAST(Field_009 AS DECIMAL(18,2))) as DebitSum,
        SUM(CAST(Field_010 AS DECIMAL(18,2))) as CreditSum
      FROM ACT_TBL_009
      WHERE Field_015 LIKE '%${code}%'
    `;
    const resAll = await axios.post(url, { query: queryAll }, { headers });
    console.log("All-time Sums:", resAll.data.data);

    // Let's also query the sums starting from the beginning of year 1404 (2025-03-21)
    console.log("\nFetching sums from 1404-01-01 (2025-03-21) onwards...");
    const query1404 = `
      SELECT 
        SUM(CAST(Field_009 AS DECIMAL(18,2))) as DebitSum,
        SUM(CAST(Field_010 AS DECIMAL(18,2))) as CreditSum
      FROM ACT_TBL_009
      WHERE Field_015 LIKE '%${code}%' AND Field_014 >= '2025-03-21'
    `;
    const res1404 = await axios.post(url, { query: query1404 }, { headers });
    console.log("1404 Sums:", res1404.data.data);

    // Let's check some sample rows to confirm
    console.log("\nSample transaction rows for 111147:");
    const sampleQuery = `
      SELECT TOP 5 
        Field_014 as [Date],
        Field_011 as [Description],
        Field_009 as [Debit],
        Field_010 as [Credit],
        Field_015 as [Codes]
      FROM ACT_TBL_009
      WHERE Field_015 LIKE '%${code}%'
      ORDER BY Field_014 DESC
    `;
    const resSample = await axios.post(url, { query: sampleQuery }, { headers });
    console.log(resSample.data.data);

  } catch (error) {
    console.error("Error:", error.message);
  }
}

checkCorrectBalances();
