const fs = require('fs');
let code = fs.readFileSync('components/SayanReports.tsx', 'utf8');

const regex = /const matchesTypeSelection = currentSelected\.includes\(r\.Type\) \|\| currentSelected\.includes\(docTypeId\);\s*if \(!matchesTypeSelection\) return false;/;

const replacement = `const matchesTypeSelection = currentSelected.includes(r.Type) || currentSelected.includes(docTypeId);
            if (!matchesTypeSelection) return false;
            
            // Check Store Selection
            let currentStores = selectedStores;
            if (currentStores.length === 0) {
                currentStores = availableStores.length > 0 ? availableStores : storesArr;
            }
            const storeId = String(r.Field_005 || r.Field_006 || '').trim();
            const rStoreName = storeId ? (storeMap[storeId] || \`انبار \${storeId}\`) : 'انبار نامشخص';
            if (currentStores.length > 0 && !currentStores.includes(rStoreName)) {
                 return false;
            }`;

if (code.match(regex)) {
    code = code.replace(regex, replacement);
    fs.writeFileSync('components/SayanReports.tsx', code);
    console.log("Replaced stores logic");
} else {
    console.log("No match");
}
