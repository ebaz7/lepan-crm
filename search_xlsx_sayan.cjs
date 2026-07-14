const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

function searchExcel(filePath) {
  try {
    const workbook = xlsx.readFile(filePath);
    const sheetNames = workbook.SheetNames;

    for (const sheetName of sheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowStr = JSON.stringify(row);
        if (rowStr.includes('112127') || rowStr.includes('متین')) {
          console.log(`[${filePath}] Match in sheet "${sheetName}" row ${i + 1}:`, row);
        }
      }
    }
  } catch (e) {
    console.error(`Error reading ${filePath}:`, e.message);
  }
}

const files = fs.readdirSync('.').filter(f => f.endsWith('.xlsx') || f.endsWith('.xls'));
console.log('Scanning Excel files:', files);
for (const file of files) {
  searchExcel(file);
}
console.log('Scan completed.');
