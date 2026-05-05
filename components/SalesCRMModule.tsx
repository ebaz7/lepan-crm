import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Upload, Download, Gift, Save, X, FileText } from 'lucide-react';
import { SalesContact, BirthdayGreetingTemplate } from '../types';
import { apiCall } from '../services/apiService';
import { getSettings, saveSettings } from '../services/storageService';
import * as XLSX from 'xlsx';

export default function SalesCRMModule() {
    const [contacts, setContacts] = useState<SalesContact[]>([]);
    const [botSubscribers, setBotSubscribers] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<'contacts' | 'bot_leads'>('contacts');
    const [template, setTemplate] = useState<BirthdayGreetingTemplate>({ text: 'تولدت مبارک عزیز!', isActive: true });
    
    const fetchData = async () => {
        getSettings().then(s => {
            if (s.salesContacts) setContacts(s.salesContacts);
            if (s.birthdayGreetingTemplate) setTemplate(s.birthdayGreetingTemplate);
        });
        try {
            const subs = await apiCall<any[]>('/bot-subscribers');
            setBotSubscribers(subs);
        } catch (e) {}
    };

    useEffect(() => {
        fetchData();
    }, []);

    const updateContacts = async (newContacts: SalesContact[]) => {
        setContacts(newContacts);
        const s = await getSettings();
        await saveSettings({ ...s, salesContacts: newContacts });
    };

    const handleDeleteBotSub = async (id: string) => {
        if (!confirm('آیا از حذف این عضو اطمینان دارید؟')) return;
        try {
            await apiCall(`/bot-subscribers/${id}`, 'DELETE');
            fetchData();
        } catch (e) {
            alert('خطا در حذف عضو');
        }
    };

    const updateTemplate = async (newTemplate: BirthdayGreetingTemplate) => {
        setTemplate(newTemplate);
        const s = await getSettings();
        await saveSettings({ ...s, birthdayGreetingTemplate: newTemplate });
    };

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

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws);

                if (!confirm(`آیا از وارد کردن ${data.length} مخاطب اطمینان دارید؟`)) return;

                const newContacts = [...contacts];
                data.forEach((row: any) => {
                    const mobile = String(row['موبایل'] || row['Mobile'] || '').trim();
                    const name = String(row['نام'] || row['Name'] || '').trim();
                    if (mobile && name) {
                        newContacts.push({
                            id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                            name,
                            mobile,
                            telegramId: String(row['تلگرام'] || row['Telegram'] || ''),
                            baleId: String(row['بله'] || row['Bale'] || ''),
                            birthday: String(row['تاریخ تولد'] || row['Birthday'] || ''),
                            sendBirthdayGreeting: true
                        });
                    }
                });
                await updateContacts(newContacts);
                alert(`${data.length} مخاطب با موفقیت وارد شد.`);
            } catch (err) {
                console.error(err);
                alert('خطا در پردازش فایل');
            }
        };
        reader.readAsBinaryString(file);
        e.target.value = '';
    };

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingContact, setEditingContact] = useState<SalesContact | null>(null);
    const [formData, setFormData] = useState<Partial<SalesContact>>({ name: '', mobile: '', birthday: '' });

    // Handler to open modal for new contact
    const handleAddManualContact = () => {
        setEditingContact(null);
        setFormData({ name: '', mobile: '', birthday: '', sendBirthdayGreeting: true });
        setIsModalOpen(true);
    };

    // Handler to open modal for editing
    const handleEditContact = (contact: SalesContact) => {
        setEditingContact(contact);
        setFormData(contact);
        setIsModalOpen(true);
    };

    const handleSaveContact = () => {
        if (!formData.name || !formData.mobile) {
            alert('لطفاً نام و شماره موبایل را وارد کنید');
            return;
        }

        if (editingContact) {
            updateContacts(contacts.map(c => c.id === editingContact.id ? { ...editingContact, ...formData } as SalesContact : c));
        } else {
            const newContact: SalesContact = {
                id: Date.now().toString(),
                ...formData as SalesContact
            };
            updateContacts([...contacts, newContact]);
        }
        setIsModalOpen(false);
    };

    const handleDeleteContact = (id: string) => {
        if (confirm('آیا از حذف این مخاطب اطمینان دارید؟')) {
            updateContacts(contacts.filter(c => c.id !== id));
        }
    };

    const downloadSample = () => {
        const sampleData = [
            { 'نام': 'علی محمدی', 'موبایل': '09121234567', 'تلگرام': '', 'بله': '', 'تاریخ تولد': '1370/05/20' },
            { 'نام': 'رضا علوی', 'موبایل': '09191234567', 'تلگرام': 'reza_alavi', 'بله': 'reza_bale', 'تاریخ تولد': '1365/10/12' }
        ];
        const ws = XLSX.utils.json_to_sheet(sampleData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Contacts");
        XLSX.writeFile(wb, "Sample_Contacts.xlsx");
    };

    const handleSaveTemplate = () => {
        updateTemplate(template);
        alert('متن تبریک ذخیره شد.');
    };

    const [broadcastMessage, setBroadcastMessage] = useState('');
    const [broadcastTarget, setBroadcastTarget] = useState<'users' | 'contacts' | 'all_subscribers'>('all_subscribers');
    const [isBroadcasting, setIsBroadcasting] = useState(false);

    const handleBroadcast = async () => {
        if (!broadcastMessage.trim()) {
            alert('لطفا متن پیام را وارد کنید.');
            return;
        }
        setIsBroadcasting(true);
        try {
            const res = await apiCall<{count: number}>('/bot/broadcast', 'POST', { 
                message: broadcastMessage,
                target: broadcastTarget
            });
            alert(`پیام همگانی با موفقیت به ${res.count} چت/کاربر ارسال شد.`);
            setBroadcastMessage('');
        } catch (e) {
            alert('خطا در ارسال پیام همگانی');
        } finally {
            setIsBroadcasting(false);
        }
    };

    return (
        <div className="p-6 space-y-6">
            <h2 className="text-2xl font-black text-gray-800">مدیریت مخاطبین فروش</h2>
            
            {/* Tabs for Navigation */}
            <div className="flex border-b border-gray-200">
                <button 
                    onClick={() => setActiveTab('contacts')}
                    className={`px-6 py-3 font-bold text-sm transition-all border-b-2 ${activeTab === 'contacts' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400'}`}
                >
                    👥 لیست مخاطبین فروش
                </button>
                <button 
                    onClick={() => setActiveTab('bot_leads')}
                    className={`px-6 py-3 font-bold text-sm transition-all border-b-2 ${activeTab === 'bot_leads' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400'}`}
                >
                    🤖 لیدهای جمع‌آوری شده از ربات
                </button>
            </div>

            {activeTab === 'contacts' ? (
                <>
                    {/* Bulk Messaging */}
                    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                        <h3 className="font-bold text-lg mb-4">ارسال پیام همگانی به مشتریان</h3>
                        <div className="space-y-4">
                            <div className="flex gap-4 mb-2">
                                <label className="flex items-center gap-2 text-sm cursor-pointer border p-2 rounded-xl bg-gray-50 flex-1 justify-center">
                                    <input type="radio" checked={broadcastTarget === 'all_subscribers'} onChange={() => setBroadcastTarget('all_subscribers')} />
                                    <span>همه اعضای ربات</span>
                                </label>
                                <label className="flex items-center gap-2 text-sm cursor-pointer border p-2 rounded-xl bg-gray-50 flex-1 justify-center">
                                    <input type="radio" checked={broadcastTarget === 'users'} onChange={() => setBroadcastTarget('users')} />
                                    <span>فقط کارکنان</span>
                                </label>
                                <label className="flex items-center gap-2 text-sm cursor-pointer border p-2 rounded-xl bg-gray-50 flex-1 justify-center">
                                    <input type="radio" checked={broadcastTarget === 'contacts'} onChange={() => setBroadcastTarget('contacts')} />
                                    <span>فقط لیست مشتریان</span>
                                </label>
                            </div>
                            <textarea 
                                className="w-full p-3 border rounded-xl"
                                rows={3}
                                placeholder="متن پیام همگانی..."
                                value={broadcastMessage}
                                onChange={e => setBroadcastMessage(e.target.value)}
                                disabled={isBroadcasting}
                            />
                            <button disabled={isBroadcasting} onClick={handleBroadcast} className={`flex items-center gap-2 text-white px-4 py-2 rounded-xl font-bold transition-colors ${isBroadcasting ? 'bg-purple-400' : 'bg-purple-600 hover:bg-purple-700'}`}>
                                <Save size={18}/> {isBroadcasting ? 'در حال ارسال...' : 'ارسال به همه بر اساس فیلتر'}
                            </button>
                            <p className="text-[10px] text-gray-400">نکته: پیام همگانی به پلتفرم‌هایی که کاربر در آن عضو است (تلگرام/بله) ارسال می‌شود.</p>
                        </div>
                    </div>

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
                            <label className="flex items-center gap-2 text-sm">
                                <input type="checkbox" checked={template.isActive} onChange={e => setTemplate({...template, isActive: e.target.checked})} />
                                فعال‌سازی ارسال خودکار تبریک
                            </label>
                            <button onClick={handleSaveTemplate} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-blue-700">
                                <Save size={18}/> ذخیره متن
                            </button>
                        </div>
                    </div>

                    {/* Contacts Table / Cards */}
                    <div className="bg-white p-4 md:p-6 rounded-2xl border border-gray-200 shadow-sm">
                            <div className="flex flex-wrap gap-2 w-full md:w-auto">
                                <label className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-emerald-100 text-emerald-700 px-4 py-2 rounded-xl font-bold cursor-pointer hover:bg-emerald-200 border border-emerald-200">
                                     <Upload size={18}/> ایمپورت اکسل
                                     <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
                                </label>
                                <button onClick={downloadSample} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-gray-100 px-4 py-2 rounded-xl font-bold hover:bg-gray-200 border"><Download size={18}/> نمونه اکسل</button>
                                <button onClick={exportContacts} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-gray-100 px-4 py-2 rounded-xl font-bold hover:bg-gray-200 border"><Download size={18}/> اکسپورت</button>
                                <button onClick={handleAddManualContact} className="w-full md:w-auto flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-100"><Plus size={18}/> افزودن دستی</button>
                            </div>

                        {/* Desktop View */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-sm text-right">
                                <thead>
                                    <tr className="border-b bg-gray-50 text-gray-500">
                                        <th className="p-4 font-bold text-right">نام مشتری</th>
                                        <th className="p-4 font-bold text-center">شماره موبایل</th>
                                        <th className="p-4 font-bold text-center">تاریخ تولد</th>
                                        <th className="p-4 font-bold text-center">تبریک تولد</th>
                                        <th className="p-4 font-bold text-center">عملیات</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {contacts.map(c => (
                                        <tr key={c.id} className="border-b hover:bg-gray-50 transition-colors">
                                            <td className="p-4 font-bold text-gray-800">{c.name}</td>
                                            <td className="p-4 text-center font-mono">{c.mobile}</td>
                                            <td className="p-4 text-center">{c.birthday || '-'}</td>
                                            <td className="p-4 text-center">
                                                {c.sendBirthdayGreeting ? 
                                                    <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-[10px] font-bold">فعال</span> : 
                                                    <span className="bg-gray-100 text-gray-400 px-3 py-1 rounded-full text-[10px] font-bold">غیرفعال</span>
                                                }
                                            </td>
                                            <td className="p-4">
                                                <div className="flex justify-center gap-2">
                                                    <button onClick={() => handleEditContact(c)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Edit2 size={16}/></button>
                                                    <button onClick={() => handleDeleteContact(c.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={16}/></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {contacts.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-gray-400 italic font-medium">هیچ مخاطبی ثبت نشده است.</td></tr>}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile View */}
                        <div className="md:hidden space-y-4">
                            {contacts.map(c => (
                                <div key={c.id} className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex justify-between items-center group">
                                    <div>
                                        <div className="font-bold text-gray-800">{c.name}</div>
                                        <div className="text-xs text-gray-500 font-mono mt-1">{c.mobile}</div>
                                        {c.birthday && <div className="text-[10px] text-gray-400 mt-1">تولد: {c.birthday}</div>}
                                    </div>
                                    <div className="flex gap-1">
                                        <button onClick={() => handleEditContact(c)} className="p-2 text-blue-600 bg-white rounded-xl shadow-sm"><Edit2 size={16}/></button>
                                        <button onClick={() => handleDeleteContact(c.id)} className="p-2 text-red-600 bg-white rounded-xl shadow-sm"><Trash2 size={16}/></button>
                                    </div>
                                </div>
                            ))}
                            {contacts.length === 0 && <div className="p-8 text-center text-gray-400 italic text-sm">لیست خالی است.</div>}
                        </div>
                    </div>
                </>
            ) : (
                <div className="bg-white p-4 md:p-6 rounded-2xl border border-gray-200 shadow-sm animate-fade-in">
                    <h3 className="font-bold text-lg mb-6">لیست لیدهای ربات (اعضای جدید)</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-right">
                            <thead>
                                <tr className="border-b bg-gray-50 text-gray-500">
                                    <th className="p-4 font-bold text-right">نام ثبت شده</th>
                                    <th className="p-4 font-bold text-center">شماره موبایل</th>
                                    <th className="p-4 font-bold text-center">تاریخ تولد</th>
                                    <th className="p-4 font-bold text-center">پلتفرم</th>
                                    <th className="p-4 font-bold text-center">شناسه چت</th>
                                    <th className="p-4 font-bold text-center">عملیات</th>
                                </tr>
                            </thead>
                            <tbody>
                                {botSubscribers.map(sub => (
                                    <tr key={sub.id} className="border-b hover:bg-gray-50">
                                        <td className="p-4 font-bold text-gray-800">{sub.fullName || '(بدون نام)'}</td>
                                        <td className="p-4 text-center font-mono">{sub.mobile || '-'}</td>
                                        <td className="p-4 text-center">{sub.birthday || '-'}</td>
                                        <td className="p-4 text-center">
                                            {sub.platform === 'telegram' ? 
                                                <span className="text-blue-500 font-bold">تلگرام</span> : 
                                                <span className="text-emerald-500 font-bold">بله</span>
                                            }
                                        </td>
                                        <td className="p-4 text-center font-mono text-[10px] text-gray-400">
                                            {sub.telegramChatId || sub.baleChatId || sub.chatId}
                                        </td>
                                        <td className="p-4">
                                            <div className="flex justify-center gap-2">
                                                <button onClick={() => handleDeleteBotSub(sub.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={16}/></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {botSubscribers.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-gray-400 italic">هیچ لیدی هنوز از ربات جمع‌آوری نشده است.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-scale-in">
                        <div className="bg-blue-600 p-4 text-white flex justify-between items-center">
                            <h3 className="font-bold text-lg">{editingContact ? 'ویرایش مخاطب' : 'افزودن مخاطب جدید'}</h3>
                            <button onClick={() => setIsModalOpen(false)} className="p-1 hover:bg-white/20 rounded-lg"><X size={20}/></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">نام و نام خانوادگی *</label>
                                <input 
                                    className="w-full border-2 border-gray-100 rounded-xl p-3 focus:border-blue-500 outline-none transition-all font-bold"
                                    value={formData.name}
                                    onChange={e => setFormData({...formData, name: e.target.value})}
                                    placeholder="مثلا: علی محمدی"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">شماره موبایل *</label>
                                <input 
                                    className="w-full border-2 border-gray-100 rounded-xl p-3 focus:border-blue-500 outline-none transition-all dir-ltr text-right font-mono font-bold"
                                    value={formData.mobile}
                                    onChange={e => setFormData({...formData, mobile: e.target.value})}
                                    placeholder="۰۹۱۲..."
                                />
                            </div>
                            <div className="grid grid-cols-1 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">تاریخ تولد (شمسی)</label>
                                    <div className="flex gap-2" dir="ltr">
                                        <select 
                                            className="flex-1 border-2 border-gray-100 rounded-xl p-2 text-sm outline-none focus:border-blue-500"
                                            value={formData.birthday?.split('/')[2] || ''}
                                            onChange={e => {
                                                const parts = (formData.birthday || '1370/01/01').split('/');
                                                parts[2] = e.target.value.padStart(2, '0');
                                                setFormData({...formData, birthday: parts.join('/')});
                                            }}
                                        >
                                            <option value="">روز</option>
                                            {Array.from({length: 31}, (_, i) => (i + 1).toString().padStart(2, '0')).map(d => <option key={d} value={d}>{d}</option>)}
                                        </select>
                                        <select 
                                            className="flex-1 border-2 border-gray-100 rounded-xl p-2 text-sm outline-none focus:border-blue-500"
                                            value={formData.birthday?.split('/')[1] || ''}
                                            onChange={e => {
                                                const parts = (formData.birthday || '1370/01/01').split('/');
                                                parts[1] = e.target.value.padStart(2, '0');
                                                setFormData({...formData, birthday: parts.join('/')});
                                            }}
                                        >
                                            <option value="">ماه</option>
                                            {Array.from({length: 12}, (_, i) => (i + 1).toString().padStart(2, '0')).map(m => <option key={m} value={m}>{m}</option>)}
                                        </select>
                                        <input 
                                            type="number"
                                            className="w-20 border-2 border-gray-100 rounded-xl p-2 text-sm outline-none focus:border-blue-500 text-center font-mono"
                                            placeholder="سال"
                                            value={formData.birthday?.split('/')[0] || ''}
                                            onChange={e => {
                                                const parts = (formData.birthday || '1370/01/01').split('/');
                                                parts[0] = e.target.value;
                                                setFormData({...formData, birthday: parts.join('/')});
                                            }}
                                        />
                                    </div>
                                </div>
                                <div className="flex flex-col justify-end">
                                    <label className="flex items-center gap-2 text-xs font-bold text-gray-600 cursor-pointer select-none mb-2">
                                        <input 
                                            type="checkbox" 
                                            checked={formData.sendBirthdayGreeting} 
                                            onChange={e => setFormData({...formData, sendBirthdayGreeting: e.target.checked})}
                                        />
                                        ارسال خودکار پیام تبریک به این مخاطب
                                    </label>
                                </div>
                            </div>
                            <div className="pt-4 flex gap-3">
                                <button 
                                    onClick={handleSaveContact}
                                    className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
                                >
                                    ذخیره مخاطب
                                </button>
                                <button 
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-6 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200"
                                >
                                    انصراف
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
