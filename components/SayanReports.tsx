import React, { useState, useEffect } from 'react';
import { Database, Search, RefreshCw, BarChart2, Table as TableIcon, Settings, Filter, Download, Loader2, Play, AlertTriangle, Code, Terminal, ClipboardCheck } from 'lucide-react';
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

  // حالت‌های کنسول پیشرفته و تست API
  const [customMode, setCustomMode] = useState<boolean>(false);
  const [customPath, setCustomPath] = useState<string>('invoices');
  const [method, setMethod] = useState<'GET' | 'POST' | 'PUT'>('GET');
  const [reqBody, setReqBody] = useState<string>('{\n  "query": "SELECT * FROM ACT_TBL_001"\n}');
  const [rawResponse, setRawResponse] = useState<any>(null);
  const [copiedResponse, setCopiedResponse] = useState<boolean>(false);

  // تنظیمات اتصال
  const baseUrl = settings?.sayanApiUrl || localStorage.getItem('sayan_api_url') || 'http://192.168.41.225:3000/api/external/v1';
  const apiKey = settings?.sayanApiKey || localStorage.getItem('sayan_api_key') || 's_gate_live_urp2vvxzpik4';

  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [showDebug, setShowDebug] = useState(true);

  const fetchData = async () => {
    if (!baseUrl) {
      setError('ابتدا آدرس API را در تنظیمات عمومی برنامه قسمت API وارد کنید');
      return;
    }
    
    setLoading(true);
    setError(null);
    setRawResponse(null);
    setDebugInfo(null);
    
    try {
      const url = baseUrl.replace(/\/$/, '');
      let targetUrl = '';
      let fetchMethod = 'GET';
      let fetchBody: any = null;

      if (customMode) {
        const cleanPath = customPath.trim().replace(/^\//, '');
        targetUrl = `${url}/${cleanPath}`;
        fetchMethod = method;
        if (method === 'POST' || method === 'PUT') {
          try {
            if (reqBody.trim()) {
              fetchBody = JSON.parse(reqBody);
            }
          } catch (e: any) {
            throw new Error(`خطای سینتکس در بدنه JSON درخواست: ${e.message}`);
          }
        }
      } else {
        const cleanTable = activeTable.includes('dbo.') ? activeTable.replace('dbo.', '') : activeTable;
        targetUrl = `${url}/${cleanTable}`;
        fetchMethod = 'GET';
      }
      
      console.log(`Fetching Sayan Data [${fetchMethod}] from: ${targetUrl}`);
      
      const startTime = Date.now();
      let proxyResult: any = null;
      let isSuccess = false;
      
      const response = await fetch('/api/sayan-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            url: targetUrl,
            headers: { 'Authorization': `Bearer ${apiKey}` },
            method: fetchMethod,
            body: fetchBody
        })
      });
      
      const duration = Date.now() - startTime;
      
      const responseText = await response.text();
      let responseJson: any = null;
      try {
        responseJson = JSON.parse(responseText);
      } catch (e) {}

      // ذخیره پاسخ کامل
      setRawResponse(responseJson || responseText);
      isSuccess = response.ok;

      setDebugInfo({
        status: response.status,
        statusText: response.statusText,
        url: targetUrl,
        duration: `${duration}ms`,
        isLocal: targetUrl.includes('192.168.') || targetUrl.includes('10.') || targetUrl.includes('127.0.0.1')
      });

      if (!response.ok) {
        if (targetUrl.includes('192.168.') || targetUrl.includes('10.') || targetUrl.includes('127.0.0.1')) {
          if (response.status === 500) {
             throw new Error(`⚠️ خطا ارتباط (کد ۵۰۰): آدرس پل یک آی‌پی محلی (لوکال) است و سرور کلود برنامه نمی‌تواند سیستم محلی شما را ببیند.\n\nراه حل: حتماً برنامه Ngrok یا تونل بگیرید تا آدرس پابلیک به شما بدهد و آن را ذخیره کنید.\n\nپاسخ جزئی سرور: ${JSON.stringify(responseJson || responseText)}`);
          }
        }
        
        const detailedErr = responseJson ? JSON.stringify(responseJson, null, 2) : responseText;
        throw new Error(`🔴 خطای پاسخ وب‌سرویس سایان (HTTP ${response.status} - ${response.statusText}):\n${detailedErr}`);
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

  return (
    <div className="flex bg-gray-50 dark:bg-gray-900 h-full min-h-0">
      {/* Sidebar - Tables List */}
      <div className="w-68 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 overflow-y-auto flex-shrink-0 flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Database className="text-blue-600" size={20} />
            <h2 className="font-bold text-sm text-gray-800 dark:text-gray-100">درگاه وب‌سرویس سایان</h2>
          </div>
          <span className="text-[10px] text-gray-400 font-mono text-left dir-ltr break-all">{baseUrl}</span>
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
          <div className="p-2">
            {Object.entries(TABLE_DICTIONARY).map(([tableName, desc]) => (
              <button
                key={tableName}
                onClick={() => {
                  setCustomMode(false);
                  setActiveTable(tableName);
                }}
                className={`w-full text-right p-3 rounded-lg mb-1 transition-all flex flex-col ${
                  !customMode && activeTable === tableName 
                    ? 'bg-blue-50 dark:bg-blue-900/40 border rtl:border-r-4 border-r-blue-600 border-blue-100 dark:border-blue-800 text-blue-700 dark:text-blue-300' 
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
              <span>{customMode ? 'کنسول مدیریت و اجرای کوئری پیشرفته' : (TABLE_DICTIONARY[activeTable] || 'گزارش')}</span>
              {customMode && <span className="bg-amber-100 text-amber-800 text-[10px] px-2 py-0.5 rounded font-black">حالت تستر</span>}
            </h1>
            <p className="text-xs text-gray-400 font-mono mt-1" dir="ltr">
              {customMode ? `${method} ${baseUrl}/${customPath}` : `GET ${baseUrl}/${activeTable}`}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <button onClick={fetchData} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm text-xs font-semibold">
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              {customMode ? 'ارسال درخواست به سایان' : 'بروزرسانی داده‌ها'}
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
                <div className="space-y-1">
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
                 <div><span className="text-blue-400 font-bold">API Gateway:</span> {debugInfo.url}</div>
                 <div><span className="text-blue-400 font-bold">Auth Token:</span> {apiKey ? '✅ Bearer Valid token loaded' : '❌ No Bearer token configured'}</div>
              </div>

              {debugInfo.isLocal && (
                 <div className="p-2.5 bg-amber-950/40 border border-amber-900/50 rounded-lg text-amber-300 font-sans leading-relaxed text-[10px]">
                    ⚠️ <strong>تذکر مهم درباره IP لوکال:</strong> آدرس سرور سایان تعریف شده ({baseUrl}) جزو رنج آی‌پی‌های داخلی/محلی شماست. از آنجا که سیستم ما کلاودبیس است، سرور اصلی نمی‌تواند مستقیماً به آی‌پی سیستم محلی ویندوز دسکتاپ شما در داخل شبکه داخلی شرکت وصل شود. لطفاً حتماً برنامه Ngrok یا تونل بگذارید و آدرس عمومی یا دامین آی‌پی ولید موقت را در تنظیمات عمومی برنامه جایگزین کنید.
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

          {/* Data Grid Table representation */}
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
                      {Object.keys(data[0]).map((key) => (
                        <th key={key} className="px-4 py-3 font-bold whitespace-nowrap">{key}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700 font-mono">
                    {data.slice(0, 1000).map((row, idx) => (
                      <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                        {Object.values(row).map((val: any, vIdx) => (
                          <td key={vIdx} className="px-4 py-2.5 text-gray-600 dark:text-gray-400 whitespace-nowrap text-[11px]">
                            {typeof val === 'number' ? new Intl.NumberFormat('fa-IR').format(val) : String(val ?? '')}
                          </td>
                        ))}
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

        </div>
      </div>
    </div>
  );
};

export default SayanReports;
