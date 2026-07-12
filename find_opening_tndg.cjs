const axios = require('axios');

async function findOpening() {
  const url = 'http://80.210.31.176:5000/api/external/v1/query';
  const token = 's_gate_live_vgr182bwtpoa';
  
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  };

  const code = '111147';

  try {
    console.log("Searching transactions for 111147 with large amounts in year 1404...");
    const query = `
      SELECT 
        t9.Field_001 as LineID,
        t8.Field_008 as DocDate,
        t9.Field_011 as Description,
        t9.Field_009 as Debit,
        t9.Field_010 as Credit,
        t9.Field_015 as Codes,
        t8.Field_005 as SanadNo
      FROM ACT_TBL_009 t9
      LEFT JOIN ACT_TBL_008 t8 ON t9.Field_003 = t8.Field_004 AND t9.Field_004 = t8.Field_005
      WHERE t9.Field_015 LIKE '%${code}%' AND t8.Field_008 >= '2025-03-21'
      ORDER BY t9.Field_009 DESC, t9.Field_010 DESC
    `;
    const res = await axios.post(url, { query }, { headers });
    const txs = res.data.data;
    console.log(`Found ${txs.length} transactions.`);
    
    // Check for any transaction where Credit = 86000000000 or Debit = 88228560400 or has 'افتتاحیه'
    console.log("\nSearching for opening balance or specific matching amounts...");
    txs.forEach(t => {
      const desc = String(t.Description);
      if (t.Credit === 86000000000 || t.Debit === 88228560400 || desc.includes('افتتاحیه') || desc.includes('سند افتتاحیه') || t.SanadNo == '1' || t.SanadNo == 1) {
        console.log("MATCHING TX:", t);
      }
    });

    console.log("\nTop 10 largest transactions:");
    console.log(txs.slice(0, 10));

  } catch (error) {
    console.error("Error:", error.message);
  }
}

findOpening();
