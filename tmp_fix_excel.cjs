const fs = require('fs');
let file = './components/reports/CurrencyReport.tsx';
let txt = fs.readFileSync(file, 'utf8');

const regex = /const handleExportExcel = \(\) => \{[\s\S]*?document\.body\.removeChild\(link\);\n\s*\};/;

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
                fgColor: { argb: 'FF1E40AF' } // blue-800
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
                        fgColor: { argb: globalIdx % 2 === 0 ? 'FFF1F5F9' : 'FFFFFFFF' } // slate-100/50 vs white
                    };
                    
                    // numeric formats
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

txt = txt.replace(regex, newExcelExport);
fs.writeFileSync(file, txt, 'utf8');
console.log('Script updated handleExportExcel function.');
