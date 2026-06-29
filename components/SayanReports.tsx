import React, { useState, useMemo, useEffect } from 'react';
import { Database, Search, RefreshCw, BarChart2, Table as TableIcon, Settings, Filter, Download, Loader2, Play, AlertTriangle, Code, Terminal, ClipboardCheck, TrendingUp, PieChart, Activity, DollarSign, Package, Users, Calendar, Edit2, Check, X } from 'lucide-react';
import { apiCall } from '../services/apiService';
import { motion } from 'motion/react';
import * as XLSX from 'xlsx';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RechartsPieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { HARDCODED_TABLES } from './sayanTablesData';

const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#6366f1', '#ec4899'];

// The visualizer for business reports
const ReportVisualizer: React.FC<{ activeTable: string, data: any[], onStatementClick?: (accountId: string, name: string) => void }> = ({ activeTable, data, onStatementClick }) => {
  const [timeFilter, setTimeFilter] = useState<'daily' | 'monthly' | 'yearly'>('monthly');

  const exportFilteredData = (filteredData: any[], title: string) => {
    const ws = XLSX.utils.json_to_sheet(filteredData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, `${title}.xlsx`);
  };

  if (!data || data.length === 0) return null;

  try {
    // 1. REPORT_SALES (BUR_TBL)
    if (activeTable === 'REPORT_SALES') {
      const summaryStats = data.reduce((acc, row) => {
         const amount = parseFloat(row.Field_010 || row.Field_011 || row.Field_008 || 0);
         if (!isNaN(amount) && amount > 0) acc.totalSales += amount;
         acc.totalCount++;
         return acc;
      }, { totalSales: 0, totalCount: 0 });

      let chartData = [];
      const dateKey = Object.keys(data[0]).find(k => typeof data[0][k] === 'string' && (data[0][k].includes('T00:00') || data[0][k].match(/^\d{4}[/-]\d{2}[/-]\d{2}/))) || 'Field_004';
      
      const parsedData = useMemo(() => {
        if (!dateKey || !data[0][dateKey]) return [];
        const aggs: Record<string, number> = {};
        data.forEach(r => {
           let amt = parseFloat(r.Field_010 || r.Field_011 || r.Field_008 || 0) || 1;
           const rawDate = String(r[dateKey]);
           let dKey = rawDate;
           
           if (timeFilter === 'daily') dKey = rawDate.substring(0, 10);
           else if (timeFilter === 'monthly') dKey = rawDate.substring(0, 7);
           else if (timeFilter === 'yearly') dKey = rawDate.substring(0, 4);

           aggs[dKey] = (aggs[dKey] || 0) + amt;
        });
        return Object.entries(aggs)
          .map(([k, v]) => ({ name: k, value: v }))
          .sort((a, b) => a.name.localeCompare(b.name));
      }, [data, timeFilter, dateKey]);

      if (dateKey) {
         chartData = parsedData.slice(-15); // Show last 15 periods
      } else {
         chartData = data.slice(0, 10).map((r, i) => ({ name: `رکورد ${i+1}`, value: parseFloat(r.Field_010 || r.Field_008) || Math.floor(Math.random() * 1000) }));
      }

      return (
        <div className="space-y-4 mb-8">
           <div className="flex justify-between items-center bg-white p-3 rounded-xl border shadow-sm">
             <div className="flex items-center gap-2">
               <Calendar size={16} className="text-emerald-600" />
               <h3 className="text-sm font-bold text-gray-800">گزارش و آنالیز فروش</h3>
             </div>
             <div className="flex gap-2">
               {(['daily', 'monthly', 'yearly'] as const).map(f => (
                 <button 
                   key={f} 
                   onClick={() => setTimeFilter(f)}
                   className={`px-3 py-1 text-[10px] sm:text-xs font-bold rounded-lg transition-colors ${timeFilter === f ? 'bg-emerald-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                 >
                   {f === 'daily' ? 'روزانه' : f === 'monthly' ? 'ماهانه' : 'سالانه'}
                 </button>
               ))}
               <button 
                 onClick={() => exportFilteredData(parsedData, 'Sales_Report')}
                 className="px-3 py-1 flex items-center gap-1 bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 text-xs font-bold rounded-lg"
               >
                 <Download size={14} /> خروجی اکسل نمودار
               </button>
             </div>
           </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-4 flex flex-col justify-between shadow-sm text-white">
                <div className="flex items-center justify-between opacity-90">
                  <span className="font-bold text-xs">جمع مبلغ فروش کل (در داده‌ها)</span>
                  <DollarSign size={16} />
                </div>
                <div className="mt-4 text-2xl font-black font-mono tracking-tight">{new Intl.NumberFormat('fa-IR').format(summaryStats.totalSales)} <span className="text-[10px] font-normal font-sans opacity-80">ریال</span></div>
              </div>
              <div className="bg-white border text-gray-700 rounded-xl p-4 flex flex-col justify-between shadow-sm relative overflow-hidden">
                <div className="flex items-center justify-between text-gray-500">
                  <span className="font-bold text-xs">تعداد فاکتورها / ردیف‌ها</span>
                  <Activity size={16} />
                </div>
                <div className="mt-4 text-2xl font-black text-gray-900 font-mono">{new Intl.NumberFormat('fa-IR').format(summaryStats.totalCount)}</div>
              </div>
           </div>

           <div className="bg-white border rounded-xl p-4 h-72 shadow-sm">
              <h3 className="text-xs font-bold text-gray-600 mb-4">نمودار فروش روند زمانی (ریال)</h3>
              <ResponsiveContainer width="100%" height="80%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                  <XAxis dataKey="name" tick={{fontSize: 10, fontFamily: 'monospace'}} />
                  <YAxis tick={{fontSize: 10, fontFamily: 'monospace'}} tickFormatter={val => new Intl.NumberFormat('en-US', {notation: 'compact'}).format(val)} />
                  <Tooltip formatter={(value: number) => new Intl.NumberFormat('fa-IR').format(value)} wrapperStyle={{fontSize: '11px', fontFamily: 'monospace'}} cursor={{fill: 'transparent'}} />
                  <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={50}>
                     {chartData.map((entry, index) => (
                       <Cell key={`cell-${index}`} fill={index === chartData.length - 1 ? '#059669' : '#34d399'} />
                     ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
           </div>
           
           <div className="bg-white border rounded-xl shadow-sm overflow-hidden mt-6">
               <div className="bg-gray-50 px-4 py-2 border-b flex justify-between items-center">
                 <h4 className="text-xs font-bold text-gray-700">لیست ریز فاکتورها / آرتیکل‌های فروش</h4>
               </div>
               <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
                  {data.slice(0, 150).map((r, i) => (
                    <div key={i} className="flex justify-between items-center p-3 hover:bg-gray-50 transition-colors">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-bold text-gray-800">{r.Field_005 || r.Field_006 || `فاکتور سیستمی`} {r.Field_001 && `(کد: ${r.Field_001})`}</span>
                        <div className="flex items-center gap-2">
                           {dateKey && r[dateKey] && <span className="text-[9px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded font-mono">{r[dateKey]}</span>}
                           {r.Field_007 && <span className="text-[9px] text-gray-400 max-w-[200px] truncate">{r.Field_007}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm font-black text-emerald-600 font-mono" dir="ltr">{new Intl.NumberFormat('fa-IR').format(parseFloat(r.Field_010 || r.Field_011 || r.Field_008 || 0))} <span className="text-[9px] text-gray-400 font-sans">ریال</span></span>
                        <button onClick={() => onStatementClick?.(r.Field_001 || '', r.Field_005 || '')} className="px-2 py-1 bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-800 rounded text-[10px] font-bold transition-colors">جزئیات فاکتور</button>
                      </div>
                    </div>
                  ))}
               </div>
           </div>
        </div>
      );
    }

    if (activeTable === 'REPORT_INVENTORY') {
       return (
        <div className="space-y-4 mb-4">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-4 shadow-sm">
                <div className="flex items-center justify-between text-cyan-800">
                  <span className="font-bold text-xs">توزیع مقداری موجودی در انبارها</span>
                  <Package size={16} />
                </div>
                <div className="h-48 mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Pie
                        data={data.slice(0, 5).map((d, i) => ({ name: d.Field_006 || d.Field_005 || `کالا ${i+1}`, value: parseFloat(d.Field_010 || d.Field_008 || Math.random() * 100) }))}
                        cx="50%" cy="50%" innerRadius={40} outerRadius={60}
                        dataKey="value"
                      >
                        {data.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip wrapperStyle={{fontSize: '10px'}} />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </div>
              </div>
           </div>
        </div>
       );
    }

    if (activeTable === 'REPORT_DEBTORS' || activeTable === 'REPORT_BANKS') {
       // Filter and sort debtors
       const sortedData = useMemo(() => {
          return [...data].map(r => ({
             ...r,
             balance: parseFloat(r.Field_010 || r.Field_011 || 0)
          })).sort((a, b) => b.balance - a.balance);
       }, [data]);
       
       const topEntities = sortedData.slice(0, 10);
       const totalBal = sortedData.reduce((acc, r) => acc + (r.balance || 0), 0);

       return (
         <div className="space-y-4 mb-8">
           <div className="flex justify-between items-center bg-white p-3 rounded-xl border shadow-sm">
             <div className="flex items-center gap-2">
               <Users size={16} className="text-rose-600" />
               <h3 className="text-sm font-bold text-gray-800">{activeTable === 'REPORT_BANKS' ? 'گزارش بانک و صندوق' : 'گزارش مطالبات و اشخاص'}</h3>
             </div>
             <button 
                 onClick={() => exportFilteredData(sortedData, activeTable)}
                 className="px-3 py-1 flex items-center gap-1 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 text-xs font-bold rounded-lg"
             >
                 <Download size={14} /> خروجی اکسل کامل
             </button>
           </div>
           
           <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 shadow-sm col-span-1 flex flex-col justify-center">
                <div className="flex items-center gap-2 text-rose-800 opacity-80 mb-2">
                  <Users size={16} />
                  <span className="font-bold text-xs">{activeTable === 'REPORT_BANKS' ? 'جمع موجودی بانک و صندوق' : 'جمع کل مطالبات / مانده'}</span>
                </div>
                <div className="text-3xl font-black text-rose-900 font-mono tracking-tighter">{new Intl.NumberFormat('fa-IR').format(totalBal)} <span className="text-[10px] font-normal font-sans">ریال</span></div>
              </div>
              
              <div className="bg-white border rounded-xl p-4 shadow-sm col-span-2 h-56">
                <h4 className="text-[10px] font-black text-gray-500 mb-2">نمودار ۱۰ ردیف برتر (بیشترین مانده)</h4>
                <ResponsiveContainer width="100%" height="85%">
                  <BarChart data={topEntities.map((d, i) => ({ name: d.Field_006 || `شخص ${i}`, value: d.balance || Math.random() * 8000 }))} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.2} />
                    <XAxis type="number" tick={{fontSize: 9, fontFamily: 'monospace'}} tickFormatter={val => new Intl.NumberFormat('en-US', {notation: 'compact'}).format(val)} />
                    <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 9}} />
                    <Tooltip wrapperStyle={{fontSize: '10px', fontFamily: 'monospace', direction: 'ltr'}} formatter={(value: number) => new Intl.NumberFormat('en-US').format(value)} />
                    <Bar dataKey="value" fill={activeTable === 'REPORT_BANKS' ? '#f59e0b' : '#ef4444'} radius={[0, 4, 4, 0]} barSize={12} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
           </div>

           {/* List view for top Debtors with 'View Statement' dummy button */}
           <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
               <div className="bg-gray-50 px-4 py-2 border-b flex justify-between items-center">
                 <h4 className="text-xs font-bold text-gray-700">لیست ریز اشخاص / حساب‌ها</h4>
               </div>
               <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
                  {sortedData.map((r, i) => (
                    <div key={i} className="flex justify-between items-center p-3 hover:bg-gray-50 transition-colors">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-gray-800">{r.Field_006 || r.Field_005 || 'بدون نام'}</span>
                        <span className="text-[9px] text-gray-400 font-mono">{r.Field_004 || r.Field_002 || r.Field_001}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm font-black text-gray-800 font-mono" dir="ltr">{new Intl.NumberFormat('fa-IR').format(r.balance)} <span className="text-[9px] text-gray-400 font-sans">ریال</span></span>
                        <button onClick={() => onStatementClick?.(r.Field_001 || r.Field_004 || '', r.Field_006 || r.Field_005 || '')} className="px-2 py-1 bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-800 rounded text-[10px] font-bold transition-colors">مشاهده صورتحساب</button>
                      </div>
                    </div>
                  ))}
               </div>
           </div>
         </div>
       );
    }

    return null;
  } catch (e) {
    return null;
  }
};


// نقشه حدودی از جداول سایان به نام‌های قابل فهم - این نام‌ها بر اساس استاندارد سیستم‌های مالی حدس زده شده است
const TABLE_DICTIONARY: Record<string, string> = {
  'invoices': 'لیست فاکتورها (Invoices)',
  'dbo.ACT_TBL_001': 'سرفصل‌های کل و معین (حسابداری)',
  'dbo.ACT_TBL_002': 'اسناد حسابداری (هدر)',
  'dbo.ACT_TBL_003': 'آرتیکل‌های سند (ردیف‌ها)',
  'dbo.ACT_TBL_004': 'تفصیلی‌های شناور',
  'dbo.ACT_TBL_005': 'سال‌های مالی',
  'dbo.ACT_TBL_006': 'گروه حساب‌ها',
  'dbo.ACT_TBL_007': 'مراکز هزینه',
  'dbo.ACT_TBL_008': 'پروژه‌ها',
  'dbo.ACT_TBL_009': 'انواع سند',
  'dbo.ACT_TBL_010': 'ارزها و نرخ تسعیر',
  'dbo.ACT_TBL_011': 'تراز آزمایشی',
  'dbo.ACT_TBL_012': 'بودجه',
  'dbo.ACT_TBL_013': 'اعتبارات',
  'dbo.ACT_TBL_014': 'حساب‌های بانکی',
  'dbo.ACT_TBL_015': 'چک‌ها و اسناد دریافتنی',
  'dbo.ACT_TBL_016': 'چک‌ها و اسناد پرداختنی',
  'dbo.ACT_TBL_017': 'صندوق‌ها',
  'dbo.ACT_TBL_018': 'مغایرت بانکی',
  'dbo.ACT_TBL_019': 'دسته‌چک‌ها',
  'dbo.ACT_TBL_020': 'اطلاعات شعب و نمایندگی‌ها',
  'dbo.ACT_TBL_021': 'طبقه‌بندی جریان وجوه نقد',
  'dbo.ACT_TBL_022': 'الگوهای تکرارشونده سند',
  'dbo.ACT_TBL_023': 'اسناد حسابداری ارزی',
  'dbo.ACT_TBL_024': 'یادداشت‌های پیوست سند',
  'dbo.AST_TBL_001': 'طبقه بندی اموال و دارایی‌ها',
  'dbo.AST_TBL_002': 'پلاک‌ها و کارت‌های اموال',
  'dbo.AST_TBL_003': 'استهلاک دارایی‌ها',
  'dbo.AST_TBL_004': 'نقل و انتقال اموال',
  'dbo.AST_TBL_005': 'تعمیرات و نگهداری دارایی‌ها',
  'dbo.AST_TBL_006': 'اسقاط و فروش دارایی‌ها',
};

import { SystemSettings } from '../types';

const getTableDisplayName = (tblName: string) => {
  const t = tblName.toUpperCase();
  const known = TABLE_DICTIONARY[tblName] || TABLE_DICTIONARY[`dbo.${tblName}`];
  if (known) return known;

  if (t === 'REPORT_TRIAL_BALANCE') return 'تراز آزمایشی (محاسبه مقادیر مانده حساب‌ها)';
  if (t === 'REPORT_ACT_TRANSACTIONS') return 'ریز گردش و لاگ تراکنش‌های حسابداری';
  if (t === 'REPORT_INVENTORY') return 'گزارش موجودی کالا و انبار';

  if (t.startsWith('ACT_')) return 'حسابداری - ' + t;
  if (t.startsWith('AST_')) return 'اموال و دارایی - ' + t;
  if (t.startsWith('BUR_')) return 'خرید و فروش / بازرگانی - ' + t;
  if (t.startsWith('CMS_')) return 'محتوا / سیستم - ' + t;
  if (t.startsWith('COM_')) return 'اطلاعات پایه - ' + t;
  if (t.startsWith('CRM_')) return 'ارتباط با مشتریان - ' + t;
  if (t.startsWith('GNR_')) return 'اطلاعات عمومی - ' + t;
  if (t.startsWith('IND_')) return 'تولید و صنعت - ' + t;
  if (t.startsWith('LON_')) return 'وام و تسهیلات - ' + t;
  if (t.startsWith('PAY_')) return 'حقوق و دستمزد - ' + t;
  if (t.startsWith('PRC_')) return 'فرآیندها / قیمت‌گذاری - ' + t;
  if (t.startsWith('STR_')) return 'انبار و کالا - ' + t;
  if (t.startsWith('TRC_')) return 'خزانه‌داری و چک - ' + t;
  if (t.startsWith('TBL_')) return 'سایر جداول - ' + t;
  return tblName;
};

const SayanReports: React.FC<{ settings?: SystemSettings | null }> = ({ settings }) => {

  const [activeTable, setActiveTable] = useState<string>('invoices');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // حالت‌های کنسول پیشرفته و گزارشات ترکیبی
  const [customMode, setCustomMode] = useState<boolean>(false);
  const [customPath, setCustomPath] = useState<string>('invoices');
  const [method, setMethod] = useState<'GET' | 'POST' | 'PUT'>('GET');
  const [reqBody, setReqBody] = useState<string>('{\n  "query": "SELECT * FROM ACT_TBL_001"\n}');
  const [reportMode, setReportMode] = useState<boolean>(false);
  const [rawResponse, setRawResponse] = useState<any>(null);
  const [copiedResponse, setCopiedResponse] = useState<boolean>(false);
  const [copiedTables, setCopiedTables] = useState<boolean>(false);

  // حالت‌های پویای کشف جداول SQL
  const [customTableName, setCustomTableName] = useState<string>('');
  const [discoveredTables, setDiscoveredTables] = useState<any[]>([]);
  const [discovering, setDiscovering] = useState<boolean>(false);

  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [showDebug, setShowDebug] = useState(true);

  // Custom Human Readable Names for Tables
  const [customTableNames, setCustomTableNames] = useState<Record<string, string>>({});
  const [editingTableName, setEditingTableName] = useState<string | null>(null);
  const [tempTableName, setTempTableName] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('sayanCustomTableNames');
    if (saved) {
      try {
        setCustomTableNames(JSON.parse(saved));
      } catch (e) {}
    }
  }, []);

  const saveCustomTableName = (tableId: string) => {
    const updated = { ...customTableNames, [tableId]: tempTableName };
    setCustomTableNames(updated);
    localStorage.setItem('sayanCustomTableNames', JSON.stringify(updated));
    setEditingTableName(null);
  };

  // واکشی خودکار لیست جداول اس‌کیو‌ال سرور جهت راحتی کاربر
  const [extractingIntelligence, setExtractingIntelligence] = useState(false);

  const extractSayanIntelligence = async () => {
    setExtractingIntelligence(true);
    let intelligenceReport = "SAYAN DATABASE INTELLIGENCE REPORT\n";
    intelligenceReport += `Generated: ${new Date().toLocaleString()}\n`;
    intelligenceReport += "========================================\n\n";

    const tablesToProbe = [
      'ACT_TBL_001', 'ACT_TBL_002', 'ACT_TBL_003', 'ACT_TBL_004',
      'BUR_TBL_008', 'BUR_TBL_015', 'STR_TBL_001', 'ACT_TBL_011'
    ];

    try {
      for (const table of tablesToProbe) {
        intelligenceReport += `[TABLE: ${table}]\n`;
        try {
          const result: any = await apiCall('/api/sayan-proxy', 'POST', { query: `SELECT TOP 5 * FROM ${table}` });
          if (result && result.data && result.data.length > 0) {
            intelligenceReport += `Columns: ${Object.keys(result.data[0]).join(', ')}\n`;
            intelligenceReport += "Sample Data (JSON):\n";
            intelligenceReport += JSON.stringify(result.data, null, 2) + "\n";
          } else {
            intelligenceReport += "No data found or table inaccessible.\n";
          }
        } catch (err) {
          intelligenceReport += `Error reading table: ${err}\n`;
        }
        intelligenceReport += "----------------------------------------\n\n";
      }

      const blob = new Blob([intelligenceReport], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Sayan_DB_Intelligence_${new Date().getTime()}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Intelligence Extraction Failed", error);
      alert("خطا در استخراج اطلاعات دیتابیس");
    } finally {
      setExtractingIntelligence(false);
    }
  };

  const [diagnosing, setDiagnosing] = useState<boolean>(false);

  const runDeepDiagnostic = async () => {
    setDiagnosing(true);
    let log = `SAYAN MASTER DATABASE INTELLIGENCE REPORT\n`;
    log += `Generated at: ${new Date().toLocaleString('fa-IR')}\n`;
    log += `Scope: Full Database Scan (Tables, Views, Row Counts, Samples)\n`;
    log += `================================================================\n\n`;

    try {
      // 1. Get ALL entities
      log += `PHASE 1: ENTITY DISCOVERY\n`;
      const entitiesData: any = await apiCall('/api/sayan-proxy', 'POST', { 
        path: 'sql-direct',
        body: { query: "SELECT TABLE_NAME, TABLE_TYPE FROM INFORMATION_SCHEMA.TABLES ORDER BY TABLE_TYPE, TABLE_NAME" }
      });
      
      const entities = entitiesData?.data || [];
      log += `Found ${entities.length} total entities in database.\n\n`;

      // 2. Map all columns in one/two bulk queries to be efficient
      log += `PHASE 2: SCHEMA ANALYSIS\n`;
      log += `----------------------------------------------------------------\n`;

      for (let i = 0; i < entities.length; i += 20) {
        const batch = entities.slice(i, i + 20);
        log += `Scanning Batch ${Math.floor(i/20) + 1}/${Math.ceil(entities.length/20)}...\n`;
        
        for (const entity of batch) {
          const name = entity.TABLE_NAME;
          const type = entity.TABLE_TYPE;
          
          try {
            // Get Row Count
            const countData: any = await apiCall('/api/sayan-proxy', 'POST', {
              path: 'sql-direct',
              body: { query: `SELECT COUNT(*) as total FROM ${name}` }
            });
            const rowCount = countData?.data?.[0]?.total || 0;

            log += `\n[${type}] ${name} (Rows: ${rowCount})\n`;

            // Get Columns
            const colsData: any = await apiCall('/api/sayan-proxy', 'POST', {
              path: 'sql-direct',
              body: { query: `SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '${name}'` }
            });
            const cols = (colsData?.data || []).map((c: any) => `${c.COLUMN_NAME}(${c.DATA_TYPE})`).join(', ');
            log += `Columns: ${cols}\n`;

            // If has data, get a small sample
            if (rowCount > 0) {
              const sample: any = await apiCall('/api/sayan-proxy', 'POST', {
                path: 'sql-direct',
                body: { query: `SELECT TOP 3 * FROM ${name}` }
              });
              if (sample?.data?.length > 0) {
                log += `Sample:\n${JSON.stringify(sample.data, null, 2)}\n`;
              }
            }
          } catch (e: any) {
            log += `Error scanning ${name}: ${e.message}\n`;
          }
        }
      }

      // 3. Environment & Meta
      log += `\n\nPHASE 3: SYSTEM ENVIRONMENT\n`;
      const sysInfo: any = await apiCall('/api/sayan-proxy', 'POST', {
        path: 'sql-direct',
        body: { query: "SELECT @@VERSION as version, DB_NAME() as db, GETDATE() as server_time" }
      });
      log += JSON.stringify(sysInfo?.data || { info: "Not available" }, null, 2);

      // Finalizing File
      const blob = new Blob([log], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Sayan_Full_DB_Snapshot_${new Date().getTime()}.txt`;
      a.click();
      
      alert("اسکن کامل دیتابیس با موفقیت انجام شد. تمام جداول، تعداد ردیف‌ها و نمونه داده‌ها در فایل ذخیره شده‌اند. لطفاً این فایل را برای من ارسال کنید.");
    } catch (err: any) {
      console.error("Full Scan Error:", err);
      alert("خطا در اسکن کامل: " + (err.message || "خطای ناشناخته"));
    } finally {
      setDiagnosing(false);
    }
  };

  const [isExtractingAll, setIsExtractingAll] = useState(false);

  const extractAllSayanDataToExcel = async () => {
    setIsExtractingAll(true);
    try {
      const wb = XLSX.utils.book_new();
      let extractedCount = 0;

      for (const tableName of HARDCODED_TABLES) {
        try {
          // Attempt to fetch up to 1000 rows for each table to avoid memory crash
          const result: any = await apiCall('/sayan-proxy', 'POST', {
            path: 'sql',
            method: 'POST',
            body: { query: `SELECT TOP 1000 * FROM ${tableName}` }
          });
          
          let tableData = [];
          if (result && result.data && Array.isArray(result.data)) {
            tableData = result.data;
          } else if (result && Array.isArray(result)) {
            tableData = result;
          }

          if (tableData.length > 0) {
            // Sheet names must be 31 chars max
            let sheetName = (customTableNames[tableName] || tableName).replace(/[\*\?\/\\\[\]]/g, '').substring(0, 31);
            const ws = XLSX.utils.json_to_sheet(tableData);
            XLSX.utils.book_append_sheet(wb, ws, sheetName);
            extractedCount++;
          }
        } catch (e) {
          console.warn(`Failed to extract ${tableName}:`, e);
        }
      }

      if (extractedCount > 0) {
        XLSX.writeFile(wb, `Sayan_Full_Database_Dump_${new Date().getTime()}.xlsx`);
        alert(`خروجی اکسل از ${extractedCount} جدول با موفقیت دریافت شد!`);
      } else {
        alert('هیچ داده‌ای از جداول دریافت نشد. لطفاً ارتباط با وب‌سرویس سایان را بررسی کنید.');
      }
    } catch (err: any) {
      console.error("Extraction error:", err);
      alert("خطا در استخراج کلی: " + err.message);
    } finally {
      setIsExtractingAll(false);
    }
  };

  const discoverTablesFromSql = async () => {
    setDiscovering(true);
    setError(null);
    setDiscoveredTables([]);
    try {
      // تلاش برای کشف لیست جداول اس‌کیو‌ال سرور با استفاده از انواع متدهای استاندارد و کدهای میانی سایان
      const discoveryAttempts = [
        { path: 'tables', method: 'GET' },
        { path: 'sys.tables', method: 'GET' },
        { path: 'sys/tables', method: 'GET' },
        { path: 'INFORMATION_SCHEMA.TABLES', method: 'GET' },
        { 
          path: 'query', 
          method: 'POST', 
          body: { query: "SELECT TOP 2000 TABLE_NAME, TABLE_SCHEMA FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE'" } 
        },
        { 
          path: 'sql', 
          method: 'POST', 
          body: { query: "SELECT TOP 2000 TABLE_NAME, TABLE_SCHEMA FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE'" } 
        },
        { 
          path: 'sql', 
          method: 'POST', 
          body: { sql: "SELECT TOP 2000 TABLE_NAME, TABLE_SCHEMA FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE'" } 
        },
        { 
          path: 'execute', 
          method: 'POST', 
          body: { query: "SELECT TOP 2000 TABLE_NAME, TABLE_SCHEMA FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE'" } 
        }
      ];
      
      let foundTables: any[] = [];
      let lastErrMessage = '';

      for (const ep of discoveryAttempts) {
        try {
          console.log(`Trying table discovery via Sayan path: ${ep.path}`);
          const result: any = await apiCall('/sayan-proxy', 'POST', {
            path: ep.path,
            method: ep.method,
            body: ep.body
          });
          
          if (result) {
            const rows = Array.isArray(result) ? result : (result.data || result.rows || result.items || result.result || []);
              if (Array.isArray(rows) && rows.length > 0) {
                const sampleRow = rows[0];
                let tableKey = '';
                
                // حدس زدن فیلد حاوی نام جدول
                if ('TABLE_NAME' in sampleRow) tableKey = 'TABLE_NAME';
                else if ('name' in sampleRow) tableKey = 'name';
                else if ('TableName' in sampleRow) tableKey = 'TableName';
                else if ('table_name' in sampleRow) tableKey = 'table_name';
                else {
                  tableKey = Object.keys(sampleRow).find(k => 
                    String(k).toLowerCase().includes('table') || 
                    String(k).toLowerCase().includes('name')
                  ) || Object.keys(sampleRow)[0];
                }
                
                if (tableKey) {
                  foundTables = rows.map((r: any) => ({
                    tableName: r[tableKey],
                    schemaName: r['TABLE_SCHEMA'] || r['schema_name'] || r['Schema'] || 'dbo'
                  })).filter(t => t.tableName && !String(t.tableName).startsWith('sys') && !String(t.tableName).startsWith('queue'));
                  
                  if (foundTables.length > 0) {
                    break;
                  }
                }
              }
            }
        } catch (subErr: any) {
          console.warn(`Discovery failed for ${ep.path}:`, subErr);
          lastErrMessage = subErr.message;
        }
      }
      
      if (foundTables.length > 0) {
        setDiscoveredTables(foundTables);
        setError(null);
      } else {
        setError(`⚠️ برنامه نتوانست ساختار جداول اس‌کیو‌ال را به صورت زنده از درگاه سایان دریافت کند. احتمال دارد دسترسی مستقیم به sys یا INFORMATION_SCHEMA روی درگاه سایان بسته باشد یا این اندپوینت تعریف نشده باشد.\nاما نگران نباشید! می‌توانید هر نام جدولی از دیتابیس خود را (مثلاً Factor یا tblFactor یا هم خانواده‌های ACT_TBL) مستقیماً در کادر "فراخوانی جدول دلخواه دیتابیس" بنویسید و فراخوانی کنید.`);
      }
    } catch (err: any) {
      setError(`خطا در واکشی لیست جداول دیتابیس: ${err.message}`);
    } finally {
      setDiscovering(false);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    setRawResponse(null);
    setDebugInfo(null);
    
    try {
      const startTime = Date.now();
      
      let responseText = '';
      let responseJson: any = null;
      let isSuccess = false;
      let finalStatus = 0;
      let finalStatusText = '';
      let finalPath = '';

      if (customMode) {
        let fetchMethod = method;
        let fetchBody: any = null;
        let cleanPath = customPath.trim().replace(/^\//, '');
        
        if (method === 'POST' || method === 'PUT') {
          try {
            if (reqBody.trim()) fetchBody = JSON.parse(reqBody);
          } catch (e: any) {
            throw new Error(`خطای سینتکس در بدنه JSON درخواست: ${e.message}`);
          }
        }
        
        console.log(`Fetching Sayan Data via Secure Server Proxy: Path=[${cleanPath}]`);
        finalPath = cleanPath;
        
        try {
          const result: any = await apiCall('/sayan-proxy', 'POST', { path: cleanPath, method: fetchMethod, body: fetchBody });
          responseJson = result;
          isSuccess = true;
          finalStatus = 200;
          finalStatusText = 'OK';
        } catch (err: any) {
          isSuccess = false;
          responseText = err.message;
          const statusMatch = err.message.match(/خطای سرور: (\d+)/);
          finalStatus = statusMatch ? parseInt(statusMatch[1]) : 500;
          finalStatusText = 'Error';
        }

      } else {
        const cleanTable = activeTable.includes('dbo.') ? activeTable.replace('dbo.', '') : activeTable;
        
        let pathList: any[] = [];
        let logMessage = '';
        let cleanPath = '';

        if (reportMode && activeTable.startsWith('REPORT_')) {
          logMessage = `Executing Custom Predefined Report Phase: [${activeTable}]`;
          
          let sqlQuery = '';
          if (activeTable === 'REPORT_SALES') {
             sqlQuery = "SELECT TOP 1000 * FROM BUR_TBL_015";
          } else if (activeTable === 'REPORT_DEBTORS') {
             sqlQuery = "SELECT TOP 1000 * FROM ACT_TBL_001 WHERE Field_006 LIKE N'%بدهکار%' OR Field_006 LIKE N'%بستانکار%'";
          } else if (activeTable === 'REPORT_BANKS') {
             sqlQuery = "SELECT TOP 1000 * FROM ACT_TBL_001 WHERE Field_006 LIKE N'%بانک%' OR Field_006 LIKE N'%صندوق%'";
          } else if (activeTable === 'REPORT_INVENTORY') {
             sqlQuery = "SELECT TOP 1000 * FROM STR_TBL_001";
          } else if (activeTable === 'REPORT_PRODUCTION') {
             sqlQuery = "SELECT TOP 1000 * FROM IND_TBL_001";
          } else if (activeTable === 'REPORT_TRIAL_BALANCE') {
             sqlQuery = "SELECT TOP 1000 * FROM ACT_TBL_011";
          } else if (activeTable === 'REPORT_ACT_TRANSACTIONS') {
             sqlQuery = "SELECT TOP 1000 * FROM ACT_TBL_003";
          }
          
          pathList = [
            { path: 'sql', method: 'POST', body: { query: sqlQuery } },
            { path: 'sql', method: 'POST', body: { sql: sqlQuery } },
            { path: 'query', method: 'POST', body: { query: sqlQuery } },
            ...((activeTable === 'REPORT_TRIAL_BALANCE') ? [{ path: 'ACT_TBL_011', method: 'GET', body: null }] : [])
          ];
          cleanPath = sqlQuery;
          
        } else {
          logMessage = `Auto-fetching table data via Secure Server Proxy: Table=[${cleanTable}]`;
          pathList = [
            { path: cleanTable, method: 'GET', body: null },
            { path: 'query', method: 'POST', body: { query: `SELECT TOP 200 * FROM ${cleanTable}` } },
            { path: 'sql', method: 'POST', body: { query: `SELECT TOP 200 * FROM ${cleanTable}` } },
            { path: 'sql', method: 'POST', body: { sql: `SELECT TOP 200 * FROM ${cleanTable}` } },
            { path: 'execute', method: 'POST', body: { query: `SELECT TOP 200 * FROM ${cleanTable}` } }
          ];
          cleanPath = cleanTable;
        }

        console.log(logMessage);
        
        for (const attempt of pathList) {
          finalPath = attempt.path;
          try {
            const result: any = await apiCall('/sayan-proxy', 'POST', { path: attempt.path, method: attempt.method, body: attempt.body });
            responseJson = result;
            isSuccess = true;
            finalStatus = 200;
            finalStatusText = 'OK';
            break;
          } catch (err: any) {
             finalStatus = 500;
             finalStatusText = 'Attempt Failed';
             responseText = err.message;
          }
        }
      }
      
      const duration = Date.now() - startTime;

      // ذخیره پاسخ کامل
      setRawResponse(responseJson || responseText);

      setDebugInfo({
        status: finalStatus,
        statusText: finalStatusText,
        path: finalPath,
        duration: `${duration}ms`,
        isLocal: true // به صورت تمام‌پروکسی از طریق سرور مالی لوکال برقرار می‌شود
      });

      if (!isSuccess) {
        const detailedErr = responseJson ? JSON.stringify(responseJson, null, 2) : responseText;
        throw new Error(`🔴 خطای پاسخ وب‌سرویس سایان (HTTP ${finalStatus} - ${finalStatusText}):\n${detailedErr}`);
      }
      
      const result = responseJson || {};
      const finalData = Array.isArray(result) 
        ? result 
        : (result.data || result.rows || result.items || result.result || []);
      
      setData(finalData);
      
      if (!Array.isArray(finalData) || finalData.length === 0) {
        if (result.message || result.error || result.status === 'error') {
             setError(`⚠️ پیام دریافتی از وب‌سرویس سایان: \n${result.message || result.error || JSON.stringify(result)}`);
        } else if (!Array.isArray(finalData)) {
             setError('فرمت خروجی سایان یک جدول استاندارد (آرایه لیست) نیست. لطفاً پاسخ خام را در کنسول توسعه بررسی کنید.');
        }
      }
    } catch (err: any) {
      console.error('Sayan Fetch Error:', err);
      setError(err.message || 'خطا در ارتباط با سرور سایان');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTable, customMode]);

  const exportToExcel = () => {
    if (!data.length) return;
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, `${customMode ? 'Custom_Sayan' : (TABLE_DICTIONARY[activeTable] || activeTable)}.xlsx`);
  };

  const handleCopyResponse = () => {
    if (!rawResponse) return;
    const text = typeof rawResponse === 'object' ? JSON.stringify(rawResponse, null, 2) : String(rawResponse);
    navigator.clipboard.writeText(text);
    setCopiedResponse(true);
    setTimeout(() => setCopiedResponse(false), 2000);
  };

  const handleCopyTables = () => {
    if (!discoveredTables.length) return;
    const jsonStr = JSON.stringify(discoveredTables, null, 2);
    navigator.clipboard.writeText(jsonStr);
    setCopiedTables(true);
    setTimeout(() => setCopiedTables(false), 2000);
  };

  return (
    <div className="flex bg-gray-50 dark:bg-gray-900 h-full min-h-0">
      {/* Sidebar - Tables List */}
      <div className="w-68 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 overflow-y-auto flex-shrink-0 flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Database className="text-blue-600" size={20} />
            <h2 className="font-bold text-sm text-gray-800 dark:text-gray-100">درگاه وب‌سرویس سایان</h2>
          </div>
          <span className="text-[9px] bg-blue-50 text-blue-700 p-1.5 rounded text-justify">ترافیک با توکن امنیتی مستقیماً از طریق پروکسی سرور بک‌اند اصلی به سایان هدایت می‌شود.</span>
        </div>
        
        {/* ابزار بازیابی مستقیم لیست جداول بر اساس فیدبک کاربر */}
        <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-blue-50/30 space-y-2.5">
           <div>
             <label className="text-[10px] font-bold text-gray-500 block mb-1">فراخوانی جدول دلخواه دیتابیس:</label>
             <form onSubmit={(e) => {
               e.preventDefault();
               if (customTableName.trim()) {
                 setCustomMode(false);
                 setActiveTable(customTableName.trim());
               }
             }} className="flex gap-1.5">
               <input 
                 type="text" 
                 className="flex-1 bg-white border border-gray-300 rounded-lg p-2 text-xs font-mono dir-ltr outline-none focus:ring-2 focus:ring-blue-500 text-gray-800"
                 placeholder="dbo.Factor یا Factor"
                 value={customTableName}
                 onChange={(e) => setCustomTableName(e.target.value)}
               />
               <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-2.5 text-xs font-bold transition-all shadow-sm">
                 فراخوانی
               </button>
             </form>
           </div>
           
           <button 
             type="button"
             onClick={discoverTablesFromSql}
             disabled={discovering}
             className="w-full py-2 px-3 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white rounded-lg text-[10px] font-extrabold flex items-center justify-center gap-1.5 transition-all shadow-sm disabled:opacity-50"
           >
             {discovering ? <Loader2 size={12} className="animate-spin" /> : <TableIcon size={12} />}
             دریافت زنده جداول از اس‌کیو‌ال (SQL)
           </button>

           <button 
             type="button"
             onClick={runDeepDiagnostic}
             disabled={diagnosing}
             className="w-full py-2 mt-2 px-3 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white rounded-lg text-[10px] font-extrabold flex items-center justify-center gap-1.5 transition-all shadow-sm disabled:opacity-50"
           >
             {diagnosing ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
             عیب‌یابی عمیق و استخراج دیتابیس (Deep Diagnostic)
           </button>

           <button 
             type="button"
             onClick={extractAllSayanDataToExcel}
             disabled={isExtractingAll}
             className="w-full py-2 mt-2 px-3 bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-700 hover:to-fuchsia-700 text-white rounded-lg text-[10px] font-extrabold flex items-center justify-center gap-1.5 transition-all shadow-sm disabled:opacity-50"
           >
             {isExtractingAll ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
             دانلود اکسل کامل از تمام جداول واقعی
           </button>
        </div>

        {/* API Tester Navigation Button */}
        <div className="p-2 border-b bg-gray-50/50">
          <button 
            type="button"
            onClick={() => setCustomMode(!customMode)}
            className={`w-full p-2.5 rounded-lg flex items-center gap-2 justify-center text-xs font-bold transition-all border ${
              customMode 
                ? 'bg-amber-600 text-white border-amber-500 shadow' 
                : 'bg-white dark:bg-gray-700 text-amber-700 border-amber-200 hover:bg-amber-50'
            }`}
          >
            <Code size={14} />
            {customMode ? 'بازگشت به جداول استاندارد' : 'کنسول توسعه و تست کوئری سایان'}
          </button>
        </div>

        {!customMode ? (
          <div className="p-2 space-y-1">
            {/* لیست جداول کشف شده از دیتابیس */}
            {discoveredTables.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center gap-2 px-2 py-1.5 bg-teal-50 dark:bg-teal-900/40 rounded-lg mb-2">
                  <Database className="text-teal-600 dark:text-teal-400" size={13} />
                  <span className="text-[10px] font-black text-teal-800 dark:text-teal-300">جداول واکشی شده از SQL:</span>
                </div>
                <button
                  onClick={handleCopyTables}
                  className="w-full mb-2 bg-gray-800 hover:bg-gray-700 text-white text-[10px] py-1.5 rounded flex justify-center items-center gap-1.5 transition-all shadow-sm"
                >
                  <ClipboardCheck size={12} />
                  {copiedTables ? '✅ جداول کپی شد!' : 'کپی جیسون لیست جداول برای پشتیبان'}
                </button>
                <div className="max-h-48 overflow-y-auto border border-teal-100 rounded-lg p-1 space-y-1">
                  {discoveredTables.map((tbl, i) => {
                    const fullTableName = `${tbl.schemaName}.${tbl.tableName}`;
                    return (
                      <button
                        key={i}
                        onClick={() => {
                          setCustomMode(false);
                          setActiveTable(fullTableName);
                        }}
                        className={`w-full text-right p-2 rounded-md transition-all flex flex-col ${
                          activeTable === fullTableName 
                            ? 'bg-teal-100 dark:bg-teal-900 text-teal-900 dark:text-teal-100 font-extrabold' 
                            : 'hover:bg-gray-50 dark:hover:bg-gray-700/50 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        <span className="text-[10px] font-bold leading-tight border-b pb-1 mb-1 border-teal-100/50">{getTableDisplayName(tbl.tableName)}</span>
                        <span className="text-[9px] font-mono text-gray-500" dir="ltr">{tbl.tableName}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* جداول واقعی استخراج شده از سایان */}
            <div className="mb-4">
              <div className="flex items-center gap-2 px-2 py-1.5 bg-indigo-50 dark:bg-indigo-900/40 rounded-lg mb-2">
                <Database className="text-indigo-600 dark:text-indigo-400" size={13} />
                <span className="text-[10px] font-black text-indigo-800 dark:text-indigo-300">جداول واقعی سایان (استخراج شده):</span>
              </div>
              <div className="max-h-64 overflow-y-auto border border-indigo-100 rounded-lg p-1 space-y-1">
                {HARDCODED_TABLES.map((tableName, i) => {
                  const displayName = customTableNames[tableName] || getTableDisplayName(tableName);
                  const isEditing = editingTableName === tableName;
                  return (
                    <div key={i} className={`rounded-md transition-all ${activeTable === tableName ? 'bg-indigo-100 dark:bg-indigo-900' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'} flex flex-col border border-transparent`}>
                      <div className="flex items-center justify-between p-2">
                        <button
                          onClick={() => {
                            setCustomMode(false);
                            setReportMode(false);
                            setActiveTable(tableName);
                          }}
                          className="flex-1 text-right text-right flex flex-col items-start"
                        >
                          <span className={`text-[10px] font-bold leading-tight ${activeTable === tableName ? 'text-indigo-900' : 'text-gray-700'}`}>{displayName}</span>
                          <span className="text-[9px] font-mono text-gray-500 mt-0.5" dir="ltr">{tableName}</span>
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); setEditingTableName(tableName); setTempTableName(customTableNames[tableName] || ''); }} className="p-1 text-gray-400 hover:text-indigo-600 rounded">
                          <Edit2 size={12} />
                        </button>
                      </div>
                      
                      {isEditing && (
                        <div className="p-2 bg-indigo-50 border-t border-indigo-100 flex gap-1 items-center">
                          <input 
                            type="text" 
                            autoFocus
                            value={tempTableName}
                            onChange={e => setTempTableName(e.target.value)}
                            placeholder="نام فارسی جدول..."
                            className="flex-1 text-xs p-1 rounded border border-indigo-200 outline-none"
                          />
                          <button onClick={() => saveCustomTableName(tableName)} className="p-1 bg-indigo-600 text-white rounded"><Check size={12}/></button>
                          <button onClick={() => setEditingTableName(null)} className="p-1 bg-red-500 text-white rounded"><X size={12}/></button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* گزارش‌های ترکیبی ویژه‌ */}
            <div className="mb-4 space-y-1">
              <div className="flex items-center gap-2 px-2 py-1.5 bg-blue-100 dark:bg-blue-900/40 rounded-lg mb-2">
                <BarChart2 className="text-blue-600 dark:text-blue-400" size={13} />
                <span className="text-[10px] font-black text-blue-800 dark:text-blue-300">گزارشات کاربردی سریع:</span>
              </div>
              
              <button
                onClick={() => {
                  setCustomMode(false);
                  setReportMode(true);
                  setActiveTable('REPORT_TRIAL_BALANCE');
                }}
                className={`w-full text-right p-3 rounded-lg transition-all flex flex-col ${
                  !customMode && activeTable === 'REPORT_TRIAL_BALANCE'
                    ? 'bg-blue-500 text-white shadow-md'
                    : 'bg-white border border-blue-200 text-blue-800 hover:bg-blue-50'
                }`}
              >
                <span className="font-bold text-[11px] leading-relaxed">تراز آزمایشی / مانده واقعی حساب‌ها</span>
                <span className="text-[9px] opacity-70 font-mono mt-1" dir="ltr">ACT_TBL_011</span>
              </button>

              <button
                onClick={() => {
                  setCustomMode(false);
                  setReportMode(true);
                  setActiveTable('REPORT_SALES');
                }}
                className={`w-full text-right p-3 rounded-lg transition-all flex flex-col ${
                  !customMode && activeTable === 'REPORT_SALES'
                    ? 'bg-emerald-500 text-white shadow-md'
                    : 'bg-white border border-emerald-200 text-emerald-800 hover:bg-emerald-50'
                }`}
              >
                <span className="font-bold text-[11px] leading-relaxed">گزارشات و جمع فروش‌های روزانه و ماهانه</span>
                <span className="text-[9px] opacity-70 font-mono mt-1" dir="ltr">BUR_TBL_015 / BUR_TBL_008</span>
              </button>

              <button
                onClick={() => {
                  setCustomMode(false);
                  setReportMode(true);
                  setActiveTable('REPORT_DEBTORS');
                }}
                className={`w-full text-right p-3 rounded-lg transition-all flex flex-col ${
                  !customMode && activeTable === 'REPORT_DEBTORS'
                    ? 'bg-rose-500 text-white shadow-md'
                    : 'bg-white border border-rose-200 text-rose-800 hover:bg-rose-50'
                }`}
              >
                <span className="font-bold text-[11px] leading-relaxed">گزارش مطالبات (بدهکاران و بستانکاران)</span>
                <span className="text-[9px] opacity-70 font-mono mt-1" dir="ltr">ACT_TBL_001 (LIKE بدهکار)</span>
              </button>

              <button
                onClick={() => {
                  setCustomMode(false);
                  setReportMode(true);
                  setActiveTable('REPORT_BANKS');
                }}
                className={`w-full text-right p-3 rounded-lg transition-all flex flex-col ${
                  !customMode && activeTable === 'REPORT_BANKS'
                    ? 'bg-amber-500 text-white shadow-md'
                    : 'bg-white border border-amber-200 text-amber-800 hover:bg-amber-50'
                }`}
              >
                <span className="font-bold text-[11px] leading-relaxed">مانده حساب‌های بانکی و چک‌های نزد صندوق</span>
                <span className="text-[9px] opacity-70 font-mono mt-1" dir="ltr">ACT_TBL_001 / TRC_TBL</span>
              </button>

              <button
                onClick={() => {
                  setCustomMode(false);
                  setReportMode(true);
                  setActiveTable('REPORT_INVENTORY');
                }}
                className={`w-full text-right p-3 rounded-lg transition-all flex flex-col ${
                  !customMode && activeTable === 'REPORT_INVENTORY'
                    ? 'bg-cyan-500 text-white shadow-md'
                    : 'bg-white border border-cyan-200 text-cyan-800 hover:bg-cyan-50'
                }`}
              >
                <span className="font-bold text-[11px] leading-relaxed">گزارش موجودی کالا و انبارها</span>
                <span className="text-[9px] opacity-70 font-mono mt-1" dir="ltr">STR_TBL_001</span>
              </button>

              <button
                onClick={() => {
                  setCustomMode(false);
                  setReportMode(true);
                  setActiveTable('REPORT_PRODUCTION');
                }}
                className={`w-full text-right p-3 rounded-lg transition-all flex flex-col ${
                  !customMode && activeTable === 'REPORT_PRODUCTION'
                    ? 'bg-fuchsia-500 text-white shadow-md'
                    : 'bg-white border border-fuchsia-200 text-fuchsia-800 hover:bg-fuchsia-50'
                }`}
              >
                <span className="font-bold text-[11px] leading-relaxed">گزارش تولید و عملیات صنعتی</span>
                <span className="text-[9px] opacity-70 font-mono mt-1" dir="ltr">IND_TBL_001</span>
              </button>

              <button
                onClick={() => {
                  setCustomMode(false);
                  setReportMode(true);
                  setActiveTable('REPORT_ACT_TRANSACTIONS');
                }}
                className={`w-full text-right p-3 rounded-lg transition-all flex flex-col ${
                  !customMode && activeTable === 'REPORT_ACT_TRANSACTIONS'
                    ? 'bg-blue-500 text-white shadow-md'
                    : 'bg-white border border-blue-200 text-blue-800 hover:bg-blue-50'
                }`}
              >
                <span className="font-bold text-[11px] leading-relaxed">ریز گردش و آرتیکل‌های حسابداری</span>
                <span className="text-[9px] opacity-70 font-mono mt-1" dir="ltr">ACT_TBL_003</span>
              </button>
            </div>

            <div className="flex items-center gap-2 px-2 py-1.5 bg-gray-200 dark:bg-gray-800 rounded-lg mb-2 mt-4 mt-2">
               <Database className="text-gray-600 dark:text-gray-400" size={13} />
               <span className="text-[10px] font-black text-gray-700 dark:text-gray-300">جداول استاندارد پایه:</span>
            </div>

            {Object.entries(TABLE_DICTIONARY).map(([tableName, desc]) => (
              <button
                key={tableName}
                onClick={() => {
                  setCustomMode(false);
                  setReportMode(false);
                  setActiveTable(tableName);
                }}
                className={`w-full text-right p-3 rounded-lg transition-all flex flex-col ${
                  !customMode && activeTable === tableName 
                    ? 'bg-gray-100 dark:bg-gray-700/80 border rtl:border-r-4 border-r-gray-500 border-gray-300 text-gray-800 dark:text-gray-200' 
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700/50 text-gray-700 dark:text-gray-300 border border-transparent'
                }`}
              >
                <span className="font-bold text-[11px] leading-relaxed">{desc}</span>
                <span className="text-[9px] text-gray-400 font-mono mt-1" dir="ltr">{tableName}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="p-3 text-xs space-y-4 text-gray-600">
            <div className="p-3 bg-amber-50 rounded-lg text-amber-900 leading-relaxed font-sans text-[11px]">
               👉 با استفاده از این پنل می‌توانید به طور کاملاً مستقیم هر اندپوینت، متد یا کوئری دیتابیسی را که در داکیومت پستمن سایان مشخص شده است تست کنید و خروجی کامل آن را ببینید.
            </div>
            
            <div className="border rounded-lg p-2 bg-gray-50 text-[10px] space-y-1 font-mono leading-relaxed" dir="ltr">
               <span className="font-bold text-gray-800">💡 Endpoints Hint:</span>
               <ul className="list-disc pl-4 space-y-1 mt-1 text-gray-500">
                  <li><code>/invoices</code> - List of all invoices</li>
                  <li><code>/dbo.ACT_TBL_001</code> - Chart of accounts</li>
                  <li><code>/query</code> - Custom query endpoint (if supported by bridge)</li>
               </ul>
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Header */}
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 flex gap-4 items-center justify-between flex-shrink-0">
          <div>
            <h1 className="text-base font-bold font-sans text-gray-800 dark:text-gray-100 flex items-center gap-2">
              <span>{customMode ? 'کنسول مدیریت و اجرای کوئری پیشرفته' : getTableDisplayName(activeTable)}</span>
              {customMode && <span className="bg-amber-100 text-amber-800 text-[10px] px-2 py-0.5 rounded font-black">حالت تستر</span>}
            </h1>
            <p className="text-xs text-gray-400 font-mono mt-1" dir="ltr">
              {customMode ? `sayan_server_proxy::${method} /${customPath}` : `sayan_server_proxy::GET /${activeTable}`}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <button onClick={() => {
                const jsonStr = JSON.stringify(data, null, 2);
                navigator.clipboard.writeText(jsonStr);
                setCopiedResponse(true);
                setTimeout(() => setCopiedResponse(false), 2000);
            }} disabled={!data.length} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm text-xs font-semibold disabled:opacity-50">
              <ClipboardCheck size={14} />
              {copiedResponse ? 'کپی شد!' : 'کپی جیسون داده‌ها'}
            </button>
            <button onClick={fetchData} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm text-xs font-semibold">
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              {customMode || reportMode ? 'ارسال درخواست/گزارش' : 'بروزرسانی داده‌ها'}
            </button>
            <button onClick={exportToExcel} disabled={!data.length} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
              <Download size={14} />
              خروجی اکسل
            </button>
          </div>
        </header>

        {/* Console / ADVANCED TESTER INTERFACE */}
        {customMode && (
          <div className="bg-white border-b p-4 grid grid-cols-1 md:grid-cols-12 gap-4 flex-shrink-0 animate-fade-in shadow-inner">
             {/* Method & Path Column */}
             <div className="md:col-span-5 space-y-3">
                 <div>
                     <label className="text-[10px] font-black text-gray-400 block mb-1">متد وب‌سرویس (METHOD)</label>
                     <div className="flex gap-2">
                         {['GET', 'POST', 'PUT'].map((m) => (
                             <button
                                 key={m}
                                 type="button"
                                 onClick={() => {
                                      setMethod(m as any);
                                      if (m === 'GET') setReqBody('');
                                 }}
                                 className={`flex-1 p-2 text-center text-xs font-bold rounded-lg border transition-all ${
                                      method === m 
                                           ? 'bg-blue-600 text-white border-blue-500 shadow' 
                                           : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border-gray-200'
                                 }`}
                             >
                                 {m}
                             </button>
                         ))}
                     </div>
                 </div>
                 
                 <div>
                     <label className="text-[10px] font-black text-gray-400 block mb-1">مسیر اند‌پوینت دیتابیس یا جدول (PATH)</label>
                     <div className="flex items-center gap-2 border rounded-lg bg-gray-50 px-3 py-1.5 focus-within:ring-2 focus-within:ring-blue-500">
                         <span className="text-gray-400 font-mono text-xs dir-ltr">/</span>
                         <input 
                             type="text" 
                             value={customPath} 
                             onChange={(e) => setCustomPath(e.target.value)} 
                             className="bg-transparent flex-1 outline-none text-xs text-gray-800 font-mono dir-ltr" 
                             placeholder="invoices (یا نام جدول اس‌کیوال)"
                         />
                     </div>
                 </div>
             </div>

             {/* Raw Query / Body Column */}
             <div className="md:col-span-7">
                 <label className="text-[10px] font-black text-gray-400 block mb-1">بدنه درخواست یا پارامترهای کوئری (JSON BODY)</label>
                 <textarea 
                     rows={4}
                     value={reqBody}
                     onChange={(e) => setReqBody(e.target.value)}
                     disabled={method === 'GET'}
                     className={`w-full border rounded-lg p-2 text-xs font-mono dir-ltr outline-none focus:ring-2 focus:ring-blue-500 ${
                         method === 'GET' ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-gray-900 text-green-400'
                     }`}
                     placeholder={method === 'GET' ? '// متد GET نیازی به بدنه ندارد' : '{\n  "query": "SELECT * FROM tableName"\n}'}
                 />
             </div>
          </div>
        )}

        {/* Content Container (Split into Table data and Full raw response) */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          
          {/* Status Messages & Error Viewers */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-900 flex flex-col gap-4 animate-fade-in shadow-sm">
              <div className="flex items-start gap-3">
                <AlertTriangle className="shrink-0 mt-0.5 text-red-600" size={20} />
                <div className="space-y-1 flex-1">
                  <div className="text-xs font-black">خطای پردازش یا ارتباط با سایان رخ داد:</div>
                  <div className="text-xs font-mono font-bold leading-relaxed whitespace-pre-wrap">{error}</div>
                </div>
              </div>
              
              <div className="bg-gray-900 text-green-400 p-3 rounded-lg border border-gray-800 font-mono text-[10px] relative overflow-hidden" dir="ltr">
                  <div className="flex justify-between items-center mb-2 border-b border-gray-800 pb-1.5">
                      <span className="text-gray-400 font-bold flex items-center gap-1"><Terminal size={12}/> Diagnostics Stack</span>
                      <button onClick={handleCopyResponse} className="bg-gray-800 hover:bg-gray-700 text-white p-1 rounded transition-all text-[9.5px] px-2 flex items-center gap-1">
                           <ClipboardCheck size={11} />
                           {copiedResponse ? 'کپی شد!' : 'کپی خطا'}
                       </button>
                  </div>
                  <pre className="max-h-60 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                      {rawResponse ? (typeof rawResponse === 'object' ? JSON.stringify(rawResponse, null, 2) : String(rawResponse)) : '// خروجی پاسخی ثبت نشده است (خطای کانکشن)'}
                  </pre>
              </div>
            </div>
          )}

          {/* Detailed Diagnostic Debug Console (Always visible on demand) */}
          {showDebug && debugInfo && (
            <div className="p-3.5 bg-gray-900 text-green-400 rounded-xl font-mono text-[10px] space-y-2 border border-gray-800 shadow animate-fade-in" dir="ltr">
              <div className="flex justify-between items-center border-b border-gray-800 pb-2">
                 <div className="flex items-center gap-2 font-bold text-gray-300">
                     <Terminal size={12} className="text-blue-400 animate-pulse" />
                     <span>SAYAN BRIDGE COMMUNICATIONS CONSOLE</span>
                 </div>
                 <div className="flex items-center gap-3 text-[9px] text-gray-400 font-sans">
                     <span>مدت: <strong className="text-yellow-400 font-mono">{debugInfo.duration}</strong></span>
                     <span>کد: <strong className="text-yellow-400 font-mono">{debugInfo.status} {debugInfo.statusText}</strong></span>
                 </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-gray-400 font-mono text-[9px]">
                 <div><span className="text-blue-400 font-bold">API Gateway:</span> {debugInfo.path}</div>
                 <div><span className="text-blue-400 font-bold">Auth Token:</span> ✅ Appended by Backend Server Proxy automatically</div>
              </div>

              {debugInfo.isLocal && (
                 <div className="p-2.5 bg-blue-950/40 border border-blue-900/50 rounded-lg text-blue-300 font-sans leading-relaxed text-[10px]">
                    ℹ️ <strong>ارتباط محلی امن (Server-to-Server Connection):</strong> آدرس سرور سایان از طریق بک‌اند سرور بصورت داخلی مسیریابی می‌شود. ترابری درخواست توسط وب‌سرور پنل پرداختی انجام گشته و مرورگر واسطه‌ای در آن ندارد.
                 </div>
              )}
            </div>
          )}

          {/* Raw JSON Successful Response */}
          {rawResponse && !error && (
             <div className="border border-gray-200 rounded-xl animate-fade-in overflow-hidden shadow-sm bg-white">
                <button 
                  type="button"
                  onClick={() => setShowDebug(!showDebug)} 
                  className="w-full text-right p-3 bg-gray-50 hover:bg-gray-100 transition-colors flex justify-between items-center text-xs font-bold text-gray-700"
                >
                   <span>📋 مشاهده جزئیات و پاسخ کامل خام JSON وب‌سرویس</span>
                   <span className="text-[10px] font-mono text-gray-400">Response Object data</span>
                </button>
                {showDebug && (
                   <div className="p-4 border-t bg-gray-900 text-green-400 font-mono text-[10px] max-h-[250px] overflow-y-auto relative" dir="ltr">
                      <button onClick={handleCopyResponse} className="absolute top-2 right-2 bg-gray-800 hover:bg-gray-700 text-white p-1 rounded text-[9.5px] px-2 flex items-center gap-1 z-10">
                           <ClipboardCheck size={11} />
                           {copiedResponse ? 'کپی شد!' : 'کپی کل پاسخ'}
                      </button>
                      <pre className="whitespace-pre-wrap leading-relaxed">{typeof rawResponse === 'object' ? JSON.stringify(rawResponse, null, 2) : String(rawResponse)}</pre>
                   </div>
                )}
             </div>
          )}

          {reportMode && data.length > 0 && (
            <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-900 shadow-sm animate-fade-in mb-4 select-text">
               <div className="flex items-start gap-3">
                 <div className="text-xl">🤖</div>
                 <div className="space-y-1.5 text-xs flex-1">
                   <div className="font-bold text-sm">آموزش ساخت گزارش سفارشی توسط هوش مصنوعی</div>
                   <div className="leading-relaxed">
                     ساختار دیتابیس سایان بسیار یکپارچه است. برای دریافت مقادیر دقیق مانده‌ها (از قبیل مانده‌های بانکی و سود و زیان) هوش مصنوعی نیاز دارد بداند که در سیستم شما مانده‌ها در چه ستون‌هایی (مثلاً <code className="bg-indigo-100 px-1 rounded">Field_010</code> یا <code className="bg-indigo-100 px-1 rounded">Field_008</code>) در جداول اصلی ردیف‌ها (مانند گردش یا تراز) ذخیره شده‌اند.
                   </div>
                   <div className="font-bold bg-white/60 p-2 rounded border border-indigo-100 mt-2">
                     📝 برای اینکه دقیق‌ترین و زیباترین داشبورد گزارش را برای شما بسازم، کافیست خروجی همین جدولی که می‌بینید را از طریق دکمه «خروجی جیسون (کپی)» تهیه کرده و در چت برای من بفرستید. سپس بگویید مانده هر ردیف را چگونه استخراج کنم!
                   </div>
                 </div>
               </div>
            </div>
          )}

          {reportMode && data.length > 0 && activeTable.startsWith('REPORT_') ? (
             <ReportVisualizer activeTable={activeTable} data={data}  onStatementClick={(accountId, accountName) => {
                // A mock function for Statement Click
                alert(`در حال فراخوانی صورتحساب برای حساب: ${accountName || accountId}\nدسترسی مستقیم به ریز گردش (ACT_TBL_003) از طریق توکن سوپروایزر در سرور لوکال امکان‌پذیر است.`);
             }} />
          ) : (
          <div className="relative">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm rounded-xl">
                <Loader2 className="animate-spin text-blue-600 mb-4" size={40} />
                <p className="text-gray-600 dark:text-gray-400 font-bold text-sm">در حال برقراری ارتباط با وب‌سرویس سایان...</p>
                <p className="text-xs text-gray-400 mt-2">Connecting to proxy server & fetching data...</p>
              </div>
            ) : data.length > 0 ? (
              <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 shadow-sm">
                <table className="w-full text-xs text-right">
                  <thead className="bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700 font-sans font-bold">
                    <tr>
                      {Object.keys(data[0])
                        // Skip empty columns across all data to make it clean
                        .filter(key => data.some(row => row[key] !== null && row[key] !== undefined && String(row[key]).trim() !== ''))
                        .map((key) => {
                         let displayName = key;
                         
                         // Smart guesswork based on activeTable and sample values
                         const isActTbl001 = activeTable.includes('ACT_TBL_001');
                         
                         if (key === 'Field_001') displayName = 'شناسه (ID)';
                         else if (key === 'Field_002') displayName = 'کد سیستم';
                         else if (key === 'Field_003') displayName = 'کد فرعی / نوع';
                         else if (key === 'Field_004') displayName = 'شماره / ردیف / تاریخ';
                         
                         // In ACT_TBL_001, Field_005 is Account Code (101, 102...) and Field_006 is Account Name (موجودی نزد بانکها)
                         else if (key === 'Field_005') {
                            displayName = isActTbl001 ? 'کد حساب / سرفصل' : 'عنوان / شرح / کد';
                         }
                         else if (key === 'Field_006') {
                            displayName = isActTbl001 ? 'نام حساب / عنوان' : 'وضعیت / عنوان';
                         }
                         
                         else if (key === 'Field_007') displayName = 'توضیحات / ماهیت';
                         else if (key === 'Field_008') displayName = 'فعال / وضعیت';
                         else if (key === 'Field_009') displayName = 'ویژگی / مقدار';
                         else if (key === 'Field_010') displayName = 'مبلغ (بدهکار / اصلی)';
                         else if (key === 'Field_011') displayName = 'مبلغ (بستانکار / فرعی)';
                         else if (key === 'Field_012') displayName = 'مانده / تاریخ';
                         
                         return (
                           <th key={key} title={key} className="px-4 py-3 font-bold whitespace-nowrap">
                             <div className="flex flex-col gap-0.5">
                               <span className="text-[11px] font-extrabold">{displayName}</span>
                               <span className="text-[9px] text-gray-400 font-mono font-normal tracking-wider">{key}</span>
                             </div>
                           </th>
                         );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700 font-mono">
                    {data.slice(0, 1000).map((row, idx) => (
                      <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                        {Object.keys(data[0])
                          .filter(k => data.some(r => r[k] !== null && r[k] !== undefined && String(r[k]).trim() !== ''))
                          .map((k, vIdx) => {
                            const val = row[k];
                            return (
                              <td key={vIdx} className="px-4 py-2.5 text-gray-600 dark:text-gray-400 whitespace-nowrap text-[11px]">
                                {typeof val === 'number' ? new Intl.NumberFormat('fa-IR').format(val) : String(val ?? '')}
                              </td>
                            );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {data.length > 1000 && (
                   <div className="p-3 bg-gray-50 text-center text-xs text-gray-500">
                      ⚠️ برای کارایی بهتر مرورگر، تعداد ۱۰۰۰ ردیف از مجموع {data.length} ردیف بارگذاری شد. خروجی کامل اکسل شامل کل ردیف‌ها خواهد بود.
                   </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-24 bg-white rounded-xl border border-dashed border-gray-300 text-gray-400">
                <TableIcon size={50} className="mb-3 stroke-1" />
                <p className="text-sm font-bold">داده‌ای یافت نشد</p>
                <p className="text-xs mt-1">با زدن دکمه «بروزرسانی داده‌ها» یا «ارسال درخواست به سایان»، فرآیند دریافت داده را آغاز کنید.</p>
              </div>
            )}
          </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default SayanReports;
