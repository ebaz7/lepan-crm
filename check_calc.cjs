const fs = require('fs');
let code = fs.readFileSync('components/SayanReports.tsx', 'utf8');
let lines = code.split('\n');
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('// Calculate running balance')) {
        for (let j = i - 10; j <= i + 15; j++) {
            console.log(lines[j]);
        }
        break;
    }
}
