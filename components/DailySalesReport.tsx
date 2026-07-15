import React, { useState, useEffect } from 'react';
import { Loader2, TrendingUp, TrendingDown, ShoppingBag, Search, Filter, Layers, ListFilter, BarChart3, Printer } from 'lucide-react';
import * as jalaali from 'jalaali-js';
import { formatCurrency } from '../constants';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell } from 'recharts';

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
}

export const DailySalesReport: React.FC<DailySalesReportProps> = ({ dateFrom, dateTo }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [data, setData] = useState<any[]>([]);
    
    // Sub-tab selection: 'tree' | 'ledger' | 'charts'
    const [activeSubTab, setActiveSubTab] = useState<'tree' | 'ledger' | 'charts'>('tree');
    
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

    useEffect(() => {
        const fetchInitialMaps = async () => {
            try {
                // Get doc types
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
                
                // Add hardcoded knowns that might miss
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

    const fetchReport = async () => {
        if (!dateFrom || !dateTo) {
            setError("لطفاً تاریخ شروع و پایان را مشخص کنید.");
            return;
        }
        setIsLoading(true);
        setError('');
        try {
            const gregFrom = jalaliToGregorianStr(dateFrom);
            const gregTo = jalaliToGregorianStr(dateTo);
            
            // To prevent timeout, we do simple joins or separated queries
            // Fetch headers including notes (Field_029)
            const sqlHeaders = `
                SELECT 
                    Field_001 as DocId, 
                    Field_008 as DocDate, 
                    Field_009 as DocType,
                    Field_029 as Notes
                FROM STR_TBL_010 
                WHERE Field_008 >= '${gregFrom}T00:00:00.000Z' 
                  AND Field_008 <= '${gregTo}T23:59:59.000Z'
            `;
            const headers = await runSayanQuery(sqlHeaders);
            
            if (!headers || headers.length === 0) {
                setData([]);
                setIsLoading(false);
                return;
            }
            
            const docIds = headers.map((h: any) => h.DocId);
            
            // Batch docIds to prevent query string too long
            const maxBatch = 1000;
            let items: any[] = [];
            for (let i = 0; i < docIds.length; i += maxBatch) {
                const batch = docIds.slice(i, i + maxBatch);
                const idsStr = batch.map((id: string) => `'${id}'`).join(',');
                const sqlItems = `
                    SELECT 
                        Field_004 as DocId,
                        Field_005 as ItemCode,
                        Field_006 as Quantity,
                        Field_031 as ItemNotes,
                        Field_037 as Amount
                    FROM STR_TBL_011
                    WHERE Field_004 IN (${idsStr})
                `;
                const batchItems = await runSayanQuery(sqlItems);
                items = [...items, ...batchItems];
            }
            
            // Get unique items
            const uniqueItemCodes = Array.from(new Set(items.map(i => i.ItemCode).filter(Boolean)));
            
            let productMap: Record<string, { name: string, group: string }> = {};
            if (uniqueItemCodes.length > 0) {
                for (let i = 0; i < uniqueItemCodes.length; i += 500) {
                    const batchCodes = uniqueItemCodes.slice(i, i + 500);
                    const codesStr = batchCodes.map(c => `'${c}'`).join(',');
                    
                    const sqlProd = `
                        SELECT 
                            t1.Field_004 as ItemCode,
                            t2.Field_004 as ItemName,
                            g.Field_003 as GroupName
                        FROM IND_TBL_021 t1
                        LEFT JOIN IND_TBL_022 t2 ON t2.Field_001 = (SELECT TOP 1 p2.Field_001 FROM IND_TBL_022 p2 WHERE p2.Field_005 = t1.Field_004 OR p2.Field_001 = t1.Field_001)
                        LEFT JOIN IND_TBL_002 g ON g.Field_003 = t1.Field_003
                        WHERE t1.Field_004 IN (${codesStr})
                    `;
                    try {
                        const prods = await runSayanQuery(sqlProd);
                        prods.forEach((p: any) => {
                            productMap[p.ItemCode] = {
                                name: p.ItemName || 'نامشخص',
                                group: p.GroupName || 'بدون گروه'
                            };
                        });
                    } catch (e) {
                        console.warn("Error fetching products:", e);
                    }
                }
            }
            
            // Combine data with note weight/fee parsing
            const enriched = items.map(item => {
                const header = headers.find((h: any) => h.DocId === item.DocId);
                const prod = productMap[item.ItemCode] || { name: item.ItemCode || 'نامشخص', group: 'نامشخص' };
                const docType = header ? header.DocType : 'unknown';
                
                // Classify generic category
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
                
                const q = parseFloat(item.Quantity || 0);
                const itemNotes = item.ItemNotes || '';
                const docNotes = header ? header.Notes : '';
                const amt = parseFloat(item.Amount || 0);

                const netW = parseNetWeight(itemNotes, q);
                const grossW = parseGrossWeight(itemNotes);
                const fee = parseFee(itemNotes, docNotes, amt, netW);

                return {
                    docId: item.DocId,
                    date: header ? header.DocDate : '',
                    docType: docType,
                    docTypeName: docTypeName,
                    category: category,
                    itemCode: item.ItemCode,
                    itemName: prod.name,
                    groupName: prod.group,
                    quantity: q,
                    netWeight: netW,
                    grossWeight: grossW,
                    amount: amt,
                    unitPrice: fee
                };
            });
            
            // Monthly Sales Amount Logic
            try {
                let cleanDate = dateFrom.trim()
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
                        setMonthlySalesAmount(monthlyData[0].MonthTotal);
                    } else {
                        setMonthlySalesAmount(0);
                    }
                }
            } catch(e) {
                console.warn("Failed to get monthly sales:", e);
                setMonthlySalesAmount(0);
            }

            setData(enriched);
        } catch (err: any) {
            setError(err.message || 'خطا در دریافت اطلاعات فروش');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (dateFrom && dateTo) {
            fetchReport();
        }
    }, [dateFrom, dateTo, docTypeMap]);

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

    // Prepare chart data (Group totals)
    const getChartData = () => {
        const groups: Record<string, { name: string; amount: number; weight: number }> = {};
        data.filter(d => d.category === 'sales').forEach(row => {
            const grp = row.groupName || 'سایر گروه‌ها';
            if (!groups[grp]) {
                groups[grp] = { name: grp, amount: 0, weight: 0 };
            }
            groups[grp].amount += row.amount;
            groups[grp].weight += row.netWeight;
        });
        return Object.values(groups).sort((a, b) => b.amount - a.amount);
    };

    const chartData = getChartData();

    // Palette for charts
    const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#34d399'];

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-extrabold text-slate-800">گزارش هوشمند فروش روزانه و تحلیلی</h2>
                    <p className="text-xs text-slate-500 mt-1">پایش لحظه‌ای اسناد فروش، فاکتورهای غیر رسمی، وزن دقیق خالص کالا و فی‌های استخراجی</p>
                </div>
                <div className="flex items-center gap-2 self-stretch sm:self-auto">
                    <button 
                        onClick={handlePrint}
                        className="flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3.5 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer border border-slate-200"
                        title="چاپ یا ذخیره PDF"
                    >
                        <Printer className="w-4 h-4" />
                        <span>نسخه چاپی / PDF</span>
                    </button>
                    <button 
                        onClick={fetchReport}
                        disabled={isLoading}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-extrabold hover:bg-blue-700 transition-colors cursor-pointer"
                    >
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
                        <span>استخراج مجدد از سایان</span>
                    </button>
                </div>
            </div>
            
            {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-xl text-xs font-bold border border-red-100">
                    {error}
                </div>
            )}
            
            {isLoading && data.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 bg-white rounded-xl border border-slate-200/60 shadow-sm">
                    <Loader2 className="w-12 h-12 animate-spin text-blue-600 mb-4" />
                    <p className="text-slate-600 font-bold text-sm">در حال اتصال به سرور سایان ERP و استخراج تراکنش‌ها...</p>
                    <p className="text-slate-400 text-xs mt-2">محاسبه اوزان خالص و ناخالص، واکشی نام‌ها و انطباق قیمت‌ها</p>
                </div>
            ) : data.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-16 text-center">
                    <ShoppingBag className="w-14 h-14 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-lg font-bold text-slate-700">تراکنشی در این بازه یافت نشد</h3>
                    <p className="text-xs text-slate-500 mt-2">در بازه زمانی انتخاب شده، هیچ فاکتور فروش یا سندی ثبت نگردیده است.</p>
                </div>
            ) : (
                <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
                            <span className="text-[10px] font-bold text-slate-500 mb-1">جمع فروش ناخالص</span>
                            <span className="text-xl font-black text-emerald-600 font-mono">{formatCurrency(totalSalesAmount)} <span className="text-xs font-medium text-slate-500 font-sans">ریال</span></span>
                            <span className="text-[10px] text-slate-400 mt-2">بدون احتساب مرجوعی‌ها</span>
                        </div>
                        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
                            <span className="text-[10px] font-bold text-slate-500 mb-1">جمع مرجوعی فروش</span>
                            <span className="text-xl font-black text-rose-600 font-mono">{formatCurrency(totalReturnsAmount)} <span className="text-xs font-medium text-slate-500 font-sans">ریال</span></span>
                            <span className="text-[10px] text-slate-400 mt-2">اسناد برگشت از فروش</span>
                        </div>
                        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
                            <span className="text-[10px] font-bold text-slate-500 mb-1">صافی فروش خالص</span>
                            <span className="text-xl font-black text-blue-600 font-mono">{formatCurrency(totalSalesAmount - totalReturnsAmount)} <span className="text-xs font-medium text-slate-500 font-sans">ریال</span></span>
                            <span className="text-[10px] text-slate-400 mt-2">عملکرد فروش خالص این بازه</span>
                        </div>
                        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
                            <span className="text-[10px] font-bold text-slate-500 mb-1">حجم کل فروش وزن خالص</span>
                            <span className="text-xl font-black text-indigo-600 font-mono">{totalSalesWeight.toLocaleString(undefined, { maximumFractionDigits: 1 })} <span className="text-xs font-medium text-slate-500 font-sans">ک‌گ</span></span>
                            <span className="text-[10px] text-slate-400 mt-2">میانگین نرخ: {formatCurrency(totalSalesWeight > 0 ? (totalSalesAmount / totalSalesWeight) : 0)} ریال</span>
                        </div>
                        <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 shadow-sm flex flex-col justify-between text-white">
                            <span className="text-[10px] font-bold text-slate-400 mb-1">کل فروش رسمی و غیررسمی ماه جاری</span>
                            <span className="text-xl font-black text-amber-400 font-mono">{formatCurrency(monthlySalesAmount)} <span className="text-xs font-medium text-slate-400 font-sans">ریال</span></span>
                            <span className="text-[10px] text-slate-400 mt-2">تعداد اقلام بازه: {data.length} مورد</span>
                        </div>
                    </div>

                    {/* Navigation Sub-Tabs */}
                    <div className="flex border-b border-slate-200 gap-1 bg-slate-50 p-1 rounded-lg">
                        <button 
                            onClick={() => setActiveSubTab('tree')}
                            className={`flex items-center gap-1.5 py-2.5 px-4 rounded-md text-xs font-bold transition-all cursor-pointer ${activeSubTab === 'tree' ? 'bg-white shadow text-blue-600' : 'text-slate-600 hover:bg-slate-100'}`}
                        >
                            <Layers className="w-4 h-4" />
                            <span>درختواره کالاها و اوزان</span>
                        </button>
                        <button 
                            onClick={() => setActiveSubTab('ledger')}
                            className={`flex items-center gap-1.5 py-2.5 px-4 rounded-md text-xs font-bold transition-all cursor-pointer ${activeSubTab === 'ledger' ? 'bg-white shadow text-blue-600' : 'text-slate-600 hover:bg-slate-100'}`}
                        >
                            <ListFilter className="w-4 h-4" />
                            <span>ریز تفصیلی فاکتورها (دفتر روزانه)</span>
                        </button>
                        <button 
                            onClick={() => setActiveSubTab('charts')}
                            className={`flex items-center gap-1.5 py-2.5 px-4 rounded-md text-xs font-bold transition-all cursor-pointer ${activeSubTab === 'charts' ? 'bg-white shadow text-blue-600' : 'text-slate-600 hover:bg-slate-100'}`}
                        >
                            <BarChart3 className="w-4 h-4" />
                            <span>تحلیل و سهم گروه‌ها</span>
                        </button>
                    </div>

                    {/* 1. TREE VIEW SUB-TAB */}
                    {activeSubTab === 'tree' && (
                        <div className="space-y-6">
                            {['sales', 'sales_return', 'purchases', 'purchases_return', 'other'].map(catKey => {
                                const catNode = grouped[catKey];
                                if (!catNode) return null;
                                if (catKey === 'other' && catNode.totalAmount === 0) return null; 
                                
                                const catTitle = categoryLabels[catKey] || catKey;
                                
                                return (
                                    <div key={catKey} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
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

                    {/* 2. DETAILED LEDGER SUB-TAB */}
                    {activeSubTab === 'ledger' && (
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden space-y-4 p-4">
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
                                        className="border border-slate-300 rounded-lg py-2 px-3 text-xs bg-white font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="all">همه تراکنش‌ها</option>
                                        <option value="sales">فقط فروش</option>
                                        <option value="sales_return">فقط مرجوعی فروش</option>
                                        <option value="purchases">فقط خرید</option>
                                        <option value="purchases_return">فقط مرجوعی خرید</option>
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

                    {/* 3. CHARTS SUB-TAB */}
                    {activeSubTab === 'charts' && (
                        <div className="space-y-6">
                            {chartData.length === 0 ? (
                                <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500 font-bold">
                                    داده کافی جهت تولید نمودارهای تحلیلی در این بازه یافت نشد.
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    {/* Sales Amount Share */}
                                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
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
                                                    <Legend formatter={(value, entry: any) => <span className="text-[10px] font-bold text-slate-600">{value}</span>} />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>

                                    {/* Sales Weight Share */}
                                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
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
