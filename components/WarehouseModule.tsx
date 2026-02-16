import React, { useState, useEffect, useMemo, useRef } from 'react';
import { User, SystemSettings, WarehouseItem, WarehouseTransaction, WarehouseTransactionItem, UserRole } from '../types';
import { getWarehouseItems, saveWarehouseItem, deleteWarehouseItem, getWarehouseTransactions, saveWarehouseTransaction, deleteWarehouseTransaction, updateWarehouseTransaction, getNextBijakNumber, updateWarehouseItem } from '../services/storageService';
import { generateUUID, getCurrentShamsiDate, jalaliToGregorian, formatNumberString, deformatNumberString, formatDate, parsePersianDate, getShamsiDateFromIso } from '../constants';
import { Package, Plus, Trash2, ArrowDownCircle, ArrowUpCircle, FileText, BarChart3, Eye, Loader2, AlertTriangle, Settings, ArrowLeftRight, Search, FileClock, Printer, FileDown, Share2, LayoutGrid, Archive, Edit, Save, X, Container, CheckCircle, XCircle, RefreshCcw, FileSpreadsheet, WifiOff, Filter, Calendar } from 'lucide-react';
import PrintBijak from './PrintBijak';
import PrintStockReport from './print/PrintStockReport'; 
import WarehouseKardexReport from './reports/WarehouseKardexReport';
import { apiCall } from '../services/apiService';
import { getUsers } from '../services/authService';
import useIsMobile from '../hooks/useIsMobile';

interface Props {
    currentUser: User;
    settings?: SystemSettings;
    initialTab?: string;
}

const WarehouseModule: React.FC<Props> = ({ currentUser, settings, initialTab = 'dashboard' }) => {
    const isMobile = useIsMobile();
    const [loadingData, setLoadingData] = useState(true);
    const [activeTab, setActiveTab] = useState(initialTab);
    const [items, setItems] = useState<WarehouseItem[]>([]);
    const [transactions, setTransactions] = useState<WarehouseTransaction[]>([]);
    const [showPrintStockReport, setShowPrintStockReport] = useState(false);
    const [viewBijak, setViewBijak] = useState<WarehouseTransaction | null>(null);

    // Filter States
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCompany, setFilterCompany] = useState<string>('');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoadingData(true);
        try {
            const [fetchedItems, fetchedTxs] = await Promise.all([
                getWarehouseItems(),
                getWarehouseTransactions()
            ]);
            setItems(fetchedItems || []);
            setTransactions(fetchedTxs || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingData(false);
        }
    };

    // --- HISTORY HANDLING ---
    useEffect(() => {
        const handlePopState = (event: PopStateEvent) => {
             if (viewBijak) {
                 setViewBijak(null);
             }
             if (showPrintStockReport) {
                 setShowPrintStockReport(false);
             }
        };
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [viewBijak, showPrintStockReport]);

    const openBijakView = (tx: WarehouseTransaction) => {
        if (isMobile) {
             if (window.location.protocol !== 'blob:') {
                 window.history.pushState({ view: 'bijak_detail', id: tx.id }, '', '#warehouse/view');
             } else {
                 window.history.pushState({ view: 'bijak_detail' }, '');
             }
        }
        setViewBijak(tx);
    };

    const handlePrintStock = () => { 
        if (isMobile) {
             try { window.history.pushState({ view: 'stock_report' }, '', '#warehouse/stock'); } catch(e){}
        }
        setShowPrintStockReport(true); 
    };

    // --- LOGIC ---
    const allWarehousesStock = useMemo(() => {
        const companies = Array.from(new Set(transactions.map(t => t.company).filter(Boolean)));
        return companies.map(comp => {
            const companyItems = items.map(item => {
                let quantity = 0;
                let weight = 0;
                transactions.filter(t => t.company === comp && t.status !== 'REJECTED').forEach(t => {
                    const txItem = t.items.find(i => i.itemId === item.id);
                    if (txItem) {
                        if (t.type === 'IN') {
                            quantity += txItem.quantity;
                            weight += txItem.weight;
                        } else {
                            quantity -= txItem.quantity;
                            weight -= txItem.weight;
                        }
                    }
                });
                return { 
                    ...item, 
                    quantity, 
                    weight, 
                    containerCount: item.containerCapacity ? weight / item.containerCapacity : 0 
                };
            });
            return { company: comp, items: companyItems };
        });
    }, [items, transactions]);

    const filteredTransactions = transactions.filter(t => {
        if (filterCompany && t.company !== filterCompany) return false;
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            return (
                (t.number || '').toString().includes(term) ||
                (t.recipientName || '').toLowerCase().includes(term) ||
                (t.proformaNumber || '').toLowerCase().includes(term) ||
                (t.description || '').toLowerCase().includes(term)
            );
        }
        return true;
    }).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return (
        <div className="bg-white rounded-2xl shadow-sm border h-[calc(100vh-100px)] flex flex-col overflow-hidden animate-fade-in relative">
             {showPrintStockReport && (
                <PrintStockReport 
                    data={allWarehousesStock} 
                    onClose={() => { if(isMobile) window.history.back(); else setShowPrintStockReport(false); }} 
                />
            )}
            
            <div className="flex border-b overflow-x-auto no-scrollbar bg-gray-50">
                <button onClick={() => setActiveTab('dashboard')} className={`px-6 py-3 text-sm font-bold whitespace-nowrap transition-colors ${activeTab === 'dashboard' ? 'bg-white text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>داشبورد و موجودی</button>
                <button onClick={() => setActiveTab('transactions')} className={`px-6 py-3 text-sm font-bold whitespace-nowrap transition-colors ${activeTab === 'transactions' ? 'bg-white text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>گردش کالا</button>
                <button onClick={() => setActiveTab('kardex')} className={`px-6 py-3 text-sm font-bold whitespace-nowrap transition-colors ${activeTab === 'kardex' ? 'bg-white text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>کاردکس ریالی/تعدادی</button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 md:p-6">
                {activeTab === 'dashboard' && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2"><Package className="text-blue-600"/> موجودی لحظه‌ای انبارها</h2>
                            <button onClick={handlePrintStock} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-blue-700"><Printer size={16}/> چاپ گزارش موجودی</button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {allWarehousesStock.map(wh => (
                                <div key={wh.company} className="bg-white border rounded-2xl shadow-sm overflow-hidden">
                                    <div className="bg-gray-100 p-4 font-bold text-gray-700 border-b">{wh.company}</div>
                                    <div className="divide-y">
                                        {wh.items.map(item => (
                                            <div key={item.id} className="p-4 flex justify-between items-center hover:bg-gray-50">
                                                <span className="font-bold text-sm">{item.name}</span>
                                                <div className="text-left">
                                                    <div className="text-lg font-black text-gray-800">{formatNumberString(item.quantity)} <span className="text-xs text-gray-400 font-normal">{item.unit}</span></div>
                                                    <div className="text-xs text-gray-500">{formatNumberString(item.weight)} KG</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'transactions' && (
                    <div className="space-y-4">
                        <div className="flex gap-4 mb-4">
                            <div className="relative flex-1">
                                <input className="w-full border rounded-xl pl-10 pr-4 py-2 text-sm" placeholder="جستجو..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                                <Search className="absolute left-3 top-2.5 text-gray-400" size={18}/>
                            </div>
                        </div>
                        <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
                            <table className="w-full text-sm text-right">
                                <thead className="bg-gray-50 border-b">
                                    <tr>
                                        <th className="p-3">نوع</th>
                                        <th className="p-3">تاریخ</th>
                                        <th className="p-3">شرکت</th>
                                        <th className="p-3">شرح / گیرنده</th>
                                        <th className="p-3 text-center">عملیات</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {filteredTransactions.map(tx => (
                                        <tr key={tx.id} className="hover:bg-gray-50">
                                            <td className="p-3">
                                                <span className={`px-2 py-1 rounded text-xs font-bold ${tx.type === 'IN' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                    {tx.type === 'IN' ? 'ورود' : 'خروج'}
                                                </span>
                                            </td>
                                            <td className="p-3">{formatDate(tx.date)}</td>
                                            <td className="p-3">{tx.company}</td>
                                            <td className="p-3">{tx.type === 'IN' ? `پروفرما: ${tx.proformaNumber}` : `گیرنده: ${tx.recipientName}`}</td>
                                            <td className="p-3 text-center">
                                                <button onClick={() => openBijakView(tx)} className="text-gray-500 hover:text-blue-600 p-1"><Eye size={18}/></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'kardex' && (
                    <WarehouseKardexReport 
                        items={items} 
                        transactions={transactions} 
                        companies={Array.from(new Set(transactions.map(t => t.company)))}
                    />
                )}
            </div>

            {viewBijak && (
                <div className={isMobile ? "fixed inset-0 z-[100] bg-white overflow-y-auto" : ""}>
                    <PrintBijak 
                        tx={viewBijak} 
                        onClose={() => { if(isMobile) window.history.back(); else setViewBijak(null); }} 
                        settings={settings}
                    />
                </div>
            )}
        </div>
    );
};

export default WarehouseModule;