const fs = require('fs');
const https = require('https');

const url = 'https://uploadkon.ir/uploads/f0b612_26%D9%85%D8%A7%D9%86%D8%AF%D9%87-%D9%85%D8%B4%D8%AA%D8%B1%DB%8C-%D9%87%D8%A7.xlsx';
const file = fs.createWriteStream("customer_balances_new.xlsx");

console.log("Downloading from:", url);
https.get(url, function(response) {
  if (response.statusCode !== 200) {
    console.error(`Failed to download: Status Code ${response.statusCode}`);
    return;
  }
  response.pipe(file);
  file.on('finish', function() {
    file.close(() => {
      console.log("Download completed!");
      // Let's read it with xlsx if installed
      try {
        const XLSX = require('xlsx');
        const workbook = XLSX.readFile("customer_balances_new.xlsx");
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet);
        console.log(`Found ${rows.length} rows in the sheet.`);
        console.log("First 5 rows:", rows.slice(0, 5));
      } catch (err) {
        console.error("Error reading with xlsx:", err.message);
      }
    });
  });
}).on('error', function(err) {
  console.error("Error downloading file:", err.message);
});
