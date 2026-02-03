
import React, { useState, useEffect } from 'react';
import { ExitPermit, ExitPermitStatus, User, ExitPermitItem, ExitPermitDestination } from '../types';
import { saveExitPermit, getSettings } from '../services/storageService';
import { generateUUID, getCurrentShamsiDate, jalaliToGregorian } from '../constants';
import { apiCall } from '../services/apiService';
import { Save, Loader2, Truck, Package, MapPin, Hash, Plus, Trash2, Building2, User as UserIcon, Calendar, ArrowLeft, Briefcase, FileText } from 'lucide-react';
import PrintExitPermit from './PrintExitPermit';

const CreateExitPermit: React.FC<{ onSuccess: () => void, currentUser: User }> = ({ onSuccess, currentUser }) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Form Data
    const [permitNumber, setPermitNumber] = useState('');
    const [selectedCompany, setSelectedCompany] = useState('');
    const [availableCompanies, setAvailableCompanies] = useState<string[]>([]);
    
    const currentShamsi = getCurrentShamsiDate();
    const [shamsiDate, setShamsiDate] = useState({ year: currentShamsi.year, month: currentShamsi.month, day: currentShamsi.day });

    const [items, setItems] = useState<ExitPermitItem[]>([{ id: generateUUID(), goodsName: '', cartonCount: 0, weight: 0 }]);
    const [destinations, setDestinations] = useState<ExitPermitDestination[]>([{ id: generateUUID(), recipientName: '', address: '', phone: '' }]);
    const [driverInfo, setDriverInfo] = useState({ plateNumber: '', driverName: '', description: '' });
    
    // Auto-Send Logic
    const [tempPermit, setTempPermit] = useState<ExitPermit | null>(null);

    useEffect(() => {
        getSettings().then(s => {
            const names = s.companies?.map(c => c.name) || s.companyNames || [];
            setAvailableCompanies(names);
            if (s.defaultCompany) {
                setSelectedCompany(s.defaultCompany);
                fetchNextNumber(s.defaultCompany);
            }
        });
    }, []);

    const fetchNextNumber = (company?: string) => {
        if (!company) return;
        setPermitNumber('...'); 
        apiCall<{ nextNumber: number }>(`/next-exit-permit-number?company=${encodeURIComponent(company)}&t=${Date.now()}`)
            .then(res => {
                if (res && res.nextNumber) setPermitNumber(res.nextNumber.toString());
                else setPermitNumber('1001');
            })
            .catch(() => setPermitNumber('1001'));
    };

    const handleCompanyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        setSelectedCompany(val);
        fetchNextNumber(val);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        // Validation
        if (!selectedCompany) return alert('❌ لطفاً شرکت صادرکننده را انتخاب کنید.');
        if (items.some(i => !i.goodsName)) return alert('❌ نام کالا در تمامی ردیف‌ها الزامی است.');
        if (destinations.some(d => !d.recipientName)) return alert('❌ نام گیرنده الزامی است.');

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
                // Legacy support fields
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

            // 1. Save to Server
            await saveExitPermit(newPermit);
            
            // 2. Prepare for Auto-Send (Optional but requested)
            setTempPermit(newPermit);
            
            // Wait slightly for rendering then finish
            setTimeout(() => {
                setIsSubmitting(false);
                onSuccess();
            }, 1000);

        } catch (e: any) {
            console.error(e);
            alert(`خطا در ثبت: ${e.message}`);
            setIsSubmitting(false);
        }
    };

    return (
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden animate-fade-in relative max-w-5xl mx-auto my-4 pb-20">
            
            {/* Hidden Print Element for Auto-Send Snapshot */}
            {tempPermit && (
                <div className="hidden-print-export" style={{ position: 'absolute', top: '-9999px', left: '-9999px', width: '800px', zIndex: -1 }}>
                    <div id={`print-permit-create-${tempPermit.id}`}>
                        <PrintExitPermit permit={tempPermit} onClose={()=>{}} embed />
                    </div>
                </div>
            )}

            {/* Top Banner */}
            <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-8 text-white relative overflow-hidden">
                <div className="relative z-10 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <div className="bg-white/10 p-3 rounded-2xl backdrop-blur-md border border-white/20">
                            <Truck size={32} className="text-blue-300"/>
                        </div>
                        <div>
                            <h2 className="text-2xl font-black tracking-tight">حواله خروج بار کارخانه</h2>
                            <p className="text-slate-300 text-sm mt-1">ثبت درخواست خروج محصول و کالا</p>
                        </div>
                    </div>
                    <div className="hidden md:block text-right">
                        <div className="text-xs text-slate-400 font-bold mb-1">شماره حواله بعدی</div>
                        <div className="text-3xl font-mono font-black text-blue-300 tracking-wider">
                            {permitNumber || '---'}
                        </div>
                    </div>
                </div>
                {/* Decoration Circles */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
                <div className="absolute bottom-0 left-0 w-40 h-40 bg-blue-500/10 rounded-full translate-y-1/3 -translate-x-1/3 blur-2xl"></div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-8">
                
                {/* GROUP 1: BASIC INFO */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-1 bg-blue-50/50 p-5 rounded-2xl border border-blue-100 flex flex-col gap-4">
                        <div className="flex items-center gap-2 text-blue-800 font-bold border-b border-blue-200 pb-2">
                            <Building2 size={18}/>
                            <span>اطلاعات پایه</span>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-600 block mb-1.5">شرکت صادرکننده</label>
                            <div className="relative">
                                <select 
                                    className="w-full border-2 border-blue-100 rounded-xl p-3 text-sm bg-white focus:border-blue-500 outline-none transition-colors appearance-none" 
                                    value={selectedCompany} 
                                    onChange={handleCompanyChange}
                                >
                                    <option value="">-- انتخاب کنید --</option>
                                    {availableCompanies.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                                    <ArrowLeft size={16} className="-rotate-90"/>
                                </div>
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-600 block mb-1.5">تاریخ صدور</label>
                            <div className="flex gap-1 dir-ltr">
                                <input className="w-full border-2 border-blue-100 rounded-xl p-2.5 text-center text-sm font-bold outline-none focus:border-blue-500 bg-white" placeholder="D" value={shamsiDate.day} onChange={e => setShamsiDate({...shamsiDate, day: +e.target.value})} />
                                <span className="self-center text-gray-300">/</span>
                                <input className="w-full border-2 border-blue-100 rounded-xl p-2.5 text-center text-sm font-bold outline-none focus:border-blue-500 bg-white" placeholder="M" value={shamsiDate.month} onChange={e => setShamsiDate({...shamsiDate, month: +e.target.value})} />
                                <span className="self-center text-gray-300">/</span>
                                <input className="w-full border-2 border-blue-100 rounded-xl p-2.5 text-center text-sm font-bold outline-none focus:border-blue-500 bg-white" placeholder="Y" value={shamsiDate.year} onChange={e => setShamsiDate({...shamsiDate, year: +e.target.value})} />
                            </div>
                        </div>
                    </div>

                    {/* GROUP 2: GOODS */}
                    <div className="lg:col-span-2 bg-white p-5 rounded-2xl border-2 border-gray-100 shadow-sm">
                        <div className="flex justify-between items-center mb-4">
                            <div className="flex items-center gap-2 text-gray-800 font-bold">
                                <Package size={18} className="text-orange-500"/>
                                <span>اقلام و کالاها</span>
                            </div>
                            <button type="button" onClick={() => setItems([...items, { id: generateUUID(), goodsName: '', cartonCount: 0, weight: 0 }])} className="text-xs bg-orange-50 text-orange-700 px-3 py-1.5 rounded-lg font-bold hover:bg-orange-100 transition-colors flex items-center gap-1">
                                <Plus size={14}/> افزودن ردیف
                            </button>
                        </div>
                        
                        <div className="space-y-3">
                            {items.map((item, idx) => (
                                <div key={item.id} className="flex flex-col sm:flex-row gap-3 items-end bg-gray-50 p-3 rounded-xl border border-gray-200">
                                    <div className="flex items-center justify-center bg-white w-8 h-8 rounded-full border text-xs font-bold text-gray-400 shrink-0 shadow-sm">{idx + 1}</div>
                                    <div className="flex-1 w-full">
                                        <label className="text-[10px] font-bold text-gray-500 block mb-1">نام کالا / محصول</label>
                                        <input className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:border-orange-500 outline-none bg-white" placeholder="مثال: لوله..." value={item.goodsName} onChange={e => { const n = [...items]; n[idx].goodsName = e.target.value; setItems(n); }} />
                                    </div>
                                    <div className="w-24 sm:w-28">
                                        <label className="text-[10px] font-bold text-gray-500 block mb-1 text-center">تعداد (کارتن)</label>
                                        <input type="number" className="w-full border border-gray-300 rounded-lg p-2 text-center font-bold outline-none bg-white" value={item.cartonCount} onChange={e => { const n = [...items]; n[idx].cartonCount = +e.target.value; setItems(n); }} />
                                    </div>
                                    <div className="w-24 sm:w-28">
                                        <label className="text-[10px] font-bold text-gray-500 block mb-1 text-center">وزن (KG)</label>
                                        <input type="number" className="w-full border border-gray-300 rounded-lg p-2 text-center font-bold outline-none bg-white" value={item.weight} onChange={e => { const n = [...items]; n[idx].weight = +e.target.value; setItems(n); }} />
                                    </div>
                                    {items.length > 1 && (
                                        <button type="button" onClick={() => setItems(items.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600 p-2">
                                            <Trash2 size={18}/>
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* GROUP 3: LOGISTICS */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white p-5 rounded-2xl border-2 border-gray-100 shadow-sm">
                        <div className="flex items-center gap-2 text-gray-800 font-bold mb-4 border-b pb-2">
                            <MapPin size={18} className="text-green-600"/>
                            <span>مقصد و گیرنده</span>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-gray-500 block mb-1">نام گیرنده</label>
                                <input className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm focus:bg-white focus:border-green-500 transition-colors outline-none" value={destinations[0].recipientName} onChange={e => { const d = [...destinations]; d[0].recipientName = e.target.value; setDestinations(d); }} placeholder="نام شخص یا شرکت..."/>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 block mb-1">آدرس دقیق</label>
                                <textarea className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm focus:bg-white focus:border-green-500 transition-colors outline-none h-24 resize-none" value={destinations[0].address} onChange={e => { const d = [...destinations]; d[0].address = e.target.value; setDestinations(d); }} placeholder="استان، شهر، خیابان..."/>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-5 rounded-2xl border-2 border-gray-100 shadow-sm">
                        <div className="flex items-center gap-2 text-gray-800 font-bold mb-4 border-b pb-2">
                            <Truck size={18} className="text-indigo-600"/>
                            <span>اطلاعات حمل (اختیاری)</span>
                        </div>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-500 block mb-1">نام راننده</label>
                                    <input className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm focus:bg-white focus:border-indigo-500 transition-colors outline-none" value={driverInfo.driverName} onChange={e => setDriverInfo({...driverInfo, driverName: e.target.value})} />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 block mb-1">پلاک خودرو</label>
                                    <input className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm focus:bg-white focus:border-indigo-500 transition-colors outline-none text-center dir-ltr font-mono" placeholder="12 A 345 67" value={driverInfo.plateNumber} onChange={e => setDriverInfo({...driverInfo, plateNumber: e.target.value})} />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 block mb-1">توضیحات تکمیلی</label>
                                <input className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm focus:bg-white focus:border-indigo-500 transition-colors outline-none" placeholder="یادداشت..." value={driverInfo.description} onChange={e => setDriverInfo({...driverInfo, description: e.target.value})} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Submit Action */}
                <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] md:static md:bg-transparent md:border-none md:shadow-none md:p-0 flex justify-end z-20">
                    <button 
                        type="submit" 
                        disabled={isSubmitting || !selectedCompany} 
                        className="w-full md:w-auto bg-slate-800 text-white px-8 py-4 rounded-xl font-bold shadow-lg shadow-slate-300 hover:bg-slate-700 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-70 disabled:transform-none"
                    >
                        {isSubmitting ? <Loader2 className="animate-spin" size={24}/> : <FileText size={24}/>}
                        <div className="text-right">
                            <div className="text-sm">ثبت نهایی حواله</div>
                            <div className="text-[10px] font-normal opacity-80">ارسال به کارتابل مدیرعامل</div>
                        </div>
                    </button>
                </div>

            </form>
        </div>
    );
};

export default CreateExitPermit;
