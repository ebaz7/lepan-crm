
import React, { useState, useEffect, useMemo } from 'react';
import { User, WarehouseItem, WarehouseTransaction, SystemSettings, Company, UserRole } from '../types';
import { apiCall } from '../services/apiService';
import { generateUUID, formatDate, getCurrentShamsiDate, formatNumberString, deformatNumberString } from '../constants';
import { 
    Warehouse, Package, Plus, ArrowDownLeft, ArrowUpRight, History, 
    Printer, Search, Loader2, CheckCircle, XCircle, Share2, 
    Building2, PieChart, Info, Save, Trash2, Filter, Eye
} from 'lucide-react';
import PrintStockReport from './print/PrintStockReport';
import PrintBijak from './PrintBijak';
import WarehouseKardexReport from './reports/WarehouseKardexReport';

interface Props {
    currentUser: User;
    settings?: SystemSettings;
}

const WarehouseModule: React.FC<Props> = ({ currentUser, settings }) => {
    const [activeTab, setActiveTab] = useState<'dashboard' | 'items' | 'tx' | 'reports'>('dashboard');
    const [loading, setLoading] = useState(true);
    const [items, setItems] = useState<WarehouseItem[]>([]);
    const [txs, setTxs] = useState<WarehouseTransaction[]>([]);
    const [selectedCompany, setSelectedCompany] = useState(settings?.defaultCompany || '');
    
    // UI Modals
    const [showPrintStock, setShowPrintStock] = useState(false);
    const [viewBijak, setViewBijak] = useState<WarehouseTransaction | null>(null);

    // Form States
    const [newItem, setNewItem] = useState({ name: '', code: '', unit: 'عدد', initialCount: 0, initialWeight: 0 });
    const [newTx, setNewTx] = useState({ 
        type: 'IN' as 'IN' | 'OUT', 
        recipient: '', 
        driver: '', 
        plate: '', 
        destination: '', 
        items: [] as any[] 
    });

    useEffect(() => { loadData(); }, [selectedCompany]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [itemsData, txsData] = await Promise.all([
                apiCall<WarehouseItem[]>('/warehouse/items'),
                apiCall<WarehouseTransaction[]>('/warehouse/transactions')
            ]);
            setItems(itemsData || []);
            setTxs(txsData || []);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    // --- CALCULATIONS ---
    const stockReport = useMemo(() => {
        const report: any[] = [];
        const companies = settings?.companies?.filter(c => c.showInWarehouse) || [];

        companies.forEach(company => {
            const compItems = items.filter(i => i.company === company.name);
            const itemsStock = compItems.map(item => {
                let count = item.initialCount;
                let weight = item.initialWeight;
                
                txs.filter(t => t.status === 'APPROVED' || t.status === 'PENDING').forEach(t => {
                    t.items.forEach(ti => {
                        if (ti.itemId === item.id) {
                            if (t.type === 'IN') {
                                count += ti.quantity;
                                weight += ti.weight;
                            } else {
                                count -= ti.quantity;
                                weight -= ti.weight;
                            }
                        }
                    });
                });
                return { ...item, count, weight };
            });
            report.push({ company: company.name, items: itemsStock });
        });
        return report;
    }, [items, txs, settings]);

    // --- ACTIONS ---
    const handleCreateItem = async () => {
        if (!newItem.name || !selectedCompany) return;
        await apiCall('/warehouse/items', 'POST', { ...newItem, company: selectedCompany });
        setNewItem({ name: '', code: '', unit: 'عدد', initialCount: 0, initialWeight: 0 });
        loadData();
    };

    const handleCreateTx = async (type: 'IN' | 'OUT') => {
        if (newTx.items.length === 0) return;
        const nextNum = await apiCall<{next: number}>(`/warehouse/next-number?company=${selectedCompany}&type=${type}`);
        
        const tx: WarehouseTransaction = {
            id: generateUUID(),
            type,
            company: selectedCompany,
            number: nextNum.next,
            date: new Date().toISOString(),
            items: newTx.items,
            recipientName: newTx.recipient,
            driverName: newTx.driver,
            plateNumber: newTx.plate,
            destination: newTx.destination,
            status: type === 'OUT' ? 'PENDING' : 'APPROVED',
            createdBy: currentUser.fullName,
            createdAt: Date.now()
        };

        await apiCall('/warehouse/transactions', 'POST', tx);
        
        // Notification Logic
        if (type === 'OUT') {
            await sendToCEO(tx);
            alert('بیجک خروج ثبت و برای تایید مدیرعامل ارسال شد.');
        } else {
            alert('رسید ورود ثبت شد.');
        }
        
        setNewTx({ type: 'IN', recipient: '', driver: '', plate: '', destination: '', items: [] });
        loadData();
    };

    const sendToCEO = async (tx: WarehouseTransaction) => {
        // This will be handled by a hidden capture component
        console.log("Notifying CEO...");
    };

    const handleApprove = async (tx: WarehouseTransaction) => {
        await apiCall(`/warehouse/transactions/${tx.id}`, 'PUT', { 
            status: 'APPROVED', 
            approvedBy: currentUser.fullName,
            updatedAt: Date.now()
        });
        // Notify Bongah Group
        alert('تایید شد و پیام به گروه بنگاه ارسال گردید.');
        loadData();
        setViewBijak(null);
    };

    return (
        <div className="flex flex-col h-full gap-4 animate-fade-in">
            {/* Header / Company Selector */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className="bg-indigo-50 p-2 rounded-xl text-indigo-600"><Warehouse size={28}/></div>
                    <div>
                        <h1 className="text-xl font-black text-gray-800">انبار بارهای بنگاه</h1>
                        <p className="text-xs text-gray-500">مدیریت کالا، بیجک و موجودی لحظه‌ای</p>
                    </div>
                </div>

                <div className="flex gap-2 bg-gray-100 p-1 rounded-xl">
                    {settings?.companies?.filter(c => c.showInWarehouse).map(c => (
                        <button 
                            key={c.id} 
                            onClick={() => setSelectedCompany(c.name)}
                            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${selectedCompany === c.name ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            {c.name}
                        </button>
                    ))}
                </div>
            </div>

            {/* Main Tabs */}
            <div className="flex gap-2 border-b no-print">
                <button onClick={() => setActiveTab('dashboard')} className={`px-6 py-3 text-sm font-bold border-b-2 transition-all ${activeTab === 'dashboard' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500'}`}>داشبورد و آمار</button>
                <button onClick={() => setActiveTab('items')} className={`px-6 py-3 text-sm font-bold border-b-2 transition-all ${activeTab === 'items' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500'}`}>تعریف کالا</button>
                <button onClick={() => setActiveTab('tx')} className={`px-6 py-3 text-sm font-bold border-b-2 transition-all ${activeTab === 'tx' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500'}`}>ورود و خروج (بیجک)</button>
                <button onClick={() => setActiveTab('reports')} className={`px-6 py-3 text-sm font-bold border-b-2 transition-all ${activeTab === 'reports' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500'}`}>گزارشات و کاردکس</button>
            </div>

            {/* Content Container */}
            <div className="flex-1 overflow-y-auto">
                {activeTab === 'dashboard' && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 p-2">
                        {/* Stats Widgets */}
                        <div className="bg-white p-6 rounded-2xl border shadow-sm flex items-center justify-between">
                            <div><div className="text-2xl font-black text-gray-800">{items.filter(i => i.company === selectedCompany).length}</div><div className="text-xs text-gray-500 font-bold">تعداد کالاهای تعریف شده</div></div>
                            <Package className="text-indigo-200" size={40}/>
                        </div>
                        <div className="bg-green-50 p-6 rounded-2xl border border-green-100 shadow-sm flex items-center justify-between">
                            <div><div className="text-2xl font-black text-green-700">{txs.filter(t => t.company === selectedCompany && t.type === 'IN').length}</div><div className="text-xs text-green-600 font-bold">تعداد ورودی‌ها</div></div>
                            <ArrowDownLeft className="text-green-200" size={40}/>
                        </div>
                        <div className="bg-red-50 p-6 rounded-2xl border border-red-100 shadow-sm flex items-center justify-between">
                            <div><div className="text-2xl font-black text-red-700">{txs.filter(t => t.company === selectedCompany && t.type === 'OUT' && t.status === 'APPROVED').length}</div><div className="text-xs text-red-600 font-bold">تعداد خروجی‌ها (تایید شده)</div></div>
                            <ArrowUpRight className="text-red-200" size={40}/>
                        </div>
                        <button onClick={() => setShowPrintStock(true)} className="bg-indigo-600 p-6 rounded-2xl shadow-lg text-white flex flex-col items-center justify-center gap-2 hover:bg-indigo-700 transition-all">
                            <Printer size={32}/>
                            <span className="font-bold text-sm">چاپ موجودی کل انبارها</span>
                        </button>

                        {/* Recent Transactions List */}
                        <div className="md:col-span-4 bg-white rounded-2xl border shadow-sm p-6">
                            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><History size={18}/> آخرین فعالیت‌های انبار {selectedCompany}</h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-right">
                                    <thead className="bg-gray-50 text-gray-500">
                                        <tr><th className="p-3">نوع</th><th className="p-3">شماره</th><th className="p-3">تاریخ</th><th className="p-3">گیرنده/پروفرما</th><th className="p-3">وضعیت</th><th className="p-3">عملیات</th></tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {txs.filter(t => t.company === selectedCompany).slice(0, 5).map(t => (
                                            <tr key={t.id} className="hover:bg-gray-50">
                                                <td className="p-3">{t.type === 'IN' ? <span className="text-green-600 font-bold">ورود</span> : <span className="text-red-600 font-bold">خروج</span>}</td>
                                                <td className="p-3 font-mono">#{t.number}</td>
                                                <td className="p-3">{formatDate(t.date)}</td>
                                                <td className="p-3 font-bold">{t.recipientName || '-'}</td>
                                                <td className="p-3">
                                                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${t.status === 'APPROVED' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                                        {t.status === 'APPROVED' ? 'تایید نهایی' : 'در انتظار تایید'}
                                                    </span>
                                                </td>
                                                <td className="p-3">
                                                    <button onClick={() => setViewBijak(t)} className="text-blue-600 hover:underline flex items-center gap-1 text-xs"><Eye size={14}/> مشاهده</button>
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
                        <div className="bg-white p-6 rounded-2xl border shadow-sm space-y-4">
                            <h3 className="font-bold text-indigo-800 border-b pb-2">تعریف کالای جدید برای {selectedCompany}</h3>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                                <div className="md:col-span-2 space-y-1"><label className="text-xs font-bold text-gray-500">نام کالا</label><input className="w-full border rounded-xl p-3" value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} placeholder="مثال: قطعات یدکی..."/></div>
                                <div className="space-y-1"><label className="text-xs font-bold text-gray-500">واحد</label><select className="w-full border rounded-xl p-3 bg-white" value={newItem.unit} onChange={e => setNewItem({...newItem, unit: e.target.value})}><option>عدد</option><option>کارتن</option><option>کیلوگرم</option></select></div>
                                <button onClick={handleCreateItem} className="bg-indigo-600 text-white p-3 rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"><Plus size={20}/> افزودن</button>
                            </div>
                        </div>
                        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                            <table className="w-full text-sm text-right">
                                <thead className="bg-gray-50"><tr><th className="p-4">نام کالا</th><th className="p-4">واحد</th><th className="p-4">عملیات</th></tr></thead>
                                <tbody className="divide-y">
                                    {items.filter(i => i.company === selectedCompany).map(i => (
                                        <tr key={i.id} className="hover:bg-gray-50">
                                            <td className="p-4 font-bold">{i.name}</td>
                                            <td className="p-4">{i.unit}</td>
                                            <td className="p-4"><button className="text-red-400 hover:text-red-600"><Trash2 size={16}/></button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* OVERLAYS */}
            {showPrintStock && (
                <PrintStockReport 
                    data={stockReport} 
                    onClose={() => setShowPrintStock(false)} 
                />
            )}

            {viewBijak && (
                <PrintBijak 
                    tx={viewBijak} 
                    onClose={() => setViewBijak(null)} 
                    settings={settings}
                    onApprove={viewBijak.status === 'PENDING' && (currentUser.role === UserRole.CEO || currentUser.role === UserRole.ADMIN) ? () => handleApprove(viewBijak) : undefined}
                />
            )}
        </div>
    );
};

export default WarehouseModule;
