
import React, { useState, useEffect } from 'react';
import { ExitPermit, ExitPermitStatus, User, ExitPermitItem, ExitPermitDestination, UserRole } from '../types';
import { saveExitPermit, getSettings } from '../services/storageService';
import { generateUUID, getCurrentShamsiDate, jalaliToGregorian } from '../constants';
import { apiCall } from '../services/apiService';
import { getUsers } from '../services/authService';
import { Save, Loader2, Truck, Package, MapPin, Hash, Plus, Trash2, Building2, User as UserIcon, Calendar, CheckSquare, ArrowLeft } from 'lucide-react';
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
    
    // Auto-Send Hook
    const [tempPermit, setTempPermit] = useState<ExitPermit | null>(null);
    const [existingPermits, setExistingPermits] = useState<ExitPermit[]>([]);

    useEffect(() => {
        getSettings().then(s => {
            const names = s.companies?.map(c => c.name) || s.companyNames || [];
            setAvailableCompanies(names);
            if (s.defaultCompany) {
                setSelectedCompany(s.defaultCompany);
                fetchNextNumber(s.defaultCompany);
            }
        });
        // Fetch existing permits for duplicate checking (Background)
        apiCall<ExitPermit[]>('/exit-permits').then(res => {
            if (Array.isArray(res)) setExistingPermits(res);
        }).catch(console.error);
    }, []);

    const fetchNextNumber = (company?: string) => {
        if (!company) return;
        // Ensure API call is correct
        apiCall<{ nextNumber: number }>(`/next-exit-permit-number?company=${encodeURIComponent(company)}&t=${Date.now()}`)
            .then(res => {
                if (res && res.nextNumber) setPermitNumber(res.nextNumber.toString());
                else setPermitNumber('1001');
            })
            .catch((e) => {
                console.error("Fetch Number Error", e);
                setPermitNumber('1001');
            });
    };

    const handleCompanyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        setSelectedCompany(val);
        fetchNextNumber(val);
    };

    const handleNumberBlur = () => {
        if (!permitNumber && selectedCompany) {
            fetchNextNumber(selectedCompany);
        } else if (permitNumber && selectedCompany) {
            // Check for duplicate
            const isDuplicate = existingPermits.some(p => 
                p.company === selectedCompany && 
                p.permitNumber === parseInt(permitNumber)
            );
            if (isDuplicate) {
                // Automatically fetch next available number (gap)
                alert('⚠️ این شماره تکراری است. سیستم به طور خودکار اولین شماره خالی را جایگزین می‌کند.');
                fetchNextNumber(selectedCompany);
            }
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedCompany) return alert('لطفا شرکت صادرکننده را انتخاب کنید');
        if (!permitNumber) return alert('شماره حواله الزامی است');
        if (items.some(i => !i.goodsName)) return alert('نام کالا الزامی است');
        if (destinations.some(d => !d.recipientName)) return alert('نام گیرنده الزامی است');

        setIsSubmitting(true);
        
        try {
            let isoDate;
            try {
                const date = jalaliToGregorian(shamsiDate.year, shamsiDate.month, shamsiDate.day);
                isoDate = date.toISOString().split('T')[0];
            } catch (err) { isoDate = new Date().toISOString().split('T')[0]; }

            const newPermit: ExitPermit = {
                id: generateUUID(),
                permitNumber: parseInt(permitNumber.replace(/[^0-9]/g, '')) || 0,
                company: selectedCompany,
                date: isoDate,
                requester: currentUser.fullName,
                items: items,
                destinations: destinations,
                goodsName: items.map(i => i.goodsName).join('، '),
                recipientName: destinations.map(d => d.recipientName).join('، '),
                cartonCount: items.reduce((acc, i) => acc + (Number(i.cartonCount) || 0), 0),
                weight: items.reduce((acc, i) => acc + (Number(i.weight) || 0), 0),
                plateNumber: driverInfo.plateNumber,
                driverName: driverInfo.driverName,
                description: driverInfo.description,
                status: ExitPermitStatus.PENDING_CEO,
                createdAt: Date.now()
            };

            // Call API
            await saveExitPermit(newPermit);
            
            // Initiate Auto-Send Process
            setTempPermit(newPermit);
            
            setTimeout(async () => {
                // Ensure element exists
                const elementId = `print-permit-create-${newPermit.id}`;
                const element = document.getElementById(elementId);
                
                if (element) {
                    try {
                        // @ts-ignore
                        const canvas = await window.html2canvas(element, { scale: 2, backgroundColor: '#ffffff' });
                        const base64 = canvas.toDataURL('image/png').split(',')[1];
                        
                        const users = await getUsers();
                        const ceo = users.find(u => u.role === UserRole.CEO);
                        
                        if (ceo) {
                            const caption = `📋 *صدور حواله خروج جدید*\n🏭 شرکت: ${newPermit.company}\n🔢 شماره: ${newPermit.permitNumber}\n👤 گیرنده: ${newPermit.recipientName}\n📦 کالا: ${newPermit.goodsName}\n\nجهت بررسی و تایید مدیرعامل ارسال شد.`;
                            
                            if (ceo.phoneNumber) {
                                await apiCall('/send-whatsapp', 'POST', { 
                                    number: ceo.phoneNumber, 
                                    message: caption, 
                                    mediaData: { data: base64, mimeType: 'image/png', filename: `Remittance_${newPermit.permitNumber}.png` } 
                                });
                            }
                        }
                    } catch (e) { console.error("Notification Error", e); }
                }
                
                // Clear and navigate
                onSuccess();
            }, 2000);

        } catch (e: any) {
            console.error("Submit Error:", e);
            alert(`خطا در ثبت حواله: ${e.message || 'Server Error'}`);
            setIsSubmitting(false);
        }
    };

    return (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden animate-fade-in relative max-w-4xl mx-auto my-6">
            
            {/* Hidden Print Element for Auto-Send */}
            {tempPermit && (
                <div className="hidden-print-export" style={{ position: 'absolute', top: '-9999px', left: '-9999px', width: '800px', zIndex: -1 }}>
                    <div id={`print-permit-create-${tempPermit.id}`}>
                        <PrintExitPermit permit={tempPermit} onClose={()=>{}} embed />
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="bg-gradient-to-r from-teal-700 to-teal-900 p-6 text-white flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm"><Truck size={28} className="text-white"/></div>
                    <div>
                        <h2 className="text-xl font-black">صدور حواله خروج بار کارخانه</h2>
                        <p className="text-teal-100 text-xs mt-1">فرم رسمی درخواست خروج کالا و محصول</p>
                    </div>
                </div>
                <div className="hidden md:block text-teal-200 text-sm font-bold bg-white/10 px-3 py-1 rounded-full">
                    مرحله ۱: ثبت فروش
                </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-8">
                
                {/* 1. General Info */}
                <div className="bg-gray-50 p-5 rounded-2xl border border-gray-200 relative">
                    <div className="absolute -top-3 right-4 bg-white px-3 py-1 text-sm font-bold text-gray-500 border rounded-lg shadow-sm flex items-center gap-2">
                        <Hash size={16}/> اطلاعات پایه
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-2">
                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1.5">شرکت صادرکننده</label>
                            <select className="w-full border rounded-xl p-3 text-sm bg-white focus:ring-2 focus:ring-teal-500 outline-none" value={selectedCompany} onChange={handleCompanyChange}>
                                <option value="">-- انتخاب کنید --</option>
                                {availableCompanies.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1.5">شماره حواله</label>
                            <input type="number" className="w-full border rounded-xl p-3 text-sm font-bold text-center dir-ltr focus:ring-2 focus:ring-teal-500 outline-none" value={permitNumber} onChange={e => setPermitNumber(e.target.value)} onBlur={handleNumberBlur} placeholder="0000" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1.5">تاریخ صدور</label>
                            <div className="flex gap-1 dir-ltr">
                                <input className="w-full border rounded-xl p-3 text-center text-sm font-bold outline-none focus:ring-2 focus:ring-teal-500" placeholder="روز" value={shamsiDate.day} onChange={e => setShamsiDate({...shamsiDate, day: +e.target.value})} />
                                <input className="w-full border rounded-xl p-3 text-center text-sm font-bold outline-none focus:ring-2 focus:ring-teal-500" placeholder="ماه" value={shamsiDate.month} onChange={e => setShamsiDate({...shamsiDate, month: +e.target.value})} />
                                <input className="w-full border rounded-xl p-3 text-center text-sm font-bold outline-none focus:ring-2 focus:ring-teal-500" placeholder="سال" value={shamsiDate.year} onChange={e => setShamsiDate({...shamsiDate, year: +e.target.value})} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. Items */}
                <div className="bg-teal-50/50 p-5 rounded-2xl border border-teal-100 relative">
                     <div className="absolute -top-3 right-4 bg-white px-3 py-1 text-sm font-bold text-teal-700 border border-teal-200 rounded-lg shadow-sm flex items-center gap-2">
                        <Package size={16}/> لیست اقلام و کالاها
                    </div>
                    <div className="mt-2 space-y-3">
                        {items.map((item, idx) => (
                            <div key={item.id} className="flex flex-col md:flex-row gap-3 items-end bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
                                <div className="flex-1 w-full">
                                    <label className="text-[10px] font-bold text-gray-500 block mb-1">نام کالا / محصول</label>
                                    <input className="w-full border-b border-gray-300 p-2 text-sm font-bold focus:border-teal-500 outline-none" placeholder="مثال: میلگرد 14..." value={item.goodsName} onChange={e => { const n = [...items]; n[idx].goodsName = e.target.value; setItems(n); }} />
                                </div>
                                <div className="w-full md:w-32">
                                    <label className="text-[10px] font-bold text-gray-500 block mb-1 text-center">تعداد (کارتن)</label>
                                    <input type="number" className="w-full border rounded-lg p-2 text-center font-bold bg-gray-50 focus:bg-white transition-colors outline-none" value={item.cartonCount} onChange={e => { const n = [...items]; n[idx].cartonCount = +e.target.value; setItems(n); }} />
                                </div>
                                <div className="w-full md:w-32">
                                    <label className="text-[10px] font-bold text-gray-500 block mb-1 text-center">وزن تقریبی (KG)</label>
                                    <input type="number" className="w-full border rounded-lg p-2 text-center font-bold bg-gray-50 focus:bg-white transition-colors outline-none" value={item.weight} onChange={e => { const n = [...items]; n[idx].weight = +e.target.value; setItems(n); }} />
                                </div>
                                {items.length > 1 && (
                                    <button type="button" onClick={() => setItems(items.filter((_, i) => i !== idx))} className="bg-red-100 text-red-500 p-2.5 rounded-lg hover:bg-red-200 transition-colors">
                                        <Trash2 size={18}/>
                                    </button>
                                )}
                            </div>
                        ))}
                        <button type="button" onClick={() => setItems([...items, { id: generateUUID(), goodsName: '', cartonCount: 0, weight: 0 }])} className="text-teal-600 text-sm font-bold flex items-center gap-1 hover:bg-teal-50 px-3 py-1.5 rounded-lg transition-colors">
                            <Plus size={16}/> افزودن ردیف کالا
                        </button>
                    </div>
                </div>

                {/* 3. Destination & Driver */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-gray-50 p-5 rounded-2xl border border-gray-200 relative">
                        <div className="absolute -top-3 right-4 bg-white px-3 py-1 text-sm font-bold text-gray-500 border rounded-lg shadow-sm flex items-center gap-2">
                            <MapPin size={16}/> گیرنده و مقصد
                        </div>
                        <div className="space-y-3 mt-2">
                            <div><label className="text-xs font-bold block mb-1">نام گیرنده</label><input className="w-full border rounded-xl p-2 text-sm bg-white" placeholder="شخص یا شرکت..." value={destinations[0].recipientName} onChange={e => { const d = [...destinations]; d[0].recipientName = e.target.value; setDestinations(d); }} /></div>
                            <div><label className="text-xs font-bold block mb-1">شماره تماس</label><input className="w-full border rounded-xl p-2 text-sm bg-white dir-ltr text-right" placeholder="0912..." value={destinations[0].phone} onChange={e => { const d = [...destinations]; d[0].phone = e.target.value; setDestinations(d); }} /></div>
                            <div><label className="text-xs font-bold block mb-1">آدرس تخلیه</label><textarea className="w-full border rounded-xl p-2 text-sm bg-white h-20 resize-none" placeholder="آدرس دقیق..." value={destinations[0].address} onChange={e => { const d = [...destinations]; d[0].address = e.target.value; setDestinations(d); }} /></div>
                        </div>
                    </div>

                    <div className="bg-gray-50 p-5 rounded-2xl border border-gray-200 relative">
                         <div className="absolute -top-3 right-4 bg-white px-3 py-1 text-sm font-bold text-gray-500 border rounded-lg shadow-sm flex items-center gap-2">
                            <Truck size={16}/> حمل و نقل (اختیاری)
                        </div>
                        <div className="space-y-3 mt-2">
                            <div><label className="text-xs font-bold block mb-1">نام راننده</label><input className="w-full border rounded-xl p-2 text-sm bg-white" value={driverInfo.driverName} onChange={e => setDriverInfo({...driverInfo, driverName: e.target.value})} /></div>
                            <div><label className="text-xs font-bold block mb-1">پلاک خودرو</label><input className="w-full border rounded-xl p-2 text-sm bg-white dir-ltr text-center font-mono font-bold tracking-widest" placeholder="12 A 345 67" value={driverInfo.plateNumber} onChange={e => setDriverInfo({...driverInfo, plateNumber: e.target.value})} /></div>
                            <div><label className="text-xs font-bold block mb-1">توضیحات تکمیلی</label><textarea className="w-full border rounded-xl p-2 text-sm bg-white h-20 resize-none" placeholder="توضیحات..." value={driverInfo.description} onChange={e => setDriverInfo({...driverInfo, description: e.target.value})} /></div>
                        </div>
                    </div>
                </div>

                {/* Footer Action */}
                <div className="pt-4 border-t border-gray-100 flex justify-end">
                    <button type="submit" disabled={isSubmitting || !selectedCompany} className="bg-gradient-to-r from-teal-600 to-teal-700 text-white px-8 py-4 rounded-xl font-bold shadow-lg shadow-teal-200 hover:shadow-teal-300 transform hover:-translate-y-1 transition-all flex items-center gap-3 disabled:opacity-70 disabled:transform-none">
                        {isSubmitting ? <Loader2 className="animate-spin" size={24}/> : <CheckSquare size={24}/>}
                        <span>ثبت نهایی و ارسال به کارتابل مدیرعامل</span>
                    </button>
                </div>

            </form>
        </div>
    );
};

export default CreateExitPermit;
