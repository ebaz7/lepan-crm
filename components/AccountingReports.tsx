import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { 
    Search, 
    Loader2, 
    Printer, 
    Calendar, 
    TrendingUp, 
    Coins, 
    TrendingDown, 
    CheckSquare, 
    Layers, 
    Activity, 
    FileText, 
    ArrowUpDown, 
    Download,
    Percent
} from 'lucide-react';
import * as jalaali from 'jalaali-js';
import { 
    BarChart, 
    Bar, 
    XAxis, 
    YAxis, 
    CartesianGrid, 
    Tooltip, 
    Legend, 
    ResponsiveContainer,
    LineChart,
    Line
} from 'recharts';

export default function AccountingReports() {
    const [activeTab, setActiveTab] = useState('traz');
    const [isLoading, setIsLoading] = useState(false);
    
    // Default Date Range (Direct Shamsi format "YYYY/MM/DD")
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    // --- TAB 1: TRAZ STATE ---
    const [trazData, setTrazData] = useState<any[]>([]);
    const [trazSearch, setTrazSearch] = useState('');
    const [trazCategory, setTrazCategory] = useState('all'); // all, customers, suppliers, personnel, shareholders
    const [trazSortOrder, setTrazSortOrder] = useState<'desc' | 'asc'>('desc');

    // --- TAB 2: STATEMENT STATE ---
    const [tafsilis, setTafsilis] = useState<any[]>([]);
    const [selectedTafsili, setSelectedTafsili] = useState('');
    const [tafsiliSearch, setTafsiliSearch] = useState('');
    const [statementSearch, setStatementSearch] = useState('');
    const [statementData, setStatementData] = useState<any[]>([]);

    // --- TAB 3: SALES STATE ---
    const [salesData, setSalesData] = useState<any[]>([]);
    const [compareMode, setCompareMode] = useState(false);
    // Period B for sales comparison
    const [salesDateFromB, setSalesDateFromB] = useState('');
    const [salesDateToB, setSalesDateToB] = useState('');
    const [compareSalesDataA, setCompareSalesDataA] = useState<any[]>([]);
    const [compareSalesDataB, setCompareSalesDataB] = useState<any[]>([]);

    // --- TAB 4: PRODUCTION STATE ---
    const [productionData, setProductionData] = useState<any[]>([]);
    const [prodGrouping, setProdGrouping] = useState<'group' | 'item' | 'date'>('group');
    const [prodSearch, setProdSearch] = useState('');

    // --- TAB 5: CHEQUES STATE ---
    const [chequesData, setChequesData] = useState<any[]>([]);
    const [chequeStatusFilter, setChequeStatusFilter] = useState('all'); // all, in_hand, at_bank, returned, spent
    const [chequeSearch, setChequeSearch] = useState('');

    // ==========================================
    // DATE INITIALIZATION & CONVERSIONS
    // ==========================================
    const jalaliToGregorianStr = (jalaliStr: string) => {
        if (!jalaliStr) return '';
        try {
            // Convert Persian/Arabic digits to English digits
            let clean = jalaliStr.trim()
                .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
                .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());
            const parts = clean.split('/');
            if (parts.length !== 3) return jalaliStr;
            const jy = parseInt(parts[0], 10);
            const jm = parseInt(parts[1], 10);
            const jd = parseInt(parts[2], 10);
            if (isNaN(jy) || isNaN(jm) || isNaN(jd)) return jalaliStr;
            const g = jalaali.toGregorian(jy, jm, jd);
            return `${g.gy}-${String(g.gm).padStart(2, '0')}-${String(g.gd).padStart(2, '0')}`;
        } catch {
            return jalaliStr;
        }
    };

    const parseTafsiliRaw = (raw: string) => {
        if (!raw) return { moein: '', code: '' };
        const parts = raw.split('-');
        for (const part of parts) {
            const match = part.match(/^(11\d*|31\d*):(\d+)/);
            if (match) {
                return {
                    moein: match[1],
                    code: match[2]
                };
            }
        }
        const match = raw.match(/(11\d*|31\d*):(\d+)/);
        if (match) {
            return {
                moein: match[1],
                code: match[2]
            };
        }
        return { moein: '', code: '' };
    };

    useEffect(() => {
        // Initialize Date range directly in Shamsi
        const today = new Date();
        const jToday = jalaali.toJalaali(today.getFullYear(), today.getMonth() + 1, today.getDate());
        
        // Since active year is 1404, we default to 1404/01/01 as start date and today as end date
        const activeYear = jToday.jy === 1405 ? 1404 : jToday.jy;
        const initialFrom = `${activeYear}/01/01`;
        const initialTo = `${jToday.jy}/${String(jToday.jm).padStart(2, '0')}/${String(jToday.jd).padStart(2, '0')}`;
        
        setDateFrom(initialFrom);
        setDateTo(initialTo);

        // Previous year default for comparisons
        const startPrev = `${activeYear - 1}/01/01`;
        const endPrev = `${jToday.jy - 1}/${String(jToday.jm).padStart(2, '0')}/${String(jToday.jd).padStart(2, '0')}`;
        setSalesDateFromB(startPrev);
        setSalesDateToB(endPrev);

        fetchTafsilis();
    }, []);

    const formatMoney = (val: number) => new Intl.NumberFormat('fa-IR').format(Math.round(Math.abs(val)));
    
    const formatDateToJalali = (dateStr: string) => {
        if (!dateStr) return '';
        if (dateStr.includes('/')) return dateStr; // Already Shamsi!
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return dateStr;
            const j = jalaali.toJalaali(d.getFullYear(), d.getMonth() + 1, d.getDate());
            return `${j.jy}/${String(j.jm).padStart(2, '0')}/${String(j.jd).padStart(2, '0')}`;
        } catch {
            return dateStr;
        }
    };

    // ==========================================
    // BACKEND DATABASE COMMUNICATORS (Sayan Proxy)
    // ==========================================
    const runSayanQuery = async (queryStr: string) => {
        const res = await fetch('/api/sayan-proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                path: '/query',
                method: 'POST',
                body: { query: queryStr }
            })
        });
        if (!res.ok) {
            const errDetails = await res.json().catch(() => ({}));
            throw new Error(errDetails.error || 'خطای سرور سایان');
        }
        const data = await res.json();
        return data.data || [];
    };

    const fetchTafsilis = async () => {
        try {
            const sql = `
                SELECT DISTINCT 
                    Field_003 as Code, 
                    Field_006 as Name, 
                    Field_005 as TafsiliCode,
                    Field_004 as MoeinGroup
                FROM ACT_TBL_007 
                WHERE Field_004 LIKE '11%' OR Field_004 LIKE '31%' OR Field_003 LIKE '11%' OR Field_003 LIKE '31%'
                ORDER BY Field_006 ASC
            `;
            const data = await runSayanQuery(sql);
            setTafsilis(data);
        } catch (err) {
            console.error('Error fetching Sayan Tafsilis', err);
        }
    };

    // ==========================================
    // TAB 1: TRAZ (DEBTORS / CREDITORS)
    // ==========================================
    const fetchTraz = async () => {
        setIsLoading(true);
        try {
            let sql = '';
            // If date filter is defined, query transactional tables with Sanad headers
            if (dateFrom && dateTo) {
                const gregFrom = jalaliToGregorianStr(dateFrom);
                const gregTo = jalaliToGregorianStr(dateTo);
                sql = `
                    SELECT 
                        t9.Field_015 as TafsiliRaw,
                        SUM(CAST(t9.Field_009 AS FLOAT)) as TotalBed,
                        SUM(CAST(t9.Field_010 AS FLOAT)) as TotalBes
                    FROM ACT_TBL_009 t9
                    LEFT JOIN ACT_TBL_008 t8 ON t9.Field_004 = t8.Field_006 AND t9.Field_003 = t8.Field_004
                    WHERE (t9.Field_015 LIKE '11%' OR t9.Field_015 LIKE '%-11%' OR t9.Field_015 LIKE '31%' OR t9.Field_015 LIKE '%-31%') 
                      AND t9.Field_007 NOT IN ('103', '107', '109', '114', '116', '117') 
                      AND t9.Field_005 <> '9'
                      AND t8.Field_008 >= '${gregFrom}T00:00:00.000Z' 
                      AND t8.Field_008 <= '${gregTo}T23:59:59.000Z'
                    GROUP BY t9.Field_015
                `;
            } else {
                // aggregate speeds
                sql = `
                    SELECT 
                        t24.Field_010 as TafsiliRaw,
                        SUM(CAST(t24.Field_006 AS FLOAT)) as TotalBed,
                        SUM(CAST(t24.Field_007 AS FLOAT)) as TotalBes
                    FROM ACT_TBL_024 t24
                    WHERE (t24.Field_010 LIKE '11%' OR t24.Field_010 LIKE '%-11%' OR t24.Field_010 LIKE '31%' OR t24.Field_010 LIKE '%-31%') 
                      AND t24.Field_005 NOT IN ('103', '107', '109', '114', '116', '117')
                      AND t24.Field_003 <> '9'
                    GROUP BY t24.Field_010
                `;
            }
            
            const rawData = await runSayanQuery(sql);
            
            // Map Sayan codes to names from ACT_TBL_007
            const mapped = rawData.map((row: any) => {
                const parsed = parseTafsiliRaw(row.TafsiliRaw);
                const code = parsed.code;
                const tafsili = tafsilis.find(t => t.Code === code || t.TafsiliCode === code);
                const name = tafsili ? tafsili.Name : `کد اشخاص ${code}`;
                const bed = parseFloat(row.TotalBed || 0);
                const bes = parseFloat(row.TotalBes || 0);
                const balance = bed - bes;
                return { code, name, bed, bes, balance };
            }).filter((r: any) => r.code && r.balance !== 0);

            setTrazData(mapped);
        } catch (err: any) {
            toast.error(`خطا در دریافت تراز سایان: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    // Filter and categorise Traz data
    const getFilteredTraz = () => {
        let items = trazData.filter(item => {
            const matchesSearch = item.name.toLowerCase().includes(trazSearch.toLowerCase()) || 
                                  item.code.includes(trazSearch);
            
            if (!matchesSearch) return false;

            // Categories split logic
            if (trazCategory === 'customers') {
                return item.name.includes('مشتری') || item.name.includes('خریدار');
            } else if (trazCategory === 'suppliers') {
                return item.name.includes('تامین') || item.name.includes('فروشنده') || item.name.includes('شرکت');
            } else if (trazCategory === 'personnel') {
                return item.name.includes('پرسنل') || item.name.includes('همکار') || item.name.includes('آقای') || item.name.includes('خانم');
            } else if (trazCategory === 'shareholders') {
                return item.name.includes('سهام') || item.name.includes('هیئت');
            }
            return true;
        });

        // Sorting by absolute balance
        items.sort((a, b) => {
            const valA = Math.abs(a.balance);
            const valB = Math.abs(b.balance);
            return trazSortOrder === 'desc' ? valB - valA : valA - valB;
        });

        return items;
    };

    // Print/PDF debtors & creditors separately
    const handlePrintTrazReport = (type: 'bed' | 'bes') => {
        const fullList = getFilteredTraz();
        const sortedList = fullList
            .filter(t => type === 'bed' ? t.balance > 0 : t.balance < 0)
            .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance));

        const title = type === 'bed' ? 'گزارش مانده بدهکاران (صعودی به نزولی)' : 'گزارش مانده بستانکاران (صعودی به نزولی)';
        const docHtml = `
            <html dir="rtl" lang="fa">
            <head>
                <meta charset="utf-8">
                <title>${title}</title>
                <style>
                    body { font-family: 'Tahoma', 'Segoe UI', sans-serif; padding: 25px; background: #fff; color: #333; }
                    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 15px; margin-bottom: 25px; }
                    .header h1 { margin: 0; font-size: 20px; color: #0f172a; }
                    .header p { margin: 4px 0 0; font-size: 13px; color: #475569; }
                    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                    th, td { border: 1px solid #cbd5e1; padding: 10px 12px; text-align: right; font-size: 12px; }
                    th { background-color: #f8fafc; font-weight: bold; color: #0f172a; }
                    tr:nth-child(even) { background-color: #f1f5f9; }
                    .total { font-weight: bold; background: #e2e8f0 !important; }
                    .footer { text-align: center; margin-top: 40px; font-size: 11px; color: #64748b; border-top: 1px dashed #cbd5e1; padding-top: 15px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <div>
                        <h1>${title}</h1>
                        <p>دوره مالی: از ${formatDateToJalali(dateFrom)} تا ${formatDateToJalali(dateTo)}</p>
                    </div>
                    <div style="text-align: left;">
                        <p>تاریخ چاپ: ${formatDateToJalali(new Date().toISOString())}</p>
                        <p>تعداد ردیف: ${sortedList.length}</p>
                    </div>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th style="width: 60px; text-align: center;">ردیف</th>
                            <th style="width: 120px;">کد حسابداری</th>
                            <th>نام شخص</th>
                            <th style="text-align: left; width: 200px;">مبلغ مانده (ریال)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${sortedList.map((row, idx) => `
                            <tr>
                                <td style="text-align: center;">${idx + 1}</td>
                                <td>${row.code}</td>
                                <td>${row.name}</td>
                                <td style="text-align: left; font-weight: 500;">${formatMoney(row.balance)}</td>
                            </tr>
                        `).join('')}
                        <tr class="total">
                            <td colspan="3" style="text-align: left;">جمع کل مانده‌ها:</td>
                            <td style="text-align: left;">${formatMoney(sortedList.reduce((sum, r) => sum + r.balance, 0))}</td>
                        </tr>
                    </tbody>
                </table>
                <div class="footer">
                    <p>سیستم گزارشات حسابداری یکپارچه سایان ERP</p>
                </div>
            </body>
            </html>
        `;

        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(docHtml);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => {
                printWindow.print();
                printWindow.close();
            }, 500);
        }
    };

    // ==========================================
    // TAB 2: DETAILED STATEMENT (صورتحساب ریز تراکنش‌ها)
    // ==========================================
    const fetchStatement = async () => {
        if (!selectedTafsili) {
            toast.error('لطفاً ابتدا شخص مورد نظر را انتخاب کنید');
            return;
        }
        setIsLoading(true);
        try {
            const gregFrom = jalaliToGregorianStr(dateFrom);
            const gregTo = jalaliToGregorianStr(dateTo);
            
            const selectedInfo = tafsilis.find(t => t.Code === selectedTafsili);
            const shortTafsiliCode = selectedInfo ? selectedInfo.TafsiliCode : '';
            
            let tafsiliFilter = `(
                t9.Field_015 LIKE '%:${selectedTafsili}%' OR 
                t9.Field_014 LIKE '%:${selectedTafsili}%' OR
                t9.Field_015 LIKE '%:${selectedTafsili}' OR 
                t9.Field_014 LIKE '%:${selectedTafsili}'
            )`;
            
            if (shortTafsiliCode) {
                const code31 = '31' + shortTafsiliCode;
                tafsiliFilter = `(
                    t9.Field_015 LIKE '%:${selectedTafsili}%' OR 
                    t9.Field_014 LIKE '%:${selectedTafsili}%' OR
                    t9.Field_015 LIKE '%:${selectedTafsili}' OR 
                    t9.Field_014 LIKE '%:${selectedTafsili}' OR
                    t9.Field_015 LIKE '%:${shortTafsiliCode}%' OR 
                    t9.Field_014 LIKE '%:${shortTafsiliCode}%' OR
                    t9.Field_015 LIKE '%:${shortTafsiliCode}' OR 
                    t9.Field_014 LIKE '%:${shortTafsiliCode}' OR
                    t9.Field_015 LIKE '%:${code31}%' OR 
                    t9.Field_014 LIKE '%:${code31}%' OR
                    t9.Field_015 LIKE '%:${code31}' OR 
                    t9.Field_014 LIKE '%:${code31}'
                )`;
            }

            const sql = `
                SELECT 
                    t9.Field_004 as SanadNo,
                    t9.Field_009 as Bed,
                    t9.Field_010 as Bes,
                    t9.Field_011 as Description,
                    t8.Field_008 as Date,
                    t9.Field_005 as MoeinGroup,
                    t9.Field_006 as MoeinParent,
                    t9.Field_007 as MoeinCode,
                    m3.Field_006 as MoeinName
                FROM ACT_TBL_009 t9
                LEFT JOIN ACT_TBL_008 t8 ON t9.Field_004 = t8.Field_006 AND t9.Field_003 = t8.Field_004
                LEFT JOIN ACT_TBL_003 m3 ON t9.Field_005 = m3.Field_003 AND t9.Field_006 = m3.Field_004 AND t9.Field_007 = m3.Field_005
                WHERE ${tafsiliFilter} 
                  AND t9.Field_007 NOT IN ('103', '107', '109', '114', '116', '117')
                  AND t9.Field_005 <> '9'
                  AND t8.Field_008 >= '${gregFrom}T00:00:00.000Z'
                  AND t8.Field_008 <= '${gregTo}T23:59:59.000Z'
                ORDER BY t8.Field_008 ASC, CAST(t9.Field_001 AS INT) ASC
            `;
            const data = await runSayanQuery(sql);
            
            let balanceAccumulator = 0;
            const processed = data.map((row: any) => {
                const bed = parseFloat(row.Bed || 0);
                const bes = parseFloat(row.Bes || 0);
                balanceAccumulator += (bed - bes);
                return {
                    ...row,
                    bed,
                    bes,
                    balance: balanceAccumulator
                };
            });
            setStatementData(processed);
        } catch (err: any) {
            toast.error(`خطا در واکشی صورتحساب: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const filteredStatementData = statementData.filter(row => !statementSearch || (row.Description || '').includes(statementSearch) || String(row.SanadNo).includes(statementSearch));

    const handlePrintStatement = () => {
        if (filteredStatementData.length === 0) return;

        const tafsiliInfo = tafsilis.find(t => t.Code === selectedTafsili);
        const name = tafsiliInfo ? tafsiliInfo.Name : selectedTafsili;
        
        const docHtml = `
            <html dir="rtl" lang="fa">
            <head>
                <meta charset="utf-8">
                <title>ریز صورتحساب - ${name}</title>
                <style>
                    body { font-family: 'Tahoma', sans-serif; padding: 25px; background: #fff; }
                    .header { border-bottom: 2px solid #334155; padding-bottom: 10px; margin-bottom: 20px; }
                    .header h1 { font-size: 18px; margin: 0; }
                    table { width: 100%; border-collapse: collapse; }
                    th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: right; font-size: 11px; }
                    th { background-color: #f1f5f9; }
                    .total { font-weight: bold; background: #f8fafc; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>ریز صورتحساب تراکنش‌ها</h1>
                    <p>شخص: <strong>${name} (کد: ${selectedTafsili})</strong></p>
                    <p>بازه گزارش: از ${formatDateToJalali(dateFrom)} تا ${formatDateToJalali(dateTo)}</p>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>ردیف</th>
                            <th>تاریخ</th>
                            <th>شماره سند</th>
                            <th>سرفصل معین</th>
                            <th>شرح تراکنش</th>
                            <th>بدهکار (ریال)</th>
                            <th>بستانکار (ریال)</th>
                            <th>مانده (ریال)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filteredStatementData.map((row, idx) => `
                            <tr>
                                <td>${idx + 1}</td>
                                <td>${formatDateToJalali(row.Date)}</td>
                                <td>${row.SanadNo}</td>
                                <td>${row.MoeinGroup && row.MoeinParent && row.MoeinCode ? `${row.MoeinGroup}${row.MoeinParent}${row.MoeinCode} - ${row.MoeinName || 'سایر'}` : '-'}</td>
                                <td>${row.Description || ''}</td>
                                <td>${row.bed > 0 ? formatMoney(row.bed) : '۰'}</td>
                                <td>${row.bes > 0 ? formatMoney(row.bes) : '۰'}</td>
                                <td>${formatMoney(row.balance)} (${row.balance > 0 ? 'بدهکار' : row.balance < 0 ? 'بستانکار' : 'بی‌حساب'})</td>
                            </tr>
                        `).join('')}
                        <tr class="total">
                            <td colspan="5" style="text-align: left;">جمع کل:</td>
                            <td>${formatMoney(filteredStatementData.reduce((sum, r) => sum + r.bed, 0))}</td>
                            <td>${formatMoney(filteredStatementData.reduce((sum, r) => sum + r.bes, 0))}</td>
                            <td>${formatMoney(filteredStatementData[filteredStatementData.length - 1]?.balance || 0)}</td>
                        </tr>
                    </tbody>
                </table>
            </body>
            </html>
        `;

        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(docHtml);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => {
                printWindow.print();
                printWindow.close();
            }, 500);
        }
    };

    // ==========================================
    // TAB 3: SALES & COMPARISONS (گزارش فروش و مقایسه فصلی)
    // ==========================================
    const fetchSalesData = async () => {
        setIsLoading(true);
        try {
            const gregFrom = jalaliToGregorianStr(dateFrom);
            const gregTo = jalaliToGregorianStr(dateTo);
            
            // Fetch Period A
            const sqlA = `
                SELECT 
                    t10.Field_001 as DocId,
                    t10.Field_008 as Date,
                    t10.Field_029 as Notes,
                    t11.Field_005 as ItemCode,
                    t22.Field_004 as ItemName,
                    t11.Field_006 as Quantity,
                    t11.Field_031 as ItemNotes,
                    t11.Field_037 as Amount,
                    t02.Field_003 as GroupName
                FROM STR_TBL_010 t10
                INNER JOIN STR_TBL_011 t11 ON t10.Field_001 = t11.Field_004
                LEFT JOIN IND_TBL_022 t22 ON t11.Field_005 = t22.Field_005
                LEFT JOIN IND_TBL_021 t21 ON t11.Field_005 = t21.Field_004
                LEFT JOIN IND_TBL_002 t02 ON t21.Field_003 = t02.Field_003
                WHERE t10.Field_009 IN ('3', '12')
                  AND t10.Field_008 >= '${gregFrom}T00:00:00.000Z' 
                  AND t10.Field_008 <= '${gregTo}T23:59:59.000Z'
                ORDER BY t10.Field_008 DESC
            `;
            const dataA = await runSayanQuery(sqlA);
            setSalesData(dataA);
            setCompareSalesDataA(dataA);

            // Fetch Period B for comparison if active
            if (compareMode && salesDateFromB && salesDateToB) {
                const gregFromB = jalaliToGregorianStr(salesDateFromB);
                const gregToB = jalaliToGregorianStr(salesDateToB);
                const sqlB = `
                    SELECT 
                        t10.Field_001 as DocId,
                        t10.Field_008 as Date,
                        t10.Field_029 as Notes,
                        t11.Field_005 as ItemCode,
                        t22.Field_004 as ItemName,
                        t11.Field_006 as Quantity,
                        t11.Field_031 as ItemNotes,
                        t11.Field_037 as Amount,
                        t02.Field_003 as GroupName
                    FROM STR_TBL_010 t10
                    INNER JOIN STR_TBL_011 t11 ON t10.Field_001 = t11.Field_004
                    LEFT JOIN IND_TBL_022 t22 ON t11.Field_005 = t22.Field_005
                    LEFT JOIN IND_TBL_021 t21 ON t11.Field_005 = t21.Field_004
                    LEFT JOIN IND_TBL_002 t02 ON t21.Field_003 = t02.Field_003
                    WHERE t10.Field_009 IN ('3', '12')
                      AND t10.Field_008 >= '${gregFromB}T00:00:00.000Z' 
                      AND t10.Field_008 <= '${gregToB}T23:59:59.000Z'
                    ORDER BY t10.Field_008 DESC
                `;
                const dataB = await runSayanQuery(sqlB);
                setCompareSalesDataB(dataB);
            }
        } catch (err: any) {
            toast.error(`خطا در واکشی اطلاعات فروش: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    // Calculate sales overviews for Period A (Daily, Monthly, Quarterly, Yearly)
    const getSalesOverviewStats = () => {
        const stats = {
            todayAmt: 0,
            todayQty: 0,
            monthAmt: 0,
            monthQty: 0,
            quarterAmt: 0,
            quarterQty: 0,
            yearAmt: 0,
            yearQty: 0
        };

        const now = new Date();
        const jNow = jalaali.toJalaali(now.getFullYear(), now.getMonth() + 1, now.getDate());

        salesData.forEach(row => {
            const date = new Date(row.Date);
            const amt = parseFloat(row.Amount || 0);
            const qty = parseFloat(row.Quantity || 0);
            const jRow = jalaali.toJalaali(date.getFullYear(), date.getMonth() + 1, date.getDate());

            // Yearly (Current Persian Year)
            if (jRow.jy === jNow.jy) {
                stats.yearAmt += amt;
                stats.yearQty += qty;

                // Monthly (Current Persian Month)
                if (jRow.jm === jNow.jm) {
                    stats.monthAmt += amt;
                    stats.monthQty += qty;

                    // Daily (Current Persian Day)
                    if (jRow.jd === jNow.jd) {
                        stats.todayAmt += amt;
                        stats.todayQty += qty;
                    }
                }

                // Quarterly
                const rowQuarter = Math.ceil(jRow.jm / 3);
                const nowQuarter = Math.ceil(jNow.jm / 3);
                if (rowQuarter === nowQuarter) {
                    stats.quarterAmt += amt;
                    stats.quarterQty += qty;
                }
            }
        });

        return stats;
    };

    // Prepare chart comparison data grouped by Product Group
    const getComparisonChartData = () => {
        const groups: { [key: string]: { name: string; amountA: number; weightA: number; amountB: number; weightB: number; } } = {};

        compareSalesDataA.forEach(row => {
            const grp = row.GroupName || 'سایر گروه‌ها';
            if (!groups[grp]) {
                groups[grp] = { name: grp, amountA: 0, weightA: 0, amountB: 0, weightB: 0 };
            }
            groups[grp].amountA += parseFloat(row.Amount || 0);
            groups[grp].weightA += parseFloat(row.Quantity || 0);
        });

        compareSalesDataB.forEach(row => {
            const grp = row.GroupName || 'سایر گروه‌ها';
            if (!groups[grp]) {
                groups[grp] = { name: grp, amountA: 0, weightA: 0, amountB: 0, weightB: 0 };
            }
            groups[grp].amountB += parseFloat(row.Amount || 0);
            groups[grp].weightB += parseFloat(row.Quantity || 0);
        });

        return Object.values(groups);
    };

    // ==========================================
    // TAB 4: PRODUCTION (تولید روزانه)
    // ==========================================
    const fetchProduction = async () => {
        setIsLoading(true);
        try {
            const gregFrom = jalaliToGregorianStr(dateFrom);
            const gregTo = jalaliToGregorianStr(dateTo);
            const sql = `
                SELECT 
                    t33.Field_001 as ProdId,
                    t33.Field_004 as ProductCode,
                    t33.Field_006 as GrossWeight,
                    t33.Field_008 as Details,
                    t33.Field_024 as Date,
                    t33.Field_016 as BatchNo,
                    t22.Field_004 as ProductName,
                    t02.Field_003 as GroupName
                FROM IND_TBL_033 t33
                LEFT JOIN IND_TBL_022 t22 ON t33.Field_004 = t22.Field_005
                LEFT JOIN IND_TBL_021 t33.Field_004 = t21.Field_004
                LEFT JOIN IND_TBL_002 t02 ON t21.Field_003 = t02.Field_003
                WHERE t33.Field_024 >= '${gregFrom}T00:00:00.000Z'
                  AND t33.Field_024 <= '${gregTo}T23:59:59.000Z'
                ORDER BY t33.Field_024 DESC
            `;
            
            // Safe fallback if advanced joins fail
            let data = [];
            try {
                data = await runSayanQuery(sql);
            } catch {
                // simple query fallback
                data = await runSayanQuery(`
                    SELECT 
                        Field_001 as ProdId,
                        Field_004 as ProductCode,
                        Field_006 as GrossWeight,
                        Field_008 as Details,
                        Field_024 as Date
                    FROM IND_TBL_033
                    WHERE Field_024 >= '${gregFrom}T00:00:00.000Z'
                      AND Field_024 <= '${gregTo}T23:59:59.000Z'
                    ORDER BY Field_024 DESC
                `);
            }

            // Parse detailed fields serialized in Field_008
            const processed = data.map((row: any) => {
                const details: any = {};
                if (row.Details) {
                    row.Details.split('|').forEach((p: string) => {
                        const [k, v] = p.split(':').map(s => s.trim());
                        if (k && v) details[k] = v;
                    });
                }
                return {
                    id: row.ProdId,
                    code: row.ProductCode,
                    date: row.Date,
                    productName: row.ProductName || details['کالا'] || row.ProductCode,
                    groupName: row.GroupName || 'سایر تولیدات',
                    grossWeight: parseFloat(row.GrossWeight || details['وزن ناخالص'] || 0),
                    netWeight: parseFloat(details['وزن خالص'] || row.GrossWeight || 0),
                    bobbinCount: parseInt(details['تعداد بوبین'] || 0),
                    cartonCount: parseInt(details['تعداد کارتن'] || 0),
                    machineNo: details['شماره دستگاه'] || 'نامشخص',
                    shift: details['شیفت'] || 'نامشخص',
                    grade: details['گرید'] || 'نامشخص'
                };
            });

            setProductionData(processed);
        } catch (err: any) {
            toast.error(`خطا در دریافت لیست تولید: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    // Aggregate production by selection
    const getGroupedProduction = () => {
        const filtered = productionData.filter(p => 
            p.productName.toLowerCase().includes(prodSearch.toLowerCase()) || 
            p.code.includes(prodSearch) ||
            p.groupName.toLowerCase().includes(prodSearch.toLowerCase())
        );

        if (prodGrouping === 'date') {
            const groups: { [key: string]: any } = {};
            filtered.forEach(p => {
                const day = formatDateToJalali(p.date);
                if (!groups[day]) {
                    groups[day] = { key: day, gross: 0, net: 0, cartons: 0, bobbins: 0, count: 0, details: [] };
                }
                groups[day].gross += p.grossWeight;
                groups[day].net += p.netWeight;
                groups[day].cartons += p.cartonCount;
                groups[day].bobbins += p.bobbinCount;
                groups[day].count += 1;
                groups[day].details.push(p);
            });
            return Object.values(groups);
        } else if (prodGrouping === 'group') {
            const groups: { [key: string]: any } = {};
            filtered.forEach(p => {
                const grp = p.groupName;
                if (!groups[grp]) {
                    groups[grp] = { key: grp, gross: 0, net: 0, cartons: 0, bobbins: 0, count: 0, details: [] };
                }
                groups[grp].gross += p.grossWeight;
                groups[grp].net += p.netWeight;
                groups[grp].cartons += p.cartonCount;
                groups[grp].bobbins += p.bobbinCount;
                groups[grp].count += 1;
                groups[grp].details.push(p);
            });
            return Object.values(groups);
        } else {
            // Group by product item
            const groups: { [key: string]: any } = {};
            filtered.forEach(p => {
                const prod = p.productName;
                if (!groups[prod]) {
                    groups[prod] = { key: prod, code: p.code, gross: 0, net: 0, cartons: 0, bobbins: 0, count: 0, details: [] };
                }
                groups[prod].gross += p.grossWeight;
                groups[prod].net += p.netWeight;
                groups[prod].cartons += p.cartonCount;
                groups[prod].bobbins += p.bobbinCount;
                groups[prod].count += 1;
                groups[prod].details.push(p);
            });
            return Object.values(groups);
        }
    };

    // ==========================================
    // TAB 5: CHEQUES (لیست چک‌های دریافتی و پرداختی)
    // ==========================================
    const fetchCheques = async () => {
        setIsLoading(true);
        try {
            const sql = `
                SELECT 
                    Field_001 as Id,
                    Field_004 as StatusType,
                    Field_005 as ChequeNo,
                    Field_006 as DueDate,
                    Field_009 as BankName,
                    Field_011 as DrawerName,
                    Field_013 as Amount,
                    Field_015 as StatusDesc
                FROM BUR_TBL_012
                ORDER BY Field_006 ASC
            `;
            const data = await runSayanQuery(sql);
            const mapped = data.map((row: any) => {
                const amt = parseFloat(row.Amount || 0);
                const desc = String(row.StatusDesc || '').trim();
                
                // Categorization logic based on status string
                let statusGroup = 'in_hand'; // default نزد صندوق
                if (desc.includes('بانک') || desc.includes('کلر')) {
                    statusGroup = 'at_bank';
                } else if (desc.includes('برگشت') || desc.includes('واخواست')) {
                    statusGroup = 'returned';
                } else if (desc.includes('وصول') || desc.includes('خرج') || desc.includes('پرداخت')) {
                    statusGroup = 'spent';
                }

                return {
                    id: row.Id,
                    chequeNo: row.ChequeNo || 'فاقد شماره',
                    dueDate: row.DueDate,
                    bankName: row.BankName || 'نامشخص',
                    drawerName: row.DrawerName || 'نامشخص',
                    amount: amt,
                    statusDesc: desc || 'نزد صندوق (دریافت شده)',
                    statusGroup
                };
            });
            setChequesData(mapped);
        } catch (err: any) {
            toast.error(`خطا در واکشی اطلاعات چک‌ها: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const getFilteredCheques = () => {
        return chequesData.filter(c => {
            const matchesSearch = c.chequeNo.includes(chequeSearch) || 
                                  c.drawerName.toLowerCase().includes(chequeSearch.toLowerCase()) || 
                                  c.bankName.toLowerCase().includes(chequeSearch.toLowerCase());
            if (!matchesSearch) return false;
            
            if (chequeStatusFilter !== 'all' && c.statusGroup !== chequeStatusFilter) {
                return false;
            }
            return true;
        });
    };

    // ==========================================
    // RE-FETCH ON TAB CHANGE
    // ==========================================
    useEffect(() => {
        if (activeTab === 'traz') {
            fetchTraz();
        } else if (activeTab === 'sales') {
            fetchSalesData();
        } else if (activeTab === 'production') {
            fetchProduction();
        } else if (activeTab === 'cheques') {
            fetchCheques();
        }
    }, [activeTab, dateFrom, dateTo, trazCategory, compareMode, salesDateFromB, salesDateToB, prodGrouping]);

    // Sales calculations
    const stats = getSalesOverviewStats();
    const chartData = getComparisonChartData();
    const filteredTraz = getFilteredTraz();
    const groupedProduction = getGroupedProduction();
    const filteredCheques = getFilteredCheques();

    return (
        <div className="p-4 md:p-8 rtl max-w-7xl mx-auto space-y-6 select-none">
            {/* Main Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-gray-200 pb-5 gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-900 font-sans tracking-tight">گزارشات هوشمند مالی و فروش سایان ERP</h1>
                    <p className="text-sm text-slate-500 mt-1">اتصال بلادرنگ و پایش لحظه‌ای اسناد و داده‌های مالی کارخانه</p>
                </div>
                
                {/* Global Date Filter */}
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-2.5 flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1.5 text-xs text-slate-700 font-bold">
                        <Calendar className="w-4 h-4 text-blue-600" />
                        <span>بازه زمانی گزارش:</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 shadow-inner">
                        <input 
                            type="text" 
                            placeholder="۱۴۰۴/۰۱/۰۱"
                            value={dateFrom}
                            onChange={(e) => setDateFrom(e.target.value)}
                            className="text-xs bg-transparent outline-none focus:ring-0 text-slate-800 font-bold font-mono w-24 text-center"
                        />
                    </div>
                    <span className="text-xs text-slate-400 font-bold">تا</span>
                    <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 shadow-inner">
                        <input 
                            type="text" 
                            placeholder="۱۴۰۴/۱۲/۲۹"
                            value={dateTo}
                            onChange={(e) => setDateTo(e.target.value)}
                            className="text-xs bg-transparent outline-none focus:ring-0 text-slate-800 font-bold font-mono w-24 text-center"
                        />
                    </div>
                    <button 
                        onClick={() => {
                            if (activeTab === 'traz') fetchTraz();
                            if (activeTab === 'sales') fetchSalesData();
                            if (activeTab === 'production') fetchProduction();
                            if (activeTab === 'cheques') fetchCheques();
                        }}
                        className="bg-blue-600 hover:bg-blue-700 text-white rounded text-xs px-3 py-1 font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                    >
                        {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'بروزرسانی'}
                    </button>
                </div>
            </div>

            {/* Premium Tab Bar */}
            <div className="flex space-x-reverse space-x-2 border-b border-slate-200 overflow-x-auto pb-1 bg-slate-50 p-1.5 rounded-lg">
                <button 
                    onClick={() => setActiveTab('traz')} 
                    className={`flex items-center gap-2 py-2.5 px-5 rounded-md text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'traz' ? 'bg-white shadow text-blue-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
                >
                    <ArrowUpDown className="w-4 h-4" />
                    تراز و مانده اشخاص
                </button>
                <button 
                    onClick={() => {
                        setActiveTab('statement');
                        if (tafsilis.length === 0) fetchTafsilis();
                    }} 
                    className={`flex items-center gap-2 py-2.5 px-5 rounded-md text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'statement' ? 'bg-white shadow text-blue-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
                >
                    <FileText className="w-4 h-4" />
                    صورتحساب تراکنش‌ها
                </button>
                <button 
                    onClick={() => setActiveTab('sales')} 
                    className={`flex items-center gap-2 py-2.5 px-5 rounded-md text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'sales' ? 'bg-white shadow text-blue-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
                >
                    <TrendingUp className="w-4 h-4" />
                    فروش و تحلیل مقایسه‌ای
                </button>
                <button 
                    onClick={() => setActiveTab('production')} 
                    className={`flex items-center gap-2 py-2.5 px-5 rounded-md text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'production' ? 'bg-white shadow text-blue-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
                >
                    <Activity className="w-4 h-4" />
                    تولید روزانه
                </button>
                <button 
                    onClick={() => setActiveTab('cheques')} 
                    className={`flex items-center gap-2 py-2.5 px-5 rounded-md text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'cheques' ? 'bg-white shadow text-blue-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
                >
                    <CheckSquare className="w-4 h-4" />
                    لیست چک‌ها
                </button>
            </div>

            {/* TAB CONTENT PANEL */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                
                {/* 1. TRAZ TAB */}
                {activeTab === 'traz' && (
                    <div className="p-6 space-y-6">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                            <div>
                                <h2 className="text-xl font-bold text-slate-800">مانده بدهکاران و بستانکاران</h2>
                                <p className="text-xs text-slate-500 mt-1">تراز اشخاص، سورت شده براساس بیشترین تعهد مالی</p>
                            </div>
                            
                            <div className="flex flex-wrap gap-2">
                                <select 
                                    className="border border-slate-300 rounded-md py-1.5 px-3 text-xs bg-white font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    value={trazCategory}
                                    onChange={(e) => setTrazCategory(e.target.value)}
                                >
                                    <option value="all">همه اشخاص</option>
                                    <option value="customers">مشتریان</option>
                                    <option value="suppliers">تامین کنندگان</option>
                                    <option value="personnel">پرسنل و همکاران</option>
                                    <option value="shareholders">سهام داران</option>
                                </select>

                                <button 
                                    onClick={() => setTrazSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                                    className="flex items-center gap-1 border border-slate-300 rounded-md py-1.5 px-3 text-xs bg-white hover:bg-slate-50 font-medium transition-colors"
                                    title="تغییر جهت مرتب‌سازی"
                                >
                                    <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
                                    <span>سورت: {trazSortOrder === 'desc' ? 'نزولی' : 'صعودی'}</span>
                                </button>
                                
                                <div className="relative w-full md:w-56">
                                    <Search className="absolute right-2.5 top-2.5 h-4 w-4 text-slate-400" />
                                    <input 
                                        type="text"
                                        placeholder="جستجوی شخص..." 
                                        className="w-full pl-3 pr-8 py-1.5 border rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        value={trazSearch}
                                        onChange={(e) => setTrazSearch(e.target.value)}
                                    />
                                </div>

                                <button 
                                    onClick={() => handlePrintTrazReport('bed')} 
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-md border border-rose-200 text-xs font-semibold transition-colors"
                                >
                                    <Printer className="w-3.5 h-3.5" /> خروجی بدهکاران
                                </button>
                                <button 
                                    onClick={() => handlePrintTrazReport('bes')} 
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-md border border-emerald-200 text-xs font-semibold transition-colors"
                                >
                                    <Printer className="w-3.5 h-3.5" /> خروجی بستانکاران
                                </button>
                            </div>
                        </div>

                        {/* Traz KPIs */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-rose-50/50 rounded-xl border border-rose-100/80 p-4">
                                <div className="text-rose-700 font-bold text-xs">جمع بدهی بدهکاران</div>
                                <div className="text-2xl font-extrabold text-rose-900 mt-2 font-mono">
                                    {formatMoney(filteredTraz.filter(t => t.balance > 0).reduce((sum, r) => sum + r.balance, 0))} <span className="text-xs font-medium">ریال</span>
                                </div>
                                <div className="text-[10px] text-rose-600 mt-1">شامل {filteredTraz.filter(t => t.balance > 0).length} شخص بدهکار</div>
                            </div>
                            <div className="bg-emerald-50/50 rounded-xl border border-emerald-100/80 p-4">
                                <div className="text-emerald-700 font-bold text-xs">جمع طلب بستانکاران</div>
                                <div className="text-2xl font-extrabold text-emerald-900 mt-2 font-mono">
                                    {formatMoney(filteredTraz.filter(t => t.balance < 0).reduce((sum, r) => sum + Math.abs(r.balance), 0))} <span className="text-xs font-medium">ریال</span>
                                </div>
                                <div className="text-[10px] text-emerald-600 mt-1">شامل {filteredTraz.filter(t => t.balance < 0).length} شخص بستانکار</div>
                            </div>
                            <div className="bg-blue-50/50 rounded-xl border border-blue-100/80 p-4">
                                <div className="text-blue-700 font-bold text-xs">خالص وضعیت تعهدات</div>
                                <div className="text-2xl font-extrabold text-blue-900 mt-2 font-mono">
                                    {formatMoney(filteredTraz.reduce((sum, r) => sum + r.balance, 0))} <span className="text-xs font-medium">ریال</span>
                                </div>
                                <div className="text-[10px] text-blue-600 mt-1">مانده خالص برآیند حساب‌های جاری</div>
                            </div>
                        </div>

                        {/* Traz Data Table */}
                        <div className="rounded-xl border border-slate-200 overflow-hidden max-h-[500px] overflow-y-auto">
                            <table className="w-full text-right text-xs">
                                <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 z-10">
                                    <tr>
                                        <th className="p-3.5 font-bold text-slate-700 w-16 text-center">ردیف</th>
                                        <th className="p-3.5 font-bold text-slate-700 w-32">کد تفصیلی</th>
                                        <th className="p-3.5 font-bold text-slate-700">نام و نام خانوادگی شخص</th>
                                        <th className="p-3.5 font-bold text-slate-700 text-left">مجموع بدهکار (ریال)</th>
                                        <th className="p-3.5 font-bold text-slate-700 text-left">مجموع بستانکار (ریال)</th>
                                        <th className="p-3.5 font-bold text-slate-700 text-left">مانده حساب (ریال)</th>
                                        <th className="p-3.5 font-bold text-slate-700 w-28 text-center">تشخیص</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredTraz.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="text-center py-12 text-slate-400 font-medium">
                                                {isLoading ? (
                                                    <div className="flex items-center justify-center gap-2">
                                                        <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                                                        <span>در حال واکشی اطلاعات تراز سایان...</span>
                                                    </div>
                                                ) : 'هیچ رکوردی یافت نشد'}
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredTraz.map((row, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="p-3 text-slate-400 text-center font-medium">{idx + 1}</td>
                                                <td className="p-3 font-mono text-slate-600 font-medium">{row.code}</td>
                                                <td className="p-3 font-bold text-slate-900">{row.name}</td>
                                                <td className="p-3 text-left text-rose-600 font-mono font-medium">{formatMoney(row.bed)}</td>
                                                <td className="p-3 text-left text-emerald-600 font-mono font-medium">{formatMoney(row.bes)}</td>
                                                <td className={`p-3 text-left font-extrabold font-mono ${row.balance > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                                                    {formatMoney(row.balance)}
                                                </td>
                                                <td className="p-3 text-center">
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                                                        row.balance > 0 ? 'bg-rose-50 text-rose-700 border border-rose-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                                    }`}>
                                                        {row.balance > 0 ? 'بدهکار' : 'بستانکار'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* 2. STATEMENT TAB */}
                {activeTab === 'statement' && (
                    <div className="p-6 space-y-6">
                        <div className="border-b border-slate-100 pb-4">
                            <h2 className="text-xl font-bold text-slate-800">ریز صورتحساب و دفاترحساب اشخاص</h2>
                            <p className="text-xs text-slate-500 mt-1">مشاهده ریز گردش مالی و جزئیات اسناد حسابداری هر تفصیلی</p>
                        </div>

                        <div className="flex flex-col md:flex-row gap-4 items-end bg-slate-50 p-4 rounded-xl">
                            <div className="flex-1 w-full relative">
                                <label className="block text-xs font-bold mb-1.5 text-slate-700">انتخاب شخص تفصیلی (ACT_TBL_007)</label>
                                <div className="flex gap-2">
                                    <input 
                                        type="text" 
                                        placeholder="جستجوی شخص..." 
                                        value={tafsiliSearch} 
                                        onChange={e => setTafsiliSearch(e.target.value)} 
                                        className="w-1/3 border border-slate-300 rounded-md py-2 px-3 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white" 
                                    />
                                    <select 
                                        className="w-2/3 border border-slate-300 rounded-md py-2 px-3 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white font-bold"
                                        value={selectedTafsili}
                                        onChange={(e) => setSelectedTafsili(e.target.value)}
                                    >
                                        <option value="">-- تفصیلی مورد نظر را انتخاب کنید --</option>
                                        {tafsilis.filter(t => !tafsiliSearch || t.Name?.includes(tafsiliSearch) || t.Code?.includes(tafsiliSearch)).map(t => (
                                            <option key={t.Code} value={t.Code}>{t.Name} (کد: {t.Code})</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="flex gap-2 w-full md:w-auto">
                                <button 
                                    onClick={fetchStatement} 
                                    disabled={isLoading || !selectedTafsili} 
                                    className="flex-1 md:flex-none px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50 transition-colors"
                                >
                                    {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                                    نمایش صورتحساب
                                </button>
                                <button 
                                    onClick={handlePrintStatement}
                                    disabled={statementData.length === 0}
                                    className="flex-1 md:flex-none px-4 py-2 border border-slate-300 bg-white hover:bg-slate-50 rounded-md text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50 transition-colors"
                                >
                                    <Printer className="w-3.5 h-3.5 text-slate-500" />
                                    چاپ / PDF
                                </button>
                            </div>
                        </div>

                        {statementData.length > 0 && (
                            <div className="flex justify-end mb-2">
                                <input 
                                    type="text" 
                                    placeholder="جستجو در شرح تراکنش..." 
                                    value={statementSearch} 
                                    onChange={e => setStatementSearch(e.target.value)} 
                                    className="w-full md:w-1/3 border border-slate-300 rounded-md py-2 px-3 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white" 
                                />
                            </div>
                        )}

                        {statementData.length > 0 ? (
                            <div className="space-y-4">
                                <div className="rounded-xl border border-slate-200 overflow-hidden max-h-[450px] overflow-y-auto">
                                    <table className="w-full text-right text-xs">
                                        <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 z-10">
                                            <tr>
                                                <th className="p-3 font-bold text-slate-700 w-24">تاریخ سند</th>
                                                <th className="p-3 font-bold text-slate-700 w-24">شماره سند</th>
                                                <th className="p-3 font-bold text-slate-700 w-40">سرفصل معین</th>
                                                <th className="p-3 font-bold text-slate-700">شرح آرتیکل</th>
                                                <th className="p-3 font-bold text-slate-700 text-left w-36">بدهکار (ریال)</th>
                                                <th className="p-3 font-bold text-slate-700 text-left w-36">بستانکار (ریال)</th>
                                                <th className="p-3 font-bold text-slate-700 text-left w-40">مانده حساب (ریال)</th>
                                                <th className="p-3 font-bold text-slate-700 w-20 text-center">تشخیص</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {filteredStatementData.map((row, idx) => (
                                                <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="p-3 font-medium text-slate-500 whitespace-nowrap">{formatDateToJalali(row.Date)}</td>
                                                    <td className="p-3 font-mono text-slate-600 font-semibold">{row.SanadNo}</td>
                                                    <td className="p-3 text-slate-600 font-medium whitespace-nowrap">
                                                        {row.MoeinGroup && row.MoeinParent && row.MoeinCode ? (
                                                            <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded text-[10px] font-extrabold">
                                                                {row.MoeinGroup}{row.MoeinParent}{row.MoeinCode} - {row.MoeinName || 'سایر'}
                                                            </span>
                                                        ) : (
                                                            '-'
                                                        )}
                                                    </td>
                                                    <td className="p-3 font-medium text-slate-800 leading-relaxed">{row.Description || 'ثبت حسابداری'}</td>
                                                    <td className="p-3 text-left text-rose-600 font-mono font-medium">{row.bed > 0 ? formatMoney(row.bed) : '-'}</td>
                                                    <td className="p-3 text-left text-emerald-600 font-mono font-medium">{row.bes > 0 ? formatMoney(row.bes) : '-'}</td>
                                                    <td className={`p-3 text-left font-extrabold font-mono ${row.balance > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                                                        {formatMoney(row.balance)}
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                                                            row.balance > 0 ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'
                                                        }`}>
                                                            {row.balance > 0 ? 'بدهکار' : 'بستانکار'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                            
                                            {/* Summary Sticky Foot */}
                                            <tr className="bg-slate-50 font-extrabold sticky bottom-0 border-t-2 border-slate-200 shadow-[0_-2px_6px_rgba(0,0,0,0.03)] z-10">
                                                <td colSpan={4} className="p-4 text-left font-extrabold text-slate-700">مجموع دوره تراکنش‌ها:</td>
                                                <td className="p-4 text-left text-rose-700 font-mono text-sm">
                                                    {formatMoney(filteredStatementData.reduce((sum, r) => sum + r.bed, 0))}
                                                </td>
                                                <td className="p-4 text-left text-emerald-700 font-mono text-sm">
                                                    {formatMoney(filteredStatementData.reduce((sum, r) => sum + r.bes, 0))}
                                                </td>
                                                <td colSpan={2} className={`p-4 text-left font-black font-mono text-sm ${
                                                    filteredStatementData[filteredStatementData.length - 1]?.balance > 0 ? 'text-rose-700' : 'text-emerald-700'
                                                }`}>
                                                    {formatMoney(filteredStatementData[filteredStatementData.length - 1]?.balance || 0)}
                                                    <span className="text-[10px] font-bold mr-1">
                                                        ({(filteredStatementData[filteredStatementData.length - 1]?.balance || 0) > 0 ? 'بدهکار' : 'بستانکار'})
                                                    </span>
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-16 text-slate-400 font-medium border-2 border-dashed border-slate-200 rounded-xl">
                                {isLoading ? 'در حال دریافت ریز حساب سایان...' : 'شخص را انتخاب کرده و دکمه نمایش صورتحساب را بزنید'}
                            </div>
                        )}
                    </div>
                )}

                {/* 3. SALES & COMPARISONS TAB */}
                {activeTab === 'sales' && (
                    <div className="p-6 space-y-6">
                        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 pb-4 gap-4">
                            <div>
                                <h2 className="text-xl font-bold text-slate-800">تحلیل پیشرفته فروش سایان</h2>
                                <p className="text-xs text-slate-500 mt-1">پایش دوره‌ای فروش با ابزار مقایسه‌ای پیشرفته محصول و وزن کالا</p>
                            </div>
                            
                            <div className="flex items-center gap-2">
                                <label className="flex items-center gap-1.5 cursor-pointer bg-slate-50 hover:bg-slate-100 px-3 py-2 rounded-lg border border-slate-200 transition-colors">
                                    <input 
                                        type="checkbox" 
                                        checked={compareMode}
                                        onChange={(e) => setCompareMode(e.target.checked)}
                                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="text-xs font-bold text-slate-700">فعال‌سازی مقایسه دو بازه</span>
                                </label>
                            </div>
                        </div>

                        {/* Comparison date pickers */}
                        {compareMode && (
                            <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100/60 grid grid-cols-1 md:grid-cols-2 gap-4 animate-fadeIn">
                                <div>
                                    <div className="text-xs font-bold text-blue-700 mb-1.5 flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                        بازه اول ( Period A ) - پیش‌فرض بالا
                                    </div>
                                    <p className="text-[10px] text-slate-500">بازه زمانی که در فیلتر بالای صفحه تنظیم کرده‌اید اعمال می‌شود.</p>
                                </div>
                                <div>
                                    <div className="text-xs font-bold text-blue-700 mb-1.5 flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                                        بازه دوم مقایسه ( Period B )
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded px-2.5 py-1.5 w-full shadow-inner">
                                            <input 
                                                type="text" 
                                                placeholder="۱۴۰۳/۰۱/۰۱"
                                                value={salesDateFromB}
                                                onChange={(e) => setSalesDateFromB(e.target.value)}
                                                className="text-xs bg-transparent outline-none focus:ring-0 text-slate-800 font-bold font-mono w-full text-center"
                                            />
                                        </div>
                                        <span className="text-xs text-slate-400 font-bold">تا</span>
                                        <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded px-2.5 py-1.5 w-full shadow-inner">
                                            <input 
                                                type="text" 
                                                placeholder="۱۴۰۳/۱۲/۲۹"
                                                value={salesDateToB}
                                                onChange={(e) => setSalesDateToB(e.target.value)}
                                                className="text-xs bg-transparent outline-none focus:ring-0 text-slate-800 font-bold font-mono w-full text-center"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Top-level overviews for Period A */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                                <div className="text-slate-500 font-semibold text-[10px]">فروش امروز کارخانه</div>
                                <div className="text-lg font-black text-slate-800 mt-2 font-mono">
                                    {formatMoney(stats.todayAmt)} <span className="text-[10px] font-bold">ریال</span>
                                </div>
                                <div className="text-[10px] text-slate-400 mt-1 font-medium">وزن: {stats.todayQty.toFixed(1)} کیلوگرم</div>
                            </div>
                            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                                <div className="text-slate-500 font-semibold text-[10px]">فروش این ماه</div>
                                <div className="text-lg font-black text-slate-800 mt-2 font-mono">
                                    {formatMoney(stats.monthAmt)} <span className="text-[10px] font-bold">ریال</span>
                                </div>
                                <div className="text-[10px] text-slate-400 mt-1 font-medium">وزن: {stats.monthQty.toFixed(1)} کیلوگرم</div>
                            </div>
                            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                                <div className="text-slate-500 font-semibold text-[10px]">فروش فصل جاری</div>
                                <div className="text-lg font-black text-slate-800 mt-2 font-mono">
                                    {formatMoney(stats.quarterAmt)} <span className="text-[10px] font-bold">ریال</span>
                                </div>
                                <div className="text-[10px] text-slate-400 mt-1 font-medium">وزن: {stats.quarterQty.toFixed(1)} کیلوگرم</div>
                            </div>
                            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                                <div className="text-slate-500 font-semibold text-[10px]">فروش امسال</div>
                                <div className="text-lg font-black text-slate-800 mt-2 font-mono">
                                    {formatMoney(stats.yearAmt)} <span className="text-[10px] font-bold">ریال</span>
                                </div>
                                <div className="text-[10px] text-slate-400 mt-1 font-medium">وزن: {stats.yearQty.toFixed(1)} کیلوگرم</div>
                            </div>
                        </div>

                        {/* Render Recharts Visual Comparison */}
                        {compareMode && chartData.length > 0 && (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                                <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-100">
                                    <h3 className="text-xs font-black text-slate-800 mb-4 text-center">مقایسه فروش گروه کالایی از نظر مبلغ (ریال)</h3>
                                    <div className="h-64">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={chartData}>
                                                <CartesianGrid strokeDasharray="3 3" />
                                                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                                                <YAxis tick={{ fontSize: 10 }} />
                                                <Tooltip />
                                                <Legend wrapperStyle={{ fontSize: 10 }} />
                                                <Bar dataKey="amountA" name="بازه اول (A)" fill="#3b82f6" />
                                                <Bar dataKey="amountB" name="بازه دوم (B)" fill="#818cf8" />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-100">
                                    <h3 className="text-xs font-black text-slate-800 mb-4 text-center">مقایسه حجم فروش گروه کالایی از نظر وزن (کیلوگرم)</h3>
                                    <div className="h-64">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={chartData}>
                                                <CartesianGrid strokeDasharray="3 3" />
                                                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                                                <YAxis tick={{ fontSize: 10 }} />
                                                <Tooltip />
                                                <Legend wrapperStyle={{ fontSize: 10 }} />
                                                <Bar dataKey="weightA" name="بازه اول (A)" fill="#10b981" />
                                                <Bar dataKey="weightB" name="بازه دوم (B)" fill="#6366f1" />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Detailed Sales comparison tables */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-slate-800">
                                {compareMode ? 'جدول مقایسه‌ای جزئی گروه کالایی (مبلغ و وزن)' : 'جدول ریز تراکنش‌های فاکتور فروش'}
                            </h3>
                            
                            <div className="rounded-xl border border-slate-200 overflow-hidden max-h-[400px] overflow-y-auto">
                                <table className="w-full text-right text-xs">
                                    <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 z-10">
                                        {compareMode ? (
                                            <tr>
                                                <th className="p-3.5 font-bold text-slate-700">گروه کالایی</th>
                                                <th className="p-3.5 font-bold text-slate-700 text-left">وزن دوره A (کیلوگرم)</th>
                                                <th className="p-3.5 font-bold text-slate-700 text-left">وزن دوره B (کیلوگرم)</th>
                                                <th className="p-3.5 font-bold text-slate-700 text-center">تغییر وزن (%)</th>
                                                <th className="p-3.5 font-bold text-slate-700 text-left">مبلغ دوره A (ریال)</th>
                                                <th className="p-3.5 font-bold text-slate-700 text-left">مبلغ دوره B (ریال)</th>
                                                <th className="p-3.5 font-bold text-slate-700 text-center">تغییر مبلغ (%)</th>
                                            </tr>
                                        ) : (
                                            <tr>
                                                <th className="p-3.5 font-bold text-slate-700 w-24">تاریخ فاکتور</th>
                                                <th className="p-3.5 font-bold text-slate-700 w-24">شماره سند</th>
                                                <th className="p-3.5 font-bold text-slate-700 w-44">گروه کالا</th>
                                                <th className="p-3.5 font-bold text-slate-700">شرح کالای فاکتور</th>
                                                <th className="p-3.5 font-bold text-slate-700 text-left w-32">وزن خالص (کیلوگرم)</th>
                                                <th className="p-3.5 font-bold text-slate-700 text-left w-36">مجموع مبلغ (ریال)</th>
                                            </tr>
                                        )}
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {compareMode ? (
                                            chartData.length === 0 ? (
                                                <tr>
                                                    <td colSpan={7} className="text-center py-10 text-slate-400 font-medium">موردی یافت نشد. دوره فیلتر را تغییر دهید.</td>
                                                </tr>
                                            ) : (
                                                chartData.map((row, idx) => {
                                                    const weightDiff = row.weightB ? ((row.weightA - row.weightB) / row.weightB) * 100 : 0;
                                                    const amountDiff = row.amountB ? ((row.amountA - row.amountB) / row.amountB) * 100 : 0;
                                                    return (
                                                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                                            <td className="p-3 font-bold text-slate-900">{row.name}</td>
                                                            <td className="p-3 text-left font-mono font-semibold">{row.weightA.toFixed(1)}</td>
                                                            <td className="p-3 text-left font-mono font-semibold">{row.weightB.toFixed(1)}</td>
                                                            <td className="p-3 text-center">
                                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${weightDiff >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                                                                    {weightDiff >= 0 ? '+' : ''}{weightDiff.toFixed(1)}%
                                                                </span>
                                                            </td>
                                                            <td className="p-3 text-left font-mono text-slate-700 font-medium">{formatMoney(row.amountA)}</td>
                                                            <td className="p-3 text-left font-mono text-slate-700 font-medium">{formatMoney(row.amountB)}</td>
                                                            <td className="p-3 text-center">
                                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${amountDiff >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                                                                    {amountDiff >= 0 ? '+' : ''}{amountDiff.toFixed(1)}%
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            )
                                        ) : (
                                            salesData.length === 0 ? (
                                                <tr>
                                                    <td colSpan={6} className="text-center py-10 text-slate-400 font-medium">موردی یافت نشد. بازه را تغییر دهید.</td>
                                                </tr>
                                            ) : (
                                                salesData.map((row, idx) => (
                                                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                                        <td className="p-3 font-medium text-slate-500 whitespace-nowrap">{formatDateToJalali(row.Date)}</td>
                                                        <td className="p-3 font-mono text-slate-600 font-semibold">{row.DocId}</td>
                                                        <td className="p-3 font-bold text-slate-800">{row.GroupName || 'سایر گروه‌ها'}</td>
                                                        <td className="p-3 font-semibold text-slate-900">
                                                            {row.ItemName || 'کالای فروخته شده'}
                                                            {row.ItemNotes && <span className="block text-[10px] text-slate-400 font-normal">{row.ItemNotes}</span>}
                                                        </td>
                                                        <td className="p-3 text-left font-mono font-medium text-slate-700">{parseFloat(row.Quantity || 0).toFixed(1)}</td>
                                                        <td className="p-3 text-left font-mono font-extrabold text-blue-700">{formatMoney(parseFloat(row.Amount || 0))}</td>
                                                    </tr>
                                                ))
                                            )
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* 4. PRODUCTION TAB */}
                {activeTab === 'production' && (
                    <div className="p-6 space-y-6">
                        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 pb-4 gap-4">
                            <div>
                                <h2 className="text-xl font-bold text-slate-800">گزارش تولیدات روزانه کارخانه</h2>
                                <p className="text-xs text-slate-500 mt-1">تولید خالص به تفکیک گروه محصول، سری ساخت و خطوط فعال</p>
                            </div>
                            
                            <div className="flex flex-wrap gap-2">
                                <select 
                                    className="border border-slate-300 rounded-md py-1.5 px-3 text-xs bg-white font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    value={prodGrouping}
                                    onChange={(e) => setProdGrouping(e.target.value as any)}
                                >
                                    <option value="group">گروه بندی: گروه محصول</option>
                                    <option value="item">گروه بندی: نوع کالا</option>
                                    <option value="date">گروه بندی: تاریخ تولید</option>
                                </select>
                                
                                <div className="relative w-full md:w-56">
                                    <Search className="absolute right-2.5 top-2.5 h-4 w-4 text-slate-400" />
                                    <input 
                                        type="text"
                                        placeholder="جستجوی محصول یا خط..." 
                                        className="w-full pl-3 pr-8 py-1.5 border rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        value={prodSearch}
                                        onChange={(e) => setProdSearch(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Production Summaries */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 text-center">
                                <div className="text-slate-500 font-bold text-[10px]">مجموع وزن خالص تولید</div>
                                <div className="text-xl font-black text-slate-800 mt-2 font-mono">
                                    {productionData.reduce((sum, r) => sum + r.netWeight, 0).toFixed(1)} <span className="text-xs font-bold">کیلوگرم</span>
                                </div>
                            </div>
                            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 text-center">
                                <div className="text-slate-500 font-bold text-[10px]">تعداد بوبین‌های تولیدی</div>
                                <div className="text-xl font-black text-slate-800 mt-2 font-mono">
                                    {productionData.reduce((sum, r) => sum + r.bobbinCount, 0)} <span className="text-xs font-bold">عدد</span>
                                </div>
                            </div>
                            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 text-center">
                                <div className="text-slate-500 font-bold text-[10px]">تعداد کارتن‌های آماده</div>
                                <div className="text-xl font-black text-slate-800 mt-2 font-mono">
                                    {productionData.reduce((sum, r) => sum + r.cartonCount, 0)} <span className="text-xs font-bold">کارتن</span>
                                </div>
                            </div>
                            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 text-center">
                                <div className="text-slate-500 font-bold text-[10px]">تعداد کل آمار ثبتی</div>
                                <div className="text-xl font-black text-slate-800 mt-2 font-mono">
                                    {productionData.length} <span className="text-xs font-bold">سند</span>
                                </div>
                            </div>
                        </div>

                        {/* Grouped Lists */}
                        <div className="space-y-4">
                            <div className="rounded-xl border border-slate-200 overflow-hidden max-h-[450px] overflow-y-auto">
                                <table className="w-full text-right text-xs">
                                    <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 z-10">
                                        <tr>
                                            <th className="p-3.5 font-bold text-slate-700">عنوان طبقه‌بندی تولید</th>
                                            {prodGrouping === 'item' && <th className="p-3.5 font-bold text-slate-700">کد کالا</th>}
                                            <th className="p-3.5 font-bold text-slate-700 text-center w-32">تعداد ثبت</th>
                                            <th className="p-3.5 font-bold text-slate-700 text-center w-36">تعداد کارتن / بوبین</th>
                                            <th className="p-3.5 font-bold text-slate-700 text-left w-40">وزن ناخالص (کیلوگرم)</th>
                                            <th className="p-3.5 font-bold text-slate-700 text-left w-40">وزن خالص تولید (کیلوگرم)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {groupedProduction.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="text-center py-10 text-slate-400 font-medium">موردی یافت نشد</td>
                                            </tr>
                                        ) : (
                                            groupedProduction.map((row, idx) => (
                                                <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="p-3 font-bold text-slate-900">{row.key}</td>
                                                    {prodGrouping === 'item' && <td className="p-3 font-mono text-slate-600">{row.code}</td>}
                                                    <td className="p-3 text-center font-semibold text-slate-500">{row.count}</td>
                                                    <td className="p-3 text-center font-mono font-medium text-slate-700">{row.cartons} کارتن / {row.bobbins} بوبین</td>
                                                    <td className="p-3 text-left font-mono font-medium text-slate-700">{row.gross.toFixed(1)}</td>
                                                    <td className="p-3 text-left font-mono font-extrabold text-blue-700">{row.net.toFixed(1)}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* 5. CHEQUES TAB */}
                {activeTab === 'cheques' && (
                    <div className="p-6 space-y-6">
                        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 pb-4 gap-4">
                            <div>
                                <h2 className="text-xl font-bold text-slate-800">سامانه مدیریت چک‌ها و اسناد دریافتنی</h2>
                                <p className="text-xs text-slate-500 mt-1">مشاهده و دسته‌بندی چک‌های صندوق، بانکی، واخواست‌شده و خرج‌شده کارخانه</p>
                            </div>
                            
                            <div className="flex flex-wrap gap-2">
                                <div className="flex space-x-reverse space-x-1 border border-slate-300 rounded-md p-1 bg-slate-50">
                                    <button 
                                        onClick={() => setChequeStatusFilter('all')}
                                        className={`text-[10px] font-bold py-1 px-3 rounded ${chequeStatusFilter === 'all' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        همه
                                    </button>
                                    <button 
                                        onClick={() => setChequeStatusFilter('in_hand')}
                                        className={`text-[10px] font-bold py-1 px-3 rounded ${chequeStatusFilter === 'in_hand' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        در صندوق
                                    </button>
                                    <button 
                                        onClick={() => setChequeStatusFilter('at_bank')}
                                        className={`text-[10px] font-bold py-1 px-3 rounded ${chequeStatusFilter === 'at_bank' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        نزد بانک
                                    </button>
                                    <button 
                                        onClick={() => setChequeStatusFilter('returned')}
                                        className={`text-[10px] font-bold py-1 px-3 rounded ${chequeStatusFilter === 'returned' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        برگشتی
                                    </button>
                                    <button 
                                        onClick={() => setChequeStatusFilter('spent')}
                                        className={`text-[10px] font-bold py-1 px-3 rounded ${chequeStatusFilter === 'spent' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        وصول/خرج شده
                                    </button>
                                </div>
                                
                                <div className="relative w-full md:w-56">
                                    <Search className="absolute right-2.5 top-2.5 h-4 w-4 text-slate-400" />
                                    <input 
                                        type="text"
                                        placeholder="جستجوی چک، بانک، صادرکننده..." 
                                        className="w-full pl-3 pr-8 py-1.5 border rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        value={chequeSearch}
                                        onChange={(e) => setChequeSearch(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Cheques Overview Stats */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 flex items-center justify-between">
                                <div>
                                    <div className="text-slate-500 font-bold text-[10px]">مجموع مبالغ چک‌های گزینش‌شده</div>
                                    <div className="text-xl font-black text-slate-800 mt-2 font-mono">
                                        {formatMoney(filteredCheques.reduce((sum, r) => sum + r.amount, 0))} <span className="text-xs font-bold">ریال</span>
                                    </div>
                                </div>
                                <Coins className="w-8 h-8 text-blue-500 opacity-20" />
                            </div>
                            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 flex items-center justify-between">
                                <div>
                                    <div className="text-slate-500 font-bold text-[10px]">تعداد چک‌ها</div>
                                    <div className="text-xl font-black text-slate-800 mt-2 font-mono">
                                        {filteredCheques.length} <span className="text-xs font-bold">فقره</span>
                                    </div>
                                </div>
                                <CheckSquare className="w-8 h-8 text-emerald-500 opacity-20" />
                            </div>
                            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 flex items-center justify-between">
                                <div>
                                    <div className="text-slate-500 font-bold text-[10px]">میانگین مبلغ چک‌ها</div>
                                    <div className="text-xl font-black text-slate-800 mt-2 font-mono">
                                        {formatMoney(filteredCheques.length ? filteredCheques.reduce((sum, r) => sum + r.amount, 0) / filteredCheques.length : 0)} <span className="text-xs font-bold">ریال</span>
                                    </div>
                                </div>
                                <TrendingUp className="w-8 h-8 text-purple-500 opacity-20" />
                            </div>
                        </div>

                        {/* Cheques table */}
                        <div className="rounded-xl border border-slate-200 overflow-hidden max-h-[450px] overflow-y-auto">
                            <table className="w-full text-right text-xs">
                                <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 z-10">
                                    <tr>
                                        <th className="p-3.5 font-bold text-slate-700 w-16 text-center">ردیف</th>
                                        <th className="p-3.5 font-bold text-slate-700 w-32">شماره چک</th>
                                        <th className="p-3.5 font-bold text-slate-700 w-32">تاریخ سررسید</th>
                                        <th className="p-3.5 font-bold text-slate-700 w-44">بانک صادرکننده</th>
                                        <th className="p-3.5 font-bold text-slate-700">شرح / صادرکننده چک</th>
                                        <th className="p-3.5 font-bold text-slate-700 text-left w-40">مبلغ اسمی (ریال)</th>
                                        <th className="p-3.5 font-bold text-slate-700 w-44 text-center">وضعیت سند</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredCheques.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="text-center py-10 text-slate-400 font-medium">هیچ چکی یافت نشد. فیلترها را بررسی کنید.</td>
                                        </tr>
                                    ) : (
                                        filteredCheques.map((row, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="p-3 text-slate-400 text-center font-medium">{idx + 1}</td>
                                                <td className="p-3 font-mono font-bold text-slate-900">{row.chequeNo}</td>
                                                <td className="p-3 font-medium text-slate-500">{formatDateToJalali(row.dueDate)}</td>
                                                <td className="p-3 font-bold text-slate-800">{row.bankName}</td>
                                                <td className="p-3 font-semibold text-slate-800">{row.drawerName}</td>
                                                <td className="p-3 text-left font-mono font-extrabold text-blue-700">{formatMoney(row.amount)}</td>
                                                <td className="p-3 text-center">
                                                    <span className={`px-2.5 py-0.5 rounded text-[10px] font-extrabold border ${
                                                        row.statusGroup === 'spent' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                                        row.statusGroup === 'returned' ? 'bg-rose-50 text-rose-700 border-rose-100' :
                                                        row.statusGroup === 'at_bank' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                                        'bg-slate-50 text-slate-700 border-slate-200'
                                                    }`}>
                                                        {row.statusDesc}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
