import React, { useState, useEffect } from 'react';
import { Database, Search, RefreshCw, BarChart2, Table as TableIcon, Download, DollarSign, Users, Calendar, Activity, Loader2, ArrowRight } from 'lucide-react';
import { apiCall } from '../services/apiService';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { jalaliToGregorian, getCurrentShamsiDate, formatDate } from '../constants';

type ReportType = 'SALES' | 'CUSTOMER_STATEMENT' | 'DEBTORS_CREDITORS';

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

const attemptQuery = async (query: string) => {
    const pathList = [
        { path: 'sql', method: 'POST', body: { query } },
        { path: 'sql', method: 'POST', body: { sql: query } },
        { path: 'query', method: 'POST', body: { query } }
    ];
    let lastErr: any;
    for (const attempt of pathList) {
        try {
            const res: any = await apiCall('/sayan-proxy', 'POST', attempt);
            if (res && (Array.isArray(res) || res.data || res.rows || res.items || res.result)) {
                return Array.isArray(res) ? res : (res.data || res.rows || res.items || res.result || []);
            }
        } catch(e) {
            lastErr = e;
        }
    }
    throw lastErr || new Error("داده‌ای یافت نشد یا خطا در اجرای کوئری");
};

const SayanReports: React.FC = () => {
  const [activeReport, setActiveReport] = useState<ReportType>('SALES');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Date filters (defaults to current month start to today)
  const currentShamsi = getCurrentShamsiDate();
  const [startDate, setStartDate] = useState({ ...currentShamsi, day: 1 });
  const [endDate, setEndDate] = useState(currentShamsi);

  // Customer Statement states
  const [customers, setCustomers] = useState<any[]>([]);
  const [searchCustomer, setSearchCustomer] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [customerDetails, setCustomerDetails] = useState<any[]>([]);

  const fetchReportData = async (reportType: ReportType) => {
    setLoading(true);
    setError(null);
    let sqlQuery = '';

    const startIso = toIsoDateString(jalaliToGregorian(startDate.year, startDate.month, startDate.day));
    const endIso = toIsoDateString(jalaliToGregorian(endDate.year, endDate.month, endDate.day));
    
    const startShamsiStr1 = `${startDate.year}/${String(startDate.month).padStart(2, '0')}/${String(startDate.day).padStart(2, '0')}`;
    const startShamsiStr2 = startShamsiStr1.replace(/\//g, '-');
    const endShamsiStr1 = `${endDate.year}/${String(endDate.month).padStart(2, '0')}/${String(endDate.day).padStart(2, '0')}`;
    const endShamsiStr2 = endShamsiStr1.replace(/\//g, '-');

    // Local filter function
    const isDateInRange = (dateVal: any) => {
        if (!dateVal) return false;
        const dStr = String(dateVal).substring(0, 10);
        return (dStr >= startIso && dStr <= endIso) || 
               (dStr >= startShamsiStr1 && dStr <= endShamsiStr1) ||
               (dStr >= startShamsiStr2 && dStr <= endShamsiStr2);
    };

    try {
      if (reportType === 'SALES') {
        // query BUR_TBL_008 and fallback fields if TotalSales is not Field_025
        sqlQuery = `SELECT TOP 5000 Field_008 as [Date], Field_025 as [F25], Field_010 as [F10], Field_011 as [F11] FROM BUR_TBL_008 ORDER BY Field_008 DESC`;
        
        const finalData = await attemptQuery(sqlQuery);
        
        const processed = finalData.map((row: any) => {
            const amount = parseFloat(row.F25 || row.F10 || row.F11 || row.Field_025 || row.TotalSales || 0);
            return {
                ...row,
                TotalSales: amount,
                Date: row.Date || row.Field_008
            };
        }).filter((r: any) => r.TotalSales > 0 && isDateInRange(r.Date));
        
        setData(processed.reverse());
      } 
      else if (reportType === 'CUSTOMER_STATEMENT') {
        if (!selectedCustomer) {
            // Fetch raw rows and aggregate locally
            sqlQuery = `SELECT TOP 5000 * FROM ACT_TBL_003 ORDER BY Field_008 DESC`;
            const finalData = await attemptQuery(sqlQuery);
            
            const grouped: Record<string, any> = {};
            finalData.forEach((row: any) => {
                // only consider rows before end date for balance
                if (row.Field_008 && !isDateInRange(row.Field_008) && row.Field_008 > endShamsiStr1 && row.Field_008 > endIso) return;
                
                const name = row.Field_006 || row.Field_005 || row.AccountName;
                if (!name) return;
                if (!grouped[name]) grouped[name] = { AccountName: name, Debit: 0, Credit: 0 };
                // Guess Debit/Credit from the last numerical fields if not explicitly named
                const v1 = parseFloat(row.Field_009 || row.Field_010 || row.Debit || 0);
                const v2 = parseFloat(row.Field_010 || row.Field_011 || row.Credit || 0);
                grouped[name].Debit += v1;
                grouped[name].Credit += v2;
            });
            setCustomers(Object.values(grouped));
            setData([]);
        } else {
            sqlQuery = `SELECT TOP 2000 * FROM ACT_TBL_003 WHERE (Field_006 = N'${selectedCustomer}' OR Field_005 = N'${selectedCustomer}') ORDER BY Field_008 DESC`;
            const finalData = await attemptQuery(sqlQuery);
            const mapped = finalData.map((row: any) => ({
                Date: row.Field_008,
                Description: row.Field_007 || row.Field_006,
                Debit: row.Field_009 || row.Field_010 || row.Debit || 0,
                Credit: row.Field_010 || row.Field_011 || row.Credit || 0,
            })).filter((r: any) => isDateInRange(r.Date));
            setCustomerDetails(mapped.reverse());
        }
      } 
      else if (reportType === 'DEBTORS_CREDITORS') {
        sqlQuery = `SELECT TOP 5000 * FROM ACT_TBL_003 ORDER BY Field_008 DESC`;
        const finalData = await attemptQuery(sqlQuery);
        
        const grouped: Record<string, any> = {};
        finalData.forEach((row: any) => {
            if (row.Field_008 && !isDateInRange(row.Field_008) && row.Field_008 > endShamsiStr1 && row.Field_008 > endIso) return;

            const name = row.Field_006 || row.Field_005 || row.AccountName;
            if (!name) return;
            if (!grouped[name]) grouped[name] = { AccountName: name, Debit: 0, Credit: 0 };
            const v1 = parseFloat(row.Field_009 || row.Field_010 || row.Debit || 0);
            const v2 = parseFloat(row.Field_010 || row.Field_011 || row.Credit || 0);
            grouped[name].Debit += v1;
            grouped[name].Credit += v2;
        });
        
        const processed = Object.values(grouped).map((row: any) => {
            const net = row.Debit - row.Credit;
            return {
                ...row,
                NetBalance: Math.abs(net),
                Type: net > 0 ? 'بدهکار' : (net < 0 ? 'بستانکار' : 'تسویه')
            };
        }).filter(r => r.NetBalance > 0).sort((a, b) => b.NetBalance - a.NetBalance);
        
        setData(processed);
      }
    } catch (err: any) {
      setError(err.message || 'خطا در ارتباط با سرور سایان');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData(activeReport);
  }, [activeReport, startDate, endDate, selectedCustomer]);

  const exportData = () => {
    const exportTarget = activeReport === 'CUSTOMER_STATEMENT' ? (selectedCustomer ? customerDetails : customers) : data;
    if (!exportTarget || !exportTarget.length) return;
    const ws = XLSX.utils.json_to_sheet(exportTarget);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, `Sayan_Report_${activeReport}.xlsx`);
  };

  const renderSalesDashboard = () => {
      const dailyChartData = Object.entries(data.reduce((aggs: any, row) => {
          const d = String(row.Date || '');
          const key = d.substring(0, 10);
          if (key) aggs[key] = (aggs[key] || 0) + (parseFloat(row.TotalSales) || 0);
          return aggs;
      }, {})).map(([name, value]) => ({ name, value, shamsiName: formatDate(name) })).sort((a,b) => a.name.localeCompare(b.name));

      const totalSales = dailyChartData.reduce((sum, row) => sum + Number(row.value), 0);
      const endDaySalesStr = toIsoDateString(jalaliToGregorian(endDate.year, endDate.month, endDate.day));
      const dailySpecificSales = dailyChartData.find(d => d.name === endDaySalesStr)?.value || 0;

      return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <div className="text-slate-500 text-xs font-bold mb-2">فروش در روز پایان بازه ({endDate.year}/{endDate.month}/{endDate.day})</div>
                    <div className="text-3xl font-black text-indigo-600" dir="ltr">
                        {dailySpecificSales.toLocaleString()}
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <div className="text-slate-500 text-xs font-bold mb-2">جمع کل فروش در کل بازه انتخابی</div>
                    <div className="text-3xl font-black text-emerald-600" dir="ltr">
                        {totalSales.toLocaleString()}
                    </div>
                </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 h-[400px]">
                <h3 className="text-sm font-bold text-slate-800 mb-6">نمودار فروش (تفكيك روزها)</h3>
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dailyChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="shamsiName" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(val) => (val/1000000).toFixed(0) + 'm'} />
                        <Tooltip 
                        cursor={{ fill: '#f8fafc' }}
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px', textAlign: 'right', direction: 'rtl' }}
                        formatter={(value: number) => [value.toLocaleString(), 'مبلغ']}
                        labelStyle={{ fontWeight: 'bold', color: '#0f172a', marginBottom: '4px' }}
                        />
                        <Bar dataKey="value" fill="#6366f1" radius={[6, 6, 0, 0]} maxBarSize={40}>
                        {dailyChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.name === endDaySalesStr ? '#4f46e5' : '#818cf8'} />
                        ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 font-bold text-sm text-slate-700">
                    جدول فروش (روزانه در بازه)
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-right">
                    <thead className="bg-white text-slate-500 font-bold border-b border-slate-200 text-[11px]">
                        <tr>
                            <th className="px-6 py-4 whitespace-nowrap">تاریخ</th>
                            <th className="px-6 py-4 whitespace-nowrap">مبلغ فروش (ریال)</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                        {dailyChartData.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-3 whitespace-nowrap text-xs text-slate-600" dir="ltr">{row.shamsiName}</td>
                            <td className="px-6 py-3 whitespace-nowrap text-xs font-bold text-slate-800" dir="ltr">
                                {Number(row.value).toLocaleString()}
                            </td>
                        </tr>
                        ))}
                        <tr className="bg-slate-50 font-bold">
                            <td className="px-6 py-4 text-xs text-slate-700">جمع کل بازه:</td>
                            <td className="px-6 py-4 text-xs text-indigo-700" dir="ltr">{totalSales.toLocaleString()}</td>
                        </tr>
                    </tbody>
                    </table>
                </div>
            </div>
        </div>
      );
  };

  const renderCustomerStatement = () => {
      if (selectedCustomer) {
          let runningBalance = 0;
          return (
              <div className="space-y-4">
                  <div className="flex items-center gap-4 mb-6">
                      <button onClick={() => setSelectedCustomer(null)} className="p-2 bg-white rounded-lg shadow-sm border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors">
                          <ArrowRight size={16} />
                      </button>
                      <h2 className="text-xl font-black text-slate-800">
                          ریز تراکنش‌های مشتری: <span className="text-indigo-600">{selectedCustomer}</span>
                      </h2>
                  </div>
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-right">
                        <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 text-[11px]">
                            <tr>
                                <th className="px-6 py-4 whitespace-nowrap">تاریخ</th>
                                <th className="px-6 py-4 whitespace-nowrap">شرح</th>
                                <th className="px-6 py-4 whitespace-nowrap">بدهکار</th>
                                <th className="px-6 py-4 whitespace-nowrap">بستانکار</th>
                                <th className="px-6 py-4 whitespace-nowrap">مانده</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono text-xs">
                            {customerDetails.map((row, idx) => {
                                const deb = parseFloat(row.Debit) || 0;
                                const cred = parseFloat(row.Credit) || 0;
                                runningBalance += (deb - cred);
                                return (
                                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-3 whitespace-nowrap text-slate-600" dir="ltr">{formatDate((row.Date || '').substring(0, 10))}</td>
                                        <td className="px-6 py-3 whitespace-nowrap font-sans text-slate-800">{row.Description || '-'}</td>
                                        <td className="px-6 py-3 whitespace-nowrap text-emerald-600" dir="ltr">{deb > 0 ? deb.toLocaleString() : '-'}</td>
                                        <td className="px-6 py-3 whitespace-nowrap text-rose-600" dir="ltr">{cred > 0 ? cred.toLocaleString() : '-'}</td>
                                        <td className="px-6 py-3 whitespace-nowrap font-bold text-indigo-700" dir="ltr">{runningBalance.toLocaleString()} {runningBalance > 0 ? '(بد)' : runningBalance < 0 ? '(بس)' : ''}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        </table>
                    </div>
                </div>
              </div>
          );
      }

      const filteredCustomers = customers.filter(c => !searchCustomer || c.AccountName.includes(searchCustomer));

      return (
          <div className="space-y-4">
              <div className="relative">
                  <Search className="w-5 h-5 absolute right-4 top-3.5 text-slate-400" />
                  <input
                      type="text"
                      placeholder="جستجوی نام مشتری..."
                      value={searchCustomer}
                      onChange={e => setSearchCustomer(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl py-3 pr-12 pl-4 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm font-medium"
                  />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredCustomers.map((cust, idx) => {
                      const deb = parseFloat(cust.Debit) || 0;
                      const cred = parseFloat(cust.Credit) || 0;
                      const bal = deb - cred;
                      const type = bal > 0 ? 'بدهکار' : (bal < 0 ? 'بستانکار' : 'تسویه');
                      return (
                          <div key={idx} onClick={() => setSelectedCustomer(cust.AccountName)} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-200 cursor-pointer transition-all">
                              <h3 className="font-bold text-slate-800 text-sm mb-3">{cust.AccountName}</h3>
                              <div className="flex justify-between items-center text-xs">
                                  <span className="text-slate-500">مانده حساب:</span>
                                  <span className={`font-black font-mono ${bal > 0 ? 'text-emerald-600' : (bal < 0 ? 'text-rose-600' : 'text-slate-400')}`} dir="ltr">
                                      {Math.abs(bal).toLocaleString()}
                                  </span>
                              </div>
                              <div className="mt-2 text-[10px] bg-slate-50 inline-block px-2 py-1 rounded text-slate-500 font-bold">
                                  وضعیت: {type}
                              </div>
                          </div>
                      );
                  })}
              </div>
          </div>
      );
  };

  const renderDebtorsCreditors = () => {
      const totalDebtors = data.filter(d => d.Type === 'بدهکار').reduce((sum, d) => sum + d.NetBalance, 0);
      const totalCreditors = data.filter(d => d.Type === 'بستانکار').reduce((sum, d) => sum + d.NetBalance, 0);

      return (
          <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
                      <div>
                          <div className="text-slate-500 text-xs font-bold mb-2">جمع کل بدهکاران (طلب شرکت)</div>
                          <div className="text-2xl font-black text-emerald-600" dir="ltr">{totalDebtors.toLocaleString()}</div>
                      </div>
                      <div className="p-4 bg-emerald-50 rounded-full text-emerald-500"><Activity size={24} /></div>
                  </div>
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
                      <div>
                          <div className="text-slate-500 text-xs font-bold mb-2">جمع کل بستانکاران (بدهی شرکت)</div>
                          <div className="text-2xl font-black text-rose-600" dir="ltr">{totalCreditors.toLocaleString()}</div>
                      </div>
                      <div className="p-4 bg-rose-50 rounded-full text-rose-500"><Activity size={24} /></div>
                  </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-right">
                    <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 text-[11px]">
                        <tr>
                            <th className="px-6 py-4 whitespace-nowrap">نام مشتری / حساب</th>
                            <th className="px-6 py-4 whitespace-nowrap">مبلغ مانده (ریال)</th>
                            <th className="px-6 py-4 whitespace-nowrap">وضعیت</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-xs">
                        {data.map((row, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-3 whitespace-nowrap font-sans text-slate-800 font-medium">{row.AccountName}</td>
                                <td className={`px-6 py-3 whitespace-nowrap font-bold ${row.Type === 'بدهکار' ? 'text-emerald-600' : 'text-rose-600'}`} dir="ltr">
                                    {row.NetBalance.toLocaleString()}
                                </td>
                                <td className="px-6 py-3 whitespace-nowrap">
                                    <span className={`inline-block px-2 py-1 rounded-md text-[10px] font-bold ${row.Type === 'بدهکار' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                                        {row.Type}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    </table>
                </div>
            </div>
          </div>
      );
  };

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
            onClick={() => { setActiveReport('SALES'); setSelectedCustomer(null); }}
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
            onClick={() => { setActiveReport('CUSTOMER_STATEMENT'); setSelectedCustomer(null); }}
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
            onClick={() => { setActiveReport('DEBTORS_CREDITORS'); setSelectedCustomer(null); }}
            className={`w-full text-right p-4 rounded-xl transition-all flex items-center gap-3 ${
              activeReport === 'DEBTORS_CREDITORS' ? 'bg-emerald-500 text-white shadow-md shadow-emerald-200' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-emerald-200'
            }`}
          >
            <Activity size={18} className={activeReport === 'DEBTORS_CREDITORS' ? 'text-emerald-100' : 'text-emerald-500'} />
            <div>
              <div className="font-bold text-sm">جمع بدهکاران و بستانکاران</div>
              <div className={`text-[10px] mt-1 ${activeReport === 'DEBTORS_CREDITORS' ? 'text-emerald-200' : 'text-slate-400'}`}>مانده حساب‌های اشخاص</div>
            </div>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#f8fafc]">
        {/* Header */}
        <div className="h-20 border-b border-slate-200 bg-white flex items-center justify-between px-8 shadow-sm">
          <div className="flex items-center gap-6">
            <h1 className="font-black text-lg text-slate-800 min-w-max">
              {activeReport === 'SALES' && 'داشبورد فروش'}
              {activeReport === 'CUSTOMER_STATEMENT' && 'صورتحساب مشتریان'}
              {activeReport === 'DEBTORS_CREDITORS' && 'بدهکاران و بستانکاران'}
            </h1>
            
            <div className="h-10 w-px bg-slate-200"></div>

            {/* Date Filter */}
            <div className="flex items-center gap-4">
                <ShamsiDatePicker date={startDate} onChange={setStartDate} label="از تاریخ (شمسی)" />
                <ShamsiDatePicker date={endDate} onChange={setEndDate} label="تا تاریخ (شمسی)" />
            </div>

            {loading && <Loader2 size={18} className="animate-spin text-indigo-500 ml-4" />}
          </div>
          <div className="flex items-center gap-3">
             <button onClick={() => fetchReportData(activeReport)} className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors">
              <RefreshCw size={14} /> اعمال و بروزرسانی
            </button>
            <button onClick={exportData} className="flex items-center gap-2 px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold rounded-xl transition-colors">
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

          {!loading && !error && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                {activeReport === 'SALES' && renderSalesDashboard()}
                {activeReport === 'CUSTOMER_STATEMENT' && renderCustomerStatement()}
                {activeReport === 'DEBTORS_CREDITORS' && renderDebtorsCreditors()}
            </motion.div>
          )}

          {!loading && data.length === 0 && customers.length === 0 && !error && (
            <div className="flex flex-col items-center justify-center py-32 bg-white rounded-2xl border border-dashed border-slate-300 text-slate-400">
              <TableIcon size={64} className="mb-4 stroke-1 text-slate-300" />
              <p className="text-base font-bold text-slate-600">داده‌ای یافت نشد</p>
              <p className="text-xs mt-2 text-slate-400">برای این گزارش در بازه زمانی انتخاب شده اطلاعاتی وجود ندارد.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SayanReports;
