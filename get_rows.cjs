const fs = require('fs');
const db = JSON.parse(fs.readFileSync('schema_output2.json', 'utf8'));
const rows = db['ACT_TBL_009'];
console.log(rows[0].join('\t'));
for(let i=1; i<Math.min(rows.length, 5); i++) {
    console.log(rows[i].join('\t'));
}
