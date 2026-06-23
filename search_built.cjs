const fs = require('fs');
const code = fs.readFileSync('android/app/src/main/assets/public/assets/index-eifaatSU.js', 'utf8');

const pos = 1848400;
const length = 40000;
const chunk = code.substring(pos, pos + length);

fs.writeFileSync('extracted_details.js', chunk, 'utf8');
console.log('Extracted details code chunk!');
