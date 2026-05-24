
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { User, SystemSettings, WarehouseItem, WarehouseTransaction, WarehouseTransactionItem, UserRole } from '../types';
import { getWarehouseItems, saveWarehouseItem, deleteWarehouseItem, getWarehouseTransactions, saveWarehouseTransaction, deleteWarehouseTransaction, updateWarehouseTransaction, getNextBijakNumber, updateWarehouseItem } from '../services/storageService';
import { generateUUID, getCurrentShamsiDate, jalaliToGregorian, formatNumberString, deformatNumberString, formatDate, parsePersianDate, getShamsiDateFromIso } from '../constants';
import { Package, Plus, Trash2, ArrowDownCircle, ArrowUpCircle, FileText, BarChart3, Eye, Loader2, AlertTriangle, Settings, ArrowLeftRight, Search, FileClock, Printer, FileDown, Share2, LayoutGrid, Archive, Edit, Save, X, Container, CheckCircle, XCircle, RefreshCcw, FileSpreadsheet, WifiOff, Filter, Calendar, ShieldCheck, Users, Home, List, Navigation, Send, RefreshCw } from 'lucide-react';
import PrintBijak from './PrintBijak';
import PrintStockReport from './print/PrintStockReport'; 
import WarehouseKardexReport from './reports/WarehouseKardexReport';
import { apiCall } from '../services/apiService';
import { getUsers } from '../services/authService';
import html2canvas from 'html2canvas';
import useIsMobile from '../hooks/useIsMobile';

import { isInFinancialYear } from '../utils/dateUtils';

interface Props { 
    currentUser: User; 
    settings?: SystemSettings; 
    initialTab?: 'dashboard' | 'items' | 'entry' | 'exit' | 'reports' | 'stock_report' | 'archive' | 'entry_archive' | 'approvals';
    financialYear?: string;
}

// Internal Edit Modal Component
const TransactionEditModal = ({ tx, onClose, onSave, items }: { tx: WarehouseTransaction, onClose: () => void, onSave: (tx: WarehouseTransaction) => void, items: WarehouseItem[] }) => {
    const [formData, setFormData] = useState({ ...tx });
    const [txItems, setTxItems] = useState<WarehouseTransactionItem[]>(tx.items || []);

    const handleItemChange = (idx: number, field: keyof WarehouseTransactionItem, value: any) => {
        const newItems = [...txItems];
        newItems[idx] = { ...newItems[idx], [field]: value };
        if (field === 'itemId') {
            const selected = items.find(i => i.id === value);
            if (selected) newItems[idx].itemName = selected.name;
        }
        setTxItems(newItems);
    };

    const addItem = () => setTxItems([...txItems, { itemId: '', itemName: '', quantity: 0, weight: 0, unitPrice: 0 }]);
    const removeItem = (idx: number) => setTxItems(txItems.filter((_, i) => i !== idx));

    const handleSave = () => {
        onSave({ ...formData, items: txItems });
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[150] flex items-center justify-center p-0 md:p-4 animate-fade-in backdrop-blur-sm">
            <div className="glass-panel rounded-none md:rounded-3xl shadow-2xl w-full max-w-4xl h-full md:h-auto md:max-h-[90vh] flex flex-col overflow-hidden border-0 md:border md:border-white/20">
                <div className="p-4 md:p-6 border-b flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/60 backdrop-blur-md text-gray-800 dark:text-gray-200">
                    <div className="flex items-center gap-2">
                        <div className={`p-2 rounded-lg ${tx.type === 'IN' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                            {tx.type === 'IN' ? <ArrowDownCircle size={20}/> : <ArrowUpCircle size={20}/>}
                        </div>
                        <h3 className="font-black text-gray-800 dark:text-white text-base md:text-lg">ویرایش {tx.type === 'IN' ? 'رسید انبار' : 'بیجک خروج'}</h3>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-red-50 hover:text-red-500 rounded-full transition-colors"><X size={24}/></button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 custom-scrollbar bg-white dark:bg-black/20">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                        {tx.type === 'OUT' && (
                            <>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mr-2">شماره بیجک</label>
                                    <input type="number" className="w-full border-2 border-gray-100 dark:border-white/5 rounded-xl p-3 font-bold bg-gray-50 dark:bg-gray-800 outline-none focus:border-red-400 transition-all" value={formData.number} onChange={e => setFormData({...formData, number: Number(e.target.value)})} />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mr-2">گیرنده نهایی</label>
                                    <input className="w-full border-2 border-gray-100 dark:border-white/5 rounded-xl p-3 font-bold bg-gray-50 dark:bg-gray-800 outline-none focus:border-red-400 transition-all" value={formData.recipientName || ''} onChange={e => setFormData({...formData, recipientName: e.target.value})} />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mr-2">راننده</label>
                                    <input className="w-full border-2 border-gray-100 dark:border-white/5 rounded-xl p-3 font-bold bg-gray-50 dark:bg-gray-800 outline-none focus:border-red-400 transition-all" value={formData.driverName || ''} onChange={e => setFormData({...formData, driverName: e.target.value})} />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mr-2">پلاک خودرو</label>
                                    <input className="w-full border-2 border-gray-100 dark:border-white/5 rounded-xl p-3 font-bold bg-gray-50 dark:bg-gray-800 outline-none focus:border-red-400 transition-all text-center dir-ltr" value={formData.plateNumber || ''} onChange={e => setFormData({...formData, plateNumber: e.target.value})} />
                                </div>
                            </>
                        )}
                        {tx.type === 'IN' && (
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mr-2">شماره پروفرما / سند</label>
                                <input className="w-full border-2 border-gray-100 dark:border-white/5 rounded-xl p-3 font-bold bg-gray-50 dark:bg-gray-800 outline-none focus:border-green-400 transition-all" value={formData.proformaNumber || ''} onChange={e => setFormData({...formData, proformaNumber: e.target.value})} />
                            </div>
                        )}
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mr-2">تاریخ سند (غیرقابل ویرایش)</label>
                            <input className="w-full border-2 border-gray-100 dark:border-white/5 rounded-xl p-3 font-bold bg-gray-50/50 dark:bg-gray-900/50 text-gray-400 dark:text-gray-600 outline-none cursor-not-allowed text-center dir-ltr" value={formData.date.split('T')[0]} readOnly />
                        </div>
                    </div>

                    <div className="bg-gray-50 dark:bg-gray-800/30 p-4 md:p-6 rounded-3xl border border-gray-200 dark:border-white/5">
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="text-xs font-black text-gray-400 flex items-center gap-2 uppercase tracking-widest"><List size={16} className="text-blue-500"/> جزییات اقلام سند</h4>
                            <button onClick={addItem} className="text-blue-600 text-xs font-black flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 transition-colors"><Plus size={14}/> افزودن ردیف</button>
                        </div>
                        <div className="space-y-4">
                            {txItems.map((item, idx) => (
                                <div key={idx} className="flex flex-col md:flex-row gap-3 bg-white dark:bg-gray-900/40 p-4 rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm relative group">
                                    <div className="flex-1 space-y-1">
                                        <label className="text-[9px] font-black text-gray-400 mr-2">انتخاب کالا</label>
                                        <select className="w-full border-2 border-gray-100 dark:border-white/5 rounded-xl p-2.5 text-sm font-bold bg-gray-50 dark:bg-gray-800" value={item.itemId} onChange={e => handleItemChange(idx, 'itemId', e.target.value)}>
                                            <option value="">انتخاب از انبار...</option>
                                            {items.map(i => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
                                        </select>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:w-48">
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-gray-400 text-center block">تعداد</label>
                                            <input className="w-full border-2 border-gray-100 dark:border-white/5 rounded-xl p-2.5 text-sm font-bold text-center bg-gray-50 dark:bg-gray-800" placeholder="0" type="number" value={item.quantity === 0 ? '' : item.quantity} onFocus={e => e.target.select()} onChange={e => handleItemChange(idx, 'quantity', e.target.value === '' ? 0 : Number(e.target.value))} />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-gray-400 text-center block">وزن (KG)</label>
                                            <input className="w-full border-2 border-gray-100 dark:border-white/5 rounded-xl p-2.5 text-sm font-bold text-center bg-gray-50 dark:bg-gray-800" placeholder="0" type="number" value={item.weight === 0 ? '' : item.weight} onFocus={e => e.target.select()} onChange={e => handleItemChange(idx, 'weight', e.target.value === '' ? 0 : Number(e.target.value))} />
                                        </div>
                                    </div>
                                    <div className="flex items-end justify-center">
                                        <button onClick={() => removeItem(idx)} className="text-red-500 p-2.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"><Trash2 size={20}/></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="p-4 md:p-6 border-t flex gap-3 bg-gray-50/50 dark:bg-gray-900/40 backdrop-blur-md">
                    <button onClick={onClose} className="flex-1 py-3.5 border-2 border-gray-200 dark:border-white/10 rounded-2xl text-gray-500 font-black text-sm hover:bg-gray-100 active:scale-[0.98] transition-all">انصراف</button>
                    <button onClick={handleSave} className="flex-[2] py-3.5 bg-blue-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-blue-600/20 hover:bg-blue-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                        <Save size={20}/> ذخیره نهایی تغییرات
                    </button>
                </div>
            </div>
        </div>
    );
};

const WarehouseModule: React.FC<Props> = ({ currentUser, settings, initialTab = 'dashboard', financialYear }) => {
    const isMobile = useIsMobile();
    const [loadingData, setLoadingData] = useState(true);
    const [activeTab, setActiveTab] = useState(initialTab);
    const [items, setItems] = useState<WarehouseItem[]>([]);
    const [transactions, setTransactions] = useState<WarehouseTransaction[]>([]);
    const [allTransactions, setAllTransactions] = useState<WarehouseTransaction[]>([]);
    
    // New Item State
    const [newItemName, setNewItemName] = useState('');
    const [newItemCode, setNewItemCode] = useState('');
    const [newItemUnit, setNewItemUnit] = useState('عدد');
    const [newItemContainerCapacity, setNewItemContainerCapacity] = useState('');

    // Editing Item State
    const [editingItem, setEditingItem] = useState<WarehouseItem | null>(null);

    // Transaction State
    const currentShamsi = getCurrentShamsiDate();
    const [txDate, setTxDate] = useState({ year: financialYear ? parseInt(financialYear) : currentShamsi.year, month: currentShamsi.month, day: currentShamsi.day });

    useEffect(() => {
        if (financialYear) {
            setTxDate(prev => ({ ...prev, year: parseInt(financialYear) }));
        }
    }, [financialYear]);
    const [selectedCompany, setSelectedCompany] = useState('');
    const [txItems, setTxItems] = useState<Partial<WarehouseTransactionItem>[]>([{ itemId: '', quantity: 0, weight: 0, unitPrice: 0 }]);
    const [proformaNumber, setProformaNumber] = useState('');
    const [recipientName, setRecipientName] = useState('');
    const [driverName, setDriverName] = useState('');
    const [plateNumber, setPlateNumber] = useState('');
    const [destination, setDestination] = useState('');
    const [nextBijakNum, setNextBijakNum] = useState<number>(0);
    const [loadingBijakNum, setLoadingBijakNum] = useState(false);
    
    // View/Edit State
    const [viewBijak, setViewBijak] = useState<WarehouseTransaction | null>(null);
    const [editingBijak, setEditingBijak] = useState<WarehouseTransaction | null>(null); 
    const [editingReceipt, setEditingReceipt] = useState<WarehouseTransaction | null>(null); 
    
    useEffect(() => {
        if (viewBijak || editingBijak || editingReceipt) {
            const handleBack = () => {
                if (viewBijak) setViewBijak(null);
                if (editingBijak) setEditingBijak(null);
                if (editingReceipt) setEditingReceipt(null);
            };
            window.dispatchEvent(new CustomEvent('REGISTER_BACK_ACTION', { detail: handleBack }));
        } else if (activeTab !== 'dashboard') {
            const handleBack = () => {
                setActiveTab('dashboard');
            };
            window.dispatchEvent(new CustomEvent('REGISTER_BACK_ACTION', { detail: handleBack }));
        } else {
            window.dispatchEvent(new CustomEvent('UNREGISTER_BACK_ACTION'));
        }
        return () => { window.dispatchEvent(new CustomEvent('UNREGISTER_BACK_ACTION')); };
    }, [viewBijak, editingBijak, editingReceipt, activeTab]);
    
    // Reports State
    const [archiveFilterCompany, setArchiveFilterCompany] = useState('');
    const [reportSearch, setReportSearch] = useState('');
    
    // Print Report State
    const [showPrintStockReport, setShowPrintStockReport] = useState(false); 

    // Auto Send on Approval/Edit/Delete
    const [activeAutoSends, setActiveAutoSends] = useState<{tx: WarehouseTransaction, type: 'CREATED' | 'APPROVED' | 'EDITED' | 'DELETED'}[]>([]);
    const [createdTxForAutoSend, setCreatedTxForAutoSend] = useState<WarehouseTransaction | null>(null);
    const [approvedTxForAutoSend, setApprovedTxForAutoSend] = useState<WarehouseTransaction | null>(null);
    const [editedBijakForAutoSend, setEditedBijakForAutoSend] = useState<WarehouseTransaction | null>(null);
    const [deletedTxForAutoSend, setDeletedTxForAutoSend] = useState<WarehouseTransaction | null>(null);

    // Effect to process the queue
    useEffect(() => {
        const processQueue = async () => {
            if (activeAutoSends.length === 0) return;
            
            const next = activeAutoSends[0];
            const { tx, type } = next;

            // Set the appropriate state for the hidden printer to render
            if (type === 'CREATED') setCreatedTxForAutoSend(tx);
            if (type === 'APPROVED') setApprovedTxForAutoSend(tx);
            if (type === 'EDITED') setEditedBijakForAutoSend(tx);
            if (type === 'DELETED') setDeletedTxForAutoSend(tx);

            // Wait for DOM to render the hidden printer
            await new Promise(resolve => setTimeout(resolve, 3000));

            try {
                const users = await getUsers();
                const companyConfig = settings?.companyNotifications?.[tx.company];
                
                if (type === 'CREATED') {
                    const element = document.getElementById(`print-bijak-created-${tx.id}-price`);
                    if (element) {
                        const ceos = users.filter((u: any) => u.role === UserRole.CEO && (u.phoneNumber || u.telegramId));
                        if (ceos.length > 0) {
                            const canvas = await html2canvas(element, { scale: 2, backgroundColor: '#ffffff', windowWidth: 1200, useCORS: true });
                            const base64 = canvas.toDataURL('image/png').split(',')[1];
                            const mediaData = { data: base64, mimeType: 'image/png', filename: `Bijak_Pending_${tx.number}.png` };
                            
                            let caption = `🔔 *درخواست بیجک جدید (در انتظار تایید)*\n`;
                            caption += `شماره: ${tx.number}\n`;
                            caption += `شرکت: ${tx.company}\n`;
                            caption += `گیرنده: ${tx.recipientName}\n`;
                            caption += `توسط: ${tx.createdBy}\n\n`;
                            caption += `لطفا جهت تایید بررسی نمایید.`;

                            for (const ceo of ceos) {
                                if (ceo.phoneNumber) await apiCall('/send-whatsapp', 'POST', { number: ceo.phoneNumber, message: caption, mediaData });
                                const chatId = (ceo as any).telegramId || (ceo as any).telegramChatId;
                                if (chatId) await apiCall('/send-bot-message', 'POST', { platform: 'telegram', chatId, caption, mediaData });
                            }
                        }
                    }
                } else if (type === 'APPROVED') {
                    const managerElement = document.getElementById(`print-bijak-${tx.id}-price`);
                    const warehouseElement = document.getElementById(`print-bijak-${tx.id}-noprice`);
                    
                    const managerNumber = companyConfig?.salesManager;
                    const groupNumber = companyConfig?.warehouseGroup;

                    let caption = `✅ *بیجک تایید شد*\n`;
                    caption += `🔢 شماره: ${tx.number}\n`;
                    caption += `👤 گیرنده: ${tx.recipientName}\n`;
                    caption += `📑 شرکت: ${tx.company}\n`;
                    caption += `🚛 راننده: ${tx.driverName || '---'}\n`;
                    caption += `🏁 مقصد: ${tx.destination || '---'}\n`;
                    caption += `👤 تایید توسط: ${tx.approvedBy}\n`;

                    if (managerElement) {
                        const canvas = await html2canvas(managerElement, { scale: 2, backgroundColor: '#ffffff', windowWidth: 1200, useCORS: true });
                        const base64 = canvas.toDataURL('image/png').split(',')[1];
                        const mediaData = { data: base64, mimeType: 'image/png', filename: `Bijak_${tx.number}.png` };
                        if (managerNumber) {
                           await apiCall('/send-whatsapp', 'POST', { number: managerNumber, message: caption, mediaData });
                        }
                        
                        const managers = users.filter((u: any) => (u.role === UserRole.CEO || u.role === UserRole.SALES_MANAGER || u.role === UserRole.ADMIN) && (u.telegramId || u.baleId));
                        for (const m of managers) {
                            const tgId = (m as any).telegramId || (m as any).telegramChatId;
                            const blId = (m as any).baleId || (m as any).baleChatId;
                            if (tgId) await apiCall('/send-bot-message', 'POST', { platform: 'telegram', chatId: tgId, caption, mediaData });
                            if (blId) await apiCall('/send-bot-message', 'POST', { platform: 'bale', chatId: blId, caption, mediaData });
                        }
                    }

                    if (warehouseElement) {
                        const canvas = await html2canvas(warehouseElement, { scale: 2, backgroundColor: '#ffffff', windowWidth: 1200, useCORS: true });
                        const base64 = canvas.toDataURL('image/png').split(',')[1];
                        const mediaData = { data: base64, filename: `Bijak_${tx.number}.png` };
                        
                        if (groupNumber) await apiCall('/send-whatsapp', 'POST', { number: groupNumber, message: caption, mediaData: { ...mediaData, mimeType: 'image/png' } });
                        if (companyConfig?.telegramChannelId) await apiCall('/send-bot-message', 'POST', { platform: 'telegram', chatId: companyConfig.telegramChannelId, caption, mediaData });
                        if (companyConfig?.baleChannelId) await apiCall('/send-bot-message', 'POST', { platform: 'bale', chatId: companyConfig.baleChannelId, caption, mediaData });
                    }
                }
            } catch (e) {
                console.error("AutoSend Error:", e);
            }

            // Cleanup and move to next
            setCreatedTxForAutoSend(null);
            setApprovedTxForAutoSend(null);
            setEditedBijakForAutoSend(null);
            setDeletedTxForAutoSend(null);
            setActiveAutoSends(prev => prev.slice(1));
        };

        processQueue();
    }, [activeAutoSends, settings]);

    useEffect(() => { loadData(); }, [financialYear]);
    useEffect(() => { setActiveTab(initialTab); }, [initialTab]);
    
    // Trigger update on company change
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
            let rawTxs = Array.isArray(t) ? t : [];
            setAllTransactions(rawTxs);
            let safeTxs = rawTxs;
            if (financialYear && financialYear !== 'all') {
                safeTxs = safeTxs.filter(tx => isInFinancialYear(tx.date, financialYear));
            }
            setTransactions(safeTxs); 
        } catch (e) { 
            console.error(e); 
            setItems([]);
            setTransactions([]);
            setAllTransactions([]);
        } finally { 
            setLoadingData(false); 
        } 
    };
    
    const updateNextBijak = async () => { 
        if(selectedCompany) { 
            setLoadingBijakNum(true);
            try {
                // FORCE REFRESH: Use apiCall with company param
                const response = await apiCall<{ nextNumber: number }>(`/next-bijak-number?company=${encodeURIComponent(selectedCompany)}&t=${Date.now()}`);
                if (response && response.nextNumber) {
                    setNextBijakNum(response.nextNumber);
                }
            } catch(e) {
                console.error("Bijak Num Error", e);
            } finally {
                setLoadingBijakNum(false);
            }
        } 
    };
    
    const getIsoDate = () => { 
        try { 
            const date = jalaliToGregorian(txDate.year, txDate.month, txDate.day); 
            date.setHours(12, 0, 0, 0); 
            return date.toISOString(); 
        } catch { 
            const d = new Date();
            d.setHours(12, 0, 0, 0);
            return d.toISOString(); 
        } 
    };
    
    // --- ITEM MANAGEMENT ---
    const handleAddItem = async () => { 
        if(!newItemName) return; 
        await saveWarehouseItem({ 
            id: generateUUID(), 
            name: newItemName, 
            code: newItemCode, 
            unit: newItemUnit, 
            containerCapacity: Number(newItemContainerCapacity) || 0 
        }); 
        setNewItemName(''); 
        setNewItemCode(''); 
        setNewItemContainerCapacity('');
        loadData(); 
    };
    
    const handleEditItem = async () => {
        if (!editingItem) return;
        await updateWarehouseItem(editingItem);
        setEditingItem(null);
        loadData();
    };

    const handleDeleteItem = async (id: string) => { if(confirm('حذف شود؟')) { await deleteWarehouseItem(id); loadData(); } };
    
    const handleAddTxItemRow = () => setTxItems([...txItems, { itemId: '', quantity: 0, weight: 0, unitPrice: 0 }]);
    const handleRemoveTxItemRow = (idx: number) => setTxItems(txItems.filter((_, i) => i !== idx));
    const updateTxItem = (idx: number, field: keyof WarehouseTransactionItem, val: any) => { const newItems = [...txItems]; newItems[idx] = { ...newItems[idx], [field]: val }; if(field === 'itemId') { const item = items.find(i => i.id === val); if(item) newItems[idx].itemName = item.name; } setTxItems(newItems); };

    const handleSubmitTx = async (type: 'IN' | 'OUT') => {
        if(!selectedCompany) { alert('شرکت را انتخاب کنید'); return; }
        if(txItems.some(i => !i.itemId || !i.quantity)) { alert('اقلام را کامل کنید'); return; }

        const validItems = txItems.map(i => ({ itemId: i.itemId!, itemName: i.itemName!, quantity: Number(i.quantity), weight: Number(i.weight), unitPrice: Number(i.unitPrice)||0 }));
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
            status: type === 'OUT' ? 'PENDING' : undefined,
        };

        try {
            await saveWarehouseTransaction(tx);
            await loadData();
            if(type === 'OUT') {
                updateNextBijak();
                setActiveAutoSends(prev => [...prev, { tx, type: 'CREATED' }]);
                alert('بیجک ثبت شد و در انتظار تایید مدیریت است.');
                setRecipientName(''); setDriverName(''); setPlateNumber(''); setDestination('');
            } else {
                setProformaNumber(''); alert('ورود کالا ثبت شد.');
            }
            setTxItems([{ itemId: '', quantity: 0, weight: 0, unitPrice: 0 }]);
        } catch (e: any) {
            alert('خطا در ثبت اطلاعات.');
        }
    };

    const handleApproveBijak = async (tx: WarehouseTransaction) => {
        if (!confirm('آیا تایید می‌کنید؟ پس از تایید، بیجک به صورت خودکار برای انبار و مدیریت ارسال می‌شود.')) return;
        
        try {
            const updatedTx = { ...tx, status: 'APPROVED' as const, approvedBy: currentUser.fullName };
            await updateWarehouseTransaction(updatedTx);
            loadData();
            
            // Add to notification queue
            setActiveAutoSends(prev => [...prev, { tx: updatedTx, type: 'APPROVED' }]);
            
            setViewBijak(null);
            alert("تایید و در صف ارسال قرار گرفت.");
        } catch (e) { alert("خطا در عملیات تایید"); }
    };

    const handleRejectBijak = async (tx: WarehouseTransaction) => {
        const reason = prompt("لطفا دلیل رد بیجک را وارد کنید:");
        if (reason) {
            const updatedTx = { ...tx, status: 'REJECTED' as const, rejectionReason: reason, rejectedBy: currentUser.fullName };
            await updateWarehouseTransaction(updatedTx);
            loadData();
            setViewBijak(null); 
        }
    };

    const handleDeleteTx = async (id: string) => { 
        if(!confirm('آیا از حذف این تراکنش اطمینان دارید؟ عملیات غیرقابل بازگشت است.')) return;

        const txToDelete = transactions.find(t => t.id === id);
        
        if (txToDelete && txToDelete.type === 'OUT' && settings && settings.companyNotifications) {
            const deletedMock = { ...txToDelete, status: 'DELETED' as any };
            setDeletedTxForAutoSend(deletedMock);

            setTimeout(async () => {
                const managerElement = document.getElementById(`print-bijak-del-${id}-price`);
                const warehouseElement = document.getElementById(`print-bijak-del-${id}-noprice`);
                
                const companyConfig = settings.companyNotifications?.[txToDelete.company];
                const managerNumber = companyConfig?.salesManager;
                const groupNumber = companyConfig?.warehouseGroup;

                let warningCaption = `❌❌ *هشدار: بیجک حذف شد* ❌❌\n`;
                warningCaption += `⛔ *ارسال بار ممنوع*\n`;
                warningCaption += `🔢 شماره: ${txToDelete.number}\n`;
                warningCaption += `👤 گیرنده: ${txToDelete.recipientName}\n`;
                warningCaption += `🗑️ حذف توسط: ${currentUser.fullName}\n`;
                warningCaption += `⚠️ *این بیجک از سیستم حذف شده و فاقد اعتبار است.*`;

                try {
                    if (managerNumber && managerElement) {
                        const canvas = await html2canvas(managerElement, { scale: 2, backgroundColor: '#ffffff', windowWidth: 1200, useCORS: true });
                        const base64 = canvas.toDataURL('image/png').split(',')[1];
                        await apiCall('/send-whatsapp', 'POST', { number: managerNumber, message: warningCaption, mediaData: { data: base64, mimeType: 'image/png', filename: `Bijak_DELETED_${txToDelete.number}.png` } });
                    }
                    if (warehouseElement) {
                        const canvas = await html2canvas(warehouseElement, { scale: 2, backgroundColor: '#ffffff', windowWidth: 1200, useCORS: true });
                        const base64 = canvas.toDataURL('image/png').split(',')[1];
                        const mediaData = { data: base64, filename: `Bijak_DELETED_${txToDelete.number}.png` };
                        
                        if (groupNumber) {
                            await apiCall('/send-whatsapp', 'POST', { number: groupNumber, message: warningCaption, mediaData: { ...mediaData, mimeType: 'image/png' } });
                        }
                        if (companyConfig?.telegramChannelId) {
                            await apiCall('/send-bot-message', 'POST', { platform: 'telegram', chatId: companyConfig.telegramChannelId, caption: warningCaption, mediaData });
                        }
                        if (companyConfig?.baleChannelId) {
                            await apiCall('/send-bot-message', 'POST', { platform: 'bale', chatId: companyConfig.baleChannelId, caption: warningCaption, mediaData });
                        }
                    }
                } catch(e) { console.error("Error sending delete notification", e); }
                
                await deleteWarehouseTransaction(id);
                setDeletedTxForAutoSend(null);
                loadData();
                setViewBijak(null); 
                alert("تراکنش حذف و اطلاع‌رسانی شد.");

            }, 2500);
        } else {
            await deleteWarehouseTransaction(id);
            loadData();
        }
    };
    
    const handleEditBijakSave = async (updatedTx: WarehouseTransaction) => {
        try { 
            updatedTx.status = 'PENDING';
            updatedTx.updatedAt = Date.now();
            
            await updateWarehouseTransaction(updatedTx); 
            setEditingBijak(null); 
            
            setEditedBijakForAutoSend(updatedTx);

            setTimeout(async () => {
                 const element = document.getElementById(`print-bijak-edit-${updatedTx.id}`);
                 if (element) {
                     try {
                         const users = await getUsers();
                         const ceos = users.filter((u: any) => u.role === UserRole.CEO && (u.phoneNumber || u.telegramId || u.baleId || u.telegramChatId || u.baleChatId));
                         if (ceos.length > 0) {
                             const canvas = await html2canvas(element, { scale: 2, backgroundColor: '#ffffff', windowWidth: 1200, useCORS: true });
                             const base64 = canvas.toDataURL('image/png').split(',')[1];
                            const mediaData = { data: base64, mimeType: 'image/png', filename: `Bijak_Edit_${updatedTx.number}.png` };
                            
                            for (const ceo of ceos) {
                                let caption = `📝 *اصلاحیه بیجک (جهت تایید مجدد)*\n`;
                                caption += `شماره: ${updatedTx.number}\n`;
                                caption += `گیرنده: ${updatedTx.recipientName}\n`;
                                caption += `ویرایش توسط: ${currentUser.fullName}\n\n`;
                                caption += `لطفا بررسی نمایید.`;

                                if (ceo.phoneNumber) {
                                  await apiCall('/send-whatsapp', 'POST', { number: ceo.phoneNumber, message: caption, mediaData });
                                }
                                if ((ceo as any).telegramId || (ceo as any).telegramChatId) {
                                  await apiCall('/send-bot-message', 'POST', { platform: 'telegram', chatId: (ceo as any).telegramId || (ceo as any).telegramChatId, caption, mediaData });
                                }
                                if ((ceo as any).baleId || (ceo as any).baleChatId) {
                                  await apiCall('/send-bot-message', 'POST', { platform: 'bale', chatId: (ceo as any).baleId || (ceo as any).baleChatId, caption, mediaData });
                                }
                            }
                         }
                     } catch(e) { console.error(e); }
                 }
                 setEditedBijakForAutoSend(null);
                 loadData(); 
                 alert('بیجک ویرایش و جهت تایید مجدد به مدیریت ارسال شد.'); 
            }, 2500);

        } catch (e: any) { 
            console.error(e); 
            alert('خطا در ویرایش بیجک.');
        }
    };

    const handleEditReceiptSave = async (updatedTx: WarehouseTransaction) => {
        try { await updateWarehouseTransaction(updatedTx); setEditingReceipt(null); loadData(); alert('رسید با موفقیت ویرایش شد.'); } catch (e) { console.error(e); alert('خطا در ویرایش رسید.'); }
    };

    const safeTransactions = Array.isArray(transactions) ? transactions : [];

    const allWarehousesStock = useMemo(() => {
        const companies = settings?.companies?.filter(c => c.showInWarehouse !== false).map(c => c.name) || [];
        const result = companies.map(company => {
            const companyItems = items.map(catalogItem => {
                let quantity = 0; let weight = 0;
                
                // Cumulative logic: We want all transactions from all time UP TO the end of the selected financial year
                // If financialYear is not set, we use all transactions.
                allTransactions
                    .filter(tx => tx.company === company && tx.status !== 'REJECTED')
                    .filter(tx => {
                        if (!financialYear || financialYear === 'all') return true;
                        // Check if transaction year is <= current selected year
                        try {
                            const d = new Date(tx.date);
                            const shamsi = d.toLocaleDateString('fa-IR-u-nu-latn');
                            const year = parseInt(shamsi.split('/')[0]);
                            const targetYear = parseInt(financialYear);
                            return year <= targetYear;
                        } catch (e) { return true; }
                    })
                    .forEach(tx => {
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
            }).filter(item => item.quantity !== 0); // FILTER NON-ZERO STOCK
            return { company, items: companyItems };
        }).filter(group => group.items.length > 0); // ONLY SHOW COMPANIES WITH AT LEAST ONE ITEM
        return result;
    }, [allTransactions, items, settings, financialYear]);

    const recentBijaks = useMemo(() => safeTransactions.filter(t => t.type === 'OUT').slice(0, 5), [safeTransactions]);
    
    // Updated Filtering logic using reportSearch
    const filteredArchiveBijaks = useMemo(() => safeTransactions.filter(t => t.type === 'OUT' && (!archiveFilterCompany || t.company === archiveFilterCompany) && (String(t.number).includes(reportSearch) || (t.recipientName && t.recipientName.includes(reportSearch)))), [safeTransactions, archiveFilterCompany, reportSearch]);
    const filteredArchiveReceipts = useMemo(() => safeTransactions.filter(t => t.type === 'IN' && (!archiveFilterCompany || t.company === archiveFilterCompany) && (String(t.proformaNumber).includes(reportSearch))), [safeTransactions, archiveFilterCompany, reportSearch]);
    
    const pendingBijaks = useMemo(() => safeTransactions.filter(t => t.type === 'OUT' && t.status === 'PENDING'), [safeTransactions]);

    const handlePrintStock = () => { setShowPrintStockReport(true); };

    // --- EXCEL EXPORT FUNCTION (Formatted as HTML Table - OFFLINE) ---
    const handleExportExcel = () => {
        if (!allWarehousesStock || allWarehousesStock.length === 0) return alert("داده‌ای برای خروجی وجود ندارد.");
        const rows = [];
        // Header
        rows.push(["شرکت", "کالا", "کد", "واحد", "تعداد", "وزن", "کانتینر"].join(","));
        
        allWarehousesStock.forEach(group => {
             group.items.forEach(item => {
                 rows.push(`"${group.company}","${item.name}","${item.id}","${item.quantity}","${item.weight}","${item.containerCount}"`);
             });
        });

        const bom = "\uFEFF";
        const blob = new Blob([bom + rows.join("\n")], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `Stock_Report_${new Date().toISOString().slice(0,10)}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (!settings || loadingData) return <div className="flex flex-col items-center justify-center h-[50vh] text-gray-500 gap-2"><Loader2 className="animate-spin text-blue-600" size={32}/><span className="text-sm font-bold">در حال بارگذاری اطلاعات انبار...</span></div>;
    const companyList = settings.companies?.filter(c => c.showInWarehouse !== false).map(c => c.name) || [];
    if (companyList.length === 0) return (<div className="flex flex-col items-center justify-center h-[60vh] text-center p-6 animate-fade-in"><div className="bg-amber-100 p-4 rounded-full text-amber-600 mb-4 shadow-sm"><AlertTriangle size={48}/></div><h2 className="text-xl font-bold text-gray-800 mb-2">هیچ شرکتی برای انبار فعال نشده است</h2><p className="text-gray-600 max-w-md mb-6 leading-relaxed">برای استفاده از سیستم انبار، لطفاً در تنظیمات سیستم به بخش "مدیریت شرکت‌ها" بروید و تیک "نمایش در انبار" را برای شرکت‌های مورد نظر فعال کنید.</p><div className="flex gap-2"><button onClick={() => window.location.hash = '#settings'} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-blue-700 transition-colors shadow-lg"><Settings size={20}/><span>رفتن به تنظیمات</span></button></div></div>);

    const years = Array.from({length:10},(_,i)=>1400+i); const months = Array.from({length:12},(_,i)=>i+1); const days = Array.from({length:31},(_,i)=>i+1);

    const canApprove = currentUser.role === UserRole.CEO || currentUser.role === UserRole.ADMIN;

    return (
        <div className="glass-panel md:rounded-2xl shadow-sm md:border h-[calc(100dvh-140px)] md:h-[calc(100vh-100px)] flex flex-col overflow-hidden animate-fade-in relative">
            
            {/* Hidden Print Elements for Auto-Send */}
            {createdTxForAutoSend && (
                <div className="hidden-print-export" style={{ position: 'absolute', top: '-9999px', left: '-9999px', width: '800px', zIndex: -1 }}>
                    <div id={`print-bijak-created-${createdTxForAutoSend.id}-price`}><PrintBijak tx={createdTxForAutoSend} onClose={()=>{}} embed forceHidePrices={false} transactions={safeTransactions} /></div>
                </div>
            )}
            {approvedTxForAutoSend && (
                <div className="hidden-print-export" style={{ position: 'absolute', top: '-9999px', left: '-9999px', width: '800px', zIndex: -1 }}>
                    <div id={`print-bijak-${approvedTxForAutoSend.id}-price`}><PrintBijak tx={approvedTxForAutoSend} onClose={()=>{}} embed forceHidePrices={false} transactions={safeTransactions} /></div>
                    <div id={`print-bijak-${approvedTxForAutoSend.id}-noprice`}><PrintBijak tx={approvedTxForAutoSend} onClose={()=>{}} embed forceHidePrices={true} transactions={safeTransactions} /></div>
                </div>
            )}
            {deletedTxForAutoSend && (
                <div className="hidden-print-export" style={{ position: 'absolute', top: '-9999px', left: '-9999px', width: '800px', zIndex: -1 }}>
                    <div id={`print-bijak-del-${deletedTxForAutoSend.id}-price`}><PrintBijak tx={deletedTxForAutoSend} onClose={()=>{}} embed forceHidePrices={false} transactions={safeTransactions} /></div>
                    <div id={`print-bijak-del-${deletedTxForAutoSend.id}-noprice`}><PrintBijak tx={deletedTxForAutoSend} onClose={()=>{}} embed forceHidePrices={true} transactions={safeTransactions} /></div>
                </div>
            )}
            {editedBijakForAutoSend && (
                <div className="hidden-print-export" style={{ position: 'absolute', top: '-9999px', left: '-9999px', width: '800px', zIndex: -1 }}>
                    <div id={`print-bijak-edit-${editedBijakForAutoSend.id}`}><PrintBijak tx={editedBijakForAutoSend} onClose={()=>{}} embed forceHidePrices={false} transactions={safeTransactions} /></div>
                </div>
            )}
            
            {showPrintStockReport && (
                <PrintStockReport data={allWarehousesStock} onClose={() => setShowPrintStockReport(false)} />
            )}

            <div className={`bg-white dark:bg-gray-900 p-2 flex gap-1.5 border-b overflow-x-auto no-print scrollbar-hide shrink-0 sticky top-0 z-[35] backdrop-blur-md bg-opacity-90 ${isMobile ? 'px-4 py-3' : 'p-2'}`}>
                {activeTab !== 'dashboard' && (
                    <button 
                        onClick={() => setActiveTab('dashboard')}
                        data-subtab-back="true"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-bold hover:bg-gray-200 shrink-0 transition-all hover:scale-105 active:scale-95 border border-transparent hover:border-gray-300"
                        title="بازگشت به پیشخوان انبار"
                    >
                        <ArrowLeftRight size={18} className="rotate-180" />
                        {!isMobile && <span className="text-xs">بازگشت</span>}
                    </button>
                )}
                {[
                    { id: 'dashboard', label: 'داشبورد', color: 'blue' },
                    { id: 'items', label: 'تعریف کالا', color: 'blue' },
                    { id: 'entry', label: 'ورود کالا', color: 'green' },
                    { id: 'entry_archive', label: 'رسیدها', color: 'emerald' },
                    { id: 'exit', label: 'خروج کالا', color: 'red' },
                    { id: 'archive', label: 'بیجک‌ها', color: 'gray' },
                    { id: 'approvals', label: 'تاییدیه', color: 'orange' },
                    { id: 'reports', label: 'کاردکس', color: 'purple' },
                    { id: 'stock_report', label: 'موجودی', color: 'orange' }
                ].map(tab => (
                    <button 
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)} 
                        className={`px-4 py-2 rounded-xl text-xs font-black whitespace-nowrap transition-all duration-200 ${
                            activeTab === tab.id 
                            ? `bg-${tab.color}-600 text-white shadow-lg shadow-${tab.color}-600/20 scale-105 active-tab-pulse` 
                            : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-200 dark:border-white/5'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar">
                
                {activeTab === 'approvals' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                        <div className="flex items-center justify-between no-print">
                            <h3 className="font-black text-gray-800 dark:text-white flex items-center gap-2"><CheckCircle className="text-orange-600"/> لیست در انتظار تایید</h3>
                            {isMobile && <div className="text-[10px] bg-orange-100 text-orange-700 font-bold px-2 py-1 rounded-full">{pendingBijaks.length} مورد</div>}
                        </div>
                        {/* Mobile Optimized List for Approvals */}
                        {isMobile ? (
                            <div className="grid grid-cols-1 gap-4">
                                {pendingBijaks.length === 0 ? (
                                    <div className="text-center text-gray-400 py-20 flex flex-col items-center gap-2">
                                        <ShieldCheck size={48} className="opacity-10"/>
                                        <p className="font-bold">هیچ درخواستی در لیست تایید نیست</p>
                                    </div>
                                ) : pendingBijaks.map(tx => (
                                    <div key={tx.id} className="bg-white dark:bg-gray-900/40 border border-gray-200 dark:border-white/10 rounded-2xl p-5 shadow-sm relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 w-1.5 h-full bg-orange-500"></div>
                                        <div className="flex justify-between items-center mb-3">
                                            <div className="flex items-center gap-2">
                                                <span className="bg-orange-50 text-orange-700 font-black px-2 py-1 rounded-lg text-sm">#{tx.number}</span>
                                                <span className="text-[10px] font-bold text-gray-500">{formatDate(tx.date)}</span>
                                            </div>
                                            <span className="text-[10px] font-black text-gray-400">توسط: {tx.createdBy}</span>
                                        </div>
                                        <div className="text-base font-black text-gray-800 dark:text-white mb-1">{tx.company}</div>
                                        <div className="text-xs font-bold text-gray-500 mb-4 flex items-center gap-1"><Users size={12}/> گیرنده: {tx.recipientName}</div>
                                        
                                        <div className="flex gap-2">
                                            <button onClick={() => setViewBijak(tx)} className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 py-3 rounded-xl text-xs font-black shadow-sm border border-gray-200 dark:border-white/5 active:scale-95 transition-transform">مشاهده</button>
                                            {canApprove && (
                                                <>
                                                    <button onClick={() => handleApproveBijak(tx)} className="flex-1 bg-green-600 text-white py-3 rounded-xl text-xs font-black shadow-lg shadow-green-600/20 active:scale-95 transition-transform">تایید</button>
                                                    <button onClick={() => handleRejectBijak(tx)} className="flex-1 bg-red-600 text-white py-3 rounded-xl text-xs font-black shadow-lg shadow-red-600/20 active:scale-95 transition-transform">رد</button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            // Desktop Table
                            <div className="glass-panel rounded-xl border shadow-sm overflow-hidden">
                                <table className="w-full text-sm text-right">
                                    <thead className="bg-gray-100 text-gray-600"><tr><th className="p-4">شماره</th><th className="p-4">تاریخ</th><th className="p-4">شرکت</th><th className="p-4 text-center">عملیات</th></tr></thead>
                                    <tbody className="divide-y">
                                        {pendingBijaks.map(tx => (
                                            <tr key={tx.id} className="hover:bg-gray-50">
                                                <td className="p-4 font-mono font-bold text-red-600">#{tx.number}</td>
                                                <td className="p-4 text-xs">{formatDate(tx.date)}</td>
                                                <td className="p-4 text-xs font-bold">{tx.company}</td>
                                                <td className="p-4 text-center flex justify-center gap-2">
                                                    <button onClick={() => setViewBijak(tx)} className="bg-blue-100 text-blue-600 p-2 rounded hover:bg-blue-200" title="مشاهده"><Eye size={16}/></button>
                                                    {canApprove && (
                                                        <>
                                                            <button onClick={() => handleApproveBijak(tx)} className="bg-green-100 text-green-600 p-2 rounded hover:bg-green-200" title="تایید و ارسال"><CheckCircle size={16}/></button>
                                                            <button onClick={() => handleRejectBijak(tx)} className="bg-red-100 text-red-600 p-2 rounded hover:bg-red-200" title="رد"><XCircle size={16}/></button>
                                                        </>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                        {pendingBijaks.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-gray-400">هیچ بیجکی در انتظار تایید نیست.</td></tr>}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'dashboard' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                        <div className="flex flex-col gap-1 mb-2">
                             <h2 className="text-xl font-black text-gray-800 dark:text-white">وضعیت انبار</h2>
                             <p className="text-xs font-bold text-gray-400">خلاصه فعالیت‌ها و موجودی کالاها</p>
                        </div>
                        {/* Cards - Auto Responsive Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div onClick={() => setActiveTab('items')} className="bg-gradient-to-br from-blue-500 to-indigo-600 p-6 rounded-3xl text-white shadow-lg shadow-blue-500/30 cursor-pointer hover:scale-[1.02] transition-transform flex flex-col justify-between h-40">
                                <div className="flex justify-between items-start">
                                    <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md"><Package size={24}/></div>
                                    <div className="text-4xl font-black">{items.length}</div>
                                </div>
                                <div>
                                    <div className="text-sm font-black opacity-90">تنوع کالاها</div>
                                    <div className="text-[10px] opacity-70 mt-0.5">لیست کالاهای تعریف شده در سیستم</div>
                                </div>
                            </div>
                            
                            <div onClick={() => setActiveTab('entry_archive')} className="bg-gradient-to-br from-emerald-500 to-teal-600 p-6 rounded-3xl text-white shadow-lg shadow-emerald-500/30 cursor-pointer hover:scale-[1.02] transition-transform flex flex-col justify-between h-40">
                                <div className="flex justify-between items-start">
                                    <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md"><ArrowDownCircle size={24}/></div>
                                    <div className="text-4xl font-black">{safeTransactions.filter(t=>t.type==='IN').length}</div>
                                </div>
                                <div>
                                    <div className="text-sm font-black opacity-90">کل ورودی‌ها</div>
                                    <div className="text-[10px] opacity-70 mt-0.5">تعداد کل فاکتورها و پروفرماهای رسیده</div>
                                </div>
                            </div>

                            <div onClick={() => setActiveTab('archive')} className="bg-gradient-to-br from-rose-500 to-orange-600 p-6 rounded-3xl text-white shadow-lg shadow-rose-500/30 cursor-pointer hover:scale-[1.02] transition-transform flex flex-col justify-between h-40">
                                <div className="flex justify-between items-start">
                                    <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md"><ArrowUpCircle size={24}/></div>
                                    <div className="text-4xl font-black">{safeTransactions.filter(t=>t.type==='OUT').length}</div>
                                </div>
                                <div>
                                    <div className="text-sm font-black opacity-90">کل خروجی‌ها (بیجک)</div>
                                    <div className="text-[10px] opacity-70 mt-0.5">تعداد کل حواله‌های صادره از انبار</div>
                                </div>
                            </div>
                        </div>

                        {/* Recent Activity Mini-List */}
                        <div className="bg-white dark:bg-gray-900/40 border border-gray-200 dark:border-white/10 rounded-3xl p-5 shadow-sm">
                            <div className="flex justify-between items-center mb-4">
                                <h4 className="font-black text-gray-800 dark:text-white flex items-center gap-2"><RefreshCw size={18} className="text-blue-500"/> آخرین بیجک‌های خروجی</h4>
                                <button onClick={() => setActiveTab('archive')} className="text-blue-600 text-[10px] font-black hover:underline px-3 py-1 bg-blue-50 dark:bg-blue-900/20 rounded-full">مشاهده همه</button>
                            </div>
                            <div className="space-y-3">
                                {recentBijaks.length === 0 ? (
                                    <div className="text-center py-6 text-gray-400 text-xs">فعالیتی ثبت نشده است</div>
                                ) : recentBijaks.map(tx => (
                                    <div key={tx.id} onClick={() => setViewBijak(tx)} className="flex items-center justify-between p-3 border-b border-gray-100 dark:border-white/5 last:border-0 hover:bg-gray-50 dark:hover:bg-white/5 rounded-xl cursor-pointer transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center font-black shadow-sm">
                                                {tx.number}
                                            </div>
                                            <div>
                                                <div className="text-xs font-black text-gray-800 dark:text-gray-100">{tx.recipientName}</div>
                                                <div className="text-[10px] font-bold text-gray-400">{tx.company}</div>
                                            </div>
                                        </div>
                                        <div className="text-left">
                                            <div className="text-[10px] font-black text-gray-400 mb-1">{formatDate(tx.date)}</div>
                                            <span className={`text-[9px] px-2 py-0.5 rounded-full font-black ${tx.status === 'APPROVED' ? 'bg-green-100 text-green-700' : tx.status === 'REJECTED' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-800'}`}>
                                                {tx.status === 'APPROVED' ? 'تایید شده' : tx.status === 'REJECTED' ? 'رد شده' : 'در انتظار'}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
                
                {/* ITEMS TAB - Mobile Card View */}
                {activeTab === 'items' && (
                    <div className="max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4">
                        <div className="bg-white dark:bg-gray-900/40 p-5 rounded-3xl border border-gray-200 dark:border-white/10 shadow-sm mb-6 flex flex-col md:flex-row items-end gap-4">
                            <div className="flex-1 w-full space-y-1.5 flex flex-col">
                                <label className="text-xs font-black text-gray-500 mr-2 flex items-center gap-1"><Package size={14} className="text-blue-500"/> نام کالا</label>
                                <input className="w-full border-2 border-gray-100 dark:border-white/5 rounded-2xl p-3.5 bg-gray-50 dark:bg-gray-800 focus:bg-white dark:focus:bg-gray-700 focus:border-blue-500 outline-none transition-all font-bold" placeholder="مثلا: میلگرد 12" value={newItemName} onChange={e=>setNewItemName(e.target.value)}/>
                            </div>
                            <div className="flex gap-4 w-full md:w-auto">
                                <div className="flex-1 space-y-1.5 flex flex-col">
                                    <label className="text-xs font-black text-gray-500 mr-2">کد کالا</label>
                                    <input className="w-full border-2 border-gray-100 dark:border-white/5 rounded-2xl p-3.5 bg-gray-50 dark:bg-gray-800 focus:bg-white dark:focus:bg-gray-700 transition-all font-mono font-bold text-center" placeholder="1001" value={newItemCode} onChange={e=>setNewItemCode(e.target.value)}/>
                                </div>
                                <div className="flex-1 space-y-1.5 flex flex-col">
                                    <label className="text-xs font-black text-gray-500 mr-2">واحد</label>
                                    <select className="w-full border-2 border-gray-100 dark:border-white/5 rounded-2xl p-3.5 bg-gray-50 dark:bg-gray-800 font-bold" value={newItemUnit} onChange={e=>setNewItemUnit(e.target.value)}><option>عدد</option><option>کارتن</option><option>کیلوگرم</option><option>دستگاه</option><option>متر</option></select>
                                </div>
                            </div>
                            <button onClick={handleAddItem} className="bg-blue-600 text-white p-4 rounded-2xl hover:bg-blue-700 h-[58px] w-full md:w-16 flex items-center justify-center font-black shadow-lg shadow-blue-600/20 active:scale-95 transition-transform">
                                {isMobile ? <span className="flex items-center gap-2">افزودن کالا جدید <Plus/></span> : <Plus/>}
                            </button>
                        </div>

                        {isMobile ? (
                            <div className="grid grid-cols-1 gap-4">
                                {items.length === 0 ? (
                                    <div className="text-center text-gray-400 py-20 flex flex-col items-center gap-4">
                                        <Package size={64} className="opacity-10"/>
                                        <p className="font-bold">هنوز کالایی تعریف نشده است</p>
                                    </div>
                                ) : items.map(i => (
                                    <div key={i.id} className="bg-white dark:bg-gray-900/40 border border-gray-200 dark:border-white/10 rounded-2xl p-5 shadow-sm relative group overflow-hidden">
                                        <div className="absolute top-0 right-0 w-1.5 h-full bg-blue-500"></div>
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                <div className="text-lg font-black text-gray-800 dark:text-gray-100 leading-tight">{i.name}</div>
                                                <div className="text-[10px] font-mono text-gray-400 font-bold mt-1">کد کالای سیستمی: {i.code || '---'}</div>
                                            </div>
                                            <div className="bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 px-3 py-1.5 rounded-xl text-xs font-black border border-blue-100 dark:border-white/5">{i.unit}</div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => setEditingItem(i)} className="flex-1 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 py-3 rounded-xl text-xs font-black shadow-sm flex items-center justify-center gap-1 active:scale-95 transition-transform"><Edit size={16}/> ویرایش</button>
                                            {currentUser.role === UserRole.ADMIN && (
                                                <button onClick={()=>handleDeleteItem(i.id)} className="flex-1 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 py-3 rounded-xl text-xs font-black shadow-sm flex items-center justify-center gap-1 active:scale-95 transition-transform"><Trash2 size={16}/> حذف</button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                             <div className="bg-white dark:bg-gray-900/20 border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm">
                                 <table className="w-full text-sm text-right">
                                     <thead className="bg-gray-100 dark:bg-black/40 text-gray-600 dark:text-gray-400"><tr><th className="p-4 pr-8">کد</th><th className="p-4">نام کالا</th><th className="p-4">واحد سنجش</th><th className="p-4 text-center">عملیات مدیریت</th></tr></thead>
                                     <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                                         {items.map(i => (
                                            <tr key={i.id} className="border-t hover:bg-gray-50 dark:hover:bg-white/5 transition-all group">
                                                <td className="p-4 pr-8 font-mono font-bold text-gray-400 group-hover:text-gray-600">{i.code || '-'}</td>
                                                <td className="p-4 font-black text-gray-800 dark:text-gray-100">{i.name}</td>
                                                <td className="p-4"><span className="bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full text-[10px] font-black text-gray-500">{i.unit}</span></td>
                                                <td className="p-4 text-center">
                                                    <div className="flex justify-center gap-2">
                                                        <button onClick={() => setEditingItem(i)} className="p-2 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-xl transition-all"><Edit size={20}/></button>
                                                        <button onClick={()=>handleDeleteItem(i.id)} className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"><Trash2 size={20}/></button>
                                                    </div>
                                                </td>
                                            </tr>
                                         ))}
                                     </tbody>
                                 </table>
                             </div>
                        )}
                    </div>
                )}

                {/* ENTRY TAB - Mobile Optimized */}
                {activeTab === 'entry' && (
                    <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 pb-24">
                        <div className="bg-emerald-50 dark:bg-emerald-900/20 p-5 rounded-3xl border border-emerald-200 dark:border-emerald-800 mb-6 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-100 dark:bg-emerald-800/30 rounded-full -translate-y-12 translate-x-12 blur-2xl"></div>
                            <h3 className="font-black text-emerald-800 dark:text-emerald-300 flex items-center gap-2 relative z-10"><ArrowDownCircle/> ثبت ورود کالا (رسید انبار)</h3>
                            <p className="text-[10px] font-bold text-emerald-600/70 mr-8 relative z-10">ثبت اقلام وارد شده به انبار بر اساس پروفرما یا فاکتور</p>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
                            <div className="space-y-1.5 flex flex-col">
                                <label className="text-xs font-black text-gray-500 mr-2 flex items-center gap-1"><Home size={14}/> شرکت مالک</label>
                                <select className="w-full border-2 border-gray-100 dark:border-white/5 rounded-2xl p-3.5 bg-white dark:bg-gray-800/80 font-bold outline-none focus:border-emerald-500 transition-all shadow-sm" value={selectedCompany} onChange={e=>setSelectedCompany(e.target.value)}>
                                    <option value="">انتخاب شرکت...</option>
                                    {companyList.map(c=><option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1.5 flex flex-col">
                                <label className="text-xs font-black text-gray-500 mr-2 flex items-center gap-1"><FileText size={14}/> شماره پروفرما / سند</label>
                                <input className="w-full border-2 border-gray-100 dark:border-white/5 rounded-2xl p-3.5 bg-white dark:bg-gray-800/80 font-bold outline-none focus:border-emerald-500 transition-all shadow-sm" placeholder="مثلا: PI-1403-001" value={proformaNumber} onChange={e=>setProformaNumber(e.target.value)}/>
                            </div>
                            <div className="space-y-1.5 flex flex-col">
                                <label className="text-xs font-black text-gray-500 mr-2 flex items-center gap-1"><Calendar size={14}/> تاریخ ورود</label>
                                <div className="flex gap-1.5 dir-ltr">
                                    <select className="border-2 border-gray-100 dark:border-white/5 rounded-2xl p-3.5 flex-1 bg-white dark:bg-gray-800 font-bold" value={txDate.year} onChange={e=>setTxDate({...txDate, year:Number(e.target.value)})}>{years.map(y=><option key={y} value={y}>{y}</option>)}</select>
                                    <select className="border-2 border-gray-100 dark:border-white/5 rounded-2xl p-3.5 flex-1 bg-white dark:bg-gray-800 font-bold" value={txDate.month} onChange={e=>setTxDate({...txDate, month:Number(e.target.value)})}>{months.map(m=><option key={m} value={m}>{m}</option>)}</select>
                                    <select className="border-2 border-gray-100 dark:border-white/5 rounded-2xl p-3.5 flex-1 bg-white dark:bg-gray-800 font-bold" value={txDate.day} onChange={e=>setTxDate({...txDate, day:Number(e.target.value)})}>{days.map(d=><option key={d} value={d}>{d}</option>)}</select>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-gray-900/40 p-5 rounded-[2.5rem] border border-gray-200 dark:border-white/10 shadow-sm mb-10 overflow-hidden">
                            <h4 className="text-xs font-black text-gray-400 mb-6 flex items-center gap-2"><List size={14}/> اقلام رسید</h4>
                            <div className="space-y-6">
                                {txItems.map((row, idx) => (
                                    <div key={idx} className="flex flex-col md:flex-row gap-5 items-end bg-gray-50 dark:bg-gray-800/20 p-5 rounded-[2rem] border border-gray-100 dark:border-white/5 relative group transition-all hover:shadow-md">
                                        <div className="flex-1 w-full space-y-1.5">
                                            <label className="text-[10px] font-black text-gray-400 mr-2">نام کالا ({idx + 1})</label>
                                            <select className="w-full border-2 border-gray-100 dark:border-white/5 rounded-2xl p-3.5 bg-white dark:bg-gray-800 font-black text-sm" value={row.itemId} onChange={e=>updateTxItem(idx, 'itemId', e.target.value)}>
                                                <option value="">انتخاب نوع کالا...</option>
                                                {items.map(i=><option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
                                            </select>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full md:w-auto">
                                            <div className="space-y-1.5 flex flex-col">
                                                <label className="text-[10px] font-black text-gray-400 text-center">تعداد</label>
                                                <input type="number" className="w-full border-2 border-gray-100 dark:border-white/5 rounded-2xl p-3.5 bg-white dark:bg-gray-800 font-black text-center dir-ltr" value={row.quantity === 0 ? '' : row.quantity} onFocus={e => e.target.select()} onChange={e=>updateTxItem(idx, 'quantity', e.target.value === '' ? 0 : Number(e.target.value))}/>
                                            </div>
                                            <div className="space-y-1.5 flex flex-col">
                                                <label className="text-[10px] font-black text-gray-400 text-center">وزن (KG)</label>
                                                <input type="number" className="w-full border-2 border-gray-100 dark:border-white/5 rounded-2xl p-3.5 bg-white dark:bg-gray-800 font-black text-center dir-ltr" value={row.weight === 0 ? '' : row.weight} onFocus={e => e.target.select()} onChange={e=>updateTxItem(idx, 'weight', e.target.value === '' ? 0 : Number(e.target.value))}/>
                                            </div>
                                        </div>
                                        <div className="w-full md:w-44 space-y-1.5 flex flex-col">
                                            <label className="text-[10px] font-black text-gray-400 mr-2">فی واحد (ریال)</label>
                                            <input type="text" className="w-full border-2 border-gray-100 dark:border-white/5 rounded-2xl p-3.5 bg-white dark:bg-gray-800 font-black text-blue-600 text-center dir-ltr" value={formatNumberString(row.unitPrice)} onChange={e=>updateTxItem(idx, 'unitPrice', deformatNumberString(e.target.value))}/>
                                        </div>
                                        {idx > 0 && (
                                            <button onClick={()=>handleRemoveTxItemRow(idx)} className="text-red-500 p-4 bg-red-50 dark:bg-red-900/20 rounded-2xl w-full md:w-auto flex justify-center hover:bg-red-100 active:scale-90 transition-all">
                                                <Trash2 size={24}/>
                                            </button>
                                        )}
                                    </div>
                                ))}
                                <button onClick={handleAddTxItemRow} className="w-full py-5 border-2 border-dashed border-gray-200 dark:border-white/10 rounded-3xl text-blue-600 font-black text-xs flex items-center justify-center gap-2 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all active:scale-[0.98] group">
                                    <Plus className="group-hover:rotate-90 transition-transform"/> افزودن ردیف کالای جدید
                                </button>
                            </div>
                        </div>
                        
                        <div className={isMobile ? 'fixed bottom-4 left-4 right-4 z-50' : 'flex justify-center'}>
                             <button onClick={()=>handleSubmitTx('IN')} className="w-full md:w-80 bg-emerald-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-emerald-600/30 active:scale-95 transition-all hover:bg-emerald-700 flex items-center justify-center gap-2 text-base">
                                <Save size={20}/> ثبت و صدور رسید انبار
                             </button>
                        </div>
                    </div>
                )}
                
                {/* EXIT TAB - Mobile Optimized */}
                {activeTab === 'exit' && (
                    <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 pb-32">
                        <div className="bg-rose-50 dark:bg-rose-900/20 p-5 p-md:p-8 rounded-[2.5rem] border border-rose-200 dark:border-rose-800 mb-8 flex flex-col md:flex-row justify-between items-center gap-6 relative overflow-hidden">
                             <div className="absolute top-0 right-0 w-32 h-32 bg-red-100 dark:bg-rose-800/30 rounded-full -translate-y-16 translate-x-16 blur-3xl opacity-50"></div>
                             <div className="relative z-10 text-center md:text-right">
                                <h3 className="font-black text-rose-800 dark:text-rose-300 text-xl flex items-center justify-center md:justify-start gap-2 mb-1"><ArrowUpCircle size={28}/> صدور بیجک خروجی</h3>
                                <p className="text-xs font-bold text-rose-600/70 md:mr-9">ثبت حواله خروج کالا و اعلام بار راننده</p>
                            </div>
                            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md px-6 py-3 rounded-3xl shadow-xl border-2 border-white dark:border-white/5 text-center relative z-10 w-full md:w-auto min-w-[140px]">
                                <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">شماره حواله سیستمی</div>
                                <div className="text-3xl font-black text-rose-600 font-mono leading-none flex items-center justify-center gap-3">
                                    {loadingBijakNum ? <Loader2 className="animate-spin" size={24}/> : (nextBijakNum > 0 ? nextBijakNum : '---')}
                                    {!loadingBijakNum && !!selectedCompany && <button type="button" onClick={updateNextBijak} className="text-gray-300 hover:text-blue-500 transition-colors"><RefreshCw size={16}/></button>}
                                </div>
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
                            <div className="space-y-1.5 flex flex-col">
                                <label className="text-xs font-black text-gray-500 mr-2 flex items-center gap-1"><Home size={14}/> شرکت فرستنده بار</label>
                                <select className="w-full border-2 border-gray-100 dark:border-white/5 rounded-2xl p-3.5 bg-white dark:bg-gray-800/80 font-bold outline-none focus:border-rose-500 transition-all shadow-sm" value={selectedCompany} onChange={e => { setSelectedCompany(e.target.value); }}>
                                    <option value="">انتخاب شرکت...</option>
                                    {companyList.map(c=><option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1.5 flex flex-col">
                                <label className="text-xs font-black text-gray-500 mr-2 flex items-center gap-1"><Calendar size={14}/> تاریخ خروج کانتینر / تریلی</label>
                                <div className="flex gap-1.5 dir-ltr font-bold">
                                    <select className="border-2 border-gray-100 dark:border-white/5 rounded-2xl p-3.5 flex-1 bg-white dark:bg-gray-800" value={txDate.year} onChange={e=>setTxDate({...txDate, year:Number(e.target.value)})}>{years.map(y=><option key={y} value={y}>{y}</option>)}</select>
                                    <select className="border-2 border-gray-100 dark:border-white/5 rounded-2xl p-3.5 flex-1 bg-white dark:bg-gray-800" value={txDate.month} onChange={e=>setTxDate({...txDate, month:Number(e.target.value)})}>{months.map(m=><option key={m} value={m}>{m}</option>)}</select>
                                    <select className="border-2 border-gray-100 dark:border-white/5 rounded-2xl p-3.5 flex-1 bg-white dark:bg-gray-800" value={txDate.day} onChange={e=>setTxDate({...txDate, day:Number(e.target.value)})}>{days.map(d=><option key={d} value={d}>{d}</option>)}</select>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-gray-900/60 p-6 rounded-[2.5rem] border border-gray-200 dark:border-white/10 shadow-xl mb-8 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                            <div className="col-span-2 md:col-span-1 space-y-1.5">
                                <label className="text-[10px] font-black text-gray-400 mr-2 uppercase tracking-wide">تحویل گیرنده نهایی</label>
                                <input className="w-full border-2 border-gray-100 dark:border-white/5 rounded-2xl p-3.5 text-sm font-bold bg-gray-50 dark:bg-gray-800 focus:bg-white transition-all shadow-inner outline-none focus:border-rose-500" placeholder="نام خریدار یا انبار مقصد" value={recipientName} onChange={e=>setRecipientName(e.target.value)}/>
                            </div>
                            <div className="col-span-1 space-y-1.5">
                                <label className="text-[10px] font-black text-gray-400 mr-2 uppercase tracking-wide">نام راننده حامل</label>
                                <input className="w-full border-2 border-gray-100 dark:border-white/5 rounded-2xl p-3.5 text-sm font-bold bg-gray-50 dark:bg-gray-800 focus:bg-white transition-all shadow-inner outline-none focus:border-rose-500" placeholder="..." value={driverName} onChange={e=>setDriverName(e.target.value)}/>
                            </div>
                            <div className="col-span-1 space-y-1.5 text-center">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-wide">شماره پلاک</label>
                                <input className="w-full border-2 border-gray-100 dark:border-white/5 rounded-2xl p-3.5 text-sm font-black bg-gray-50 dark:bg-gray-800 focus:bg-white transition-all shadow-inner outline-none focus:border-rose-500 dir-ltr text-center" placeholder="-- --- --" value={plateNumber} onChange={e=>setPlateNumber(e.target.value)}/>
                            </div>
                            <div className="col-span-2 md:col-span-1 space-y-1.5 flex flex-col">
                                <label className="text-[10px] font-black text-gray-400 mr-2 uppercase tracking-wide flex items-center gap-1"><Navigation size={10}/> مقصد بارگیری</label>
                                <input className="w-full border-2 border-gray-100 dark:border-white/5 rounded-2xl p-3.5 text-sm font-bold bg-gray-50 dark:bg-gray-800 focus:bg-white transition-all shadow-inner outline-none focus:border-rose-500" placeholder="شهر یا بندر" value={destination} onChange={e=>setDestination(e.target.value)}/>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-gray-900/40 p-5 rounded-[2.5rem] border border-gray-200 dark:border-white/10 shadow-sm mb-12">
                            <h4 className="text-[10px] font-black text-gray-400 mb-5 flex items-center gap-2 uppercase tracking-[0.2em] px-4"><List size={14} className="text-rose-500"/> جزییات اقلام خروج</h4>
                            <div className="space-y-6">
                                {txItems.map((row, idx) => (
                                    <div key={idx} className="flex flex-col md:flex-row gap-5 items-end bg-gray-50 dark:bg-gray-800/20 p-5 rounded-[2rem] border border-gray-100 dark:border-white/5 group transition-all hover:shadow-lg">
                                        <div className="flex-1 w-full space-y-1.5 flex flex-col">
                                            <label className="text-[10px] font-black text-gray-400 mr-2">انتخاب کالا ({idx + 1})</label>
                                            <select className="w-full border-2 border-gray-100 dark:border-white/5 rounded-2xl p-3.5 bg-white dark:bg-gray-800 font-black text-sm" value={row.itemId} onChange={e=>updateTxItem(idx, 'itemId', e.target.value)}>
                                                <option value="">جستجوی کالا...</option>
                                                {items.map(i=><option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
                                            </select>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full md:w-auto">
                                            <div className="space-y-1.5 flex flex-col">
                                                <label className="text-[10px] font-black text-gray-400 text-center">تعداد</label>
                                                <input type="number" className="w-full border-2 border-gray-100 dark:border-white/5 rounded-2xl p-3.5 bg-white dark:bg-gray-800 font-black text-center dir-ltr" value={row.quantity === 0 ? '' : row.quantity} onFocus={e => e.target.select()} onChange={e=>updateTxItem(idx, 'quantity', e.target.value === '' ? 0 : Number(e.target.value))}/>
                                            </div>
                                            <div className="space-y-1.5 flex flex-col">
                                                <label className="text-[10px] font-black text-gray-400 text-center">وزن (KG)</label>
                                                <input type="number" className="w-full border-2 border-gray-100 dark:border-white/5 rounded-2xl p-3.5 bg-white dark:bg-gray-800 font-black text-center dir-ltr" value={row.weight === 0 ? '' : row.weight} onFocus={e => e.target.select()} onChange={e=>updateTxItem(idx, 'weight', e.target.value === '' ? 0 : Number(e.target.value))}/>
                                            </div>
                                        </div>
                                        <div className="w-full md:w-44 space-y-1.5 flex flex-col">
                                            <label className="text-[10px] font-black text-gray-400 mr-2 text-center">فی واحد (ریال)</label>
                                            <input type="text" className="w-full border-2 border-gray-100 dark:border-white/5 rounded-2xl p-3.5 bg-white dark:bg-gray-800 font-black text-rose-600 text-center dir-ltr" value={formatNumberString(row.unitPrice)} onChange={e=>updateTxItem(idx, 'unitPrice', deformatNumberString(e.target.value))}/>
                                        </div>
                                        {idx > 0 && (
                                            <button onClick={()=>handleRemoveTxItemRow(idx)} className="text-red-500 p-4 bg-red-50 dark:bg-red-900/20 rounded-2xl w-full md:w-auto flex justify-center hover:bg-red-100 active:rotate-12 transition-all">
                                                <Trash2 size={24}/>
                                            </button>
                                        )}
                                    </div>
                                ))}
                                <button onClick={handleAddTxItemRow} className="w-full py-5 border-2 border-dashed border-gray-200 dark:border-white/10 rounded-[2rem] text-rose-600 font-black text-xs flex items-center justify-center gap-2 hover:bg-rose-50 dark:hover:bg-rose-900/10 transition-all active:scale-[0.98]">
                                    <Plus size={18}/> افزودن ردیف کالای اضافه
                                </button>
                            </div>
                        </div>
                        
                        <div className={isMobile ? 'fixed bottom-4 left-4 right-4 z-50' : 'flex justify-center'}>
                             <button onClick={()=>handleSubmitTx('OUT')} className="w-full md:w-96 bg-rose-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-rose-600/40 active:scale-95 transition-all hover:bg-rose-700 flex items-center justify-center gap-3 text-lg">
                                <Send size={22} className="-rotate-12"/> ثبت نهایی و ارسال جهت تایید بیجک
                             </button>
                        </div>
                    </div>
                )}
                
                {/* --- ARCHIVE TAB (Mobile Optimized) --- */}
                {activeTab === 'archive' && (
                    <div className="space-y-4 animate-fade-in">
                        {/* Search Bar */}
                        <div className="glass-panel p-4 rounded-xl shadow-sm border flex flex-col gap-2">
                             <h3 className="font-bold text-gray-800 flex items-center gap-2"><Archive size={20}/> آرشیو حواله‌های خروج</h3>
                             <div className="flex gap-2">
                                <select className="border rounded-lg p-2 text-sm flex-1" value={archiveFilterCompany} onChange={e => setArchiveFilterCompany(e.target.value)}><option value="">همه شرکت‌ها</option>{companyList.map(c => <option key={c} value={c}>{c}</option>)}</select>
                                <input className="border rounded-lg p-2 text-sm flex-1" placeholder="جستجو..." value={reportSearch} onChange={e => setReportSearch(e.target.value)} />
                            </div>
                        </div>

                        {/* Mobile Cards */}
                        {isMobile ? (
                            <div className="space-y-3">
                                {filteredArchiveBijaks.length === 0 ? <div className="text-center text-gray-400 py-10">موردی یافت نشد</div> : filteredArchiveBijaks.map(tx => (
                                    <div key={tx.id} className="glass-panel border rounded-xl p-4 shadow-sm relative">
                                        <div className="absolute top-4 left-4 text-xs bg-gray-100 px-2 py-1 rounded">{tx.status}</div>
                                        <div className="font-bold text-red-600 mb-1">#{tx.number}</div>
                                        <div className="text-sm font-bold text-gray-800 mb-1">{tx.company}</div>
                                        <div className="text-xs text-gray-600 mb-2">{tx.recipientName}</div>
                                        <div className="text-xs text-gray-400 mb-3">{formatDate(tx.date)}</div>
                                        <div className="flex gap-2 justify-end border-t pt-2">
                                             <button onClick={() => setViewBijak(tx)} className="text-blue-600 p-2 bg-blue-50 rounded-lg"><Eye size={18}/></button>
                                             {(currentUser.role === UserRole.ADMIN || (tx.status === 'PENDING' && currentUser.role === UserRole.WAREHOUSE_KEEPER)) && (
                                                <button onClick={() => setEditingBijak(tx)} className="text-amber-600 p-2 bg-amber-50 rounded-lg"><Edit size={18}/></button>
                                             )}
                                             {currentUser.role === UserRole.ADMIN && <button onClick={() => handleDeleteTx(tx.id)} className="text-red-600 p-2 bg-red-50 rounded-lg"><Trash2 size={18}/></button>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="glass-panel rounded-xl border shadow-sm overflow-hidden">
                                <table className="w-full text-sm text-right">
                                    <thead className="bg-gray-100 text-gray-600"><tr><th className="p-4">شماره</th><th className="p-4">تاریخ</th><th className="p-4">شرکت</th><th className="p-4">گیرنده</th><th className="p-4">وضعیت</th><th className="p-4 text-center">عملیات</th></tr></thead>
                                    <tbody className="divide-y">
                                        {filteredArchiveBijaks.map(tx => (
                                            <tr key={tx.id} className="hover:bg-gray-50">
                                                <td className="p-4 font-mono font-bold text-red-600">#{tx.number}</td>
                                                <td className="p-4 text-xs">{formatDate(tx.date)}</td>
                                                <td className="p-4 text-xs font-bold">{tx.company}</td>
                                                <td className="p-4 text-xs">{tx.recipientName}</td>
                                                <td className="p-4"><span className={`text-[10px] px-2 py-1 rounded font-bold w-fit ${tx.status === 'APPROVED' ? 'bg-green-100 text-green-700' : tx.status === 'REJECTED' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-800'}`}>{tx.status}</span></td>
                                                <td className="p-4 text-center flex justify-center gap-2">
                                                    <button onClick={() => setViewBijak(tx)} className="text-blue-600 hover:text-blue-800 p-1"><Eye size={16}/></button>
                                                    {(currentUser.role === UserRole.ADMIN || (tx.status === 'PENDING' && currentUser.role === UserRole.WAREHOUSE_KEEPER)) && <button onClick={() => setEditingBijak(tx)} className="text-amber-600 hover:text-amber-800 p-1"><Edit size={16}/></button>}
                                                    {(currentUser.role === UserRole.ADMIN) && <button onClick={() => handleDeleteTx(tx.id)} className="text-red-600 hover:text-red-800 p-1"><Trash2 size={16}/></button>}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* ENTRY ARCHIVE TAB */}
                {activeTab === 'entry_archive' && (
                    <div className="space-y-4 animate-fade-in">
                        {/* Search Bar */}
                        <div className="glass-panel p-4 rounded-xl shadow-sm border flex flex-col gap-2">
                                <h3 className="font-bold text-gray-800 flex items-center gap-2"><ArrowDownCircle size={20} className="text-green-600"/> آرشیو رسیدهای ورود</h3>
                                <div className="flex gap-2">
                                <select className="border rounded-lg p-2 text-sm flex-1" value={archiveFilterCompany} onChange={e => setArchiveFilterCompany(e.target.value)}><option value="">همه شرکت‌ها</option>{companyList.map(c => <option key={c} value={c}>{c}</option>)}</select>
                                <input className="border rounded-lg p-2 text-sm flex-1" placeholder="جستجو (پروفرما)..." value={reportSearch} onChange={e => setReportSearch(e.target.value)} />
                            </div>
                        </div>

                        {/* List */}
                        {isMobile ? (
                            <div className="space-y-3">
                                {filteredArchiveReceipts.length === 0 ? <div className="text-center text-gray-400 py-10">موردی یافت نشد</div> : filteredArchiveReceipts.map(tx => (
                                    <div key={tx.id} className="glass-panel border rounded-xl p-4 shadow-sm relative">
                                        <div className="font-bold text-green-600 mb-1">پروفرما: {tx.proformaNumber}</div>
                                        <div className="text-sm font-bold text-gray-800 mb-1">{tx.company}</div>
                                        <div className="text-xs text-gray-400 mb-3">{formatDate(tx.date)}</div>
                                        <div className="flex gap-2 justify-end border-t pt-2">
                                                <button onClick={() => setEditingReceipt(tx)} className="text-amber-600 p-2 bg-amber-50 rounded-lg"><Edit size={18}/></button>
                                                {currentUser.role === UserRole.ADMIN && <button onClick={() => handleDeleteTx(tx.id)} className="text-red-600 p-2 bg-red-50 rounded-lg"><Trash2 size={18}/></button>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="glass-panel rounded-xl border shadow-sm overflow-hidden">
                                <table className="w-full text-sm text-right">
                                    <thead className="bg-gray-100 text-gray-600"><tr><th className="p-4">پروفرما</th><th className="p-4">تاریخ</th><th className="p-4">شرکت</th><th className="p-4 text-center">عملیات</th></tr></thead>
                                    <tbody className="divide-y">
                                        {filteredArchiveReceipts.map(tx => (
                                            <tr key={tx.id} className="hover:bg-gray-50">
                                                <td className="p-4 font-mono font-bold text-green-600">{tx.proformaNumber}</td>
                                                <td className="p-4 text-xs">{formatDate(tx.date)}</td>
                                                <td className="p-4 text-xs font-bold">{tx.company}</td>
                                                <td className="p-4 text-center flex justify-center gap-2">
                                                    <button onClick={() => setEditingReceipt(tx)} className="text-amber-600 hover:text-amber-800 p-1"><Edit size={16}/></button>
                                                    {(currentUser.role === UserRole.ADMIN) && <button onClick={() => handleDeleteTx(tx.id)} className="text-red-600 hover:text-red-800 p-1"><Trash2 size={16}/></button>}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* REPORTS TAB (KARDEX) */}
                {activeTab === 'reports' && (
                    <div className="glass-panel p-4 rounded-xl shadow-sm border h-full">
                        <WarehouseKardexReport items={items} transactions={safeTransactions} companies={companyList} />
                    </div>
                )}

                {/* STOCK REPORT TAB */}
                {activeTab === 'stock_report' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 pb-20">
                        <div className="glass-panel p-4 md:p-5 rounded-2xl shadow-sm border border-gray-200 dark:border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
                            <div className="flex items-center gap-3">
                                <div className="bg-orange-100 p-2 rounded-xl"><BarChart3 size={24} className="text-orange-600"/></div>
                                <div>
                                    <h3 className="font-black text-gray-800 dark:text-white">موجودی لحظه‌ای انبار</h3>
                                    <p className="text-[10px] font-bold text-gray-400">آخرین برآورد کلی موجودی تمام انبارها</p>
                                </div>
                            </div>
                            <div className="flex gap-2 w-full md:w-auto">
                                <button onClick={handlePrintStock} className="flex-1 md:flex-none justify-center bg-blue-600 text-white px-5 py-3 rounded-xl flex items-center gap-2 text-xs font-black shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all">
                                    <Printer size={16}/> چاپ گزارش
                                </button>
                                <button onClick={handleExportExcel} className="flex-1 md:flex-none justify-center bg-green-600 text-white px-5 py-3 rounded-xl flex items-center gap-2 text-xs font-black shadow-lg shadow-green-600/20 hover:bg-green-700 transition-all">
                                    <FileSpreadsheet size={16}/> خروجی اکسل
                                </button>
                            </div>
                        </div>
                        
                        {isMobile ? (
                            <div className="grid grid-cols-1 gap-6">
                                {allWarehousesStock.map(group => (
                                    <div key={group.company} className="bg-white dark:bg-gray-900/40 border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm">
                                        <div className="bg-gray-50 dark:bg-gray-800/50 p-4 border-b border-gray-200 dark:border-white/5 flex justify-between items-center">
                                            <h4 className="font-black text-gray-800 dark:text-white">{group.company}</h4>
                                            <div className="text-[10px] font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded-full">{group.items.length} قلم کالا</div>
                                        </div>
                                        <div className="divide-y divide-gray-100 dark:divide-white/5">
                                            {group.items.map(item => (
                                                <div key={item.id} className="p-4 flex justify-between items-center bg-white dark:bg-transparent">
                                                    <div className="space-y-1">
                                                        <div className="text-sm font-black text-gray-800 dark:text-gray-100">{item.name}</div>
                                                        <div className="text-[10px] text-gray-400 font-bold bg-gray-50 dark:bg-gray-800 px-2 py-0.5 rounded-md inline-block">کد: {items.find(i=>i.id===item.id)?.code || '---'}</div>
                                                    </div>
                                                    <div className="text-left">
                                                        <div className="text-base font-black text-blue-600 font-mono">{formatNumberString(item.quantity)} <span className="text-[10px] font-bold text-gray-400">{items.find(i=>i.id===item.id)?.unit}</span></div>
                                                        <div className="text-[11px] font-bold text-gray-500 font-mono">{formatNumberString(item.weight)} <span className="text-[9px] opacity-70">KG</span></div>
                                                        {item.containerCount > 0 && (
                                                            <div className="text-[10px] font-black text-orange-600 mt-1 py-0.5 px-1.5 bg-orange-50 dark:bg-orange-900/20 rounded inline-block">
                                                                📦 {item.containerCount.toFixed(1)} کانتینر
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="bg-white dark:bg-gray-900/20 border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-center">
                                        <thead className="bg-gray-800 dark:bg-black/40 text-white">
                                            <tr>
                                                <th className="p-4 text-right pr-10">شرکت / نام کالا</th>
                                                <th className="p-4">موجودی تعدادی</th>
                                                <th className="p-4">موجودی وزنی (KG)</th>
                                                <th className="p-4">تخمین کانتینر</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {allWarehousesStock.map((group) => (
                                                <React.Fragment key={group.company}>
                                                    <tr className="bg-blue-50 dark:bg-blue-900/10 font-black text-blue-900 dark:text-blue-300">
                                                        <td colSpan={4} className="p-3 text-right pr-4 border-t border-blue-100 dark:border-white/5 flex items-center gap-2">
                                                            <div className="w-2 h-2 rounded-full bg-blue-600"></div>
                                                            {group.company}
                                                        </td>
                                                    </tr>
                                                    {group.items.map(item => (
                                                        <tr key={item.id} className="border-b border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                                                            <td className="p-3 text-right pr-10 font-bold text-gray-700 dark:text-gray-300">{item.name}</td>
                                                            <td className="p-3 font-mono font-black text-blue-600 text-lg">{formatNumberString(item.quantity)}</td>
                                                            <td className="p-3 font-mono font-bold text-gray-600 dark:text-gray-400">{formatNumberString(item.weight)}</td>
                                                            <td className="p-3 font-mono text-orange-600 font-black">{item.containerCount > 0 ? item.containerCount.toFixed(2) : '-'}</td>
                                                        </tr>
                                                    ))}
                                                </React.Fragment>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                )}

            </div>
            
            {viewBijak && (
                <PrintBijak 
                    tx={viewBijak} 
                    onClose={() => setViewBijak(null)} 
                    settings={settings}
                    transactions={safeTransactions}
                    onApprove={canApprove && viewBijak.status === 'PENDING' ? () => handleApproveBijak(viewBijak) : undefined}
                    onReject={canApprove && viewBijak.status === 'PENDING' ? () => handleRejectBijak(viewBijak) : undefined} 
                />
            )}

            {/* Edit Modals */}
            {editingBijak && (
                <TransactionEditModal 
                    tx={editingBijak} 
                    onClose={() => setEditingBijak(null)} 
                    onSave={handleEditBijakSave} 
                    items={items} 
                />
            )}
            
            {editingReceipt && (
                <TransactionEditModal 
                    tx={editingReceipt} 
                    onClose={() => setEditingReceipt(null)} 
                    onSave={handleEditReceiptSave} 
                    items={items} 
                />
            )}

            {/* Subtab Back Trigger for Mobile Back gesture */}
            {activeTab !== 'dashboard' && (
                <button 
                    data-subtab-back="true" 
                    onClick={() => setActiveTab('dashboard')} 
                    className="hidden"
                />
            )}
        </div>
    );
};

export default WarehouseModule;
