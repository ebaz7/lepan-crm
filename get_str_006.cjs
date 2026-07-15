const fs = require('fs');
const schema = JSON.parse(fs.readFileSync('schema_output2.json', 'utf8'));

// Check STR tables for short reference tables
console.log(schema['STR_TBL_006'].map(row => row.slice(0, 3)).join('\n'));
