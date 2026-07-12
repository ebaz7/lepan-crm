const fs = require('fs');

function normalize(str) {
  if (!str) return '';
  return str.toString()
    .replace(/ی/g, 'ي')
    .replace(/ک/g, 'ك')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, '')
    .trim();
}

function matches(str, term) {
  return normalize(str).includes(normalize(term));
}

try {
  const schema = JSON.parse(fs.readFileSync('schema_output2.json', 'utf8'));
  
  const searchTerms = ['تضمین', 'تضامین', 'ضمانت', 'انتظامی'];
  
  for (const tableName of ['ACT_TBL_003', 'ACT_TBL_004', 'ACT_TBL_007', 'ACT_TBL_009']) {
    if (schema[tableName]) {
      console.log(`\n================== ${tableName} ==================`);
      const rows = schema[tableName];
      let matchCount = 0;
      rows.forEach((row, idx) => {
        const rowStr = JSON.stringify(row);
        let matched = false;
        for (const term of searchTerms) {
          if (matches(rowStr, term)) {
            matched = true;
            break;
          }
        }
        if (matched) {
          matchCount++;
          if (matchCount <= 20) {
            console.log(`Row ${idx}:`, row);
          }
        }
      });
      console.log(`Total matches in ${tableName}: ${matchCount}`);
    }
  }
} catch (e) {
  console.error(e);
}
