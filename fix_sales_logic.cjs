const fs = require('fs');
let code = fs.readFileSync('components/SayanReports.tsx', 'utf8');

const regex = /const processed = finalData\.map\(\(row: any\) => \{[\s\S]*?if \(invoiceItemsRaw\.length === 0\) return null;[\s\S]*?return invoiceItemsRaw\.map\(\(det: any\) => \{[\s\S]*?\}\);\n        \}\)\.flat\(\)\.filter\(Boolean\);/;

const replacement = `const processed = finalData.flatMap((row: any) => {
            // Cancelled flag check
            if (String(row.Field_019).toLowerCase() === 'true' || row.Field_019 === 1) return [];

            const amount = Math.abs(parseFloat(row.Field_027 || row.Field_038 || row.Field_037 || row.Field_025 || 0));
            const typeId = String(row.Field_004 || '').trim();
            const typeName = typeId ? (docTypes[typeId] || \`نوع \${typeId}\`) : 'نامشخص';
            
            // Filter by sales types
            if (!availableSalesTypes.includes(typeName) && availableSalesTypes.length > 0) return [];
            if (!selectedSalesTypes.includes(typeName) && selectedSalesTypes.length > 0) return [];

            // Filter by store
            const storeId = String(row.Field_005 || row.Field_006 || '').trim();
            const storeName = storeId ? (storeMap[storeId] || \`انبار \${storeId}\`) : 'انبار نامشخص';
            if (!availableStores.includes(storeName) && availableStores.length > 0) return [];
            if (!selectedStores.includes(storeName) && selectedStores.length > 0) return [];

            let isReturn = false;
            const docPrefix = String(docPrefixes[typeId] || '').trim();
            if (docPrefix === '1' || typeName.includes('برگشت') || typeName.includes('مرجوع')) {
                isReturn = true;
            }

            const invoiceItemsRaw = (detailsList || []).filter((d: any) => String(d.Field_004).trim() === String(row.Field_001).trim());
            
            if (invoiceItemsRaw.length === 0) {
                 return [{
                    id: row.Field_001,
                    date: String(row.Field_008).substring(0, 10),
                    type: typeName,
                    store: storeName,
                    person: tafsiliMap[String(row.Field_010).trim()] || \`کد \${row.Field_010}\`,
                    personCode: String(row.Field_010).trim(),
                    productName: 'ثبت کلی / بدون جزئیات',
                    productGroup: 'نامشخص',
                    quantity: 0,
                    weight: 0,
                    unitPrice: 0,
                    totalPrice: amount,
                    isReturn
                 }];
            }
            
            return invoiceItemsRaw.map((det: any) => {
                const pCode = String(det.Field_005 || '').trim();
                const rawItemName = pMap[pCode] || \`کالا \${pCode}\`;
                const groupCode = productCodeToGroupCode[pCode];
                const subGroup = groupCode ? (productGroupNames[groupCode] || groupMap[groupCode] || 'سایر گروه‌ها') : 'سایر گروه‌ها';
                
                const formattedFullName = subGroup !== 'سایر گروه‌ها' ? \`\${subGroup} - \${rawItemName}\` : rawItemName;
                let qty1 = Math.abs(parseFloat(det.Field_006) || 0);
                let qty2 = Math.abs(parseFloat(det.Field_012 || det.Field_008 || det.Field_010) || 0);
                
                let w = qty1;
                let qty = qty2;
                
                if (qty === 0 && w !== 0) qty = w;
                if (w === 0 && qty !== 0) w = qty;
                
                const uprice = Math.abs(parseFloat(det.Field_007) || 0);
                const tprice = Math.abs(parseFloat(det.Field_008 || det.Field_026) || (uprice * qty));
                
                if (qty > 0 || w > 0 || tprice > 0) {
                    return {
                        id: row.Field_001,
                        date: String(row.Field_008).substring(0, 10),
                        type: typeName,
                        store: storeName,
                        person: tafsiliMap[String(row.Field_010).trim()] || \`کد \${row.Field_010}\`,
                        personCode: String(row.Field_010).trim(),
                        productName: formattedFullName,
                        productGroup: subGroup,
                        quantity: qty,
                        weight: w,
                        unitPrice: uprice,
                        totalPrice: tprice > 0 ? tprice : amount,
                        isReturn
                    };
                }
                return null;
            }).filter(Boolean);
        }).filter(Boolean);`;

if (code.includes('const processed = finalData.map((row: any) => {') && code.includes('.flat().filter(Boolean);')) {
    code = code.replace(regex, replacement);
    fs.writeFileSync('components/SayanReports.tsx', code);
    console.log("Successfully replaced processed logic.");
} else {
    console.log("Regex not found. Writing to debug.txt");
    fs.writeFileSync('debug.txt', code);
}
