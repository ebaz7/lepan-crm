
import React, { useRef, useState } from 'react';
import { Database, DownloadCloud, UploadCloud, Clock, Loader2, CheckCircle, ShieldCheck, FileJson, WifiOff } from 'lucide-react';
import { apiCall, LS_KEYS } from '../../services/apiService';

const BackupManager: React.FC = () => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [restoring, setRestoring] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [message, setMessage] = useState('');

    // Helper to read local storage safely
    const getLocalJSON = (key: string, defaultVal: any = []) => {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultVal;
        } catch (e) { return defaultVal; }
    };

    const downloadBlob = (blob: Blob, filename: string) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    };

    const handleDownloadBackup = async () => {
        setDownloading(true);
        setMessage('');
        
        try {
            // 1. Try Server Backup (Best Quality - Complete DB)
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout for server check

            const response = await fetch(`/api/full-backup`, { signal: controller.signal });
            clearTimeout(timeoutId);
            
            if (!response.ok) throw new Error("Server Download Failed");
            
            const blob = await response.blob();
            const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            downloadBlob(blob, `Full_System_Backup_${dateStr}.json`);
            
        } catch (e) {
            console.warn("Server unreachable, switching to Offline Mode...", e);
            
            // 2. Fallback: Offline Backup (From LocalStorage)
            try {
                const localData = {
                    settings: getLocalJSON(LS_KEYS.SETTINGS, {}),
                    orders: getLocalJSON(LS_KEYS.ORDERS, []),
                    users: getLocalJSON(LS_KEYS.USERS, []),
                    tradeRecords: getLocalJSON(LS_KEYS.TRADE, []),
                    warehouseItems: getLocalJSON(LS_KEYS.WH_ITEMS, []),
                    warehouseTransactions: getLocalJSON(LS_KEYS.WH_TX, []),
                    messages: getLocalJSON(LS_KEYS.CHAT, []),
                    groups: getLocalJSON(LS_KEYS.GROUPS, []),
                    tasks: getLocalJSON(LS_KEYS.TASKS, []),
                    // Initialize missing keys to empty arrays to ensure restore compatibility
                    exitPermits: [], 
                    securityLogs: [],
                    personnelDelays: [],
                    securityIncidents: [],
                    meta: { 
                        source: 'offline_browser_cache', 
                        date: new Date().toISOString(),
                        note: 'Created in Offline Mode'
                    }
                };

                const jsonStr = JSON.stringify(localData, null, 2);
                const blob = new Blob([jsonStr], { type: "application/json" });
                const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
                
                downloadBlob(blob, `Offline_Cache_Backup_${dateStr}.json`);
                
                alert('⚠️ هشدار: ارتباط با سرور برقرار نشد.\n\n✅ فایل پشتیبان از «حافظه موقت مرورگر» (Offline Cache) تهیه و دانلود شد.\n\nتوجه: این فایل شامل اطلاعاتی است که آخرین بار روی این دستگاه مشاهده کرده‌اید.');
            } catch (err) {
                alert("خطا در ایجاد بکاپ آفلاین.");
            }
        } finally {
            setDownloading(false);
        }
    };

    const handleRestoreClick = () => {
        if (confirm('⚠️ هشدار بازگردانی هوشمند:\n\nآیا مطمئن هستید؟ این عملیات تمام اطلاعات فعلی را با فایل انتخاب شده جایگزین می‌کند.\n\nنکته: سیستم از «بازسازی هوشمند» استفاده می‌کند. این یعنی می‌توانید بکاپ نسخه قدیمی را روی نسخه جدید بریزید و همه چیز سالم می‌ماند.')) {
            fileInputRef.current?.click();
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setRestoring(true);
        setMessage('');

        const reader = new FileReader();
        reader.onload = async (ev) => {
            const base64 = ev.target?.result as string;
            try {
                const response = await apiCall<{success: boolean}>('/emergency-restore', 'POST', { fileData: base64 });
                if (response.success) {
                    alert('✅ بازگردانی هوشمند با موفقیت انجام شد.\nسیستم جهت اعمال تغییرات رفرش می‌شود.');
                    window.location.reload();
                } else {
                    throw new Error("Restore failed on server");
                }
            } catch (error) {
                setMessage('❌ خطا در بازگردانی فایل. لطفاً فایل صحیح (JSON) را انتخاب کنید.');
                setRestoring(false);
            }
        };
        reader.readAsDataURL(file);
        e.target.value = ''; // Reset input
    };

    return (
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm relative overflow-hidden animate-fade-in mb-6">
            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                <Database size={100}/>
            </div>
            
            <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2 relative z-10 text-lg border-b pb-2">
                <Database size={24} className="text-blue-600"/> 
                مدیریت پشتیبان‌گیری و بازیابی (فول سیستم)
            </h3>
            
            {/* Auto-Backup Status */}
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 flex items-start gap-3 relative z-10">
                <div className="bg-green-100 p-2 rounded-full">
                    <Clock size={20} className="text-green-600 animate-pulse"/>
                </div>
                <div>
                    <span className="text-sm font-bold text-green-800 block mb-1">سیستم پشتیبان‌گیری خودکار فعال است</span>
                    <p className="text-xs text-green-700 leading-relaxed">
                        سیستم به صورت خودکار <strong>هر ۱ ساعت</strong> یک نسخه کامل از دیتابیس می‌گیرد.
                        <br/>
                        <span className="font-bold mt-1 block text-green-900 flex items-center gap-1">
                            <ShieldCheck size={12}/>
                            ضد خرابی: فایل‌های بکاپ مستقل از ورژن نرم‌افزار هستند.
                        </span>
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                {/* Download Section */}
                <div className="space-y-3">
                    <h4 className="text-sm font-bold text-gray-700 mb-2">تهیه نسخه پشتیبان (دستی)</h4>
                    <button 
                        type="button" 
                        onClick={handleDownloadBackup} 
                        disabled={downloading}
                        className="w-full flex items-center justify-between bg-blue-50 hover:bg-blue-100 text-blue-800 px-4 py-4 rounded-xl text-sm font-bold transition-colors border border-blue-200 shadow-sm"
                    >
                        <span className="flex items-center gap-2">
                            {downloading ? <Loader2 size={20} className="animate-spin"/> : <DownloadCloud size={20}/>} 
                            دانلود فایل کامل دیتابیس
                        </span>
                        <span className="text-[10px] bg-white px-2 py-1 rounded border border-blue-100 text-blue-600 flex items-center gap-1">
                            JSON <WifiOff size={10} className="ml-1 text-gray-400" title="پشتیبانی از حالت آفلاین"/>
                        </span>
                    </button>
                    
                    <div className="text-[10px] text-gray-500 leading-relaxed bg-gray-50 p-3 rounded-lg border">
                        <div className="flex items-center gap-1 font-bold text-gray-700 mb-1"><FileJson size={12}/> محتویات فایل بکاپ:</div>
                        <ul className="list-disc list-inside grid grid-cols-2 gap-x-2 gap-y-1">
                            <li>تمام منوها و زیرمجموعه‌ها</li>
                            <li>مجوزهای خروج و بیجک‌ها</li>
                            <li>دستور پرداخت‌ها</li>
                            <li>کاربران و تنظیمات</li>
                            <li>اطلاعات انبار و بازرگانی</li>
                            <li>گزارشات انتظامات</li>
                        </ul>
                        <div className="mt-2 text-blue-600 font-bold border-t pt-1 border-gray-200">
                            * در صورت قطعی اینترنت، فایل از حافظه مرورگر ساخته می‌شود.
                        </div>
                    </div>
                </div>

                {/* Restore Section */}
                <div className="border-r-0 md:border-r border-gray-100 md:pr-6">
                    <h4 className="text-sm font-bold text-gray-700 mb-2">بازیابی اطلاعات (Smart Restore)</h4>
                    <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} accept=".json,.txt" />
                    
                    <button 
                        type="button" 
                        onClick={handleRestoreClick} 
                        disabled={restoring} 
                        className="w-full h-[120px] flex flex-col items-center justify-center gap-3 bg-amber-50 hover:bg-amber-100 text-amber-800 border-2 border-dashed border-amber-300 px-4 py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                    >
                        {restoring ? <Loader2 size={36} className="animate-spin"/> : <UploadCloud size={36} className="group-hover:scale-110 transition-transform"/>}
                        {restoring ? 'در حال بازگردانی هوشمند...' : 'آپلود فایل بکاپ برای بازگردانی'}
                        {!restoring && <span className="text-[10px] opacity-70 font-normal bg-white/50 px-2 py-0.5 rounded">سازگار با تمام نسخه‌ها</span>}
                    </button>
                    
                    {message && (
                        <div className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded text-center font-bold border border-red-100">
                            {message}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BackupManager;
