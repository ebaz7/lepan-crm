const fs = require('fs');
let code = fs.readFileSync('components/SayanReports.tsx', 'utf8');

// For CUSTOMER_STATEMENT
const statementRegex = /const processed = finalData\.map\(\(row: any\) => \{[\s\S]*?\}\)\.filter\(Boolean\)\.filter\(\(r: any\) => isDateInRange\(r\.Date\)\);\s*\/\/ Calculate running balance\s*let run = 0;\s*const finalCust = processed\.reverse\(\)\.map\(\(r: any\) => \{\s*run \+= r\.Balance;\s*return \{ \.\.\.r, Balance: run \};\s*\}\);\s*setCustomerDetails\(finalCust\.reverse\(\)\);/g;

const newStatementLogic = `
                let openingBalance = 0;
                const periodRows: any[] = [];
                
                finalData.forEach((row: any) => {
                    const codesStr = String(row.Codes || row.Field_015 || row.Details || '');
                    let matches = false;
                    if (targetCode) {
                        const parts = codesStr.split(/[\\:\\-]/);
                        if (parts.includes(targetCode)) matches = true;
                    } else {
                        const desc = String(row.Description || row.Field_011 || '');
                        if (desc.includes(selectedCustomer)) matches = true;
                    }
                    if (!matches) return;

                    const d = parseFloat(row.Debit || row.Field_009 || 0) || 0;
                    const c = parseFloat(row.Credit || row.Field_010 || 0) || 0;
                    const date = row.Date || row.Field_014;
                    
                    if (date) {
                        const dObj = new Date(date);
                        const sObj = startIso ? new Date(startIso) : null;
                        const eObj = endIso ? new Date(endIso) : null;
                        
                        // Sayan Dates are usually ISO. Check if strictly before start date
                        if (sObj && dObj < sObj) {
                             openingBalance += (d - c);
                        } else if ((!sObj || dObj >= sObj) && (!eObj || dObj <= eObj)) {
                             periodRows.push({
                                Date: date,
                                Description: row.Description || row.Field_011,
                                SanadNumber: row.SanadNumber || row.Field_013,
                                Debit: d,
                                Credit: c,
                                Balance: d - c
                             });
                        }
                    } else {
                        // If no date at all, assume past? Let's just put it in period
                        periodRows.push({
                            Date: date,
                            Description: row.Description || row.Field_011,
                            SanadNumber: row.SanadNumber || row.Field_013,
                            Debit: d,
                            Credit: c,
                            Balance: d - c
                         });
                    }
                });
                
                // Calculate running balance
                let run = openingBalance;
                
                // periodRows are currently DESC from DB. So reverse them to ASC for running balance
                const ascRows = periodRows.reverse();
                
                const finalCust = ascRows.map((r: any) => {
                    run += r.Balance;
                    return { ...r, Balance: run };
                });
                
                // Add Opening Balance as a first row
                if (openingBalance !== 0 || finalCust.length === 0) {
                     finalCust.unshift({
                         Date: '',
                         Description: 'مانده از قبل',
                         SanadNumber: '-',
                         Debit: openingBalance > 0 ? openingBalance : 0,
                         Credit: openingBalance < 0 ? Math.abs(openingBalance) : 0,
                         Balance: openingBalance,
                         isOpening: true
                     });
                }
                
                setCustomerDetails(finalCust.reverse());`; // reverse back to DESC for UI

if (code.match(statementRegex)) {
    code = code.replace(statementRegex, newStatementLogic);
    console.log("Statement replaced");
} else {
    console.log("Statement not matched");
    fs.writeFileSync('debug_stmt.txt', code);
}
fs.writeFileSync('components/SayanReports.tsx', code);
