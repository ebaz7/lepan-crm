const fs = require('fs');
let code = fs.readFileSync('components/SayanReports.tsx', 'utf8');
let lines = code.split('\n');
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('else if (reportType === \'DEBTORS_CREDITORS\') {')) {
        for (let j = i; j <= i + 30; j++) {
            console.log(lines[j]);
        }
        break;
    }
}
