const fs = require('fs');
const schema = JSON.parse(fs.readFileSync('schema_output2.json', 'utf8'));

// Check STR tables for short reference tables
for (let key of Object.keys(schema)) {
    if (key.startsWith('STR_') && schema[key].length > 1) {
        console.log(`Table ${key}, rows: ${schema[key].length}, sample:`, schema[key][1]);
    }
}
