const fs = require('fs');
let code = fs.readFileSync('components/SayanReports.tsx', 'utf8');

const regex1 = /sqlQuery = `SELECT TOP 20000 Field_014 as \[Date\], Field_011 as \[Description\], Field_009 as \[Debit\], Field_010 as \[Credit\], Field_015 as \[Codes\], Field_013 as \[SanadNumber\], Field_018 as \[Details\], Field_005, Field_006, Field_007 FROM ACT_TBL_009 WHERE Field_005 != '9' AND Field_003 = '4' ORDER BY Field_014 DESC`;/g;

const replacement1 = "sqlQuery = `SELECT TOP 30000 COALESCE(t1a.Field_008, t1b.Field_008) as [Date], t2.Field_011 as [Description], t2.Field_009 as [Debit], t2.Field_010 as [Credit], t2.Field_015 as [Codes], t2.Field_013 as [SanadNumber], t2.Field_018 as [Details], t2.Field_005, t2.Field_006, t2.Field_007 FROM ACT_TBL_009 t2 LEFT JOIN ACT_TBL_008 t1a ON t2.Field_003 = '4' AND t2.Field_004 = t1a.Field_001 LEFT JOIN ACT_TBL_008 t1b ON (t2.Field_003 = '2' OR t2.Field_003 = '3') AND t2.Field_004 = t1b.Field_005 AND t2.Field_003 = t1b.Field_004 WHERE t2.Field_005 != '9' ORDER BY COALESCE(t1a.Field_008, t1b.Field_008) DESC`;";

const regex2 = /sqlQuery = `SELECT TOP 20000 Field_014 as \[Date\], Field_011 as \[Description\], Field_009 as \[Debit\], Field_010 as \[Credit\], Field_015 as \[Codes\], Field_013 as \[SanadNumber\], Field_018 as \[Details\], Field_005, Field_006, Field_007 FROM ACT_TBL_009 WHERE Field_005 != '9' AND Field_003 = '4' ORDER BY Field_014 ASC`;/g;

const replacement2 = "sqlQuery = `SELECT TOP 30000 COALESCE(t1a.Field_008, t1b.Field_008) as [Date], t2.Field_011 as [Description], t2.Field_009 as [Debit], t2.Field_010 as [Credit], t2.Field_015 as [Codes], t2.Field_013 as [SanadNumber], t2.Field_018 as [Details], t2.Field_005, t2.Field_006, t2.Field_007 FROM ACT_TBL_009 t2 LEFT JOIN ACT_TBL_008 t1a ON t2.Field_003 = '4' AND t2.Field_004 = t1a.Field_001 LEFT JOIN ACT_TBL_008 t1b ON (t2.Field_003 = '2' OR t2.Field_003 = '3') AND t2.Field_004 = t1b.Field_005 AND t2.Field_003 = t1b.Field_004 WHERE t2.Field_005 != '9' ORDER BY COALESCE(t1a.Field_008, t1b.Field_008) ASC`;";

const regex3 = /sqlQuery = `SELECT TOP 20000 Field_014 as \[Date\], Field_009 as \[Debit\], Field_010 as \[Credit\], Field_015 as \[Codes\], Field_018 as \[Details\], Field_005, Field_006, Field_007 FROM ACT_TBL_009 WHERE Field_005 != '9' AND Field_003 = '4' ORDER BY Field_014 DESC`;/g;

const replacement3 = "sqlQuery = `SELECT TOP 30000 COALESCE(t1a.Field_008, t1b.Field_008) as [Date], t2.Field_009 as [Debit], t2.Field_010 as [Credit], t2.Field_015 as [Codes], t2.Field_018 as [Details], t2.Field_005, t2.Field_006, t2.Field_007 FROM ACT_TBL_009 t2 LEFT JOIN ACT_TBL_008 t1a ON t2.Field_003 = '4' AND t2.Field_004 = t1a.Field_001 LEFT JOIN ACT_TBL_008 t1b ON (t2.Field_003 = '2' OR t2.Field_003 = '3') AND t2.Field_004 = t1b.Field_005 AND t2.Field_003 = t1b.Field_004 WHERE t2.Field_005 != '9' ORDER BY COALESCE(t1a.Field_008, t1b.Field_008) DESC`;";

if (code.match(regex1)) {
    code = code.replace(regex1, replacement1);
    code = code.replace(regex2, replacement2);
    code = code.replace(regex3, replacement3);
    fs.writeFileSync('components/SayanReports.tsx', code);
    console.log("Replaced successfully!");
} else {
    console.log("Could not match the regex");
}
