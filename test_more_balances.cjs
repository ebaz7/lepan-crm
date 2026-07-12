const axios = require('axios');

async function testMoreBalances() {
  const url = 'http://80.210.31.176:5000/api/external/v1/query';
  const token = 's_gate_live_vgr182bwtpoa';
  
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  };

  try {
    // 1. Find some other customers in ACT_TBL_007
    console.log("Finding some customer account codes...");
    const accQuery = `
      SELECT TOP 50 Field_003, Field_006 
      FROM ACT_TBL_007 
      WHERE Field_006 LIKE N'%هوشمندان%' OR Field_006 LIKE N'%گوهر بافان%' OR Field_006 LIKE N'%آذربراه%'
    `;
    const accRes = await axios.post(url, { query: accQuery }, { headers });
    const accounts = accRes.data.data;
    console.log("Found accounts:", accounts);

    for (const acc of accounts) {
      const code = acc.Field_003;
      const name = acc.Field_006;
      console.log(`\n------------------ Customer: ${name} (${code}) ------------------`);
      
      // Calculate sums with the exact same filter rules:
      // - Date >= '2025-03-21'
      // - Exclude guarantee (تضمین, تضامین, ضمانت, انتظامی, تعهدات, وثیقه)
      // - Exclude opening description ("بابت افتتاحیه حساب ها")
      const sumsQuery = `
        SELECT 
          SUM(CAST(t9.Field_009 AS DECIMAL(18,2))) as DebitSum,
          SUM(CAST(t9.Field_010 AS DECIMAL(18,2))) as CreditSum
        FROM ACT_TBL_009 t9
        LEFT JOIN ACT_TBL_008 t8 ON t9.Field_003 = t8.Field_004 AND t9.Field_004 = t8.Field_005
        WHERE t9.Field_015 LIKE '%${code}%'
          AND t8.Field_008 >= '2025-03-21'
          AND t9.Field_011 NOT LIKE N'%تضمین%'
          AND t9.Field_011 NOT LIKE N'%تضامین%'
          AND t9.Field_011 NOT LIKE N'%ضمانت%'
          AND t9.Field_011 NOT LIKE N'%انتظامی%'
          AND t9.Field_011 NOT LIKE N'%تعهدات%'
          AND t9.Field_011 NOT LIKE N'%وثیقه%'
          AND t9.Field_011 NOT LIKE N'%افتتاحیه حساب%'
      `;
      const sumsRes = await axios.post(url, { query: sumsQuery }, { headers });
      console.log("Calculated Flow:", sumsRes.data.data);
    }

  } catch (error) {
    console.error("Error:", error.message);
  }
}

testMoreBalances();
