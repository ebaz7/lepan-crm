const fs = require('fs');
let code = fs.readFileSync('components/SayanReports.tsx', 'utf8');
code = code.replace(/let runningBalance = 0;/g, '');
code = code.replace(/let printRunningBalance = 0;/g, '');
fs.writeFileSync('components/SayanReports.tsx', code);
