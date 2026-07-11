const fs = require('fs');
let code = fs.readFileSync('components/SayanReports.tsx', 'utf8');

const debtorsRegex = /const grouped: Record<string, any> = \{\};\s*finalData\.forEach\(\(row: any\) => \{[\s\S]*?if \(!customerCode\) return;\s*const name = accountMap\[customerCode\] \|\| `شخص \$\{customerCode\}`;\s*if \(!grouped\[name\]\) grouped\[name\] = \{ AccountName: name, Debit: 0, Credit: 0 \};\s*const v1 = parseFloat\(row\.Debit \|\| row\.Field_009 \|\| 0\) \|\| 0;\s*const v2 = parseFloat\(row\.Credit \|\| row\.Field_010 \|\| 0\) \|\| 0;\s*grouped\[name\]\.Debit \+= v1;\s*grouped\[name\]\.Credit \+= v2;\s*\}\);\s*const processed = Object\.values\(grouped\)\.map\(\(row: any\) => \{\s*const net = row\.Debit - row\.Credit;\s*return \{\s*\.\.\.row,\s*Balance: net,\s*Type: net > 0 \? 'بدهکار' : net < 0 \? 'بستانکار' : 'بی‌حساب'\s*\};\s*\}\);/g;

const newDebtorsLogic = `
            const grouped: Record<string, any> = {};
            finalData.forEach((row: any) => {
                const date = row.Date || row.Field_014;
                let isBeforeStart = false;
                let isAfterEnd = false;
                
                if (date) {
                    const dObj = new Date(date);
                    const sObj = startIso ? new Date(startIso) : null;
                    const eObj = endIso ? new Date(endIso) : null;
                    if (sObj && dObj < sObj) isBeforeStart = true;
                    if (eObj && dObj > eObj) isAfterEnd = true;
                }
                
                if (isAfterEnd) return; // Completely ignore future transactions

                const codesStr = String(row.Codes || row.Field_015 || row.Details || '');
                let customerCode = null;
                const parts = codesStr.split(/[\\:\\-]/);
                for (const p of parts) {
                    if (customerCodesSet.has(p)) {
                        customerCode = p;
                        break;
                    }
                }
                if (!customerCode) return;
                
                const name = accountMap[customerCode] || \`شخص \${customerCode}\`;
                
                if (!grouped[name]) {
                    grouped[name] = { AccountName: name, OpeningDebit: 0, OpeningCredit: 0, PeriodDebit: 0, PeriodCredit: 0, Code: customerCode };
                }
                
                const v1 = parseFloat(row.Debit || row.Field_009 || 0) || 0;
                const v2 = parseFloat(row.Credit || row.Field_010 || 0) || 0;
                
                if (isBeforeStart) {
                    grouped[name].OpeningDebit += v1;
                    grouped[name].OpeningCredit += v2;
                } else {
                    grouped[name].PeriodDebit += v1;
                    grouped[name].PeriodCredit += v2;
                }
            });
            
            const processed = Object.values(grouped).map((row: any) => {
                const openingBalance = row.OpeningDebit - row.OpeningCredit;
                const periodNet = row.PeriodDebit - row.PeriodCredit;
                const net = openingBalance + periodNet;
                return {
                    ...row,
                    Debit: row.PeriodDebit, // Map to existing UI fields for now
                    Credit: row.PeriodCredit,
                    OpeningBalance: openingBalance,
                    Balance: net,
                    Type: net > 0 ? 'بدهکار' : net < 0 ? 'بستانکار' : 'بی‌حساب'
                };
            }).filter((row: any) => row.Balance !== 0 || row.Debit !== 0 || row.Credit !== 0);`;

if (code.match(debtorsRegex)) {
    code = code.replace(debtorsRegex, newDebtorsLogic);
    console.log("Debtors replaced");
} else {
    console.log("Debtors not matched");
}
fs.writeFileSync('components/SayanReports.tsx', code);
