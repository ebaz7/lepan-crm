const fs = require('fs');
let code = fs.readFileSync('components/SayanReports.tsx', 'utf8');
let lines = code.split('\n');
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('const grouped: Record<string, any> = {};')) {
        for (let j = i; j <= i + 35; j++) {
            console.log(lines[j]);
        }
        break;
    }
}
