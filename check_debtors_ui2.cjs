const fs = require('fs');
let code = fs.readFileSync('components/SayanReports.tsx', 'utf8');
let lines = code.split('\n');
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('reportType === \'DEBTORS_CREDITORS\' && data.length > 0')) {
        for (let j = i; j <= i + 40; j++) {
            console.log(lines[j]);
        }
        break;
    }
}
