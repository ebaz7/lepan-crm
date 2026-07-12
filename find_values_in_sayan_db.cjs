const fs = require('fs');
const XLSX = require('xlsx');

const searchTerms = ['تندگویان', 'هوشمندان', 'گوهر بافان', 'آذربراه'];
const searchNumbers = [1618884345966, 1491604217774, 127280128192, 1106000000];

function checkFile(filename) {
  console.log(`\n=================== Checking ${filename} ===================`);
  if (!fs.existsSync(filename)) {
    console.log(`${filename} does not exist.`);
    return;
  }
  const wb = XLSX.readFile(filename);
  wb.SheetNames.forEach(sheetName => {
    const sheet = wb.Sheets[sheetName];
    // We can search the text representations
    const csv = XLSX.utils.sheet_to_csv(sheet);
    let found = false;
    
    for (const term of searchTerms) {
      if (csv.includes(term)) {
        console.log(`  - Found term "${term}" in sheet [${sheetName}]`);
        found = true;
      }
    }
    
    for (const num of searchNumbers) {
      if (csv.includes(String(num)) || csv.includes(num.toLocaleString('en-US')) || csv.includes(num.toLocaleString('fa-IR'))) {
        console.log(`  - Found number "${num}" in sheet [${sheetName}]`);
        found = true;
      }
    }
  });
}

checkFile('Sayan_DB_Proper.xlsx');
checkFile('Sayan_DB.xlsx');
