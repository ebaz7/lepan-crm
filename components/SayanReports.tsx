import React, { useState, useEffect, useMemo } from 'react';
import { Database, Search, RefreshCw, BarChart2, Table as TableIcon, Download, DollarSign, Users, Calendar, Activity, Loader2, ArrowRight, User } from 'lucide-react';
import { apiCall } from '../services/apiService';
import { motion } from 'motion/react';
import * as XLSX from 'xlsx';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import jMoment from 'moment-jalaali';

type ReportType = 'SALES' | 'CUSTOMER_STATEMENT' | 'DEBTORS_CREDITORS';

const SayanReports: React.FC = () => {
  const [activeReport, setActiveReport] = useState<ReportType>('SALES');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeFilter, setTimeFilter] = useState<'daily' | 'monthly' | 'yearly'>('daily');
  
  // Date filters in Shamsi
  const [startDate, setStartDate] = useState(jMoment().format('jYYYY/jMM/jDD'));
  const [endDate, setEndDate] = useState(jMoment().format('jYYYY/jMM/jDD'));
  
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCustomer, setActiveCustomer] = useState<{name: string, balance: number, type: 'debit'|'credit'} | null>(null);

  const fetchReportData = async (reportType: ReportType, customerName?: string) => {
    setLoading(true);
    setError(null);
    let sqlQuery = '';

    // Safely remove single quotes
    const safeCustomerName = customerName ? customerName.replace(/'/g, "''") : '';
    // Format dates to handle both with-slash and without-slash cases
    const safeStart = startDate.replace(/\//g, '');
    const safeEnd = endDate.replace(/\//g, '');

    const safeSumDebit = "SUM(CASE WHEN ISNUMERIC(Field_010) = 1 THEN CAST(Field_010 AS float) ELSE 0 END)";
    const safeSumCredit = "SUM(CASE WHEN ISNUMERIC(Field_011) = 1 THEN CAST(Field_011 AS float) ELSE 0 END)";

    if (reportType === 'SALES') {
      sqlQuery = `SELECT TOP 5000 Field_008 as [Date], Field_025 as [TotalSales] FROM BUR_TBL_008 WHERE Field_004=2 AND (CASE WHEN ISNUMERIC(Field_025) = 1 THEN CAST(Field_025 AS float) ELSE 0 END) > 0 AND (REPLACE(Field_008, '/', '') >= '${safeStart}' AND REPLACE(Field_008, '/', '') <= '${safeEnd}') ORDER BY Field_008 DESC`;
    } else if (reportType === 'CUSTOMER_STATEMENT') {
      if (safeCustomerName) {
        sqlQuery = `SELECT TOP 2000 Field_008 as [Date], Field_007 as [Description], Field_010 as [Debit], Field_011 as [Credit] FROM ACT_TBL_003 WHERE Field_006 = N'${safeCustomerName}' AND (REPLACE(Field_008, '/', '') >= '${safeStart}' AND REPLACE(Field_008, '/', '') <= '${safeEnd}') ORDER BY Field_008 ASC`;
      } else {
        sqlQuery = `SELECT TOP 5000 Field_006 as [AccountName], ${safeSumDebit} as [TotalDebit], ${safeSumCredit} as [TotalCredit] FROM ACT_TBL_003 WHERE Field_006 IS NOT NULL AND (REPLACE(Field_008, '/', '') >= '${safeStart}' AND REPLACE(Field_008, '/', '') <= '${safeEnd}') GROUP BY Field_006 HAVING ${safeSumDebit} > 0 OR ${safeSumCredit} > 0`;
      }
    } else if (reportType === 'DEBTORS_CREDITORS') {
      sqlQuery = `SELECT TOP 5000 Field_006 as [AccountName], ${safeSumDebit} as [TotalDebit], ${safeSumCredit} as [TotalCredit] FROM ACT_TBL_003 WHERE Field_006 IS NOT NULL AND (REPLACE(Field_008, '/', '') >= '${safeStart}' AND REPLACE(Field_008, '/', '') <= '${safeEnd}') GROUP BY Field_006 HAVING ${safeSumDebit} > 0 OR ${safeSumCredit} > 0 ORDER BY ${safeSumDebit} DESC`;
    }

    try {
      // Try to execute the query
      let result: any = null;
      try {
          result = await apiCall('/sayan-proxy', 'POST', { path: 'query', method: 'POST', body: { query: sqlQuery } });
      } catch (err: any) {
          console.log("Fallback to path: 'sql'");
          result = await apiCall('/sayan-proxy', 'POST', { path: 'sql', method: 'POST', body: { sql: sqlQuery } });
      }

      const rawData = Array.isArray(result) ? result : (result?.data || result?.rows || result?.items || result?.result || []);
      setData(rawData);
    } catch (err: any) {
      console.error('Sayan Error:', err);
      const errMsg = err.response ? JSON.stringify(err.response) : err.message;
      setError(errMsg || 'خطا در ارتباط با سرور سایان');
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData(activeReport, activeCustomer?.name);
  }, [activeReport, activeCustomer]);

  const exportData = () => {
    if (!data.length) return;
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, `Sayan_Report_${activeReport}.xlsx`);
  };
  
  // Calculate aggregated sales data
  const aggregatedSales = useMemo(() => {
    if (activeReport !== 'SALES') return [];
    const aggs: Record<string, number> = {};
    data.forEach(row => {
      const d = String(row.Date || '');
      // Assuming d is like '1403/04/05'
      const key = timeFilter === 'daily' ? d : d.substring(0, 7);
      if (key) aggs[key] = (aggs[key] || 0) + (parseFloat(row.TotalSales) || 0);
    });
    return Object.entries(aggs).map(([name, value]) => ({ name, value })).sort((a,b) => a.name.localeCompare(b.name));
  }, [data, timeFilter, activeReport]);

  const totalSalesAmount = useMemo(() => aggregatedSales.reduce((sum, item) => sum + item.value, 0), [aggregatedSales]);

  // Debtors and Creditors totals
  const dcTotals = useMemo(() => {
    if (activeReport !== 'DEBTORS_CREDITORS') return { debtors: 0, creditors: 0 };
    return data.reduce((acc, row) => {
      const debit = parseFloat(row.TotalDebit) || 0;
      const credit = parseFloat(row.TotalCredit) || 0;
      const balance = debit - credit;
      if (balance > 0) acc.debtors += balance;
      else if (balance < 0) acc.creditors += Math.abs(balance);
      return acc;
    }, { debtors: 0, creditors: 0 });
  }, [data, activeReport]);

  const filteredCustomers = useMemo(() => {
    if (activeReport !== 'CUSTOMER_STATEMENT' || activeCustomer) return [];
    return data.filter(row => String(row.AccountName || '').toLowerCase().includes(searchQuery.toLowerCase()));
  }, [data, activeReport, activeCustomer, searchQuery]);

  return (
    <div className="flex h-screen bg-[#f8fafc] text-slate-800 font-sans" dir="rtl">
      {/* Sidebar */}
      <div className="w-72 bg-white border-l border-slate-200 flex flex-col shadow-sm z-10">
        <div className="p-6 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-md shadow-indigo-200">
            <BarChart2 className="text-white" size={20} />
          </div>
          <div>
            <h2 className="font-extrabold text-slate-800 text-base">گزارشات هوشکار سایان</h2>
            <p className="text-[10px] text-slate-500 font-medium mt-0.5">سیستم یکپارچه مالی</p>
          </div>
        </div>

        <div className="p-4 flex-1 overflow-y-auto space-y-2">
          <button
            onClick={() => { setActiveReport('SALES'); setActiveCustomer(null); }}
            className={`w-full text-right p-4 rounded-xl transition-all flex items-center gap-3 ${
              activeReport === 'SALES' ? 'bg-indigo-500 text-white shadow-md shadow-indigo-200' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-indigo-200'
            }`}
          >
            <DollarSign size={18} className={activeReport === 'SALES' ? 'text-indigo-100' : 'text-indigo-500'} />
            <div>
              <div className="font-bold text-sm">فروش روزانه و ماهانه</div>
              <div className={`text-[10px] mt-1 ${activeReport === 'SALES' ? 'text-indigo-200' : 'text-slate-400'}`}>جمع مبالغ فاکتورها</div>
            </div>
          </button>

          <button
            onClick={() => { setActiveReport('CUSTOMER_STATEMENT'); setActiveCustomer(null); }}
            className={`w-full text-right p-4 rounded-xl transition-all flex items-center gap-3 ${
              activeReport === 'CUSTOMER_STATEMENT' ? 'bg-rose-500 text-white shadow-md shadow-rose-200' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-rose-200'
            }`}
          >
            <Users size={18} className={activeReport === 'CUSTOMER_STATEMENT' ? 'text-rose-100' : 'text-rose-500'} />
            <div>
              <div className="font-bold text-sm">صورتحساب مشتریان</div>
              <div className={`text-[10px] mt-1 ${activeReport === 'CUSTOMER_STATEMENT' ? 'text-rose-200' : 'text-slate-400'}`}>ریز گردش و تراکنش‌ها</div>
            </div>
          </button>

          <button
            onClick={() => { setActiveReport('DEBTORS_CREDITORS'); setActiveCustomer(null); }}
            className={`w-full text-right p-4 rounded-xl transition-all flex items-center gap-3 ${
              activeReport === 'DEBTORS_CREDITORS' ? 'bg-emerald-500 text-white shadow-md shadow-emerald-200' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-emerald-200'
            }`}
          >
            <Activity size={18} className={activeReport === 'DEBTORS_CREDITORS' ? 'text-emerald-100' : 'text-emerald-500'} />
            <div>
              <div className="font-bold text-sm">بدهکاران و بستانکاران</div>
              <div className={`text-[10px] mt-1 ${activeReport === 'DEBTORS_CREDITORS' ? 'text-emerald-200' : 'text-slate-400'}`}>مانده حساب‌های اشخاص</div>
            </div>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#f8fafc]">
        {/* Header */}
        <div className="h-20 border-b border-slate-200 bg-white flex items-center justify-between px-8 shadow-sm">
          <div className="flex flex-col">
            <div className="flex items-center gap-3">
              <h1 className="font-black text-lg text-slate-800">
                {activeReport === 'SALES' && 'داشبورد فروش'}
                {activeReport === 'CUSTOMER_STATEMENT' && !activeCustomer && 'انتخاب مشتری'}
                {activeReport === 'CUSTOMER_STATEMENT' && activeCustomer && 'صورتحساب مشتری'}
                {activeReport === 'DEBTORS_CREDITORS' && 'بدهکاران و بستانکاران'}
              </h1>
              {loading && <Loader2 size={16} className="animate-spin text-indigo-500" />}
            </div>
            {activeCustomer && (
              <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                <span className="font-bold text-slate-700">{activeCustomer.name}</span>
                <span>•</span>
                <span>مانده: <strong className={activeCustomer.type === 'debit' ? 'text-emerald-600' : 'text-rose-600'} dir="ltr">{activeCustomer.balance.toLocaleString()} {activeCustomer.type === 'debit' ? 'بدهکار' : 'بستانکار'}</strong></span>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-4">
            {/* Date Filters */}
            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg p-1 px-3 gap-2">
              <Calendar size={14} className="text-slate-400" />
              <div className="flex items-center gap-2 text-xs">
                <span>از</span>
                <input 
                  type="text" 
                  value={startDate} 
                  onChange={e => setStartDate(e.target.value)}
                  className="bg-white border border-slate-200 rounded px-2 py-1 w-24 text-center font-mono focus:outline-none focus:border-indigo-400"
                  placeholder="1403/01/01"
                  dir="ltr"
                />
                <span>تا</span>
                <input 
                  type="text" 
                  value={endDate} 
                  onChange={e => setEndDate(e.target.value)}
                  className="bg-white border border-slate-200 rounded px-2 py-1 w-24 text-center font-mono focus:outline-none focus:border-indigo-400"
                  placeholder="1403/12/29"
                  dir="ltr"
                />
              </div>
            </div>

             <button onClick={() => fetchReportData(activeReport, activeCustomer?.name)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors shadow-sm shadow-indigo-200">
              <RefreshCw size={14} /> اعمال و بروزرسانی
            </button>
            <button onClick={exportData} className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-bold rounded-lg transition-colors">
              <Download size={14} /> خروجی اکسل
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 p-8 overflow-y-auto">
          {error && (
            <div className="mb-6 bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-xl flex items-start gap-3">
              <Database size={20} className="mt-0.5 text-rose-500" />
              <div>
                <h3 className="font-bold text-sm">خطا در دریافت اطلاعات</h3>
                <p className="text-xs mt-1 opacity-80">{error}</p>
              </div>
            </div>
          )}

          {!loading && data.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              
              {/* Visualizer for Sales */}
              {activeReport === 'SALES' && (
                <>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                   <div className="lg:col-span-1 space-y-6">
                      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                         <div className="text-slate-500 text-xs font-bold mb-2">جمع کل فروش در بازه انتخابی</div>
                         <div className="text-3xl font-black text-indigo-600" dir="ltr">
                            {totalSalesAmount.toLocaleString()}
                         </div>
                      </div>
                      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                         <div className="text-slate-800 text-sm font-bold mb-4">فیلتر زمانی</div>
                         <div className="flex bg-slate-100 p-1 rounded-lg">
                           <button onClick={() => setTimeFilter('daily')} className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${timeFilter === 'daily' ? 'bg-white shadow text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}>روزانه</button>
                           <button onClick={() => setTimeFilter('monthly')} className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${timeFilter === 'monthly' ? 'bg-white shadow text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}>ماهانه</button>
                         </div>
                      </div>
                   </div>
                   
                   <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 h-[350px]">
                     <h3 className="text-sm font-bold text-slate-800 mb-6">نمودار فروش {timeFilter === 'daily' ? 'روزانه' : 'ماهانه'}</h3>
                     <ResponsiveContainer width="100%" height="100%">
                       <BarChart data={aggregatedSales} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                         <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                         <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                         <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(val) => (val/1000000).toFixed(0) + 'm'} />
                         <Tooltip 
                           cursor={{ fill: '#f8fafc' }}
                           contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px', textAlign: 'right', direction: 'rtl' }}
                           formatter={(value: number) => [value.toLocaleString(), 'مبلغ']}
                           labelStyle={{ fontWeight: 'bold', color: '#0f172a', marginBottom: '4px' }}
                         />
                         <Bar dataKey="value" fill="#6366f1" radius={[6, 6, 0, 0]} maxBarSize={40}>
                           {aggregatedSales.map((_, index) => (
                             <Cell key={`cell-${index}`} fill={index === aggregatedSales.length - 1 ? '#4f46e5' : '#818cf8'} />
                           ))}
                         </Bar>
                       </BarChart>
                     </ResponsiveContainer>
                   </div>
                </div>

                {/* Sales Table */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mt-6">
                  <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                     <h3 className="font-bold text-sm text-slate-800">جدول مبالغ فروش {timeFilter === 'daily' ? 'روزانه' : 'ماهانه'}</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-right">
                      <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 text-[11px]">
                        <tr>
                          <th className="px-6 py-3 whitespace-nowrap">تاریخ ({timeFilter === 'daily' ? 'روز' : 'ماه'})</th>
                          <th className="px-6 py-3 whitespace-nowrap text-left">مبلغ کل فروش</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono">
                        {aggregatedSales.map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-3 whitespace-nowrap text-xs text-slate-700">{row.name}</td>
                            <td className="px-6 py-3 whitespace-nowrap text-xs font-bold text-indigo-600 text-left" dir="ltr">{row.value.toLocaleString()}</td>
                          </tr>
                        ))}
                        <tr className="bg-slate-50 font-bold">
                          <td className="px-6 py-4 text-xs text-slate-800">جمع کل</td>
                          <td className="px-6 py-4 text-xs text-indigo-700 text-left" dir="ltr">{totalSalesAmount.toLocaleString()}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
                </>
              )}

              {/* Debtors & Creditors */}
              {activeReport === 'DEBTORS_CREDITORS' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                     <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-6 flex flex-col items-center justify-center text-center">
                       <span className="text-emerald-600/80 text-xs font-bold mb-2">جمع کل بدهکاران</span>
                       <span className="text-3xl font-black text-emerald-700" dir="ltr">{dcTotals.debtors.toLocaleString()}</span>
                     </div>
                     <div className="bg-rose-50 border border-rose-100 rounded-2xl p-6 flex flex-col items-center justify-center text-center">
                       <span className="text-rose-600/80 text-xs font-bold mb-2">جمع کل بستانکاران</span>
                       <span className="text-3xl font-black text-rose-700" dir="ltr">{dcTotals.creditors.toLocaleString()}</span>
                     </div>
                  </div>
                  
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-right">
                        <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 text-[11px]">
                          <tr>
                            <th className="px-6 py-3 whitespace-nowrap">نام حساب / شخص</th>
                            <th className="px-6 py-3 whitespace-nowrap text-left">مجموع بدهکار</th>
                            <th className="px-6 py-3 whitespace-nowrap text-left">مجموع بستانکار</th>
                            <th className="px-6 py-3 whitespace-nowrap text-left">مانده نهایی</th>
                            <th className="px-6 py-3 whitespace-nowrap text-center">وضعیت</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono">
                          {data.map((row, idx) => {
                            const debit = parseFloat(row.TotalDebit) || 0;
                            const credit = parseFloat(row.TotalCredit) || 0;
                            const balance = debit - credit;
                            return (
                              <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-3 whitespace-nowrap text-xs text-slate-700 font-sans font-bold">{row.AccountName || '-'}</td>
                                <td className="px-6 py-3 whitespace-nowrap text-xs text-slate-500 text-left" dir="ltr">{debit > 0 ? debit.toLocaleString() : '-'}</td>
                                <td className="px-6 py-3 whitespace-nowrap text-xs text-slate-500 text-left" dir="ltr">{credit > 0 ? credit.toLocaleString() : '-'}</td>
                                <td className={`px-6 py-3 whitespace-nowrap text-sm font-bold text-left ${balance > 0 ? 'text-emerald-600' : balance < 0 ? 'text-rose-600' : 'text-slate-400'}`} dir="ltr">
                                  {Math.abs(balance).toLocaleString()}
                                </td>
                                <td className="px-6 py-3 whitespace-nowrap text-xs text-center">
                                  {balance > 0 ? <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded font-bold text-[10px]">بدهکار</span> : 
                                   balance < 0 ? <span className="bg-rose-100 text-rose-700 px-2 py-1 rounded font-bold text-[10px]">بستانکار</span> : 
                                   <span className="text-slate-400 font-bold text-[10px]">تسویه</span>}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Customer Statement */}
              {activeReport === 'CUSTOMER_STATEMENT' && !activeCustomer && (
                <div className="space-y-6">
                  <div className="relative max-w-md">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type="text" 
                      placeholder="جستجوی نام مشتری..." 
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full pl-4 pr-10 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 transition-all text-sm"
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredCustomers.map((row, idx) => {
                      const debit = parseFloat(row.TotalDebit) || 0;
                      const credit = parseFloat(row.TotalCredit) || 0;
                      const balance = debit - credit;
                      const type = balance >= 0 ? 'debit' : 'credit';
                      return (
                        <button 
                          key={idx}
                          onClick={() => setActiveCustomer({ name: row.AccountName, balance: Math.abs(balance), type })}
                          className="bg-white border border-slate-200 p-4 rounded-xl hover:border-rose-300 hover:shadow-md transition-all text-right flex flex-col group"
                        >
                          <div className="flex items-start justify-between w-full mb-3">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-rose-100 group-hover:text-rose-600 transition-colors">
                                <User size={14} />
                              </div>
                              <span className="font-bold text-sm text-slate-700">{row.AccountName || 'بدون نام'}</span>
                            </div>
                            <ArrowRight size={16} className="text-slate-300 group-hover:text-rose-500 transform group-hover:-translate-x-1 transition-all" />
                          </div>
                          
                          <div className="mt-auto pt-3 border-t border-slate-100 w-full flex justify-between items-center">
                            <span className="text-[10px] text-slate-400 font-bold">مانده حساب:</span>
                            <div className="flex items-center gap-1.5" dir="ltr">
                              <span className={`font-mono font-black text-sm ${balance > 0 ? 'text-emerald-600' : balance < 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                                {Math.abs(balance).toLocaleString()}
                              </span>
                              <span className="text-[10px] font-bold text-slate-500">{balance >= 0 ? 'بدهکار' : 'بستانکار'}</span>
                            </div>
                          </div>
                        </button>
                      )
                    })}
                    {filteredCustomers.length === 0 && (
                      <div className="col-span-full py-12 text-center text-slate-400 text-sm">
                        مشتری با این نام یافت نشد.
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Active Customer Detailed Statement */}
              {activeReport === 'CUSTOMER_STATEMENT' && activeCustomer && (
                <div className="space-y-6">
                  <div className="flex gap-4 mb-4">
                    <button onClick={() => setActiveCustomer(null)} className="text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1">
                      <ArrowRight size={14} /> بازگشت به لیست مشتریان
                    </button>
                  </div>
                  
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-right">
                        <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 text-[11px]">
                          <tr>
                            <th className="px-6 py-3 whitespace-nowrap w-32">تاریخ</th>
                            <th className="px-6 py-3 whitespace-nowrap">شرح آرتیکل</th>
                            <th className="px-6 py-3 whitespace-nowrap text-left w-32">بدهکار</th>
                            <th className="px-6 py-3 whitespace-nowrap text-left w-32">بستانکار</th>
                            <th className="px-6 py-3 whitespace-nowrap text-left w-32">مانده لحظه‌ای</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono">
                          {(()=>{
                            let runningBalance = 0;
                            return data.map((row, idx) => {
                              const debit = parseFloat(row.Debit) || 0;
                              const credit = parseFloat(row.Credit) || 0;
                              runningBalance += (debit - credit);
                              return (
                                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                  <td className="px-6 py-3 whitespace-nowrap text-xs text-slate-600">{row.Date || '-'}</td>
                                  <td className="px-6 py-3 text-xs text-slate-700 font-sans leading-relaxed">{row.Description || row.AccountName || '-'}</td>
                                  <td className="px-6 py-3 whitespace-nowrap text-xs text-emerald-600 text-left font-bold" dir="ltr">{debit > 0 ? debit.toLocaleString() : '-'}</td>
                                  <td className="px-6 py-3 whitespace-nowrap text-xs text-rose-600 text-left font-bold" dir="ltr">{credit > 0 ? credit.toLocaleString() : '-'}</td>
                                  <td className={`px-6 py-3 whitespace-nowrap text-xs text-left font-bold ${runningBalance > 0 ? 'text-emerald-700' : runningBalance < 0 ? 'text-rose-700' : 'text-slate-400'}`} dir="ltr">
                                    {Math.abs(runningBalance).toLocaleString()} <span className="text-[9px] font-sans font-normal">{runningBalance > 0 ? 'بد' : runningBalance < 0 ? 'بس' : ''}</span>
                                  </td>
                                </tr>
                              );
                            });
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

            </motion.div>
          )}

          {!loading && data.length === 0 && !error && (
            <div className="flex flex-col items-center justify-center py-32 bg-white rounded-2xl border border-dashed border-slate-300 text-slate-400">
              <TableIcon size={64} className="mb-4 stroke-1 text-slate-300" />
              <p className="text-base font-bold text-slate-600">داده‌ای یافت نشد</p>
              <p className="text-xs mt-2 text-slate-400">برای این گزارش در بازه انتخابی اطلاعاتی وجود ندارد.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SayanReports;
