const fs = require('fs');
const schema = JSON.parse(fs.readFileSync('schema_output2.json', 'utf8'));
console.log("IND_TBL_022:", schema['IND_TBL_022'].slice(0, 3));
console.log("IND_TBL_021:", schema['IND_TBL_021'].slice(0, 3));
console.log("IND_TBL_002:", schema['IND_TBL_002'].slice(0, 3));
