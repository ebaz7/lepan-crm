const fs = require('fs');

try {
  const schema = JSON.parse(fs.readFileSync('schema_output2.json', 'utf8'));
  
  if (schema['ACT_TBL_007']) {
    console.log("\n--- First 5 rows of ACT_TBL_007 ---");
    const accounts = schema['ACT_TBL_007'];
    for (let i = 0; i < Math.min(5, accounts.length); i++) {
      console.log(`Row ${i}:`, accounts[i]);
    }
  }

  if (schema['ACT_TBL_009']) {
    console.log("\n--- First 5 rows of ACT_TBL_009 ---");
    const txs = schema['ACT_TBL_009'];
    for (let i = 0; i < Math.min(5, txs.length); i++) {
      console.log(`Row ${i}:`, txs[i]);
    }
  }
} catch (e) {
  console.error(e);
}
