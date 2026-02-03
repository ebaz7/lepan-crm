
import React, { useState, useEffect } from 'react';
import { ExitPermit, ExitPermitStatus, User, ExitPermitItem, ExitPermitDestination, UserRole } from '../types';
import { saveExitPermit, getSettings } from '../services/storageService';
import { generateUUID, getCurrentShamsiDate, jalaliToGregorian } from '../constants';
import { apiCall } from '../services/apiService';
import { Save, Loader2, Truck, Package, MapPin, Plus, Trash2, Building2, Calendar, FileText, Send, CheckCircle2, User as UserIcon, AlertTriangle } from 'lucide-react';
import PrintExitPermit from './PrintExitPermit';
import { getUsers } from '../services/authService';

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

    const handleItemChange = (index: number, field: keyof ExitPermitItem, value: any) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: value };
        setItems(newItems);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
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

            await saveExitPermit(newPermit);
            
            // Render for Auto-Send
            setTempPermit(newPermit);
            
            setTimeout(async () => {
                const element = document.getElementById(`print-permit-create-${newPermit.id}`);
                if (element) {
                    try {
                        // @ts-ignore
                        const canvas = await window.html2canvas(element, { scale: 2, backgroundColor: '#ffffff' });
                        const base64 = canvas.toDataURL('image/png').split(',')[1];
                        
                        const users = await getUsers();
                        const ceo = users.find(u => u.role === UserRole.CEO && u.phoneNumber);
                        
                        if (ceo) {
                            let caption = `🚛 *درخواست مجوز خروج بار*\n`;
                            caption += `🔢 شماره: ${newPermit.permitNumber}\n`;
                            caption += `👤 درخواست کننده: ${newPermit.requester}\n`;
                            caption += `📦 گیرنده: ${newPermit.recipientName}\n`;
                            caption += `📝 اقلام: ${newPermit.items.length} ردیف\n\n`;
                            caption += `جهت تایید ارسال شد.`;

                            const targets = [{ type: 'whatsapp', id: ceo.phoneNumber }];
                            if (ceo.telegramChatId) targets.push({ type: 'telegram', id: ceo.telegramChatId });
                            if (ceo.baleChatId) targets.push({ type: 'bale', id: ceo.baleChatId });

                            await apiCall('/send-multichannel', 'POST', {
                                targets: targets,
                                message: caption,
                                mediaData: { data: base64, mimeType: 'image/png', filename: `Permit_Req_${newPermit.permitNumber}.png` }
                            });
                        }
                    } catch(e) { console.error("Auto send error", e); }
                }
                
                setIsSubmitting(false);
                onSuccess();
            }, 2000);

        } catch (e: any) {
            console.error(e);
            alert(`خطا در ثبت: ${e.message}`);
            setIsSubmitting(false);
        }
    };

    const months = [ 'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند' ];
    const years = Array.from({ length: 11 }, (_, i) => 1400 + i);
    const days = Array.from({ length: 31 }, (_, i) => i + 1);

    return (
        <div className="bg-gray-50 min-h-screen pb-32 animate-fade-in relative">
            {tempPermit && (
                <div className="hidden-print-export" style={{ position: 'absolute', top: '-9999px', left: '-9999px', width: '800px', zIndex: -1 }}>
                    <div id={`print-permit-create-${tempPermit.id}`}>
                        <PrintExitPermit permit={tempPermit} onClose={()=>{}} embed />
                    </div>
                </div>
            )}

            {/* Header Section */}
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-6 md:p-10 shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
                
                <div className="relative z-10 max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-4">
                        <div className="bg-white/10 p-4 rounded-2xl border border-white/20 backdrop-blur-sm">
                            <Truck size={32} className="text-blue-300"/>
                        </div>
                        <div>
                            <h2 className="text-2xl md:text-3xl font-black tracking-tight">صدور مجوز خروج</h2>
                            <p className="text-slate-400 text-sm mt-1">سامانه یکپارچه مدیریت لجستیک و فروش</p>
                        </div>
                    </div>
                    
                    <div className="bg-white/10 px-6 py-3 rounded-xl border border-white/10 backdrop-blur-sm text-center min-w-[150px]">
                        <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">شماره سند بعدی</div>
                        <div className="text-3xl font-mono font-black text-blue-300 tracking-widest">{permitNumber || '...'}</div>
                    </div>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="max-w-5xl mx-auto -mt-8 px-4 relative z-20 space-y-6">
                
                {/* 1. General Information Card */}
                <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 md:p-8">
                    <h3 className="text-gray-800 font-bold text-lg mb-6 flex items-center gap-2 border-b pb-3">
                        <FileText className="text-blue-600"/> اطلاعات عمومی
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-gray-700 flex items-center gap-1"><Building2 size={16}/> شرکت صادرکننده</label>
                            <div className="relative">
                                <select 
                                    className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl p-3 text-sm focus:border-blue-500 focus:bg-white transition-all appearance-none outline-none font-medium"
                                    value={selectedCompany} 
                                    onChange={handleCompanyChange}
                                >
                                    <option value="">انتخاب کنید...</option>
                                    {availableCompanies.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">▼</div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-bold text-gray-700 flex items-center gap-1"><Calendar size={16}/> تاریخ صدور</label>
                            <div className="flex gap-2 dir-ltr">
                                <select className="flex-1 bg-gray-50 border-2 border-gray-200 rounded-xl p-3 text-sm focus:border-blue-500 outline-none" value={shamsiDate.day} onChange={e => setShamsiDate({...shamsiDate, day: +e.target.value})}>{days.map(d => <option key={d} value={d}>{d}</option>)}</select>
                                <select className="flex-1 bg-gray-50 border-2 border-gray-200 rounded-xl p-3 text-sm focus:border-blue-500 outline-none" value={shamsiDate.month} onChange={e => setShamsiDate({...shamsiDate, month: +e.target.value})}>{months.map((m, i) => <option key={i} value={i+1}>{m}</option>)}</select>
                                <select className="flex-1 bg-gray-50 border-2 border-gray-200 rounded-xl p-3 text-sm focus:border-blue-500 outline-none" value={shamsiDate.year} onChange={e => setShamsiDate({...shamsiDate, year: +e.target.value})}>{years.map(y => <option key={y} value={y}>{y}</option>)}</select>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. Items Card */}
                <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 md:p-8">
                    <div className="flex justify-between items-center mb-6 border-b pb-3">
                        <h3 className="text-gray-800 font-bold text-lg flex items-center gap-2">
                            <Package className="text-orange-500"/> اقلام و کالاها
                        </h3>
                        <button type="button" onClick={() => setItems([...items, { id: generateUUID(), goodsName: '', cartonCount: 0, weight: 0 }])} className="text-xs bg-orange-50 text-orange-700 px-3 py-1.5 rounded-lg font-bold hover:bg-orange-100 transition-colors flex items-center gap-1 border border-orange-200">
                            <Plus size={14}/> افزودن ردیف
                        </button>
                    </div>

                    <div className="space-y-4">
                        {items.map((item, idx) => (
                            <div key={item.id} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end bg-gray-50 p-4 rounded-xl border border-gray-200 hover:border-orange-200 transition-colors relative group">
                                <div className="absolute -right-2 -top-2 bg-white border border-gray-200 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-gray-400 shadow-sm">{idx + 1}</div>
                                
                                <div className="md:col-span-6 space-y-1">
                                    <label className="text-[10px] font-bold text-gray-500 mr-1">شرح کالا</label>
                                    <input 
                                        className="w-full bg-white border border-gray-300 rounded-lg p-2.5 text-sm focus:border-orange-400 outline-none"
                                        placeholder="نام محصول..."
                                        value={item.goodsName}
                                        onChange={e => handleItemChange(idx, 'goodsName', e.target.value)}
                                    />
                                </div>
                                <div className="md:col-span-3 space-y-1">
                                    <label className="text-[10px] font-bold text-gray-500 mr-1">تعداد (کارتن/عدد)</label>
                                    <input 
                                        type="number"
                                        className="w-full bg-white border border-gray-300 rounded-lg p-2.5 text-sm text-center font-bold outline-none"
                                        value={item.cartonCount}
                                        onChange={e => handleItemChange(idx, 'cartonCount', e.target.value)}
                                    />
                                </div>
                                <div className="md:col-span-2 space-y-1">
                                    <label className="text-[10px] font-bold text-gray-500 mr-1">وزن (کیلوگرم)</label>
                                    <input 
                                        type="number"
                                        className="w-full bg-white border border-gray-300 rounded-lg p-2.5 text-sm text-center font-bold outline-none"
                                        value={item.weight}
                                        onChange={e => handleItemChange(idx, 'weight', e.target.value)}
                                    />
                                </div>
                                <div className="md:col-span-1 flex justify-center">
                                    {items.length > 1 && (
                                        <button type="button" onClick={() => setItems(items.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg transition-colors">
                                            <Trash2 size={18}/>
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 3. Logistics Card */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
                        <h3 className="text-gray-800 font-bold text-lg mb-6 flex items-center gap-2 border-b pb-3">
                            <MapPin className="text-green-600"/> مقصد و گیرنده
                        </h3>
                        <div className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-500 mr-1">نام گیرنده / مشتری</label>
                                <input 
                                    className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl p-3 text-sm focus:bg-white focus:border-green-500 outline-none transition-all"
                                    placeholder="شخص یا شرکت..."
                                    value={destinations[0].recipientName}
                                    onChange={e => { const d = [...destinations]; d[0].recipientName = e.target.value; setDestinations(d); }}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-500 mr-1">آدرس دقیق</label>
                                <textarea 
                                    className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl p-3 text-sm focus:bg-white focus:border-green-500 outline-none transition-all h-24 resize-none"
                                    placeholder="استان، شهر، خیابان، پلاک..."
                                    value={destinations[0].address}
                                    onChange={e => { const d = [...destinations]; d[0].address = e.target.value; setDestinations(d); }}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
                        <h3 className="text-gray-800 font-bold text-lg mb-6 flex items-center gap-2 border-b pb-3">
                            <Truck className="text-indigo-600"/> اطلاعات حمل
                        </h3>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-500 mr-1">نام راننده</label>
                                    <input 
                                        className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl p-3 text-sm focus:bg-white focus:border-indigo-500 outline-none transition-all"
                                        value={driverInfo.driverName}
                                        onChange={e => setDriverInfo({...driverInfo, driverName: e.target.value})}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-500 mr-1">پلاک خودرو</label>
                                    <input 
                                        className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl p-3 text-sm focus:bg-white focus:border-indigo-500 outline-none transition-all text-center dir-ltr font-mono placeholder:font-sans"
                                        placeholder="12 A 345 67"
                                        value={driverInfo.plateNumber}
                                        onChange={e => setDriverInfo({...driverInfo, plateNumber: e.target.value})}
                                    />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-500 mr-1">توضیحات تکمیلی</label>
                                <input 
                                    className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl p-3 text-sm focus:bg-white focus:border-indigo-500 outline-none transition-all"
                                    placeholder="یادداشت..."
                                    value={driverInfo.description}
                                    onChange={e => setDriverInfo({...driverInfo, description: e.target.value})}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Floating Action Button */}
                <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-gray-200 shadow-2xl z-50 flex justify-center md:justify-end">
                    <button 
                        type="submit" 
                        disabled={isSubmitting} 
                        className="w-full md:w-auto bg-slate-800 text-white px-8 py-3 rounded-xl font-bold shadow-lg hover:bg-slate-700 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-70 disabled:transform-none min-w-[250px]"
                    >
                        {isSubmitting ? <Loader2 className="animate-spin" size={24}/> : <Send size={24}/>}
                        <div className="text-right">
                            <div className="text-sm">ثبت نهایی و ارسال به مدیرعامل</div>
                            <div className="text-[10px] font-normal opacity-70">شروع چرخه تایید</div>
                        </div>
                    </button>
                </div>

            </form>
        </div>
    );
};
export default CreateExitPermit;
