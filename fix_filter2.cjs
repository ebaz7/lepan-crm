const fs = require('fs');
let code = fs.readFileSync('components/SayanReports.tsx', 'utf8');

const regex = /const matchesTypeSelection = currentSelected\.includes\(r\.Type\) \|\| currentSelected\.includes\(docTypeId\);\s*if \(!matchesTypeSelection\) return false;/;

const replacement = `const matchesTypeSelection = currentSelected.includes(r.Type) || currentSelected.includes(docTypeId);
            if (!matchesTypeSelection) return false;
            
            let currentStores = selectedStores;
            if (currentStores.length === 0) {
                currentStores = storesArr;
            }
            if (!currentStores.includes(r.store)) {
                // Wait! 'r.store' might be undefined because the original row doesn't have 'store' mapped!
                // Let's check if 'r.store' exists, if not we can extract it again.
                // Actually, wait, does r have 'store'?
                // The object returned by mapping has:
                // Type, Date, IsReturn, PersonName, Items... it DOES NOT have Store!
            }`;

