import fs from 'fs';
let serverCode = fs.readFileSync('server.js', 'utf8');

serverCode = serverCode.replace(
/app\.post\('\/api\/sayan\/sales-report\/send-manual', async \(req, res\) => \{[\s\S]*?\}\);/,
`app.post('/api/sayan/sales-report/send-manual', async (req, res) => {
    try {
        const db = getDb();
        const { targetDate, salesData, dateRangeLabel } = req.body; 
        
        const settings = db.settings || {};
        const isTelegramConfigured = !!(settings.telegramBotToken && typeof settings.telegramBotToken === 'string' && settings.telegramBotToken.trim());
        const isBaleConfigured = !!(settings.baleBotToken && typeof settings.baleBotToken === 'string' && settings.baleBotToken.trim());
        
        let label = targetDate === 'today' ? 'امروز' : (targetDate === 'yesterday' ? 'دیروز' : (dateRangeLabel || targetDate));
        
        const salesTargets = [];
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
        if (settings.telegramChatId) salesTargets.push({ platform: 'telegram', id: settings.telegramChatId });
        if (settings.baleChatId) salesTargets.push({ platform: 'bale', id: settings.baleChatId });
        if (db.groups && Array.isArray(db.groups)) {
            db.groups.forEach(g => {
                if (g.chatId) salesTargets.push({ platform: g.platform || 'telegram', id: g.chatId });
            });
        }
        
        const uniqueTargets = [];
        const seenSet = new Set();
        for (const t of salesTargets) {
            if (t.platform === 'telegram' && !isTelegramConfigured) continue;
            if (t.platform === 'bale' && !isBaleConfigured) continue;
            const cleanId = utils.sanitizeGroupId(t.id);
            if (!cleanId) continue;
            const key = \`\${t.platform}:\${cleanId}\`;
            if (!seenSet.has(key)) {
                seenSet.add(key);
                uniqueTargets.push({ platform: t.platform, id: cleanId });
            }
        }
        
        if (uniqueTargets.length === 0) {
            return res.status(400).json({ error: 'هیچ آیدی گروه فعال و توکن ربات تنظیم‌شده‌ای (بله یا تلگرام) برای ارسال گزارش فروش یافت نشد.' });
        }
        
        if (!salesData || !Array.isArray(salesData)) {
            return res.status(400).json({ error: 'اطلاعات فروش ارسال نشده است.' });
        }
        
        const title = \`گزارش رسمی فروش روزانه - مورخ \${label}\`;
        const columns = ['ردیف', 'گروه کالا', 'نام کالا / محصول', 'جمع وزنی (ک‌گ)', 'جمع ریالی (ریال)'];
        
        const groupedMap = new Map();
        let totalQty = 0;
        let totalAmt = 0;
        
        salesData.forEach(inv => {
            const groupName = inv.GroupName || inv.groupName || 'سایر گروه‌ها';
            const itemName = inv.ItemName || inv.itemName || 'کالای بدون نام';
            const key = \`\${groupName}_\${itemName}\`;
            
            const qty = parseFloat(inv.Quantity || inv.quantity || inv.Weight || inv.weight || 0);
            const amt = parseFloat(inv.Amount || inv.amount || inv.TotalAmount || inv.totalAmount || 0);
            totalQty += qty;
            totalAmt += amt;
            
            if (groupedMap.has(key)) {
                const existing = groupedMap.get(key);
                existing.totalQty += qty;
                existing.totalAmt += amt;
            } else {
                groupedMap.set(key, {
                    itemName,
                    groupName,
                    totalQty: qty,
                    totalAmt: amt
                });
            }
        });
        
        const groupedRows = Array.from(groupedMap.values());
        const tableRows = groupedRows.map((row, idx) => {
            return [
                idx + 1,
                row.groupName,
                row.itemName,
                row.totalQty.toLocaleString('en-US'),
                row.totalAmt.toLocaleString('en-US')
            ];
        });

        tableRows.push([
            'جمع کل',
            '',
            '',
            totalQty.toLocaleString('en-US'),
            totalAmt.toLocaleString('en-US')
        ]);
        
        const pdfBuffer = await Renderer.generateReportPDF(title, columns, tableRows);
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const filename = \`Sales_Report_\${timestamp}.pdf\`;
        
        let caption = \`📊 **گزارش آمار کل فروش**\\n\`;
        caption += \`📅 تاریخ: \${label}\\n\\n\`;
        caption += \`🔹 مجموع تناژ فروش: **\${(totalQty / 1000).toLocaleString('fa-IR', { maximumFractionDigits: 2 })} تن**\\n\`;
        caption += \`🔹 مجموع ریالی فروش: **\${totalAmt.toLocaleString('fa-IR')} ریال**\\n\`;
        caption += \`\\n📄 فایل PDF گزارش فروش به پیوست ارسال شد.\`;
        
        let sentCount = 0;
        let lastError = null;
        for (const target of uniqueTargets) {
            try {
                if (target.platform === 'telegram') {
                    await telegram.sendBotDocument(target.id, pdfBuffer, filename, caption);
                    sentCount++;
                } else if (target.platform === 'bale') {
                    await bale.sendBotDocument(target.id, pdfBuffer, filename, caption);
                    sentCount++;
                }
            } catch (err) {
                lastError = err.message;
                console.error(\`[Send Sales Report] Failed for \${target.platform}:\${target.id}:\`, err.message);
            }
        }
        if (sentCount === 0) {
            return res.status(400).json({ error: \`ارسال گزارش آمار فروش ناموفق بود: \${lastError || 'خطای ناشناخته'}\` });
        }
        res.json({
            success: true,
            message: \`گزارش با موفقیت به \${sentCount} گروه / چت در بات‌ها ارسال شد.\`
        });
    } catch (e) {
        console.error("Manual Sales Report Sending Error:", e);
        res.status(500).json({ error: e.message });
    }
});`
);
fs.writeFileSync('server.js', serverCode);
