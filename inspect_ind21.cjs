const fs = require('fs');
const schema = JSON.parse(fs.readFileSync('schema_output2.json', 'utf8'));
console.log("IND_TBL_021:");
console.log(JSON.stringify(schema['IND_TBL_021'] ? schema['IND_TBL_021'].slice(0, 5) : [], null, 2));
