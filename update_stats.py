with open("components/AccountingReports.tsx", "r", encoding="utf-8") as f:
    code = f.read()

# Replace handleSendSalesBotReport
old_send_bot = """    const handleSendSalesBotReport = async (targetDate: 'today' | 'yesterday' | 'range') => {
        const label = targetDate === 'today' ? 'امروز' : (targetDate === 'yesterday' ? 'دیروز' : `${dateFrom} تا ${dateTo}`);
        if (!confirm(`آیا از ارسال گزارش فروش ${label} به گروه‌های تلگرام / بله اطمینان دارید؟`)) return;
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
                toast.success(data.message || `گزارش فروش ${label} با موفقیت ارسال شد.`);
            } else {
                toast.error(data.error || 'خطا در ارسال گزارش فروش.');
            }
        } catch (e: any) {
            toast.error("خطا در ارسال گزارش: " + e.message);
        } finally {
            setIsSendingSalesBot(false);
        }
    };"""

new_send_bot = """    const handleSendSalesBotReport = async (targetDate: 'today' | 'yesterday' | 'range') => {
        const label = targetDate === 'today' ? 'امروز' : (targetDate === 'yesterday' ? 'دیروز' : `${dateFrom} تا ${dateTo}`);
        if (!confirm(`آیا از تولید PDF و ارسال گزارش تحلیلی فروش و مرجوعی ${label} به گروه‌های تلگرام / بله اطمینان دارید؟`)) return;
        setIsSendingSalesBot(true);
        
        try {
            let dataToSend = [];
            if (targetDate === 'range') {
                dataToSend = filteredSalesData.length > 0 ? filteredSalesData : salesData;
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
                    salesData: dataToSend,
                    applyOfficialTax
                })
            });
            const data = await res.json();
            if (data.success) {
                toast.success(data.message || `گزارش تحلیلی فروش و مرجوعی ${label} به همراه PDF با موفقیت ارسال شد.`);
            } else {
                toast.error(data.error || 'خطا در ارسال گزارش فروش.');
            }
        } catch (e: any) {
            toast.error("خطا در ارسال گزارش: " + e.message);
        } finally {
            setIsSendingSalesBot(false);
        }
    };"""

code = code.replace(old_send_bot, new_send_bot)

# Replace getSalesOverviewStats
start_stats_idx = code.find("const getSalesOverviewStats = () => {")
end_stats_idx = code.find("const getTodayInvoices = () => {")

if start_stats_idx != -1 and end_stats_idx != -1:
    new_stats_func = """const getSalesOverviewStats = () => {
        const stats = {
            todaySalesAmt: 0, todaySalesQty: 0, todayReturnAmt: 0, todayReturnQty: 0, todayNetAmt: 0, todayNetQty: 0, todayAvgPrice: 0,
            monthSalesAmt: 0, monthSalesQty: 0, monthReturnAmt: 0, monthReturnQty: 0, monthNetAmt: 0, monthNetQty: 0, monthAvgPrice: 0,
            quarterSalesAmt: 0, quarterSalesQty: 0, quarterReturnAmt: 0, quarterReturnQty: 0, quarterNetAmt: 0, quarterNetQty: 0, quarterAvgPrice: 0,
            yearSalesAmt: 0, yearSalesQty: 0, yearReturnAmt: 0, yearReturnQty: 0, yearNetAmt: 0, yearNetQty: 0, yearAvgPrice: 0,
            rangeSalesAmt: 0, rangeSalesQty: 0, rangeReturnAmt: 0, rangeReturnQty: 0, rangeNetAmt: 0, rangeNetQty: 0, rangeAvgPrice: 0,
            todayAmt: 0, todayQty: 0, monthAmt: 0, monthQty: 0, quarterAmt: 0, quarterQty: 0, yearAmt: 0, yearQty: 0, rangeAmt: 0, rangeQty: 0
        };
        const now = new Date();
        const jNow = jalaali.toJalaali(now.getFullYear(), now.getMonth() + 1, now.getDate());

        salesData.forEach(row => {
            const date = new Date(row.Date);
            const qty = parseFloat(row.Quantity || 0);
            const rawAmt = parseFloat(row.RawAmount || row.Amount || 0);
            const amt = (row.IsOfficial && applyOfficialTax) ? rawAmt * 1.10 : rawAmt;
            const isRet = row.IsReturn;

            if (isRet) {
                stats.rangeReturnAmt += amt;
                stats.rangeReturnQty += qty;
            } else {
                stats.rangeSalesAmt += amt;
                stats.rangeSalesQty += qty;
            }

            const jRow = jalaali.toJalaali(date.getFullYear(), date.getMonth() + 1, date.getDate());
            if (jRow.jy === jNow.jy) {
                if (isRet) {
                    stats.yearReturnAmt += amt;
                    stats.yearReturnQty += qty;
                } else {
                    stats.yearSalesAmt += amt;
                    stats.yearSalesQty += qty;
                }

                if (jRow.jm === jNow.jm) {
                    if (isRet) {
                        stats.monthReturnAmt += amt;
                        stats.monthReturnQty += qty;
                    } else {
                        stats.monthSalesAmt += amt;
                        stats.monthSalesQty += qty;
                    }

                    if (jRow.jd === jNow.jd) {
                        if (isRet) {
                            stats.todayReturnAmt += amt;
                            stats.todayReturnQty += qty;
                        } else {
                            stats.todaySalesAmt += amt;
                            stats.todaySalesQty += qty;
                        }
                    }
                }

                const rowQuarter = Math.ceil(jRow.jm / 3);
                const nowQuarter = Math.ceil(jNow.jm / 3);
                if (rowQuarter === nowQuarter) {
                    if (isRet) {
                        stats.quarterReturnAmt += amt;
                        stats.quarterReturnQty += qty;
                    } else {
                        stats.quarterSalesAmt += amt;
                        stats.quarterSalesQty += qty;
                    }
                }
            }
        });

        stats.rangeNetQty = stats.rangeSalesQty - stats.rangeReturnQty;
        stats.rangeNetAmt = stats.rangeSalesAmt - stats.rangeReturnAmt;
        stats.rangeAvgPrice = stats.rangeNetQty > 0 ? Math.round(stats.rangeNetAmt / stats.rangeNetQty) : 0;
        stats.rangeAmt = stats.rangeNetAmt;
        stats.rangeQty = stats.rangeNetQty;

        stats.todayNetQty = stats.todaySalesQty - stats.todayReturnQty;
        stats.todayNetAmt = stats.todaySalesAmt - stats.todayReturnAmt;
        stats.todayAvgPrice = stats.todayNetQty > 0 ? Math.round(stats.todayNetAmt / stats.todayNetQty) : 0;
        stats.todayAmt = stats.todayNetAmt;
        stats.todayQty = stats.todayNetQty;

        stats.monthNetQty = stats.monthSalesQty - stats.monthReturnQty;
        stats.monthNetAmt = stats.monthSalesAmt - stats.monthReturnAmt;
        stats.monthAvgPrice = stats.monthNetQty > 0 ? Math.round(stats.monthNetAmt / stats.monthNetQty) : 0;
        stats.monthAmt = stats.monthNetAmt;
        stats.monthQty = stats.monthNetQty;

        stats.quarterNetQty = stats.quarterSalesQty - stats.quarterReturnQty;
        stats.quarterNetAmt = stats.quarterSalesAmt - stats.quarterReturnAmt;
        stats.quarterAvgPrice = stats.quarterNetQty > 0 ? Math.round(stats.quarterNetAmt / stats.quarterNetQty) : 0;
        stats.quarterAmt = stats.quarterNetAmt;
        stats.quarterQty = stats.quarterNetQty;

        stats.yearNetQty = stats.yearSalesQty - stats.yearReturnQty;
        stats.yearNetAmt = stats.yearSalesAmt - stats.yearReturnAmt;
        stats.yearAvgPrice = stats.yearNetQty > 0 ? Math.round(stats.yearNetAmt / stats.yearNetQty) : 0;
        stats.yearAmt = stats.yearNetAmt;
        stats.yearQty = stats.yearNetQty;

        return stats;
    };

    const getAveragePriceTableData = () => {
        const currentList = salesViewMode === 'range' ? (filteredSalesData.length > 0 ? filteredSalesData : salesData) : getTodayInvoices();
        const map = new Map<string, {
            groupName: string;
            itemName: string;
            salesQty: number;
            salesAmt: number;
            returnQty: number;
            returnAmt: number;
            netQty: number;
            netAmt: number;
            avgPrice: number;
        }>();

        currentList.forEach(row => {
            const groupName = row.GroupName || row.groupName || row.ItemName || row.itemName || 'سایر کالاها';
            const itemName = row.ItemName || row.itemName || 'کالا';
            const key = groupName;

            const qty = parseFloat(row.Quantity || 0);
            const rawAmt = parseFloat(row.RawAmount || row.Amount || 0);
            const amt = (row.IsOfficial && applyOfficialTax) ? rawAmt * 1.10 : rawAmt;
            const isRet = row.IsReturn;

            if (!map.has(key)) {
                map.set(key, {
                    groupName,
                    itemName,
                    salesQty: 0,
                    salesAmt: 0,
                    returnQty: 0,
                    returnAmt: 0,
                    netQty: 0,
                    netAmt: 0,
                    avgPrice: 0
                });
            }

            const item = map.get(key)!;
            if (isRet) {
                item.returnQty += qty;
                item.returnAmt += amt;
            } else {
                item.salesQty += qty;
                item.salesAmt += amt;
            }
        });

        const list = Array.from(map.values()).map(item => {
            item.netQty = item.salesQty - item.returnQty;
            item.netAmt = item.salesAmt - item.returnAmt;
            item.avgPrice = item.netQty > 0 ? Math.round(item.netAmt / item.netQty) : 0;
            return item;
        });

        const totals = list.reduce((acc, curr) => {
            acc.salesQty += curr.salesQty;
            acc.salesAmt += curr.salesAmt;
            acc.returnQty += curr.returnQty;
            acc.returnAmt += curr.returnAmt;
            acc.netQty += curr.netQty;
            acc.netAmt += curr.netAmt;
            return acc;
        }, { salesQty: 0, salesAmt: 0, returnQty: 0, returnAmt: 0, netQty: 0, netAmt: 0 });

        const overallAvgPrice = totals.netQty > 0 ? Math.round(totals.netAmt / totals.netQty) : 0;

        return { list, totals, overallAvgPrice };
    };\n\n    """
    code = code[:start_stats_idx] + new_stats_func + code[end_stats_idx:]

with open("components/AccountingReports.tsx", "w", encoding="utf-8") as f:
    f.write(code)

print("Updated stats and handleSendSalesBotReport!")
