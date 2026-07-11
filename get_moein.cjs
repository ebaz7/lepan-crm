const fs = require('fs');
const db = JSON.parse(fs.readFileSync('schema_output2.json', 'utf8'));
const rows = db['ACT_TBL_003'];
for(let i=1; i<rows.length; i++) {
    console.log(rows[i].join('\t'));
}
