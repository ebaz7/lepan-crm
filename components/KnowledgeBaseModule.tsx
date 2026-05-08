import React, { useState } from 'react';
import { User, SystemSettings, KnowledgeBaseItem } from '../types';
import { BookOpen, Copy, Share2, Check, ExternalLink, Plus, X, Edit2, Trash2 } from 'lucide-react';
import { getRolePermissions } from '../services/authService';
import { saveSettings } from '../services/storageService';

interface KnowledgeBaseModuleProps {
    currentUser: User;
    settings: SystemSettings | null;
    onUpdateSettings: (settings: SystemSettings) => void;
}

const KnowledgeBaseModule: React.FC<KnowledgeBaseModuleProps> = ({ currentUser, settings, onUpdateSettings }) => {
    const permissions = settings ? getRolePermissions(currentUser.role, settings, currentUser) : {};
    const canManage = currentUser.role === 'admin' || permissions.canManageKnowledgeBase === true;
    
    const companies = settings?.companies || [];
    const customItems = settings?.knowledgeBaseItems || [];
    
    const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({});
    
    // Custom Notes Modal state
    const [showModal, setShowModal] = useState(false);
    const [editingItem, setEditingItem] = useState<KnowledgeBaseItem | null>(null);
    const [titleStr, setTitleStr] = useState('');
    const [contentStr, setContentStr] = useState('');

    // Company/Person Modal state
    const [showCompanyModal, setShowCompanyModal] = useState(false);
    const [editingCompany, setEditingCompany] = useState<any | null>(null);

    const handleCopy = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopiedStates({ ...copiedStates, [id]: true });
        setTimeout(() => setCopiedStates({ ...copiedStates, [id]: false }), 2000);
    };

    const handleShare = (text: string, title?: string) => {
        if (navigator.share) {
            navigator.share({
                title: title || 'اطلاعات سیستم',
                text: text
            }).catch(console.error);
        } else {
            const encodedText = encodeURIComponent(text);
            window.open(`https://wa.me/?text=${encodedText}`, '_blank');
        }
    };

    const downloadAsTxt = (text: string, filename: string) => {
        const element = document.createElement("a");
        const file = new Blob([text], {type: 'text/plain;charset=utf-8'});
        element.href = URL.createObjectURL(file);
        element.download = `${filename}.txt`;
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
    };

    const downloadAsPdf = (company: any) => {
        const printWindow = window.open('', '_blank');
        if(!printWindow) return;
        
        let html = `
        <html dir="rtl">
        <head>
            <title>اطلاعات ${company.name}</title>
            <style>
                body { font-family: Tahoma, Arial, sans-serif; padding: 40px; color: #333; line-height: 1.6; }
                h1 { color: #1e3a8a; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px; }
                .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
                .info-item { background: #f9fafb; padding: 15px; border-radius: 8px; font-weight: bold; }
                .label { font-size: 12px; color: #6b7280; display: block; margin-bottom: 5px; }
                h2 { color: #b45309; border-bottom: 1px solid #fef3c7; padding-bottom: 5px; margin-top: 30px; }
                .bank-card { background: #fffbeb; padding: 15px; border: 1px solid #fde68a; border-radius: 8px; margin-bottom: 15px; }
                .bank-name { font-size: 18px; font-weight: bold; color: #92400e; margin-bottom: 10px; }
                .bank-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-weight: bold;}
                .bank-row font { font-family: monospace; font-size: 16px; }
            </style>
        </head>
        <body>
            <h1>${company.name}</h1>
            <div class="info-grid">
                ${company.nationalId ? `<div class="info-item"><span class="label">شناسه ملی</span>${company.nationalId}</div>` : ''}
                ${company.registrationNumber ? `<div class="info-item"><span class="label">شماره ثبت</span>${company.registrationNumber}</div>` : ''}
                ${company.phone ? `<div class="info-item"><span class="label">تلفن تماس</span>${company.phone}</div>` : ''}
                ${company.address ? `<div class="info-item"><span class="label">آدرس</span>${company.address}</div>` : ''}
            </div>
        `;

        if (company.banks && company.banks.length > 0) {
            html += `<h2>اطلاعات حساب‌های بانکی</h2>`;
            company.banks.forEach((b: any) => {
                html += `<div class="bank-card">
                    <div class="bank-name">بانک ${b.bankName}</div>
                    <div class="bank-row"><span>شماره حساب:</span> <font>${b.accountNumber}</font></div>
                    ${b.cardNumber ? `<div class="bank-row"><span>شماره کارت:</span> <font>${b.cardNumber}</font></div>` : ''}
                    ${b.sheba ? `<div class="bank-row"><span>شماره شبا:</span> <font dir="ltr">IR${b.sheba.replace(/^IR/i, '')}</font></div>` : ''}
                </div>`;
            });
        }

        html += `</body></html>`;
        printWindow.document.write(html);
        printWindow.document.close();
        
        // Wait for styles to load then print
        setTimeout(() => {
            printWindow.print();
        }, 500);
    };

    const handleSaveItem = async () => {
        if (!titleStr.trim() || !settings) return;
        const now = new Date().toISOString();
        let newItems = [...customItems];
        if (editingItem) {
            newItems = newItems.map(item => item.id === editingItem.id ? { ...item, title: titleStr, content: contentStr, updatedAt: now } : item);
        } else {
            newItems.unshift({ id: Date.now().toString(), title: titleStr, content: contentStr, createdAt: now, updatedAt: now });
        }
        
        const updatedSettings = { ...settings, knowledgeBaseItems: newItems };
        await saveSettings(updatedSettings);
        onUpdateSettings(updatedSettings);
        closeModal();
    };

    const handleDeleteItem = async (id: string) => {
        if (!settings || !window.confirm('آیا از حذف این یادداشت اطمینان دارید؟')) return;
        const newItems = customItems.filter(item => item.id !== id);
        const updatedSettings = { ...settings, knowledgeBaseItems: newItems };
        await saveSettings(updatedSettings);
        onUpdateSettings(updatedSettings);
    };

    const openModal = (item?: KnowledgeBaseItem) => {
        if (item) {
            setEditingItem(item);
            setTitleStr(item.title);
            setContentStr(item.content);
        } else {
            setEditingItem(null);
            setTitleStr('');
            setContentStr('');
        }
        setShowModal(true);
    };

    const openCompanyModal = (company?: any) => {
        if (company) {
            setEditingCompany(JSON.parse(JSON.stringify(company)));
        } else {
            setEditingCompany({
                id: Date.now().toString(),
                name: '',
                nationalId: '',
                registrationNumber: '',
                phone: '',
                address: '',
                banks: []
            });
        }
        setShowCompanyModal(true);
    };

    const handleSaveCompany = async () => {
        if (!editingCompany || !editingCompany.name.trim() || !settings) return;
        const newCompanies = [...companies];
        const existingIdx = newCompanies.findIndex(c => c.id === editingCompany.id);
        
        if (existingIdx >= 0) {
            newCompanies[existingIdx] = editingCompany;
        } else {
            newCompanies.unshift(editingCompany);
        }
        
        const updatedSettings = { ...settings, companies: newCompanies };
        await saveSettings(updatedSettings);
        onUpdateSettings(updatedSettings);
        setShowCompanyModal(false);
    };
    
    const handleDeleteCompany = async (id: string) => {
        if (!settings || !window.confirm('آیا از حذف این شرکت/شخص اطمینان دارید؟')) return;
        const newCompanies = companies.filter(c => c.id !== id);
        const updatedSettings = { ...settings, companies: newCompanies };
        await saveSettings(updatedSettings);
        onUpdateSettings(updatedSettings);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingItem(null);
    };

    if (companies.length === 0 && customItems.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center p-6 animate-fade-in relative">
                <div className="bg-blue-100 p-4 rounded-full text-blue-600 mb-4 shadow-sm"><BookOpen size={48}/></div>
                <h2 className="text-xl font-bold text-gray-800 mb-2">اطلاعاتی یافت نشد</h2>
                <p className="text-gray-600 max-w-md leading-relaxed">هنوز هیچ شرکتی یا در تنظیمات تعریف نشده یا اطلاعاتی اضافه نشده است.</p>
                {canManage && (
                    <div className="flex gap-2 justify-center mt-6">
                        <button onClick={() => openCompanyModal()} className="bg-blue-600 text-white px-5 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-blue-700">
                            <Plus size={18}/> شخص / شرکت
                        </button>
                        <button onClick={() => openModal()} className="bg-orange-600 text-white px-5 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-orange-700">
                            <Plus size={18}/> یادداشت
                        </button>
                    </div>
                )}
                {/* Modal rendering outside regular flow */}
                {showModal && <ItemModal />}
                {showCompanyModal && <CompanyModal />}
            </div>
        );
    }
    
    const ItemModal = () => (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm rtl">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-fade-in max-h-[90vh] flex flex-col">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 flex-none">
                    <h2 className="font-black text-gray-800 text-lg">{editingItem ? 'ویرایش یادداشت' : 'افزودن یادداشت جدید'}</h2>
                    <button onClick={closeModal} className="p-2 hover:bg-gray-200 rounded-full text-gray-500 transition-colors">
                        <X size={20} />
                    </button>
                </div>
                <div className="p-6 space-y-4 overflow-y-auto">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">عنوان <span className="text-red-500">*</span></label>
                        <input
                            type="text"
                            value={titleStr}
                            onChange={(e) => setTitleStr(e.target.value)}
                            className="w-full border border-gray-300 rounded-xl p-3 focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="مثلا: شرایط فروش قسطی، شیوه ارسال کالا و..."
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">متن توضیحات</label>
                        <textarea
                            value={contentStr}
                            onChange={(e) => setContentStr(e.target.value)}
                            className="w-full border border-gray-300 rounded-xl p-3 h-40 resize-y focus:ring-2 focus:ring-blue-500 outline-none leading-relaxed"
                            placeholder="متن دلخواه..."
                        />
                    </div>
                </div>
                <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                    <button onClick={closeModal} className="px-5 py-2.5 rounded-xl font-bold text-gray-600 hover:bg-gray-200 transition-colors">انصراف</button>
                    <button onClick={handleSaveItem} disabled={!titleStr.trim()} className="px-5 py-2.5 rounded-xl font-bold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2">
                        <Check size={18}/> ذخیره اطلاعات
                    </button>
                </div>
            </div>
        </div>
    );

    const CompanyModal = () => (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm rtl">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-fade-in max-h-[90vh] flex flex-col">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-yellow-50 flex-none">
                    <h2 className="font-black text-yellow-900 text-lg">
                        {companies.find(c => c.id === editingCompany?.id) ? 'ویرایش اطلاعات شخص / شرکت' : 'ثبت شخص / شرکت جدید'}
                    </h2>
                    <button onClick={() => setShowCompanyModal(false)} className="p-2 hover:bg-yellow-200 rounded-full text-yellow-700 transition-colors">
                        <X size={20} />
                    </button>
                </div>
                <div className="p-6 space-y-4 overflow-y-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="col-span-1 md:col-span-2">
                            <label className="block text-sm font-bold text-gray-700 mb-1">نام شخص / نام شرکت <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                value={editingCompany?.name || ''}
                                onChange={(e) => setEditingCompany({...editingCompany, name: e.target.value})}
                                className="w-full border border-gray-300 rounded-xl p-3 focus:ring-2 focus:ring-yellow-500 outline-none font-bold text-gray-800"
                                placeholder="..."
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">کد ملی / شناسه ملی</label>
                            <input
                                type="text"
                                value={editingCompany?.nationalId || ''}
                                onChange={(e) => setEditingCompany({...editingCompany, nationalId: e.target.value})}
                                className="w-full border border-gray-300 rounded-xl p-3 focus:ring-2 focus:ring-yellow-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">شماره ثبت</label>
                            <input
                                type="text"
                                value={editingCompany?.registrationNumber || ''}
                                onChange={(e) => setEditingCompany({...editingCompany, registrationNumber: e.target.value})}
                                className="w-full border border-gray-300 rounded-xl p-3 focus:ring-2 focus:ring-yellow-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">شماره تماس</label>
                            <input
                                type="text"
                                value={editingCompany?.phone || ''}
                                onChange={(e) => setEditingCompany({...editingCompany, phone: e.target.value})}
                                className="w-full border border-gray-300 rounded-xl p-3 focus:ring-2 focus:ring-yellow-500 outline-none dir-ltr text-left"
                            />
                        </div>
                        <div className="col-span-1 md:col-span-2">
                            <label className="block text-sm font-bold text-gray-700 mb-1">آدرس</label>
                            <textarea
                                value={editingCompany?.address || ''}
                                onChange={(e) => setEditingCompany({...editingCompany, address: e.target.value})}
                                className="w-full border border-gray-300 rounded-xl p-3 focus:ring-2 focus:ring-yellow-500 outline-none h-20 resize-y"
                            />
                        </div>
                    </div>
                    
                    <div className="mt-8">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-gray-800 text-lg">حساب‌های بانکی</h3>
                            <button 
                                onClick={() => {
                                    const newBanks = [...(editingCompany.banks || [])];
                                    newBanks.push({ id: Date.now().toString(), bankName: '', accountNumber: '', sheba: '', cardNumber: '' });
                                    setEditingCompany({...editingCompany, banks: newBanks});
                                }}
                                className="text-sm bg-green-100 text-green-700 px-3 py-1.5 rounded-lg flex items-center gap-1 font-bold"
                            >
                                <Plus size={16}/> افزودن حساب
                            </button>
                        </div>
                        
                        <div className="space-y-4">
                            {(editingCompany?.banks || []).map((bank: any, idx: number) => (
                                <div key={bank.id} className="bg-gray-50 border border-gray-200 rounded-xl p-4 relative">
                                    <button 
                                        onClick={() => {
                                            const newBanks = editingCompany.banks.filter((b: any) => b.id !== bank.id);
                                            setEditingCompany({...editingCompany, banks: newBanks});
                                        }}
                                        className="absolute top-4 left-4 text-red-500 hover:bg-red-50 p-1.5 rounded-lg"
                                    >
                                        <Trash2 size={18}/>
                                    </button>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pr-8">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 mb-1">نام بانک</label>
                                            <input
                                                type="text"
                                                value={bank.bankName}
                                                onChange={(e) => {
                                                    const newBanks = [...editingCompany.banks];
                                                    newBanks[idx].bankName = e.target.value;
                                                    setEditingCompany({...editingCompany, banks: newBanks});
                                                }}
                                                className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 outline-none text-sm font-bold"
                                                placeholder="مثال: ملی، ملت..."
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 mb-1">شماره حساب</label>
                                            <input
                                                type="text"
                                                value={bank.accountNumber}
                                                onChange={(e) => {
                                                    const newBanks = [...editingCompany.banks];
                                                    newBanks[idx].accountNumber = e.target.value;
                                                    setEditingCompany({...editingCompany, banks: newBanks});
                                                }}
                                                className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 outline-none dir-ltr text-left font-mono text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 mb-1">شماره کارت (۱۶ رقم)</label>
                                            <input
                                                type="text"
                                                value={bank.cardNumber || ''}
                                                onChange={(e) => {
                                                    const newBanks = [...editingCompany.banks];
                                                    newBanks[idx].cardNumber = e.target.value;
                                                    setEditingCompany({...editingCompany, banks: newBanks});
                                                }}
                                                className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 outline-none dir-ltr text-left font-mono text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 mb-1">شماره شبا</label>
                                            <div className="flex items-center">
                                                <input
                                                    type="text"
                                                    value={bank.sheba || ''}
                                                    onChange={(e) => {
                                                        const val = e.target.value.replace(/^IR/i, '');
                                                        const newBanks = [...editingCompany.banks];
                                                        newBanks[idx].sheba = val;
                                                        setEditingCompany({...editingCompany, banks: newBanks});
                                                    }}
                                                    className="flex-1 w-full border border-gray-300 rounded-l-none rounded-r-lg p-2 focus:ring-2 outline-none dir-ltr text-left font-mono text-sm"
                                                />
                                                <span className="bg-gray-200 border border-gray-300 border-l-0 rounded-l-lg p-2 text-sm font-mono font-bold">IR</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {(editingCompany?.banks || []).length === 0 && (
                                <div className="text-center text-sm text-gray-500 py-4 bg-gray-50 border border-dashed border-gray-300 rounded-xl">
                                    هیچ حسابی ثبت نشده است.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 flex-none">
                    <button onClick={() => setShowCompanyModal(false)} className="px-5 py-2.5 rounded-xl font-bold text-gray-600 hover:bg-gray-200 transition-colors">انصراف</button>
                    <button onClick={handleSaveCompany} disabled={!editingCompany?.name.trim()} className="px-5 py-2.5 rounded-xl font-bold bg-yellow-600 text-white hover:bg-yellow-700 disabled:opacity-50 transition-colors flex items-center gap-2">
                        <Check size={18}/> ذخیره در سیستم
                    </button>
                </div>
            </div>
        </div>
    );

    return (
        <div className="space-y-6 pb-20 animate-fade-in">
            <div className="bg-white p-6 md:p-8 rounded-3xl border border-blue-100 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5"><BookOpen size={100}/></div>
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2">
                            <BookOpen className="text-blue-600"/>
                            اطلاعات پایه و حساب‌ها
                        </h2>
                        <p className="text-gray-500 mt-2 font-bold text-sm">در این بخش می‌توانید مشخصات بانکی، شبا و اطلاعات کلی شرکت‌ها را مشاهده و برای دیگران ارسال کنید.</p>
                    </div>
                    {canManage && (
                        <div className="flex gap-2">
                            <button onClick={() => openCompanyModal()} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-blue-700 transition-colors">
                                <Plus size={16}/> شخص/شرکت
                            </button>
                            <button onClick={() => openModal()} className="bg-orange-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-orange-700 transition-colors">
                                <Plus size={16}/> یادداشت
                            </button>
                            <button onClick={() => window.location.hash = '#settings'} className="bg-blue-50 text-blue-700 border border-blue-200 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-blue-100 transition-colors hidden lg:flex">
                                تنظیمات <ExternalLink size={16}/>
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal rendering outside regular flow */}
            {showModal && <ItemModal />}
            {showCompanyModal && <CompanyModal />}

            <div className="columns-1 md:columns-2 lg:columns-3 gap-6 space-y-6">
                {/* Custom Items First */}
                {customItems.map(item => {
                    const shareText = `📌 ${item.title}\n\n${item.content}`;
                    return (
                        <div key={item.id} className="bg-orange-50 rounded-2xl p-5 shadow-sm border border-orange-200 break-inside-avoid shadow-orange-100/50 relative group">
                            <div className="absolute top-3 left-3 opacity-0 group-hover:opacity-100 transition-opacity flex bg-white/80 backdrop-blur-sm rounded-lg p-1 shadow-sm gap-1">
                                {canManage && (
                                    <>
                                        <button onClick={() => openModal(item)} className="p-1.5 hover:bg-gray-100 rounded text-blue-600 transition-colors" title="ویرایش">
                                            <Edit2 size={16}/>
                                        </button>
                                        <button onClick={() => handleDeleteItem(item.id)} className="p-1.5 hover:bg-gray-100 rounded text-red-600 transition-colors" title="حذف">
                                            <Trash2 size={16}/>
                                        </button>
                                        <div className="w-px bg-gray-300 my-1 mx-1 mx-xs"></div>
                                    </>
                                )}
                                <button onClick={() => handleCopy(shareText, item.id)} className="p-1.5 hover:bg-gray-100 rounded text-gray-600 transition-colors" title="کپی کردن متن">
                                    {copiedStates[item.id] ? <Check size={16} className="text-green-600"/> : <Copy size={16}/>}
                                </button>
                                <button onClick={() => handleShare(shareText, item.title)} className="p-1.5 hover:bg-gray-100 rounded text-gray-600 transition-colors" title="ارسال پیام">
                                    <Share2 size={16}/>
                                </button>
                            </div>
                            
                            <h3 className="font-bold text-gray-800 text-lg mb-3 border-b border-orange-200/50 pb-2 flex items-center gap-2">
                                <BookOpen size={18} className="text-orange-500" />
                                {item.title}
                            </h3>
                            <div className="text-sm font-bold text-gray-700 leading-relaxed whitespace-pre-wrap">
                                {item.content || <span className="text-gray-400 italic">بدون توضیحات...</span>}
                            </div>
                            <div className="mt-4 text-[10px] text-gray-400 flex justify-end">
                                ویرایش: {new Date(item.updatedAt).toLocaleDateString('fa-IR')}
                            </div>
                        </div>
                    );
                })}

                {/* Companies Second */}
                {companies.map(company => {
                    let shareText = `📌 مشخصات ${company.name}\n`;
                    if(company.registrationNumber) shareText += `شماره ثبت: ${company.registrationNumber}\n`;
                    if(company.nationalId) shareText += `شناسه ملی: ${company.nationalId}\n`;
                    if(company.phone) shareText += `تماس: ${company.phone}\n`;
                    if(company.address) shareText += `آدرس: ${company.address}\n`;
                    
                    if(company.banks && company.banks.length > 0) {
                        shareText += `\n💳 اطلاعات حساب‌ها:\n`;
                        company.banks.forEach(b => {
                            shareText += `بانک ${b.bankName}\nحساب: ${b.accountNumber}\n`;
                            if(b.cardNumber) shareText += `کارت: ${b.cardNumber}\n`;
                            if(b.sheba) shareText += `شبا: IR${b.sheba.replace(/^IR/i, '')}\n`;
                            shareText += `-------------------\n`;
                        });
                    }

                    return (
                        <div key={company.id} className="bg-yellow-50 rounded-2xl p-5 shadow-sm border border-yellow-200 break-inside-avoid shadow-yellow-100/50 relative group">
                            <div className="absolute top-3 left-3 opacity-0 group-hover:opacity-100 transition-opacity flex bg-white/80 backdrop-blur-sm rounded-lg p-1 shadow-sm gap-1">
                                {canManage && (
                                    <>
                                        <button onClick={() => openCompanyModal(company)} className="p-1.5 hover:bg-gray-100 rounded text-blue-600 transition-colors" title="ویرایش">
                                            <Edit2 size={16}/>
                                        </button>
                                        <button onClick={() => handleDeleteCompany(company.id)} className="p-1.5 hover:bg-gray-100 rounded text-red-600 transition-colors" title="حذف">
                                            <Trash2 size={16}/>
                                        </button>
                                        <div className="w-px bg-gray-300 my-1 mx-1"></div>
                                    </>
                                )}
                                <button onClick={() => downloadAsTxt(shareText, company.name || 'document')} className="p-1.5 hover:bg-gray-100 rounded text-gray-600 transition-colors text-xs font-bold uppercase" title="دانلود فایل متنی">
                                    TXT
                                </button>
                                <button onClick={() => downloadAsPdf(company)} className="p-1.5 hover:bg-gray-100 rounded text-gray-600 transition-colors text-xs font-bold uppercase" title="دانلود PDF">
                                    PDF
                                </button>
                                <button onClick={() => handleCopy(shareText, company.id)} className="p-1.5 hover:bg-gray-100 rounded text-gray-600 transition-colors" title="کپی کردن کل متن">
                                    {copiedStates[company.id] ? <Check size={16} className="text-green-600"/> : <Copy size={16}/>}
                                </button>
                                <button onClick={() => handleShare(shareText, company.name)} className="p-1.5 hover:bg-gray-100 rounded text-gray-600 transition-colors" title="ارسال پیام">
                                    <Share2 size={16}/>
                                </button>
                            </div>
                            
                            <h3 className="font-bold text-gray-800 text-lg mb-3 border-b border-yellow-200/50 pb-2">{company.name}</h3>
                            
                            <div className="space-y-4 text-sm font-bold text-gray-700">
                                <div className="space-y-1">
                                    {company.nationalId && <div>شناسه ملی: <span className="font-mono bg-white px-1.5 py-0.5 rounded text-gray-800 border border-yellow-100 select-all">{company.nationalId}</span></div>}
                                    {company.registrationNumber && <div>شماره ثبت: <span className="font-mono bg-white px-1.5 py-0.5 rounded text-gray-800 border border-yellow-100 select-all">{company.registrationNumber}</span></div>}
                                    {company.phone && <div>تلفن: <span className="font-mono bg-white px-1.5 py-0.5 rounded text-gray-800 border border-yellow-100 select-all">{company.phone}</span></div>}
                                </div>
                                
                                {company.banks && company.banks.length > 0 ? (
                                    <div className="space-y-3 pt-2">
                                        <div className="text-xs bg-yellow-100/50 text-yellow-800 px-2 py-1 rounded-lg inline-block">حساب‌های بانکی:</div>
                                        {company.banks.map(bank => (
                                            <div key={bank.id} className="bg-white rounded-xl p-3 shadow-sm border border-yellow-100 relative group/bank">
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="font-black text-blue-900 border-r-2 border-blue-500 pr-2">{bank.bankName}</span>
                                                    <div className="flex gap-1 opacity-0 group-hover/bank:opacity-100 transition-opacity">
                                                        <button onClick={() => handleCopy(`بانک ${bank.bankName}\nحساب: ${bank.accountNumber}${bank.sheba ? '\nشبا: '+bank.sheba : ''}`, bank.id)} className="p-1 hover:bg-gray-100 rounded">
                                                            {copiedStates[bank.id] ? <Check size={14} className="text-green-600"/> : <Copy size={14} className="text-gray-500"/>}
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs text-gray-500">حساب:</span>
                                                    <span className="font-mono font-bold select-all">{bank.accountNumber}</span>
                                                </div>
                                                {bank.cardNumber && (
                                                    <div className="flex items-center justify-between mt-1">
                                                        <span className="text-xs text-gray-500">کارت:</span>
                                                        <span className="font-mono font-bold tracking-widest text-[13px] select-all">{bank.cardNumber}</span>
                                                    </div>
                                                )}
                                                {bank.sheba && (
                                                    <div className="flex items-center justify-between mt-1">
                                                        <span className="text-xs text-gray-500">شبا:</span>
                                                        <span className="font-mono font-black tracking-widest text-[11px] select-all dir-ltr">IR{bank.sheba.replace(/^IR/i, '')}</span>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-xs text-gray-400 italic">حساب بانکی ثبت نشده است</div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default KnowledgeBaseModule;
