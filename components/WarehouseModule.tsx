import React, { useState, useEffect, useMemo } from 'react';
import { User, SystemSettings, WarehouseItem, WarehouseTransaction, WarehouseTransactionItem, UserRole } from '../types';
import { getWarehouseItems, saveWarehouseItem, deleteWarehouseItem, getWarehouseTransactions, saveWarehouseTransaction, deleteWarehouseTransaction, updateWarehouseTransaction, getNextBijakNumber, updateWarehouseItem } from '../services/storageService';
import { generateUUID, getCurrentShamsiDate, jalaliToGregorian, formatNumberString, deformatNumberString, formatDate } from '../constants';
import { Package, Plus, Trash2, ArrowDownCircle, ArrowUpCircle, Eye, Loader2, AlertTriangle, Settings, Search, FileClock, Printer, FileDown, Edit, Save, X, RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import PrintBijak from './PrintBijak';
import PrintStockReport from './print/PrintStockReport'; 
import WarehouseKardexReport from './reports/WarehouseKardexReport';
import { apiCall } from '../services/apiService';
import { getUsers } from '../services/authService';

interface Props { 
    currentUser: User; 
    settings?: SystemSettings; 
    initialTab?: 'dashboard' | 'items' | 'entry' | 'exit' | 'reports' | 'stock_report' | 'archive' | 'entry_archive' | 'approvals';
}

const WarehouseModule: React.FC<Props> = ({ currentUser, settings, initialTab = 'dashboard' }) => {
    const [loadingData, setLoadingData] = useState(true);
    const [activeTab, setActiveTab] = useState(initialTab);
    const [items, setItems] = useState<WarehouseItem[]>([]);
    const [transactions, setTransactions] = useState<WarehouseTransaction[]>([]);
    
    // New Item State
    const [newItemName, setNewItemName] = useState('');
    const [newItemCode, setNewItemCode] = useState('');
    const [newItemUnit, setNewItemUnit] = useState('عدد');
    const [newItemCapacity, setNewItemCapacity] = useState('');

    // Editing State
    const [editingItem, setEditingItem] = useState<WarehouseItem | null>(null);

    // Transaction State
    const currentShamsi = getCurrentShamsiDate();
    const [txDate, setTxDate] = useState({ year: currentShamsi.year, month: currentShamsi.month, day: currentShamsi.day });
    const [selectedCompany, setSelectedCompany] = useState('');
    const [txItems, setTxItems] = useState<Partial<WarehouseTransactionItem>[]>([{ itemId: '', quantity: 0, weight: 0, unitPrice: 0 }]);
    const [proformaNumber, setProformaNumber] = useState('');
    const [recipientName, setRecipientName] = useState('');
    const [driverName, setDriverName] = useState('');
    const [plateNumber, setPlateNumber] = useState('');
    const [destination, setDestination] = useState('');
    const [nextBijakNum, setNextBijakNum] = useState<number>(0);
    const [loadingBijakNum, setLoadingBijakNum] = useState(false);
    
    const [viewBijak, setViewBijak] = useState<WarehouseTransaction | null>(null);
    const [showPrintStockReport, setShowPrintStockReport] = useState(false); 

    useEffect(() => { loadData(); }, []);
    useEffect(() => { setActiveTab(initialTab); }, [initialTab]);
    
    useEffect(() => { 
        if(selectedCompany && activeTab === 'exit') { 
            updateNextBijak(); 
        } 
    }, [selectedCompany, activeTab]);

    const loadData = async () => { 
        setLoadingData(true); 
        try { 
            const [i, t] = await Promise.all([getWarehouseItems(), getWarehouseTransactions()]); 
            setItems(Array.isArray(i) ? i : []); 
            setTransactions(Array.isArray(t) ? t : []); 
        } catch (e) { 
            console.error(e); 
            setItems([]);
            setTransactions([]);
        } finally { 
            setLoadingData(false); 
        } 
    };
    
    const updateNextBijak = async () => { 
        if(!selectedCompany) return;
        setLoadingBijakNum(true);
        try {
            const num = await getNextBijakNumber(selectedCompany);
            setNextBijakNum(num);
        } catch(e) {
            setNextBijakNum(1001);
        } finally {
            setLoadingBijakNum(false);
        }
    };
    
    const getIsoDate = () => { 
        try { 
            const date = jalaliToGregorian(txDate.year, txDate.month, txDate.day); 
            return date.toISOString(); 
        } catch { return new Date().toISOString(); } 
    };
    
    const handleAddItem = async () => { 
        if(!newItemName) return; 
        try {
            await saveWarehouseItem({ 
                id: generateUUID(), 
                name: newItemName, 
                code: newItemCode, 
                unit: newItemUnit, 
                containerCapacity: Number(newItemCapacity) || 0 
            }); 
            setNewItemName(''); 
            setNewItemCode(''); 
            setNewItemCapacity('');
            await loadData(); 
            alert('کالا با موفقیت تعریف شد.');
        } catch (e) { alert('خطا در تعریف کالا'); }
    };
    
    const handleEditItem = async () => {
        if (!editingItem) return;
        try {
            await updateWarehouseItem(editingItem);
            setEditingItem(null);
            await loadData();
            alert('تغییرات کالا ذخیره شد.');
        } catch (e) { alert('خطا در ویرایش کالا'); }
    };

    const handleDeleteItem = async (id: string) => { if(confirm('آیا از حذف این کالا اطمینان دارید؟')) { await deleteWarehouseItem(id); loadData(); } };
    
    const handleAddTxItemRow = () => setTxItems([...txItems, { itemId: '', quantity: 0, weight: 0, unitPrice: 0 }]);
    const handleRemoveTxItemRow = (idx: number) => setTxItems(txItems.filter((_, i) => i !== idx));
    
    const updateTxItem = (idx: number, field: keyof WarehouseTransactionItem, val: any) => { 
        const newItems = [...txItems]; 
        newItems[idx] = { ...newItems[idx], [field]: val }; 
        if(field === 'itemId') { 
            const item = items.find(i => i.id === val); 
            if(item) newItems[idx].itemName = item.name; 
        } 
        setTxItems(newItems); 
    };

    const handleSubmitTx = async (type: 'IN' | 'OUT') => {
        if(!selectedCompany) return alert('لطفاً شرکت را انتخاب کنید');
        if(txItems.some(i => !i.itemId || !i.quantity)) return alert('لطفاً مشخصات اقلام را کامل کنید');

        const validItems = txItems.map(i => ({ 
            itemId: i.itemId!, 
            itemName: i.itemName!, 
            quantity: Number(i.quantity), 
            weight: Number(i.weight), 
            unitPrice: Number(i.unitPrice)||0 
        }));

        const tx: WarehouseTransaction = { 
            id: generateUUID(), 
            type, 
            date: getIsoDate(), 
            company: selectedCompany, 
            number: type === 'IN' ? 0 : nextBijakNum, 
            items: validItems, 
            createdAt: Date.now(), 
            createdBy: currentUser.fullName, 
            proformaNumber: type === 'IN' ? proformaNumber : undefined, 
            recipientName: type === 'OUT' ? recipientName : undefined, 
            driverName: type === 'OUT' ? driverName : undefined, 
            plateNumber: type === 'OUT' ? plateNumber : undefined, 
            destination: type === 'OUT' ? destination : undefined,
            status: type === 'OUT' ? 'PENDING' : undefined 
        };

        try {
            await saveWarehouseTransaction(tx);
            await loadData();
            if(type === 'OUT') {
                updateNextBijak();
                alert('بیجک با موفقیت ثبت و در صف تایید قرار گرفت.');
                setRecipientName(''); setDriverName(''); setPlateNumber(''); setDestination('');
            } else {
                setProformaNumber(''); 
                alert('رسید انبار با موفقیت ثبت شد.');
            }
            setTxItems([{ itemId: '', quantity: 0, weight: 0, unitPrice: 0 }]);
        } catch (e) { alert('خطا در ثبت تراکنش'); }
    };

    const handleApproveBijak = async (tx: WarehouseTransaction) => {
        if (!confirm('آیا این بیجک را تایید می‌کنید؟')) return;
        try {
            await updateWarehouseTransaction({ ...tx, status: 'APPROVED', approvedBy: currentUser.fullName });
            loadData();
            alert('بیجک تایید شد.');
        } catch (e) { alert('خطا در تایید'); }
    };

    const safeTransactions = Array.isArray(transactions) ? transactions : [];

    const allWarehousesStock = useMemo(() => {
        const companies = settings?.companies?.filter(c => c.showInWarehouse !== false).map(c => c.name) || [];
        return companies.map(company => {
            const companyItems = items.map(catalogItem => {
                let quantity = 0; let weight = 0;
                safeTransactions.filter(tx => tx.company === company && tx.status !== 'REJECTED').forEach(tx => {
                    tx.items.forEach(txItem => {
                        if (txItem.itemId === catalogItem.id) {
                            if (tx.type === 'IN') { quantity += txItem.quantity; weight += txItem.weight; } 
                            else { quantity -= txItem.quantity; weight -= txItem.weight; }
                        }
                    });
                });
                const containerCapacity = catalogItem.containerCapacity || 0;
                const containerCount = (containerCapacity > 0 && quantity > 0) ? (quantity / containerCapacity) : 0;
                return { id: catalogItem.id, name: catalogItem.name, quantity, weight, containerCount };
            });
            return { company, items: companyItems };
        });
    }, [safeTransactions, items, settings]);

    const companyList = settings?.companies?.filter(c => c.showInWarehouse !== false).map(c => c.name) || [];
    const years = Array.from({length:10},(_,i)=>1400+i); const months = Array.from({length:12},(_,i)=>i+1); const days = Array.from({length:31},(_,i)=>i+1);

    return (
        <div className="bg-white rounded-2xl shadow-sm border h-[calc(100vh-100px)] flex flex-col overflow-hidden animate-fade-in">
            {showPrintStockReport && (<PrintStockReport data={allWarehousesStock} onClose={() => setShowPrintStockReport(false)} />)}

            <div className="bg-gray-100 p-2 flex gap-2 border-b overflow-x-auto no-print">
                <button onClick={() => setActiveTab('dashboard')} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap ${activeTab === 'dashboard' ? 'bg-white text-blue-600 shadow' : 'text-gray-600'}`}>داشبورد</button>
                <button onClick={() => setActiveTab('items')} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap ${activeTab === 'items' ? 'bg-white text-blue-600 shadow' : 'text-gray-600'}`}>تعریف کالا</button>
                <button onClick={() => setActiveTab('entry')} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap ${activeTab === 'entry' ? 'bg-white text-green-600 shadow' : 'text-gray-600'}`}>ورود (رسید)</button>
                <button onClick={() => setActiveTab('exit')} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap ${activeTab === 'exit' ? 'bg-white text-red-600 shadow' : 'text-gray-600'}`}>خروج (بیجک)</button>
                <button onClick={() => setActiveTab('archive')} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap ${activeTab === 'archive' ? 'bg-white text-gray-800 shadow' : 'text-gray-600'}`}>بایگانی</button>
                <button onClick={() => setActiveTab('stock_report')} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap ${activeTab === 'stock_report' ? 'bg-white text-orange-600 shadow' : 'text-gray-600'}`}>موجودی</button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
                {activeTab === 'dashboard' && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 flex items-center justify-between">
                            <div><div className="text-3xl font-black text-blue-700">{items.length}</div><div className="text-sm text-blue-600 font-bold">کالاهای تعریف شده</div></div>
                            <Package size={40} className="text-blue-200"/>
                        </div>
                        <div className="bg-green-50 p-6 rounded-2xl border border-green-100 flex items-center justify-between">
                            <div><div className="text-3xl font-black text-green-700">{safeTransactions.filter(t=>t.type==='IN').length}</div><div className="text-sm text-green-600 font-bold">رسیدهای صادر شده</div></div>
                            <ArrowDownCircle size={40} className="text-green-200"/>
                        </div>
                        <div className="bg-red-50 p-6 rounded-2xl border border-red-100 flex items-center justify-between">
                            <div><div className="text-3xl font-black text-red-700">{safeTransactions.filter(t=>t.type==='OUT').length}</div><div className="text-sm text-red-600 font-bold">بیجک‌های صادر شده</div></div>
                            <ArrowUpCircle size={40} className="text-red-200"/>
                        </div>
                    </div>
                )}

                {activeTab === 'items' && (
                    <div className="max-w-4xl mx-auto space-y-6">
                        {editingItem ? (
                            <div className="bg-amber-50 p-5 rounded-2xl border border-amber-200 flex flex-wrap gap-4 items-end animate-fade-in">
                                <div className="flex-1 min-w-[200px]"><label className="text-xs font-bold block mb-1">نام کالا (در حال ویرایش)</label><input className="w-full border rounded-lg p-2 bg-white" value={editingItem.name} onChange={e=>setEditingItem({...editingItem, name: e.target.value})}/></div>
                                <div className="w-32"><label className="text-xs font-bold block mb-1">کد کالا</label><input className="w-full border rounded-lg p-2 bg-white" value={editingItem.code} onChange={e=>setEditingItem({...editingItem, code: e.target.value})}/></div>
                                <div className="w-32"><label className="text-xs font-bold block mb-1">واحد</label><select className="w-full border rounded-lg p-2 bg-white" value={editingItem.unit} onChange={e=>setEditingItem({...editingItem, unit: e.target.value})}><option>عدد</option><option>کارتن</option><option>کیلوگرم</option></select></div>
                                <div className="flex gap-2">
                                    <button onClick={handleEditItem} className="bg-green-600 text-white p-2 px-6 rounded-lg font-bold hover:bg-green-700 h-[42px] flex items-center gap-1"><Save size={18}/> ذخیره</button>
                                    <button onClick={()=>setEditingItem(null)} className="bg-gray-400 text-white p-2 px-4 rounded-lg font-bold hover:bg-gray-500 h-[42px]">انصراف</button>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-gray-50 p-5 rounded-2xl border border-gray-200 flex flex-wrap gap-4 items-end">
                                <div className="flex-1 min-w-[200px]"><label className="text-xs font-bold block mb-1">نام کالا</label><input className="w-full border rounded-lg p-2" value={newItemName} onChange={e=>setNewItemName(e.target.value)}/></div>
                                <div className="w-32"><label className="text-xs font-bold block mb-1">کد کالا</label><input className="w-full border rounded-lg p-2" value={newItemCode} onChange={e=>setNewItemCode(e.target.value)}/></div>
                                <div className="w-32"><label className="text-xs font-bold block mb-1">واحد</label><select className="w-full border rounded-lg p-2 bg-white" value={newItemUnit} onChange={e=>setNewItemUnit(e.target.value)}><option>عدد</option><option>کارتن</option><option>کیلوگرم</option></select></div>
                                <button onClick={handleAddItem} className="bg-blue-600 text-white p-2 px-6 rounded-lg font-bold hover:bg-blue-700 h-[42px] flex items-center gap-1"><Plus size={18}/> افزودن</button>
                            </div>
                        )}
                        <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
                            <table className="w-full text-sm text-right">
                                <thead className="bg-gray-100"><tr><th className="p-3">کد</th><th className="p-3">نام کالا</th><th className="p-3">واحد</th><th className="p-3 text-center">عملیات</th></tr></thead>
                                <tbody>
                                    {items.map(i => (
                                        <tr key={i.id} className="border-t hover:bg-gray-50 transition-colors">
                                            <td className="p-3 font-mono">{i.code}</td>
                                            <td className="p-3 font-bold">{i.name}</td>
                                            <td className="p-3">{i.unit}</td>
                                            <td className="p-3 text-center flex justify-center gap-2">
                                                <button onClick={()=>setEditingItem(i)} className="text-amber-500 hover:bg-amber-50 p-1 rounded transition-colors"><Edit size={16}/></button>
                                                <button onClick={()=>handleDeleteItem(i.id)} className="text-red-500 hover:bg-red-50 p-1 rounded transition-colors"><Trash2 size={16}/></button>
                                            </td>
                                        </tr>
                                    ))}
                                    {items.length === 0 && <tr><td colSpan={4} className="p-12 text-center text-gray-400 flex flex-col items-center gap-2"><Package size={48} className="opacity-20"/><span className="font-bold">هنوز کالایی تعریف نشده است.</span></td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'exit' && (
                    <div className="max-w-4xl mx-auto bg-red-50 p-6 rounded-2xl border border-red-200">
                        <h3 className="font-bold text-red-800 mb-4 flex items-center gap-2"><ArrowUpCircle/> صدور بیجک خروج</h3>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                            <div><label className="block text-xs font-bold mb-1">شرکت فرستنده</label><select className="w-full border rounded p-2 bg-white" value={selectedCompany} onChange={e=>setSelectedCompany(e.target.value)}><option value="">انتخاب...</option>{companyList.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
                            <div><label className="block text-xs font-bold mb-1">شماره بیجک</label><div className="bg-white p-2 rounded border font-mono text-center text-red-600 font-bold h-[38px]">{loadingBijakNum ? '...' : nextBijakNum}</div></div>
                            <div><label className="block text-xs font-bold mb-1">تاریخ</label><div className="flex gap-1 dir-ltr"><select className="border rounded p-1 text-xs" value={txDate.day} onChange={e=>setTxDate({...txDate, day:+e.target.value})}>{days.map(d=><option key={d} value={d}>{d}</option>)}</select><select className="border rounded p-1 text-xs" value={txDate.month} onChange={e=>setTxDate({...txDate, month:+e.target.value})}>{months.map(m=><option key={m} value={m}>{m}</option>)}</select><select className="border rounded p-1 text-xs" value={txDate.year} onChange={e=>setTxDate({...txDate, year:+e.target.value})}>{years.map(y=><option key={y} value={y}>{y}</option>)}</select></div></div>
                            <div><label className="block text-xs font-bold mb-1">تحویل گیرنده</label><input className="w-full border rounded p-2 bg-white" value={recipientName} onChange={e=>setRecipientName(e.target.value)}/></div>
                        </div>
                        <div className="bg-white p-4 rounded-xl border space-y-3 mb-4">
                            {txItems.map((row, idx) => (
                                <div key={idx} className="flex gap-2 items-end">
                                    <div className="flex-1"><label className="text-[10px] text-gray-400">نام کالا</label><select className="w-full border rounded p-2 text-sm" value={row.itemId} onChange={e=>updateTxItem(idx, 'itemId', e.target.value)}><option value="">انتخاب...</option>{items.map(i=><option key={i.id} value={i.id}>{i.name}</option>)}</select></div>
                                    <div className="w-24"><label className="text-[10px] text-gray-400">تعداد</label><input type="number" className="w-full border rounded p-2 text-sm text-center font-bold" value={row.quantity} onChange={e=>updateTxItem(idx, 'quantity', e.target.value)}/></div>
                                    <div className="w-24"><label className="text-[10px] text-gray-400">وزن (KG)</label><input type="number" className="w-full border rounded p-2 text-sm text-center font-bold" value={row.weight} onChange={e=>updateTxItem(idx, 'weight', e.target.value)}/></div>
                                    {idx > 0 && <button onClick={()=>handleRemoveTxItemRow(idx)} className="text-red-400 mb-1 hover:bg-red-50 p-1 rounded"><Trash2 size={20}/></button>}
                                </div>
                            ))}
                            <button onClick={handleAddTxItemRow} className="text-xs text-blue-600 font-bold flex items-center gap-1 hover:underline"><Plus size={14}/> افزودن ردیف کالا</button>
                        </div>
                        <button onClick={()=>handleSubmitTx('OUT')} disabled={!selectedCompany || txItems.some(i=>!i.itemId)} className="w-full bg-red-600 text-white font-bold py-4 rounded-xl hover:bg-red-700 shadow-lg shadow-red-200 transition-all disabled:opacity-50 flex items-center justify-center gap-2"><CheckCircle size={20}/> ثبت و ارسال جهت تایید مدیریت</button>
                    </div>
                )}

                {activeTab === 'entry' && (
                    <div className="max-w-4xl mx-auto bg-green-50 p-6 rounded-2xl border border-green-200">
                        <h3 className="font-bold text-green-800 mb-4 flex items-center gap-2"><ArrowDownCircle/> ثبت رسید ورود به انبار</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                            <div><label className="block text-xs font-bold mb-1">شرکت انبار</label><select className="w-full border rounded p-2 bg-white" value={selectedCompany} onChange={e=>setSelectedCompany(e.target.value)}><option value="">انتخاب...</option>{companyList.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
                            <div><label className="block text-xs font-bold mb-1">شماره پروفرما / بارنامه</label><input className="w-full border rounded p-2 bg-white dir-ltr font-mono" value={proformaNumber} onChange={e=>setProformaNumber(e.target.value)}/></div>
                            <div><label className="block text-xs font-bold mb-1">تاریخ ورود</label><div className="flex gap-1 dir-ltr"><select className="border rounded p-1 text-xs" value={txDate.day} onChange={e=>setTxDate({...txDate, day:+e.target.value})}>{days.map(d=><option key={d} value={d}>{d}</option>)}</select><select className="border rounded p-1 text-xs" value={txDate.month} onChange={e=>setTxDate({...txDate, month:+e.target.value})}>{months.map(m=><option key={m} value={m}>{m}</option>)}</select><select className="border rounded p-1 text-xs" value={txDate.year} onChange={e=>setTxDate({...txDate, year:+e.target.value})}>{years.map(y=><option key={y} value={y}>{y}</option>)}</select></div></div>
                        </div>
                        <div className="bg-white p-4 rounded-xl border space-y-3 mb-4">
                            {txItems.map((row, idx) => (
                                <div key={idx} className="flex gap-2 items-end">
                                    <div className="flex-1"><label className="text-[10px] text-gray-400">نام کالا</label><select className="w-full border rounded p-2 text-sm" value={row.itemId} onChange={e=>updateTxItem(idx, 'itemId', e.target.value)}><option value="">انتخاب کالا...</option>{items.map(i=><option key={i.id} value={i.id}>{i.name}</option>)}</select></div>
                                    <div className="w-24"><label className="text-[10px] text-gray-400">تعداد</label><input type="number" className="w-full border rounded p-2 text-sm text-center font-bold" value={row.quantity} onChange={e=>updateTxItem(idx, 'quantity', e.target.value)}/></div>
                                    <div className="w-24"><label className="text-[10px] text-gray-400">وزن (KG)</label><input type="number" className="w-full border rounded p-2 text-sm text-center font-bold" value={row.weight} onChange={e=>updateTxItem(idx, 'weight', e.target.value)}/></div>
                                    {idx > 0 && <button onClick={()=>handleRemoveTxItemRow(idx)} className="text-red-400 mb-1 hover:bg-red-50 p-1 rounded"><Trash2 size={20}/></button>}
                                </div>
                            ))}
                            <button onClick={handleAddTxItemRow} className="text-xs text-blue-600 font-bold flex items-center gap-1 hover:underline"><Plus size={14}/> افزودن ردیف کالا</button>
                        </div>
                        <button onClick={()=>handleSubmitTx('IN')} disabled={!selectedCompany || txItems.some(i=>!i.itemId)} className="w-full bg-green-600 text-white font-bold py-4 rounded-xl hover:bg-green-700 shadow-lg shadow-green-200 transition-all disabled:opacity-50 flex items-center justify-center gap-2"><CheckCircle size={20}/> ثبت رسید انبار</button>
                    </div>
                )}

                {activeTab === 'archive' && (
                    <div className="space-y-4">
                        <div className="flex flex-col md:flex-row justify-between items-center bg-gray-50 p-4 rounded-xl border gap-4">
                            <h3 className="font-bold text-gray-700 flex items-center gap-2"><ArrowUpCircle className="text-red-500"/> بایگانی بیجک‌های خروجی</h3>
                            <div className="flex flex-wrap gap-2 w-full md:w-auto">
                                <div className="relative flex-1 md:w-64"><Search className="absolute right-2 top-2.5 text-gray-400" size={16}/><input className="w-full border rounded-lg p-2 pr-8 text-xs" placeholder="جستجو شماره یا گیرنده..." /></div>
                                <select className="border rounded-lg p-2 text-xs bg-white" value={selectedCompany} onChange={e=>setSelectedCompany(e.target.value)}><option value="">همه شرکت‌ها</option>{companyList.map(c=><option key={c} value={c}>{c}</option>)}</select>
                            </div>
                        </div>
                        <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
                            <table className="w-full text-xs text-right">
                                <thead className="bg-gray-100"><tr><th className="p-3">شماره</th><th className="p-3">تاریخ</th><th className="p-3">شرکت</th><th className="p-3">گیرنده</th><th className="p-3">وضعیت</th><th className="p-3 text-center">عملیات</th></tr></thead>
                                <tbody className="divide-y">
                                    {safeTransactions.filter(t=>t.type==='OUT').map(tx => (
                                        <tr key={tx.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="p-3 font-mono font-bold text-red-600">#{tx.number}</td>
                                            <td className="p-3">{formatDate(tx.date)}</td>
                                            <td className="p-3">{tx.company}</td>
                                            <td className="p-3 font-bold">{tx.recipientName}</td>
                                            <td className="p-3"><span className={`px-2 py-0.5 rounded font-bold ${tx.status === 'APPROVED' ? 'bg-green-100 text-green-700' : tx.status === 'REJECTED' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{tx.status === 'APPROVED' ? 'تایید نهایی' : tx.status === 'REJECTED' ? 'رد شده' : 'در انتظار'}</span></td>
                                            <td className="p-3 text-center flex justify-center gap-2">
                                                <button onClick={()=>setViewBijak(tx)} className="text-blue-600 hover:bg-blue-50 px-2 py-1 rounded transition-colors font-bold flex items-center gap-1"><Eye size={14}/> مشاهده</button>
                                            </td>
                                        </tr>
                                    ))}
                                    {safeTransactions.filter(t=>t.type==='OUT').length === 0 && <tr><td colSpan={6} className="p-12 text-center text-gray-400">هیچ بیجکی یافت نشد.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
                
                {activeTab === 'stock_report' && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center bg-gray-50 p-4 rounded-xl border">
                            <h3 className="font-bold text-gray-700 flex items-center gap-2"><Package className="text-orange-500"/> گزارش لحظه‌ای موجودی انبارها</h3>
                            <button onClick={() => setShowPrintStockReport(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-md hover:bg-blue-700"><Printer size={18}/> چاپ گزارش</button>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {allWarehousesStock.map(wh => (
                                <div key={wh.company} className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                                    <div className="bg-blue-600 p-3 text-white font-bold flex justify-between items-center">
                                        <span>{wh.company}</span>
                                        <Package size={18}/>
                                    </div>
                                    <div className="p-2">
                                        <table className="w-full text-[11px] text-right">
                                            <thead><tr className="text-gray-400 border-b"><th>نام کالا</th><th className="text-center">کارتن</th><th className="text-center">وزن</th></tr></thead>
                                            <tbody className="divide-y">
                                                {wh.items.filter(i => i.quantity !== 0).map(i => (
                                                    <tr key={i.id} className="hover:bg-gray-50">
                                                        <td className="p-2 font-bold">{i.name}</td>
                                                        <td className={`p-2 text-center font-mono font-bold ${i.quantity < 0 ? 'text-red-500' : 'text-blue-700'}`}>{i.quantity}</td>
                                                        <td className="p-2 text-center font-mono">{i.weight}</td>
                                                    </tr>
                                                ))}
                                                {wh.items.filter(i => i.quantity !== 0).length === 0 && <tr><td colSpan={3} className="p-6 text-center text-gray-300">موجودی انبار خالی است.</td></tr>}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
            
            {viewBijak && (
                <PrintBijak 
                    tx={viewBijak} 
                    onClose={() => setViewBijak(null)} 
                    settings={settings}
                    onApprove={viewBijak.status === 'PENDING' && (currentUser.role === UserRole.CEO || currentUser.role === UserRole.ADMIN) ? () => handleApproveBijak(viewBijak) : undefined}
                />
            )}
        </div>
    );
};

export default WarehouseModule;
