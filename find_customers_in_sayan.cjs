const fs = require('fs');

try {
  const schema = JSON.parse(fs.readFileSync('schema_output2.json', 'utf8'));
  
  // Search ACT_TBL_007
  const t7 = schema['ACT_TBL_007'] || [];
  console.log(`ACT_TBL_007 has ${t7.length} rows.`);
  
  const searchTerms = ['تندگویان', 'هوشمندان', 'گوهر بافان', 'آذربراه'];
  
  console.log("\nSearching in ACT_TBL_007 (Accounts):");
  t7.forEach((row, idx) => {
    const str = JSON.stringify(row);
    for (const term of searchTerms) {
      if (str.includes(term)) {
        console.log(`Row ${idx}:`, row);
      }
    }
  });

  // Search ACT_TBL_009 (Transactions)
  const t9 = schema['ACT_TBL_009'] || [];
  console.log(`\nACT_TBL_009 has ${t9.length} rows.`);
  t9.forEach((row, idx) => {
    const str = JSON.stringify(row);
    for (const term of searchTerms) {
      if (str.includes(term)) {
        console.log(`Row ${idx} in ACT_TBL_009:`, row);
      }
    }
  });

} catch (e) {
  console.error(e);
}
