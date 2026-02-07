
import React, { useState } from 'react';
import { Send, MessageCircle, RefreshCcw, Power, Loader2, CheckCircle2 } from 'lucide-react';
import { apiCall } from '../../services/apiService';

const BotManager: React.FC = () => {
    const [loading, setLoading] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    const handleRestart = async (type: 'telegram' | 'bale' | 'whatsapp') => {
        if (!confirm(`آیا از راه‌اندازی مجدد ربات ${type === 'telegram' ? 'تلگرام' : type === 'bale' ? 'بله' : 'واتساپ'} اطمینان دارید؟`)) return;
        
        setLoading(type);
        setSuccessMsg(null);

        try {
            await apiCall('/restart-bot', 'POST', { type });
            setSuccessMsg(`${type === 'telegram' ? 'تلگرام' : type === 'bale' ? 'بله' : 'واتساپ'} با موفقیت بازنشانی شد.`);
            setTimeout(() => setSuccessMsg(null), 3000);
        } catch (e: any) {
            // Check for 404 specifically
            if (e.message && e.message.includes('404')) {
                alert('⚠️ خطا: دستور بازنشانی پیدا نشد (404).\n\nعلت: کدهای سرور آپدیت شده‌اند اما سرور هنوز ریستارت نشده است.\n\nراه حل: لطفاً برنامه سرور (node server.js) را ببندید و دوباره اجرا کنید.');
            } else {
                const errMsg = e.message || 'خطا در عملیات بازنشانی';
                alert(`خطا: ${errMsg}`);
            }
        } finally {
            setLoading(null);
        }
    };

    return (
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm mt-6">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2 border-b pb-2">
                <Power size={20} className="text-red-500"/>
                مدیریت سرویس‌های پیام‌رسان (Restart Bots)
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Telegram */}
                <div className="border rounded-xl p-4 flex flex-col items-center justify-center gap-3 bg-blue-50/50 hover:bg-blue-50 transition-colors">
                    <div className="bg-blue-100 p-3 rounded-full text-blue-600">
                        <Send size={24}/>
                    </div>
                    <div className="text-center">
                        <h4 className="font-bold text-gray-800">ربات تلگرام</h4>
                        <p className="text-xs text-gray-500 mt-1">اتصال به سرورهای تلگرام</p>
                    </div>
                    <button 
                        onClick={() => handleRestart('telegram')} 
                        disabled={loading === 'telegram'}
                        className="w-full bg-blue-600 text-white py-2 rounded-lg text-xs font-bold hover:bg-blue-700 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {loading === 'telegram' ? <Loader2 size={14} className="animate-spin"/> : <RefreshCcw size={14}/>}
                        راه‌اندازی مجدد
                    </button>
                </div>

                {/* Bale */}
                <div className="border rounded-xl p-4 flex flex-col items-center justify-center gap-3 bg-green-50/50 hover:bg-green-50 transition-colors">
                    <div className="bg-green-100 p-3 rounded-full text-green-600">
                        <MessageCircle size={24}/>
                    </div>
                    <div className="text-center">
                        <h4 className="font-bold text-gray-800">ربات بله</h4>
                        <p className="text-xs text-gray-500 mt-1">اتصال به سرورهای بله</p>
                    </div>
                    <button 
                        onClick={() => handleRestart('bale')} 
                        disabled={loading === 'bale'}
                        className="w-full bg-green-600 text-white py-2 rounded-lg text-xs font-bold hover:bg-green-700 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {loading === 'bale' ? <Loader2 size={14} className="animate-spin"/> : <RefreshCcw size={14}/>}
                        راه‌اندازی مجدد
                    </button>
                </div>

                {/* WhatsApp */}
                <div className="border rounded-xl p-4 flex flex-col items-center justify-center gap-3 bg-teal-50/50 hover:bg-teal-50 transition-colors">
                    <div className="bg-teal-100 p-3 rounded-full text-teal-600">
                        <MessageCircle size={24}/>
                    </div>
                    <div className="text-center">
                        <h4 className="font-bold text-gray-800">ربات واتساپ</h4>
                        <p className="text-xs text-gray-500 mt-1">مدیریت نشست (Session)</p>
                    </div>
                    <button 
                        onClick={() => handleRestart('whatsapp')} 
                        disabled={loading === 'whatsapp'}
                        className="w-full bg-teal-600 text-white py-2 rounded-lg text-xs font-bold hover:bg-teal-700 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {loading === 'whatsapp' ? <Loader2 size={14} className="animate-spin"/> : <RefreshCcw size={14}/>}
                        راه‌اندازی مجدد
                    </button>
                </div>
            </div>

            {successMsg && (
                <div className="mt-4 bg-green-100 text-green-700 px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold animate-fade-in">
                    <CheckCircle2 size={16}/> {successMsg}
                </div>
            )}
        </div>
    );
};

export default BotManager;