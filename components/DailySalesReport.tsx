import React, { useState, useEffect } from 'react';
import { 
    Loader2, TrendingUp, TrendingDown, ShoppingBag, Search, Filter, 
    Layers, ListFilter, BarChart3, Printer, Database, RefreshCw, 
    Calendar, CheckCircle, AlertTriangle, Scale, Award 
} from 'lucide-react';
import * as jalaali from 'jalaali-js';
import { formatCurrency } from '../constants';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, LineChart, Line } from 'recharts';

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

interface DailySalesReportProps {
    dateFrom: string;
    dateTo: string;
    mode?: 'daily' | 'monthly';
}

export const DailySalesReport: React.FC<DailySalesReportProps> = ({ dateFrom: parentDateFrom, dateTo: parentDateTo, mode = 'daily' }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [data, setData] = useState<any[]>([]);
    const [lastUpdated, setLastUpdated] = useState<string | null>(null);
    const [isLoadedFromCache, setIsLoadedFromCache] = useState(false);
    
    // Local date overrides to allow quick range selections and prevent heavy load
    const [localDateFrom, setLocalDateFrom] = useState(parentDateFrom);
    const [localDateTo, setLocalDateTo] = useState(parentDateTo);
    
    // Sub-tab selection: 'groups' | 'tree' | 'ledger' | 'monthly_trends' | 'charts'
    const [activeSubTab, setActiveSubTab] = useState<'groups' | 'tree' | 'ledger' | 'monthly_trends' | 'charts'>('groups');
    
    // Filter & Search states
    const [ledgerSearch, setLedgerSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');
    
    // Mappings
    const [docTypeMap, setDocTypeMap] = useState<Record<string, string>>({});
    const [monthlySalesAmount, setMonthlySalesAmount] = useState<number>(0);

    // Helpers to extract weights and fees from transaction notes
    const parseNetWeight = (itemNotes: string, quantity: number) => {
        const notes = itemNotes || '';
        const match = notes.match(/وزن خالص\s*[:：\-]?\s*([\d.]+)/);
        if (match) return parseFloat(match[1]);
        
        const seriesMatch = notes.match(/سری ساخت\s*[:：\-]?\s*[A-Za-z0-9-]+\-([\d.]+)/);
        if (seriesMatch) return parseFloat(seriesMatch[1]);

        return quantity;
    };

    const parseGrossWeight = (itemNotes: string) => {
        const notes = itemNotes || '';
        const match = notes.match(/وزن ناخالص\s*[:：\-]?\s*([\d.]+)/);
        return match ? parseFloat(match[1]) : 0;
    };

    const parseFee = (itemNotes: string, notes: string, amount: number, netWeight: number) => {
        const combined = (itemNotes || '') + ' ' + (notes || '');
        const match = combined.match(/(?:فی|قیمت واحد|نرخ|قیمت)\s*[:：\-]?\s*([\d,.]+)/);
        if (match) {
            return parseFloat(match[1].replace(/,/g, ''));
        }
        return netWeight > 0 ? (amount / netWeight) : 0;
    };

    const formatDateToJalali = (isoStr: string) => {
        if (!isoStr) return '';
        try {
            const d = new Date(isoStr);
            const j = jalaali.toJalaali(d.getFullYear(), d.getMonth() + 1, d.getDate());
            return `${j.jy}/${String(j.jm).padStart(2, '0')}/${String(j.jd).padStart(2, '0')}`;
        } catch {
            return isoStr;
        }
    };
    
    const jalaliToGregorianStr = (jalaliStr: string) => {
        if (!jalaliStr) return '';
        try {
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
        } catch (e) {
            return jalaliStr;
        }
    };

    const getJalaliDateOffset = (offsetDays: number) => {
        const d = new Date();
        d.setDate(d.getDate() - offsetDays);
        const j = jalaali.toJalaali(d.getFullYear(), d.getMonth() + 1, d.getDate());
        return `${j.jy}/${String(j.jm).padStart(2, '0')}/${String(j.jd).padStart(2, '0')}`;
    };

    // Synchronize parent date changes with safe checks
    useEffect(() => {
        if (parentDateFrom && parentDateTo) {
            setLocalDateFrom(parentDateFrom);
            setLocalDateTo(parentDateTo);
        }
    }, [parentDateFrom, parentDateTo]);

    // Set Default Range based on mode to protect Sayan from heavy default queries
    useEffect(() => {
        const today = new Date();
        const jToday = jalaali.toJalaali(today.getFullYear(), today.getMonth() + 1, today.getDate());
        const activeYear = jToday.jy === 1405 ? 1404 : jToday.jy;
        
        if (mode === 'daily') {
            // Daily mode defaults to today's date
            const todayStr = `${jToday.jy}/${String(jToday.jm).padStart(2, '0')}/${String(jToday.jd).padStart(2, '0')}`;
            setLocalDateFrom(todayStr);
            setLocalDateTo(todayStr);
            setActiveSubTab('groups');
        } else {
            // Monthly mode defaults to whole fiscal year or current month
            const yearStartStr = `${activeYear}/01/01`;
            const todayStr = `${jToday.jy}/${String(jToday.jm).padStart(2, '0')}/${String(jToday.jd).padStart(2, '0')}`;
            setLocalDateFrom(yearStartStr);
            setLocalDateTo(todayStr);
            setActiveSubTab('monthly_trends');
        }
    }, [mode]);

    useEffect(() => {
        const fetchInitialMaps = async () => {
            try {
                // Get doc types mapping
                const t006 = await runSayanQuery(`SELECT Field_001, Field_004 FROM STR_TBL_006`);
                const t007 = await runSayanQuery(`SELECT Field_001, Field_004 FROM STR_TBL_007`);
                
                const typeNames: Record<string, string> = {};
                t006.forEach((row: any) => {
                    typeNames[row.Field_001] = row.Field_004;
                });
                
                const map010toName: Record<string, string> = {};
                t007.forEach((row: any) => {
                    map010toName[row.Field_001] = typeNames[row.Field_004] || `نوع ${row.Field_001}`;
                });
                
                // Keep known doc types
                if (!map010toName['68']) map010toName['68'] = 'فاکتور فروش (غیر رسمی)';
                if (!map010toName['12']) map010toName['12'] = 'فروش غیر رسمی';
                if (!map010toName['3']) map010toName['3'] = 'فاکتور فروش';
                if (!map010toName['4']) map010toName['4'] = 'مرجوعی فروش';
                if (!map010toName['5']) map010toName['5'] = 'فاکتور خرید';
                if (!map010toName['6']) map010toName['6'] = 'مرجوعی خرید';
                
                setDocTypeMap(map010toName);
            } catch (err) {
                console.warn("Failed to load document types map:", err);
            }
        };
        fetchInitialMaps();
    }, []);

    // Caching/Memory Loader
    useEffect(() => {
        if (!localDateFrom || !localDateTo) return;
        
        const cacheKey = `sayan_sales_cache_${mode}_${localDateFrom}_${localDateTo}`;
        const cached = localStorage.getItem(cacheKey);
        
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                setData(parsed.data || []);
                setMonthlySalesAmount(parsed.monthlySalesAmount || 0);
                setLastUpdated(parsed.timestamp || null);
                setIsLoadedFromCache(true);
                setError('');
            } catch (e) {
                console.warn("Error parsing cache:", e);
                setIsLoadedFromCache(false);
            }
        } else {
            // No cache available, ask user to fetch or auto-fetch safely for today
            setData([]);
            setLastUpdated(null);
            setIsLoadedFromCache(false);
        }
    }, [localDateFrom, localDateTo, mode]);

    const fetchReportFromSayan = async () => {
        if (!localDateFrom || !localDateTo) {
            setError("لطفاً تاریخ شروع و پایان را مشخص کنید.");
            return;
        }
        setIsLoading(true);
        setError('');
        try {
            const gregFrom = jalaliToGregorianStr(localDateFrom);
            const gregTo = jalaliToGregorianStr(localDateTo);
            
            // Highly optimized 1-step JOIN query to minimize Sayan ERP pressure.
            // Fetches headers, line items, product names, and group names in one single step!
            const sqlJoined = `
                SELECT 
                    t10.Field_001 as DocId, 
                    t10.Field_008 as DocDate, 
                    t10.Field_009 as DocType,
                    t10.Field_029 as Notes,
                    t11.Field_005 as ItemCode,
                    t11.Field_006 as Quantity,
                    t11.Field_031 as ItemNotes,
                    t11.Field_037 as Amount,
                    t22.Field_004 as ItemName,
                    t02.Field_003 as GroupName
                FROM STR_TBL_010 t10
                INNER JOIN STR_TBL_011 t11 ON t10.Field_001 = t11.Field_004
                LEFT JOIN IND_TBL_021 t21 ON t11.Field_005 = t21.Field_004
                LEFT JOIN IND_TBL_022 t22 ON t11.Field_005 = t22.Field_005
                LEFT JOIN IND_TBL_002 t02 ON t21.Field_003 = t02.Field_003
                WHERE t10.Field_008 >= '${gregFrom}T00:00:00.000Z' 
                  AND t10.Field_008 <= '${gregTo}T23:59:59.000Z'
                  AND t10.Field_009 IN ('3', '12', '68', '4')
                ORDER BY t10.Field_008 DESC
            `;
            
            const results = await runSayanQuery(sqlJoined);
            
            // Combine data with note weight/fee parsing
            const enriched = results.map((row: any) => {
                const docType = row.DocType || 'unknown';
                
                // Classify category
                let category = 'other';
                const docTypeName = docTypeMap[docType] || `نوع ${docType}`;
                if (docTypeName.includes('فروش') && !docTypeName.includes('مرجوع')) {
                    category = 'sales';
                } else if (docTypeName.includes('مرجوعی فروش') || docTypeName.includes('برگشت')) {
                    category = 'sales_return';
                } else if (docTypeName.includes('خرید') && !docTypeName.includes('مرجوع')) {
                    category = 'purchases';
                } else if (docTypeName.includes('مرجوعی خرید')) {
                    category = 'purchases_return';
                } else {
                    category = docTypeName;
                }
                
                const q = parseFloat(row.Quantity || 0);
                const itemNotes = row.ItemNotes || '';
                const docNotes = row.Notes || '';
                const amt = parseFloat(row.Amount || 0);

                const netW = parseNetWeight(itemNotes, q);
                const grossW = parseGrossWeight(itemNotes);
                const fee = parseFee(itemNotes, docNotes, amt, netW);

                return {
                    docId: row.DocId,
                    date: row.DocDate,
                    docType: docType,
                    docTypeName: docTypeName,
                    category: category,
                    itemCode: row.ItemCode,
                    itemName: row.ItemName || row.ItemCode || 'نامشخص',
                    groupName: row.GroupName || 'بدون گروه',
                    quantity: q,
                    netWeight: netW,
                    grossWeight: grossW,
                    amount: amt,
                    unitPrice: fee
                };
            });
            
            // Monthly Sales Total (For the gauge card)
            let monthTotalVal = 0;
            try {
                let cleanDate = localDateFrom.trim()
                    .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
                    .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());
                const parts = cleanDate.split('/');
                if (parts.length === 3) {
                    const jy = parseInt(parts[0], 10);
                    const jm = parseInt(parts[1], 10);
                    const monthFirst = jalaliToGregorianStr(`${jy}/${jm}/01`);
                    let lastDay = 30;
                    if (jm <= 6) lastDay = 31;
                    if (jm === 12 && !jalaali.isLeapJalaaliYear(jy)) lastDay = 29;
                    const monthLast = jalaliToGregorianStr(`${jy}/${jm}/${lastDay}`);
                    
                    const monthlySql = `
                        SELECT SUM(CAST(t11.Field_037 AS FLOAT)) as MonthTotal
                        FROM STR_TBL_010 t10
                        INNER JOIN STR_TBL_011 t11 ON t10.Field_001 = t11.Field_004
                        WHERE t10.Field_008 >= '${monthFirst}T00:00:00.000Z' 
                          AND t10.Field_008 <= '${monthLast}T23:59:59.000Z'
                          AND t10.Field_009 IN ('3', '12', '68')
                    `;
                    const monthlyData = await runSayanQuery(monthlySql);
                    if (monthlyData && monthlyData.length > 0 && monthlyData[0].MonthTotal) {
                        monthTotalVal = monthlyData[0].MonthTotal;
                    }
                }
            } catch(e) {
                console.warn("Failed to get monthly sales:", e);
            }

            // Save to LocalStorage memory
            const cacheKey = `sayan_sales_cache_${mode}_${localDateFrom}_${localDateTo}`;
            const nowStr = new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }) + ' - ' + getJalaliDateOffset(0);
            
            const cachePayload = {
                timestamp: nowStr,
                data: enriched,
                monthlySalesAmount: monthTotalVal
            };
            
            localStorage.setItem(cacheKey, JSON.stringify(cachePayload));
            
            setData(enriched);
            setMonthlySalesAmount(monthTotalVal);
            setLastUpdated(nowStr);
            setIsLoadedFromCache(false);
            setError('');
        } catch (err: any) {
            setError(err.message || 'خطا در ارتباط با سرور سایان. لطفاً مجددا تلاش کنید.');
        } finally {
            setIsLoading(false);
        }
    };

    // Calculate Product Group Summaries (Weight, average price/fee, and total amount)
    const getGroupSummary = () => {
        const groups: Record<string, { 
            name: string; 
            amount: number; 
            netWeight: number; 
            grossWeight: number;
            transactions: number;
        }> = {};
        
        data.filter(d => d.category === 'sales').forEach(row => {
            const grp = row.groupName || 'سایر گروه‌ها';
            if (!groups[grp]) {
                groups[grp] = { 
                    name: grp, 
                    amount: 0, 
                    netWeight: 0, 
                    grossWeight: 0,
                    transactions: 0
                };
            }
            groups[grp].amount += row.amount;
            groups[grp].netWeight += row.netWeight;
            groups[grp].grossWeight += row.grossWeight;
            groups[grp].transactions += 1;
        });
        
        return Object.values(groups).map(g => {
            const avgFee = g.netWeight > 0 ? (g.amount / g.netWeight) : 0;
            return {
                ...g,
                avgFee
            };
        }).sort((a, b) => b.amount - a.amount);
    };

    const groupSummaryData = getGroupSummary();

    // Grouping for Tree View
    const grouped = data.reduce((acc, row) => {
        if (!acc[row.category]) acc[row.category] = { categoryName: row.category, totalAmount: 0, groups: {} };
        const catNode = acc[row.category];
        catNode.totalAmount += row.amount;
        
        if (!catNode.groups[row.groupName]) catNode.groups[row.groupName] = { groupName: row.groupName, totalAmount: 0, products: {} };
        const groupNode = catNode.groups[row.groupName];
        groupNode.totalAmount += row.amount;
        
        if (!groupNode.products[row.itemCode]) groupNode.products[row.itemCode] = { 
            itemCode: row.itemCode, 
            itemName: row.itemName, 
            quantity: 0, 
            netWeight: 0,
            amount: 0,
            transactions: 0
        };
        const prodNode = groupNode.products[row.itemCode];
        prodNode.quantity += row.quantity;
        prodNode.netWeight += row.netWeight;
        prodNode.amount += row.amount;
        prodNode.transactions += 1;
        
        return acc;
    }, {} as Record<string, any>);
    
    // Category labels map
    const categoryLabels: Record<string, string> = {
        'sales': 'فروش کالا',
        'sales_return': 'مرجوعی فروش',
        'purchases': 'خرید مواد اولیه',
        'purchases_return': 'مرجوعی خرید'
    };
    
    const getCategoryColor = (cat: string) => {
        if (cat === 'sales') return 'text-emerald-700 bg-emerald-50 border-emerald-100';
        if (cat === 'sales_return') return 'text-rose-700 bg-rose-50 border-rose-100';
        if (cat === 'purchases') return 'text-blue-700 bg-blue-50 border-blue-100';
        if (cat === 'purchases_return') return 'text-orange-700 bg-orange-50 border-orange-100';
        return 'text-slate-600 bg-slate-50 border-slate-200';
    };

    const getCategoryIcon = (cat: string) => {
        if (cat === 'sales') return <TrendingUp className="w-5 h-5 text-emerald-600" />;
        if (cat === 'sales_return') return <TrendingDown className="w-5 h-5 text-rose-600" />;
        if (cat === 'purchases') return <ShoppingBag className="w-5 h-5 text-blue-600" />;
        return <ShoppingBag className="w-5 h-5 text-slate-600" />;
    };
    
    // Sums
    const totalSalesAmount = data.filter(d => d.category === 'sales').reduce((sum, d) => sum + d.amount, 0);
    const totalReturnsAmount = data.filter(d => d.category === 'sales_return').reduce((sum, d) => sum + d.amount, 0);
    const totalSalesWeight = data.filter(d => d.category === 'sales').reduce((sum, d) => sum + d.netWeight, 0);

    // Filter Ledger Rows
    const filteredLedger = data.filter(row => {
        const matchesSearch = 
            row.docId.toLowerCase().includes(ledgerSearch.toLowerCase()) ||
            row.itemName.toLowerCase().includes(ledgerSearch.toLowerCase()) ||
            row.itemCode.toLowerCase().includes(ledgerSearch.toLowerCase()) ||
            row.groupName.toLowerCase().includes(ledgerSearch.toLowerCase());
        
        const matchesCategory = categoryFilter === 'all' || row.category === categoryFilter;
        return matchesSearch && matchesCategory;
    });

    // Monthly trends mapping for Wide Range reports
    const getMonthlyTrends = () => {
        const months = [
            'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
            'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
        ];
        const monthlyData: Record<number, { monthName: string; amount: number; weight: number; count: number }> = {};
        
        // Pre-populate months
        for (let i = 1; i <= 12; i++) {
            monthlyData[i] = { monthName: months[i-1], amount: 0, weight: 0, count: 0 };
        }

        data.filter(d => d.category === 'sales').forEach(row => {
            if (!row.date) return;
            try {
                const d = new Date(row.date);
                const j = jalaali.toJalaali(d.getFullYear(), d.getMonth() + 1, d.getDate());
                if (j.jm >= 1 && j.jm <= 12) {
                    monthlyData[j.jm].amount += row.amount;
                    monthlyData[j.jm].weight += row.netWeight;
                    monthlyData[j.jm].count += 1;
                }
            } catch {}
        });

        return Object.keys(monthlyData).map(k => {
            const mNum = parseInt(k);
            const m = monthlyData[mNum];
            return {
                monthIndex: mNum,
                monthName: m.monthName,
                amount: m.amount,
                weight: m.weight,
                avgFee: m.weight > 0 ? (m.amount / m.weight) : 0,
                count: m.count
            };
        }).sort((a, b) => a.monthIndex - b.monthIndex);
    };

    const monthlyTrendsData = getMonthlyTrends();

    // Recharts visualization data
    const chartData = groupSummaryData.map(g => ({
        name: g.name,
        amount: g.amount,
        weight: g.netWeight
    }));

    const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#34d399'];

    const handlePrint = () => {
        window.print();
    };

    // Quick range selector logic
    const selectQuickRange = (range: 'today' | 'yesterday' | 'week' | 'month' | 'year') => {
        const today = new Date();
        const jToday = jalaali.toJalaali(today.getFullYear(), today.getMonth() + 1, today.getDate());
        const activeYear = jToday.jy === 1405 ? 1404 : jToday.jy;
        
        let start = '';
        let end = `${jToday.jy}/${String(jToday.jm).padStart(2, '0')}/${String(jToday.jd).padStart(2, '0')}`;
        
        if (range === 'today') {
            start = end;
        } else if (range === 'yesterday') {
            start = getJalaliDateOffset(1);
            end = start;
        } else if (range === 'week') {
            start = getJalaliDateOffset(7);
        } else if (range === 'month') {
            start = `${jToday.jy}/${String(jToday.jm).padStart(2, '0')}/01`;
        } else if (range === 'year') {
            start = `${activeYear}/01/01`;
        }
        
        setLocalDateFrom(start);
        setLocalDateTo(end);
    };

    return (
        <div className="space-y-6">
            {/* Header Area */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
                <div>
                    <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${mode === 'daily' ? 'bg-indigo-100 text-indigo-700' : 'bg-teal-100 text-teal-700'}`}>
                            {mode === 'daily' ? 'گزارش روزانه' : 'گزارش ماهانه'}
                        </span>
                        <h2 className="text-lg font-black text-slate-800">
                            {mode === 'daily' ? 'پایش هوشمند فروش روزانه' : 'تحلیل کلان فروش ماهانه'}
                        </h2>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                        استخراج دقیق مقادیر از سایان ERP، انطباق اوزان خالص و ناخالص، محاسبه فاکتورها به صورت ۱۰۰٪ کش‌شده.
                    </p>
                </div>

                {/* Date & Trigger Tools */}
                <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                    {/* Presets */}
                    <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200">
                        <button 
                            onClick={() => selectQuickRange('today')}
                            className="px-2 py-1 text-[10px] font-bold text-slate-600 hover:bg-slate-100 rounded"
                        >
                            امروز
                        </button>
                        <button 
                            onClick={() => selectQuickRange('yesterday')}
                            className="px-2 py-1 text-[10px] font-bold text-slate-600 hover:bg-slate-100 rounded"
                        >
                            دیروز
                        </button>
                        <button 
                            onClick={() => selectQuickRange('week')}
                            className="px-2 py-1 text-[10px] font-bold text-slate-600 hover:bg-slate-100 rounded"
                        >
                            ۷ روز اخیر
                        </button>
                        <button 
                            onClick={() => selectQuickRange('month')}
                            className="px-2 py-1 text-[10px] font-bold text-slate-600 hover:bg-slate-100 rounded"
                        >
                            ماه جاری
                        </button>
                        <button 
                            onClick={() => selectQuickRange('year')}
                            className="px-2 py-1 text-[10px] font-bold text-slate-600 hover:bg-slate-100 rounded"
                        >
                            کل سال
                        </button>
                    </div>

                    {/* Inputs */}
                    <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-lg px-2 py-1">
                        <span className="text-[10px] font-bold text-slate-400">از</span>
                        <input 
                            type="text" 
                            value={localDateFrom}
                            onChange={(e) => setLocalDateFrom(e.target.value)}
                            className="text-xs font-bold font-mono text-slate-800 bg-transparent outline-none w-20 text-center"
                        />
                        <span className="text-[10px] font-bold text-slate-400">تا</span>
                        <input 
                            type="text" 
                            value={localDateTo}
                            onChange={(e) => setLocalDateTo(e.target.value)}
                            className="text-xs font-bold font-mono text-slate-800 bg-transparent outline-none w-20 text-center"
                        />
                    </div>

                    <button 
                        onClick={handlePrint}
                        className="flex items-center gap-1 bg-white hover:bg-slate-100 text-slate-700 px-3 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer border border-slate-200 shadow-sm"
                        title="چاپ یا ذخیره PDF"
                    >
                        <Printer className="w-3.5 h-3.5" />
                        <span className="hidden md:inline">PDF</span>
                    </button>

                    <button 
                        onClick={fetchReportFromSayan}
                        disabled={isLoading}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-extrabold transition-colors cursor-pointer shadow-md shadow-blue-100"
                    >
                        {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                        <span>بروزرسانی از سایان</span>
                    </button>
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="bg-rose-50 text-rose-700 p-4 rounded-xl text-xs font-bold border border-rose-100 flex items-center gap-2 animate-fadeIn">
                    <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {/* Memory Cache Notice Banner */}
            {!isLoading && data.length > 0 && (
                <div className={`p-3.5 rounded-xl border text-xs font-bold flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isLoadedFromCache 
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-100' 
                        : 'bg-blue-50 text-blue-800 border-blue-100'
                }`}>
                    <div className="flex items-center gap-2.5">
                        {isLoadedFromCache ? (
                            <Database className="w-4 h-4 text-emerald-600 animate-pulse shrink-0" />
                        ) : (
                            <CheckCircle className="w-4 h-4 text-blue-600 shrink-0" />
                        )}
                        <div>
                            <span>
                                {isLoadedFromCache 
                                    ? `داده‌های این بازه از «حافظه کش موقت» بازیابی شدند تا به سرور سایان فشار نیاید.` 
                                    : `داده‌های تازه از سیستم مرکزی سایان ERP با موفقیت دریافت و در کش ذخیره شد.`}
                            </span>
                            {lastUpdated && (
                                <span className="block sm:inline sm:mr-2 text-[10px] text-slate-400 font-medium">
                                    (آخرین دریافت: {lastUpdated})
                                </span>
                            )}
                        </div>
                    </div>
                    {isLoadedFromCache && (
                        <button 
                            onClick={fetchReportFromSayan}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-extrabold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
                        >
                            <RefreshCw className="w-3 h-3" />
                            بروزرسانی مستقیم از سرور مرکزی
                        </button>
                    )}
                </div>
            )}

            {/* Empty or Loading States */}
            {isLoading && data.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border border-slate-200 shadow-sm">
                    <Loader2 className="w-10 h-10 animate-spin text-blue-600 mb-4" />
                    <p className="text-slate-800 font-black text-sm">در حال اجرای ایمن کوئری تک‌مرحله‌ای سایان...</p>
                    <p className="text-slate-400 text-xs mt-2 font-medium">استخراج اوزان خالص و محاسبات مالی - زمان تقریبی ۵ الی ۱۰ ثانیه</p>
                </div>
            ) : data.length === 0 ? (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-16 text-center">
                    <ShoppingBag className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-sm font-black text-slate-700">هیچ اطلاعاتی در حافظه موقت یافت نشد</h3>
                    <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                        برای محافظت از سرعت سیستم و سرور سایان، لود خودکار سالانه غیرفعال شده است.<br />
                        لطفاً روی دکمه آبی‌رنگ <strong className="text-blue-600">«بروزرسانی از سایان»</strong> در بالا کلیک کنید تا داده‌ها استخراج و در کش ذخیره شوند.
                    </p>
                    <div className="mt-6 flex justify-center gap-2">
                        <button 
                            onClick={() => { selectQuickRange('today'); setTimeout(fetchReportFromSayan, 100); }}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer"
                        >
                            لود سریع امروز (سبک)
                        </button>
                        <button 
                            onClick={() => { selectQuickRange('week'); setTimeout(fetchReportFromSayan, 100); }}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer"
                        >
                            لود سریع هفته گذشته
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    {/* Statistical Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
                            <span className="text-[10px] font-bold text-slate-500">جمع ناخالص فاکتورها</span>
                            <span className="text-lg font-black text-emerald-600 font-mono mt-2 block">
                                {formatCurrency(totalSalesAmount)} <span className="text-[10px] font-bold text-slate-500 font-sans">ریال</span>
                            </span>
                            <div className="border-t border-slate-100 pt-2 mt-2 text-[9px] text-slate-400 font-medium">بدون کسر برگشتی‌ها</div>
                        </div>
                        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
                            <span className="text-[10px] font-bold text-slate-500">جمع مرجوعی‌ها (برگشت)</span>
                            <span className="text-lg font-black text-rose-600 font-mono mt-2 block">
                                {formatCurrency(totalReturnsAmount)} <span className="text-[10px] font-bold text-slate-500 font-sans">ریال</span>
                            </span>
                            <div className="border-t border-slate-100 pt-2 mt-2 text-[9px] text-slate-400 font-medium">تعداد: {data.filter(d => d.category === 'sales_return').length} ردیف</div>
                        </div>
                        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
                            <span className="text-[10px] font-bold text-slate-500">صافی فروش خالص</span>
                            <span className="text-lg font-black text-blue-600 font-mono mt-2 block font-extrabold">
                                {formatCurrency(totalSalesAmount - totalReturnsAmount)} <span className="text-[10px] font-bold text-slate-500 font-sans">ریال</span>
                            </span>
                            <div className="border-t border-slate-100 pt-2 mt-2 text-[9px] text-slate-400 font-medium">عملکرد نهایی بازه انتخابی</div>
                        </div>
                        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
                            <span className="text-[10px] font-bold text-slate-500">حجم کل وزن خالص فروخته شده</span>
                            <span className="text-lg font-black text-indigo-600 font-mono mt-2 block">
                                {totalSalesWeight.toLocaleString(undefined, { maximumFractionDigits: 1 })} <span className="text-[10px] font-bold text-slate-500 font-sans">ک‌گ</span>
                            </span>
                            <div className="border-t border-slate-100 pt-2 mt-2 text-[9px] text-slate-400 font-medium">
                                میانگین فی: {formatCurrency(totalSalesWeight > 0 ? Math.round(totalSalesAmount / totalSalesWeight) : 0)} ریال
                            </div>
                        </div>
                        <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-sm flex flex-col justify-between text-white">
                            <span className="text-[10px] font-bold text-slate-400">کل فروش ماه جاری</span>
                            <span className="text-lg font-black text-amber-400 font-mono mt-2 block">
                                {formatCurrency(monthlySalesAmount)} <span className="text-[10px] font-bold text-slate-400 font-sans">ریال</span>
                            </span>
                            <div className="border-t border-slate-800 pt-2 mt-2 text-[9px] text-slate-400 font-medium">
                                مجموع اقلام تراکنش: {data.length} مورد
                            </div>
                        </div>
                    </div>

                    {/* Navigation Sub-Tabs */}
                    <div className="flex flex-wrap border border-slate-200/60 gap-1 bg-slate-50 p-1.5 rounded-xl shadow-inner">
                        <button 
                            onClick={() => setActiveSubTab('groups')}
                            className={`flex items-center gap-1.5 py-2 px-3 sm:py-2.5 sm:px-4 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeSubTab === 'groups' ? 'bg-white shadow-sm text-blue-700 border border-slate-200/60' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
                        >
                            <Scale className="w-4 h-4 text-blue-500" />
                            <span>خلاصه گروهی (وزن، فی و مبلغ)</span>
                        </button>
                        <button 
                            onClick={() => setActiveSubTab('tree')}
                            className={`flex items-center gap-1.5 py-2 px-3 sm:py-2.5 sm:px-4 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeSubTab === 'tree' ? 'bg-white shadow-sm text-blue-700 border border-slate-200/60' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
                        >
                            <Layers className="w-4 h-4 text-emerald-500" />
                            <span>درختواره کالاها</span>
                        </button>
                        {mode === 'monthly' && (
                            <button 
                                onClick={() => setActiveSubTab('monthly_trends')}
                                className={`flex items-center gap-1.5 py-2 px-3 sm:py-2.5 sm:px-4 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeSubTab === 'monthly_trends' ? 'bg-white shadow-sm text-blue-700 border border-slate-200/60' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
                            >
                                <Calendar className="w-4 h-4 text-amber-500" />
                                <span>روند فروش ماه به ماه</span>
                            </button>
                        )}
                        <button 
                            onClick={() => setActiveSubTab('ledger')}
                            className={`flex items-center gap-1.5 py-2 px-3 sm:py-2.5 sm:px-4 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeSubTab === 'ledger' ? 'bg-white shadow-sm text-blue-700 border border-slate-200/60' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
                        >
                            <ListFilter className="w-4 h-4 text-indigo-500" />
                            <span>ریز تفصیلی اسناد (دفتر روزانه)</span>
                        </button>
                        <button 
                            onClick={() => setActiveSubTab('charts')}
                            className={`flex items-center gap-1.5 py-2 px-3 sm:py-2.5 sm:px-4 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeSubTab === 'charts' ? 'bg-white shadow-sm text-blue-700 border border-slate-200/60' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
                        >
                            <BarChart3 className="w-4 h-4 text-teal-500" />
                            <span>سهم ریالی و وزنی</span>
                        </button>
                    </div>

                    {/* 1. GROUPS SUMMARY SUB-TAB (CRITICAL USER REQUEST) */}
                    {activeSubTab === 'groups' && (
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden space-y-4">
                            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Award className="w-5 h-5 text-blue-600" />
                                    <h3 className="text-sm sm:text-base font-black text-slate-800">خلاصه عملکرد فروش به تفکیک گروه کالایی</h3>
                                </div>
                                <span className="text-[10px] font-bold text-slate-500">سورت بر اساس بیشترین مبلغ فروش</span>
                            </div>

                            <div className="p-4 overflow-x-auto">
                                <table className="w-full text-right text-xs">
                                    <thead className="bg-slate-100 text-slate-600">
                                        <tr>
                                            <th className="py-3 px-4 font-bold rounded-r-lg">نام گروه کالایی</th>
                                            <th className="py-3 px-4 font-bold text-center">تعداد فاکتورها</th>
                                            <th className="py-3 px-4 font-bold text-center">مجموع وزن خالص (ک‌گ)</th>
                                            <th className="py-3 px-4 font-bold text-center">میانگین فی خالص (ریال)</th>
                                            <th className="py-3 px-4 font-bold text-left rounded-l-lg">جمع کل فروش گروه (ریال)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {groupSummaryData.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="text-center py-10 text-slate-400 font-bold">هیچ گروه کالا یا تراکنش فروش ثبت نشده است.</td>
                                            </tr>
                                        ) : (
                                            groupSummaryData.map((grp, idx) => (
                                                <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                                                    <td className="py-3.5 px-4 font-black text-slate-800 text-sm">
                                                        <div className="flex items-center gap-2">
                                                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></span>
                                                            {grp.name}
                                                        </div>
                                                    </td>
                                                    <td className="py-3.5 px-4 text-center font-bold text-slate-500 font-mono">
                                                        {grp.transactions.toLocaleString()}
                                                    </td>
                                                    <td className="py-3.5 px-4 text-center font-black text-indigo-600 font-mono">
                                                        {grp.netWeight.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                                                    </td>
                                                    <td className="py-3.5 px-4 text-center font-bold text-emerald-700 font-mono">
                                                        {formatCurrency(Math.round(grp.avgFee))}
                                                    </td>
                                                    <td className="py-3.5 px-4 text-left font-extrabold text-blue-700 font-mono text-sm">
                                                        {formatCurrency(grp.amount)}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                    {groupSummaryData.length > 0 && (
                                        <tfoot className="bg-slate-50 font-black">
                                            <tr className="border-t border-slate-200">
                                                <td className="py-4 px-4 text-slate-800 text-sm">جمع کل کارخانه</td>
                                                <td className="py-4 px-4 text-center text-slate-500 font-mono">
                                                    {groupSummaryData.reduce((sum, g) => sum + g.transactions, 0).toLocaleString()}
                                                </td>
                                                <td className="py-4 px-4 text-center text-indigo-700 font-mono">
                                                    {groupSummaryData.reduce((sum, g) => sum + g.netWeight, 0).toLocaleString(undefined, { maximumFractionDigits: 1 })}
                                                </td>
                                                <td className="py-4 px-4 text-center text-emerald-800 font-mono">
                                                    {formatCurrency(Math.round(
                                                        groupSummaryData.reduce((sum, g) => sum + g.netWeight, 0) > 0
                                                            ? (groupSummaryData.reduce((sum, g) => sum + g.amount, 0) / groupSummaryData.reduce((sum, g) => sum + g.netWeight, 0))
                                                            : 0
                                                    ))}
                                                </td>
                                                <td className="py-4 px-4 text-left text-blue-800 font-mono text-sm">
                                                    {formatCurrency(groupSummaryData.reduce((sum, g) => sum + g.amount, 0))}
                                                </td>
                                            </tr>
                                        </tfoot>
                                    )}
                                </table>
                            </div>
                        </div>
                    )}

                    {/* 2. TREE DETAIL TAB */}
                    {activeSubTab === 'tree' && (
                        <div className="space-y-6">
                            {['sales', 'sales_return', 'purchases', 'purchases_return', 'other'].map(catKey => {
                                const catNode = grouped[catKey];
                                if (!catNode) return null;
                                if (catKey === 'other' && catNode.totalAmount === 0) return null; 
                                
                                const catTitle = categoryLabels[catKey] || catKey;
                                
                                return (
                                    <div key={catKey} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                                        <div className={`px-5 py-4 border-b border-slate-200 flex items-center justify-between ${getCategoryColor(catKey)}`}>
                                            <div className="flex items-center gap-3">
                                                {getCategoryIcon(catKey)}
                                                <h3 className="text-sm sm:text-base font-extrabold">{catTitle}</h3>
                                            </div>
                                            <div className="text-left font-black text-sm sm:text-base font-mono">
                                                {formatCurrency(catNode.totalAmount)} ریال
                                            </div>
                                        </div>
                                        
                                        <div className="p-0">
                                            {Object.values(catNode.groups).sort((a: any, b: any) => b.totalAmount - a.totalAmount).map((group: any) => (
                                                <div key={group.groupName} className="border-b border-slate-100 last:border-0">
                                                    <div className="bg-slate-50 px-6 py-2.5 flex justify-between items-center border-b border-slate-100">
                                                        <span className="font-extrabold text-slate-700 text-xs sm:text-sm">گروه: {group.groupName}</span>
                                                        <span className="font-extrabold text-slate-800 text-xs sm:text-sm font-mono">{formatCurrency(group.totalAmount)} ریال</span>
                                                    </div>
                                                    <div className="overflow-x-auto">
                                                        <table className="w-full text-right text-xs">
                                                            <thead className="bg-white text-slate-500 border-b border-slate-100">
                                                                <tr>
                                                                    <th className="py-2.5 px-6 font-bold w-1/3">نام کالا</th>
                                                                    <th className="py-2.5 px-6 font-bold text-center">تعداد/مقدار</th>
                                                                    <th className="py-2.5 px-6 font-bold text-center">وزن خالص (ک‌گ)</th>
                                                                    <th className="py-2.5 px-6 font-bold text-center">میانگین فی خالص (ریال)</th>
                                                                    <th className="py-2.5 px-6 font-bold text-left">مبلغ کل (ریال)</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-slate-100">
                                                                {Object.values(group.products).sort((a: any, b: any) => b.amount - a.amount).map((prod: any) => (
                                                                    <tr key={prod.itemCode} className="hover:bg-slate-50/70 transition-colors">
                                                                        <td className="py-3 px-6 text-slate-800 font-bold">
                                                                            {prod.itemName}
                                                                            <span className="block text-[10px] text-slate-400 font-semibold font-mono mt-0.5">کد: {prod.itemCode} | {prod.transactions} تراکنش فاکتور</span>
                                                                        </td>
                                                                        <td className="py-3 px-6 text-slate-600 font-bold text-center font-mono">
                                                                            {prod.quantity.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                                                                        </td>
                                                                        <td className="py-3 px-6 text-slate-700 font-bold text-center font-mono">
                                                                            {prod.netWeight.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                                                                        </td>
                                                                        <td className="py-3 px-6 text-slate-600 text-center font-mono font-medium">
                                                                            {formatCurrency(prod.netWeight > 0 ? Math.round(prod.amount / prod.netWeight) : 0)}
                                                                        </td>
                                                                        <td className="py-3 px-6 text-left font-black text-slate-800 font-mono">
                                                                            {formatCurrency(prod.amount)}
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* 3. MONTHLY TRENDS TAB */}
                    {activeSubTab === 'monthly_trends' && mode === 'monthly' && (
                        <div className="space-y-6">
                            {/* Monthly Table */}
                            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                                <div className="px-5 py-4 bg-slate-50 border-b border-slate-100">
                                    <h3 className="text-sm sm:text-base font-black text-slate-800">تحلیل روند فروش به تفکیک ماه‌های سال جاری</h3>
                                </div>
                                <div className="p-0 overflow-x-auto">
                                    <table className="w-full text-right text-xs">
                                        <thead className="bg-slate-100/50 text-slate-600">
                                            <tr>
                                                <th className="p-3.5 font-bold">ماه شمسی</th>
                                                <th className="p-3.5 font-bold text-center">تعداد اقلام فاکتور</th>
                                                <th className="p-3.5 font-bold text-center">مجموع وزن خالص (ک‌گ)</th>
                                                <th className="p-3.5 font-bold text-center">میانگین نرخ خالص (ریال)</th>
                                                <th className="p-3.5 font-bold text-left">مجموع کل درآمد فروش (ریال)</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {monthlyTrendsData.map((m, idx) => (
                                                <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                                                    <td className="p-3.5 font-extrabold text-slate-800">{m.monthName}</td>
                                                    <td className="p-3.5 text-center font-medium text-slate-500 font-mono">{m.count.toLocaleString()}</td>
                                                    <td className="p-3.5 text-center font-bold text-slate-700 font-mono">{m.weight.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
                                                    <td className="p-3.5 text-center font-bold text-emerald-700 font-mono">{m.avgFee > 0 ? formatCurrency(Math.round(m.avgFee)) : '-'}</td>
                                                    <td className="p-3.5 text-left font-black text-blue-700 font-mono">{m.amount > 0 ? formatCurrency(m.amount) : '-'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Monthly Trends Chart */}
                            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                                <h3 className="text-xs font-black text-slate-800 mb-6 text-center">نمودار نوسان فروش ماهانه کارخانه (ریال)</h3>
                                <div className="h-80">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={monthlyTrendsData.filter(m => m.amount > 0)}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                            <XAxis dataKey="monthName" tick={{ fontSize: 10, fontWeight: 'bold' }} />
                                            <YAxis tick={{ fontSize: 10 }} />
                                            <Tooltip formatter={(value: any) => `${formatCurrency(value)} ریال`} />
                                            <Legend wrapperStyle={{ fontSize: 10 }} />
                                            <Line name="مبلغ کل فروش (ریال)" type="monotone" dataKey="amount" stroke="#2563eb" strokeWidth={3} dot={{ r: 4 }} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 4. DETAILED LEDGER TAB */}
                    {activeSubTab === 'ledger' && (
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden space-y-4 p-4">
                            {/* Filters Bar */}
                            <div className="flex flex-col md:flex-row gap-3">
                                <div className="flex-1 flex items-center gap-2 border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 focus-within:ring-2 focus-within:ring-blue-500 focus-within:bg-white transition-all">
                                    <Search className="w-4 h-4 text-slate-400 shrink-0" />
                                    <input 
                                        type="text"
                                        placeholder="جستجو در کد کالا، نام کالا، شماره سند و یا نام گروه..."
                                        value={ledgerSearch}
                                        onChange={(e) => setLedgerSearch(e.target.value)}
                                        className="text-xs bg-transparent outline-none w-full text-slate-800 font-medium"
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-slate-500 whitespace-nowrap">فیلتر نوع:</span>
                                    <select
                                        value={categoryFilter}
                                        onChange={(e) => setCategoryFilter(e.target.value)}
                                        className="border border-slate-300 rounded-lg py-2 px-3 text-xs bg-white font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-slate-400 cursor-pointer"
                                    >
                                        <option value="all">همه تراکنش‌ها</option>
                                        <option value="sales">فقط فروش</option>
                                        <option value="sales_return">فقط مرجوعی فروش</option>
                                    </select>
                                </div>
                            </div>

                            {/* Ledger Table */}
                            <div className="overflow-x-auto border border-slate-100 rounded-lg max-h-[550px] overflow-y-auto">
                                <table className="w-full text-right text-xs">
                                    <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 z-10 text-slate-700">
                                        <tr>
                                            <th className="p-3.5 font-bold">تاریخ فاکتور</th>
                                            <th className="p-3.5 font-bold">شماره سند</th>
                                            <th className="p-3.5 font-bold">نوع سند Sayan</th>
                                            <th className="p-3.5 font-bold">گروه کالا</th>
                                            <th className="p-3.5 font-bold">کالا و مشخصات فنی</th>
                                            <th className="p-3.5 font-bold text-center">وزن خالص (ک‌گ)</th>
                                            <th className="p-3.5 font-bold text-center">وزن ناخالص (ک‌گ)</th>
                                            <th className="p-3.5 font-bold text-center">فی واحد خالص (ریال)</th>
                                            <th className="p-3.5 font-bold text-left">مجموع مبلغ (ریال)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {filteredLedger.length === 0 ? (
                                            <tr>
                                                <td colSpan={9} className="text-center py-12 text-slate-400 font-bold">تراکنشی با مشخصات فیلتر شده یافت نشد.</td>
                                            </tr>
                                        ) : (
                                            filteredLedger.map((row, idx) => {
                                                const isReturn = row.category.includes('return');
                                                return (
                                                    <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                                                        <td className="p-3 text-slate-500 font-bold whitespace-nowrap font-mono">{formatDateToJalali(row.date)}</td>
                                                        <td className="p-3 font-mono font-bold text-slate-600">{row.docId}</td>
                                                        <td className="p-3">
                                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${isReturn ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
                                                                {row.docTypeName}
                                                            </span>
                                                        </td>
                                                        <td className="p-3 font-semibold text-slate-600">{row.groupName}</td>
                                                        <td className="p-3">
                                                            <div className="font-extrabold text-slate-800">{row.itemName}</div>
                                                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">کد: {row.itemCode}</div>
                                                        </td>
                                                        <td className="p-3 text-center font-bold text-slate-800 font-mono">{row.netWeight.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
                                                        <td className="p-3 text-center text-slate-500 font-mono">{row.grossWeight > 0 ? row.grossWeight.toLocaleString(undefined, { maximumFractionDigits: 1 }) : '-'}</td>
                                                        <td className="p-3 text-center font-semibold text-emerald-700 font-mono">{row.unitPrice > 0 ? formatCurrency(Math.round(row.unitPrice)) : '-'}</td>
                                                        <td className={`p-3 text-left font-black font-mono ${isReturn ? 'text-rose-600' : 'text-blue-700'}`}>
                                                            {isReturn ? '-' : ''}{formatCurrency(row.amount)}
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* 5. CHARTS TAB */}
                    {activeSubTab === 'charts' && (
                        <div className="space-y-6">
                            {chartData.length === 0 ? (
                                <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500 font-bold">
                                    داده کافی جهت تولید نمودارهای تحلیلی در این بازه یافت نشد.
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    {/* Sales Amount Share */}
                                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                                        <h3 className="text-xs font-black text-slate-800 mb-6 text-center">سهم ریالی گروه‌های محصول از فروش کل</h3>
                                        <div className="h-72">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie
                                                        data={chartData}
                                                        cx="50%"
                                                        cy="50%"
                                                        innerRadius={60}
                                                        outerRadius={90}
                                                        paddingAngle={4}
                                                        dataKey="amount"
                                                        nameKey="name"
                                                    >
                                                        {chartData.map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip formatter={(value: any) => `${formatCurrency(value)} ریال`} />
                                                    <Legend formatter={(value) => <span className="text-[10px] font-bold text-slate-600">{value}</span>} />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>

                                    {/* Sales Weight Share */}
                                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                                        <h3 className="text-xs font-black text-slate-800 mb-6 text-center">سهم اوزان فروش خالص گروه‌های محصول (ک‌گ)</h3>
                                        <div className="h-72">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={chartData}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                                    <XAxis dataKey="name" tick={{ fontSize: 9, fontWeight: 'bold' }} />
                                                    <YAxis tick={{ fontSize: 9 }} />
                                                    <Tooltip formatter={(value: any) => `${value.toLocaleString()} ک‌گ`} />
                                                    <Legend wrapperStyle={{ fontSize: 10 }} />
                                                    <Bar name="وزن خالص کل (ک‌گ)" dataKey="weight" fill="#4f46e5">
                                                        {chartData.map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={COLORS[(index + 1) % COLORS.length]} />
                                                        ))}
                                                    </Bar>
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};
