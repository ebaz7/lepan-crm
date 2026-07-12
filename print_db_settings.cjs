const fs = require('fs');
try {
  const dbContent = fs.readFileSync('database.json', 'utf8');
  const db = JSON.parse(dbContent);
  console.log("Settings:", db.settings);
} catch (e) {
  console.error("Error reading database.json:", e.message);
}
