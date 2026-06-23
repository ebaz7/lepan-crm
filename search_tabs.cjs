const fs = require('fs');
const code = fs.readFileSync('extracted_details.js', 'utf8');

const regex = /ee==="([a-zA-Z_]+)"/g;
let match;
while ((match = regex.exec(code)) !== null) {
  const tab = match[1];
  const startIdx = match.index;
  console.log(`Matched tab ${tab} at position ${startIdx}`);
  // Find where this block ends or print some content
  console.log(code.substring(startIdx, startIdx + 600));
  console.log('================================================================');
}
