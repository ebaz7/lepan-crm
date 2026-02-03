
import React, { useState, useEffect } from 'react';
import { ExitPermit, ExitPermitStatus, User, ExitPermitItem, ExitPermitDestination, UserRole } from '../types';
import { saveExitPermit, getSettings } from '../services/storageService';
import { generateUUID, getCurrentShamsiDate, jalaliToGregorian } from '../constants';
import { apiCall } from '../services/apiService';
import { Save, Loader2, Truck, Package, MapPin, Plus, Trash2, Building2, Calendar, FileText, Send } from 'lucide-react';
import PrintExitPermit from './PrintExitPermit';

const CreateExitPermit: React.FC<{ onSuccess: () => void, currentUser: User }> = ({ onSuccess, currentUser }) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [permitNumber, setPermitNumber] = useState('');
    const [selectedCompany, setSelectedCompany] = useState('');
    const [availableCompanies, setAvailableCompanies] = useState<string[]>([]);
    
    const currentShamsi = getCurrentShamsiDate();
    const [shamsiDate, setShamsiDate] = useState({ year: currentShamsi.year, month: currentShamsi.month, day: currentShamsi.day });

    const [items, setItems] = useState<ExitPermitItem[]>([{ id: generateUUID(), goodsName: '', cartonCount: 0, weight: 0 }]);
    const [destinations, setDestinations] = useState<ExitPermitDestination[]>([{ id: generateUUID(), recipientName: '', address: '', phone: '' }]);
    const [driverInfo, setDriverInfo] = useState({ plateNumber: '', driverName: '', description: '' });
    
    const [tempPermit, setTempPermit] = useState<ExitPermit | null>(null);

    useEffect(() => {
        getSettings().then(s => {
            const names = s.companies?.map(c => c.name) || s.companyNames || [];
            setAvailableCompanies(names);
            if (s.defaultCompany) setSelectedCompany(s.defaultCompany);
        });
        fetchNextNumber();
    }, []);

    const fetchNextNumber = async () => {
        const res = await apiCall<{ nextNumber: number }>('/next-exit-permit-number');
        setPermitNumber(res.nextNumber.toString());
    };

    const handleItemChange = (index: number, field: keyof ExitPermitItem, value: any) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: value };
        setItems(newItems);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedCompany) return alert('لطفاً شرکت صادرکننده را انتخاب کنید.');
        if (items.some(i => !i.goodsName)) return alert('نام کالا الزامی است.');

        setIsSubmitting(true);
        try {
            const isoDate = jalaliToGregorian(shamsiDate.year, shamsiDate.month, shamsiDate.day).toISOString().split('T')[0];

            const newPermit: ExitPermit = {
                id: generateUUID(),
                permitNumber: parseInt(permitNumber) || 0,
                company: selectedCompany,
                date: isoDate,
                requester: currentUser.fullName,
                items,
                destinations,
                goodsName: items.map(i => i.goodsName).join('، '),
                recipientName: destinations.map(d => d.recipientName).join('، '),
                status: ExitPermitStatus.PENDING_CEO,
                plateNumber: driverInfo.plateNumber,
                driverName: driverInfo.driverName,
                description: driverInfo.description,
                createdAt: Date.now()
            };

            await saveExitPermit(newPermit);
            setTempPermit(newPermit);

            // Wait for DOM to render the capture-ready permit
            setTimeout(async () => {
                const element = document.getElementById(`capture-new-permit-${newPermit.id}`);
                if (element) {
                    // @ts-ignore
                    const canvas = await window.html2canvas(element, { scale: 2, backgroundColor: '#ffffff' });
                    const base64 = canvas.toDataURL('image/png').split(',')[1];
                    const allUsers = await (await apiCall('/users')) as any[];
                    const ceo = allUsers.find(u => u.role === 'ceo');
                    
                    if (ceo?.phoneNumber) {
                        const caption = `🆕 *درخواست خروج بار جدید*\n🔢 شماره: ${newPermit.permitNumber}\n👤 ثبت توسط: ${newPermit.requester}\n📦 گیرنده: ${newPermit.recipientName}\n----------------\nلطفاً جهت تایید بررسی نمایید.`;
                        await apiCall('/send-multichannel', 'POST', {
                            targets: [{ type: 'whatsapp', id: ceo.phoneNumber }],
                            message: caption,
                            mediaData: { data: base64, mimeType: 'image/png', filename: `Permit_${newPermit.permitNumber}.png` }
                        });
                    }
                }
                setIsSubmitting(false);
                onSuccess();
            }, 1000);
        } catch (e) {
            alert('خطا در ثبت');
            setIsSubmitting(false);
        }
    };

    return (
        <div className="bg-gray-50 min-h-screen pb-32 animate-fade-in relative">
            {tempPermit && (
                <div className="fixed -left-[2000px]">
                    <div id={`capture-new-permit-${tempPermit.id}`}>
                        <PrintExitPermit permit={tempPermit} onClose={()=>{}} embed />
                    </div>
                </div>
            )}

            <div className="bg-slate-900 text-white p-8 md:p-12 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6 relative z-10">
                    <div className="flex items-center gap-4">
                        <div className="bg-white/10 p-4 rounded-3xl border border-white/20 backdrop-blur-md">
                            <Truck size={36} className="text-blue-400"/>
                        </div>
                        <div>
                            <h2 className="text-3xl font-black">صدور درخواست خروج</h2>
                            <p className="text-slate-400 text-sm mt-1">مدیریت لجستیک و ارسال بار</p>
                        </div>
                    </div>
                    <div className="bg-white/10 px-8 py-4 rounded-3xl border border-white/10 text-center backdrop-blur-md">
                        <div className="text-[10px] font-black uppercase text-slate-400 mb-1">شماره سند سیستمی</div>
                        <div className="text-4xl font-mono font-black text-blue-400">{permitNumber}</div>
                    </div>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="max-w-5xl mx-auto -mt-10 px-4 relative z-20 space-y-6">
                <div className="bg-white rounded-[2.5rem] shadow-2xl p-8 md:p-10 border border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                        <label className="text-sm font-black text-slate-700 flex items-center gap-2"><Building2 size={18} className="text-blue-600"/> شرکت صادرکننده</label>
                        <select className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold focus:bg-white focus:border-blue-500 transition-all outline-none" value={selectedCompany} onChange={e => setSelectedCompany(e.target.value)}>
                            <option value="">انتخاب شرکت...</option>
                            {availableCompanies.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-black text-slate-700 flex items-center gap-2"><Calendar size={18} className="text-blue-600"/> تاریخ خروج</label>
                        <div className="flex gap-2 dir-ltr">
                            <select className="flex-1 bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold outline-none" value={shamsiDate.day} onChange={e => setShamsiDate({...shamsiDate, day: +e.target.value})}>
                                {Array.from({length:31}, (_,i)=>i+1).map(d=><option key={d} value={d}>{d}</option>)}
                            </select>
                            <select className="flex-2 bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold outline-none" value={shamsiDate.month} onChange={e => setShamsiDate({...shamsiDate, month: +e.target.value})}>
                                {['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'].map((m,i)=><option key={i} value={i+1}>{m}</option>)}
                            </select>
                            <select className="flex-1 bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold outline-none" value={shamsiDate.year} onChange={e => setShamsiDate({...shamsiDate, year: +e.target.value})}>
                                {[1403, 1404, 1405].map(y=><option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-[2.5rem] shadow-2xl p-8 border border-slate-100 space-y-6">
                    <div className="flex justify-between items-center border-b border-slate-50 pb-4">
                        <h3 className="font-black text-xl text-slate-800 flex items-center gap-3"><Package size={24} className="text-orange-500"/> لیست اقلام و کالاها</h3>
                        <button type="button" onClick={() => setItems([...items, { id: generateUUID(), goodsName: '', cartonCount: 0, weight: 0 }])} className="text-xs bg-orange-50 text-orange-600 px-4 py-2 rounded-xl font-black hover:bg-orange-100 transition-all">+ افزودن ردیف</button>
                    </div>
                    {items.map((item, idx) => (
                        <div key={item.id} className="flex flex-col md:flex-row gap-4 p-4 bg-slate-50 rounded-3xl border border-slate-100 relative group">
                            <div className="flex-1 space-y-1">
                                <label className="text-[10px] font-black text-slate-400 mr-2">نام محصول</label>
                                <input className="w-full bg-white border border-slate-200 rounded-2xl p-3 text-sm font-bold" value={item.goodsName} onChange={e => handleItemChange(idx, 'goodsName', e.target.value)} />
                            </div>
                            <div className="w-full md:w-32 space-y-1">
                                <label className="text-[10px] font-black text-slate-400 mr-2">تعداد (کارتن)</label>
                                <input type="number" className="w-full bg-white border border-slate-200 rounded-2xl p-3 text-sm font-bold text-center" value={item.cartonCount} onChange={e => handleItemChange(idx, 'cartonCount', +e.target.value)} />
                            </div>
                            {items.length > 1 && <button type="button" onClick={() => setItems(items.filter((_,i)=>i!==idx))} className="bg-red-50 text-red-500 p-3 rounded-2xl self-end mb-1"><Trash2 size={20}/></button>}
                        </div>
                    ))}
                </div>

                <div className="bg-white rounded-[2.5rem] shadow-2xl p-8 border border-slate-100 space-y-6">
                    <h3 className="font-black text-xl text-slate-800 flex items-center gap-3 border-b border-slate-50 pb-4"><MapPin size={24} className="text-green-500"/> اطلاعات گیرنده و حمل</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 mr-2">نام گیرنده / مشتری</label>
                            <input className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-bold" value={destinations[0].recipientName} onChange={e => { const d = [...destinations]; d[0].recipientName = e.target.value; setDestinations(d); }} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 mr-2">نام راننده</label>
                            <input className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-bold" value={driverInfo.driverName} onChange={e => setDriverInfo({...driverInfo, driverName: e.target.value})} />
                        </div>
                        <div className="md:col-span-2 space-y-1">
                            <label className="text-[10px] font-black text-slate-400 mr-2">آدرس کامل مقصد</label>
                            <textarea className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-bold h-24 resize-none" value={destinations[0].address} onChange={e => { const d = [...destinations]; d[0].address = e.target.value; setDestinations(d); }} />
                        </div>
                    </div>
                </div>

                <div className="fixed bottom-6 left-6 right-6 z-[60] md:static">
                    <button type="submit" disabled={isSubmitting} className="w-full bg-slate-900 text-white py-5 rounded-[2rem] font-black text-lg shadow-2xl flex items-center justify-center gap-3 hover:bg-slate-800 transition-all disabled:opacity-70">
                        {isSubmitting ? <Loader2 className="animate-spin" size={24}/> : <Send size={24}/>}
                        ثبت و ارسال به مدیرعامل
                    </button>
                </div>
            </form>
        </div>
    );
};

export default CreateExitPermit;
