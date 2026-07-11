const fs = require('fs');
const code = fs.readFileSync('components/SayanReports.tsx', 'utf8');

// Find lines with "if (reportType" or "else if" inside fetchReportData
const lines = code.split('\n');
let inside = false;
for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('const fetchReportData =')) {
        inside = true;
    }
    if (inside) {
        if (line.includes('if (') || line.includes('else if') || line.includes('sqlQuery =')) {
            console.log(`${i+1}: ${line}`);
        }
        if (line.includes('const exportData =')) {
            inside = false;
        }
    }
}
