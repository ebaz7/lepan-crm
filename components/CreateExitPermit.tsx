
import React, { useState, useEffect } from 'react';
import { ExitPermit, ExitPermitStatus, User, ExitPermitItem, ExitPermitDestination, SystemSettings } from '../types';
import { saveExitPermit, getSettings } from '../services/storageService';
import { generateUUID, getCurrentShamsiDate, jalaliToGregorian } from '../constants';
import { apiCall } from '../services/apiService';
import { Save, Loader2, Truck, Package, MapPin, Hash, Plus, Trash2, ArrowLeft, ArrowRight, CheckCircle2, Calendar, RefreshCcw, User as UserIcon, Building2 } from 'lucide-react';

const CreateExitPermit: React.FC<{ onSuccess: () => void, currentUser: User }> = ({ onSuccess, currentUser }) => {
    const [step, setStep] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [permitNumber, setPermitNumber] = useState('');
    const [loadingNum, setLoadingNum] = useState(false);
    const [selectedCompany, setSelectedCompany] = useState('');
    const [availableCompanies, setAvailableCompanies] = useState<string[]>([]);
    
    const currentShamsi = getCurrentShamsiDate();
    const [shamsiDate, setShamsiDate] = useState({ year: currentShamsi.year, month: currentShamsi.month, day: currentShamsi.day });

    const [items, setItems] = useState<ExitPermitItem[]>([{ id: generateUUID(), goodsName: '', cartonCount: 0, weight: 0 }]);
    const [destinations, setDestinations] = useState<ExitPermitDestination[]>([{ id: generateUUID(), recipientName: '', address: '', phone: '' }]);
    const [driverInfo, setDriverInfo] = useState({ plateNumber: '', driverName: '', description: '' });

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
        setLoadingNum(true);
        apiCall<{ nextNumber: number }>(`/next-exit-permit-number?company=${encodeURIComponent(company)}&t=${Date.now()}`)
            .then(res => {
                if (res && res.nextNumber) setPermitNumber(res.nextNumber.toString());
                else setPermitNumber('1001');
            })
            .catch(() => setPermitNumber('1001'))
            .finally(() => setLoadingNum(false));
    };

    const handleCompanyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        setSelectedCompany(val);
        fetchNextNumber(val);
    };

    const handleSubmit = async () => {
        if (!permitNumber) return alert('شماره مجوز الزامی است');
        if (!selectedCompany) return alert('انتخاب شرکت الزامی است');
        
        const validItems = items.filter(i => i.goodsName.trim() !== '');
        if (validItems.length === 0) return alert('حداقل یک کالا وارد کنید');

        setIsSubmitting(true);
        try {
            let isoDate;
            try {
                const date = jalaliToGregorian(shamsiDate.year, shamsiDate.month, shamsiDate.day);
                isoDate = date.toISOString().split('T')[0];
            } catch (err) {
                isoDate = new Date().toISOString().split('T')[0]; 
            }
            
            const finalPermitNumber = parseInt(permitNumber.replace(/[^0-9]/g, '')) || 0;

            const newPermit: ExitPermit = {
                id: generateUUID(),
                permitNumber: finalPermitNumber,
                company: selectedCompany,
                date: isoDate,
                requester: currentUser.fullName,
                items: validItems,
                destinations: destinations.filter(d => d.recipientName.trim() !== ''),
                goodsName: validItems.map(i => i.goodsName).join('، '),
                recipientName: destinations[0].recipientName,
                cartonCount: validItems.reduce((acc, i) => acc + (Number(i.cartonCount) || 0), 0),
                weight: validItems.reduce((acc, i) => acc + (Number(i.weight) || 0), 0),
                plateNumber: driverInfo.plateNumber,
                driverName: driverInfo.driverName,
                description: driverInfo.description,
                status: ExitPermitStatus.PENDING_CEO,
                createdAt: Date.now()
            };

            await saveExitPermit(newPermit);
            onSuccess();
        } catch (e: any) {
            alert('خطا در ثبت نهایی مجوز خروج.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto bg-white md:rounded-[2.5rem] shadow-none md:shadow-2xl overflow-hidden animate-fade-in border-0 md:border border-gray-100 min-h-screen md:min-h-0 relative flex flex-col">
            <div className="bg-gradient-to-r from-gray-900 to-gray-800 p-6 text-white shrink-0">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-xl font-black">ثبت خروج کارخانه</h2>
                        <p className="text-xs text-gray-400 mt-1">مرحله {step} از 3</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    {[1, 2, 3].map(s => (
                        <div key={s} className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${step >= s ? 'bg-blue-500' : 'bg-gray-700'}`}></div>
                    ))}
                </div>
            </div>

            <div className="p-6 md:p-8 flex-1 overflow-y-auto pb-24">
                {step === 1 && (
                    <div className="space-y-6 animate-slide-up">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-sm font-black text-gray-700 flex items-center gap-2"><Building2 size={18} className="text-blue-500"/> شرکت صادر کننده</label>
                                <select required className="w-full border-2 border-gray-200 rounded-2xl p-4 bg-white font-bold" value={selectedCompany} onChange={handleCompanyChange}>
                                    <option value="">-- انتخاب شرکت --</option>
                                    {availableCompanies.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-black text-gray-700 flex items-center gap-2"><Hash size={18} className="text-blue-500"/> شماره سند خروج</label>
                                <div className="relative">
                                    <input required type="number" className="w-full border-2 border-gray-200 rounded-2xl p-4 bg-gray-50 font-mono font-bold text-blue-600" value={permitNumber} onChange={e => setPermitNumber(e.target.value)} />
                                    {loadingNum && <div className="absolute left-3 top-1/2 -translate-y-1/2"><Loader2 className="animate-spin text-blue-500"/></div>}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <div className="space-y-4 animate-slide-up">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="font-black text-gray-800 flex items-center gap-2 text-lg">لیست کالاها</h3>
                            <button onClick={() => setItems([...items, { id: generateUUID(), goodsName: '', cartonCount: 0, weight: 0 }])} className="px-4 py-2 bg-blue-100 text-blue-700 rounded-xl font-bold text-xs flex items-center gap-1"><Plus size={16}/> افزودن</button>
                        </div>
                        {items.map((item, idx) => (
                            <div key={item.id} className="bg-white p-4 rounded-3xl border-2 border-gray-100 shadow-sm relative group">
                                <div className="space-y-4">
                                    <input className="w-full border-b-2 border-gray-200 p-2 text-base font-bold" placeholder="نام کالا..." value={item.goodsName} onChange={e => { const n = [...items]; n[idx].goodsName = e.target.value; setItems(n); }} />
                                    <div className="grid grid-cols-2 gap-4">
                                        <input type="number" className="w-full bg-gray-50 rounded-xl p-3 text-center font-black" placeholder="تعداد" value={item.cartonCount || ''} onChange={e => { const n = [...items]; n[idx].cartonCount = +e.target.value; setItems(n); }} />
                                        <input type="number" className="w-full bg-gray-50 rounded-xl p-3 text-center font-black" placeholder="وزن" value={item.weight || ''} onChange={e => { const n = [...items]; n[idx].weight = +e.target.value; setItems(n); }} />
                                    </div>
                                </div>
                                {items.length > 1 && <button onClick={() => setItems(items.filter((_, i) => i !== idx))} className="absolute top-2 left-2 text-red-500"><Trash2 size={16}/></button>}
                            </div>
                        ))}
                    </div>
                )}

                {step === 3 && (
                    <div className="space-y-6 animate-slide-up">
                        <div className="bg-blue-50 p-5 rounded-[2rem] border border-blue-100 space-y-4">
                            <h3 className="font-black text-blue-800 flex items-center gap-2"><UserIcon size={20}/> مشخصات تحویل گیرنده</h3>
                            <input className="w-full bg-white rounded-xl p-3 text-sm font-bold shadow-sm" placeholder="نام گیرنده..." value={destinations[0].recipientName} onChange={e => { const d = [...destinations]; d[0].recipientName = e.target.value; setDestinations(d); }} />
                            <textarea className="w-full bg-white rounded-xl p-3 text-sm shadow-sm h-24" placeholder="آدرس دقیق مقصد..." value={destinations[0].address} onChange={e => { const d = [...destinations]; d[0].address = e.target.value; setDestinations(d); }} />
                        </div>
                    </div>
                )}
            </div>

            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 z-50 flex gap-3 safe-pb">
                {step > 1 && (
                    <button onClick={() => setStep(s => s - 1)} className="px-6 py-4 rounded-2xl bg-gray-100 text-gray-600 font-bold active:scale-95 transition-all">
                        <ArrowRight size={20}/>
                    </button>
                )}
                <button 
                    onClick={step === 3 ? handleSubmit : () => setStep(s => s + 1)} 
                    disabled={isSubmitting || !selectedCompany}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-4 rounded-2xl font-black text-lg shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
                >
                    {isSubmitting ? <Loader2 className="animate-spin" /> : (step === 3 ? 'ثبت نهایی خروج' : 'مرحله بعد')}
                    {step < 3 && !isSubmitting && <ArrowLeft size={20}/>}
                </button>
            </div>
        </div>
    );
};

export default CreateExitPermit;
