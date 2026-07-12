const fs = require('fs');

try {
  const schema = JSON.parse(fs.readFileSync('schema_output2.json', 'utf8'));
  const accounts = schema['ACT_TBL_007'] || [];
  console.log("Total accounts in ACT_TBL_007:", accounts.length);
  
  // Print unique names or code patterns
  const names = accounts.slice(1, 100).map(r => r[4] || r[5] || r[6] || r[3]).filter(Boolean);
  console.log("Sample of 50 account names in ACT_TBL_007:\n", names.slice(0, 50));
} catch(e) {
  console.error(e);
}
