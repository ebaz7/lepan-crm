const fs = require('fs');
let file = './components/reports/CurrencyReport.tsx';
let txt = fs.readFileSync(file, 'utf8');

const errorStyleRegex = /<style>[\s\S]*?<\/style>\s*<div id=\{elementId\}/sm;
const fixedBlock = `<div id={elementId} 
             data-print-wrapper="true"
             className="printable-content p-4 text-black text-[10px] relative border-black" 
             style={{
                 backgroundColor: '#ffffff',
                 color: '#000000',
                 width: '296mm', 
                 minHeight: '210mm',
                 margin: '0 auto',
                 boxSizing: 'border-box',
                 direction: 'rtl'
             }}
         >
         <style>
             {\`
                 @media print {
                     body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                     #\${elementId} th { background-color: #1e40af !important; color: white !important; border-color: #1e3a8a !important; }
                     #\${elementId} tr { break-inside: avoid; }
                     #\${elementId} thead { display: table-header-group; }
                     #\${elementId} tr:nth-child(even) td { background-color: #f8fafc !important; }
                     #\${elementId} tr:nth-child(odd) td { background-color: #ffffff !important; }
                     #\${elementId} textarea { resize: none; border: none; outline: none; background: transparent;text-align: center; }
                 }
             \`}
         </style>`;

txt = txt.replace(errorStyleRegex, `<div id={elementId}`); // Remove the error one entirely
txt = txt.replace(/<div id=\{elementId\} className="printable-content[\s\S]*?direction: 'rtl'\n\s*\}\}\n\s*>/sm, fixedBlock);

fs.writeFileSync(file, txt, 'utf8');
console.log('Fixed style block scoping');
