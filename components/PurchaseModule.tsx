
import React, { useState, useEffect } from 'react';
import { 
    PurchaseRequest, PurchaseRequestStatus, User, UserRole, 
    SystemSettings, PurchaseProforma, PartMasterData, PartKardex 
} from '../types';
import { 
    getPurchaseRequests, savePurchaseRequest, updatePurchaseRequest, 
    deletePurchaseRequest, getNextPurchaseRequestNumber, 
    getPartMasterData, savePartMasterData, updatePartMasterData, 
    deletePartMasterData, getPartKardex, uploadFileChunked 
} from '../services/storageService';
import { 
    ShoppingCart, Plus, Search, Filter, Eye, Edit, Trash2, 
    CheckCircle, XCircle, FileText, Package, Truck, 
    ShieldCheck, ClipboardCheck, Warehouse, History, 
    Image as ImageIcon, MoreVertical, Loader2, ArrowRight,
    Ruler, Layers, Tag, Upload, Info, FileUp, UploadCloud, Settings, Printer, FileDown
} from 'lucide-react';
import { formatDate, formatCurrency, generateUUID, getCurrentShamsiDate } from '../constants';
import useIsMobile from '../hooks/useIsMobile';
import * as XLSX from 'xlsx';
import PrintPurchaseRequest from './PrintPurchaseRequest';
import PrintPartDataSheet from './PrintPartDataSheet';
import { generatePdf } from '../utils/pdfGenerator';

const PurchaseModule: React.FC<{ currentUser: User, settings?: SystemSettings, initialTab?: 'DASHBOARD' | 'REQUESTS' | 'PARTS' | 'KARDEX' | 'ARCHIVE' }> = ({ currentUser, settings, initialTab = 'DASHBOARD' }) => {
    const isMobile = useIsMobile();
    const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'REQUESTS' | 'PARTS' | 'KARDEX' | 'ARCHIVE'>(initialTab);
    const [loading, setLoading] = useState(false);
    
    // Requests State
    const [requests, setRequests] = useState<PurchaseRequest[]>([]);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [requestSearch, setRequestSearch] = useState('');
    const [viewRequest, setViewRequest] = useState<PurchaseRequest | null>(null);

    // Parts State
    const [parts, setParts] = useState<PartMasterData[]>([]);
    const [showPartModal, setShowPartModal] = useState(false);
    const [partSearch, setPartSearch] = useState('');
    const [editingPart, setEditingPart] = useState<PartMasterData | null>(null);

    // Kardex State
    const [selectedPartKardex, setSelectedPartKardex] = useState<PartMasterData | null>(null);
    const [kardexEntries, setKardexEntries] = useState<PartKardex[]>([]);

    useEffect(() => {
        loadRequests();
        loadParts();
    }, []);

    const loadRequests = async () => {
        setLoading(true);
        try {
            const data = await getPurchaseRequests();
            setRequests(data.sort((a, b) => b.createdAt - a.createdAt));
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const loadParts = async () => {
        try {
            const data = await getPartMasterData();
            setParts(data);
        } catch (e) { console.error(e); }
    };

    const loadKardex = async (partId: string) => {
        try {
            const data = await getPartKardex(partId);
            setKardexEntries(data);
        } catch (e) { console.error(e); }
    };

    const hasPurchasePerm = (perm: string) => {
        if (currentUser.role === UserRole.ADMIN) return true;
        const rolePerms = settings?.purchaseRolePermissions?.[currentUser.role] || {};
        return !!(rolePerms as any)[perm];
    };

    // Components for each tab will go here
    return (
        <div className="space-y-6 pb-20 animate-fade-in h-full flex flex-col">
            <div className="flex flex-col gap-4">
                <div className="flex justify-between items-center glass-panel p-4 rounded-2xl shadow-sm border border-gray-200">
                    <h1 className="text-xl font-black text-gray-800 flex items-center gap-2">
                        <ShoppingCart className="text-indigo-600"/> مدیریت خرید و کالا
                    </h1>
                </div>
                
                <div className="flex p-1 bg-gray-200 rounded-xl overflow-x-auto no-scrollbar">
                    <button 
                        onClick={() => setActiveTab('DASHBOARD')} 
                        className={`flex-1 py-3 px-4 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'DASHBOARD' ? 'glass-panel text-indigo-700 shadow-md' : 'text-gray-500'}`}
                    >
                        داشبورد کارتابل
                    </button>
                    <button 
                        onClick={() => setActiveTab('REQUESTS')} 
                        className={`flex-1 py-3 px-4 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'REQUESTS' ? 'glass-panel text-indigo-700 shadow-md' : 'text-gray-500'}`}
                    >
                        درخواست‌های فعال
                    </button>
                    <button 
                        onClick={() => setActiveTab('PARTS')} 
                        className={`flex-1 py-3 px-4 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'PARTS' ? 'glass-panel text-indigo-700 shadow-md' : 'text-gray-500'}`}
                    >
                        کدینگ کالا
                    </button>
                    <button 
                        onClick={() => setActiveTab('KARDEX')} 
                        className={`flex-1 py-3 px-4 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'KARDEX' ? 'glass-panel text-indigo-700 shadow-md' : 'text-gray-500'}`}
                    >
                        کاردکس موجودی
                    </button>
                    <button 
                        onClick={() => setActiveTab('ARCHIVE')} 
                        className={`flex-1 py-3 px-4 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'ARCHIVE' ? 'glass-panel text-indigo-700 shadow-md' : 'text-gray-500'}`}
                    >
                        بایگانی نهایی
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar">
                {activeTab === 'DASHBOARD' && (
                    <PurchaseDashboard 
                        requests={requests} 
                        setActiveTab={setActiveTab} 
                        currentUser={currentUser}
                        settings={settings}
                    />
                )}
                {activeTab === 'REQUESTS' && (
                    <PurchaseRequestsTab 
                        requests={requests.filter(r => r.status !== PurchaseRequestStatus.COMPLETED && r.status !== PurchaseRequestStatus.REJECTED)} 
                        currentUser={currentUser} 
                        onRequestUpdate={loadRequests} 
                        parts={parts}
                        settings={settings}
                    />
                )}
                {activeTab === 'ARCHIVE' && (
                    <PurchaseRequestsTab 
                        requests={requests.filter(r => r.status === PurchaseRequestStatus.COMPLETED || r.status === PurchaseRequestStatus.REJECTED)} 
                        currentUser={currentUser} 
                        onRequestUpdate={loadRequests} 
                        parts={parts}
                        isArchive={true}
                        settings={settings}
                    />
                )}
                {activeTab === 'PARTS' && (
                    <PartsTab 
                        parts={parts} 
                        currentUser={currentUser} 
                        onPartUpdate={loadParts}
                        settings={settings}
                    />
                )}
                {activeTab === 'KARDEX' && (
                   <KardexTab 
                        parts={parts} 
                        selectedPart={selectedPartKardex} 
                        setSelectedPart={setSelectedPartKardex}
                        kardexEntries={kardexEntries}
                        loadKardex={loadKardex}
                   />
                )}
            </div>
        </div>
    );
};

// --- DASHBOARD TAB ---
const PurchaseDashboard = ({ requests, setActiveTab, currentUser, settings }: any) => {
    const stats = [
        { label: 'کل درخواست‌ها', count: requests.length, color: 'indigo', icon: ShoppingCart, tab: 'REQUESTS' },
        { label: 'در انتظار تایید', count: requests.filter((r: any) => r.status.includes('PENDING')).length, color: 'amber', icon: ClipboardCheck, tab: 'REQUESTS' },
        { label: 'ورود به کارخانه', count: requests.filter((r: any) => r.status === PurchaseRequestStatus.PENDING_SECURITY_ENTRY || r.status === PurchaseRequestStatus.PENDING_QC).length, color: 'orange', icon: Truck, tab: 'REQUESTS' },
        { label: 'تکمیل شده', count: requests.filter((r: any) => r.status === PurchaseRequestStatus.COMPLETED).length, color: 'green', icon: CheckCircle, tab: 'ARCHIVE' }
    ];

    const hasPurchasePerm = (perm: string) => {
        if (currentUser.role === UserRole.ADMIN) return true;
        const rolePerms = settings?.purchaseRolePermissions?.[currentUser.role] || {};
        return !!(rolePerms as any)[perm];
    };

    const myTasks = requests.filter((r: any) => {
        if (currentUser.role === UserRole.ADMIN) return r.status !== PurchaseRequestStatus.COMPLETED && r.status !== PurchaseRequestStatus.REJECTED;
        
        switch (r.status) {
            case PurchaseRequestStatus.PENDING_TECHNICAL: return hasPurchasePerm('canApproveTechnical');
            case PurchaseRequestStatus.PENDING_FACTORY: return hasPurchasePerm('canApproveFactory');
            case PurchaseRequestStatus.PENDING_CEO: return hasPurchasePerm('canApproveCEO');
            case PurchaseRequestStatus.PENDING_COMMERCIAL_PROFORMA: return hasPurchasePerm('canManageProformas');
            case PurchaseRequestStatus.PENDING_CEO_SELECTION: return hasPurchasePerm('canSelectProforma');
            case PurchaseRequestStatus.PENDING_SECURITY_ENTRY: return hasPurchasePerm('canRegisterEntry');
            case PurchaseRequestStatus.PENDING_QC: return hasPurchasePerm('canCheckQC');
            case PurchaseRequestStatus.PENDING_FACTORY_FINAL: return hasPurchasePerm('canApproveFactoryFinal');
            case PurchaseRequestStatus.PENDING_WAREHOUSE_FINAL: return hasPurchasePerm('canWarehouseFinalize');
            case PurchaseRequestStatus.PENDING_COMMERCIAL_FINAL: return hasPurchasePerm('canCommercialFinalize');
            default: return false;
        }
    });

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {stats.map((s, idx) => (
                    <div key={idx} onClick={() => setActiveTab(s.tab)} className={`glass-panel p-6 rounded-[2rem] border-2 cursor-pointer hover:scale-105 transition-all text-center flex flex-col items-center justify-center gap-2 border-indigo-100 bg-indigo-50/30`}>
                        <div className={`p-3 rounded-2xl bg-indigo-100 text-indigo-600`}>
                            <s.icon size={28} />
                        </div>
                        <div className="text-2xl font-black text-gray-800">{s.count}</div>
                        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{s.label}</div>
                    </div>
                ))}
            </div>

            <div className="glass-panel p-6 rounded-[2.5rem] border border-gray-100 bg-white shadow-sm">
                <h3 className="font-black text-indigo-900 border-b pb-4 mb-4 flex items-center gap-2"><ClipboardCheck /> کارتابل وظایف من</h3>
                {myTasks.length === 0 ? (
                    <div className="py-12 text-center text-gray-300 italic">موردی جهت اقدام شما یافت نشد.</div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {myTasks.slice(0, 6).map((req: any) => (
                            <div key={req.id} onClick={() => setActiveTab('REQUESTS')} className="p-4 bg-gray-50 rounded-2xl border border-dashed border-gray-300 hover:border-indigo-400 hover:bg-indigo-50 transition-all cursor-pointer group">
                                <div className="flex justify-between items-start mb-2">
                                    <span className="text-[9px] font-mono font-bold text-gray-400">#{req.requestNumber}</span>
                                    <span className="text-[9px] font-bold text-gray-500 bg-white px-2 py-0.5 rounded-full shadow-sm">{formatDate(req.date)}</span>
                                </div>
                                <h4 className="font-black text-gray-800 text-sm group-hover:text-indigo-700 transition-colors uppercase tracking-tight line-clamp-1">{req.itemName}</h4>
                                <div className="mt-2 flex items-center justify-between">
                                    <span className="text-[10px] font-bold text-gray-400">{req.status}</span>
                                    <div className="w-6 h-6 rounded-lg bg-white flex items-center justify-center text-indigo-600 shadow-sm"><ArrowRight size={14}/></div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

// --- REQUESTS TAB ---
const PurchaseRequestsTab = ({ requests, currentUser, onRequestUpdate, parts, isArchive, settings }: any) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [showCreate, setShowCreate] = useState(false);
    const [viewingRequest, setViewingRequest] = useState<PurchaseRequest | null>(null);

    const filtered = requests.filter((r: PurchaseRequest) => 
        r.itemName.includes(searchTerm) || r.requestNumber.includes(searchTerm)
    );

    const hasPurchasePerm = (perm: string) => {
        if (currentUser.role === UserRole.ADMIN) return true;
        const rolePerms = settings?.purchaseRolePermissions?.[currentUser.role] || {};
        return !!(rolePerms as any)[perm];
    };

    const canCreate = hasPurchasePerm('canCreate');

    return (
        <div className="space-y-4">
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <input className="w-full glass-panel border border-gray-200 rounded-xl p-3 pr-10 text-sm outline-none focus:ring-2 focus:ring-indigo-100" placeholder="جستجوی درخواست..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    <Search className="absolute right-3 top-3.5 text-gray-400" size={18}/>
                </div>
                {canCreate && !isArchive && (
                    <button onClick={() => setShowCreate(true)} className="bg-indigo-600 text-white p-3 rounded-xl shadow-lg shadow-indigo-100 flex items-center gap-2 font-bold text-sm">
                        <Plus size={20}/> جدید
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map((req: PurchaseRequest) => (
                    <RequestCard key={req.id} req={req} currentUser={currentUser} settings={settings} onClick={() => setViewingRequest(req)} />
                ))}
            </div>

            {showCreate && <CreateRequestModal onClose={() => setShowCreate(false)} currentUser={currentUser} onSuccess={onRequestUpdate} parts={parts} />}
            {viewingRequest && <ViewRequestModal request={viewingRequest} onClose={() => setViewingRequest(null)} currentUser={currentUser} onSuccess={onRequestUpdate} settings={settings} />}
        </div>
    );
};

const RequestCard = ({ req, currentUser, onClick, settings }: { req: PurchaseRequest, currentUser: User, onClick: () => void, settings?: SystemSettings }) => {
    const hasPurchasePerm = (perm: string) => {
        if (currentUser.role === UserRole.ADMIN) return true;
        const rolePerms = settings?.purchaseRolePermissions?.[currentUser.role] || {};
        return !!(rolePerms as any)[perm];
    };

    const isMyTurn = (r: PurchaseRequest) => {
        if (r.status === PurchaseRequestStatus.COMPLETED || r.status === PurchaseRequestStatus.REJECTED) return false;
        if (currentUser.role === UserRole.ADMIN) return true;

        switch (r.status) {
            case PurchaseRequestStatus.PENDING_TECHNICAL: return hasPurchasePerm('canApproveTechnical');
            case PurchaseRequestStatus.PENDING_FACTORY: return hasPurchasePerm('canApproveFactory');
            case PurchaseRequestStatus.PENDING_CEO: return hasPurchasePerm('canApproveCEO');
            case PurchaseRequestStatus.PENDING_COMMERCIAL_PROFORMA: return hasPurchasePerm('canManageProformas');
            case PurchaseRequestStatus.PENDING_CEO_SELECTION: return hasPurchasePerm('canSelectProforma');
            case PurchaseRequestStatus.PENDING_SECURITY_ENTRY: return hasPurchasePerm('canRegisterEntry');
            case PurchaseRequestStatus.PENDING_QC: return hasPurchasePerm('canCheckQC');
            case PurchaseRequestStatus.PENDING_FACTORY_FINAL: return hasPurchasePerm('canApproveFactoryFinal');
            case PurchaseRequestStatus.PENDING_WAREHOUSE_FINAL: return hasPurchasePerm('canWarehouseFinalize');
            case PurchaseRequestStatus.PENDING_COMMERCIAL_FINAL: return hasPurchasePerm('canCommercialFinalize');
            default: return false;
        }
    };

    return (
        <div onClick={onClick} className={`glass-panel border rounded-2xl p-4 cursor-pointer transition-all hover:shadow-md relative overflow-hidden ${isMyTurn(req) ? 'border-indigo-400 ring-1 ring-indigo-50' : 'border-gray-200'}`}>
            {isMyTurn(req) && <div className="absolute top-0 right-0 left-0 h-1 bg-indigo-500 animate-pulse"></div>}
            <div className="flex justify-between items-start mb-3">
                <span className="text-[10px] font-mono text-gray-400">#{req.requestNumber}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    req.status === PurchaseRequestStatus.COMPLETED ? 'bg-green-100 text-green-700' : 
                    req.status === PurchaseRequestStatus.REJECTED ? 'bg-red-100 text-red-700' : 
                    'bg-indigo-50 text-indigo-600'
                }`}>
                    {req.status}
                </span>
            </div>
            <h3 className="font-bold text-gray-800 text-base mb-1">{req.itemName}</h3>
            <div className="flex gap-4 text-xs text-gray-500">
                <span>📦 {req.quantity} {req.unit}</span>
                <span>📅 {formatDate(req.date)}</span>
            </div>
            {req.image && (
                <div className="mt-3 rounded-lg overflow-hidden h-12 bg-gray-100 border">
                    <img src={req.image} className="w-full h-full object-cover" alt="part" referrerPolicy="no-referrer" />
                </div>
            )}
        </div>
    );
};

// --- MODALS ---
const CreateRequestModal = ({ onClose, currentUser, onSuccess, parts }: any) => {
    const [loading, setLoading] = useState(false);
    const [selectedPartId, setSelectedPartId] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [description, setDescription] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedPartId) return alert('کالا را انتخاب کنید');
        const part = parts.find((p: any) => p.id === selectedPartId);
        if (!part) return;

        setLoading(true);
        try {
            const nextNum = await getNextPurchaseRequestNumber();
            const newRequest: PurchaseRequest = {
                id: generateUUID(),
                requestNumber: nextNum,
                date: new Date().toISOString().split('T')[0],
                requester: currentUser.fullName,
                itemName: part.name,
                category: part.category,
                subCategory: part.subCategory,
                dimensions: part.dimensions,
                specifications: description,
                image: part.image,
                pdfAttachment: part.pdfAttachment,
                quantity: quantity,
                unit: part.unit,
                status: PurchaseRequestStatus.PENDING_TECHNICAL,
                proformas: [],
                createdAt: Date.now(),
                updatedAt: Date.now()
            };
            await savePurchaseRequest(newRequest);
            onSuccess();
            onClose();
        } catch (e) { alert('خطا در ثبت'); }
        finally { setLoading(false); }
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-3xl w-full max-w-lg p-6 animate-scale-in">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-black text-gray-800">ایجاد درخواست خرید</h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full"><XCircle size={24}/></button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-gray-500 block mb-1">انتخاب کالا از لیست</label>
                        <select className="w-full border rounded-xl p-3 text-sm" value={selectedPartId} onChange={e => setSelectedPartId(e.target.value)}>
                            <option value="">-- انتخاب کنید --</option>
                            {parts.map((p: any) => <option key={p.id} value={p.id}>{p.name} ({p.category})</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 block mb-1">تعداد مورد نیاز</label>
                        <input type="number" className="w-full border rounded-xl p-3 text-sm font-bold" value={quantity} onChange={e => setQuantity(+e.target.value)} />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 block mb-1">توضیحات، مشخصات خاص یا اظهارنامه</label>
                        <textarea className="w-full border rounded-xl p-3 text-sm h-24" value={description} onChange={e => setDescription(e.target.value)} placeholder="کشور سازنده، شماره کوتاژ (در صورت وجود)، ویژگی‌های فنی..."/>
                    </div>
                    <button disabled={loading} className="w-full bg-indigo-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-indigo-100 flex items-center justify-center gap-2 transition-all active:scale-95">
                        {loading ? <Loader2 className="animate-spin"/> : <ClipboardCheck/>} ثبت درخواست خرید
                    </button>
                </form>
            </div>
        </div>
    );
};

const ViewRequestModal = ({ request, onClose, currentUser, onSuccess, settings }: { request: PurchaseRequest, onClose: () => void, currentUser: User, onSuccess: () => void, settings?: SystemSettings }) => {
    const [actionLoading, setActionLoading] = useState(false);
    const [pdfLoading, setPdfLoading] = useState(false);
    const [showProformaModal, setShowProformaModal] = useState(false);
    const [showSecurityModal, setShowSecurityModal] = useState(false);
    const [showDataSheet, setShowDataSheet] = useState(false);

    const handleAction = async (nextStatus: PurchaseRequestStatus, extra: any = {}) => {
        setActionLoading(true);
        try {
            const updated = { ...request, status: nextStatus, updatedAt: Date.now(), ...extra };
            
            // Logic for workflow transitions
            if (nextStatus === PurchaseRequestStatus.PENDING_FACTORY) updated.approverTechnical = currentUser.fullName;
            if (nextStatus === PurchaseRequestStatus.PENDING_CEO) updated.approverFactory = currentUser.fullName;
            
            // Commercial Decision
            if (nextStatus === PurchaseRequestStatus.PENDING_COMMERCIAL_PROFORMA) {
                updated.approverCommercial = currentUser.fullName;
            }
            
            if (nextStatus === PurchaseRequestStatus.PENDING_QC) updated.entryDate = new Date().toISOString().split('T')[0];
            
            await updatePurchaseRequest(updated);
            onSuccess();
            onClose();
        } catch (e) { alert('خطا در عملیات'); console.error(e); }
        finally { setActionLoading(false); }
    };

    const handleCommercialDecision = async (location: 'Tehran' | 'Zanjan') => {
        await handleAction(PurchaseRequestStatus.PENDING_COMMERCIAL_PROFORMA, { purchaseLocation: location });
    };

    const isCurrentStep = (step: PurchaseRequestStatus) => request.status === step;

    const hasPurchasePerm = (perm: string) => {
        if (currentUser.role === UserRole.ADMIN) return true;
        const rolePerms = settings?.purchaseRolePermissions?.[currentUser.role] || {};
        return !!(rolePerms as any)[perm];
    };

    // Permissions check
    const canApproveTechnical = hasPurchasePerm('canApproveTechnical');
    const canApproveFactory = hasPurchasePerm('canApproveFactory');
    const canApproveCEO = hasPurchasePerm('canApproveCEO');
    const canAddProforma = hasPurchasePerm('canManageProformas');
    const canSelectProforma = hasPurchasePerm('canSelectProforma');
    const canSecurityEntry = hasPurchasePerm('canRegisterEntry');
    const canQC = hasPurchasePerm('canCheckQC');
    const canApproveFactoryFinal = hasPurchasePerm('canApproveFactoryFinal');
    const canWarehouseFinalize = hasPurchasePerm('canWarehouseFinalize');
    const canCommercialFinalize = hasPurchasePerm('canCommercialFinalize');

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
            <div className="bg-white rounded-[2.5rem] w-full max-w-3xl overflow-hidden shadow-2xl border border-white/20 animate-in fade-in zoom-in h-[90vh] flex flex-col">
                <div className="p-6 border-b flex justify-between items-center bg-gradient-to-r from-indigo-700 to-purple-800 text-white">
                    <div className="flex items-center gap-3">
                        <ShoppingCart size={28} />
                        <div>
                            <h2 className="text-xl font-black">جزئیات درخواست خرید</h2>
                            <p className="text-[10px] opacity-80 uppercase tracking-widest">{request.requestNumber}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors"><XCircle size={24} /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-gray-50/50">
                        {/* Progress Bar */}
                    <div className="flex justify-between items-center gap-2 no-scrollbar overflow-x-auto pb-4">
                        {
                            (() => {
                                const steps = [
                                    PurchaseRequestStatus.PENDING_TECHNICAL,
                                    PurchaseRequestStatus.PENDING_FACTORY,
                                    PurchaseRequestStatus.PENDING_COMMERCIAL_DECISION,
                                    PurchaseRequestStatus.PENDING_COMMERCIAL_PROFORMA,
                                    PurchaseRequestStatus.PENDING_CEO_SELECTION,
                                    PurchaseRequestStatus.PENDING_CEO,
                                    PurchaseRequestStatus.PENDING_SECURITY_ENTRY,
                                    PurchaseRequestStatus.PENDING_QC,
                                    PurchaseRequestStatus.PENDING_WAREHOUSE_FINAL,
                                    PurchaseRequestStatus.PENDING_FACTORY_FINAL,
                                    PurchaseRequestStatus.COMPLETED
                                ];
                                const currentStepIndex = steps.indexOf(request.status);
                                
                                return [
                                    { s: PurchaseRequestStatus.PENDING_TECHNICAL, label: 'فنی' },
                                    { s: PurchaseRequestStatus.PENDING_FACTORY, label: 'مدیر کارخانه' },
                                    { s: PurchaseRequestStatus.PENDING_COMMERCIAL_DECISION, label: 'تصمیم بازرگانی' },
                                    { s: PurchaseRequestStatus.PENDING_COMMERCIAL_PROFORMA, label: 'پیش‌فاکتور' },
                                    { s: PurchaseRequestStatus.PENDING_CEO_SELECTION, label: 'انتخاب' },
                                    { s: PurchaseRequestStatus.PENDING_CEO, label: 'مدیرعامل' },
                                    { s: PurchaseRequestStatus.PENDING_SECURITY_ENTRY, label: 'ورود' },
                                    { s: PurchaseRequestStatus.PENDING_QC, label: 'کیفی' },
                                    { s: PurchaseRequestStatus.PENDING_WAREHOUSE_FINAL, label: 'انبار' },
                                    { s: PurchaseRequestStatus.PENDING_FACTORY_FINAL, label: 'تایید نهایی' },
                                    { s: PurchaseRequestStatus.COMPLETED, label: 'بایگانی' }
                                ].map((step, idx) => (
                                    <div key={idx} className="flex flex-col items-center gap-1 min-w-[70px]">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold border-2 ${
                                            request.status === step.s ? 'bg-indigo-600 text-white border-indigo-700 ring-4 ring-indigo-100' :
                                            (idx < currentStepIndex ? 'bg-green-500 text-white border-green-600' : 'bg-white text-gray-400 border-gray-200')
                                        }`}>
                                            {idx + 1}
                                        </div>
                                        <span className="text-[8px] font-bold text-gray-500 whitespace-nowrap">{step.label}</span>
                                    </div>
                                ));
                            })()
                        }
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                             <div className="glass-panel p-4 rounded-2xl border border-gray-200 bg-white shadow-sm">
                                <h3 className="text-xs font-black text-gray-400 uppercase mb-3 flex items-center gap-2"><Package size={14}/> اطلاعات کالا و درخواست</h3>
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center border-b border-gray-50 pb-2"><span className="text-xs text-gray-500">نام کالا/قطعه:</span> <span className="text-sm font-black">{request.itemName}</span></div>
                                    <div className="flex justify-between items-center border-b border-gray-50 pb-2"><span className="text-xs text-gray-500">مربوط به:</span> <span className="text-sm font-bold">{request.category} / {request.subCategory}</span></div>
                                    <div className="flex justify-between flex-col items-start border-b border-gray-50 pb-2"><span className="text-xs text-gray-500 mb-1">توضیحات و مشخصات (اظهارنامه):</span> <span className="text-xs font-mono text-gray-700">{request.specifications || '-'}</span></div>
                                    <div className="flex justify-between items-center"><span className="text-xs text-gray-500">تعداد درخواستی:</span> <span className="text-lg font-black text-indigo-600">{request.quantity} {request.unit}</span></div>
                                </div>
                             </div>

                             {request.image && (
                                <div className="rounded-2xl border-2 border-gray-200 overflow-hidden shadow-inner group relative h-48">
                                    <img src={request.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt="part" referrerPolicy="no-referrer" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
                                </div>
                             )}
                             
                             {request.pdfAttachment && (
                                <a href={request.pdfAttachment} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-indigo-600 bg-indigo-50 p-4 rounded-xl border border-indigo-100 font-bold hover:bg-indigo-100 transition-colors">
                                    <FileText size={20} /> <span className="text-sm">مشاهده فایل ضمیمه (PDF)</span>
                                </a>
                             )}
                        </div>

                        <div className="space-y-6">
                            <div className="glass-panel p-4 rounded-2xl border border-gray-200 bg-white shadow-sm">
                                <h3 className="text-xs font-black text-gray-400 uppercase mb-3 flex items-center gap-2"><ClipboardCheck size={14}/> تاریخچه تاییدات</h3>
                                <div className="space-y-3">
                                    <div className="flex items-center gap-3"><div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center text-green-600"><CheckCircle size={12}/></div><div><p className="text-xs font-bold">ثبت اولیه</p><p className="text-[10px] text-gray-400">{request.requester}</p></div></div>
                                    {request.approverTechnical && <div className="flex items-center gap-3"><div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center text-green-600"><CheckCircle size={12}/></div><div><p className="text-xs font-bold">تایید فنی کارخانه</p><p className="text-[10px] text-gray-400">{request.approverTechnical}</p></div></div>}
                                    {request.approverFactory && <div className="flex items-center gap-3"><div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center text-green-600"><CheckCircle size={12}/></div><div><p className="text-xs font-bold">تایید مدیر کارخانه</p><p className="text-[10px] text-gray-400">{request.approverFactory}</p></div></div>}
                                    {request.approverCeo && <div className="flex items-center gap-3"><div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center text-green-600"><CheckCircle size={12}/></div><div><p className="text-xs font-bold">تایید مدیرعامل</p><p className="text-[10px] text-gray-400">{request.approverCeo}</p></div></div>}
                                </div>
                            </div>


                            {/* Proformas Section */}
                            {(request.status !== PurchaseRequestStatus.PENDING_FACTORY && request.status !== PurchaseRequestStatus.PENDING_CEO) && (
                                <div className="glass-panel p-4 rounded-2xl border border-indigo-200 bg-white shadow-sm">
                                    <h3 className="text-xs font-black text-indigo-400 uppercase mb-3 flex items-center justify-between">
                                        <span className="flex items-center gap-2"><FileText size={14}/> لیست پیش‌فاکتورها</span>
                                        {isCurrentStep(PurchaseRequestStatus.PENDING_COMMERCIAL_PROFORMA) && canAddProforma && (
                                            <button onClick={() => setShowProformaModal(true)} className="text-indigo-600 hover:bg-indigo-50 px-2 py-1 rounded-lg transition-colors">+ افزودن</button>
                                        )}
                                    </h3>
                                    {request.proformas.length === 0 ? (
                                        <p className="text-[10px] text-center py-4 text-gray-400 italic">هنوز پیش‌فاکتوری ثبت نشده است.</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {request.proformas.map((p: PurchaseProforma) => (
                                                <div key={p.id} className={`p-2 rounded-xl border flex justify-between items-center ${p.isChosen ? 'border-green-500 bg-green-50' : 'border-gray-100'}`}>
                                                    <div>
                                                        <p className="text-xs font-bold">{p.vendorName}</p>
                                                        <p className="text-[10px] text-gray-500">{formatCurrency(p.totalAmount)} ریال</p>
                                                    </div>
                                                    {isCurrentStep(PurchaseRequestStatus.PENDING_CEO_SELECTION) && (canApproveCEO || canSelectProforma) && (
                                                        <button 
                                                            onClick={async () => {
                                                                if(confirm('آیا این نهایی این پیش‌فاکتور تایید می‌گردد؟')) {
                                                                    const updatedProformas = request.proformas.map(x => ({ ...x, isChosen: x.id === p.id }));
                                                                    handleAction(PurchaseRequestStatus.PENDING_SECURITY_ENTRY, { proformas: updatedProformas });
                                                                }
                                                            }}
                                                            className="bg-indigo-600 text-white text-[10px] px-3 py-1 rounded-lg"
                                                        >
                                                            انتخاب و تایید
                                                        </button>
                                                    )}
                                                    {p.isChosen && <CheckCircle className="text-green-600" size={16}/>}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="p-6 border-t glass-panel flex flex-wrap justify-between items-center gap-3 bg-gray-100/50">
                    <div className="flex gap-2">
                        {isCurrentStep(PurchaseRequestStatus.PENDING_TECHNICAL) && canApproveTechnical && (
                            <>
                                <button onClick={() => handleAction(PurchaseRequestStatus.PENDING_FACTORY)} className="px-8 py-3 bg-indigo-600 text-white rounded-2xl font-black shadow-lg shadow-indigo-100 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50" disabled={actionLoading}>{actionLoading ? <Loader2 className="animate-spin" /> : <CheckCircle size={20}/>} تایید فنی (ارسال به مدیر کارخانه)</button>
                                <button onClick={() => handleAction(PurchaseRequestStatus.REJECTED)} className="px-5 py-3 bg-red-50 text-red-600 rounded-2xl font-bold flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50" disabled={actionLoading}>{actionLoading ? <Loader2 className="animate-spin" /> : <XCircle size={18}/>} رد فنی</button>
                            </>
                        )}

                        {isCurrentStep(PurchaseRequestStatus.PENDING_COMMERCIAL_DECISION) && canAddProforma && (
                            <>
                                <button onClick={() => handleCommercialDecision('Tehran')} className="px-8 py-3 bg-indigo-600 text-white rounded-2xl font-black shadow-lg shadow-indigo-100 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50" disabled={actionLoading}>{actionLoading ? <Loader2 className="animate-spin" /> : <Truck size={20}/>} خرید در تهران</button>
                                <button onClick={() => handleCommercialDecision('Zanjan')} className="px-8 py-3 bg-indigo-600 text-white rounded-2xl font-black shadow-lg shadow-indigo-100 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50" disabled={actionLoading}>{actionLoading ? <Loader2 className="animate-spin" /> : <Warehouse size={20}/>} خرید در زنجان</button>
                            </>
                        )}
                        {isCurrentStep(PurchaseRequestStatus.PENDING_FACTORY) && canApproveFactory && (
                            <>
                                <button onClick={() => handleAction(PurchaseRequestStatus.PENDING_CEO)} className="px-8 py-3 bg-indigo-600 text-white rounded-2xl font-black shadow-lg shadow-indigo-100 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50" disabled={actionLoading}>{actionLoading ? <Loader2 className="animate-spin" /> : <CheckCircle size={20}/>} تایید مدیر کارخانه</button>
                                <button onClick={() => handleAction(PurchaseRequestStatus.REJECTED)} className="px-5 py-3 bg-red-50 text-red-600 rounded-2xl font-bold flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50" disabled={actionLoading}>{actionLoading ? <Loader2 className="animate-spin" /> : <XCircle size={18}/>} رد درخواست</button>
                            </>
                        )}
                        {isCurrentStep(PurchaseRequestStatus.PENDING_CEO) && canApproveCEO && (
                            <button onClick={() => handleAction(PurchaseRequestStatus.PENDING_COMMERCIAL_PROFORMA)} className="px-8 py-3 bg-indigo-600 text-white rounded-2xl font-black transition-all active:scale-95 disabled:opacity-50" disabled={actionLoading}>{actionLoading ? <Loader2 className="animate-spin" /> : 'تایید نهایی جهت استعلام'}</button>
                        )}
                        {isCurrentStep(PurchaseRequestStatus.PENDING_COMMERCIAL_PROFORMA) && canAddProforma && request.proformas.length > 0 && (
                            <button onClick={() => handleAction(PurchaseRequestStatus.PENDING_CEO_SELECTION)} className="px-8 py-3 bg-indigo-600 text-white rounded-2xl font-black transition-all active:scale-95 disabled:opacity-50" disabled={actionLoading}>{actionLoading ? <Loader2 className="animate-spin" /> : 'ارسال لیست جهت تایید نهایی'}</button>
                        )}
                        {isCurrentStep(PurchaseRequestStatus.PENDING_SECURITY_ENTRY) && canSecurityEntry && (
                            <button onClick={() => setShowSecurityModal(true)} className="px-8 py-3 bg-orange-600 text-white rounded-2xl font-black transition-all active:scale-95">ثبت ورود کالا</button>
                        )}
                        {isCurrentStep(PurchaseRequestStatus.PENDING_QC) && canQC && (
                            <button onClick={() => handleAction(PurchaseRequestStatus.PENDING_FACTORY_FINAL)} className="px-8 py-3 bg-green-600 text-white rounded-2xl font-black transition-all active:scale-95 disabled:opacity-50" disabled={actionLoading}>{actionLoading ? <Loader2 className="animate-spin" /> : 'تایید کنترل کیفی (QC)'}</button>
                        )}
                        {isCurrentStep(PurchaseRequestStatus.PENDING_FACTORY_FINAL) && canApproveFactoryFinal && (
                            <button onClick={() => handleAction(PurchaseRequestStatus.PENDING_WAREHOUSE_FINAL)} className="px-8 py-3 bg-indigo-600 text-white rounded-2xl font-black transition-all active:scale-95 disabled:opacity-50" disabled={actionLoading}>{actionLoading ? <Loader2 className="animate-spin" /> : 'تایید نهایی مدیر کارخانه'}</button>
                        )}
                        {isCurrentStep(PurchaseRequestStatus.PENDING_WAREHOUSE_FINAL) && canWarehouseFinalize && (
                            <button onClick={() => handleAction(PurchaseRequestStatus.PENDING_COMMERCIAL_FINAL)} className="px-8 py-3 bg-indigo-600 text-white rounded-2xl font-black transition-all active:scale-95 disabled:opacity-50" disabled={actionLoading}>{actionLoading ? <Loader2 className="animate-spin" /> : 'صدور رسید انبار'}</button>
                        )}
                        {isCurrentStep(PurchaseRequestStatus.PENDING_COMMERCIAL_FINAL) && canCommercialFinalize && (
                            <button onClick={() => handleAction(PurchaseRequestStatus.COMPLETED)} className="px-8 py-3 bg-indigo-600 text-white rounded-2xl font-black transition-all active:scale-95 disabled:opacity-50" disabled={actionLoading}>{actionLoading ? <Loader2 className="animate-spin" /> : 'تایید نهایی و بایگانی'}</button>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <button 
                            onClick={async () => {
                                window.print();
                            }}
                            className="flex items-center gap-2 p-3 text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors shadow-sm" title="چاپ فرم"
                        >
                            <Printer size={18} /> <span className="text-sm font-bold">چاپ</span>
                        </button>
                        <button 
                            onClick={async () => {
                                setPdfLoading(true);
                                try {
                                    await generatePdf({
                                        elementId: 'print-purchase-request-section',
                                        filename: `purchase_request_${request.requestNumber}.pdf`
                                    });
                                } finally {
                                    setPdfLoading(false);
                                }
                            }}
                            className="flex items-center gap-2 p-3 text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-xl hover:bg-indigo-100 transition-colors shadow-sm" title="دریافت PDF"
                        >
                            {pdfLoading ? <Loader2 size={18} className="animate-spin" /> : <FileDown size={18} />} <span className="text-sm font-bold">دانلود PDF</span>
                        </button>
                    </div>
                </div>

                <div className="hidden">
                    <div id="print-purchase-request-section">
                        <PrintPurchaseRequest request={request} />
                    </div>
                </div>

                {showProformaModal && <AddProformaModal 
                    request={request} 
                    onClose={() => setShowProformaModal(false)} 
                    onSuccess={(updatedProformas: any) => { 
                        updatePurchaseRequest({ ...request, proformas: updatedProformas }); 
                        onSuccess();
                        onClose();
                    }} 
                />}

                {showSecurityModal && <SecurityEntryModal 
                    onClose={() => setShowSecurityModal(false)}
                    onConfirm={(data: any) => handleAction(PurchaseRequestStatus.PENDING_QC, data)}
                />}
            </div>
        </div>
    );
};

const AddProformaModal = ({ request, onClose, onSuccess }: any) => {
    const [vendor, setVendor] = useState('');
    const [num, setNum] = useState('');
    const [amount, setAmount] = useState(0);

    const handleAdd = () => {
        const newP: PurchaseProforma = {
            id: generateUUID(),
            vendorName: vendor,
            number: num,
            date: new Date().toISOString(),
            totalAmount: amount,
            attachments: []
        };
        onSuccess([...request.proformas, newP]);
    };

    return (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/50">
            <div className="bg-white rounded-2xl p-6 w-full max-w-md">
                <h3 className="font-black text-lg mb-4">ثبت پیش‌فاکتور جدید</h3>
                <div className="space-y-4">
                    <input className="w-full border rounded-xl p-3 text-sm" placeholder="نام تامین کننده" value={vendor} onChange={e=>setVendor(e.target.value)} />
                    <input className="w-full border rounded-xl p-3 text-sm" placeholder="شماره پیش‌فاکتور" value={num} onChange={e=>setNum(e.target.value)} />
                    <input type="number" className="w-full border rounded-xl p-3 text-sm" placeholder="مبلغ کل" value={amount} onChange={e=>setAmount(+e.target.value)} />
                    <button onClick={handleAdd} className="w-full bg-indigo-600 text-white font-black py-3 rounded-xl">افزودن به لیست</button>
                    <button onClick={onClose} className="w-full text-gray-500 font-bold">انصراف</button>
                </div>
            </div>
        </div>
    );
};

const SecurityEntryModal = ({ onClose, onConfirm }: any) => {
    const [qty, setQty] = useState(0);
    const [weight, setWeight] = useState(0);

    return (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/50">
            <div className="bg-white rounded-2xl p-6 w-full max-w-md">
                <h3 className="font-black text-lg mb-4">ثبت ورود کالا (انتظامات)</h3>
                <div className="space-y-4">
                    <div><label className="text-xs font-bold text-gray-500 mb-1">تعداد واقعی ورود</label><input type="number" className="w-full border rounded-xl p-3" value={qty} onChange={e=>setQty(+e.target.value)} /></div>
                    <div><label className="text-xs font-bold text-gray-500 mb-1">وزن واقعی ورود</label><input type="number" className="w-full border rounded-xl p-3" value={weight} onChange={e=>setWeight(+e.target.value)} /></div>
                    <button onClick={() => onConfirm({ entryQuantity: qty, entryWeight: weight, entryTime: new Date().toLocaleTimeString('fa-IR') })} className="w-full bg-orange-600 text-white font-black py-3 rounded-xl shadow-lg">تایید و ثبت ورود</button>
                    <button onClick={onClose} className="w-full text-gray-500 font-bold border rounded-xl py-2 mt-2">انصراف</button>
                </div>
            </div>
        </div>
    );
};

// --- PARTS TAB ---
const PartsTab = ({ parts, currentUser, onPartUpdate, settings }: any) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [showDataSheet, setShowDataSheet] = useState<PartMasterData | null>(null);
    const [editingPart, setEditingPart] = useState<PartMasterData | null>(null);

    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [selectedSubCategory, setSelectedSubCategory] = useState<string | null>(null);

    const hasPurchasePerm = (perm: string) => {
        if (currentUser.role === UserRole.ADMIN) return true;
        const rolePerms = settings?.purchaseRolePermissions?.[currentUser.role] || {};
        return !!(rolePerms as any)[perm];
    };

    const filtered = parts.filter((p: PartMasterData) => 
        p.name.includes(searchTerm) || 
        p.category.includes(searchTerm) || 
        (p.subCategory && p.subCategory.includes(searchTerm)) ||
        (p.dimensions && p.dimensions.includes(searchTerm))
    );

    const categories = Array.from(new Set(parts.map((p: PartMasterData) => p.category)));
    const subCategories = selectedCategory ? Array.from(new Set(parts.filter((p: PartMasterData) => p.category === selectedCategory && p.subCategory).map((p: PartMasterData) => p.subCategory))) : [];

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
                
                let successCount = 0;
                for (const row of data as any[]) {
                    if (!row['نام کالا']) continue;
                    const newPart: PartMasterData = {
                        id: generateUUID(),
                        name: row['نام کالا'] || '',
                        type: row['نوع'] || 'قطعات',
                        category: row['گروه'] || 'عمومی',
                        subCategory: row['زیرگروه'] || '',
                        dimensions: row['ابعاد یا مشخصات'] || '',
                        unit: row['واحد'] || 'عدد',
                        minStock: parseInt(row['حداقل موجودی']) || 0,
                        currentStock: parseInt(row['موجودی اولیه']) || 0
                    };
                    await savePartMasterData(newPart);
                    successCount++;
                }
                alert(`${successCount} کالا با موفقیت از اکسل وارد شد.`);
                onPartUpdate();
            } catch (err) {
                alert('خطا در خواندن فایل اکسل');
                console.error(err);
            }
        };
        reader.readAsBinaryString(file);
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col md:flex-row gap-2 items-center">
                <div className="relative flex-1 w-full">
                    <input className="w-full glass-panel border border-gray-200 rounded-xl p-3 pr-10 text-sm outline-none focus:ring-2 focus:ring-indigo-100" placeholder="جستجوی کالا، گروه یا زیرگروه..." value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setSelectedCategory(null); setSelectedSubCategory(null); }} />
                    <Search className="absolute right-3 top-3.5 text-gray-400" size={18}/>
                </div>
                {hasPurchasePerm('canManageWarehouse') && (
                    <div className="flex gap-2 w-full md:w-auto">
                        <label className="bg-green-600 text-white p-3 rounded-xl shadow-lg shadow-green-100 flex justify-center items-center gap-2 font-bold text-sm cursor-pointer hover:bg-green-700 transition">
                            <UploadCloud size={20}/> اکسل
                            <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleFileUpload} />
                        </label>
                        <button onClick={() => { setEditingPart(null); setShowModal(true); }} className="flex-1 md:flex-none justify-center bg-indigo-600 text-white p-3 rounded-xl shadow-lg shadow-indigo-100 flex items-center gap-2 font-bold text-sm transition hover:bg-indigo-700">
                            <Plus size={20}/> تعریف جدید
                        </button>
                    </div>
                )}            </div>

            {!searchTerm && selectedCategory && (
                 <div className="flex items-center gap-2 text-sm font-bold text-gray-600 bg-gray-100 p-3 rounded-xl shadow-inner">
                    <button onClick={() => { setSelectedCategory(null); setSelectedSubCategory(null); }} className="hover:text-indigo-600">گروه‌ها</button>
                    <span>/</span>
                    <button onClick={() => setSelectedSubCategory(null)} className={`hover:text-indigo-600 ${!selectedSubCategory ? 'text-indigo-600' : ''}`}>{selectedCategory}</button>
                    {selectedSubCategory && (
                        <>
                            <span>/</span>
                            <span className="text-indigo-600">{selectedSubCategory}</span>
                        </>
                    )}
                 </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {searchTerm ? (
                    filtered.map((p: PartMasterData) => (
                        <div key={p.id} className="glass-panel border border-gray-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all group">
                            <div className="h-40 bg-gray-100 relative overflow-hidden cursor-pointer" onClick={() => setShowDataSheet(p)}>
                                {p.image ? (
                                    <img src={p.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt={p.name} referrerPolicy="no-referrer" />
                                ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-300">
                                        <ImageIcon size={48} />
                                        <span className="text-[10px] font-bold uppercase mt-2">No Image</span>
                                    </div>
                                )}
                                <div className="absolute top-2 right-2 bg-black/60 text-white text-[9px] px-2 py-0.5 rounded-full backdrop-blur-sm">{p.type || 'کالا'} | {p.category}</div>
                            </div>
                            <div className="p-4">
                                <h3 className="font-black text-gray-800 text-sm mb-1">{p.name}</h3>
                                <p className="text-[10px] text-gray-500 line-clamp-1 mb-3">{p.subCategory ? `زیرگروه: ${p.subCategory}` : 'فاقد زیرگروه'} | {p.dimensions || 'فاقد مشخصات ابعادی'}</p>
                                
                                <div className="flex justify-between items-center pt-3 border-t border-gray-100">
                                    <div className="flex flex-col">
                                        <span className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">Stock Balance</span>
                                        <span className={`text-sm font-black ${p.currentStock <= (p.minStock || 0) ? 'text-red-500 animate-pulse' : 'text-green-600'}`}>
                                            {p.currentStock} {p.unit}
                                        </span>
                                    </div>
                                    <div className="flex gap-1">
                                        <button onClick={() => setShowDataSheet(p)} className="p-2 bg-gray-50 text-indigo-600 rounded-lg hover:bg-indigo-100" title="مشاهده شناسنامه فنی"><Info size={16}/></button>
                                        {p.pdfAttachment && (
                                            <a href={p.pdfAttachment} target="_blank" rel="noopener noreferrer" className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100" title="مشاهده کاتالوگ/PDF"><FileText size={16}/></a>
                                        )}
                                        <button onClick={() => { setEditingPart(p); setShowModal(true); }} className="p-2 bg-gray-50 text-emerald-600 rounded-lg hover:bg-emerald-100" title="ویرایش کالا"><Edit size={16}/></button>
                                        <button onClick={async () => { if(confirm('حذف شود؟')) { await deletePartMasterData(p.id); onPartUpdate(); } }} className="p-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-100" title="حذف کالا"><Trash2 size={16}/></button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                ) : !selectedCategory ? (
                     categories.map((cat: any) => (
                         <div key={cat} onClick={() => setSelectedCategory(cat)} className="glass-panel border-2 border-indigo-100 rounded-3xl p-8 text-center cursor-pointer hover:shadow-xl hover:-translate-y-1 hover:border-indigo-300 transition-all flex flex-col items-center gap-4 bg-gradient-to-b from-white to-indigo-50/30">
                              <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 shadow-inner">
                                  <Layers size={32} />
                              </div>
                              <div>
                                  <h3 className="text-xl font-black text-gray-800 mb-1">{cat}</h3>
                                  <span className="text-xs font-bold text-indigo-500 bg-indigo-50 px-3 py-1 rounded-full">{parts.filter((p: any) => p.category === cat).length} کالا</span>
                              </div>
                         </div>
                     ))
                ) : selectedCategory && !selectedSubCategory && subCategories.length > 0 ? (
                     subCategories.map((sub: any) => (
                         <div key={sub} onClick={() => setSelectedSubCategory(sub)} className="glass-panel border-2 border-teal-100 rounded-3xl p-8 text-center cursor-pointer hover:shadow-xl hover:-translate-y-1 hover:border-teal-300 transition-all flex flex-col items-center gap-4 bg-gradient-to-b from-white to-teal-50/30">
                              <div className="w-16 h-16 bg-teal-100 rounded-2xl flex items-center justify-center text-teal-600 shadow-inner">
                                  <Tag size={32} />
                              </div>
                              <div>
                                  <h3 className="text-xl font-black text-gray-800 mb-1">{sub}</h3>
                                  <span className="text-xs font-bold text-teal-500 bg-teal-50 px-3 py-1 rounded-full">{parts.filter((p: any) => p.category === selectedCategory && p.subCategory === sub).length} کالا</span>
                              </div>
                         </div>
                     )).concat(
                         // Parts that don't have subcategory
                         parts.filter((p: any) => p.category === selectedCategory && !p.subCategory).map((p: any) => (
                             <div key={p.id} className="glass-panel border border-gray-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all group">
                                <div className="h-40 bg-gray-100 relative overflow-hidden cursor-pointer" onClick={() => setShowDataSheet(p)}>
                                    {p.image ? (
                                        <img src={p.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt={p.name} referrerPolicy="no-referrer" />
                                    ) : (
                                        <div className="w-full h-full flex flex-col items-center justify-center text-gray-300">
                                            <ImageIcon size={48} />
                                            <span className="text-[10px] font-bold uppercase mt-2">No Image</span>
                                        </div>
                                    )}
                                    <div className="absolute top-2 right-2 bg-black/60 text-white text-[9px] px-2 py-0.5 rounded-full backdrop-blur-sm">{p.type || 'کالا'} | {p.category}</div>
                                </div>
                                <div className="p-4">
                                    <h3 className="font-black text-gray-800 text-sm mb-1">{p.name}</h3>
                                    <p className="text-[10px] text-gray-500 line-clamp-1 mb-3">{p.subCategory ? `زیرگروه: ${p.subCategory}` : 'فاقد زیرگروه'} | {p.dimensions || 'فاقد مشخصات ابعادی'}</p>
                                    
                                    <div className="flex justify-between items-center pt-3 border-t border-gray-100">
                                        <div className="flex flex-col">
                                            <span className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">Stock Balance</span>
                                            <span className={`text-sm font-black ${p.currentStock <= (p.minStock || 0) ? 'text-red-500 animate-pulse' : 'text-green-600'}`}>
                                                {p.currentStock} {p.unit}
                                            </span>
                                        </div>
                                        <div className="flex gap-1">
                                            <button onClick={() => setShowDataSheet(p)} className="p-2 bg-gray-50 text-indigo-600 rounded-lg hover:bg-indigo-100" title="مشاهده شناسنامه فنی"><Info size={16}/></button>
                                            {p.pdfAttachment && (
                                                <a href={p.pdfAttachment} target="_blank" rel="noopener noreferrer" className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100" title="مشاهده کاتالوگ/PDF"><FileText size={16}/></a>
                                            )}
                                            {hasPurchasePerm('canManageWarehouse') && (
                                                <>
                                                    <button onClick={() => { setEditingPart(p); setShowModal(true); }} className="p-2 bg-gray-50 text-emerald-600 rounded-lg hover:bg-emerald-100" title="ویرایش کالا"><Edit size={16}/></button>
                                                    <button onClick={async () => { if(confirm('حذف شود؟')) { await deletePartMasterData(p.id); onPartUpdate(); } }} className="p-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-100" title="حذف کالا"><Trash2 size={16}/></button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                         ))
                     )
                ) : (
                     parts.filter((p: any) => p.category === selectedCategory && (!selectedSubCategory || p.subCategory === selectedSubCategory)).map((p: any) => (
                        <div key={p.id} className="glass-panel border border-gray-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all group">
                            <div className="h-40 bg-gray-100 relative overflow-hidden cursor-pointer" onClick={() => setShowDataSheet(p)}>
                                {p.image ? (
                                    <img src={p.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt={p.name} referrerPolicy="no-referrer" />
                                ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-300">
                                        <ImageIcon size={48} />
                                        <span className="text-[10px] font-bold uppercase mt-2">No Image</span>
                                    </div>
                                )}
                                <div className="absolute top-2 right-2 bg-black/60 text-white text-[9px] px-2 py-0.5 rounded-full backdrop-blur-sm">{p.type || 'کالا'} | {p.category}</div>
                            </div>
                            <div className="p-4">
                                <h3 className="font-black text-gray-800 text-sm mb-1">{p.name}</h3>
                                <p className="text-[10px] text-gray-500 line-clamp-1 mb-3">{p.subCategory ? `زیرگروه: ${p.subCategory}` : 'فاقد زیرگروه'} | {p.dimensions || 'فاقد مشخصات ابعادی'}</p>
                                
                                <div className="flex justify-between items-center pt-3 border-t border-gray-100">
                                    <div className="flex flex-col">
                                        <span className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">Stock Balance</span>
                                        <span className={`text-sm font-black ${p.currentStock <= (p.minStock || 0) ? 'text-red-500 animate-pulse' : 'text-green-600'}`}>
                                            {p.currentStock} {p.unit}
                                        </span>
                                    </div>
                                    <div className="flex gap-1">
                                        <button onClick={() => setShowDataSheet(p)} className="p-2 bg-gray-50 text-indigo-600 rounded-lg hover:bg-indigo-100" title="مشاهده شناسنامه فنی"><Info size={16}/></button>
                                        {p.pdfAttachment && (
                                            <a href={p.pdfAttachment} target="_blank" rel="noopener noreferrer" className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100" title="مشاهده کاتالوگ/PDF"><FileText size={16}/></a>
                                        )}
                                        {hasPurchasePerm('canManageWarehouse') && (
                                            <>
                                                <button onClick={() => { setEditingPart(p); setShowModal(true); }} className="p-2 bg-gray-50 text-emerald-600 rounded-lg hover:bg-emerald-100" title="ویرایش کالا"><Edit size={16}/></button>
                                                <button onClick={async () => { if(confirm('حذف شود؟')) { await deletePartMasterData(p.id); onPartUpdate(); } }} className="p-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-100" title="حذف کالا"><Trash2 size={16}/></button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                     ))
                )}
            </div>

            {showModal && <PartModal onClose={() => setShowModal(false)} onSuccess={onPartUpdate} initialData={editingPart} parts={parts} />}
            {showDataSheet && <DataSheetModal part={showDataSheet} onClose={() => setShowDataSheet(null)} />}
        </div>
    );
};

const DataSheetModal = ({ part, onClose }: { part: PartMasterData, onClose: () => void }) => {
    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
            <div className="bg-white rounded-[2.5rem] w-full max-w-4xl overflow-hidden shadow-2xl border border-white/20 animate-in fade-in zoom-in h-[90vh] flex flex-col">
                <div className="p-6 border-b flex justify-between items-center bg-gray-900 text-white">
                    <div className="flex items-center gap-3">
                        <Info size={28} className="text-yellow-400" />
                        <div>
                            <h2 className="text-xl font-black">شناسنامه کالا (Data Sheet)</h2>
                            <p className="text-[10px] opacity-80 font-mono tracking-widest">{part.id}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors"><XCircle size={24} /></button>
                </div>
                
                <div className="flex-1 overflow-y-auto bg-gray-50 p-4 md:p-8">
                    <div id="datasheet-print-area" className="bg-white p-4 md:p-12 shadow-sm rounded-2xl mx-auto max-w-3xl border border-gray-200 printable-datasheet">
                         <PrintPartDataSheet part={part} />
                    </div>
                </div>

                <div className="p-6 border-t flex justify-end gap-3 bg-white">
                    <button onClick={onClose} className="px-6 py-3 border-2 border-gray-200 rounded-2xl font-bold text-gray-500">بستن</button>
                    <button onClick={() => window.print()} className="px-8 py-3 bg-indigo-600 text-white rounded-2xl font-black flex items-center gap-2 shadow-lg shadow-indigo-100">
                        <Printer size={20}/> چاپ شناسنامه
                    </button>
                </div>
            </div>
        </div>
    );
};

const PartModal = ({ onClose, onSuccess, initialData, parts }: any) => {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState<Partial<PartMasterData>>(initialData || {
        name: '',
        type: 'قطعات',
        category: '',
        subCategory: '',
        dimensions: '',
        unit: 'عدد',
        minStock: 0,
        currentStock: 0,
        image: '',
        pdfAttachment: ''
    });

    const categories = Array.from(new Set(parts.map((p: any) => p.category).filter(Boolean)));
    const subCategories = Array.from(new Set(parts.filter((p: any) => p.category === formData.category).map((p: any) => p.subCategory).filter(Boolean)));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if(!formData.name || !formData.category) return alert('نام و گروه‌بندی الزامی است');
        setLoading(true);
        try {
            if (initialData?.id) await updatePartMasterData({ ...initialData, ...formData } as PartMasterData);
            else await savePartMasterData({ ...formData, id: generateUUID() } as PartMasterData);
            onSuccess();
            onClose();
        } catch (e) { 
            console.error('Save Part error', e); 
            alert('خطا در ذخیره: ' + (e as any).message); 
        }
        finally { setLoading(false); }
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            uploadFileChunked(file, () => {}).then(res => setFormData({ ...formData, image: res.url }));
        }
    };

    const handlePdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            uploadFileChunked(file, () => {}).then(res => setFormData({ ...formData, pdfAttachment: res.url }));
        }
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-[2.5rem] w-full max-w-2xl p-8 animate-scale-in max-h-[90vh] overflow-y-auto no-scrollbar">
                <div className="flex justify-between items-center mb-8">
                    <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2"><Layers className="text-indigo-600"/> {initialData ? 'ویرایش کالا / قطعه' : 'معرفی کالا جدید'}</h2>
                    <button type="button" onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><XCircle size={28} className="text-gray-400"/></button>
                </div>
                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2 px-1">اطلاعات پایه</label>
                            <div className="space-y-3">
                                <div className="relative"><input className="w-full border-2 border-gray-100 rounded-2xl p-3 pr-10 text-sm focus:border-indigo-400 outline-none" placeholder="نام دقیق کالا..." value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})} /><Tag className="absolute right-3 top-3.5 text-gray-300" size={18}/></div>
                                
                                <div className="relative">
                                    <select className="w-full border-2 border-gray-100 rounded-2xl p-3 pr-10 text-sm focus:border-indigo-400 outline-none appearance-none" value={formData.type} onChange={e=>setFormData({...formData, type: e.target.value})}>
                                        <option value="قطعات">قطعات</option>
                                        <option value="مواد اولیه">مواد اولیه</option>
                                        <option value="ملزومات">ملزومات</option>
                                    </select>
                                    <Package className="absolute right-3 top-3.5 text-gray-300" size={18}/>
                                </div>

                                <div className="relative"><input className="w-full border-2 border-gray-100 rounded-2xl p-3 pr-10 text-sm focus:border-indigo-400 outline-none" placeholder="گروه (برقی، روانکار، و ...)" value={formData.category} onChange={e=>setFormData({...formData, category: e.target.value})} list="category-list" /><Layers className="absolute right-3 top-3.5 text-gray-300" size={18}/></div>
                                <datalist id="category-list">{categories.map((c: any) => <option key={c} value={c} />)}</datalist>

                                <div className="relative"><input className="w-full border-2 border-gray-100 rounded-2xl p-3 pr-10 text-sm focus:border-indigo-400 outline-none" placeholder="زیر مجموعه..." value={formData.subCategory} onChange={e=>setFormData({...formData, subCategory: e.target.value})} list="subcategory-list" /><Layers className="absolute right-3 top-3.5 text-gray-300" size={14}/></div>
                                <datalist id="subcategory-list">{subCategories.map((c: any) => <option key={c} value={c} />)}</datalist>

                                <div className="relative"><input className="w-full border-2 border-gray-100 rounded-2xl p-3 pr-10 text-sm focus:border-indigo-400 outline-none" placeholder="ابعاد و مشخصات ابعادی..." value={formData.dimensions} onChange={e=>setFormData({...formData, dimensions: e.target.value})} /><Ruler className="absolute right-3 top-3.5 text-gray-300" size={18}/></div>
                            </div>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2 px-1">موجودی و تصویر</label>
                            <div className="space-y-3">
                                <div className="flex gap-4">
                                    <div className="flex-1"><label className="text-[10px] font-bold text-gray-400 mb-1 block">واحد</label><input className="w-full border-2 border-gray-100 rounded-2xl p-3 text-sm" value={formData.unit} onChange={e=>setFormData({...formData, unit: e.target.value})} /></div>
                                    <div className="flex-1"><label className="text-[10px] font-bold text-gray-400 mb-1 block">حداقل موجودی</label><input type="number" className="w-full border-2 border-gray-100 rounded-2xl p-3 text-sm font-bold text-red-500" value={formData.minStock} onChange={e=>setFormData({...formData, minStock: +e.target.value})} /></div>
                                </div>
                                <div className="relative group h-32 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center overflow-hidden cursor-pointer hover:bg-gray-100 transition-all">
                                    {formData.image ? (
                                        <img src={formData.image} className="w-full h-full object-cover" alt="preview" />
                                    ) : (
                                        <>
                                            <Upload className="text-gray-300 group-hover:text-indigo-400 transition-colors" size={32}/>
                                            <p className="text-[10px] font-black text-gray-400 mt-2">کلیک جهت بارگذاری تصویر</p>
                                        </>
                                    )}
                                    <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleImageUpload} />
                                </div>

                                <div className="relative group p-4 bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl flex items-center gap-3 cursor-pointer hover:bg-gray-100 transition-all">
                                    <div className="w-10 h-10 rounded-xl bg-red-50 text-red-500 flex items-center justify-center">
                                        <FileUp size={20} />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-xs font-bold text-gray-700">{formData.pdfAttachment ? 'فایل ضمیمه بارگذاری شد' : 'بارگذاری کاتالوگ / PDF'}</p>
                                        <p className="text-[10px] text-gray-400">{formData.pdfAttachment ? 'جهت جایگزینی کلیک کنید' : 'فقط فایل‌های PDF مجاز است'}</p>
                                    </div>
                                    {formData.pdfAttachment && <CheckCircle size={16} className="text-green-500"/>}
                                    <input type="file" accept="application/pdf" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handlePdfUpload} />
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="md:col-span-2 pt-4">
                        <button disabled={loading} className="w-full bg-gradient-to-r from-indigo-600 to-indigo-800 text-white font-black py-4 rounded-2xl shadow-xl shadow-indigo-100 flex items-center justify-center gap-3 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-70">
                            {loading ? <Loader2 className="animate-spin"/> : <ClipboardCheck size={20}/>} {initialData ? 'ثبت تغییرات' : 'معرفی نهایی کالا'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// --- KARDEX TAB ---
const KardexTab = ({ parts, selectedPart, setSelectedPart, kardexEntries, loadKardex }: any) => {
    return (
        <div className="space-y-6">
            <div className="glass-panel p-6 rounded-3xl border-2 border-indigo-100 shadow-sm bg-white">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 shadow-inner">
                            <History size={28} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-gray-800">کاردکس موجودی قطعات</h2>
                            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Stock Movement Ledger</p>
                        </div>
                    </div>
                    
                    <div className="w-full md:w-64">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">انتخاب قطعه</label>
                        <select 
                            className="w-full border-2 border-gray-100 rounded-2xl p-3 text-sm font-bold bg-white focus:border-indigo-400 outline-none"
                            value={selectedPart?.id || ''} 
                            onChange={e => { 
                                const p = parts.find((x: any) => x.id === e.target.value); 
                                setSelectedPart(p); 
                                if(p) loadKardex(p.id);
                            }}
                        >
                            <option value="">-- انتخاب کنید --</option>
                            {parts.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            {selectedPart ? (
                <div className="animate-fade-in space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="glass-panel p-4 rounded-2xl bg-white border border-gray-100 flex flex-col items-center justify-center text-center">
                            <span className="text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-widest">موجودی فعلی</span>
                            <span className="text-2xl font-black text-indigo-600">{selectedPart.currentStock}</span>
                            <span className="text-[10px] font-bold text-indigo-400">{selectedPart.unit}</span>
                        </div>
                        <div className="glass-panel p-4 rounded-2xl bg-white border border-gray-100 flex flex-col items-center justify-center text-center">
                            <span className="text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-widest">کل ورودی</span>
                            <span className="text-2xl font-black text-green-600">
                                {kardexEntries.filter((k: any) => k.type === 'IN').reduce((a: any, b: any) => a + b.quantity, 0)}
                            </span>
                        </div>
                        <div className="glass-panel p-4 rounded-2xl bg-white border border-gray-100 flex flex-col items-center justify-center text-center">
                            <span className="text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-widest">کل خروجی</span>
                            <span className="text-2xl font-black text-red-500">
                                {kardexEntries.filter((k: any) => k.type === 'OUT').reduce((a: any, b: any) => a + b.quantity, 0)}
                            </span>
                        </div>
                    </div>

                    <div className="glass-panel rounded-3xl border border-gray-200 overflow-hidden bg-white shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-100">
                                        <th className="py-4 px-6 text-sm font-black text-gray-500 text-right">کالا / قطعه</th>
                                        <th className="py-4 px-6 text-sm font-black text-gray-500 text-right">تاریخ</th>
                                        <th className="py-4 px-6 text-sm font-black text-gray-500 text-right">شماره مرجع</th>
                                        <th className="py-4 px-6 text-sm font-black text-gray-500 text-center">نوع</th>
                                        <th className="py-4 px-6 text-sm font-black text-gray-500 text-center">تعداد</th>
                                        <th className="py-4 px-6 text-sm font-black text-gray-500 text-center">فی/قیمت واحد</th>
                                        <th className="py-4 px-6 text-sm font-black text-gray-500 text-center">مانده</th>
                                        <th className="py-4 px-6 text-sm font-black text-gray-500 text-right">توضیحات</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {kardexEntries.length === 0 ? (
                                        <tr><td colSpan={8} className="py-20 text-center text-gray-400 italic">تراکنشی یافت نشد.</td></tr>
                                    ) : (
                                        kardexEntries.map((k: any) => (
                                            <tr key={k.id} className="border-b border-gray-50 hover:bg-indigo-50/20 transition-colors">
                                                <td className="py-4 px-6 text-xs font-black text-gray-800">{selectedPart?.name}</td>
                                                <td className="py-4 px-6 text-xs font-bold text-gray-600">{formatDate(k.date)}</td>
                                                <td className="py-4 px-6 text-xs font-mono font-bold text-gray-400">#{k.referenceNumber}</td>
                                                <td className="py-4 px-6 text-center">
                                                    <span className={`text-[9px] px-3 py-1 rounded-full font-black ${k.type === 'IN' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                        {k.type === 'IN' ? 'ورود' : 'خروج'}
                                                    </span>
                                                </td>
                                                <td className="py-4 px-6 text-center text-sm font-black">{k.quantity}</td>
                                                <td className="py-4 px-6 text-center text-sm font-black text-blue-600">{k.unitPrice ? Number(k.unitPrice).toLocaleString() : '-'}</td>
                                                <td className="py-4 px-6 text-center text-sm font-black text-indigo-700">{k.balance}</td>
                                                <td className="py-4 px-6 text-xs text-gray-500">{k.description}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="py-40 flex flex-col items-center justify-center text-gray-300">
                    <History size={64} className="mb-4 opacity-20" />
                    <p className="font-bold">لطفاً برای مشاهده گردش موجودی، یک قطعه انتخاب کنید.</p>
                </div>
            )}
        </div>
    );
};

export default PurchaseModule;
