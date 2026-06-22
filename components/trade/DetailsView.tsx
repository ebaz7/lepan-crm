import React, { useState, useEffect } from 'react';
import { 
    TradeRecord, 
    TradeStage, 
    TradeItem, 
    SystemSettings, 
    InsuranceEndorsement, 
    CurrencyPurchaseData, 
    TradeTransaction, 
    CurrencyTranche, 
    CurrencyDelivery, 
    TradeStageData, 
    ShippingDocument, 
    ShippingDocType, 
    DocStatus, 
    InvoiceItem, 
    InspectionData, 
    InspectionPayment, 
    InspectionCertificate, 
    ClearanceData, 
    WarehouseReceipt, 
    ClearancePayment, 
    GreenLeafData, 
    GreenLeafCustomsDuty, 
    GreenLeafGuarantee, 
    GreenLeafTax, 
    GreenLeafRoadToll, 
    InternalShippingData, 
    ShippingPayment, 
    AgentData, 
    AgentPayment, 
    PackingItem, 
    User, 
    GuaranteeCheque 
} from '../../types';
import { 
    History, 
    FileText, 
    Shield, 
    Coins, 
    Package, 
    Microscope, 
    Warehouse, 
    Leaf, 
    Truck, 
    FileSpreadsheet, 
    Calculator, 
    ChevronRight, 
    Plus, 
    Trash2, 
    Edit2, 
    Check, 
    X, 
    Paperclip, 
    Printer, 
    RefreshCw, 
    FileDown, 
    CheckCircle2, 
    Calendar, 
    AlertCircle, 
    DollarSign, 
    Archive,
    Share2, 
    Info 
} from 'lucide-react';
import { 
    formatCurrency, 
    formatNumberString, 
    deformatNumberString, 
    generateUUID 
} from '../../constants';
import InsuranceTab from '../InsuranceTab';
import CurrencyGuaranteeSection from './CurrencyGuaranteeSection';

interface DetailsViewProps {
    selectedRecord: TradeRecord;
    setSelectedRecord: (r: TradeRecord | null) => void;
    setViewMode: (vm: any) => void;
    updateTradeRecord: (record: TradeRecord) => Promise<any>;
    currentUser: User;
    settings: SystemSettings | null;
    availableBanks: string[];
    operatingBanks: string[];
    availableCompanies: string[];
    companySpecificBanks: string[];
    activeTab: string;
    setActiveTab: (t: string) => void;
    insuranceForm: any;
    setForm: any;
    newEndorsement: any;
    setNewEndorsement: any;
    endorsementType: any;
    setEndorsementType: any;
    handleAddEndorsement: () => Promise<void>;
    handleDeleteEndorsement: (id: string) => Promise<void>;
    handleSaveInsurance: () => Promise<void>;
    newItem: any;
    setNewItem: any;
    editingItemId: string | null;
    setEditingItemId: (id: string | null) => void;
    handleAddItem: () => Promise<void>;
    handleEditItem: (item: TradeItem) => void;
    handleRemoveItem: (id: string) => Promise<void>;
    newLicenseTx: any;
    setNewLicenseTx: any;
    handleAddLicenseTx: () => Promise<void>;
    handleRemoveLicenseTx: (id: string) => Promise<void>;
    inspectionForm: any;
    setInspectionForm: any;
    newInspectionCertificate: any;
    setNewInspectionCertificate: any;
    newInspectionPayment: any;
    setNewInspectionPayment: any;
    handleAddInspectionCertificate: () => Promise<void>;
    handleDeleteInspectionCertificate: (id: string) => Promise<void>;
    handleAddInspectionPayment: () => Promise<void>;
    handleDeleteInspectionPayment: (id: string) => Promise<void>;
    clearanceForm: any;
    setClearanceForm: any;
    newWarehouseReceipt: any;
    setNewWarehouseReceipt: any;
    newClearancePayment: any;
    setNewClearancePayment: any;
    handleAddWarehouseReceipt: () => Promise<void>;
    handleDeleteWarehouseReceipt: (id: string) => Promise<void>;
    handleAddClearancePayment: () => Promise<void>;
    handleDeleteClearancePayment: (id: string) => Promise<void>;
    greenLeafForm: any;
    setGreenLeafForm: any;
    newCustomsDuty: any;
    setNewCustomsDuty: any;
    newGuaranteeDetails: any;
    setNewGuaranteeDetails: any;
    selectedDutyForGuarantee: string;
    setSelectedDutyForGuarantee: (id: string) => void;
    newTax: any;
    setNewTax: any;
    newRoadToll: any;
    setNewRoadToll: any;
    handleAddCustomsDuty: () => Promise<void>;
    handleDeleteCustomsDuty: (id: string) => Promise<void>;
    handleAddGuarantee: () => Promise<void>;
    handleDeleteGuarantee: (id: string) => Promise<void>;
    handleToggleGuaranteeDelivery: (id: string) => Promise<void>;
    handleAddTax: () => Promise<void>;
    handleDeleteTax: (id: string) => Promise<void>;
    handleAddRoadToll: () => Promise<void>;
    handleDeleteRoadToll: (id: string) => Promise<void>;
    internalShippingForm: any;
    setInternalShippingForm: any;
    newShippingPayment: any;
    setNewShippingPayment: any;
    handleAddShippingPayment: () => Promise<void>;
    handleDeleteShippingPayment: (id: string) => Promise<void>;
    agentForm: any;
    setAgentForm: any;
    newAgentPayment: any;
    setNewAgentPayment: any;
    handleAddAgentPayment: () => Promise<void>;
    handleDeleteAgentPayment: (id: string) => Promise<void>;
    currencyForm: any;
    setCurrencyForm: any;
    newCurrencyTranche: any;
    setNewCurrencyTranche: any;
    handleAddCurrencyTranche: () => Promise<void>;
    editingTrancheId: string | null;
    setEditingTrancheId: (id: string | null) => void;
    setSelectedTrancheForDeliveries: (id: string | null) => void;
    handleAddCurrencyGuarantee: (newG: GuaranteeCheque) => Promise<void>;
    handleDeleteCurrencyGuarantee: (idx: number) => Promise<void>;
    handleToggleCurrencyGuaranteeDelivery: (idx: number) => Promise<void>;
    shippingDocForm: any;
    setShippingDocForm: any;
    activeShippingSubTab: ShippingDocType;
    setActiveShippingSubTab: (tab: ShippingDocType) => void;
    newInvoiceItem: any;
    setNewInvoiceItem: any;
    newPackingItem: any;
    setNewPackingItem: any;
    handleAddInvoiceItem: () => void;
    handleAddPackingItem: () => void;
    handleSaveShippingDoc: () => Promise<void>;
    handleDeleteShippingDoc: (id: string) => Promise<void>;
    handleSyncInvoiceToProforma: () => Promise<void>;
    docFileInputRef: React.RefObject<HTMLInputElement>;
    handleDocFileChange: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
    uploadingDocFile: boolean;
    editingStage: TradeStage | null;
    setEditingStage: (stage: TradeStage | null) => void;
    stageFormData: any;
    setStageFormData: any;
    handleSaveStage: () => Promise<void>;
    fileInputRef: React.RefObject<HTMLInputElement>;
    handleStageFileChange: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
    uploadingStageFile: boolean;
    handleArchiveRecord: () => Promise<void>;
    handleUnarchiveRecord: () => Promise<void>;
    STAGES: TradeStage[];
}

const TABS = [
    { id: 'timeline', label: 'خلاصه وضعیت پرونده', icon: History },
    { id: 'proforma', label: 'پیش‌فاکتور و کالاها', icon: FileText },
    { id: 'insurance', label: 'بیمه باربری', icon: Shield },
    { id: 'currency_purchase', label: 'تخصیص و خرید ارز', icon: Coins },
    { id: 'shipping_docs', label: 'اسناد حمل خارجی', icon: Package },
    { id: 'inspection', label: 'گواهی بازرسی (IC)', icon: Microscope },
    { id: 'clearance_docs', label: 'ترخیصیه و قبض انبار', icon: Warehouse },
    { id: 'green_leaf', label: 'گمرک و برگ سبز', icon: Leaf },
    { id: 'internal_shipping', label: 'حمل داخلی کالا', icon: Truck },
    { id: 'agent_fees', label: 'حق‌العمل و هزینه‌ها', icon: FileSpreadsheet },
    { id: 'final_calculation', label: 'بهای تمام‌شده نهایی', icon: Calculator },
];

export const DetailsView: React.FC<DetailsViewProps> = (props) => {
    const {
        selectedRecord,
        setSelectedRecord,
        setViewMode,
        updateTradeRecord,
        currentUser,
        availableBanks,
        operatingBanks,
        availableCompanies,
        settings,
        companySpecificBanks,
        activeTab,
        setActiveTab,
        insuranceForm,
        setForm,
        newEndorsement,
        setNewEndorsement,
        endorsementType,
        setEndorsementType,
        handleAddEndorsement,
        handleDeleteEndorsement,
        handleSaveInsurance,
        newItem,
        setNewItem,
        editingItemId,
        setEditingItemId,
        handleAddItem,
        handleEditItem,
        handleRemoveItem,
        newLicenseTx,
        setNewLicenseTx,
        handleAddLicenseTx,
        handleRemoveLicenseTx,
        inspectionForm,
        newInspectionCertificate,
        setNewInspectionCertificate,
        newInspectionPayment,
        setNewInspectionPayment,
        handleAddInspectionCertificate,
        handleDeleteInspectionCertificate,
        handleAddInspectionPayment,
        handleDeleteInspectionPayment,
        clearanceForm,
        newWarehouseReceipt,
        setNewWarehouseReceipt,
        newClearancePayment,
        setNewClearancePayment,
        handleAddWarehouseReceipt,
        handleDeleteWarehouseReceipt,
        handleAddClearancePayment,
        handleDeleteClearancePayment,
        greenLeafForm,
        newCustomsDuty,
        setNewCustomsDuty,
        newGuaranteeDetails,
        setNewGuaranteeDetails,
        selectedDutyForGuarantee,
        setSelectedDutyForGuarantee,
        newTax,
        setNewTax,
        newRoadToll,
        setNewRoadToll,
        handleAddCustomsDuty,
        handleDeleteCustomsDuty,
        handleAddGuarantee,
        handleDeleteGuarantee,
        handleToggleGuaranteeDelivery,
        handleAddTax,
        handleDeleteTax,
        handleAddRoadToll,
        handleDeleteRoadToll,
        internalShippingForm,
        newShippingPayment,
        setNewShippingPayment,
        handleAddShippingPayment,
        handleDeleteShippingPayment,
        agentForm,
        newAgentPayment,
        setNewAgentPayment,
        handleAddAgentPayment,
        handleDeleteAgentPayment,
        currencyForm,
        newCurrencyTranche,
        setNewCurrencyTranche,
        handleAddCurrencyTranche,
        editingTrancheId,
        setEditingTrancheId,
        setSelectedTrancheForDeliveries,
        handleAddCurrencyGuarantee,
        handleDeleteCurrencyGuarantee,
        handleToggleCurrencyGuaranteeDelivery,
        shippingDocForm,
        setShippingDocForm,
        activeShippingSubTab,
        setActiveShippingSubTab,
        newInvoiceItem,
        setNewInvoiceItem,
        newPackingItem,
        setNewPackingItem,
        handleAddInvoiceItem,
        handleAddPackingItem,
        handleSaveShippingDoc,
        handleDeleteShippingDoc,
        handleSyncInvoiceToProforma,
        docFileInputRef,
        handleDocFileChange,
        uploadingDocFile,
        editingStage,
        setEditingStage,
        stageFormData,
        setStageFormData,
        handleSaveStage,
        fileInputRef,
        handleStageFileChange,
        uploadingStageFile,
        handleArchiveRecord,
        handleUnarchiveRecord,
        STAGES
    } = props;

    // Local Proforma metadata state to allow saving top level fields inside Tab 2
    const [proformaNo, setProformaNo] = useState(selectedRecord.orderNumber || '');
    const [regNo, setRegNo] = useState(selectedRecord.registrationNumber || '');
    const [regDate, setRegDate] = useState(selectedRecord.registrationDate || '');
    const [regExp, setRegExp] = useState(selectedRecord.registrationExpiry || '');
    const [opBank, setOpBank] = useState(selectedRecord.operatingBank || '');
    const [seller, setSeller] = useState(selectedRecord.sellerName || '');
    const [goodsName, setGoodsName] = useState(selectedRecord.goodsName || '');
    const [freight, setFreight] = useState(selectedRecord.freightCost || 0);

    useEffect(() => {
        setProformaNo(selectedRecord.orderNumber || '');
        setRegNo(selectedRecord.registrationNumber || '');
        setRegDate(selectedRecord.registrationDate || '');
        setRegExp(selectedRecord.registrationExpiry || '');
        setOpBank(selectedRecord.operatingBank || '');
        setSeller(selectedRecord.sellerName || '');
        setGoodsName(selectedRecord.goodsName || '');
        setFreight(selectedRecord.freightCost || 0);
    }, [selectedRecord]);

    const handleSaveMetadata = async () => {
        const updated = {
            ...selectedRecord,
            orderNumber: proformaNo,
            registrationNumber: regNo,
            registrationDate: regDate,
            registrationExpiry: regExp,
            operatingBank: opBank,
            sellerName: seller,
            goodsName: goodsName,
            freightCost: Number(freight) || 0
        };
        await updateTradeRecord(updated);
        setSelectedRecord(updated);
        alert('اطلاعات پرونده با موفقیت به روز رسانی شد.');
    };

    const totalWeight = selectedRecord.items?.reduce((acc, current) => acc + (current.weight || 0), 0) || 0;
    const totalFob = selectedRecord.items?.reduce((acc, current) => acc + (current.totalPrice || 0), 0) || 0;

    return (
        <div className="flex flex-col h-full bg-slate-50 font-sans" dir="rtl">
            {/* Dossier Header */}
            <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 z-10 shadow-sm">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => { setSelectedRecord(null); setViewMode('dashboard'); }} 
                        className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all active:scale-95"
                    >
                        <ChevronRight size={20} />
                    </button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h2 className="text-xl font-bold text-slate-800">
                                پرونده بازرگانی ممیزی: {selectedRecord.fileNumber}
                            </h2>
                            {selectedRecord.status === 'Completed' ? (
                                <span className="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-1 rounded-full font-bold">تکمیل شده</span>
                            ) : (
                                <span className="bg-amber-100 text-amber-800 text-xs px-2.5 py-1 rounded-full font-bold">جاری و فعال</span>
                            )}
                        </div>
                        <p className="text-sm text-slate-500 mt-1">
                            {selectedRecord.company} • {selectedRecord.goodsName} • ارز مرجع: <strong className="text-slate-700">{selectedRecord.mainCurrency}</strong>
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {selectedRecord.isArchived ? (
                        <button 
                            onClick={handleUnarchiveRecord} 
                            className="bg-amber-50 text-amber-700 hover:bg-amber-100 px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all"
                        >
                            <RefreshCw size={16} />
                            خروج از بایگانی پرونده
                        </button>
                    ) : (
                        <button 
                            onClick={handleArchiveRecord} 
                            className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all"
                        >
                            <Archive size={16} />
                            بایگانی پرونده (اتمام کار)
                        </button>
                    )}
                </div>
            </div>

            {/* Layout With Responsive Sidebar Navigation */}
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                {/* Right Sidebar on Desktop */}
                <div className="w-full md:w-80 bg-white border-l border-slate-200 flex flex-row md:flex-col overflow-x-auto md:overflow-y-auto shrink-0 custom-scrollbar whitespace-nowrap p-2 gap-1">
                    {TABS.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-right transition-all font-semibold text-sm select-none ${
                                    isActive 
                                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/15' 
                                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                }`}
                            >
                                <Icon size={18} className={isActive ? 'text-white' : 'text-slate-400'} />
                                <span>{tab.label}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Left Active Content Pane */}
                <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar bg-slate-50">
                    <div className="max-w-6xl mx-auto space-y-6">
                        
                        {/* 1. TIMELINE & STAGES */}
                        {activeTab === 'timeline' && (
                            <div className="space-y-6">
                                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                                    <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                                        <History className="text-blue-600" />
                                        خط زمانی و وضعیت مراحل فیزیکی پرونده
                                    </h3>
                                    
                                    <div className="relative border-r-2 border-slate-100 pr-5 space-y-8 py-3">
                                        {STAGES.map((stg) => {
                                            const stageData = selectedRecord.stages?.[stg];
                                            const isDone = !!stageData?.isCompleted;
                                            const costR = stageData?.costRial || 0;
                                            const costC = stageData?.costCurrency || 0;

                                            return (
                                                <div key={stg} className="relative">
                                                    {/* Node status dot */}
                                                    <span className={`absolute -right-[27px] top-1.5 flex h-4 w-4 rounded-full border-2 bg-white ${
                                                        isDone ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300'
                                                    }`} />

                                                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                                                        <div>
                                                            <h4 className="font-bold text-slate-800 text-base">{stg}</h4>
                                                            <p className="text-xs text-slate-500 mt-0.5">
                                                                {stageData?.description || 'توضیحات و رخدادهای ثبت نشده'}
                                                            </p>
                                                            {(costR > 0 || costC > 0) && (
                                                                <div className="flex gap-4 mt-1.5 text-xs font-bold text-slate-600">
                                                                    {costR > 0 && <span>هزینه ریالی: {formatCurrency(costR)} ریال</span>}
                                                                    {costC > 0 && <span>هزینه ارزی: {costC.toLocaleString()} {stageData?.currencyType || selectedRecord.mainCurrency}</span>}
                                                                </div>
                                                            )}
                                                        </div>

                                                        <div className="flex items-center gap-2 shrink-0">
                                                            {stageData?.attachments && stageData.attachments.length > 0 && (
                                                                <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded font-bold flex items-center gap-1">
                                                                    <Paperclip size={12} />
                                                                    {stageData.attachments.length} فایل
                                                                </span>
                                                            )}
                                                            <button 
                                                                onClick={() => {
                                                                    setEditingStage(stg);
                                                                    setStageFormData(stageData || { stage: stg, isCompleted: false, description: '', costRial: 0, costCurrency: 0, currencyType: selectedRecord.mainCurrency, attachments: [] });
                                                                }} 
                                                                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs rounded-lg font-bold"
                                                            >
                                                                ویرایش گام
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Slide-in Stage Editor Panel */}
                                {editingStage && (
                                    <div className="bg-slate-900 text-slate-100 rounded-2xl p-6 shadow-xl relative border border-slate-800">
                                        <button 
                                            onClick={() => setEditingStage(null)} 
                                            className="absolute top-4 left-4 p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-all"
                                        >
                                            <X size={16} />
                                        </button>
                                        
                                        <h3 className="text-base font-bold mb-4 text-white flex items-center gap-2">
                                            <Edit2 size={16} />
                                            بروزرسانی وضعیت مرحله: {editingStage}
                                        </h3>

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-400 mb-1">هزینه ریال (کل شده این مرحله)</label>
                                                <input 
                                                    type="text" 
                                                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg p-2.5 text-sm"
                                                    value={stageFormData.costRialStr || formatNumberString(stageFormData.costRial || 0)} 
                                                    onChange={e => {
                                                        const raw = deformatNumberString(e.target.value);
                                                        setStageFormData((prev: any) => ({ ...prev, costRial: raw, costRialStr: e.target.value }));
                                                    }}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-400 mb-1">هزینه ارزی</label>
                                                <input 
                                                    type="number" 
                                                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg p-2.5 text-sm"
                                                    value={stageFormData.costCurrency || 0} 
                                                    onChange={e => setStageFormData((prev: any) => ({ ...prev, costCurrency: Number(e.target.value) }))}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-400 mb-1">نوع ارز هزینه</label>
                                                <select 
                                                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg p-2.5 text-sm"
                                                    value={stageFormData.currencyType || selectedRecord.mainCurrency} 
                                                    onChange={e => setStageFormData((prev: any) => ({ ...prev, currencyType: e.target.value }))}
                                                >
                                                    <option value="EUR">يورو (€)</option>
                                                    <option value="USD">دلار ($)</option>
                                                    <option value="AED">درهم (AED)</option>
                                                </select>
                                            </div>
                                        </div>

                                        <div className="mt-4">
                                            <label className="block text-xs font-bold text-slate-400 mb-1">توضیحات و گزارشات فیزیکی این گام</label>
                                            <textarea 
                                                className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg p-2.5 text-sm h-20"
                                                value={stageFormData.description || ''} 
                                                onChange={e => setStageFormData((prev: any) => ({ ...prev, description: e.target.value }))}
                                            />
                                        </div>

                                        {/* Queue dates block if Allocation queue */}
                                        {editingStage === TradeStage.ALLOCATION_QUEUE && (
                                            <div className="mt-4">
                                                <label className="block text-xs font-bold text-slate-400 mb-1">تاریخ ورود به صف بانک مرکزی</label>
                                                <input 
                                                    type="text" 
                                                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg p-2.5 text-sm" 
                                                    placeholder="۱۴۰۲/۰۶/۲۰"
                                                    value={stageFormData.queueDate || ''} 
                                                    onChange={e => setStageFormData((prev: any) => ({ ...prev, queueDate: e.target.value }))}
                                                />
                                            </div>
                                        )}

                                        {/* Approved dates block if Allocation Approved */}
                                        {editingStage === TradeStage.ALLOCATION_APPROVED && (
                                            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-400 mb-1">تاریخ تخصیص رسمی</label>
                                                    <input 
                                                        type="text" 
                                                        className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg p-2.5 text-sm" 
                                                        placeholder="۱۴۰۲/۰۷/۱۰"
                                                        value={stageFormData.allocationDate || ''} 
                                                        onChange={e => setStageFormData((prev: any) => ({ ...prev, allocationDate: e.target.value }))}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-400 mb-1">کد تخصیص هشت رقمی</label>
                                                    <input 
                                                        type="text" 
                                                        className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg p-2.5 text-sm" 
                                                        value={stageFormData.allocationCode || ''} 
                                                        onChange={e => setStageFormData((prev: any) => ({ ...prev, allocationCode: e.target.value }))}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-400 mb-1">انقضای تخصیص</label>
                                                    <input 
                                                        type="text" 
                                                        className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg p-2.5 text-sm" 
                                                        placeholder="۱۴۰۲/۱۰/۱۰"
                                                        value={stageFormData.allocationExpiry || ''} 
                                                        onChange={e => setStageFormData((prev: any) => ({ ...prev, allocationExpiry: e.target.value }))}
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        {/* Stage Attachments */}
                                        <div className="mt-5 bg-slate-850 p-4 rounded-xl border border-slate-800">
                                            <h4 className="text-xs font-bold text-slate-400 mb-2">پیوست‌های پرونده در این مرحله</h4>
                                            <div className="flex flex-wrap gap-2 mb-3">
                                                {stageFormData.attachments?.map((at: any, idx: number) => (
                                                    <a key={idx} href={at.url} target="_blank" rel="noreferrer" className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg px-3 py-1.5 text-xs flex items-center gap-1.5">
                                                        <Paperclip size={12} />
                                                        <span>{at.fileName || 'سند ضمیمه شده'}</span>
                                                    </a>
                                                ))}
                                            </div>

                                            <input 
                                                type="file" 
                                                ref={fileInputRef} 
                                                onChange={handleStageFileChange} 
                                                className="hidden" 
                                            />
                                            <button 
                                                onClick={() => fileInputRef.current?.click()} 
                                                disabled={uploadingStageFile}
                                                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-bold flex items-center gap-2"
                                            >
                                                {uploadingStageFile ? <RefreshCw className="animate-spin" size={14} /> : <Plus size={14} />}
                                                بارگذاری سند ابلاغی یا فاکتور این مرحله
                                            </button>
                                        </div>

                                        <div className="mt-6 flex items-center gap-4">
                                            <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold select-none">
                                                <input 
                                                    type="checkbox" 
                                                    checked={!!stageFormData.isCompleted} 
                                                    onChange={e => setStageFormData((prev: any) => ({ ...prev, isCompleted: e.target.checked }))} 
                                                    className="rounded border-slate-700 text-blue-600 bg-slate-800 focus:ring-0" 
                                                />
                                                تایید تکمیل و اتمام رسمی این مرحله
                                            </label>

                                            <button 
                                                onClick={handleSaveStage} 
                                                className="mr-auto bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-blue-600/20"
                                            >
                                                ذخیره اطلاعات مرحله
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 2. PROFORMA & ITEMS */}
                        {activeTab === 'proforma' && (
                            <div className="space-y-6">
                                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                                    <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2 border-b pb-3">
                                        <FileText className="text-blue-600" />
                                        سربرگ پیش‌فاکتور (Proforma Details)
                                    </h3>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 mb-1">شماره پیش‌فاکتور / پروفرما</label>
                                            <input type="text" className="w-full border rounded-xl p-3 bg-slate-50 text-sm" value={proformaNo} onChange={e => setProformaNo(e.target.value)} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 mb-1">شماره ثبت سفارش گمرکی</label>
                                            <input type="text" className="w-full border rounded-xl p-3 bg-slate-50 text-sm" value={regNo} onChange={e => setRegNo(e.target.value)} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 mb-1">بانک عامل گشایش کننده</label>
                                            <input type="text" className="w-full border rounded-xl p-3 bg-slate-50 text-sm" value={opBank} onChange={e => setOpBank(e.target.value)} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 mb-1">فروشنده / ذینفع خارجی</label>
                                            <input type="text" className="w-full border rounded-xl p-3 bg-slate-50 text-sm" value={seller} onChange={e => setSeller(e.target.value)} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 mb-1">تاریخ ثبت سفارش</label>
                                            <input type="text" className="w-full border rounded-xl p-3 bg-slate-50 text-sm" value={regDate} onChange={e => setRegDate(e.target.value)} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 mb-1">تاریخ انقضاء اعتبار</label>
                                            <input type="text" className="w-full border rounded-xl p-3 bg-slate-50 text-sm" value={regExp} onChange={e => setRegExp(e.target.value)} />
                                        </div>
                                    </div>

                                    <div className="mt-4 flex justify-end">
                                        <button 
                                            onClick={handleSaveMetadata} 
                                            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition-all shadow-md"
                                        >
                                            ذخیره مشخصات پروفرما
                                        </button>
                                    </div>
                                </div>

                                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                                    <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                                        <Package className="text-emerald-600" />
                                        اقلام کالا در پروفرما
                                    </h3>

                                    {/* Item Creator Form */}
                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 grid grid-cols-1 md:grid-cols-4 gap-3 items-end mb-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-600 mb-1">شرح کالا</label>
                                            <input 
                                                type="text" 
                                                className="w-full border rounded-lg p-2.5 text-sm bg-white" 
                                                value={newItem.name} 
                                                onChange={e => setNewItem((p: any) => ({ ...p, name: e.target.value }))} 
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-600 mb-1">وزن خالص (Kg)</label>
                                            <input 
                                                type="text" 
                                                className="w-full border rounded-lg p-2.5 text-sm bg-white" 
                                                value={newItem.weightStr || ''} 
                                                onChange={e => setNewItem((p: any) => ({ ...p, weightStr: e.target.value }))} 
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-600 mb-1">ارزش کل فوب (ارز اصلی)</label>
                                            <input 
                                                type="text" 
                                                className="w-full border rounded-lg p-2.5 text-sm bg-white" 
                                                value={newItem.unitPriceStr || ''} 
                                                onChange={e => setNewItem((p: any) => ({ ...p, unitPriceStr: e.target.value }))} 
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-600 mb-1">تعرفه گمرکی (HS Code)</label>
                                            <input 
                                                type="text" 
                                                className="w-full border rounded-lg p-2.5 text-sm bg-white" 
                                                value={newItem.hsCode || ''} 
                                                placeholder="مثلا: 87082990"
                                                onChange={e => setNewItem((p: any) => ({ ...p, hsCode: e.target.value }))} 
                                            />
                                        </div>
                                        <div className="md:col-span-4 flex justify-end gap-2">
                                            {editingItemId && (
                                                <button 
                                                    onClick={() => {
                                                        setEditingItemId(null);
                                                        setNewItem({ name: '', weight: 0, unitPrice: 0, totalPrice: 0, hsCode: '', weightStr: '', unitPriceStr: '' });
                                                    }} 
                                                    className="px-4 py-2 bg-slate-200 text-slate-700 text-xs font-bold rounded-lg"
                                                >
                                                    انصراف
                                                </button>
                                            )}
                                            <button 
                                                onClick={handleAddItem} 
                                                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-sm"
                                            >
                                                {editingItemId ? 'بروزرسانی کالا' : 'افزودن کالا'}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Items Table */}
                                    <div className="overflow-x-auto border rounded-xl">
                                        <table className="w-full text-inner border-collapse">
                                            <thead>
                                                <tr className="bg-slate-50 text-slate-700 text-xs border-b">
                                                    <th className="p-3 text-right">عنوان کالا</th>
                                                    <th className="p-3 text-center">تعرفه HS</th>
                                                    <th className="p-3 text-center">وزن خالص (Kg)</th>
                                                    <th className="p-3 text-center">ارزش کل فوب</th>
                                                    <th className="p-3 text-center">قیمت واحد</th>
                                                    <th className="p-3 text-center w-24">عملیات</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y text-sm">
                                                {selectedRecord.items?.map((item) => (
                                                    <tr key={item.id} className="hover:bg-slate-50 text-slate-800">
                                                        <td className="p-3 font-medium">{item.name}</td>
                                                        <td className="p-3 text-center font-mono">{item.hsCode || '---'}</td>
                                                        <td className="p-3 text-center font-extrabold">{item.weight?.toLocaleString()}</td>
                                                        <td className="p-3 text-center text-blue-600 font-extrabold">
                                                            {item.totalPrice?.toLocaleString()} {selectedRecord.mainCurrency}
                                                        </td>
                                                        <td className="p-3 text-center text-slate-550 font-medium">
                                                            {Number(item.unitPrice?.toFixed(3))?.toLocaleString()}
                                                        </td>
                                                        <td className="p-3 text-center flex justify-center gap-1.5">
                                                            <button onClick={() => handleEditItem(item)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg">
                                                                <Edit2 size={14} />
                                                            </button>
                                                            <button onClick={() => handleRemoveItem(item.id)} className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg">
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                                {(!selectedRecord.items || selectedRecord.items.length === 0) && (
                                                    <tr>
                                                        <td colSpan={6} className="p-8 text-center text-slate-400">هیچ کالایی به این پروفرما ضمیمه نشده است.</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Aggregate Summary */}
                                    {selectedRecord.items && selectedRecord.items.length > 0 && (
                                        <div className="mt-4 bg-slate-50 p-4 border rounded-xl flex flex-wrap justify-between items-center text-sm font-bold text-slate-800">
                                            <span>مجموع وزن کالاها: {totalWeight.toLocaleString()} کیلوگرم</span>
                                            <span>مجموع ارزش کل فوب: {totalFob.toLocaleString()} {selectedRecord.mainCurrency}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Order Reg Fees (هزینه ثبت سفارش) */}
                                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                                    <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2 border-b pb-3">
                                        <FileSpreadsheet className="text-indigo-600" />
                                        هزینه‌های فرعی ثبت سفارش و تایید مجوزها
                                    </h3>

                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4 items-end bg-slate-50 p-4 rounded-xl border border-slate-100">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-600 mb-1">مبلغ ریال هزینه</label>
                                            <input 
                                                type="number" 
                                                className="w-full bg-white border rounded-lg p-2.5 text-sm" 
                                                value={newLicenseTx.amount || ''} 
                                                onChange={e => setNewLicenseTx((p: any) => ({ ...p, amount: Number(e.target.value) }))} 
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-600 mb-1">بانک یا صرافی واسط</label>
                                            <input 
                                                type="text" 
                                                className="w-full bg-white border rounded-lg p-2.5 text-sm" 
                                                value={newLicenseTx.bank || ''} 
                                                onChange={e => setNewLicenseTx((p: any) => ({ ...p, bank: e.target.value }))} 
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-600 mb-1">تاریخ پرداخت</label>
                                            <input 
                                                type="text" 
                                                className="w-full bg-white border rounded-lg p-2.5 text-sm" 
                                                placeholder="۱۴۰۲/۰۷/۱۵"
                                                value={newLicenseTx.date || ''} 
                                                onChange={e => setNewLicenseTx((p: any) => ({ ...p, date: e.target.value }))} 
                                            />
                                        </div>
                                        <button 
                                            onClick={handleAddLicenseTx} 
                                            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg flex items-center gap-1 shadow-sm"
                                        >
                                            ثبت هزینه اداری
                                        </button>
                                    </div>

                                    <div className="overflow-x-auto border rounded-xl">
                                        <table className="w-full text-inner">
                                            <thead>
                                                <tr className="bg-slate-50 text-slate-700 text-xs border-b">
                                                    <th className="p-3 text-right">بابت هزینه (توضیحات)</th>
                                                    <th className="p-3 text-center">بانک</th>
                                                    <th className="p-3 text-center font-bold">مبلغ (ریال)</th>
                                                    <th className="p-3 text-center">تاریخ</th>
                                                    <th className="p-3 text-center w-20">عملیات</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y text-sm">
                                                {selectedRecord.licenseData?.transactions?.map((tx) => (
                                                    <tr key={tx.id} className="hover:bg-slate-50 text-slate-800">
                                                        <td className="p-3">{tx.description || 'هزینه ثبت سفارش'}</td>
                                                        <td className="p-3 text-center">{tx.bank || '---'}</td>
                                                        <td className="p-3 text-center text-slate-900 font-extrabold">{formatCurrency(tx.amount)}</td>
                                                        <td className="p-3 text-center">{tx.date || '---'}</td>
                                                        <td className="p-3 text-center">
                                                            <button onClick={() => handleRemoveLicenseTx(tx.id)} className="p-1 text-rose-600 hover:bg-rose-50 rounded-lg">
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                                {(!selectedRecord.licenseData?.transactions || selectedRecord.licenseData.transactions.length === 0) && (
                                                    <tr>
                                                        <td colSpan={5} className="p-4 text-center text-slate-400">هیچ هزینه‌ای برای ثبت سفارش پرونده هنوز ثبت نشده است.</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 3. INSURANCE TAB */}
                        {activeTab === 'insurance' && (
                            <InsuranceTab 
                                form={insuranceForm} 
                                setForm={setForm}
                                newEndorsement={newEndorsement}
                                setNewEndorsement={setNewEndorsement}
                                endorsementType={endorsementType}
                                setEndorsementType={setEndorsementType}
                                onAddEndorsement={handleAddEndorsement}
                                onDeleteEndorsement={handleDeleteEndorsement}
                                onSave={handleSaveInsurance}
                                companies={availableCompanies}
                                banks={availableBanks}
                            />
                        )}

                        {/* 4. CURRENCY PURCHASE TAB */}
                        {activeTab === 'currency_purchase' && (
                            <div className="space-y-6">
                                {/* Buy Tranche Creator */}
                                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                                    <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2 border-b pb-3">
                                        <Coins className="text-blue-600" />
                                        ثبت پارت ارزی جدید (خریداری شده)
                                    </h3>

                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-600 mb-1">مبلغ ارزی پارت</label>
                                            <input 
                                                type="text" 
                                                className="w-full border rounded-lg p-2.5 text-sm bg-slate-50" 
                                                placeholder="مثلا: 50,000"
                                                value={newCurrencyTranche.amountStr || ''} 
                                                onChange={e => setNewCurrencyTranche((p: any) => ({ ...p, amountStr: e.target.value }))} 
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-600 mb-1">نوع ارز خریداری شده</label>
                                            <select 
                                                className="w-full border rounded-lg p-2.5 text-sm bg-slate-50"
                                                value={newCurrencyTranche.currencyType}
                                                onChange={e => setNewCurrencyTranche((p: any) => ({ ...p, currencyType: e.target.value }))}
                                            >
                                                <option value="EUR">يورو (€)</option>
                                                <option value="USD">دلار ($)</option>
                                                <option value="AED">درهم (AED)</option>
                                                <option value="CNY">يوان (¥)</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-600 mb-1">معادل ریالی پرداختی</label>
                                            <input 
                                                type="text" 
                                                className="w-full border rounded-lg p-2.5 text-sm bg-slate-50" 
                                                placeholder="ریال واریز شده صرافی"
                                                value={newCurrencyTranche.rialAmountStr || ''} 
                                                onChange={e => setNewCurrencyTranche((p: any) => ({ ...p, rialAmountStr: e.target.value }))} 
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-600 mb-1">کارمزد ارزی واسطه</label>
                                            <input 
                                                type="text" 
                                                className="w-full border rounded-lg p-2.5 text-sm bg-slate-50" 
                                                placeholder="مجموع کارمزد صرافی"
                                                value={newCurrencyTranche.currencyFeeStr || ''} 
                                                onChange={e => setNewCurrencyTranche((p: any) => ({ ...p, currencyFeeStr: e.target.value }))} 
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-600 mb-1">نام صرافی یا واسط</label>
                                            <input 
                                                type="text" 
                                                className="w-full border rounded-lg p-2.5 text-sm bg-slate-50" 
                                                value={newCurrencyTranche.exchangeName || ''} 
                                                onChange={e => setNewCurrencyTranche((p: any) => ({ ...p, exchangeName: e.target.value }))} 
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-600 mb-1">نام کارگزار مربوطه</label>
                                            <input 
                                                type="text" 
                                                className="w-full border rounded-lg p-2.5 text-sm bg-slate-50" 
                                                value={newCurrencyTranche.brokerName || ''} 
                                                onChange={e => setNewCurrencyTranche((p: any) => ({ ...p, brokerName: e.target.value }))} 
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-600 mb-1">تاریخ معامله ارزی</label>
                                            <input 
                                                type="text" 
                                                className="w-full border rounded-lg p-2.5 text-sm bg-slate-50" 
                                                placeholder="۱۴۰۲/۰۸/۰۲"
                                                value={newCurrencyTranche.date || ''} 
                                                onChange={e => setNewCurrencyTranche((p: any) => ({ ...p, date: e.target.value }))} 
                                            />
                                        </div>
                                        <button 
                                            onClick={handleAddCurrencyTranche} 
                                            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 shadow-sm"
                                        >
                                            <Plus size={14} />
                                            ثبت پارت ارزی
                                        </button>
                                    </div>
                                </div>

                                {/* Current Purchase Tranches List */}
                                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                                    <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                                        <CheckCircle2 className="text-emerald-600" />
                                        پارت‌های ارزی ثبت‌شده پرونده
                                    </h3>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {currencyForm.tranches?.map((tranche: CurrencyTranche) => {
                                            const fee = tranche.currencyFee || 0;
                                            const rate = tranche.rate || 0;
                                            const totalPaid = (tranche.amount || 0) + fee;
                                            return (
                                                <div key={tranche.id} className="border border-slate-200 rounded-xl p-4 hover:shadow-md transition-all relative">
                                                    <h4 className="text-sm font-bold text-slate-800 flex items-center justify-between">
                                                        <span>صرافی: {tranche.exchangeName || 'غیرمشخص'}</span>
                                                        <span className="text-xs text-slate-500 font-medium">مورخ: {tranche.date || '---'}</span>
                                                    </h4>
                                                    <div className="grid grid-cols-2 gap-2 mt-3 text-xs text-slate-700 font-semibold border-b pb-3">
                                                        <div>مبلغ معامله: <strong className="text-emerald-700 text-sm">{(tranche.amount || 0).toLocaleString()} {tranche.currencyType}</strong></div>
                                                        <div>ریال واریز شده: <span>{tranche.rialAmount?.toLocaleString()} ریال</span></div>
                                                        <div>نرخ پایانی تسویه: <span className="font-mono text-indigo-700">{rate.toLocaleString()} ریال</span></div>
                                                        <div>کارمزد صرافی: <span>{fee.toLocaleString()} {tranche.currencyType}</span></div>
                                                        <div className="col-span-2">کارگزار: {tranche.brokerName || '---'}</div>
                                                    </div>

                                                    <div className="mt-3 flex justify-between items-center bg-slate-50 p-2 rounded-lg">
                                                        <span className="text-xs text-slate-500">تحویل ذینفع: {tranche.isDelivered ? '✅ تحویل شده کامل' : '❌ معلق'}</span>
                                                        <button 
                                                            onClick={() => setSelectedTrancheForDeliveries(tranche.id)} 
                                                            className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-lg"
                                                        >
                                                            مدیریت تحویل‌های پارت
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {(!currencyForm.tranches || currencyForm.tranches.length === 0) && (
                                            <div className="col-span-2 border-2 border-dashed border-slate-200 rounded-xl p-8 text-center text-slate-400">
                                                هنوز هیچ معامله یا پارت خریدار ارزی به پرونده گشایش شده الصاق نگردیده است.
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Currency Guarantee Section */}
                                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                                    <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2 border-b pb-3">
                                        <Shield className="text-indigo-600" />
                                        تضمین‌های خرید و گشایش‌های ارزی
                                    </h3>
                                    <CurrencyGuaranteeSection
                                        guarantees={currencyForm.guaranteeCheques || []}
                                        onAdd={handleAddCurrencyGuarantee}
                                        onDelete={handleDeleteCurrencyGuarantee}
                                        onToggleDelivery={handleToggleCurrencyGuaranteeDelivery}
                                        companyBanks={companySpecificBanks}
                                    />
                                </div>
                            </div>
                        )}

                        {/* 5. SHIPPING DOCUMENTS TAB */}
                        {activeTab === 'shipping_docs' && (
                            <div className="space-y-6">
                                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                                    <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                                        <Package className="text-blue-600" />
                                        اسناد حمل خارجی کالا (Shipping Documents)
                                    </h3>

                                    {/* Document Type Switcher */}
                                    <div className="flex flex-wrap gap-2 mb-4 border-b pb-3">
                                        {(['Commercial Invoice', 'Packing List', 'Bill of Lading', 'Certificate of Origin'] as ShippingDocType[]).map((tab) => (
                                            <button
                                                key={tab}
                                                onClick={() => setActiveShippingSubTab(tab)}
                                                className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
                                                    activeShippingSubTab === tab 
                                                    ? 'bg-slate-900 text-white' 
                                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                                }`}
                                            >
                                                {tab === 'Commercial Invoice' ? 'سیاهه تجاری/Invoice' : 
                                                 tab === 'Packing List' ? 'لیست عدل‌بندی/Packing List' : 
                                                 tab === 'Bill of Lading' ? 'بارنامه/BL' : 'گواهی مبدا/CO'}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Sub-tab Document Specific Fields Form */}
                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-3">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-600 mb-1">شماره سند حمل ({activeShippingSubTab})</label>
                                            <input 
                                                type="text" 
                                                className="w-full bg-white border rounded-lg p-2.5 text-sm" 
                                                value={shippingDocForm.documentNumber || ''} 
                                                placeholder="مثلا: BL-4050"
                                                onChange={e => setShippingDocForm((p: any) => ({ ...p, documentNumber: e.target.value }))} 
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-600 mb-1">تاریخ صدور سند</label>
                                            <input 
                                                type="text" 
                                                className="w-full bg-white border rounded-lg p-2.5 text-sm" 
                                                placeholder="۱۴۰۱/۰۹/۱۰"
                                                value={shippingDocForm.documentDate || ''} 
                                                onChange={e => setShippingDocForm((p: any) => ({ ...p, documentDate: e.target.value }))} 
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-600 mb-1">پارت یا بخش محموله</label>
                                            <input 
                                                type="text" 
                                                className="w-full bg-white border rounded-lg p-2.5 text-sm" 
                                                placeholder="مثلا: Part 1"
                                                value={shippingDocForm.part || ''} 
                                                onChange={e => setShippingDocForm((p: any) => ({ ...p, part: e.target.value }))} 
                                            />
                                        </div>

                                        {/* Invoice extra fields */}
                                        {activeShippingSubTab === 'Commercial Invoice' && (
                                            <>
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-600 mb-1">کرایه حمل ارزی (Ocean Freight)</label>
                                                    <input 
                                                        type="number" 
                                                        className="w-full bg-white border rounded-lg p-2.5 text-sm" 
                                                        value={shippingDocForm.freightCost || ''} 
                                                        onChange={e => setShippingDocForm((p: any) => ({ ...p, freightCost: Number(e.target.value) }))} 
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-600 mb-1">نوع ارز کرایه حمل</label>
                                                    <select 
                                                        className="w-full bg-white border rounded-lg p-2.5 text-sm"
                                                        value={shippingDocForm.currency}
                                                        onChange={e => setShippingDocForm((p: any) => ({ ...p, currency: e.target.value }))}
                                                    >
                                                        <option value="EUR">يورو (€)</option>
                                                        <option value="USD">دلار ($)</option>
                                                    </select>
                                                </div>
                                            </>
                                        )}

                                        {/* BL extra fields */}
                                        {activeShippingSubTab === 'Bill of Lading' && (
                                            <>
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-600 mb-1">نام کشتی حامل</label>
                                                    <input 
                                                        type="text" 
                                                        className="w-full bg-white border rounded-lg p-2.5 text-sm" 
                                                        value={shippingDocForm.vesselName || ''} 
                                                        onChange={e => setShippingDocForm((p: any) => ({ ...p, vesselName: e.target.value }))} 
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-600 mb-1">بندر بارگیری مبدا (Loading Port)</label>
                                                    <input 
                                                        type="text" 
                                                        className="w-full bg-white border rounded-lg p-2.5 text-sm" 
                                                        value={shippingDocForm.portOfLoading || ''} 
                                                        onChange={e => setShippingDocForm((p: any) => ({ ...p, portOfLoading: e.target.value }))} 
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-600 mb-1">بندر مقصد تخلیه (Discharge Port)</label>
                                                    <input 
                                                        type="text" 
                                                        className="w-full bg-white border rounded-lg p-2.5 text-sm" 
                                                        value={shippingDocForm.portOfDischarge || ''} 
                                                        onChange={e => setShippingDocForm((p: any) => ({ ...p, portOfDischarge: e.target.value }))} 
                                                    />
                                                </div>
                                            </>
                                        )}
                                        
                                        <div className="md:col-span-3 flex justify-end gap-2 mt-4 pt-3 border-t">
                                            {activeShippingSubTab === 'Commercial Invoice' && (
                                                <button 
                                                    onClick={handleSyncInvoiceToProforma} 
                                                    className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl transition-all"
                                                >
                                                    همگام‌سازی سیاهه به فوب پروفرما
                                                </button>
                                            )}
                                            <button 
                                                onClick={handleSaveShippingDoc} 
                                                disabled={!shippingDocForm.documentNumber}
                                                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center justify-center shadow-sm"
                                            >
                                                ثبت نهایی {activeShippingSubTab}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Present Shipping Documents List */}
                                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                                    <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                                        <CheckCircle2 className="text-emerald-600" />
                                        لیست گواهی‌ها و فایل‌های بارنامه و سیاهه ضمیمه شده
                                    </h3>

                                    <div className="overflow-x-auto border rounded-xl">
                                        <table className="w-full text-inner">
                                            <thead>
                                                <tr className="bg-slate-50 text-slate-700 text-xs border-b">
                                                    <th className="p-3 text-right">نوع سند</th>
                                                    <th className="p-3 text-center">شناسه/شماره</th>
                                                    <th className="p-3 text-center">تاریخ سند</th>
                                                    <th className="p-3 text-center">پارت مرتبط</th>
                                                    <th className="p-3 text-center">توسط کاربر</th>
                                                    <th className="p-3 text-center w-20">عملیات</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y text-sm">
                                                {selectedRecord.shippingDocuments?.map((doc: ShippingDocument) => (
                                                    <tr key={doc.id} className="hover:bg-slate-50 text-slate-800">
                                                        <td className="p-3 font-semibold text-slate-900">
                                                            {doc.type === 'Commercial Invoice' ? 'سیاهه/Invoice' : 
                                                             doc.type === 'Packing List' ? 'لیست عدل‌بندی' :
                                                             doc.type === 'Bill of Lading' ? 'بارنامه/BL' : 'گواهی مبدا/CO'}
                                                        </td>
                                                        <td className="p-3 text-center font-mono font-bold text-slate-800">{doc.documentNumber}</td>
                                                        <td className="p-3 text-center">{doc.documentDate || '---'}</td>
                                                        <td className="p-3 text-center">{(doc as any).part || '---'}</td>
                                                        <td className="p-3 text-center text-slate-500 text-xs">{doc.createdBy || 'سیستم'}</td>
                                                        <td className="p-3 text-center">
                                                            <button 
                                                                onClick={() => handleDeleteShippingDoc(doc.id)} 
                                                                className="p-1 text-rose-600 hover:bg-rose-50 rounded-lg"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                                {(!selectedRecord.shippingDocuments || selectedRecord.shippingDocuments.length === 0) && (
                                                    <tr>
                                                        <td colSpan={6} className="p-4 text-center text-slate-400">تاکنون سند حمل مکتوبی برای این پرونده ذخیره نگردیده است.</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 6. INSPECTION CERTIFICATE TABS */}
                        {activeTab === 'inspection' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Inspection Certificate (IC/COI) Register */}
                                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
                                    <h3 className="text-base font-bold text-slate-800 mb-2 flex items-center gap-2 border-b pb-2">
                                        <Microscope className="text-blue-600" />
                                        ثبت اطلاعات فنی گواهی بازرسی (COI / IC)
                                    </h3>

                                    <div className="space-y-3">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-600 mb-1">شرکت بازرسی ناظر</label>
                                            <input type="text" className="w-full border rounded-lg p-2 bg-slate-50 text-sm" value={newInspectionCertificate.company || ''} onChange={e => setNewInspectionCertificate((p: any) => ({ ...p, company: e.target.value }))} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-600 mb-1">شماره سریال گواهی</label>
                                            <input type="text" className="w-full border rounded-lg p-2 bg-slate-50 text-sm" value={newInspectionCertificate.certificateNumber || ''} onChange={e => setNewInspectionCertificate((p: any) => ({ ...p, certificateNumber: e.target.value }))} />
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-600 mb-1">ارزش بازرسی شده (ارز)</label>
                                                <input type="number" className="w-full border rounded-lg p-2 bg-slate-50 text-sm" value={newInspectionCertificate.amount || ''} onChange={e => setNewInspectionCertificate((p: any) => ({ ...p, amount: Number(e.target.value) }))} />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-600 mb-1">بخش/پارت مرتبط</label>
                                                <input type="text" className="w-full border rounded-lg p-2 bg-slate-50 text-sm" placeholder="مثلا Part 1" value={newInspectionCertificate.part || ''} onChange={e => setNewInspectionCertificate((p: any) => ({ ...p, part: e.target.value }))} />
                                            </div>
                                        </div>
                                        <button onClick={handleAddInspectionCertificate} className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs transition-all shadow-sm">
                                            ثبت گواهی بازرسی
                                        </button>
                                    </div>

                                    <div className="overflow-x-auto border rounded-lg mt-4 max-h-48 overflow-y-auto">
                                        <table className="w-full text-xs">
                                            <thead className="bg-slate-50">
                                                <tr className="border-b">
                                                    <th className="p-2 text-right">شرکت</th>
                                                    <th className="p-2 text-center">شماره</th>
                                                    <th className="p-2 text-center">ارزش</th>
                                                    <th className="p-2 text-center w-12">حذف</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y">
                                                {inspectionForm.certificates?.map((c: InspectionCertificate) => (
                                                    <tr key={c.id}>
                                                        <td className="p-2">{c.company}</td>
                                                        <td className="p-2 text-center text-slate-600 font-mono">{c.certificateNumber}</td>
                                                        <td className="p-2 text-center font-bold">{c.amount?.toLocaleString()} {selectedRecord.mainCurrency}</td>
                                                        <td className="p-2 text-center">
                                                            <button onClick={() => handleDeleteInspectionCertificate(c.id)} className="text-rose-600 hover:bg-rose-50 p-1 rounded">
                                                                <Trash2 size={12} />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Inspection Payments Register */}
                                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
                                    <h3 className="text-base font-bold text-slate-800 mb-2 flex items-center gap-2 border-b pb-2">
                                        <Coins className="text-emerald-600" />
                                        هزینه‌ها و فاکتورهای ریالی شرکت بازرسی
                                    </h3>

                                    <div className="space-y-3">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-600 mb-1">هزینه کل پرداختی (ریال)</label>
                                            <input type="number" className="w-full border rounded-lg p-2 bg-slate-50 text-sm" value={newInspectionPayment.amount || ''} onChange={e => setNewInspectionPayment((p: any) => ({ ...p, amount: Number(e.target.value) }))} />
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-600 mb-1">بانک عامل و کارمزد</label>
                                                <input type="text" className="w-full border rounded-lg p-2 bg-slate-50 text-sm" value={newInspectionPayment.bank || ''} onChange={e => setNewInspectionPayment((p: any) => ({ ...p, bank: e.target.value }))} />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-600 mb-1">تاریخ پرداخت گواهی</label>
                                                <input type="text" className="w-full border rounded-lg p-2 bg-slate-50 text-sm" placeholder="۱۴۰۲/۰۹/۰۲" value={newInspectionPayment.date || ''} onChange={e => setNewInspectionPayment((p: any) => ({ ...p, date: e.target.value }))} />
                                            </div>
                                        </div>
                                        <button onClick={handleAddInspectionPayment} className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition-all shadow-sm">
                                            ثبت پرداخت هزینه بازرسی
                                        </button>
                                    </div>

                                    <div className="overflow-x-auto border rounded-lg mt-4 max-h-48 overflow-y-auto">
                                        <table className="w-full text-xs">
                                            <thead className="bg-slate-50">
                                                <tr className="border-b">
                                                    <th className="p-2 text-right">بانک واسط</th>
                                                    <th className="p-2 text-center">مبلغ ریالی</th>
                                                    <th className="p-2 text-center">تاریخ و زمان</th>
                                                    <th className="p-2 text-center w-12">حذف</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y text-slate-800">
                                                {inspectionForm.payments?.map((pay: InspectionPayment) => (
                                                    <tr key={pay.id}>
                                                        <td className="p-2 font-medium">{pay.bank || '---'}</td>
                                                        <td className="p-2 text-center font-bold text-emerald-800">{formatCurrency(pay.amount)}</td>
                                                        <td className="p-2 text-center">{pay.date || '---'}</td>
                                                        <td className="p-2 text-center">
                                                            <button onClick={() => handleDeleteInspectionPayment(pay.id)} className="text-rose-600 hover:bg-rose-50 p-1 rounded">
                                                                <Trash2 size={12} />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 7. CLEARANCE DOCS TAB */}
                        {activeTab === 'clearance_docs' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Warehouse Receipts */}
                                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
                                    <h3 className="text-base font-bold text-slate-800 mb-2 flex items-center gap-2 border-b pb-2">
                                        <Warehouse className="text-indigo-600" />
                                        قبض انبارهای گمرکی ثبت شده (Warehouse Receipts)
                                    </h3>

                                    <div className="space-y-3">
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-600 mb-1">شماره قبض انبار گمرک</label>
                                                <input type="text" className="w-full border rounded-lg p-2 bg-slate-50 text-sm" value={newWarehouseReceipt.number || ''} onChange={e => setNewWarehouseReceipt((p: any) => ({ ...p, number: e.target.value }))} />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-600 mb-1">تاریخ صدور قبض</label>
                                                <input type="text" className="w-full border rounded-lg p-2 bg-slate-50 text-sm" placeholder="۱۴۰۲/۰۹/۱۵" value={newWarehouseReceipt.issueDate || ''} onChange={e => setNewWarehouseReceipt((p: any) => ({ ...p, issueDate: e.target.value }))} />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-600 mb-1">پارت یا مرسوله مرتبط</label>
                                            <input type="text" className="w-full border rounded-lg p-2 bg-slate-50 text-sm" value={newWarehouseReceipt.part || ''} onChange={e => setNewWarehouseReceipt((p: any) => ({ ...p, part: e.target.value }))} />
                                        </div>
                                        <button onClick={handleAddWarehouseReceipt} className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs transition-all shadow-sm">
                                            ثبت رسمی قبض انبار گمرک
                                        </button>
                                    </div>

                                    <div className="overflow-x-auto border rounded-lg mt-4">
                                        <table className="w-full text-xs">
                                            <thead className="bg-slate-50">
                                                <tr className="border-b">
                                                    <th className="p-2 text-right">شماره قبض انبار</th>
                                                    <th className="p-2 text-center">تاریخ صدور</th>
                                                    <th className="p-2 text-center">بخش مرتبط</th>
                                                    <th className="p-2 text-center w-12">حذف</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y">
                                                {clearanceForm.receipts?.map((rec: WarehouseReceipt) => (
                                                    <tr key={rec.id}>
                                                        <td className="p-2 font-mono font-bold text-slate-800">{rec.number}</td>
                                                        <td className="p-2 text-center">{rec.issueDate || '---'}</td>
                                                        <td className="p-2 text-center font-bold text-slate-600">{rec.part || '---'}</td>
                                                        <td className="p-2 text-center">
                                                            <button onClick={() => handleDeleteWarehouseReceipt(rec.id)} className="text-rose-600 hover:bg-rose-50 p-1 rounded">
                                                                <Trash2 size={12} />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Clearance Payments (ریالی ترخیصکار) */}
                                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
                                    <h3 className="text-base font-bold text-slate-800 mb-2 flex items-center gap-2 border-b pb-2">
                                        <Coins className="text-blue-600" />
                                        هزینه‌های ریالی ترخیصیه بندر و قبض علی‌الحساب
                                    </h3>

                                    <div className="space-y-3">
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-600 mb-1">مبلغ هزینه (ریال)</label>
                                                <input type="number" className="w-full border rounded-lg p-2 bg-slate-50 text-sm" value={newClearancePayment.amount || ''} onChange={e => setNewClearancePayment((p: any) => ({ ...p, amount: Number(e.target.value) }))} />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-600 mb-1">پارت یا قبض انبار مرجع</label>
                                                <input type="text" className="w-full border rounded-lg p-2 bg-slate-50 text-sm" value={newClearancePayment.part || ''} onChange={e => setNewClearancePayment((p: any) => ({ ...p, part: e.target.value }))} />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-600 mb-1">بانک واریز شونده</label>
                                                <input type="text" className="w-full border rounded-lg p-2 bg-slate-50 text-sm" value={newClearancePayment.bank || ''} onChange={e => setNewClearancePayment((p: any) => ({ ...p, bank: e.target.value }))} />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-600 mb-1">تاریخ پرداخت فاکتور</label>
                                                <input type="text" className="w-full border rounded-lg p-2 bg-slate-50 text-sm" placeholder="۱۴۰۲/۰۹/۲۰" value={newClearancePayment.date || ''} onChange={e => setNewClearancePayment((p: any) => ({ ...p, date: e.target.value }))} />
                                            </div>
                                        </div>
                                        <button onClick={handleAddClearancePayment} className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs transition-all shadow-sm">
                                            ثبت هزینه پرداخت بندر/ترخیصکار
                                        </button>
                                    </div>

                                    <div className="overflow-x-auto border rounded-lg mt-4">
                                        <table className="w-full text-xs">
                                            <thead className="bg-slate-50">
                                                <tr className="border-b">
                                                    <th className="p-2 text-right">بانک مبدا</th>
                                                    <th className="p-2 text-center">مبلغ ریالی</th>
                                                    <th className="p-2 text-center font-bold">بخش</th>
                                                    <th className="p-2 text-center w-12">حذف</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y text-slate-800">
                                                {clearanceForm.payments?.map((pay: ClearancePayment) => (
                                                    <tr key={pay.id}>
                                                        <td className="p-2 font-medium">{pay.bank}</td>
                                                        <td className="p-2 text-center font-bold text-blue-800">{formatCurrency(pay.amount)}</td>
                                                        <td className="p-2 text-center">{pay.part || '---'}</td>
                                                        <td className="p-2 text-center">
                                                            <button onClick={() => handleDeleteClearancePayment(pay.id)} className="text-rose-600 hover:bg-rose-50 p-1 rounded">
                                                                <Trash2 size={12} />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 8. GREEN LEAF (گمرک و برگ سبز) */}
                        {activeTab === 'green_leaf' && (
                            <div className="space-y-6">
                                {/* 8.1 Customs Duties */}
                                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                                    <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2 border-b pb-2">
                                        <Leaf className="text-emerald-600" />
                                        حقوق ورودی گمرکی و شماره کوتاژ گمرکی (Cottage Registry)
                                    </h3>

                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end bg-slate-50 p-4 rounded-xl mb-4 text-xs font-semibold">
                                        <div>
                                            <label className="block mb-1 text-slate-700">شماره کوتاژ وارداتی گمرک</label>
                                            <input type="text" className="w-full border rounded-lg p-2 bg-white" value={newCustomsDuty.cottageNumber || ''} onChange={e => setNewCustomsDuty((p: any) => ({ ...p, cottageNumber: e.target.value }))} />
                                        </div>
                                        <div>
                                            <label className="block mb-1 text-slate-700">مجموع هزینه گمرک (ریال)</label>
                                            <input type="number" className="w-full border rounded-lg p-2 bg-white" value={newCustomsDuty.amount || ''} onChange={e => setNewCustomsDuty((p: any) => ({ ...p, amount: Number(e.target.value) }))} />
                                        </div>
                                        <div>
                                            <label className="block mb-1 text-slate-700">شیوه پرداخت عوارض</label>
                                            <select className="w-full border rounded-lg p-2 bg-white" value={newCustomsDuty.paymentMethod || 'Bank'} onChange={e => setNewCustomsDuty((p: any) => ({ ...p, paymentMethod: e.target.value }))}>
                                                <option value="Bank">پرداخت نقدی بانکی</option>
                                                <option value="Guarantee">ضمانتنامه بانکی (تعهد گمرک)</option>
                                            </select>
                                        </div>
                                        <button onClick={handleAddCustomsDuty} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs shadow-sm">
                                            ثبت حقوق ورودی کوتاژ
                                        </button>
                                    </div>

                                    <div className="overflow-x-auto border rounded-xl">
                                        <table className="w-full text-xs">
                                            <thead>
                                                <tr className="bg-slate-100 border-b">
                                                    <th className="p-3 text-right">شماره کوتاژ</th>
                                                    <th className="p-3 text-center">پرداخت حقوق ورودی (ریال)</th>
                                                    <th className="p-3 text-center">روش تصفیه</th>
                                                    <th className="p-3 text-center w-20">عملیات</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y">
                                                {greenLeafForm.duties?.map((du: GreenLeafCustomsDuty) => (
                                                    <tr key={du.id}>
                                                        <td className="p-3 font-mono font-bold text-slate-800">{du.cottageNumber}</td>
                                                        <td className="p-3 text-center font-bold text-slate-900">{formatCurrency(du.amount)}</td>
                                                        <td className="p-3 text-center">{du.paymentMethod === 'Bank' ? '🔴 پرداخت نقدی' : '🔵 ضمانتنامه بانکی'}</td>
                                                        <td className="p-3 text-center">
                                                            <button onClick={() => handleDeleteCustomsDuty(du.id)} className="text-rose-600 p-1 hover:bg-rose-50 rounded">
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* 8.2 Guarantees Registry */}
                                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                                    <h3 className="text-base font-bold text-slate-850 mb-4 flex items-center gap-2 border-b pb-2">
                                        <Shield className="text-indigo-600" />
                                        ضمانتنامه‌های مودی تعهدات گمرکی بلندمدت (Guarantees)
                                    </h3>

                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end bg-slate-50 p-4 rounded-xl mb-4 text-xs font-semibold">
                                        <div>
                                            <label className="block mb-1 text-slate-700">انتخاب کوتاژ مقصد</label>
                                            <select className="w-full border rounded-lg p-2 bg-white" value={selectedDutyForGuarantee} onChange={e => setSelectedDutyForGuarantee(e.target.value)}>
                                                <option value="">-- انتخاب شماره کوتاژ --</option>
                                                {greenLeafForm.duties?.map((d: GreenLeafCustomsDuty) => (
                                                    <option key={d.id} value={d.id}>{d.cottageNumber}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block mb-1 text-slate-700">شماره سریال ضمانتنامه</label>
                                            <input type="text" className="w-full border rounded-lg p-2 bg-white" value={newGuaranteeDetails.guaranteeNumber || ''} onChange={e => setNewGuaranteeDetails((p: any) => ({ ...p, guaranteeNumber: e.target.value }))} />
                                        </div>
                                        <div>
                                            <label className="block mb-1 text-slate-700">مبلغ ضمانت بانکی (ریال)</label>
                                            <input type="number" className="w-full border rounded-lg p-2 bg-white" value={newGuaranteeDetails.guaranteeAmount || ''} onChange={e => setNewGuaranteeDetails((p: any) => ({ ...p, guaranteeAmount: Number(e.target.value) }))} />
                                        </div>
                                        <button onClick={handleAddGuarantee} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs shadow-sm">
                                            ثبت ضمانتنامه تعهد
                                        </button>
                                    </div>

                                    <div className="overflow-x-auto border rounded-xl">
                                        <table className="w-full text-xs">
                                            <thead>
                                                <tr className="bg-slate-100 border-b">
                                                    <th className="p-3 text-right">سریال ضمانت</th>
                                                    <th className="p-3 text-center">مبلغ تعهد شده</th>
                                                    <th className="p-3 text-center">وضعیت ابطال/تحویل</th>
                                                    <th className="p-3 text-center w-12">عملیات</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y">
                                                {greenLeafForm.guarantees?.map((gu: GreenLeafGuarantee) => (
                                                    <tr key={gu.id}>
                                                        <td className="p-3 font-mono font-bold">{gu.guaranteeNumber}</td>
                                                        <td className="p-3 text-center text-indigo-800 font-extrabold">{formatCurrency(gu.guaranteeAmount)} ریال</td>
                                                        <td className="p-3 text-center">
                                                            <button onClick={() => handleToggleGuaranteeDelivery(gu.id)} className={`px-2 py-1 rounded text-[10px] font-bold ${
                                                                gu.isDelivered ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-105 text-rose-800'
                                                            }`}>
                                                                {gu.isDelivered ? 'آزاد شده / ابطالی' : 'در گرو / گمرکی'}
                                                            </button>
                                                        </td>
                                                        <td className="p-3 text-center">
                                                            <button onClick={() => handleDeleteGuarantee(gu.id)} className="text-rose-600 p-1 hover:bg-rose-50 rounded">
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* 8.3 Customs Taxes & Road Tolls */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Taxes Register */}
                                    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
                                        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b pb-2">
                                            <Shield className="text-blue-600" />
                                            مالیات ارزش افزوده گمرک و علی‌الحساب
                                        </h3>
                                        <div className="grid grid-cols-2 gap-2 items-end">
                                            <div>
                                                <label className="block text-xs font-bold mb-1 text-slate-600">ریالی مالیات پارت</label>
                                                <input type="number" className="w-full border rounded-lg p-2 bg-slate-50 text-xs" value={newTax.amount || ''} onChange={e => setNewTax((p: any) => ({ ...p, amount: Number(e.target.value) }))} />
                                            </div>
                                            <button onClick={handleAddTax} className="py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs shadow-sm">
                                                ثبت مالیات کالی
                                            </button>
                                        </div>

                                        <div className="overflow-x-auto border rounded-xl max-h-32">
                                            <table className="w-full text-[11px]">
                                                <tbody>
                                                    {greenLeafForm.taxes?.map((tx: GreenLeafTax) => (
                                                        <tr key={tx.id} className="border-b">
                                                            <td className="p-2 font-bold text-slate-800">{formatCurrency(tx.amount)} ریال</td>
                                                            <td className="p-2 text-center w-12">
                                                                <button onClick={() => handleDeleteTax(tx.id)} className="text-rose-600">حذف</button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    {/* Road Tolls Register */}
                                    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
                                        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b pb-2">
                                            <Truck className="text-emerald-600" />
                                            عوارض راه، هلال احمر و کارشناسی گمرکی
                                        </h3>
                                        <div className="grid grid-cols-2 gap-2 items-end">
                                            <div>
                                                <label className="block text-xs font-bold mb-1 text-slate-600">ریالی عوارض پارت</label>
                                                <input type="number" className="w-full border rounded-lg p-2 bg-slate-50 text-xs" value={newRoadToll.amount || ''} onChange={e => setNewRoadToll((p: any) => ({ ...p, amount: Number(e.target.value) }))} />
                                            </div>
                                            <button onClick={handleAddRoadToll} className="py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs shadow-sm">
                                                ثبت عوارض فیش
                                            </button>
                                        </div>

                                        <div className="overflow-x-auto border rounded-xl max-h-32">
                                            <table className="w-full text-[11px]">
                                                <tbody>
                                                    {greenLeafForm.roadTolls?.map((r: GreenLeafRoadToll) => (
                                                        <tr key={r.id} className="border-b">
                                                            <td className="p-2 font-bold text-slate-800">{formatCurrency(r.amount)} ریال</td>
                                                            <td className="p-2 text-center w-12">
                                                                <button onClick={() => handleDeleteRoadToll(r.id)} className="text-rose-600">حذف</button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 9. INTERNAL SHIPPING TAB */}
                        {activeTab === 'internal_shipping' && (
                            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
                                <h3 className="text-lg font-bold text-slate-800 border-b pb-3 flex items-center gap-2">
                                    <Truck className="text-blue-600" />
                                    هزینه‌ها و ترخیصیه ترابری (حمل داخلی کالا به کارخانه)
                                </h3>

                                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end bg-slate-50 p-4 rounded-xl border border-slate-100">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 mb-1">مبلغ کرایه پرداخت شده (ریال)</label>
                                        <input type="number" className="w-full bg-white border rounded-lg p-2.5 text-sm" value={newShippingPayment.amount || ''} onChange={e => setNewShippingPayment((p: any) => ({ ...p, amount: Number(e.target.value) }))} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 mb-1">بارنامه ترابری / پارت مرتبط</label>
                                        <input type="text" className="w-full bg-white border rounded-lg p-2.5 text-sm" placeholder="مثلا کانتینر شماره ۷" value={newShippingPayment.part || ''} onChange={e => setNewShippingPayment((p: any) => ({ ...p, part: e.target.value }))} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 mb-1">شرکت حمل کننده / راننده / صادر کننده</label>
                                        <input type="text" className="w-full bg-white border rounded-lg p-2.5 text-sm" placeholder="مثلا باربری خلیج فارس" value={newShippingPayment.bank || ''} onChange={e => setNewShippingPayment((p: any) => ({ ...p, bank: e.target.value }))} />
                                    </div>
                                    <button onClick={handleAddShippingPayment} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 shadow-sm">
                                        <Plus size={14} />
                                        ثبت کرایه حمل داخلی
                                    </button>
                                </div>

                                <div className="overflow-x-auto border rounded-xl">
                                    <table className="w-full text-inner">
                                        <thead>
                                            <tr className="bg-slate-50 text-slate-750 text-xs border-b">
                                                <th className="p-3 text-right">باربری حمل کننده</th>
                                                <th className="p-3 text-center">شناسه ترابری/پارت</th>
                                                <th className="p-3 text-center font-bold">کرایه تصفیه شده (ریال)</th>
                                                <th className="p-3 text-center">تاریخ تصفیه</th>
                                                <th className="p-3 text-center w-16">عملیات</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y text-sm">
                                            {internalShippingForm.payments?.map((pay: ShippingPayment) => (
                                                <tr key={pay.id} className="hover:bg-slate-50">
                                                    <td className="p-3">{pay.bank || '---'}</td>
                                                    <td className="p-3 text-center">{pay.part || '---'}</td>
                                                    <td className="p-3 text-center text-slate-900 font-extrabold">{formatCurrency(pay.amount)} ریال</td>
                                                    <td className="p-3 text-center">{pay.date || '---'}</td>
                                                    <td className="p-3 text-center">
                                                        <button onClick={() => handleDeleteShippingPayment(pay.id)} className="text-rose-600 hover:bg-rose-50 p-1 rounded-lg">
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                            {(!internalShippingForm.payments || internalShippingForm.payments.length === 0) && (
                                                <tr>
                                                    <td colSpan={5} className="p-4 text-center text-slate-400">تاکنون فیش کرایه‌ای برای ترابری جاده‌ای این پرونده ثبت نشده است.</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* 10. AGENT FEES TAB */}
                        {activeTab === 'agent_fees' && (
                            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
                                <h3 className="text-lg font-bold text-slate-800 border-b pb-3 flex items-center gap-2">
                                    <FileSpreadsheet className="text-emerald-600" />
                                    مبالغ حق‌العمل ترخیص و کارمزدهای اداری ترخیصکار (Agent Fees)
                                </h3>

                                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end bg-slate-50 p-4 rounded-xl border border-slate-100">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 mb-1">نام حق‌العمل کار / ترخیصکار</label>
                                        <input type="text" className="w-full bg-white border rounded-lg p-2.5 text-sm" value={newAgentPayment.agentName || ''} onChange={e => setNewAgentPayment((p: any) => ({ ...p, agentName: e.target.value }))} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 mb-1">کارمزد پرداخت شده (ریال)</label>
                                        <input type="number" className="w-full bg-white border rounded-lg p-2.5 text-sm" value={newAgentPayment.amount || ''} onChange={e => setNewAgentPayment((p: any) => ({ ...p, amount: Number(e.target.value) }))} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 mb-1">بابت هزینه (توضیحات)</label>
                                        <input type="text" className="w-full bg-white border rounded-lg p-2.5 text-sm" placeholder="مثلا حق‌العمل کوتاژ" value={newAgentPayment.description || ''} onChange={e => setNewAgentPayment((p: any) => ({ ...p, description: e.target.value }))} />
                                    </div>
                                    <button onClick={handleAddAgentPayment} className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1 shadow-sm">
                                        <Plus size={14} />
                                        ثبت پرداخت کارمزد
                                    </button>
                                </div>

                                <div className="overflow-x-auto border rounded-xl">
                                    <table className="w-full text-inner">
                                        <thead>
                                            <tr className="bg-slate-50 text-slate-750 text-xs border-b">
                                                <th className="p-3 text-right">نام ترخیصکار</th>
                                                <th className="p-3 text-center">شرح کارمزد</th>
                                                <th className="p-3 text-center font-bold">مبلغ کارمزد (ریال)</th>
                                                <th className="p-3 text-center">تاریخ پرداخت</th>
                                                <th className="p-3 text-center w-16">عملیات</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y text-sm">
                                            {agentForm.payments?.map((pay: AgentPayment) => (
                                                <tr key={pay.id} className="hover:bg-slate-50">
                                                    <td className="p-3 font-semibold text-slate-800">{pay.agentName}</td>
                                                    <td className="p-3 text-center text-slate-500">{pay.description || 'حق‌العمل ترخیص'}</td>
                                                    <td className="p-3 text-center font-extrabold text-slate-900">{formatCurrency(pay.amount)} ریال</td>
                                                    <td className="p-3 text-center">{pay.date || '---'}</td>
                                                    <td className="p-3 text-center">
                                                        <button onClick={() => handleDeleteAgentPayment(pay.id)} className="text-rose-600 hover:bg-rose-50 p-1 rounded-lg">
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                            {(!agentForm.payments || agentForm.payments.length === 0) && (
                                                <tr>
                                                    <td colSpan={5} className="p-4 text-center text-slate-400">تاکنون فاکتور حق‌العمل اداری برای ترخیصکار این پرونده ثبت نگردیده است.</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* 11. FINAL CALCULATION (بهای تمام شده نهایی) */}
                        {activeTab === 'final_calculation' && (
                            <div className="space-y-6">
                                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                                    <h3 className="text-lg font-bold text-slate-800 border-b pb-3 mb-4 flex items-center gap-2">
                                        <Calculator className="text-indigo-600" />
                                        آنالیز مال و برآورد بهای تمام شده نهایی پرونده
                                    </h3>

                                    {/* Calculations Table */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-6 rounded-2xl border">
                                        <div className="space-y-3">
                                            <h4 className="font-bold text-sm text-slate-600 border-b pb-1">مخارج ارز خارجی (فوب و جانبی)</h4>
                                            <div className="flex justify-between text-sm">
                                                <span>کل ارزش کالا فوب پروفرما:</span>
                                                <strong className="text-slate-800">{totalFob.toLocaleString()} {selectedRecord.mainCurrency}</strong>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span>ارز خرید ارز (در پارت‌ها):</span>
                                                <strong className="text-slate-800">
                                                    {(currencyForm.tranches?.reduce((acc: number, t: any) => acc + (t.amount || 0), 0) || 0).toLocaleString()} {selectedRecord.mainCurrency}
                                                </strong>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span>هزینه کرایه حمل بین‌المللی ارزی:</span>
                                                <strong className="text-rose-700">{(selectedRecord.freightCost || 0).toLocaleString()} {selectedRecord.mainCurrency}</strong>
                                            </div>
                                        </div>

                                        <div className="space-y-3 border-r pr-6">
                                            <h4 className="font-bold text-sm text-slate-600 border-b pb-1">هزینه‌های ریالی داخل مرز</h4>
                                            <div className="flex justify-between text-sm">
                                                <span>هزینه‌های بیمه باربری (ریال):</span>
                                                <span>{formatCurrency(selectedRecord.insuranceData?.cost || 0)}</span>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span>مالیات و عوارض و حقوق ورودی گمرکی:</span>
                                                <span>
                                                    {formatCurrency(
                                                        (greenLeafForm.duties?.reduce((acc: number, d: any) => acc + (d.amount || 0), 0) || 0) +
                                                        (greenLeafForm.taxes?.reduce((acc: number, t: any) => acc + (t.amount || 0), 0) || 0) +
                                                        (greenLeafForm.roadTolls?.reduce((acc: number, r: any) => acc + (r.amount || 0), 0) || 0)
                                                    )}
                                                </span>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span>کرایه حمل جاده‌ای داخلی (ریال):</span>
                                                <span>{formatCurrency(internalShippingForm.payments?.reduce((acc: number, p: any) => acc + (p.amount || 0), 0) || 0)}</span>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span>کارمزدهای ترخیصیه و حق‌العملکار:</span>
                                                <strong className="text-slate-850">
                                                    {formatCurrency(
                                                        (agentForm.payments?.reduce((acc: number, p: any) => acc + (p.amount || 0), 0) || 0) +
                                                        (clearanceForm.payments?.reduce((acc: number, p: any) => acc + (p.amount || 0), 0) || 0)
                                                    )}
                                                </strong>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Final Weight Math Card */}
                                    <div className="mt-6 bg-slate-900 text-slate-100 rounded-2xl p-6 flex flex-col md:flex-row justify-between items-center gap-4">
                                        <div>
                                            <h4 className="text-slate-400 font-semibold text-xs uppercase tracking-wide">برآورد بهای تمام شده تصفیه</h4>
                                            <div className="text-3xl font-black text-white mt-1">
                                                {formatCurrency(
                                                    (selectedRecord.insuranceData?.cost || 0) +
                                                    (greenLeafForm.duties?.reduce((acc: number, d: any) => acc + (d.amount || 0), 0) || 0) +
                                                    (greenLeafForm.taxes?.reduce((acc: number, t: any) => acc + (t.amount || 0), 0) || 0) +
                                                    (greenLeafForm.roadTolls?.reduce((acc: number, r: any) => acc + (r.amount || 0), 0) || 0) +
                                                    (internalShippingForm.payments?.reduce((acc: number, p: any) => acc + (p.amount || 0), 0) || 0) +
                                                    (agentForm.payments?.reduce((acc: number, p: any) => acc + (p.amount || 0), 0) || 0) +
                                                    (clearanceForm.payments?.reduce((acc: number, p: any) => acc + (p.amount || 0), 0) || 0) +
                                                    (currencyForm.tranches?.reduce((acc: number, t: any) => acc + (t.rialAmount || 0), 0) || 0)
                                                )} <span className="text-base text-slate-400">ریال</span>
                                            </div>
                                            <p className="text-xs text-slate-400 mt-1">مبنای محاسبه ریالی معامله: جمع کل ریال پارت‌های ارزی خرید شده + مخارج بندری و گمرکی داخل کشور</p>
                                        </div>

                                        <div className="shrink-0 bg-slate-800 border-r border-slate-700 px-6 py-3 rounded-xl text-center">
                                            <span className="text-[10px] text-slate-400 font-bold block mb-1">بهای تمام شده به ازای هر کیلوگرم خالص</span>
                                            <span className="text-xl font-bold text-amber-400">
                                                {totalWeight > 0 
                                                    ? formatCurrency(
                                                        Math.round(
                                                            ((selectedRecord.insuranceData?.cost || 0) +
                                                            (greenLeafForm.duties?.reduce((acc: number, d: any) => acc + (d.amount || 0), 0) || 0) +
                                                            (greenLeafForm.taxes?.reduce((acc: number, t: any) => acc + (t.amount || 0), 0) || 0) +
                                                            (greenLeafForm.roadTolls?.reduce((acc: number, r: any) => acc + (r.amount || 0), 0) || 0) +
                                                            (internalShippingForm.payments?.reduce((acc: number, p: any) => acc + (p.amount || 0), 0) || 0) +
                                                            (agentForm.payments?.reduce((acc: number, p: any) => acc + (p.amount || 0), 0) || 0) +
                                                            (clearanceForm.payments?.reduce((acc: number, p: any) => acc + (p.amount || 0), 0) || 0) +
                                                            (currencyForm.tranches?.reduce((acc: number, t: any) => acc + (t.rialAmount || 0), 0) || 0)) / totalWeight
                                                        )
                                                      )
                                                    : '0'
                                                } ریال / Kg
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                    </div>
                </div>
            </div>
        </div>
    );
};

export default DetailsView;
