import React, { useState, useEffect } from 'react';
import { Database, Search, RefreshCw, BarChart2, Table as TableIcon, Settings, Filter, Download, Loader2 } from 'lucide-react';
import { apiCall } from '../services/apiService';
import { motion } from 'motion/react';
import * as XLSX from 'xlsx';

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

const SayanReports: React.FC<{ settings?: SystemSettings | null }> = ({ settings }) => {
  const [activeTable, setActiveTable] = useState<string>('invoices');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // تنظیمات اتصال
  const baseUrl = settings?.sayanApiUrl || localStorage.getItem('sayan_api_url') || 'http://192.168.41.225:3000/api/external/v1';
  const apiKey = settings?.sayanApiKey || localStorage.getItem('sayan_api_key') || 's_gate_live_urp2vvxzpik4';

  const fetchData = async () => {
    if (!baseUrl) {
      setError('ابتدا آدرس API را در تنظیمات عمومی برنامه قسمت API وارد کنید');
      return;
    }
    
    setLoading(true);
    setError(null);
    setDebugInfo(null);
    
    try {
      const url = baseUrl.replace(/\/$/, '');
      const cleanTable = activeTable.includes('dbo.') ? activeTable.replace('dbo.', '') : activeTable;
      const targetUrl = `${url}/${cleanTable}`;
      
      console.log(`Fetching Sayan Data from: ${targetUrl}`);
      
      const headers: any = {
        'Accept': 'application/json',
      };
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }
      
      const startTime = Date.now();
      
      const response = await fetch('/api/sayan-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            url: targetUrl,
            headers: { 'Authorization': `Bearer ${apiKey}` },
            method: 'GET'
        })
      }).catch(err => {
        if (err.name === 'TypeError') {
          throw new Error('خطای ارتباط با سرور برنامه: مطمئن شوید سرور بک‌اِند در حال اجراست.');
        }
        throw err;
      });
      
      const duration = Date.now() - startTime;
      
      setDebugInfo({
        status: response.status,
        statusText: response.statusText,
        url: response.url,
        duration: `${duration}ms`,
        headers: Array.from(response.headers.entries())
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => 'No response body');
        if (response.status === 500) {
          throw new Error(`خطای داخلی سرور سایان (500): احتمالاً پل به بانک اطلاعاتی SQL متصل نیست.\nجزئیات: ${errorBody.substring(0, 100)}`);
        }
        throw new Error(`خطای پاسخ (${response.status}): ${response.statusText}`);
      }
      
      const result = await response.json();
      setData(Array.isArray(result) ? result : (result.data || []));
    } catch (err: any) {
      console.error('Sayan Fetch Error:', err);
      setError(err.message || 'خطا در ارتباط با سرور سایان');
    } finally {
      setLoading(false);
    }
  };

  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [showDebug, setShowDebug] = useState(false);

  useEffect(() => {
    fetchData();
  }, [activeTable]);

  const exportToExcel = () => {
    if (!data.length) return;
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, `${TABLE_DICTIONARY[activeTable] || activeTable}.xlsx`);
  };

  return (
    <div className="flex bg-gray-50 dark:bg-gray-900 h-full">
      {/* Sidebar - Tables List */}
      <div className="w-64 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 overflow-y-auto flex-shrink-0">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Database className="text-blue-600" size={20} />
            <h2 className="font-bold text-gray-800 dark:text-gray-100">منابع سایان</h2>
          </div>
        </div>
        
        <div className="p-2">
          {Object.entries(TABLE_DICTIONARY).map(([tableName, desc]) => (
            <button
              key={tableName}
              onClick={() => setActiveTable(tableName)}
              className={`w-full text-right p-3 rounded-lg mb-1 transition-all flex flex-col ${
                activeTable === tableName 
                  ? 'bg-blue-50 dark:bg-blue-900/40 border rtl:border-r-4 border-r-blue-600 border-blue-100 dark:border-blue-800 text-blue-700 dark:text-blue-300' 
                  : 'hover:bg-gray-50 dark:hover:bg-gray-700/50 text-gray-700 dark:text-gray-300 border border-transparent'
              }`}
            >
              <span className="font-bold text-[12px]">{desc}</span>
              <span className="text-[10px] text-gray-500 dark:text-gray-400 font-mono mt-1" dir="ltr">{tableName}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 flex gap-4 items-center justify-between">
          <div>
            <h1 className="text-xl font-bold font-sans text-gray-800 dark:text-gray-100">
              {TABLE_DICTIONARY[activeTable] || 'گزارش'}
            </h1>
            <p className="text-sm text-gray-500 font-mono mt-1">{activeTable}</p>
          </div>
          
          <div className="flex items-center gap-2">
            <button onClick={fetchData} className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors shadow-sm text-sm font-medium">
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              بروزرسانی
            </button>
            <button onClick={exportToExcel} disabled={!data.length} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed">
              <Download size={16} />
              خروجی اکسل
            </button>
          </div>
        </header>

        {/* Status Messages */}
        {error && (
          <div className="m-4">
            <div className="p-4 bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800 rounded-xl text-orange-800 dark:text-orange-300 flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <Database className="shrink-0 mt-0.5" />
                <div className="text-sm font-medium">{error}</div>
              </div>
              
              <div className="flex gap-2 mr-9">
                <button 
                  onClick={() => setShowDebug(!showDebug)} 
                  className="text-[10px] font-bold underline decoration-dotted"
                >
                  {showDebug ? 'مخفی‌سازی جزئیات فنی' : 'مشاهده جزئیات فنی خطا'}
                </button>
              </div>
            </div>
            
            {showDebug && debugInfo && (
              <div className="mt-2 p-3 bg-gray-800 text-green-400 font-mono text-[10px] rounded-lg overflow-x-auto" dir="ltr">
                <p># Request Diagnostics (via Proxy)</p>
                <p>Target URL: {debugInfo.url}</p>
                <p>Status: {debugInfo.status} {debugInfo.statusText}</p>
                <p>Duration: {debugInfo.duration}</p>
              </div>
            )}
            
            <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg text-[11px] text-blue-700 dark:text-blue-300 leading-relaxed">
              <span className="font-bold">💡 راهنمایی:</span> درخواست‌ها اکنون از طریق سرور (Proxy) ارسال می‌شوند تا مشکل Mixed Content حل شود. اگر همچنان خطا دریافت می‌کنید، مطمئن شوید آدرس IP سیستم مقصد برای سرور برنامه قابل دسترس است (مثلاً از یک تونل Ngrok یا IP استاتیک استفاده کنید).
            </div>
          </div>
        )}

        {/* Data Grid */}
        <div className="flex-1 overflow-auto p-4 relative">
          {loading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm z-10">
              <Loader2 className="animate-spin text-blue-600 mb-4" size={40} />
              <p className="text-gray-600 dark:text-gray-400 font-bold">در حال برقراری ارتباط با وب‌سرویس سایان...</p>
            </div>
          ) : data.length > 0 ? (
            <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 shadow-sm">
              <table className="w-full text-sm text-right">
                <thead className="bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    {Object.keys(data[0]).map((key) => (
                      <th key={key} className="px-4 py-3 font-bold whitespace-nowrap">{key}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {data.map((row, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      {Object.values(row).map((val: any, vIdx) => (
                        <td key={vIdx} className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                          {typeof val === 'number' ? new Intl.NumberFormat('fa-IR').format(val) : String(val)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-500 opacity-60">
              <TableIcon size={64} className="mb-4 stroke-1" />
              <p className="text-lg font-bold">داده‌ای یافت نشد</p>
              <p className="text-sm mt-2">برای بروزرسانی کلیک کنید یا تنظیمات API را بررسی نمایید.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SayanReports;
