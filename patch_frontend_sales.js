import fs from 'fs';
let code = fs.readFileSync('components/AccountingReports.tsx', 'utf8');

code = code.replace(
/const handleSendSalesBotReport = async \(targetDate: 'today' \| 'yesterday'\) => \{[\s\S]*?setIsSendingSalesBot\(false\);\n        \}\n    \};/,
`const handleSendSalesBotReport = async (targetDate: 'today' | 'yesterday' | 'range') => {
        const label = targetDate === 'today' ? 'امروز' : (targetDate === 'yesterday' ? 'دیروز' : \`\${dateFrom} تا \${dateTo}\`);
        if (!confirm(\`آیا از ارسال گزارش فروش \${label} به گروه‌های تلگرام / بله اطمینان دارید؟\`)) return;
        setIsSendingSalesBot(true);
        
        try {
            let dataToSend = [];
            if (targetDate === 'range') {
                dataToSend = filteredSalesData;
            } else {
                const targetD = targetDate === 'today' ? formatDateToJalali(new Date().toISOString()) : (() => {
                    const d = new Date();
                    d.setDate(d.getDate() - 1);
                    return formatDateToJalali(d.toISOString());
                })();
                dataToSend = salesData.filter(row => formatDateToJalali(row.Date) === targetD);
            }
            
            const res = await fetch('/api/sayan/sales-report/send-manual', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    targetDate,
                    dateRangeLabel: label,
                    salesData: dataToSend
                })
            });
            const data = await res.json();
            if (data.success) {
                toast.success(data.message || \`گزارش فروش \${label} با موفقیت ارسال شد.\`);
            } else {
                toast.error(data.error || 'خطا در ارسال گزارش فروش.');
            }
        } catch (e: any) {
            toast.error("خطا در ارسال گزارش: " + e.message);
        } finally {
            setIsSendingSalesBot(false);
        }
    };`
);
fs.writeFileSync('components/AccountingReports.tsx', code);
