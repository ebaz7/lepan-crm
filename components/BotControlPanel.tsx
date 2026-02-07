
import React, { useState, useEffect } from 'react';
import { apiCall } from '../services/apiService';
import { MessageCircle, Send, Power, RefreshCcw, CheckCircle, XCircle, Loader2 } from 'lucide-react';

const BotControlPanel: React.FC = () => {
    const [statuses, setStatuses] = useState({ telegram: false, bale: false, whatsapp: false });
    const [loading, setLoading] = useState({ telegram: false, bale: false, whatsapp: false });

    const checkStatuses = async () => {
        try {
            // We assume APIs return { ready: true } if running
            const tg = await apiCall<{ready: boolean}>('/telegram/status').catch(() => ({ ready: false }));
            const bl = await apiCall<{ready: boolean}>('/bale/status').catch(() => ({ ready: false }));
            const wa = await apiCall<{ready: boolean}>('/whatsapp/status').catch(() => ({ ready: false }));
            
            setStatuses({
                telegram: tg.ready,
                bale: bl.ready,
                whatsapp: wa.ready
            });
        } catch (e) {
            console.error("Status check failed", e);
        }
    };

    useEffect(() => {
        checkStatuses();
        const interval = setInterval(checkStatuses, 10000);
        return () => clearInterval(interval);
    }, []);

    const handleRestart = async (bot: 'telegram' | 'bale' | 'whatsapp') => {
        if (!confirm(`آیا از راه‌اندازی مجدد بات ${bot} اطمینان دارید؟`)) return;
        
        setLoading(prev => ({ ...prev, [bot]: true }));
        try {
            await apiCall(`/${bot}/restart`, 'POST');
            alert(`دستور راه‌اندازی مجدد برای ${bot} ارسال شد.`);
            setTimeout(checkStatuses, 3000);
        } catch (e) {
            alert("خطا در ارسال دستور.");
        } finally {
            setLoading(prev => ({ ...prev, [bot]: false }));
        }
    };

    const StatusIcon = ({ active }: { active: boolean }) => (
        active ? <CheckCircle className="text-green-500" size={18} /> : <XCircle className="text-red-500" size={18} />
    );

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 border-t pt-6">
            <div className="md:col-span-3 font-bold text-gray-700 mb-2 flex items-center gap-2">
                <Power size={20} className="text-blue-600"/>
                مدیریت سرویس‌های ربات (کنترل سرور)
            </div>

            {/* Telegram Card */}
            <div className="bg-white border border-blue-200 p-4 rounded-xl shadow-sm flex flex-col justify-between">
                <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2 font-bold text-blue-700">
                        <Send size={20} /> تلگرام
                    </div>
                    <StatusIcon active={statuses.telegram} />
                </div>
                <div className="text-xs text-gray-500 mb-4">
                    وضعیت: {statuses.telegram ? 'فعال و متصل' : 'غیرفعال / قطع'}
                </div>
                <button 
                    onClick={() => handleRestart('telegram')} 
                    disabled={loading.telegram}
                    className="w-full bg-blue-50 text-blue-700 border border-blue-200 py-2 rounded-lg text-xs font-bold hover:bg-blue-100 flex items-center justify-center gap-2"
                >
                    {loading.telegram ? <Loader2 size={14} className="animate-spin"/> : <RefreshCcw size={14}/>}
                    راه‌اندازی مجدد تلگرام
                </button>
            </div>

            {/* Bale Card */}
            <div className="bg-white border border-green-200 p-4 rounded-xl shadow-sm flex flex-col justify-between">
                <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2 font-bold text-green-700">
                        <MessageCircle size={20} /> بله (Bale)
                    </div>
                    <StatusIcon active={statuses.bale} />
                </div>
                <div className="text-xs text-gray-500 mb-4">
                    وضعیت: {statuses.bale ? 'فعال و متصل' : 'غیرفعال / قطع'}
                </div>
                <button 
                    onClick={() => handleRestart('bale')} 
                    disabled={loading.bale}
                    className="w-full bg-green-50 text-green-700 border border-green-200 py-2 rounded-lg text-xs font-bold hover:bg-green-100 flex items-center justify-center gap-2"
                >
                    {loading.bale ? <Loader2 size={14} className="animate-spin"/> : <RefreshCcw size={14}/>}
                    راه‌اندازی مجدد بله
                </button>
            </div>

            {/* WhatsApp Card */}
            <div className="bg-white border border-emerald-200 p-4 rounded-xl shadow-sm flex flex-col justify-between">
                <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2 font-bold text-emerald-700">
                        <MessageCircle size={20} /> واتساپ
                    </div>
                    <StatusIcon active={statuses.whatsapp} />
                </div>
                <div className="text-xs text-gray-500 mb-4">
                    وضعیت: {statuses.whatsapp ? 'آماده‌به‌کار' : 'نیاز به اسکن/قطع'}
                </div>
                <button 
                    onClick={() => handleRestart('whatsapp')} 
                    disabled={loading.whatsapp}
                    className="w-full bg-emerald-50 text-emerald-700 border border-emerald-200 py-2 rounded-lg text-xs font-bold hover:bg-emerald-100 flex items-center justify-center gap-2"
                >
                    {loading.whatsapp ? <Loader2 size={14} className="animate-spin"/> : <RefreshCcw size={14}/>}
                    ریستارت (Force Restart)
                </button>
            </div>
        </div>
    );
};

export default BotControlPanel;
