const axios = require('axios');

async function testJoinV2() {
  const url = 'http://80.210.31.176:5000/api/external/v1/query';
  const token = 's_gate_live_vgr182bwtpoa';
  
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  };

  try {
    console.log("Testing join V2 (Year ID and Sanad Number)...");
    const joinQuery = `
      SELECT TOP 5 
        t9.Field_001 as LineID,
        t9.Field_011 as Description,
        t9.Field_009 as Debit,
        t9.Field_010 as Credit,
        t9.Field_015 as Codes,
        t8.Field_008 as DocDate
      FROM ACT_TBL_009 t9
      LEFT JOIN ACT_TBL_008 t8 ON t9.Field_003 = t8.Field_004 AND t9.Field_004 = t8.Field_005
      WHERE t9.Field_001 IN ('35', '36', '41', '17958')
    `;
    const res = await axios.post(url, { query: joinQuery }, { headers });
    console.log("Join V2 Results:", JSON.stringify(res.data.data, null, 2));

  } catch (error) {
    console.error("Error:", error.message);
  }
}

testJoinV2();
