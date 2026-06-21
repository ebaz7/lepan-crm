const fs = require('fs');
let file = './components/reports/CurrencyReport.tsx';
let txt = fs.readFileSync(file, 'utf8');

// 1. Calculate finalCostPerUnit inside processedGroups
txt = txt.replace(/returnAmount: t\.returnAmount \|\| 0,/g, `returnAmount: t.returnAmount || 0,\n                            finalCostPerUnit: t.deliveredAmount > 0 ? ((t.rialAmount || 0) - ((t.returnAmount || 0) * (t.rate || ((t.rialAmount || 0)/(t.amount || 1))))) / t.deliveredAmount : 0,`);

txt = txt.replace(/returnAmount: 0,\n\s*returnDate: '-'/g, `returnAmount: 0,\n                        returnDate: '-',\n                        finalCostPerUnit: r.currencyPurchaseData?.deliveredAmount > 0 ? (r.stages[TradeStage.CURRENCY_PURCHASE]?.costRial || 0) / r.currencyPurchaseData.deliveredAmount : 0`);

// 2. Sort tranches by date
txt = txt.replace(/groups\.push\(\{/g, `recordTranches.sort((a,b) => new Date(a.purchaseDate).getTime() - new Date(b.purchaseDate).getTime());
            groups.push({`);

// 3. Update Web Component Table Headers
const theadRegex = /<th className="p-3 text-center min-w-\[115px\] align-middle whitespace-nowrap border-l border-\[#1e3a8a\] bg-\[#1e40af\]">صرافی<\/th>/;
const newTheadChunk = `<th className="p-3 text-center min-w-[135px] align-middle whitespace-nowrap border-l border-[#1e3a8a] bg-[#1e40af]">بهای تمام شده</th>
        <th className="p-3 text-center min-w-[115px] align-middle whitespace-nowrap border-l border-[#1e3a8a] bg-[#1e40af]">صرافی</th>`;
txt = txt.replace(theadRegex, newTheadChunk);

// 4. Update Web Component Table Body
const tbodyRegex = /<td className="p-3 text-center align-middle border-l border-slate-200 text-slate-700">\{t\.exchangeName\}<\/td>/;
const newTbodyChunk = `<td className="p-3 text-center align-middle border-l border-slate-200 font-mono font-bold text-slate-600 bg-slate-100">{formatNumberString(t.finalCostPerUnit)}</td>
                            <td className="p-3 text-center align-middle border-l border-slate-200 text-slate-700">{t.exchangeName}</td>`;
txt = txt.replace(tbodyRegex, newTbodyChunk);

// 5. Update Excel Export
const regexExcel = /const handleExportExcel = \(\) => \{[\s\S]*?document\.body\.removeChild\(link\);\n\s*\};/;
const regexExcelAlt = /const handleExportExcel = async \(\) => \{[\s\S]*?saveAs\(new Blob\(\[buffer\]\), [^\n]*\);\n\s*\};/;

const newExcelExport = `const handleExportExcel = async () => {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('گزارش خرید ارز', { views: [{ rightToLeft: true }] });

        // Add Header Row
        const headers = [
            'ردیف',
            'شرح کالا',
            'توضیحات',
            'شماره سفارش (پرونده)',
            'شماره ثبت سفارش',
            'نام شرکت',
            'دلار آمریکا (معادل)',
            'مقدار ارز',
            'نوع ارز',
            'تاریخ خرید ارز',
            'ارز خریداری شده (ریال)',
            'بهای تمام شده برحسب تحویلی',
            'محل ارسال (صرافی)',
            'کارگزار',
            'ارز موجود نزد هر بانک',
            'مقدار تحویل شده',
            'وضعیت',
            'مبلغ عودت',
            'تاریخ عودت'
        ];
        
        const headerRow = sheet.addRow(headers);
        headerRow.height = 30;
        headerRow.eachCell((cell) => {
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF1E40AF' }
            };
            cell.font = {
                name: 'Vazirmatn',
                family: 4,
                size: 11,
                bold: true,
                color: { argb: 'FFFFFFFF' }
            };
            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
            cell.border = {
                top: {style: 'thin'}, left: {style: 'thin'}, bottom: {style: 'thin'}, right: {style: 'thin'}
            };
        });

        sheet.getColumn(1).width = 8;
        sheet.getColumn(2).width = 30;
        sheet.getColumn(3).width = 30;
        sheet.getColumn(4).width = 15;
        for (let i = 5; i <= headers.length; i++) {
            sheet.getColumn(i).width = 18;
        }

        let globalIdx = 1;
        processedGroups.forEach(group => {
            group.tranches.forEach((t: any) => {
                const row = sheet.addRow([
                    globalIdx,
                    group.recordInfo.goodsName || '',
                    group.recordInfo.description || '',
                    group.recordInfo.fileNumber || '',
                    group.recordInfo.registrationNumber || '-',
                    group.recordInfo.company || '',
                    t.usdAmount || 0,
                    t.originalAmount || 0,
                    t.currencyType || '',
                    t.purchaseDate || '-',
                    t.rialAmount || 0,
                    t.finalCostPerUnit || 0,
                    t.exchangeName || '-',
                    t.brokerName || '-',
                    group.recordInfo.bank || '',
                    t.deliveredAmount || 0,
                    t.isDelivered ? 'تحویل شده' : 'انتظار',
                    t.returnAmount || 0,
                    t.returnDate || '-'
                ]);

                // Zebra Striping and Center Align
                row.eachCell((cell, colNumber) => {
                    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                    cell.border = {
                        top: {style: 'thin', color: {argb: 'FFCCCCCC'}}, 
                        left: {style: 'thin', color: {argb: 'FFCCCCCC'}}, 
                        bottom: {style: 'thin', color: {argb: 'FFCCCCCC'}}, 
                        right: {style: 'thin', color: {argb: 'FFCCCCCC'}}
                    };
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: globalIdx % 2 === 0 ? 'FFF1F5F9' : 'FFFFFFFF' }
                    };
                    
                    if ([7,8,11,12,16,18].includes(colNumber)) {
                        cell.numFmt = '#,##0';
                        cell.font = { name: 'Arial', size: 10, bold: true };
                    } else {
                        cell.font = { name: 'Vazirmatn', size: 10 };
                    }
                });
                globalIdx++;
            });
        });

        const buffer = await workbook.xlsx.writeBuffer();
        saveAs(new Blob([buffer]), \`Currency_Report_\${selectedYear}.xlsx\`);
    };`;

txt = txt.replace(regexExcelAlt, newExcelExport);
txt = txt.replace(regexExcel, newExcelExport);

fs.writeFileSync(file, txt, 'utf8');
console.log('Script updated CurrencyReport logic.');
