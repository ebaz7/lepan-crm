
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
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const itemsData = await apiCall<BrokerageItem[]>('/brokerage/items');
            const txData = await apiCall<BrokerageTransaction[]>('/brokerage/transactions');
            
            // SECURITY CHECK: Ensure we always work with arrays to prevent .map errors
            setItems(Array.isArray(itemsData) ? itemsData : []);
            setTransactions(Array.isArray(txData) ? txData : []);
        } catch (e) { 
            console.error("Brokerage Data Load Error:", e);
            setItems([]);
            setTransactions([]);
        }
        finally { setLoading(false); }
    };

    // Safe items and transactions for calculations
    const safeItems = Array.isArray(items) ? items : [];
    const safeTransactions = Array.isArray(transactions) ? transactions : [];

    // --- LOGIC ---
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
        if (!selectedCompany || !newItem.name) return;
        const item: BrokerageItem = {
            id: generateUUID(),
            companyName: selectedCompany,
            ...newItem
        };
        await apiCall('/brokerage/items', 'POST', item);
        setNewItem({ name: '', color: '', unit: 'عدد', initialQuantity: 0, initialWeight: 0, code: '' });
        loadData();
    };

    const handleCreateTx = async () => {
        if (!selectedCompany || newTx.items.length === 0) return;
        
        const nextSerial = await apiCall<{next: number}>(`/brokerage/next-serial?company=${selectedCompany}`);
        const tx: BrokerageTransaction = {
            id: generateUUID(),
            type: newTx.type as 'IN' | 'OUT',
            companyName: selectedCompany,
            serialNumber: nextSerial.next,
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

        await apiCall<BrokerageTransaction[]>('/brokerage/transactions', 'POST', tx);
        loadData();
        
        if (newTx.type === 'OUT') {
            alert('بیجک خروج ثبت شد. تصویر و کپشن برای مدیرعامل ارسال گردید.');
        } else {
            alert('رسید ورود با موفقیت ثبت شد.');
        }
        
        setNewTx({ type: 'OUT', recipient: '', driver: '', plate: '', destination: '', items: [], description: '' });
    };

    const handleApprove = async (tx: BrokerageTransaction) => {
        if (!confirm('آیا این بیجک را تایید می‌کنید؟ پس از تایید، اعلان به "گروه بنگاه" ارسال خواهد شد.')) return;
        await apiCall(`/brokerage/transactions/${tx.id}`, 'PUT', { 
            status: 'APPROVED', 
            approvedBy: currentUser.fullName,
            updatedAt: Date.now()
        });
        alert('تایید شد و پیام به گروه بنگاه ارسال گردید.');
        loadData();
        setViewBijak(null);
    };

    const addTxItemRow = (itemId: string) => {
        const item = safeItems.find(i => i.id === itemId);
        if (!item) return;
        setNewTx({
            ...newTx,
            items: [...newTx.items, { itemId, itemName: item.name, color: item.color, quantity: 1, weight: 0 }]
        });
    };

    // Safe settings companies access
    const safeCompanies = Array.isArray(settings?.companies) ? settings.companies : [];

    // --- RENDER ---
    return (
        <div className="flex flex-col h-full gap-4 animate-fade-in pb-20 md:pb-0">
            {/* Header Area */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-4">
                    <div className="bg-indigo-600 p-3 rounded-2xl text-white shadow-lg shadow-indigo-200">
                        <Warehouse size={32}/>
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-gray-800">انبار بارهای بنگاه</h1>
                        <p className="text-sm text-gray-500 font-medium">سیستم یکپارچه مدیریت موجودی و بیجک‌های خروج</p>
                    </div>
                </div>
                <div className="flex gap-2 bg-gray-100 p-1.5 rounded-2xl">
                    {[
                        { id: 'dashboard', label: 'میز کار', icon: LayoutDashboard },
                        { id: 'items', label: 'تعریف کالا', icon: Package },
                        { id: 'stock', label: 'موجودی', icon: ClipboardList },
                        { id: 'tx', label: 'صدور بیجک', icon: Send },
                        { id: 'kardex', label: 'کاردکس', icon: History },
                    ].map(tab => (
                        <button 
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)} 
                            className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${activeTab === tab.id ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <tab.icon size={16}/>
                            <span className="hidden sm:inline">{tab.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Company Selector Global */}
            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar px-1">
                {safeCompanies.map(c => (
                    <button 
                        key={c.id} 
                        onClick={() => setSelectedCompany(c.name)}
                        className={`px-6 py-2 rounded-2xl text-xs font-black whitespace-nowrap transition-all border ${selectedCompany === c.name ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-gray-500 border-gray-200'}`}
                    >
                        {c.name}
                    </button>
                ))}
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto px-1">
                {activeTab === 'dashboard' && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex items-center justify-between group hover:border-indigo-200 transition-all">
                            <div><div className="text-3xl font-black text-gray-800">{safeItems.filter(i => i.companyName === selectedCompany).length}</div><div className="text-xs text-gray-400 font-bold uppercase tracking-wider">کالاهای {selectedCompany}</div></div>
                            <Package className="text-indigo-100 group-hover:text-indigo-500 transition-colors" size={48}/>
                        </div>
                        <div className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100 flex items-center justify-between">
                            <div><div className="text-3xl font-black text-emerald-700">{safeTransactions.filter(t=>t.type==='IN' && t.companyName === selectedCompany).length}</div><div className="text-xs text-emerald-600 font-bold uppercase">رسید ورود</div></div>
                            <ArrowDownLeft className="text-emerald-200" size={48}/>
                        </div>
                        <div className="bg-rose-50 p-6 rounded-3xl border border-rose-100 flex items-center justify-between">
                            <div><div className="text-3xl font-black text-rose-700">{safeTransactions.filter(t=>t.type==='OUT' && t.status==='APPROVED' && t.companyName === selectedCompany).length}</div><div className="text-xs text-rose-600 font-bold uppercase">خروج نهایی</div></div>
                            <ArrowUpRight className="text-rose-200" size={48}/>
                        </div>
                        <button onClick={() => setShowPrintStock(true)} className="bg-slate-800 p-6 rounded-3xl shadow-xl text-white flex flex-col items-center justify-center gap-2 hover:bg-slate-900 transition-all transform hover:-translate-y-1">
                            <Printer size={32} className="text-indigo-400"/>
                            <span className="font-bold">چاپ موجودی کل (A4)</span>
                        </button>
                        
                        <div className="md:col-span-4 bg-white rounded-3xl border border-gray-100 p-6">
                            <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2"><History className="text-indigo-500"/> آخرین فعالیت‌های {selectedCompany}</h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-right">
                                    <thead className="text-xs text-gray-400 uppercase bg-gray-50 rounded-xl">
                                        <tr><th className="p-4">نوع</th><th className="p-4">شماره سریال</th><th className="p-4">تاریخ</th><th className="p-4">تحویل‌گیرنده</th><th className="p-4">وضعیت</th><th className="p-4">عملیات</th></tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {safeTransactions.filter(t => t.companyName === selectedCompany).slice(0, 10).map(t => (
                                            <tr key={t.id} className="hover:bg-gray-50 transition-colors group">
                                                <td className="p-4">{t.type === 'IN' ? <span className="text-emerald-600 font-bold">ورود</span> : <span className="text-rose-600 font-bold">خروج</span>}</td>
                                                <td className="p-4 font-mono font-bold text-gray-500">{t.serialNumber}</td>
                                                <td className="p-4 text-sm text-gray-500">{formatDate(t.date)}</td>
                                                <td className="p-4 font-medium">{t.recipientName || '---'}</td>
                                                <td className="p-4">
                                                    <span className={`px-3 py-1 rounded-full text-[10px] font-black ${t.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' : t.status === 'PENDING' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
                                                        {t.status === 'APPROVED' ? 'تایید شده' : t.status === 'PENDING' ? 'منتظر تایید' : 'ثبت اولیه'}
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
                            <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2"><Plus className="text-indigo-600"/> تعریف کالای جدید برای {selectedCompany}</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
                                <div className="space-y-1"><label className="text-xs font-bold text-gray-500">نام کالا</label><input className="w-full border rounded-xl p-3" value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})}/></div>
                                <div className="space-y-1"><label className="text-xs font-bold text-gray-500">رنگ</label><input className="w-full border rounded-xl p-3" value={newItem.color} onChange={e => setNewItem({...newItem, color: e.target.value})}/></div>
                                <div className="space-y-1"><label className="text-xs font-bold text-gray-500">واحد</label><select className="w-full border rounded-xl p-3 bg-white" value={newItem.unit} onChange={e => setNewItem({...newItem, unit: e.target.value})}><option>عدد</option><option>کارتن</option><option>کیلوگرم</option></select></div>
                                <div className="space-y-1"><label className="text-xs font-bold text-gray-500">موجودی اولیه (تعداد)</label><input type="number" className="w-full border rounded-xl p-3" value={newItem.initialQuantity} onChange={e => setNewItem({...newItem, initialQuantity: Number(e.target.value)})}/></div>
                                <div className="space-y-1"><label className="text-xs font-bold text-gray-500">وزن اولیه (KG)</label><input type="number" className="w-full border rounded-xl p-3" value={newItem.initialWeight} onChange={e => setNewItem({...newItem, initialWeight: Number(e.target.value)})}/></div>
                                <button onClick={handleCreateItem} className="bg-indigo-600 text-white p-3 rounded-xl font-bold hover:bg-indigo-700 flex items-center justify-center gap-2 h-[48px]"><Save size={20}/> ثبت کالا</button>
                            </div>
                        </div>
                        <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
                            <table className="w-full text-right">
                                <thead className="bg-gray-50"><tr><th className="p-4">نام کالا</th><th className="p-4">رنگ</th><th className="p-4">واحد</th><th className="p-4">موجودی اولیه</th><th className="p-4">عملیات</th></tr></thead>
                                <tbody className="divide-y divide-gray-100">
                                    {safeItems.filter(i => i.companyName === selectedCompany).map(i => (
                                        <tr key={i.id} className="hover:bg-gray-50">
                                            <td className="p-4 font-black">{i.name}</td>
                                            <td className="p-4"><span className="flex items-center gap-1"><Palette size={12} style={{color: i.color}}/> {i.color || '-'}</span></td>
                                            <td className="p-4 text-xs font-bold">{i.unit}</td>
                                            <td className="p-4 font-mono">{i.initialQuantity}</td>
                                            <td className="p-4"><button className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-xl"><Trash2 size={18}/></button></td>
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
                                <h3 className="font-bold text-gray-800 flex items-center gap-2"><Send size={20} className="text-indigo-600"/> ثبت تراکنش جدید ({selectedCompany})</h3>
                                <div className="flex bg-gray-100 p-1 rounded-xl">
                                    <button onClick={() => setNewTx({...newTx, type: 'OUT'})} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${newTx.type === 'OUT' ? 'bg-rose-500 text-white shadow-md' : 'text-gray-500'}`}>خروج کالا</button>
                                    <button onClick={() => setNewTx({...newTx, type: 'IN'})} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${newTx.type === 'IN' ? 'bg-emerald-500 text-white shadow-md' : 'text-gray-500'}`}>ورود کالا</button>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                <div className="space-y-4">
                                    <div className="space-y-1"><label className="text-xs font-bold text-gray-500">تحویل‌گیرنده / فرستنده</label><input className="w-full border rounded-xl p-3" value={newTx.recipient} onChange={e=>setNewTx({...newTx, recipient: e.target.value})} placeholder="نام..."/></div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1"><label className="text-xs font-bold text-gray-500">نام راننده</label><input className="w-full border rounded-xl p-3" value={newTx.driver} onChange={e=>setNewTx({...newTx, driver: e.target.value})}/></div>
                                        <div className="space-y-1"><label className="text-xs font-bold text-gray-500">پلاک</label><input className="w-full border rounded-xl p-3 text-center dir-ltr font-mono" value={newTx.plate} onChange={e=>setNewTx({...newTx, plate: e.target.value})} placeholder="12A345-67"/></div>
                                    </div>
                                    <div className="space-y-1"><label className="text-xs font-bold text-gray-500">مقصد / مبدا</label><input className="w-full border rounded-xl p-3" value={newTx.destination} onChange={e=>setNewTx({...newTx, destination: e.target.value})}/></div>
                                </div>
                                <div className="space-y-4">
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-gray-500">انتخاب کالا برای افزودن</label>
                                        <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto border rounded-xl p-2 bg-gray-50">
                                            {safeItems.filter(i => i.companyName === selectedCompany).map(item => (
                                                <button key={item.id} onClick={() => addTxItemRow(item.id)} className="flex justify-between items-center bg-white p-3 rounded-xl border border-gray-100 hover:border-indigo-300 hover:shadow-sm text-right text-sm group">
                                                    <div>
                                                        <span className="font-bold text-gray-800">{item.name}</span>
                                                        <span className="text-[10px] text-gray-400 mr-2">({item.color})</span>
                                                    </div>
                                                    <Plus size={16} className="text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity"/>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="space-y-1"><label className="text-xs font-bold text-gray-500">توضیحات</label><textarea className="w-full border rounded-xl p-3 h-[88px]" value={newTx.description} onChange={e=>setNewTx({...newTx, description: e.target.value})}/></div>
                                </div>
                            </div>

                            {/* Added Items List */}
                            <div className="border rounded-2xl overflow-hidden mb-6">
                                <table className="w-full text-right text-sm">
                                    <thead className="bg-gray-50"><tr><th className="p-3">کالا</th><th className="p-3">رنگ</th><th className="p-3 w-32">تعداد</th><th className="p-3 w-32">وزن (KG)</th><th className="p-3 w-10"></th></tr></thead>
                                    <tbody className="divide-y">
                                        {Array.isArray(newTx.items) && newTx.items.map((it, idx) => (
                                            <tr key={idx}>
                                                <td className="p-3 font-bold">{it.itemName}</td>
                                                <td className="p-3 text-xs">{it.color}</td>
                                                <td className="p-3"><input type="number" className="w-full border rounded p-1 text-center" value={it.quantity} onChange={e => { const n = [...newTx.items]; n[idx].quantity = Number(e.target.value); setNewTx({...newTx, items: n}); }}/></td>
                                                <td className="p-3"><input type="number" className="w-full border rounded p-1 text-center" value={it.weight} onChange={e => { const n = [...newTx.items]; n[idx].weight = Number(e.target.value); setNewTx({...newTx, items: n}); }}/></td>
                                                <td className="p-3"><button onClick={() => { const n = newTx.items.filter((_, i) => i !== idx); setNewTx({...newTx, items: n}); }} className="text-red-400 hover:text-red-600"><X size={16}/></button></td>
                                            </tr>
                                        ))}
                                        {(!newTx.items || newTx.items.length === 0) && <tr><td colSpan={5} className="p-8 text-center text-gray-400 italic">هیچ کالایی اضافه نشده است.</td></tr>}
                                    </tbody>
                                </table>
                            </div>

                            <button onClick={handleCreateTx} disabled={newTx.items.length === 0} className={`w-full py-4 rounded-2xl font-black text-white shadow-lg transition-all active:scale-[0.99] flex items-center justify-center gap-3 ${newTx.type === 'OUT' ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-200' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200'}`}>
                                <Check size={24}/>
                                ثبت نهایی و صدور {newTx.type === 'OUT' ? 'بیجک خروج' : 'رسید ورود'}
                            </button>
                        </div>
                    </div>
                )}

                {activeTab === 'stock' && (
                    <div className="space-y-8 p-2">
                        {Object.entries(stockData).map(([company, companyItems]) => (
                            <div key={company} className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
                                <div className="bg-gradient-to-r from-gray-800 to-slate-900 p-5 text-white flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <Building2 size={24} className="text-indigo-400"/>
                                        <span className="text-lg font-black">{company}</span>
                                    </div>
                                    <span className="bg-white/10 px-4 py-1 rounded-full text-xs font-bold">{Array.isArray(companyItems) ? companyItems.length : 0} نوع کالا</span>
                                </div>
                                <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {Array.isArray(companyItems) && companyItems.map(item => (
                                        <div key={item.id} className="p-5 border border-gray-100 rounded-2xl hover:border-indigo-300 transition-all bg-gray-50/30">
                                            <div className="flex justify-between items-start mb-4">
                                                <h4 className="font-black text-gray-800">{item.name}</h4>
                                                <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-lg border text-[10px] font-bold text-gray-500">
                                                    <Palette size={12} style={{ color: item.color }}/> {item.color || 'بدون رنگ'}
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="bg-white p-3 rounded-xl border border-gray-100">
                                                    <span className="block text-[10px] text-gray-400 font-bold mb-1 uppercase">موجودی ({item.unit})</span>
                                                    <span className={`text-xl font-black font-mono ${item.currentQty < 5 ? 'text-red-500' : 'text-indigo-600'}`}>{item.currentQty}</span>
                                                </div>
                                                <div className="bg-white p-3 rounded-xl border border-gray-100">
                                                    <span className="block text-[10px] text-gray-400 font-bold mb-1 uppercase">وزن (KG)</span>
                                                    <span className="text-xl font-black text-emerald-600 font-mono">{item.currentWeight}</span>
                                                </div>
                                            </div>
                                            <button onClick={() => { setActiveTab('kardex'); setKardexFilter({ itemId: item.id, company: item.companyName }); }} className="w-full mt-4 py-2 text-xs font-bold text-gray-500 hover:text-indigo-600 flex items-center justify-center gap-1 transition-colors">
                                                مشاهده گردش کالا <ChevronRight size={14}/>
                                            </button>
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
                            <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2"><History className="text-indigo-600"/> گزارش کاردکس و گردش کالا</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 bg-gray-50 p-4 rounded-2xl">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-500">فیلتر شرکت</label>
                                    <select className="w-full border rounded-xl p-2 bg-white" value={kardexFilter.company} onChange={e => setKardexFilter({...kardexFilter, company: e.target.value})}>
                                        <option value="">همه شرکت‌ها</option>
                                        {safeCompanies.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-500">انتخاب کالا</label>
                                    <select className="w-full border rounded-xl p-2 bg-white" value={kardexFilter.itemId} onChange={e => setKardexFilter({...kardexFilter, itemId: e.target.value})}>
                                        <option value="">همه کالاها</option>
                                        {safeItems.filter(i => !kardexFilter.company || i.companyName === kardexFilter.company).map(i => <option key={i.id} value={i.id}>{i.name} ({i.color})</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-right text-xs">
                                    <thead className="bg-gray-100 uppercase text-gray-400">
                                        <tr><th className="p-4">تاریخ</th><th className="p-4">نوع</th><th className="p-4">شماره</th><th className="p-4">تعداد (In/Out)</th><th className="p-4">وزن (In/Out)</th><th className="p-4">مانده (تعداد)</th><th className="p-4">مانده (وزن)</th></tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50 font-medium">
                                        {(() => {
                                            const filteredTxs = (safeTransactions as BrokerageTransaction[])
                                                .filter(t => (!kardexFilter.company || t.companyName === kardexFilter.company) && (t.status === 'APPROVED' || t.type === 'IN'))
                                                .sort((a, b) => a.createdAt - b.createdAt);
                                            
                                            let runningQty = 0;
                                            let runningWeight = 0;
                                            
                                            return filteredTxs.map(t => {
                                                const txItem = t.items.find(ti => !kardexFilter.itemId || ti.itemId === kardexFilter.itemId);
                                                if (!txItem) return null;
                                                
                                                if (t.type === 'IN') { runningQty += txItem.quantity; runningWeight += txItem.weight; }
                                                else { runningQty -= txItem.quantity; runningWeight -= txItem.weight; }

                                                return (
                                                    <tr key={t.id} className="hover:bg-gray-50">
                                                        <td className="p-4">{formatDate(t.date)}</td>
                                                        <td className="p-4">{t.type === 'IN' ? <span className="text-emerald-600">ورود</span> : <span className="text-rose-600">خروج</span>}</td>
                                                        <td className="p-4 font-mono font-bold">#{t.serialNumber}</td>
                                                        <td className="p-4 font-mono">{t.type === 'IN' ? `+${txItem.quantity}` : `-${txItem.quantity}`}</td>
                                                        <td className="p-4 font-mono">{t.type === 'IN' ? `+${txItem.weight}` : `-${txItem.weight}`}</td>
                                                        <td className="p-4 font-black font-mono text-indigo-700">{runningQty}</td>
                                                        <td className="p-4 font-black font-mono text-emerald-700">{runningWeight}</td>
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
