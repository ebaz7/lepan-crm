import React, { useState, useEffect, useMemo, useRef } from 'react';
import { User, BrokerageItem, BrokerageTransaction, SystemSettings, UserRole } from '../types';
import { apiCall } from '../services/apiService';
import { generateUUID, formatDate } from '../constants';
import { 
    Warehouse, Package, Plus, ArrowDownLeft, ArrowUpRight, History, 
    Printer, Search, Loader2, CheckCircle, XCircle, Share2, 
    Palette, Scale, Building2, BarChart3, Filter, FileText, ChevronRight, Save, Eye, Trash2, X, ClipboardList, Send, Check, LayoutDashboard
} from 'lucide-react';
import PrintBrokerageStock from './print/PrintBrokerageStock';
import PrintBrokerageBijak from './print/PrintBrokerageBijak';

const BrokerageWarehouse: React.FC<{ currentUser: User, settings?: SystemSettings }> = ({ currentUser, settings }) => {
    const [activeTab, setActiveTab] = useState<'dashboard' | 'items' | 'tx' | 'stock' | 'kardex'>('dashboard');
    const [items, setItems] = useState<BrokerageItem[]>([]);
    const [transactions, setTransactions] = useState<BrokerageTransaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    
    // Modals
    const [showPrintStock, setShowPrintStock] = useState(false);
    const [viewBijak, setViewBijak] = useState<BrokerageTransaction | null>(null);

    // Form States
    const [selectedCompany, setSelectedCompany] = useState(settings?.defaultCompany || '');
    const [newItem, setNewItem] = useState({ name: '', color: '', unit: 'عدد', initialQuantity: 0, initialWeight: 0, code: '' });
    const [newTx, setNewTx] = useState({ 
        type: 'OUT' as 'IN' | 'OUT', recipient: '', driver: '', plate: '', destination: '', items: [] as any[], description: '' 
    });
    
    // Kardex State
    const [kardexFilter, setKardexFilter] = useState({ itemId: '', company: '' });

    useEffect(() => { loadData(); }, []);

    // Re-sync if settings arrive later
    useEffect(() => {
        if (!selectedCompany && settings?.defaultCompany) {
            setSelectedCompany(settings.defaultCompany);
        }
    }, [settings]);

    const loadData = async () => {
        setLoading(true);
        try {
            // Use standard brokerage paths (now mounted explicitly on server)
            const [itemsData, txData] = await Promise.all([
                apiCall<BrokerageItem[]>('/brokerage/items'),
                apiCall<BrokerageTransaction[]>('/brokerage/transactions')
            ]);
            
            setItems(Array.isArray(itemsData) ? itemsData : []);
            setTransactions(Array.isArray(txData) ? txData : []);
        } catch (e: any) { 
            console.error("Brokerage Refresh Error:", e);
            // On a restored DB, we might get 404 if routes were malformed. Now handled.
        } finally { 
            setLoading(false); 
        }
    };

    const safeItems = Array.isArray(items) ? items : [];
    const safeTransactions = Array.isArray(transactions) ? transactions : [];

    // --- REPORT LOGIC ---
    const stockData = useMemo(() => {
        const report: Record<string, any[]> = {};
        const companies = Array.from(new Set(safeItems.map(i => i.companyName)));

        companies.forEach(company => {
            const companyItems = safeItems.filter(i => i.companyName === company);
            const processed = companyItems.map(item => {
                let qty = item.initialQuantity || 0;
                let weight = item.initialWeight || 0;
                safeTransactions.filter(t => (t.status === 'APPROVED' || t.type === 'IN') && t.companyName === company).forEach(t => {
                    t.items.forEach(ti => {
                        if (ti.itemId === item.id) {
                            if (t.type === 'IN') { qty += (ti.quantity || 0); weight += (ti.weight || 0); }
                            else { qty -= (ti.quantity || 0); weight -= (ti.weight || 0); }
                        }
                    });
                });
                return { ...item, currentQty: qty, currentWeight: weight };
            });
            report[company] = processed;
        });
        return report;
    }, [safeItems, safeTransactions]);

    const handleCreateItem = async () => {
        if (!selectedCompany) return alert('لطفاً ابتدا شرکت را انتخاب کنید.');
        if (!newItem.name.trim()) return alert('نام کالا الزامی است.');

        setIsSaving(true);
        try {
            const item: BrokerageItem = {
                id: generateUUID(),
                companyName: selectedCompany,
                name: newItem.name.trim(),
                color: newItem.color,
                unit: newItem.unit,
                initialQuantity: newItem.initialQuantity,
                initialWeight: newItem.initialWeight,
                code: newItem.code
            };
            
            await apiCall('/brokerage/items', 'POST', item);
            alert('کالا با موفقیت ثبت شد.');
            setNewItem({ name: '', color: '', unit: 'عدد', initialQuantity: 0, initialWeight: 0, code: '' });
            await loadData();
        } catch (error: any) {
            console.error("Save Item Error:", error);
            alert(`خطا در ثبت: ${error.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleCreateTx = async () => {
        if (!selectedCompany) return alert('لطفاً شرکت را انتخاب کنید.');
        if (newTx.items.length === 0) return alert('لیست کالاها خالی است.');

        setIsSaving(true);
        try {
            const encodedCompany = encodeURIComponent(selectedCompany);
            const nextRes = await apiCall<{next: number}>(`/brokerage/next-serial?company=${encodedCompany}`);
            
            const tx: BrokerageTransaction = {
                id: generateUUID(),
                type: newTx.type as 'IN' | 'OUT',
                companyName: selectedCompany,
                serialNumber: nextRes.next,
                date: new Date().toISOString(),
                items: newTx.items,
                recipientName: newTx.recipient,
                driverName: newTx.driver,
                plateNumber: newTx.plate,
                destination: newTx.destination,
                description: newTx.description,
                status: newTx.type === 'OUT' ? 'PENDING' : 'APPROVED',
                createdBy: currentUser.fullName,
                createdAt: Date.now()
            };

            await apiCall('/brokerage/transactions', 'POST', tx);
            alert(newTx.type === 'OUT' ? 'بیجک صادر و به کارتابل مدیر ارسال شد.' : 'ورود کالا ثبت شد.');
            setNewTx({ type: 'OUT', recipient: '', driver: '', plate: '', destination: '', items: [], description: '' });
            await loadData();
        } catch (error: any) {
            console.error("Tx Error:", error);
            alert(`خطای سیستمی: ${error.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleApprove = async (tx: BrokerageTransaction) => {
        if (!confirm('تایید نهایی بیجک؟')) return;
        try {
            await apiCall(`/brokerage/transactions/${tx.id}`, 'PUT', { 
                status: 'APPROVED', 
                approvedBy: currentUser.fullName,
                updatedAt: Date.now()
            });
            await loadData();
            setViewBijak(null);
        } catch (error: any) {
            alert(`خطا: ${error.message}`);
        }
    };

    const addTxItemRow = (itemId: string) => {
        const item = safeItems.find(i => i.id === itemId);
        if (!item) return;
        setNewTx({
            ...newTx,
            items: [...newTx.items, { itemId, itemName: item.name, color: item.color, quantity: 1, weight: 0 }]
        });
    };

    const companiesList = Array.isArray(settings?.companies) ? settings.companies : [];

    return (
        <div className="flex flex-col h-full gap-4 animate-fade-in pb-20 md:pb-0">
            {/* Header */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-4">
                    <div className="bg-indigo-600 p-3 rounded-2xl text-white shadow-lg">
                        <Warehouse size={32}/>
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-gray-800">انبار بنگاه</h1>
                        <p className="text-sm text-gray-500">مدیریت موجودی امانی و بیجک‌های خروج</p>
                    </div>
                </div>
                <div className="flex gap-2 bg-gray-100 p-1.5 rounded-2xl">
                    {[
                        { id: 'dashboard', label: 'میز کار', icon: LayoutDashboard },
                        { id: 'items', label: 'کالاها', icon: Package },
                        { id: 'stock', label: 'موجودی', icon: ClipboardList },
                        { id: 'tx', label: 'صدور بیجک', icon: Send },
                        { id: 'kardex', label: 'کاردکس', icon: History },
                    ].map(tab => (
                        <button 
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)} 
                            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${activeTab === tab.id ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'}`}
                        >
                            <tab.icon size={16}/>
                            <span className="hidden sm:inline">{tab.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Selector */}
            <div className="flex gap-2 overflow-x-auto pb-2 px-1">
                {companiesList.map(c => (
                    <button 
                        key={c.id} 
                        onClick={() => setSelectedCompany(c.name)}
                        className={`px-6 py-2 rounded-2xl text-xs font-black whitespace-nowrap transition-all border ${selectedCompany === c.name ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-gray-500 border-gray-200'}`}
                    >
                        {c.name}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-1">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-400">
                        <Loader2 className="animate-spin" size={40}/>
                        <span className="font-bold">در حال بارگذاری داده‌ها...</span>
                    </div>
                ) : (
                    <>
                        {activeTab === 'dashboard' && (
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex items-center justify-between group">
                                    <div><div className="text-3xl font-black text-gray-800">{safeItems.filter(i => i.companyName === selectedCompany).length}</div><div className="text-xs text-gray-400 font-bold uppercase">کالاهای {selectedCompany || '---'}</div></div>
                                    <Package className="text-indigo-200 group-hover:text-indigo-500 transition-colors" size={48}/>
                                </div>
                                <div className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100 flex items-center justify-between">
                                    <div><div className="text-3xl font-black text-emerald-700">{safeTransactions.filter(t=>t.type==='IN' && t.companyName === selectedCompany).length}</div><div className="text-xs text-emerald-600 font-bold uppercase">رسید ورود</div></div>
                                    <ArrowDownLeft className="text-emerald-200" size={48}/>
                                </div>
                                <div className="bg-rose-50 p-6 rounded-3xl border border-rose-100 flex items-center justify-between">
                                    <div><div className="text-3xl font-black text-rose-700">{safeTransactions.filter(t=>t.type==='OUT' && t.status==='APPROVED' && t.companyName === selectedCompany).length}</div><div className="text-xs text-rose-600 font-bold uppercase">خروج نهایی</div></div>
                                    <ArrowUpRight className="text-rose-200" size={48}/>
                                </div>
                                <button onClick={() => setShowPrintStock(true)} className="bg-slate-800 p-6 rounded-3xl shadow-xl text-white flex flex-col items-center justify-center gap-2 hover:bg-slate-900 transition-all">
                                    <Printer size={32} className="text-indigo-400"/>
                                    <span className="font-bold">چاپ موجودی کل</span>
                                </button>
                                
                                <div className="md:col-span-4 bg-white rounded-3xl border border-gray-100 p-6">
                                    <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2"><History className="text-indigo-500"/> آخرین بیجک‌های {selectedCompany || 'شرکت‌ها'}</h3>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-right text-sm">
                                            <thead className="bg-gray-50 text-gray-400">
                                                <tr><th className="p-4">نوع</th><th className="p-4">سریال</th><th className="p-4">تاریخ</th><th className="p-4">تحویل‌گیرنده</th><th className="p-4">وضعیت</th><th className="p-4">عملیات</th></tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-50">
                                                {safeTransactions.filter(t => !selectedCompany || t.companyName === selectedCompany).slice(0, 10).map(t => (
                                                    <tr key={t.id} className="hover:bg-gray-50 group">
                                                        <td className="p-4">{t.type === 'IN' ? <span className="text-emerald-600 font-bold">ورود</span> : <span className="text-rose-600 font-bold">خروج</span>}</td>
                                                        <td className="p-4 font-mono font-bold text-gray-500">{t.serialNumber}</td>
                                                        <td className="p-4">{formatDate(t.date)}</td>
                                                        <td className="p-4 font-medium">{t.recipientName || '---'}</td>
                                                        <td className="p-4">
                                                            <span className={`px-3 py-1 rounded-full text-[10px] font-black ${t.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' : t.status === 'PENDING' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
                                                                {t.status === 'APPROVED' ? 'تایید نهایی' : t.status === 'PENDING' ? 'منتظر تایید' : '-'}
                                                            </span>
                                                        </td>
                                                        <td className="p-4">
                                                            <button onClick={() => setViewBijak(t)} className="p-2 bg-indigo-50 text-indigo-600 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-all"><Eye size={18}/></button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'items' && (
                            <div className="max-w-4xl mx-auto space-y-6">
                                <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                                    <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2">
                                        <Plus className="text-indigo-600"/> 
                                        تعریف کالا ({selectedCompany || 'لطفاً شرکت را انتخاب کنید'})
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
                                        <div className="space-y-1"><label className="text-sm font-bold text-gray-700">نام کالا</label><input className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-indigo-200 outline-none" value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} placeholder="مثال: لوله..." /></div>
                                        <div className="space-y-1"><label className="text-sm font-bold text-gray-700">رنگ</label><input className="w-full border rounded-xl p-3" value={newItem.color} onChange={e => setNewItem({...newItem, color: e.target.value})} /></div>
                                        <div className="space-y-1"><label className="text-sm font-bold text-gray-700">واحد</label><select className="w-full border rounded-xl p-3 bg-white" value={newItem.unit} onChange={e => setNewItem({...newItem, unit: e.target.value})}><option>عدد</option><option>کارتن</option><option>کیلوگرم</option></select></div>
                                        <div className="space-y-1"><label className="text-sm font-bold text-gray-700">موجودی اولیه</label><input type="number" className="w-full border rounded-xl p-3" value={newItem.initialQuantity} onChange={e => setNewItem({...newItem, initialQuantity: Number(e.target.value)})}/></div>
                                        <button 
                                            onClick={handleCreateItem} 
                                            disabled={isSaving || !selectedCompany}
                                            className={`text-white p-3 rounded-xl font-bold flex items-center justify-center gap-2 h-[48px] transition-all shadow-lg ${isSaving ? 'bg-indigo-400' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                                        >
                                            {isSaving ? <Loader2 className="animate-spin" size={20}/> : <Save size={20}/>} 
                                            ثبت کالا
                                        </button>
                                    </div>
                                </div>
                                <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden">
                                    <table className="w-full text-right text-sm">
                                        <thead className="bg-gray-50"><tr><th className="p-4">نام کالا</th><th className="p-4">رنگ</th><th className="p-4">واحد</th><th className="p-4">عملیات</th></tr></thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {safeItems.filter(i => !selectedCompany || i.companyName === selectedCompany).map(i => (
                                                <tr key={i.id} className="hover:bg-gray-50">
                                                    <td className="p-4 font-black">{i.name}</td>
                                                    <td className="p-4">{i.color || '-'}</td>
                                                    <td className="p-4">{i.unit}</td>
                                                    <td className="p-4"><button className="text-red-400 p-2 hover:bg-red-50 rounded-xl"><Trash2 size={18}/></button></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {activeTab === 'tx' && (
                            <div className="max-w-5xl mx-auto space-y-6">
                                <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                                    <div className="flex justify-between items-center mb-6 border-b pb-4">
                                        <h3 className="font-bold text-gray-800 flex items-center gap-2"><Send className="text-indigo-600"/> تراکنش جدید ({selectedCompany || 'بدون شرکت'})</h3>
                                        <div className="flex bg-gray-100 p-1 rounded-xl">
                                            <button onClick={() => setNewTx({...newTx, type: 'OUT'})} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${newTx.type === 'OUT' ? 'bg-rose-500 text-white shadow-md' : 'text-gray-500'}`}>خروج</button>
                                            <button onClick={() => setNewTx({...newTx, type: 'IN'})} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${newTx.type === 'IN' ? 'bg-emerald-500 text-white shadow-md' : 'text-gray-500'}`}>ورود</button>
                                        </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                        <div className="space-y-4">
                                            <div className="space-y-1"><label className="text-xs font-bold text-gray-500">تحویل‌گیرنده</label><input className="w-full border rounded-xl p-3" value={newTx.recipient} onChange={e=>setNewTx({...newTx, recipient: e.target.value})} placeholder="نام..."/></div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-1"><label className="text-xs font-bold text-gray-500">نام راننده</label><input className="w-full border rounded-xl p-3" value={newTx.driver} onChange={e=>setNewTx({...newTx, driver: e.target.value})}/></div>
                                                <div className="space-y-1"><label className="text-xs font-bold text-gray-500">پلاک</label><input className="w-full border rounded-xl p-3 text-center dir-ltr" value={newTx.plate} onChange={e=>setNewTx({...newTx, plate: e.target.value})} placeholder="12A345-67"/></div>
                                            </div>
                                            <div className="space-y-1"><label className="text-xs font-bold text-gray-500">مقصد</label><input className="w-full border rounded-xl p-3" value={newTx.destination} onChange={e=>setNewTx({...newTx, destination: e.target.value})}/></div>
                                        </div>
                                        <div className="space-y-4">
                                            <div className="space-y-1">
                                                <label className="text-xs font-bold text-gray-500">افزودن کالا از لیست</label>
                                                <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto border rounded-xl p-2 bg-gray-50">
                                                    {safeItems.filter(i => i.companyName === selectedCompany).map(item => (
                                                        <button key={item.id} onClick={() => addTxItemRow(item.id)} className="flex justify-between items-center bg-white p-3 rounded-xl border border-gray-100 hover:border-indigo-300 text-right text-sm">
                                                            <span className="font-bold">{item.name}</span>
                                                            <Plus size={16} className="text-indigo-500"/>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="space-y-1"><label className="text-xs font-bold text-gray-500">توضیحات</label><textarea className="w-full border rounded-xl p-3 h-[88px]" value={newTx.description} onChange={e=>setNewTx({...newTx, description: e.target.value})}/></div>
                                        </div>
                                    </div>

                                    {/* Items List */}
                                    <div className="border rounded-2xl overflow-hidden mb-6">
                                        <table className="w-full text-right text-sm">
                                            <thead className="bg-gray-50"><tr><th className="p-3">کالا</th><th className="p-3 w-32">تعداد</th><th className="p-3 w-10"></th></tr></thead>
                                            <tbody className="divide-y">
                                                {newTx.items.map((it, idx) => (
                                                    <tr key={idx}>
                                                        <td className="p-3 font-bold">{it.itemName}</td>
                                                        <td className="p-4"><input type="number" className="w-full border rounded p-1 text-center" value={it.quantity} onChange={e => { const n = [...newTx.items]; n[idx].quantity = Number(e.target.value); setNewTx({...newTx, items: n}); }}/></td>
                                                        <td className="p-3"><button onClick={() => { const n = newTx.items.filter((_, i) => i !== idx); setNewTx({...newTx, items: n}); }} className="text-red-400"><X size={16}/></button></td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    <button onClick={handleCreateTx} disabled={isSaving || newTx.items.length === 0 || !selectedCompany} className={`w-full py-4 rounded-2xl font-black text-white shadow-lg transition-all flex items-center justify-center gap-3 ${newTx.type === 'OUT' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
                                        {isSaving ? <Loader2 className="animate-spin" size={24}/> : <Check size={24}/>}
                                        ثبت نهایی {newTx.type === 'OUT' ? 'بیجک' : 'رسید'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {activeTab === 'stock' && (
                            <div className="space-y-8 p-2">
                                {/* Fix: Explicitly type companyItems to any during Object.entries map to avoid unknown errors */}
                                {Object.entries(stockData).map(([company, companyItems]: [string, any]) => (
                                    <div key={company} className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                                        <div className="bg-slate-800 p-5 text-white flex justify-between items-center">
                                            <div className="flex items-center gap-3"><Building2 size={24} className="text-indigo-400"/><span className="text-lg font-black">{company}</span></div>
                                            {/* Fix: Cast companyItems to any[] to access length property */}
                                            <span className="bg-white/10 px-4 py-1 rounded-full text-xs font-bold">{(companyItems as any[]).length} نوع کالا</span>
                                        </div>
                                        <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                                            {/* Fix: Cast companyItems to any[] to use map method */}
                                            {(companyItems as any[]).map(item => (
                                                <div key={item.id} className="p-5 border rounded-2xl bg-gray-50/30">
                                                    <h4 className="font-black text-gray-800 mb-4">{item.name}</h4>
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="bg-white p-3 rounded-xl border">
                                                            <span className="block text-[10px] text-gray-400 font-bold mb-1">موجودی</span>
                                                            <span className={`text-xl font-black font-mono ${item.currentQty < 5 ? 'text-red-500' : 'text-indigo-600'}`}>{item.currentQty}</span>
                                                        </div>
                                                        <div className="bg-white p-3 rounded-xl border">
                                                            <span className="block text-[10px] text-gray-400 font-bold mb-1">واحد</span>
                                                            <span className="text-sm font-bold text-gray-600">{item.unit}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        
                        {activeTab === 'kardex' && (
                            <div className="max-w-5xl mx-auto space-y-6">
                                <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                                    <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2"><History className="text-indigo-600"/> گزارش گردش کالا</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 bg-gray-50 p-4 rounded-2xl">
                                        <select className="w-full border rounded-xl p-2 bg-white" value={kardexFilter.company} onChange={e => setKardexFilter({...kardexFilter, company: e.target.value})}>
                                            <option value="">همه شرکت‌ها</option>
                                            {companiesList.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                        </select>
                                        <select className="w-full border rounded-xl p-2 bg-white" value={kardexFilter.itemId} onChange={e => setKardexFilter({...kardexFilter, itemId: e.target.value})}>
                                            <option value="">همه کالاها</option>
                                            {safeItems.filter(i => !kardexFilter.company || i.companyName === kardexFilter.company).map(i => <option key={i.id} value={i.id}>{i.name} ({i.color})</option>)}
                                        </select>
                                    </div>

                                    <div className="overflow-x-auto">
                                        <table className="w-full text-right text-xs">
                                            <thead className="bg-gray-100 uppercase text-gray-400">
                                                <tr><th>تاریخ</th><th>نوع</th><th>شماره</th><th>مقدار</th><th>مانده</th></tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-50 font-medium">
                                                {(() => {
                                                    const filteredTxs = safeTransactions
                                                        .filter(t => (!kardexFilter.company || t.companyName === kardexFilter.company) && (t.status === 'APPROVED' || t.type === 'IN'))
                                                        .sort((a, b) => a.createdAt - b.createdAt);
                                                    
                                                    let runningQty = 0;
                                                    return filteredTxs.map(t => {
                                                        const txItem = t.items.find(ti => !kardexFilter.itemId || ti.itemId === kardexFilter.itemId);
                                                        if (!txItem) return null;
                                                        if (t.type === 'IN') runningQty += txItem.quantity;
                                                        else runningQty -= txItem.quantity;

                                                        return (
                                                            <tr key={t.id} className="hover:bg-gray-50">
                                                                <td className="p-4">{formatDate(t.date)}</td>
                                                                <td className="p-4">{t.type === 'IN' ? <span className="text-emerald-600 font-bold">ورود</span> : <span className="text-rose-600 font-bold">خروج</span>}</td>
                                                                <td className="p-4 font-mono">#{t.serialNumber}</td>
                                                                <td className="p-4 font-mono">{t.type === 'IN' ? `+${txItem.quantity}` : `-${txItem.quantity}`}</td>
                                                                <td className="p-4 font-black font-mono text-indigo-700">{runningQty}</td>
                                                            </tr>
                                                        );
                                                    });
                                                })()}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Overlays */}
            {showPrintStock && <PrintBrokerageStock data={stockData} onClose={() => setShowPrintStock(false)} />}
            {viewBijak && (
                <PrintBrokerageBijak 
                    tx={viewBijak} 
                    onClose={() => setViewBijak(null)} 
                    settings={settings} 
                    onApprove={viewBijak.status === 'PENDING' && (currentUser.role === UserRole.CEO || currentUser.role === UserRole.ADMIN) ? () => handleApprove(viewBijak) : undefined}
                />
            )}
        </div>
    );
};

export default BrokerageWarehouse;
