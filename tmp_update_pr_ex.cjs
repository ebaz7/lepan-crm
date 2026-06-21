const fs = require('fs');
let file = './components/reports/CurrencyReport.tsx';
let txt = fs.readFileSync(file, 'utf8');

// 5. Update Excel Export (handleExcelExport function)
const excelExportRegex = /const row = sheet\.addRow\(\[\n                            globalIdx\+\+,\n                            group\.recordInfo\.goodsName,/;
const newExcelExport = `const row = sheet.addRow([
                            globalIdx++,
                            group.recordInfo.goodsName,
                            group.recordInfo.description || '',`;
txt = txt.replace(excelExportRegex, newExcelExport);

const excelHeaderRegex = /sheet\.addRow\(\[\n            'ردیف',\n            'شرح کالا',\n            'پرونده',/;
const newExcelHeader = `sheet.addRow([
            'ردیف',
            'شرح کالا',
            'توضیحات',
            'پرونده',`;
txt = txt.replace(excelHeaderRegex, newExcelHeader);

// Adjust widths in Excel:
txt = txt.replace(/sheet\.getColumn\(2\)\.width = 30;/, "sheet.getColumn(2).width = 30;\n        sheet.getColumn(3).width = 30;"); // assuming column 3 is new description

// 6. Update Print View
const printColsRegex = /<col style=\{\{width: '25px'\}\} \/> \{\/\* Row \*\/\}[\s\S]*?<col \/> \{\/\* Goods \*\/\}/;
const newPrintCols = `<col style={{width: '25px'}} /> {/* Row */}
                    <col /> {/* Goods */}
                    <col /> {/* Description */}`;
txt = txt.replace(printColsRegex, newPrintCols);

const printHeaderRegex = /<th className="border border-black p-1 align-middle text-center">شرح کالا<\/th>/;
const newPrintHeader = `<th className="border border-black p-1 align-middle text-center">شرح کالا</th>
                        <th className="border border-black p-1 align-middle text-center">توضیحات</th>`;
txt = txt.replace(printHeaderRegex, newPrintHeader);

const printBodyRegex = /<td className="border border-black p-1 truncate max-w-\[100px\] text-right text-\[9px\] align-middle" rowSpan=\{groupRowSpan\}>\{group\.recordInfo\.goodsName\}<\/td>\n(.*?)<td className="border border-black p-1 font-mono font-bold align-middle text-center" rowSpan=\{groupRowSpan\}>\{group\.recordInfo\.fileNumber\}/s;

txt = txt.replace(printBodyRegex, `<td className="border border-black p-1 max-w-[100px] text-center text-[9px] align-middle break-words" rowSpan={groupRowSpan}>{group.recordInfo.goodsName}</td>
                                                        <td className="border border-black p-1 max-w-[100px] text-center text-[9px] align-middle break-words text-gray-700" rowSpan={groupRowSpan}>{group.recordInfo.description || '-'}</td>
                                                        <td className="border border-black p-1 font-mono font-bold align-middle text-center" rowSpan={groupRowSpan}>{group.recordInfo.fileNumber}`);

fs.writeFileSync(file, txt, 'utf8');
console.log('Script updated Print and Excel.');
