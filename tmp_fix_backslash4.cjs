const fs = require('fs');
let pl = fs.readFileSync('components/secretariat/CreateLetterModal.tsx', 'utf8');
pl = pl.replace(/\\\`/g, '\`').replace(/\\\$/g, '$');
fs.writeFileSync('components/secretariat/CreateLetterModal.tsx', pl);

let m = fs.readFileSync('components/secretariat/LetterViewModal.tsx', 'utf8');
m = m.replace(/\\\`/g, '\`').replace(/\\\$/g, '$');
fs.writeFileSync('components/secretariat/LetterViewModal.tsx', m);
