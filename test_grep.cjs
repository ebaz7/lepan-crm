const fs = require('fs');
const lines = fs.readFileSync('components/SayanReports.tsx', 'utf8').split('\n');
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('}).filter((r: any) => {')) {
        for (let j = i; j < i + 15; j++) {
            console.log(lines[j]);
        }
        break;
    }
}
