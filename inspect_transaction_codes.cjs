const axios = require('axios');

async function inspectTxs() {
  const url = 'http://80.210.31.176:5000/api/external/v1/query';
  const token = 's_gate_live_vgr182bwtpoa';
  
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  };

  try {
    console.log("Searching transactions in ACT_TBL_009 containing 'تندگویان'...");
    const q1 = "SELECT TOP 10 Field_013 as [Date], Field_010 as [Description], Field_008 as [Debit], Field_009 as [Credit], Field_014 as [Codes], Field_005, Field_006, Field_007 FROM ACT_TBL_009 WHERE Field_010 LIKE N'%تندگویان%'";
    const res1 = await axios.post(url, { query: q1 }, { headers });
    console.log("Found in Description (Field_010):", res1.data.data);

    console.log("\nSearching transactions in ACT_TBL_009 where Field_014 matches '111147' or '1147' or similar...");
    const q2 = "SELECT TOP 10 Field_013 as [Date], Field_010 as [Description], Field_008 as [Debit], Field_009 as [Credit], Field_014 as [Codes], Field_005, Field_006, Field_007 FROM ACT_TBL_009 WHERE Field_014 LIKE N'%111147%' OR Field_014 LIKE N'%1147%'";
    const res2 = await axios.post(url, { query: q2 }, { headers });
    console.log("Found in Codes (Field_014):", res2.data.data);

    console.log("\nLet's get a list of DISTINCT Field_014 values from ACT_TBL_009 to see their format...");
    const q3 = "SELECT TOP 10 DISTINCT Field_014 FROM ACT_TBL_009 WHERE Field_014 IS NOT NULL";
    const res3 = await axios.post(url, { query: q3 }, { headers });
    console.log("Distinct Field_014 format:", res3.data.data);

  } catch (error) {
    console.error("Error:", error.message);
  }
}

inspectTxs();
