const fs = require('fs');
let code = fs.readFileSync('components/SayanReports.tsx', 'utf8');

const regex = /if \(matchedDetails\.length === 0\) \{\s*return \[\{\s*id: row\.Field_001,[\s\S]*?\}\];\s*\}/;

const replacement = `if (matchedDetails.length === 0) {
                matchedDetails = [{
                    _isFallback: true,
                    Field_005: '', // Product Code
                    Field_006: 0,  // Qty1
                    Field_008: 0,  // Qty2
                    Field_007: 0,  // Unit Price
                    Field_016: amount, // Total Price
                }];
            }`;

if (code.match(regex)) {
    code = code.replace(regex, replacement);
    fs.writeFileSync('components/SayanReports.tsx', code);
    console.log("Replaced matchedDetails fallback");
} else {
    console.log("No match");
}
