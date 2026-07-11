const fs = require('fs');
const db = JSON.parse(fs.readFileSync('schema_output2.json', 'utf8'));

console.log("ACT_TBL_014 columns:", db['ACT_TBL_014'][0]);
console.log("Row 1:", db['ACT_TBL_014'][1]);
