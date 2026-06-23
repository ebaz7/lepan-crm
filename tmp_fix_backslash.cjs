const fs = require('fs');
let s = fs.readFileSync('components/SecretariatModule.tsx', 'utf8');
s = s.replace(/\\\\\`/g, '\`');
fs.writeFileSync('components/SecretariatModule.tsx', s);

let pl = fs.readFileSync('components/print/PrintLetter.tsx', 'utf8');
pl = pl.replace(/\\\\\`/g, '\`');
fs.writeFileSync('components/print/PrintLetter.tsx', pl);
