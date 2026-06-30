import React, { useState, useEffect } from 'react';
import { Database, Search, RefreshCw, BarChart2, Table as TableIcon, DollarSign, Users, Activity, Loader2, X, Package, FileText, ArrowRight } from 'lucide-react';
import { apiCall } from '../services/apiService';
import { motion, AnimatePresence } from 'motion/react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';
import { jalaliToGregorian, getCurrentShamsiDate, formatDate } from '../constants';

const getShamsiMonthLength = (year: number, month: number) => {
    if (month <= 6) return 31;
    if (month <= 11) return 30;
    const matches = [1, 5, 9, 13, 17, 22, 26, 30];
    const rem = year % 33;
    return matches.includes(rem) ? 30 : 29;
};

const toIsoDateString = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

const ShamsiDatePicker = ({ date, onChange, label }: { date: any, onChange: (d: any) => void, label: string }) => {
    return (
        <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-slate-500">{label}</span>
            <div className="flex gap-2 text-xs">
                <input 
                    type="number" 
                    value={date.year} 
                    onChange={e => onChange({...date, year: parseInt(e.target.value) || 1400})} 
                    className="border border-slate-200 bg-white text-slate-700 p-1.5 rounded-lg focus:outline-none focus:border-indigo-500 w-20 text-center"
                    min="1390" max="1500"
                />
                <select value={date.month} onChange={e => onChange({...date, month: parseInt(e.target.value)})} className="border border-slate-200 bg-white text-slate-700 p-1.5 rounded-lg focus:outline-none focus:border-indigo-500">
                   {Array.from({length: 12}).map((_, i) => <option key={i} value={i+1}>{i+1}</option>)}
                </select>
                <select value={date.day} onChange={e => onChange({...date, day: parseInt(e.target.value)})} className="border border-slate-200 bg-white text-slate-700 p-1.5 rounded-lg focus:outline-none focus:border-indigo-500">
                   {Array.from({length: 31}).map((_, i) => <option key={i} value={i+1}>{i+1}</option>)}
                </select>
            </div>
        </div>
    );
};

const attemptQuery = async (query: string, tableName?: string) => {
    const pathList: any[] = [
        { path: 'sql', method: 'POST', body: { query } },
        { path: 'sql', method: 'POST', body: { sql: query } },
        { path: 'query', method: 'POST', body: { query } }
    ];
    if (tableName) {
        pathList.push({ path: tableName, method: 'GET', body: null });
    }
    let lastErr: any;
    for (const attempt of pathList) {
        try {
            const res: any = await apiCall('/sayan-proxy', 'POST', attempt);
            if (res && (Array.isArray(res) || res.data || res.rows || res.items || res.result)) {
                return Array.isArray(res) ? res : (res.data || res.rows || res.items || res.result || []);
            }
        } catch(e: any) {
            lastErr = e;
        }
    }
    throw lastErr || new Error("داده‌ای یافت نشد یا خطا در اجرای کوئری");
};

export default function SalesReports({ settings }: { settings: any }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const currentShamsi = getCurrentShamsiDate();
    const [startDate, setStartDate] = useState({ ...currentShamsi, day: 1 });
    const [endDate, setEndDate] = useState(currentShamsi);
    
    // Invoices list
    const [invoices, setInvoices] = useState<any[]>([]);
    
    // Products and groups mapping
    const [productsMap, setProductsMap] = useState<Record<string, any>>({});
    const [docTypes, setDocTypes] = useState<Record<string, string>>({});
    const [personsMap, setPersonsMap] = useState<Record<string, string>>({});

    const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
    const [invoiceDetails, setInvoiceDetails] = useState<any[]>([]);
    const [loadingDetails, setLoadingDetails] = useState(false);

    // Filter controls
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState<'sales' | 'returns'>('sales');
    const [viewMode, setViewMode] = useState<'list' | 'aggregate'>('list');
    const [aggregateData, setAggregateData] = useState<any[]>([]);
    const [loadingAggregate, setLoadingAggregate] = useState(false);

    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            const startIso = toIsoDateString(jalaliToGregorian(startDate.year, startDate.month, startDate.day));
            const endIso = toIsoDateString(jalaliToGregorian(endDate.year, endDate.month, endDate.day));
            const startShamsiStr = `${startDate.year}/${String(startDate.month).padStart(2, '0')}/${String(startDate.day).padStart(2, '0')}`;
            const endShamsiStr = `${endDate.year}/${String(endDate.month).padStart(2, '0')}/${String(endDate.day).padStart(2, '0')}`;

            // Fetch metadata maps
            const dTypes: Record<string, string> = {};
            const pMap: Record<string, string> = {};
            const prodMap: Record<string, any> = {};

            try {
                const types = await attemptQuery("SELECT Field_001, Field_004 FROM STR_TBL_006", 'STR_TBL_006');
                types.forEach((t: any) => { if (t.Field_001 && t.Field_004) dTypes[String(t.Field_001).trim()] = String(t.Field_004).trim(); });
                setDocTypes(dTypes);
            } catch (e) { console.warn("Doc types fetch failed"); }

            try {
                const tafsili = await attemptQuery("SELECT Field_003, Field_006 FROM ACT_TBL_007", 'ACT_TBL_007');
                tafsili.forEach((t: any) => { if (t.Field_003 && t.Field_006) pMap[String(t.Field_003).trim()] = String(t.Field_006).trim(); });
                setPersonsMap(pMap);
            } catch (e) { console.warn("Tafsili fetch failed"); }

            try {
                // Products
                const prods = await attemptQuery("SELECT Field_001, Field_003, Field_004 FROM COM_TBL_008", 'COM_TBL_008');
                prods.forEach((p: any) => { 
                    if (p.Field_001) {
                        prodMap[String(p.Field_001).trim()] = {
                            code: String(p.Field_003 || '').trim(),
                            name: String(p.Field_004 || '').trim()
                        };
                    }
                });
                setProductsMap(prodMap);
            } catch (e) { console.warn("Products fetch failed"); }

            // Fetch Invoice Headers (Sales and Returns)
            const query = `SELECT TOP 5000 * FROM STR_TBL_010 ORDER BY Field_008 DESC`;
            const data = await attemptQuery(query, 'STR_TBL_010');
            
            const processed = data.map((row: any) => {
                const typeId = String(row.Field_004 || '').trim();
                const typeName = dTypes[typeId] || `نوع ${typeId}`;
                const isCancelled = String(row.Field_019).toLowerCase() === 'true' || row.Field_019 === 1;
                const personId = String(row.Field_010 || row.Field_011 || '').trim();
                const personName = personId ? (pMap[personId] || personId) : '';
                const date = row.Field_008 || row.Date;
                const totalAmount = parseFloat(row.Field_027 || row.Field_038 || row.Field_037 || row.Field_025 || 0);

                // Group categorization based on Name
                let group = 'other';
                if (typeName.includes('فروش') || typeName.includes('فاکتور')) group = 'sales';
                if (typeName.includes('مرجوع') || typeName.includes('برگشت')) group = 'returns';

                return {
                    id: row.Field_001 || row.ID,
                    typeId,
                    typeName,
                    isCancelled,
                    personName,
                    date,
                    totalAmount,
                    group,
                    description: String(row.Field_028 || row.Field_029 || row.Description || ''),
                };
            }).filter((r: any) => {
                if (r.isCancelled) return false;
                if (r.group === 'other') return false;
                
                // Date check
                if (r.date) {
                    const isIso = r.date.includes('-');
                    if (isIso) {
                        if (r.date < startIso || r.date > endIso + 'T23:59:59') return false;
                    } else {
                        if (r.date < startShamsiStr || r.date > endShamsiStr) return false;
                    }
                }
                return true;
            });
            
            setInvoices(processed);

        } catch (err: any) {
            setError(err.message || 'خطا در دریافت اطلاعات');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const loadAggregateData = async () => {
        setLoadingAggregate(true);
        try {
            // Fetch all details for current sales/returns tab
            // Wait, to avoid heavy query, we can query details where Field_003 is in our displayedInvoices.
            // Since it could be many, we fetch them in chunks or just fetch top 10000.
            const query = `SELECT TOP 10000 * FROM STR_TBL_011`; 
            // We just fetch all details, then filter in memory based on displayed invoices.
            const allDetails = await attemptQuery(query, 'STR_TBL_011');
            
            // map header ID to invoice
            const invoiceMap: Record<string, any> = {};
            invoices.forEach(inv => {
                if (inv.group === activeTab) invoiceMap[String(inv.id)] = inv;
            });
            
            const prodAgg: Record<string, any> = {};

            allDetails.forEach((row: any) => {
                const headerId = String(row.Field_003 || '').trim();
                if (invoiceMap[headerId]) {
                    const prodId = String(row.Field_004 || '').trim();
                    const prodInfo = productsMap[prodId] || { name: 'نامشخص', code: row.Field_005 || '' };
                    const weight = parseFloat(row.Field_006 || row.Weight || 0);
                    const amount = parseFloat(row.Field_010 || row.Amount || 0);
                    
                    if (!prodAgg[prodId]) {
                        prodAgg[prodId] = {
                            prodId,
                            productName: prodInfo.name,
                            productCode: prodInfo.code,
                            weight: 0,
                            amount: 0,
                            count: 0
                        };
                    }
                    prodAgg[prodId].weight += weight;
                    prodAgg[prodId].amount += amount;
                    prodAgg[prodId].count += 1;
                }
            });

            // sort by amount descending
            const aggArr = Object.values(prodAgg).sort((a, b) => b.amount - a.amount);
            setAggregateData(aggArr);

        } catch (e) {
            console.error("Failed aggregate", e);
        } finally {
            setLoadingAggregate(false);
        }
    };

    useEffect(() => {
        if (viewMode === 'aggregate') {
            loadAggregateData();
        }
    }, [viewMode, activeTab, invoices]);

    const fetchInvoiceDetails = async (invoiceId: string) => {
        setLoadingDetails(true);
        try {
            // Find items where Field_003 (Header ID) equals invoiceId
            const query = `SELECT * FROM STR_TBL_011 WHERE Field_003 = '${invoiceId}'`;
            const details = await attemptQuery(query, 'STR_TBL_011');
            
            const processed = details.map((row: any) => {
                const prodId = String(row.Field_004 || '').trim();
                const prodInfo = productsMap[prodId] || { name: 'نامشخص', code: row.Field_005 || '' };
                const weight = parseFloat(row.Field_006 || row.Weight || 0);
                const fee = parseFloat(row.Field_008 || row.Fee || 0);
                const amount = parseFloat(row.Field_010 || row.Amount || 0);

                return {
                    id: row.Field_001,
                    productName: prodInfo.name,
                    productCode: prodInfo.code,
                    weight,
                    fee,
                    amount,
                    description: String(row.Field_031 || row.Description || '')
                };
            });
            setInvoiceDetails(processed);
        } catch (err) {
            console.error("Failed to load invoice details", err);
            setInvoiceDetails([]);
        } finally {
            setLoadingDetails(false);
        }
    };

    const handleSelectInvoice = (inv: any) => {
        setSelectedInvoice(inv);
        fetchInvoiceDetails(inv.id);
    };

    const displayedInvoices = invoices.filter(inv => {
        if (inv.group !== activeTab) return false;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            return (inv.personName?.toLowerCase().includes(q) || inv.typeName?.toLowerCase().includes(q) || inv.id?.toString().includes(q));
        }
        return true;
    });

    const totalAmount = displayedInvoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);

    return (
        <div className="flex flex-col h-full bg-[#f8fafc] text-slate-800 font-sans" dir="rtl">
            {/* Header & Controls */}
            <div className="bg-white border-b border-slate-200 p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 shrink-0 z-10 shadow-sm relative">
                <div className="flex items-center gap-4">
                    <div className="bg-indigo-600 p-3 rounded-2xl shadow-lg shadow-indigo-200">
                        <FileText size={28} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-800 tracking-tight">گزارشات فروش کالا</h1>
                        <p className="text-sm text-slate-500 font-medium mt-1">مشاهده فاکتورهای فروش و مرجوعی به همراه ریز کالاها</p>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row items-end sm:items-center gap-4 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-sm ml-4">
                        <button 
                            onClick={() => setViewMode('list')}
                            className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${viewMode === 'list' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            لیست فاکتورها
                        </button>
                        <button 
                            onClick={() => setViewMode('aggregate')}
                            className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${viewMode === 'aggregate' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            گزارش تجمیعی
                        </button>
                    </div>

                    <ShamsiDatePicker date={startDate} onChange={setStartDate} label="از تاریخ" />
                    <div className="w-px h-10 bg-slate-200 hidden sm:block"></div>
                    <ShamsiDatePicker date={endDate} onChange={setEndDate} label="تا تاریخ" />
                    
                    <button 
                        onClick={loadData}
                        disabled={loading}
                        className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-md shadow-indigo-200 hover:bg-indigo-700 hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-70 h-[38px] mt-4 sm:mt-0 w-full sm:w-auto"
                    >
                        {loading ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
                        بروزرسانی
                    </button>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {viewMode === 'list' ? (
                    <>
                        {/* Sidebar Invoices List */}
                        <div className="w-1/3 border-l border-slate-200 bg-white flex flex-col z-0">
                            <div className="p-4 border-b border-slate-100 flex flex-col gap-3 shrink-0 bg-white">
                                <div className="flex items-center gap-2 bg-slate-100/80 p-1 rounded-xl">
                                    <button 
                                        onClick={() => setActiveTab('sales')}
                                        className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'sales' ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/60' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        فاکتورهای فروش
                                    </button>
                                    <button 
                                        onClick={() => setActiveTab('returns')}
                                        className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'returns' ? 'bg-white text-rose-700 shadow-sm border border-slate-200/60' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        مرجوعی‌ها
                                    </button>
                                </div>
                                
                                <div className="relative">
                                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                    <input 
                                        type="text" 
                                        placeholder="جستجو در فاکتورها (شماره، شخص، نوع)..." 
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400"
                                    />
                                </div>
                                
                                <div className="flex justify-between items-center px-1">
                                    <span className="text-xs font-bold text-slate-500">{displayedInvoices.length} فاکتور یافت شد</span>
                                    <span className="text-xs font-bold text-slate-700">مجموع: {totalAmount.toLocaleString()} ریال</span>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50/50">
                                {loading ? (
                                    <div className="flex items-center justify-center h-40">
                                        <Loader2 size={24} className="animate-spin text-indigo-500" />
                                    </div>
                                ) : displayedInvoices.length > 0 ? (
                                    displayedInvoices.map((inv) => (
                                        <div 
                                            key={inv.id}
                                            onClick={() => handleSelectInvoice(inv)}
                                            className={`p-4 rounded-xl cursor-pointer transition-all border ${selectedInvoice?.id === inv.id ? 'bg-indigo-50 border-indigo-200 shadow-sm ring-1 ring-indigo-500/20' : 'bg-white border-slate-200 hover:border-indigo-200 hover:shadow-sm'}`}
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="text-xs font-bold px-2 py-1 bg-slate-100 text-slate-600 rounded-md">#{inv.id}</span>
                                                <span className="text-[11px] font-medium text-slate-500" dir="ltr">{formatDate(inv.date)}</span>
                                            </div>
                                            <h4 className="font-bold text-slate-800 text-sm mb-1 truncate">{inv.personName || 'شخص نامشخص'}</h4>
                                            <div className="flex justify-between items-end mt-3">
                                                <span className="text-[11px] font-medium text-slate-500">{inv.typeName}</span>
                                                <span className={`font-mono font-bold text-sm ${activeTab === 'sales' ? 'text-indigo-600' : 'text-rose-600'}`} dir="ltr">
                                                    {inv.totalAmount.toLocaleString()} <span className="text-[10px] font-sans text-slate-500 ml-1">ریال</span>
                                                </span>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-10 text-slate-400 text-sm font-medium">
                                        فاکتوری یافت نشد.
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Main Content Area - Invoice Details */}
                        <div className="flex-1 flex flex-col bg-slate-50/30 overflow-hidden relative">
                            {error && (
                                <div className="absolute top-4 left-4 right-4 bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-xl flex items-start gap-3 z-20 shadow-sm">
                                    <Database size={20} className="mt-0.5 text-rose-500 shrink-0" />
                                    <div className="flex-1">
                                        <h3 className="font-bold text-sm">خطا در دریافت اطلاعات</h3>
                                        <p className="text-xs opacity-90 mt-1">{error}</p>
                                    </div>
                                    <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-600"><X size={18} /></button>
                                </div>
                            )}

                            {selectedInvoice ? (
                                <div className="flex-1 overflow-y-auto p-6 md:p-8">
                                    <motion.div 
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden"
                                    >
                                        <div className="p-6 md:p-8 border-b border-slate-100">
                                            <div className="flex justify-between items-start mb-6">
                                                <div>
                                                    <h2 className="text-2xl font-black text-slate-800">{selectedInvoice.personName || 'شخص نامشخص'}</h2>
                                                    <p className="text-slate-500 font-medium text-sm mt-1">{selectedInvoice.typeName}</p>
                                                </div>
                                                <div className="text-left">
                                                    <div className="text-xs font-bold text-slate-400 mb-1">شماره سند</div>
                                                    <div className="text-lg font-mono font-bold text-slate-700">#{selectedInvoice.id}</div>
                                                    <div className="text-xs font-medium text-slate-500 mt-1" dir="ltr">{formatDate(selectedInvoice.date)}</div>
                                                </div>
                                            </div>
                                            
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                                                <div>
                                                    <div className="text-xs font-bold text-slate-500 mb-1">مبلغ کل فاکتور</div>
                                                    <div className="font-mono font-bold text-slate-800" dir="ltr">{selectedInvoice.totalAmount.toLocaleString()}</div>
                                                </div>
                                                <div>
                                                    <div className="text-xs font-bold text-slate-500 mb-1">تعداد اقلام</div>
                                                    <div className="font-mono font-bold text-slate-800">{invoiceDetails.length} قلم</div>
                                                </div>
                                                <div className="col-span-2">
                                                    <div className="text-xs font-bold text-slate-500 mb-1">توضیحات فاکتور</div>
                                                    <div className="text-sm font-medium text-slate-700 truncate" title={selectedInvoice.description}>{selectedInvoice.description || '-'}</div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="p-0">
                                            {loadingDetails ? (
                                                <div className="flex items-center justify-center py-20">
                                                    <Loader2 size={32} className="animate-spin text-indigo-500" />
                                                </div>
                                            ) : invoiceDetails.length > 0 ? (
                                                <table className="w-full text-right text-sm">
                                                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold text-[11px]">
                                                        <tr>
                                                            <th className="px-6 py-4 whitespace-nowrap">ردیف</th>
                                                            <th className="px-6 py-4 whitespace-nowrap">کد کالا</th>
                                                            <th className="px-6 py-4 whitespace-nowrap w-1/3">نام کالا</th>
                                                            <th className="px-6 py-4 whitespace-nowrap">مقدار / وزن</th>
                                                            <th className="px-6 py-4 whitespace-nowrap">فی (ریال)</th>
                                                            <th className="px-6 py-4 whitespace-nowrap">مبلغ کل (ریال)</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100">
                                                        {invoiceDetails.map((item, idx) => (
                                                            <tr key={idx} className="hover:bg-slate-50/50 transition-colors group">
                                                                <td className="px-6 py-4 whitespace-nowrap text-slate-400 font-mono text-xs">{idx + 1}</td>
                                                                <td className="px-6 py-4 whitespace-nowrap font-mono text-xs text-slate-500">{item.productCode}</td>
                                                                <td className="px-6 py-4">
                                                                    <div className="font-bold text-slate-700 text-sm">{item.productName}</div>
                                                                    {item.description && <div className="text-xs text-slate-500 mt-1 truncate max-w-sm" title={item.description}>{item.description}</div>}
                                                                </td>
                                                                <td className="px-6 py-4 whitespace-nowrap font-mono font-bold text-slate-700" dir="ltr">{item.weight.toLocaleString()}</td>
                                                                <td className="px-6 py-4 whitespace-nowrap font-mono text-xs text-slate-500" dir="ltr">{item.fee.toLocaleString()}</td>
                                                                <td className="px-6 py-4 whitespace-nowrap font-mono font-bold text-indigo-700" dir="ltr">{item.amount.toLocaleString()}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                    <tfoot className="bg-slate-50/80 border-t border-slate-200 font-bold">
                                                        <tr>
                                                            <td colSpan={3} className="px-6 py-4 text-left text-slate-600">جمع کل:</td>
                                                            <td className="px-6 py-4 font-mono text-slate-800" dir="ltr">
                                                                {invoiceDetails.reduce((sum, item) => sum + item.weight, 0).toLocaleString()}
                                                            </td>
                                                            <td className="px-6 py-4"></td>
                                                            <td className="px-6 py-4 font-mono text-indigo-700" dir="ltr">
                                                                {invoiceDetails.reduce((sum, item) => sum + item.amount, 0).toLocaleString()}
                                                            </td>
                                                        </tr>
                                                    </tfoot>
                                                </table>
                                            ) : (
                                                <div className="text-center py-20 text-slate-400">
                                                    <Package size={48} className="mx-auto mb-4 opacity-20" />
                                                    <p className="text-sm font-medium">هیچ قلم کالایی برای این فاکتور یافت نشد.</p>
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>
                                </div>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8">
                                    <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-sm border border-slate-100 mb-6">
                                        <FileText size={40} className="text-indigo-200" />
                                    </div>
                                    <h3 className="text-lg font-bold text-slate-600 mb-2">یک فاکتور را انتخاب کنید</h3>
                                    <p className="text-sm text-center max-w-sm leading-relaxed">
                                        برای مشاهده جزئیات کامل شامل لیست کالاها، مبالغ و وزن، از لیست سمت راست یک فاکتور را انتخاب کنید.
                                    </p>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="flex-1 overflow-y-auto p-6 md:p-8 flex flex-col">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-black text-slate-800">گزارش تجمیعی کالاها</h2>
                            <div className="flex items-center gap-2 bg-slate-100/80 p-1 rounded-xl">
                                <button 
                                    onClick={() => setActiveTab('sales')}
                                    className={`px-6 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'sales' ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/60' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    فروش
                                </button>
                                <button 
                                    onClick={() => setActiveTab('returns')}
                                    className={`px-6 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'returns' ? 'bg-white text-rose-700 shadow-sm border border-slate-200/60' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    مرجوعی
                                </button>
                            </div>
                        </div>

                        {loadingAggregate ? (
                            <div className="flex-1 flex flex-col items-center justify-center py-20">
                                <Loader2 size={40} className="animate-spin text-indigo-500 mb-4" />
                                <p className="text-slate-500 font-medium text-sm">در حال پردازش گزارش تجمیعی...</p>
                            </div>
                        ) : aggregateData.length > 0 ? (
                            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col">
                                <div className="flex-1 overflow-y-auto">
                                    <table className="w-full text-right text-sm">
                                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold text-[11px] sticky top-0 z-10 shadow-sm">
                                            <tr>
                                                <th className="px-6 py-4 whitespace-nowrap">ردیف</th>
                                                <th className="px-6 py-4 whitespace-nowrap">کد کالا</th>
                                                <th className="px-6 py-4 whitespace-nowrap w-1/3">نام کالا</th>
                                                <th className="px-6 py-4 whitespace-nowrap">تعداد دفعات فروش</th>
                                                <th className="px-6 py-4 whitespace-nowrap">مجموع وزن</th>
                                                <th className="px-6 py-4 whitespace-nowrap">مجموع مبلغ (ریال)</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {aggregateData.map((item, idx) => (
                                                <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="px-6 py-4 whitespace-nowrap text-slate-400 font-mono text-xs">{idx + 1}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap font-mono text-xs text-slate-500">{item.productCode}</td>
                                                    <td className="px-6 py-4 font-bold text-slate-700">{item.productName}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap font-mono text-xs text-slate-500">{item.count} بار</td>
                                                    <td className="px-6 py-4 whitespace-nowrap font-mono font-bold text-slate-700" dir="ltr">{item.weight.toLocaleString()}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap font-mono font-bold text-indigo-700" dir="ltr">{item.amount.toLocaleString()}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot className="bg-slate-50/80 border-t border-slate-200 font-bold">
                                            <tr>
                                                <td colSpan={4} className="px-6 py-4 text-left text-slate-600">جمع کل کالاها:</td>
                                                <td className="px-6 py-4 font-mono text-slate-800" dir="ltr">
                                                    {aggregateData.reduce((sum, item) => sum + item.weight, 0).toLocaleString()}
                                                </td>
                                                <td className="px-6 py-4 font-mono text-indigo-700" dir="ltr">
                                                    {aggregateData.reduce((sum, item) => sum + item.amount, 0).toLocaleString()}
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 py-20 bg-white rounded-2xl border border-slate-200">
                                <Package size={48} className="mb-4 opacity-20" />
                                <p className="text-sm font-medium">هیچ کالایی برای دوره انتخاب شده یافت نشد.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
