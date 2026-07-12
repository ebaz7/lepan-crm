const fs = require('fs');

try {
  const schema = JSON.parse(fs.readFileSync('schema_output2.json', 'utf8'));
  const txs = schema['ACT_TBL_009'] || [];
  console.log(`Total transactions in ACT_TBL_009: ${txs.length}`);
  
  if (txs.length > 1) {
    const dates = txs.slice(1).map(r => r[12]).filter(Boolean);
    console.log(`Min date: ${dates.reduce((min, p) => p < min ? p : min, dates[0])}`);
    console.log(`Max date: ${dates.reduce((max, p) => p > max ? p : max, dates[0])}`);
    
    // Check for dates >= '2025-03-21'
    const after1404 = txs.slice(1).filter(r => r[12] && r[12] >= '2025-03-21');
    console.log(`Transactions from 1404-01-01 (2025-03-21) onwards: ${after1404.length}`);
    if (after1404.length > 0) {
      console.log("Sample 1404 transaction:", after1404[0]);
    }
  }
} catch (e) {
  console.error(e);
}
