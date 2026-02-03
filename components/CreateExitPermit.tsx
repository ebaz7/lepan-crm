import React, { useState, useEffect } from 'react';
import { ExitPermit, ExitPermitStatus, User, ExitPermitItem, ExitPermitDestination, UserRole } from '../types';
import { saveExitPermit, getSettings } from '../services/storageService';
import { generateUUID, getCurrentShamsiDate, jalaliToGregorian } from '../constants';
import { apiCall } from '../services/apiService';
import { Save, Loader2, Truck, Package, MapPin, Plus, Trash2, Building2, Calendar, Send } from 'lucide-react';
import PrintExitPermit from './PrintExitPermit';
import { getUsers } from '../services/authService';

const CreateExitPermit: React.FC<{ onSuccess: () => void, currentUser: User }> = ({ onSuccess, currentUser }) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [permitNumber, setPermitNumber] = useState('');
    const [selectedCompany, setSelectedCompany] = useState('');
    const [availableCompanies, setAvailableCompanies] = useState<string[]>([]);
    const [shamsiDate, setShamsiDate] = useState({ year: 1403, month: 1, day: 1 });
    const [items, setItems] = useState<ExitPermitItem[]>([{ id: generateUUID(), goodsName: '', cartonCount: 0, weight: 0 }]);
    const [destinations, setDestinations] = useState<ExitPermitDestination[]>([{ id: generateUUID(), recipientName: '', address: '', phone: '' }]);
    const [driverInfo, setDriverInfo] = useState({ plateNumber: '', driverName: '', description: '' });
    const [tempPermit, setTempPermit] = useState<ExitPermit | null>(null);

    useEffect(() => {
        getSettings().then(s => {
            setAvailableCompanies(s.companies?.map(c => c.name) || s.companyNames || []);
            setSelectedCompany(s.defaultCompany || '');
        });
        apiCall<{ nextNumber: number }>('/next-exit-permit-number').then(res => {
            if (res && res.nextNumber) setPermitNumber(res.nextNumber.toString());
        });
        const now = getCurrentShamsiDate();
        setShamsiDate({ year: now.year, month: now.month, day: now.day });
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
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
            plateNumber: driverInfo.plateNumber,
            driverName: driverInfo.driverName,
            description: driverInfo.description,
            status: ExitPermitStatus.PENDING_CEO,
            createdAt: Date.now()
        };

        try {
            await saveExitPermit(newPermit);
            setTempPermit(newPermit);

            setTimeout(async () => {
                const element = document.getElementById(`print-permit-capture-new`);
                if (element) {
                    // @ts-ignore
                    const canvas = await window.html2canvas(element, { scale: 2, backgroundColor: '#ffffff' });
                    const base64 = canvas.toDataURL('image/png').split(',')[1];
                    const allUsers = await getUsers();
                    const ceo = allUsers.find(u => u.role === UserRole.CEO && u.phoneNumber);
                    
                    if (ceo) {
                        const targets = [{ type: 'whatsapp', id: ceo.phoneNumber }];
                        if (ceo.telegramChatId) targets.push({ type: 'telegram', id: ceo.telegramChatId });
                        if (ceo.baleChatId) targets.push({ type: 'bale', id: ceo.baleChatId });

                        const caption = `🆕 *درخواست جدید خروج کالا*\n🔢 شماره: ${newPermit.permitNumber}\n👤 ثبت توسط: ${newPermit.requester}\n📦 گیرنده: ${newPermit.recipientName}\n\nجهت تایید نهایی بررسی نمایید.`;
                        await apiCall('/send-multichannel', 'POST', { targets, message: caption, mediaData: { data: base64, mimeType: 'image/png', filename: `Permit_${newPermit.permitNumber}.png` } });
                    }
                }
                setIsSubmitting(false);
                onSuccess();
            }, 1500);
        } catch (error) {
            console.error(error);
            alert('خطا در ثبت نهایی');
            setIsSubmitting(false);
        }
    };

    return (
        <div className="bg-gray-50 min-h-screen pb-32 animate-fade-in relative">
            {tempPermit && (
                <div className="fixed -left-[3000px] top-0">
                    <div id="print-permit-capture-new">
                        <PrintExitPermit permit={tempPermit} onClose={()=>{}} embed />
                    </div>
                </div>
            )}
            <div className="bg-slate-900 text-white p-8 md:p-12 shadow-2xl relative overflow-hidden">
                <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6 relative z-10">
                    <div className="flex items-center gap-4">
                        <div className="bg-white/10 p-4 rounded-3xl border border-white/20 backdrop-blur-md"><Truck size={36} className="text-blue-400"/></div>
                        <div><h2 className="text-3xl font-black">صدور درخواست خروج</h2><p className="text-slate-400 text-sm mt-1">مدیریت هوشمند لجستیک کارخانه</p></div>
                    </div>
                    <div className="bg-white/10 px-8 py-4 rounded-3xl border border-white/10 text-center backdrop-blur-md shadow-inner">
                        <div className="text-[10px] font-black uppercase text-slate-400 mb-1">شماره سند بعدی</div>
                        <div className="text-4xl font-mono font-black text-blue-400">{permitNumber}</div>
                    </div>
                </div>
            </div>
            <form onSubmit={handleSubmit} className="max-w-5xl mx-auto -mt-10 px-4 relative z-20 space-y-6">
                <div className="bg-white rounded-[2.5rem] shadow-2xl p-8 border border-slate-100">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-1">
                            <label className="text-xs font-black text-slate-400 mr-2">شرکت صادرکننده</label>
                            <select className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-bold" value={selectedCompany} onChange={e => setSelectedCompany(e.target.value)} required>
                                <option value="">انتخاب کنید...</option>
                                {availableCompanies.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-black text-slate-400 mr-2">نام گیرنده</label>
                            <input className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-bold" value={destinations[0].recipientName} onChange={e => { const d = [...destinations]; d[0].recipientName = e.target.value; setDestinations(d); }} required />
                        </div>
                        <div className="space-y-1 md:col-span-2">
                            <label className="text-xs font-black text-slate-400 mr-2">شرح کالا</label>
                            <input className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-bold" value={items[0].goodsName} onChange={e => { const i = [...items]; i[0].goodsName = e.target.value; setItems(i); }} required />
                        </div>
                    </div>
                </div>
                <button type="submit" disabled={isSubmitting} className="w-full bg-slate-900 text-white py-6 rounded-[2rem] font-black text-xl shadow-2xl flex items-center justify-center gap-3 hover:bg-slate-800 transition-all disabled:opacity-70">
                    {isSubmitting ? <Loader2 className="animate-spin" size={24}/> : <Send size={24}/>}
                    ثبت و ارسال به مدیرعامل
                </button>
            </form>
        </div>
    );
};
export default CreateExitPermit;