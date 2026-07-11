const fs = require('fs');
let code = fs.readFileSync('components/SayanReports.tsx', 'utf8');

const debtorsRegex = /const grouped: Record<string, any> = \{\};\s*finalData\.forEach\(\(row: any\) => \{[\s\S]*?\}\);\s*const processed = Object\.values\(grouped\)\.map\(\(row: any\) => \{\s*const net = row\.Debit - row\.Credit;\s*return \{\s*\.\.\.row,\s*NetBalance: Math\.abs\(net\),\s*Type: net > 0 \? 'بدهکار' : \(net < 0 \? 'بستانکار' : 'تسویه'\)\s*\};\s*\}\)\.filter\(r => r\.NetBalance > 0\)\.sort\(\(a, b\) => b\.NetBalance - a\.NetBalance\);/g;

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
                
                if (isAfterEnd) return; // Ignore future transactions

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
                    Debit: row.PeriodDebit, // using for UI period totals
                    Credit: row.PeriodCredit,
                    OpeningBalance: openingBalance,
                    NetBalance: Math.abs(net),
                    Type: net > 0 ? 'بدهکار' : net < 0 ? 'بستانکار' : 'تسویه',
                    RawBalance: net
                };
            }).filter((row: any) => row.NetBalance > 0 || row.Debit > 0 || row.Credit > 0).sort((a, b) => b.NetBalance - a.NetBalance);`;

if (code.match(debtorsRegex)) {
    code = code.replace(debtorsRegex, newDebtorsLogic);
    fs.writeFileSync('components/SayanReports.tsx', code);
    console.log("Debtors replaced");
} else {
    console.log("Debtors not matched");
}
