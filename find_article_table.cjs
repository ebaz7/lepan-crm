const fs = require('fs');
const db = JSON.parse(fs.readFileSync('schema_output2.json', 'utf8'));
for (const [table, rows] of Object.entries(db)) {
    if (table.startsWith('ACT_') && rows && rows.length > 1) {
        console.log(table, "=>");
        console.log("  Cols:", rows[0].join(', '));
        console.log("  Row 1:", rows[1].join(', '));
    }
}
