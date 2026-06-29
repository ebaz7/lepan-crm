const fs = require('fs');
const schema = JSON.parse(fs.readFileSync('schema_output2.json', 'utf8'));

console.log("=== BUR_TBL_008 (Sales) ===");
const bur = schema['BUR_TBL_008'];
if (bur) {
  const headers = bur[0];
  console.log("Headers:", headers.join(', '));
  for (let i = 1; i < Math.min(5, bur.length); i++) {
    console.log(`Row ${i}:`, bur[i].join(', '));
  }
}

console.log("\n=== BUR_TBL_002 (Persons) ===");
const bur2 = schema['BUR_TBL_002'];
if (bur2) {
  const headers = bur2[0];
  console.log("Headers:", headers.join(', '));
  for (let i = 1; i < Math.min(5, bur2.length); i++) {
    console.log(`Row ${i}:`, bur2[i].join(', '));
  }
}

console.log("\n=== ACT_TBL_003 (Ledger) ===");
const act3 = schema['ACT_TBL_003'];
if (act3) {
  const headers = act3[0];
  console.log("Headers:", headers.join(', '));
  for (let i = 1; i < Math.min(5, act3.length); i++) {
    console.log(`Row ${i}:`, act3[i].join(', '));
  }
}
