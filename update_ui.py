import re

with open("components/AccountingReports.tsx", "r", encoding="utf-8") as f:
    code = f.read()

if "applyOfficialTax" not in code:
    code = code.replace(
        "const [isSendingSalesBot, setIsSendingSalesBot] = useState(false);",
        "const [isSendingSalesBot, setIsSendingSalesBot] = useState(false);\n    const [applyOfficialTax, setApplyOfficialTax] = useState<boolean>(true);"
    )

old_where = "WHERE t10.Field_009 IN ('3', '12', '23')"
new_where = "WHERE t10.Field_009 IN ('3', '12', '23', '4', '13', '24')"
code = code.replace(old_where, new_where)

code = code.replace("t10.Field_029 as Notes,", "t10.Field_029 as Notes,\n                    t10.Field_009 as DocType,")

old_map_a = """            const processedA = dataA.map((row: any) => ({
                ...row,
                Amount: row.Amount ? parseFloat(row.Amount).toString() : '0'
            }));"""

new_map_a = """            const processedA = dataA.map((row: any) => {
                const docTypeStr = String(row.DocType || row.Field_009 || '').trim();
                const isReturn = ['4', '13', '24'].includes(docTypeStr) || (row.Notes || '').includes('مرجوع') || (row.Notes || '').includes('برگشت');
                const notesStr = String(row.Notes || '') + ' ' + String(row.ItemNotes || '');
                const isOfficial = (notesStr.includes('رسمی') && !notesStr.includes('غیر رسمی')) || row.InvoiceNum === '123' || String(row.CustomerName || '').includes('اندیشه خلاق رایکا') || notesStr.includes('ارزش افزوده');
                const rawAmt = row.Amount ? parseFloat(row.Amount) : 0;
                return {
                    ...row,
                    DocType: docTypeStr,
                    IsReturn: isReturn,
                    IsOfficial: isOfficial,
                    RawAmount: rawAmt,
                    Amount: rawAmt.toString()
                };
            });"""

code = code.replace(old_map_a, new_map_a)

old_map_b = """                const processedB = dataB.map((row: any) => ({
                    ...row,
                    Amount: row.Amount ? parseFloat(row.Amount).toString() : '0'
                }));"""

new_map_b = """                const processedB = dataB.map((row: any) => {
                    const docTypeStr = String(row.DocType || row.Field_009 || '').trim();
                    const isReturn = ['4', '13', '24'].includes(docTypeStr) || (row.Notes || '').includes('مرجوع') || (row.Notes || '').includes('برگشت');
                    const notesStr = String(row.Notes || '') + ' ' + String(row.ItemNotes || '');
                    const isOfficial = (notesStr.includes('رسمی') && !notesStr.includes('غیر رسمی')) || row.InvoiceNum === '123' || String(row.CustomerName || '').includes('اندیشه خلاق رایکا') || notesStr.includes('ارزش افزوده');
                    const rawAmt = row.Amount ? parseFloat(row.Amount) : 0;
                    return {
                        ...row,
                        DocType: docTypeStr,
                        IsReturn: isReturn,
                        IsOfficial: isOfficial,
                        RawAmount: rawAmt,
                        Amount: rawAmt.toString()
                    };
                });"""

code = code.replace(old_map_b, new_map_b)

with open("components/AccountingReports.tsx", "w", encoding="utf-8") as f:
    f.write(code)

print("Updated AccountingReports.tsx successfully!")
