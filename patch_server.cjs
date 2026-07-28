const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

const targetFuncStart = code.indexOf('const sendDailySalesReportForDate = async');
const nextFuncStart = code.indexOf('app.get(\'/api/sayan/production-report\'');

let replacement = `const sendDailySalesReportForDate = async (db, dateObj, labelSuffix = '', targetsOverride = null) => {
    const settings = db.settings || {};
    const shamsiDate = utils.toShamsiFull(dateObj.toISOString()).split(' ')[0].replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)); // Normalize to English digits
    const gregDate = utils.getTehranDateString(dateObj);

    const salesTargets = targetsOverride ? [...targetsOverride] : [];
    if (!targetsOverride) {
        if (settings.dailySalesTelegramGroupId) salesTargets.push({ platform: 'telegram', id: settings.dailySalesTelegramGroupId });
        if (settings.dailySalesBaleGroupId) salesTargets.push({ platform: 'bale', id: settings.dailySalesBaleGroupId });
        if (settings.dailySalesWhatsappGroupId) salesTargets.push({ platform: 'whatsapp', id: settings.dailySalesWhatsappGroupId });
        if (settings.botAccountingGroupIdTele) salesTargets.push({ platform: 'telegram', id: settings.botAccountingGroupIdTele });
        if (settings.botAccountingGroupIdBale) salesTargets.push({ platform: 'bale', id: settings.botAccountingGroupIdBale });
        if (settings.botAccountingGroupIdWhatsApp) salesTargets.push({ platform: 'whatsapp', id: settings.botAccountingGroupIdWhatsApp });
        if (settings.botAccountingGroupId) salesTargets.push({ platform: 'telegram', id: settings.botAccountingGroupId });
        if (settings.reportsGroupId) salesTargets.push({ platform: 'telegram', id: settings.reportsGroupId });
        if (settings.telegramReportsGroupId) salesTargets.push({ platform: 'telegram', id: settings.telegramReportsGroupId });
        if (settings.telegramReportsGroupId2) salesTargets.push({ platform: 'telegram', id: settings.telegramReportsGroupId2 });
        if (settings.baleReportsGroupId) salesTargets.push({ platform: 'bale', id: settings.baleReportsGroupId });
        if (settings.baleReportsGroupId2) salesTargets.push({ platform: 'bale', id: settings.baleReportsGroupId2 });
        if (settings.whatsappReportsGroupId) salesTargets.push({ platform: 'whatsapp', id: settings.whatsappReportsGroupId });
        if (settings.whatsappReportsGroupId2) salesTargets.push({ platform: 'whatsapp', id: settings.whatsappReportsGroupId2 });
        if (settings.telegramChatId) salesTargets.push({ platform: 'telegram', id: settings.telegramChatId });
        if (settings.baleChatId) salesTargets.push({ platform: 'bale', id: settings.baleChatId });

        if (db.groups && Array.isArray(db.groups)) {
            db.groups.forEach(g => {
                if (g.chatId) salesTargets.push({ platform: g.platform || 'telegram', id: g.chatId });
            });
        }
    }

    const uniqueSalesTargets = [];
    const seenMap = new Set();
    for (const t of salesTargets) {
        const cleanId = utils.sanitizeGroupId(t.id);
        if (!cleanId) continue;
        const key = \`\${t.platform}_\${cleanId}\`;
        if (!seenMap.has(key)) {
            seenMap.add(key);
            uniqueSalesTargets.push({ platform: t.platform, id: cleanId });
        }
    }

    if (uniqueSalesTargets.length === 0) {
        throw new Error('گروهی برای ارسال گزارش فروش (تلگرام یا بله) در تنظیمات سیستم ثبت نشده است.');
    }

    // Fetch sales and returns data from Sayan ERP
    const sql = \`
        SELECT 
            t10.Field_005 as DocId,
            t10.Field_006 as InvoiceNum,
            t10.Field_008 as Date,
            t10.Field_029 as Notes,
            t11.Field_005 as ItemCode,
            t22.Field_004 as ItemName,
            t11.Field_006 as Quantity,
            t11.Field_031 as ItemNotes,
            t11.Field_007 as Amount,
            t_group.GroupName,
            t07.Field_006 as CustomerName,
            t10.Field_009 as OpCode
        FROM STR_TBL_010 t10
        INNER JOIN STR_TBL_011 t11 ON t11.Field_004 = t10.Field_005 
                                   AND t11.Field_003 = t10.Field_004
        LEFT JOIN IND_TBL_022 t22 ON RTRIM(LTRIM(t22.Field_005)) = RTRIM(LTRIM(t11.Field_005))
        LEFT JOIN (
            SELECT t21_sub.Field_004 as ItemCode, MIN(COALESCE(t02_parent.Field_003, t02_sub.Field_003)) as GroupName
            FROM IND_TBL_021 t21_sub
            LEFT JOIN IND_TBL_002 t02_sub ON t21_sub.Field_003 = t02_sub.Field_008
            LEFT JOIN IND_TBL_002 t02_parent ON t02_sub.Field_009 = t02_parent.Field_008
            GROUP BY t21_sub.Field_004
        ) t_group ON t11.Field_005 = t_group.ItemCode
        LEFT JOIN ACT_TBL_007 t07 ON t10.Field_010 = t07.Field_005 AND (t07.Field_004 = '11' OR t07.Field_004 = '31')
        WHERE (
            (t10.Field_009 IN ('3', '12', '23') AND t11.Field_036 = t10.Field_009 AND t11.Field_007 > 0)
            OR 
            (t10.Field_009 = '13' AND t11.Field_036 IN ('3', '12', '23', '13'))
          )
          AND (t10.Field_008 = '\${gregDate}' OR t10.Field_008 LIKE '\${gregDate}%' OR t10.Field_008 BETWEEN '\${gregDate}T00:00:00.000Z' AND '\${gregDate}T23:59:59.999Z')
        ORDER BY t10.Field_008 DESC
    \`;

    const salesRows = await executeSayanQuery(db, sql);
    
    // Always create a PDF even if empty, or just return empty message. But wait, if salesRows is empty it's fine.
    if (salesRows.length > 0) {
        const title = \`گزارش رسمی فروش روزانه سایان - مورخ \${shamsiDate} (\${labelSuffix})\`;
        const columns = ['ردیف', 'گروه / کالا', 'فروش (ک‌گ / ریال)', 'مرجوعی (ک‌گ / ریال)', 'خالص (ک‌گ / ریال)', 'فی نهایی (ریال)'];
        
        const groupedMap = new Map();
        let totalSalesQty = 0;
        let totalSalesAmt = 0;
        let totalReturnQty = 0;
        let totalReturnAmt = 0;
        
        salesRows.forEach(inv => {
            const key = \`\${inv.GroupName || ''}_\${inv.ItemName || ''}\`;
            const qty = parseFloat(inv.Quantity || 0);
            const amt = parseFloat(inv.Amount || 0);
            const isReturn = inv.OpCode === '13';
            
            if (isReturn) {
                totalReturnQty += qty;
                totalReturnAmt += amt;
            } else {
                totalSalesQty += qty;
                totalSalesAmt += amt;
            }
            
            if (!groupedMap.has(key)) {
                groupedMap.set(key, {
                    itemName: inv.ItemName || 'کالای بدون نام',
                    groupName: inv.GroupName || 'سایر گروه‌ها',
                    salesQty: 0,
                    salesAmt: 0,
                    returnQty: 0,
                    returnAmt: 0
                });
            }
            
            const existing = groupedMap.get(key);
            if (isReturn) {
                existing.returnQty += qty;
                existing.returnAmt += amt;
            } else {
                existing.salesQty += qty;
                existing.salesAmt += amt;
            }
        });
        
        const groupedRows = Array.from(groupedMap.values());
        
        const tableRows = groupedRows.map((row, idx) => {
            const netQty = row.salesQty - row.returnQty;
            const netAmt = row.salesAmt - row.returnAmt;
            const finalPrice = netQty > 0 ? (netAmt / netQty) : 0;
            return [
                (idx + 1).toLocaleString('fa-IR'),
                \`\${row.groupName} - \${row.itemName}\`,
                \`\${row.salesQty.toLocaleString('fa-IR')} / \${row.salesAmt.toLocaleString('fa-IR')}\`,
                \`\${row.returnQty.toLocaleString('fa-IR')} / \${row.returnAmt.toLocaleString('fa-IR')}\`,
                \`\${netQty.toLocaleString('fa-IR')} / \${netAmt.toLocaleString('fa-IR')}\`,
                Math.round(finalPrice).toLocaleString('fa-IR')
            ];
        });
        
        const grandNetQty = totalSalesQty - totalReturnQty;
        const grandNetAmt = totalSalesAmt - totalReturnAmt;
        const grandFinalPrice = grandNetQty > 0 ? (grandNetAmt / grandNetQty) : 0;
        
        tableRows.push([
            'جمع کل',
            '-',
            \`\${totalSalesQty.toLocaleString('fa-IR')} / \${totalSalesAmt.toLocaleString('fa-IR')}\`,
            \`\${totalReturnQty.toLocaleString('fa-IR')} / \${totalReturnAmt.toLocaleString('fa-IR')}\`,
            \`\${grandNetQty.toLocaleString('fa-IR')} / \${grandNetAmt.toLocaleString('fa-IR')}\`,
            Math.round(grandFinalPrice).toLocaleString('fa-IR')
        ]);
        
        const pdfBuffer = await Renderer.generateReportPDF(title, columns, tableRows, true); // Landscape
        
        const filename = \`Sayan_Daily_Sales_\${gregDate}_\${labelSuffix === 'دیروز' ? 'Yesterday' : 'Today'}.pdf\`;
        
        const caption = \`📊 *گزارش فروش روزانه (\${labelSuffix} - سایان ERP)*
📅 *تاریخ:* \${shamsiDate}
🧾 تعداد اقلام: \${groupedRows.length}
✅ مجموع مقدار خالص: \${grandNetQty.toLocaleString('fa-IR')} کیلوگرم
💵 فروش خالص: \${grandNetAmt.toLocaleString('fa-IR')} ریال
➖ مرجوعی: \${totalReturnAmt.toLocaleString('fa-IR')} ریال\`;

        let successfulSends = 0;
        let lastErr = null;
        for (const tgt of uniqueSalesTargets) {
            try {
                if (tgt.platform === 'telegram') {
                    await telegram.sendBotDocument(tgt.id, pdfBuffer, filename, caption);
                    successfulSends++;
                } else if (tgt.platform === 'bale') {
                    await bale.sendBotDocument(tgt.id, pdfBuffer, filename, caption);
                    successfulSends++;
                } else if (tgt.platform === 'whatsapp') {
                    const wa = await safeImport('./backend/whatsapp.js');
                    if (wa && wa.sendMessage) {
                        await wa.sendMessage(tgt.id, caption, {
                            data: pdfBuffer.toString('base64'),
                            mimeType: 'application/pdf',
                            filename: filename
                        });
                        successfulSends++;
                    }
                }
            } catch (e) {
                lastErr = e.message;
                console.error(\`[Manual/Auto Sales Report] Failed to send to \${tgt.platform} group \${tgt.id}:\`, e.message);
            }
        }

        if (successfulSends === 0) {
            throw new Error(\`ارسال گزارش فروش ناموفق بود: \${lastErr || 'خطا در اتصال به پیام‌رسان‌ها'}\`);
        }

        return { count: salesRows.length, totalSalesQty, totalSalesAmt, sent: true, successfulSends };

    } else {
        const emptyMsg = \`⚠️ هیچ فاکتور فروشی برای \${labelSuffix} (\${shamsiDate}) در سرور سایان ثبت نشده است.\`;
        let successfulSends = 0;
        let lastErr = null;
        for (const tgt of uniqueSalesTargets) {
            try {
                if (tgt.platform === 'telegram') {
                    await telegram.sendBotMessage(tgt.id, emptyMsg);
                    successfulSends++;
                } else if (tgt.platform === 'bale') {
                    await bale.sendBotMessage(tgt.id, emptyMsg);
                    successfulSends++;
                } else if (tgt.platform === 'whatsapp') {
                    const wa = await safeImport('./backend/whatsapp.js');
                    if (wa && wa.sendMessage) {
                        await wa.sendMessage(tgt.id, emptyMsg);
                        successfulSends++;
                    }
                }
            } catch (e) {
                lastErr = e.message;
                console.error(\`[Manual/Auto Sales Report] Failed to send empty msg to \${tgt.platform} group \${tgt.id}:\`, e.message);
            }
        }

        if (successfulSends === 0) {
            throw new Error(\`ارسال پیام عدم وجود فاکتور فروش ناموفق بود: \${lastErr || 'خطا در پیام‌رسان‌ها'}\`);
        }

        return { count: 0, sent: true, successfulSends };
    }
};

`;

let before = code.substring(0, targetFuncStart);
// Find end of the previous sendDailySalesReportForDate
// It ends just before app.get('/api/sayan/production-report'
// Let's find exactly the line before that
let endFunc = code.indexOf('\n// --- SAYAN PRODUCTION REPORT ENDPOINTS ---');
if (endFunc === -1) endFunc = nextFuncStart - 1; // backup

let after = code.substring(endFunc);

fs.writeFileSync('server.js', before + replacement + after);
console.log('patched server.js sales func');
