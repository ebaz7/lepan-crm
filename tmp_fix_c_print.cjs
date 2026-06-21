const fs = require('fs');
let file = './components/reports/CurrencyReport.tsx';
let txt = fs.readFileSync(file, 'utf8');

const regexStyle = /<div id=\{elementId\}/sm;
const styleBlock = `<style>
    {\`
        @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            #\${elementId} th { background-color: #1e40af !important; color: white !important; border-color: #1e3a8a !important; }
            #\${elementId} tr:nth-child(even) td { background-color: #f8fafc !important; }
            #\${elementId} tr:nth-child(odd) td { background-color: #ffffff !important; }
            #\${elementId} textarea { resize: none; border: none; outline: none; background: transparent;text-align: center; }
        }
    \`}
</style>
<div id={elementId}`;

txt = txt.replace(regexStyle, styleBlock);
fs.writeFileSync(file, txt, 'utf8');
console.log('Added print styles.');
