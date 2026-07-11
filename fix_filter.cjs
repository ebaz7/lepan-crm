const fs = require('fs');
let code = fs.readFileSync('components/SayanReports.tsx', 'utf8');

const regex = /const matchesTypeSelection = selectedSalesTypes\.includes\(r\.Type\) \|\| selectedSalesTypes\.includes\(docTypeId\);\s*if \(!matchesTypeSelection\) return false;/;

const replacement = `let currentSelected = selectedSalesTypes;
            if (currentSelected.length === 0) {
                 const likelySales = typesArr.filter(t => (t.includes('فروش') || t.includes('مرجوع') || t.includes('برگشت') || t.includes('فاکتور')) && !t.includes('پیش فاکتور'));
                 currentSelected = likelySales.length > 0 ? likelySales : typesArr;
            }
            const matchesTypeSelection = currentSelected.includes(r.Type) || currentSelected.includes(docTypeId);
            if (!matchesTypeSelection) return false;`;

if (code.match(regex)) {
    code = code.replace(regex, replacement);
    fs.writeFileSync('components/SayanReports.tsx', code);
    console.log("Replaced filter logic");
} else {
    console.log("No match");
}
