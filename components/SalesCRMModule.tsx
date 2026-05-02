import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Upload, Download, Gift, Save } from 'lucide-react';
import { SalesContact, BirthdayGreetingTemplate } from '../types';

export default function SalesCRMModule() {
    const [contacts, setContacts] = useState<SalesContact[]>([]);
    const [template, setTemplate] = useState<BirthdayGreetingTemplate>({ text: 'تولدت مبارک عزیز!', isActive: true });
    
    // In a real app, these would be fetched from backend
    useEffect(() => {
        // Fetch contacts and template
    }, []);

    const exportContacts = () => {
        const headers = ["نام", "موبایل", "تلگرام", "بله", "تاریخ تولد(YYYY-MM-DD)"];
        const rows = contacts.map(c => [c.name, c.mobile, c.telegramId || '', c.baleId || '', c.birthday || '']);
        const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
        const blob = new Blob(["\uFEFF", csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", "contacts.csv");
        link.click();
    };

    const downloadSample = () => {
        const csvContent = "نام,موبایل,تلگرام,بله,تاریخ تولد(YYYY-MM-DD)\nنمونه ۱,۰۹۱۲۰۰۰۰۰۰۰,,,\nنمونه ۲,۰۹۱۲۱۱۱۱۱۱۱,id1,id2,1990-01-01";
        const blob = new Blob(["\uFEFF", csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", "sample_contacts.csv");
        link.click();
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            alert('فایل انتخاب شد (در نسخه فعلی این بخش فقط نمایش داده می‌شود).');
            // Logic to parse CSV would go here
        }
    };

    const handleSaveTemplate = () => {
        // API call to save template
        alert('متن تبریک ذخیره شد.');
    };

    return (
        <div className="p-6 space-y-6">
            <h2 className="text-2xl font-black text-gray-800">مدیریت مخاطبین فروش</h2>
            
            {/* Birthday Template Settings */}
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Gift className="text-pink-500"/> تنظیمات تبریک تولد</h3>
                <div className="space-y-4">
                    <textarea 
                        value={template.text}
                        onChange={e => setTemplate({...template, text: e.target.value})}
                        className="w-full p-3 border rounded-xl"
                        rows={3}
                        placeholder="متن تبریک..."
                    />
                    <label className="flex items-center gap-2">
                        <input type="checkbox" checked={template.isActive} onChange={e => setTemplate({...template, isActive: e.target.checked})} />
                        فعال‌سازی ارسال خودکار تبریک
                    </label>
                    <button onClick={handleSaveTemplate} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-blue-700">
                        <Save size={18}/> ذخیره متن
                    </button>
                </div>
            </div>

            {/* Contacts Table */}
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-lg">لیست مخاطبین</h3>
                    <div className="flex gap-2">
                        <label className="flex items-center gap-2 bg-gray-100 px-4 py-2 rounded-xl font-bold cursor-pointer hover:bg-gray-200">
                             <Upload size={18}/> ایمپورت اکسل
                             <input type="file" className="hidden" accept=".csv" onChange={handleFileUpload} />
                        </label>
                        <button onClick={downloadSample} className="flex items-center gap-2 bg-gray-100 px-4 py-2 rounded-xl font-bold hover:bg-gray-200"><Download size={18}/> دانلود نمونه</button>
                        <button onClick={exportContacts} className="flex items-center gap-2 bg-gray-100 px-4 py-2 rounded-xl font-bold hover:bg-gray-200"><Download size={18}/> اکسپورت اکسل</button>
                        <button className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-emerald-700"><Plus size={18}/> افزودن دستی</button>
                    </div>
                </div>
                {/* Table for contacts */}
            </div>
        </div>
    );
};
