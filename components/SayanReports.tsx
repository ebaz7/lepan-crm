import React, { useState, useEffect } from 'react';
import { Database, Search, RefreshCw, BarChart2, Table as TableIcon, Download, DollarSign, Users, Calendar, Activity, Loader2 } from 'lucide-react';
import { apiCall } from '../services/apiService';
import { motion } from 'motion/react';
import * as XLSX from 'xlsx';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

type ReportType = 'SALES' | 'CUSTOMER_STATEMENT' | 'DEBTORS_CREDITORS';

const SayanReports: React.FC = () => {
  const [activeReport, setActiveReport] = useState<ReportType>('SALES');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeFilter, setTimeFilter] = useState<'daily' | 'monthly' | 'yearly'>('monthly');

  const fetchReportData = async (reportType: ReportType) => {
    setLoading(true);
    setError(null);
    let sqlQuery = '';

    if (reportType === 'SALES') {
      sqlQuery = "SELECT TOP 1000 Field_008 as [Date], Field_025 as [TotalSales] FROM BUR_TBL_008 WHERE Field_004=2 AND Field_025 > 0";
    } else if (reportType === 'CUSTOMER_STATEMENT') {
      sqlQuery = "SELECT TOP 1000 Field_008 as [Date], Field_006 as [Description], Field_010 as [Debit], Field_011 as [Credit] FROM ACT_TBL_003 WHERE Field_006 IS NOT NULL ORDER BY Field_008 DESC";
    } else if (reportType === 'DEBTORS_CREDITORS') {
      sqlQuery = "SELECT TOP 500 Field_006 as [AccountName], Field_010 as [Debit], Field_011 as [Credit] FROM ACT_TBL_003 WHERE (Field_010 > 0 OR Field_011 > 0) ORDER BY Field_001 DESC";
    }

    try {
      const result: any = await apiCall('/sayan-proxy', 'POST', { path: 'query', method: 'POST', body: { query: sqlQuery } });
      const finalData = Array.isArray(result) ? result : (result.data || result.rows || result.items || result.result || []);
      setData(finalData);
    } catch (err: any) {
      setError(err.message || 'خطا در ارتباط با سرور سایان');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData(activeReport);
  }, [activeReport]);

  const exportData = () => {
    if (!data.length) return;
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, `Sayan_Report_${activeReport}.xlsx`);
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
            onClick={() => setActiveReport('SALES')}
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
            onClick={() => setActiveReport('CUSTOMER_STATEMENT')}
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
            onClick={() => setActiveReport('DEBTORS_CREDITORS')}
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
        <div className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-8 shadow-sm">
          <div className="flex items-center gap-3">
            <h1 className="font-black text-lg text-slate-800">
              {activeReport === 'SALES' && 'داشبورد فروش'}
              {activeReport === 'CUSTOMER_STATEMENT' && 'صورتحساب مشتریان'}
              {activeReport === 'DEBTORS_CREDITORS' && 'بدهکاران و بستانکاران'}
            </h1>
            {loading && <Loader2 size={16} className="animate-spin text-indigo-500" />}
          </div>
          <div className="flex items-center gap-3">
             <button onClick={() => fetchReportData(activeReport)} className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors">
              <RefreshCw size={14} /> بروزرسانی
            </button>
            <button onClick={exportData} className="flex items-center gap-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold rounded-lg transition-colors">
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
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                   <div className="lg:col-span-1 space-y-6">
                      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                         <div className="text-slate-500 text-xs font-bold mb-2">جمع کل فروش</div>
                         <div className="text-3xl font-black text-indigo-600" dir="ltr">
                            {data.reduce((sum, row) => sum + (parseFloat(row.TotalSales) || 0), 0).toLocaleString()}
                         </div>
                         <div className="text-[10px] text-slate-400 mt-2 flex items-center gap-1"><Calendar size={12}/> کل فاکتورهای فروش ثبت شده</div>
                      </div>
                      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                         <div className="text-slate-500 text-xs font-bold mb-2">تعداد فاکتورها</div>
                         <div className="text-3xl font-black text-slate-700" dir="ltr">
                            {data.length.toLocaleString()}
                         </div>
                      </div>
                      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                         <div className="text-slate-800 text-sm font-bold mb-4">فیلتر زمانی نمودار</div>
                         <div className="flex bg-slate-100 p-1 rounded-lg">
                           <button onClick={() => setTimeFilter('daily')} className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${timeFilter === 'daily' ? 'bg-white shadow text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}>روزانه</button>
                           <button onClick={() => setTimeFilter('monthly')} className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${timeFilter === 'monthly' ? 'bg-white shadow text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}>ماهانه</button>
                         </div>
                      </div>
                   </div>
                   
                   <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 h-[400px]">
                     <h3 className="text-sm font-bold text-slate-800 mb-6">نمودار فروش {timeFilter === 'daily' ? 'روزانه' : 'ماهانه'}</h3>
                     <ResponsiveContainer width="100%" height="100%">
                       <BarChart 
                          data={Object.entries(data.reduce((aggs: any, row) => {
                              const d = String(row.Date || '');
                              const key = timeFilter === 'daily' ? d.substring(0, 10) : d.substring(0, 7);
                              if (key) aggs[key] = (aggs[key] || 0) + (parseFloat(row.TotalSales) || 0);
                              return aggs;
                          }, {})).map(([name, value]) => ({ name, value })).sort((a,b) => a.name.localeCompare(b.name)).slice(-15)} 
                          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                       >
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
                           {data.map((_, index) => (
                             <Cell key={`cell-${index}`} fill={index === data.length - 1 ? '#4f46e5' : '#818cf8'} />
                           ))}
                         </Bar>
                       </BarChart>
                     </ResponsiveContainer>
                   </div>
                </div>
              )}

              {/* Data Table */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-right">
                    <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 text-[11px]">
                      <tr>
                        {Object.keys(data[0]).map(key => (
                          <th key={key} className="px-6 py-4 whitespace-nowrap">{key}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {data.slice(0, 100).map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                          {Object.keys(data[0]).map((key, vIdx) => {
                            const val = row[key];
                            const isAmount = key.includes('Debit') || key.includes('Credit') || key.includes('Sales');
                            return (
                              <td key={vIdx} className={`px-6 py-3 whitespace-nowrap text-xs ${isAmount ? 'font-bold' : 'text-slate-600'}`} dir={isAmount ? 'ltr' : 'rtl'}>
                                {typeof val === 'number' || (!isNaN(parseFloat(val)) && isAmount) ? parseFloat(val).toLocaleString() : String(val ?? '')}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {data.length > 100 && (
                   <div className="p-4 bg-slate-50 text-center text-xs text-slate-500 border-t border-slate-100">
                      نمایش ۱۰۰ ردیف اول از مجموع {data.length} ردیف. برای مشاهده کامل لطفاً خروجی اکسل بگیرید.
                   </div>
                )}
              </div>
            </motion.div>
          )}

          {!loading && data.length === 0 && !error && (
            <div className="flex flex-col items-center justify-center py-32 bg-white rounded-2xl border border-dashed border-slate-300 text-slate-400">
              <TableIcon size={64} className="mb-4 stroke-1 text-slate-300" />
              <p className="text-base font-bold text-slate-600">داده‌ای یافت نشد</p>
              <p className="text-xs mt-2 text-slate-400">برای این گزارش در دیتابیس سایان اطلاعاتی ثبت نشده است.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SayanReports;
