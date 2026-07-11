const fs = require('fs');
const lines = fs.readFileSync('components/SayanReports.tsx', 'utf8').split('\n');
let inSales = false;
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("reportType === 'SALES'")) inSales = true;
    if (inSales && lines[i].includes("if (reportType === 'CUSTOMER_STATEMENT')")) break;
    if (inSales) console.log(`${i+1}: ${lines[i]}`);
}
