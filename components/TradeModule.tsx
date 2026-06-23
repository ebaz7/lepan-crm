
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { User, TradeRecord, TradeStage, TradeItem, SystemSettings, InsuranceEndorsement, CurrencyPurchaseData, TradeTransaction, CurrencyTranche, CurrencyDelivery, TradeStageData, ShippingDocument, ShippingDocType, DocStatus, InvoiceItem, InspectionData, InspectionPayment, InspectionCertificate, ClearanceData, WarehouseReceipt, ClearancePayment, GreenLeafData, GreenLeafCustomsDuty, GreenLeafGuarantee, GreenLeafTax, GreenLeafRoadToll, InternalShippingData, ShippingPayment, AgentData, AgentPayment, PackingItem, UserRole, GuaranteeCheque } from '../types';
import { getTradeRecords, saveTradeRecord, updateTradeRecord, deleteTradeRecord, getSettings, uploadFile } from '../services/storageService';
import { generateUUID, formatCurrency, formatNumberString, deformatNumberString, parsePersianDate, formatDate, calculateDaysDiff, getStatusLabel } from '../constants';
import { Container, Plus, Search, CheckCircle2, Save, Trash2, X, Package, ArrowRight, History, Banknote, Coins, Wallet, FileSpreadsheet, Shield, LayoutDashboard, Printer, FileDown, Paperclip, Building2, FolderOpen, Home, Calculator, FileText, Microscope, ListFilter, Warehouse, Calendar as CalendarIcon, PieChart, BarChart, Clock, Leaf, Scale, ShieldCheck, Percent, Truck, CheckSquare, Square, ToggleLeft, ToggleRight, DollarSign, UserCheck, Check, Archive, AlertCircle, RefreshCw, Box, Loader2, Share2, ChevronLeft, ChevronRight, ExternalLink, CalendarDays, Info, ArrowLeftRight, Edit2, Edit, Undo2 } from 'lucide-react';
import { apiCall } from '../services/apiService';
import { downloadAndOpenFile } from '../services/fileService';
import AllocationReport from './AllocationReport';
import CurrencyReport from './reports/CurrencyReport';
import CompanyPerformanceReport from './reports/CompanyPerformanceReport';
import PrintFinalCostReport from './print/PrintFinalCostReport';
import PrintClearanceDeclaration from './print/PrintClearanceDeclaration';
import PrintProforma from './print/PrintProforma';
import InsuranceLedgerReport from './reports/InsuranceLedgerReport';
import GuaranteeReport from './reports/GuaranteeReport';
import InsuranceTab from './InsuranceTab';
import CurrencyGuaranteeSection from './trade/CurrencyGuaranteeSection';

interface TradeModuleProps {
    currentUser: User;
}

const STAGES = Object.values(TradeStage);
const CURRENCIES = [
    { code: 'EUR', label: 'یورو (€)' },
    { code: 'USD', label: 'دلار ($)' },
    { code: 'AED', label: 'درهم (AED)' },
    { code: 'CNY', label: 'یوان (¥)' },
    { code: 'TRY', label: 'لیر (₺)' },
];

type ReportType = 'general' | 'allocation_queue' | 'allocated' | 'currency' | 'insurance' | 'shipping' | 'inspection' | 'clearance' | 'green_leaf' | 'company_performance' | 'insurance_ledger' | 'guarantee';

const TradeModule: React.FC<TradeModuleProps> = ({ currentUser }) => {
    const [records, setRecords] = useState<TradeRecord[]>([]);
    const [selectedRecord, setSelectedRecord] = useState<TradeRecord | null>(null);
    const [commodityGroups, setCommodityGroups] = useState<string[]>([]);
    const [availableBanks, setAvailableBanks] = useState<string[]>([]);
    const [operatingBanks, setOperatingBanks] = useState<string[]>([]);
    const [availableCompanies, setAvailableCompanies] = useState<string[]>([]);
    const [settings, setSettingsData] = useState<SystemSettings | null>(null);

    const [navLevel, setNavLevel] = useState<'ROOT' | 'COMPANY' | 'GROUP'>('ROOT');
    const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
    const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
    const [showArchived, setShowArchived] = useState(false);

    const [viewMode, setViewMode] = useState<'dashboard' | 'details' | 'reports'>('dashboard');
    const [activeReport, setActiveReport] = useState<ReportType>('general');
    const [reportFilterCompany, setReportFilterCompany] = useState<string>('');
    const [reportSearchTerm, setReportSearchTerm] = useState<string>('');
    const [searchTerm, setSearchTerm] = useState('');
    
    // Modal & Form States
    const [showNewModal, setShowNewModal] = useState(false);
    const [newFileNumber, setNewFileNumber] = useState('');
    const [newGoodsName, setNewGoodsName] = useState('');
    const [newSellerName, setNewSellerName] = useState('');
    const [newCommodityGroup, setNewCommodityGroup] = useState('');
    const [newMainCurrency, setNewMainCurrency] = useState('EUR');
    const [newRecordCompany, setNewRecordCompany] = useState('');
    
    const [activeTab, setActiveTab] = useState<'timeline' | 'proforma' | 'insurance' | 'currency_purchase' | 'shipping_docs' | 'inspection' | 'clearance_docs' | 'green_leaf' | 'internal_shipping' | 'agent_fees' | 'final_calculation'>('timeline');
    
    const [showEditMetadataModal, setShowEditMetadataModal] = useState(false);
    const [editMetadataForm, setEditMetadataForm] = useState<Partial<TradeRecord>>({});

    const [editingStage, setEditingStage] = useState<TradeStage | null>(null);
    const [stageFormData, setStageFormData] = useState<Partial<TradeStageData>>({});
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadingStageFile, setUploadingStageFile] = useState(false);

    const [newItem, setNewItem] = useState<Partial<TradeItem> & { weightStr?: string, unitPriceStr?: string }>({ name: '', weight: 0, unitPrice: 0, totalPrice: 0, hsCode: '', weightStr: '', unitPriceStr: '' });
    const [editingItemId, setEditingItemId] = useState<string | null>(null);

    const [insuranceForm, setInsuranceForm] = useState<NonNullable<TradeRecord['insuranceData']>>({ policyNumber: '', company: '', cost: 0, bank: '', endorsements: [], isPaid: false, paymentDate: '' });
    const [newEndorsement, setNewEndorsement] = useState<Partial<InsuranceEndorsement>>({ amount: 0, description: '', date: '' });
    const [endorsementType, setEndorsementType] = useState<'increase' | 'refund'>('increase');
    
    const [inspectionForm, setInspectionForm] = useState<InspectionData>({ certificates: [], payments: [] });
    const [newInspectionCertificate, setNewInspectionCertificate] = useState<Partial<InspectionCertificate>>({ part: '', company: '', certificateNumber: '', amount: 0 });
    const [newInspectionPayment, setNewInspectionPayment] = useState<Partial<InspectionPayment>>({ part: '', amount: 0, date: '', bank: '' });

    const [clearanceForm, setClearanceForm] = useState<ClearanceData>({ receipts: [], payments: [] });
    const [newWarehouseReceipt, setNewWarehouseReceipt] = useState<Partial<WarehouseReceipt>>({ number: '', part: '', issueDate: '' });
    const [newClearancePayment, setNewClearancePayment] = useState<Partial<ClearancePayment>>({ amount: 0, part: '', bank: '', date: '', payingBank: '' });

    const [greenLeafForm, setGreenLeafForm] = useState<GreenLeafData>({ duties: [], guarantees: [], taxes: [], roadTolls: [] });
    const [newCustomsDuty, setNewCustomsDuty] = useState<Partial<GreenLeafCustomsDuty>>({ cottageNumber: '', part: '', amount: 0, paymentMethod: 'Bank', bank: '', date: '' });
    const [newGuaranteeDetails, setNewGuaranteeDetails] = useState<Partial<GreenLeafGuarantee>>({ guaranteeNumber: '', sepamNumber: '', guaranteeBank: '', chequeNumber: '', chequeBank: '', chequeDate: '', cashAmount: 0, dutyCashAmount: 0, cashBank: '', cashDate: '', chequeAmount: 0 });
    const [selectedDutyForGuarantee, setSelectedDutyForGuarantee] = useState<string>('');
    const [newTax, setNewTax] = useState<Partial<GreenLeafTax>>({ part: '', amount: 0, bank: '', date: '' });
    const [newRoadToll, setNewRoadToll] = useState<Partial<GreenLeafRoadToll>>({ part: '', amount: 0, bank: '', date: '' });

    const [internalShippingForm, setInternalShippingForm] = useState<InternalShippingData>({ payments: [] });
    const [newShippingPayment, setNewShippingPayment] = useState<Partial<ShippingPayment>>({ part: '', amount: 0, date: '', bank: '', description: '' });

    const [agentForm, setAgentForm] = useState<AgentData>({ payments: [] });
    const [newAgentPayment, setNewAgentPayment] = useState<Partial<AgentPayment>>({ agentName: '', amount: 0, bank: '', date: '', part: '', description: '' });

    const [newLicenseTx, setNewLicenseTx] = useState<Partial<TradeTransaction>>({ amount: 0, bank: '', date: '', description: 'هزینه ثبت سفارش' });

    const [currencyForm, setCurrencyForm] = useState<CurrencyPurchaseData>({
        payments: [], purchasedAmount: 0, purchasedCurrencyType: '', purchaseDate: '', brokerName: '', exchangeName: '', deliveredAmount: 0, deliveredCurrencyType: '', deliveryDate: '', recipientName: '', remittedAmount: 0, isDelivered: false, tranches: [], guaranteeCheque: undefined, guaranteeCheques: []
    });
    
    // Using Omit to avoid type conflict with returnAmount (number vs string for input)
    const [newCurrencyTranche, setNewCurrencyTranche] = useState<Omit<Partial<CurrencyTranche>, 'returnAmount'> & { returnAmount?: string, returnDate?: string, amountStr?: string, rialAmountStr?: string, receivedAmountStr?: string, currencyFeeStr?: string }>({ 
        amount: 0, 
        currencyType: 'EUR', 
        date: '', 
        exchangeName: '', 
        brokerName: '', 
        isDelivered: false, 
        deliveryDate: '',
        returnAmount: '',
        returnDate: '',
        receivedAmount: 0,
        amountStr: '',
        rialAmountStr: '',
        receivedAmountStr: '',
        currencyFeeStr: ''
    });
    const [editingTrancheId, setEditingTrancheId] = useState<string | null>(null);
    const [selectedTrancheForDeliveries, setSelectedTrancheForDeliveries] = useState<string | null>(null);
    const [newDeliveryForm, setNewDeliveryForm] = useState<{
        amount: string | number;
        date: string;
        recipientName: string;
        description: string;
    }>({
        amount: '',
        date: '',
        recipientName: '',
        description: ''
    });
    // We now use multiple currency guarantees array in currencyForm.guaranteeCheques

    const [activeShippingSubTab, setActiveShippingSubTab] = useState<ShippingDocType>('Commercial Invoice');
    const [shippingDocForm, setShippingDocForm] = useState<Partial<ShippingDocument>>({
        status: 'Draft',
        documentNumber: '',
        documentDate: '',
        attachments: [],
        invoiceItems: [],
        packingItems: [],
        freightCost: 0
    });
    const [newInvoiceItem, setNewInvoiceItem] = useState<Partial<InvoiceItem>>({ name: '', weight: 0, unitPrice: 0, totalPrice: 0, part: '' });
    const [newPackingItem, setNewPackingItem] = useState<Partial<PackingItem>>({ description: '', netWeight: 0, grossWeight: 0, packageCount: 0, part: '' });
    const [uploadingDocFile, setUploadingDocFile] = useState(false);
    const docFileInputRef = useRef<HTMLInputElement>(null);

    const [calcExchangeRate, setCalcExchangeRate] = useState<number>(0);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [showFinalReportPrint, setShowFinalReportPrint] = useState(false);
    
    const [showClearancePrint, setShowClearancePrint] = useState(false);
    const [showProformaPrint, setShowProformaPrint] = useState(false);
    const [sharePlatform, setSharePlatform] = useState<'whatsapp' | 'bale' | 'telegram' | null>(null);
    const [contactSearch, setContactSearch] = useState('');
    const [allContacts, setAllContacts] = useState<any[]>([]);

    // Filter banks based on the selected company
    const companySpecificBanks = useMemo(() => {
        const fallbacks = ['ملی', 'ملت', 'تجارت', 'صادرات', 'سپه', 'سامان', 'پارسیان', 'پاسارگاد', 'کارآفرین', 'سینا', 'شهر', 'مسکن', 'کشاورزی', 'توسعه صادرات', 'صنعت و معدن', 'خاورمیانه', 'رفاه'];
        if (!settings) return fallbacks;
        if (selectedRecord) {
            const targetCompany = settings.companies?.find(c => c.name === selectedRecord.company);
            if (targetCompany && targetCompany.banks && targetCompany.banks.length > 0) {
                return targetCompany.banks.map(b => b.bankName);
            }
        }
        if (availableBanks && availableBanks.length > 0) {
            return availableBanks;
        }
        return fallbacks;
    }, [selectedRecord, settings, availableBanks]);

    useEffect(() => {
        const hasActiveModal = showNewModal || showEditMetadataModal || !!editingStage || !!selectedTrancheForDeliveries;
        const needsCustomBack = hasActiveModal || viewMode !== 'dashboard' || navLevel !== 'ROOT';

        if (needsCustomBack) {
            const handleBack = () => {
                if (selectedTrancheForDeliveries) {
                    setSelectedTrancheForDeliveries(null);
                } else if (showNewModal) {
                    setShowNewModal(false);
                } else if (showEditMetadataModal) {
                    setShowEditMetadataModal(false);
                } else if (editingStage) {
                    setEditingStage(null);
                } else if (viewMode !== 'dashboard') {
                    setViewMode('dashboard');
                } else if (navLevel === 'GROUP') {
                    setNavLevel('COMPANY');
                    setSelectedGroup(null);
                } else if (navLevel === 'COMPANY') {
                    setNavLevel('ROOT');
                    setSelectedCompany(null);
                    setSelectedGroup(null);
                }
            };
            window.dispatchEvent(new CustomEvent('REGISTER_BACK_ACTION', { detail: handleBack }));
        } else {
            window.dispatchEvent(new CustomEvent('UNREGISTER_BACK_ACTION'));
        }
        return () => {
            window.dispatchEvent(new CustomEvent('UNREGISTER_BACK_ACTION'));
        };
    }, [showNewModal, showEditMetadataModal, editingStage, viewMode, navLevel, selectedCompany, selectedTrancheForDeliveries]);

    useEffect(() => {
        loadRecords();
        getSettings().then(s => {
            setSettingsData(s);
            setCommodityGroups(s.commodityGroups || []);
            setAvailableBanks(s.bankNames || []);
            setOperatingBanks(s.operatingBankNames || []);
            setAvailableCompanies(s.companyNames || []);
            setNewRecordCompany(s.defaultCompany || '');
            
            // Load contacts for sharing
            const c = s.savedContacts || [];
            const sales = s.salesContacts || [];
            setAllContacts([
                ...c.map(x => ({ ...x, type: 'Technical' })),
                ...sales.map(x => ({ id: x.id, name: x.name, number: x.mobile, chatId: x.baleId || x.telegramId, platform: x.baleId ? 'Bale' : 'Telegram', type: 'Customer' }))
            ]);
        });
    }, []);

    useEffect(() => {
        if (selectedRecord) {
            const insData = selectedRecord.insuranceData || { policyNumber: '', company: '', cost: 0, bank: '', endorsements: [], isPaid: false, paymentDate: '' };
            setInsuranceForm({
                policyNumber: insData.policyNumber || '',
                company: insData.company || '',
                cost: insData.cost || 0,
                bank: insData.bank || '',
                endorsements: insData.endorsements || [],
                isPaid: !!insData.isPaid,
                paymentDate: insData.paymentDate || ''
            });

            const inspData = selectedRecord.inspectionData || { certificates: [], payments: [] };
            const certificates = inspData.certificates || [];
            if (certificates.length === 0 && inspData.certificateNumber) {
                 certificates.push({ id: generateUUID(), part: 'Original', certificateNumber: inspData.certificateNumber, company: inspData.inspectionCompany || '', amount: inspData.totalInvoiceAmount || 0 });
            }
            setInspectionForm({
                certificates: certificates,
                payments: inspData.payments || []
            });

            const clrData = selectedRecord.clearanceData || { receipts: [], payments: [] };
            setClearanceForm({
                receipts: clrData.receipts || [],
                payments: clrData.payments || []
            });

            const glData = selectedRecord.greenLeafData || { duties: [], guarantees: [], taxes: [], roadTolls: [] };
            setGreenLeafForm({
                duties: glData.duties || [],
                guarantees: glData.guarantees || [],
                taxes: glData.taxes || [],
                roadTolls: glData.roadTolls || []
            });

            const isData = selectedRecord.internalShippingData || { payments: [] };
            setInternalShippingForm({
                payments: isData.payments || []
            });

            const agData = selectedRecord.agentData || { payments: [] };
            setAgentForm({
                payments: agData.payments || []
            });

            const curData = (selectedRecord.currencyPurchaseData || {}) as CurrencyPurchaseData;
            setCurrencyForm({
                payments: curData.payments || [],
                purchasedAmount: curData.purchasedAmount || 0,
                purchasedCurrencyType: curData.purchasedCurrencyType || selectedRecord.mainCurrency || 'EUR',
                tranches: curData.tranches || [],
                isDelivered: !!curData.isDelivered,
                deliveredAmount: curData.deliveredAmount || 0,
                remittedAmount: curData.remittedAmount || 0,
                guaranteeCheque: curData.guaranteeCheque,
                guaranteeCheques: curData.guaranteeCheques || (curData.guaranteeCheque ? [curData.guaranteeCheque] : []),
                purchaseDate: curData.purchaseDate || '',
                brokerName: curData.brokerName || '',
                exchangeName: curData.exchangeName || '',
                deliveryDate: curData.deliveryDate || '',
                recipientName: curData.recipientName || '',
                deliveredCurrencyType: curData.deliveredCurrencyType || ''
            });
            
            setCalcExchangeRate(selectedRecord.exchangeRate || 0);
            
            setNewLicenseTx({ amount: 0, bank: '', date: '', description: 'هزینه ثبت سفارش' });
            setNewCurrencyTranche({ amount: 0, currencyType: selectedRecord.mainCurrency || 'EUR', date: '', exchangeName: '', brokerName: '', isDelivered: false, returnAmount: '', returnDate: '', receivedAmount: 0, amountStr: '', rialAmountStr: '', receivedAmountStr: '', currencyFeeStr: '' });
            setEditingTrancheId(null);
            setNewItem({ name: '', weight: 0, unitPrice: 0, totalPrice: 0, hsCode: '', weightStr: '', unitPriceStr: '' });
            setEditingItemId(null);
            setNewInspectionPayment({ part: '', amount: 0, date: '', bank: '' });
            setNewInspectionCertificate({ part: '', company: '', certificateNumber: '', amount: 0 });
            setNewWarehouseReceipt({ number: '', part: '', issueDate: '' });
            setNewClearancePayment({ amount: 0, part: '', bank: '', date: '', payingBank: '' });
            setNewCustomsDuty({ cottageNumber: '', part: '', amount: 0, paymentMethod: 'Bank', bank: '', date: '' });
            setNewGuaranteeDetails({ guaranteeNumber: '', sepamNumber: '', guaranteeBank: '', chequeNumber: '', chequeBank: '', chequeDate: '', cashAmount: 0, cashBank: '', cashDate: '', chequeAmount: 0 });
            setNewTax({ part: '', amount: 0, bank: '', date: '' });
            setNewRoadToll({ part: '', amount: 0, bank: '', date: '' });
            setNewShippingPayment({ part: '', amount: 0, date: '', bank: '', description: '' });
            setNewAgentPayment({ agentName: '', amount: 0, bank: '', date: '', part: '', description: '' });
            setShippingDocForm({ status: 'Draft', documentNumber: '', documentDate: '', attachments: [], currency: selectedRecord.mainCurrency || 'EUR', invoiceItems: [], packingItems: [], freightCost: 0 });
            setNewInvoiceItem({ name: '', weight: 0, unitPrice: 0, totalPrice: 0, part: '' });
            setNewPackingItem({ description: '', netWeight: 0, grossWeight: 0, packageCount: 0, part: '' });
        }
    }, [selectedRecord]);

    const loadRecords = async () => { 
        try {
            const data = await getTradeRecords(); 
            // Safety Check: Ensure records is always an array
            setRecords(Array.isArray(data) ? data : []); 
        } catch (e) {
            console.error("Error loading trade records", e);
            setRecords([]);
        }
    };

    const goRoot = () => { setNavLevel('ROOT'); setSelectedCompany(null); setSelectedGroup(null); setSearchTerm(''); };
    const goCompany = (company: string) => { setSelectedCompany(company); setNavLevel('COMPANY'); setSelectedGroup(null); setSearchTerm(''); };
    const goGroup = (group: string) => { setSelectedGroup(group); setNavLevel('GROUP'); setSearchTerm(''); };

    // SAFE RECORDS ACCESS
    const safeRecords = Array.isArray(records) ? records : [];

    const groupedData = useMemo(() => {
        const currentRecords = safeRecords.filter(r => showArchived ? r.isArchived : !r.isArchived);
        if (navLevel === 'ROOT') {
            const companies: Record<string, number> = {};
            currentRecords.forEach(r => { const c = r.company || 'بدون شرکت'; companies[c] = (companies[c] || 0) + 1; });
            return Object.entries(companies).map(([name, count]) => ({ name, count, type: 'company' }));
        } else if (navLevel === 'COMPANY') {
            const groups: Record<string, number> = {};
            currentRecords.filter(r => (r.company || 'بدون شرکت') === selectedCompany).forEach(r => { const g = r.commodityGroup || 'سایر'; groups[g] = (groups[g] || 0) + 1; });
            return Object.entries(groups).map(([name, count]) => ({ name, count, type: 'group' }));
        }
        return [];
    }, [safeRecords, showArchived, navLevel, selectedCompany]);

    const getStageData = (record: TradeRecord | null, stage: TradeStage): TradeStageData => {
        if (!record || !record.stages) return { stage, isCompleted: false, description: '', costRial: 0, costCurrency: 0, currencyType: 'EUR', attachments: [], updatedAt: 0, updatedBy: '' };
        return record.stages[stage] || { stage, isCompleted: false, description: '', costRial: 0, costCurrency: 0, currencyType: 'EUR', attachments: [], updatedAt: 0, updatedBy: '' };
    };

    // --- HANDLERS ---
    const isDuplicateTradeRecord = (company: string, fileNumber: string, registrationNumber: string, goodsName: string, excludeId?: string) => {
        const safeCompany = (company || '').trim().toLowerCase();
        const safeFileNumber = (fileNumber || '').trim().toLowerCase();
        const safeRegistrationNumber = (registrationNumber || '').trim().toLowerCase();
        const safeGoodsName = (goodsName || '').trim().toLowerCase();
        
        return (records || []).some(r => {
            if (excludeId && r.id === excludeId) return false;
            return (r.company || '').trim().toLowerCase() === safeCompany &&
                   (r.fileNumber || '').trim().toLowerCase() === safeFileNumber &&
                   (r.registrationNumber || '').trim().toLowerCase() === safeRegistrationNumber &&
                   (r.goodsName || '').trim().toLowerCase() === safeGoodsName;
        });
    };

    const handleCreateRecord = async () => { 
        if (!newFileNumber || !newGoodsName || !newRecordCompany) return; 
        
        if (isDuplicateTradeRecord(newRecordCompany, newFileNumber, '', newGoodsName)) {
            alert('خطا: پرونده دیگری با همین مشخصات (نام شرکت، شماره پروفرما و نام کالا) قبلاً ثبت شده است.');
            return;
        }

        const newRecord: TradeRecord = { 
            id: generateUUID(), 
            company: newRecordCompany, 
            fileNumber: newFileNumber, 
            orderNumber: newFileNumber, 
            goodsName: newGoodsName, 
            registrationNumber: '', 
            sellerName: newSellerName, 
            commodityGroup: newCommodityGroup, 
            mainCurrency: newMainCurrency, 
            items: [], 
            freightCost: 0, 
            startDate: new Date().toISOString(), 
            status: 'Active', 
            stages: {}, 
            createdAt: Date.now(), 
            createdBy: currentUser.fullName, 
            licenseData: { transactions: [] }, 
            shippingDocuments: [] 
        }; 
        
        STAGES.forEach(stage => { 
            newRecord.stages[stage] = { 
                stage, 
                isCompleted: false, 
                description: '', 
                costRial: 0, 
                costCurrency: 0, 
                currencyType: newMainCurrency, 
                attachments: [], 
                updatedAt: Date.now(), 
                updatedBy: '' 
            }; 
        }); 
        
        await saveTradeRecord(newRecord); 
        await loadRecords(); 
        setShowNewModal(false); 
        setNewFileNumber(''); 
        setNewGoodsName(''); 
        setSelectedRecord(newRecord); 
        setActiveTab('proforma'); 
        setViewMode('details'); 
    };

    const handleDeleteRecord = async (id: string, e: React.MouseEvent) => { 
        e.stopPropagation(); 
        if (confirm("آیا از حذف این پرونده بازرگانی اطمینان دارید؟")) { 
            await deleteTradeRecord(id); 
            if (selectedRecord?.id === id) setSelectedRecord(null); 
            loadRecords(); 
        } 
    };

    const handleUpdateProforma = async (field: keyof TradeRecord, value: string | number) => { 
        if (!selectedRecord) return; 
        
        if (['company', 'fileNumber', 'goodsName', 'registrationNumber'].includes(field as string)) {
            const companyName = (field === 'company' ? value : (selectedRecord.company || '')) as string;
            const fileNo = (field === 'fileNumber' ? value : (selectedRecord.fileNumber || '')) as string;
            const regNo = (field === 'registrationNumber' ? value : (selectedRecord.registrationNumber || '')) as string;
            const gName = (field === 'goodsName' ? value : (selectedRecord.goodsName || '')) as string;
            
            if (isDuplicateTradeRecord(companyName, fileNo, regNo, gName, selectedRecord.id)) {
                alert("خطا: امکان ذخیره وجود ندارد. پرونده دیگری با همین مشخصات (نام شرکت، شماره پرووفرما، شماره ثبت سفارش و نام کالا) قبلاً ثبت شده است.");
                return;
            }
        }

        const updatedRecord = { ...selectedRecord, [field]: value }; 
        setSelectedRecord(updatedRecord); 
        await updateTradeRecord(updatedRecord); 
        setRecords(prev => prev.map(r => r.id === updatedRecord.id ? updatedRecord : r)); 
    };
    
    const handleAddItem = async () => { 
        if (!selectedRecord || !newItem.name) return; 
        const weightVal = newItem.weightStr ? deformatNumberString(newItem.weightStr) : 0; 
        
        // Use unitPriceStr as "FOB Amount" (Total Price) if provided, otherwise use unitPrice * weight
        const fobVal = newItem.unitPriceStr ? deformatNumberString(newItem.unitPriceStr) : 0;
        
        const unitPriceVal = weightVal > 0 ? fobVal / weightVal : 0;
        const totalVal = fobVal;

        const item: TradeItem = { 
            id: editingItemId || generateUUID(), 
            name: newItem.name, 
            weight: weightVal, 
            unitPrice: unitPriceVal, 
            totalPrice: totalVal, 
            hsCode: newItem.hsCode 
        }; 
        
        let updatedItems = []; 
        if (editingItemId) { 
            updatedItems = selectedRecord.items.map(i => i.id === editingItemId ? item : i); 
        } else { 
            updatedItems = [...selectedRecord.items, item]; 
        } 
        
        const updatedRecord = { ...selectedRecord, items: updatedItems }; 
        await updateTradeRecord(updatedRecord); 
        setSelectedRecord(updatedRecord); 
        setRecords(prev => prev.map(r => r.id === updatedRecord.id ? updatedRecord : r)); 
        setNewItem({ name: '', weight: 0, unitPrice: 0, totalPrice: 0, hsCode: '', weightStr: '', unitPriceStr: '' }); 
        setEditingItemId(null); 
    };
    const handleEditItem = (item: TradeItem) => { setNewItem({ name: item.name, weight: item.weight, weightStr: formatNumberString(item.weight), unitPrice: item.unitPrice, unitPriceStr: formatNumberString(item.unitPrice), totalPrice: item.totalPrice, hsCode: item.hsCode || '' }); setEditingItemId(item.id); };
    const handleRemoveItem = async (id: string) => { if (!selectedRecord) return; const updatedItems = selectedRecord.items.filter(i => i.id !== id); const updatedRecord = { ...selectedRecord, items: updatedItems }; await updateTradeRecord(updatedRecord); setSelectedRecord(updatedRecord); };
    const handleAddLicenseTx = async () => { if (!selectedRecord || !newLicenseTx.amount) return; const tx: TradeTransaction = { id: generateUUID(), date: newLicenseTx.date || '', amount: Number(newLicenseTx.amount), bank: newLicenseTx.bank || '', description: newLicenseTx.description || '' }; const currentLicenseData = selectedRecord.licenseData || { transactions: [] }; const updatedTransactions = [...(currentLicenseData.transactions || []), tx]; const updatedRecord = { ...selectedRecord, licenseData: { ...currentLicenseData, transactions: updatedTransactions } }; const totalCost = updatedTransactions.reduce((acc, t) => acc + t.amount, 0); if (!updatedRecord.stages[TradeStage.LICENSES]) updatedRecord.stages[TradeStage.LICENSES] = getStageData(updatedRecord, TradeStage.LICENSES); updatedRecord.stages[TradeStage.LICENSES].costRial = totalCost; updatedRecord.stages[TradeStage.LICENSES].isCompleted = totalCost > 0; await updateTradeRecord(updatedRecord); setSelectedRecord(updatedRecord); setNewLicenseTx({ amount: 0, bank: '', date: '', description: 'هزینه ثبت سفارش' }); };
    const handleRemoveLicenseTx = async (id: string) => { if (!selectedRecord) return; const currentLicenseData = selectedRecord.licenseData || { transactions: [] }; const updatedTransactions = (currentLicenseData.transactions || []).filter(t => t.id !== id); const updatedRecord = { ...selectedRecord, licenseData: { ...currentLicenseData, transactions: updatedTransactions } }; const totalCost = updatedTransactions.reduce((acc, t) => acc + t.amount, 0); if (!updatedRecord.stages[TradeStage.LICENSES]) updatedRecord.stages[TradeStage.LICENSES] = getStageData(updatedRecord, TradeStage.LICENSES); updatedRecord.stages[TradeStage.LICENSES].costRial = totalCost; await updateTradeRecord(updatedRecord); setSelectedRecord(updatedRecord); };
    const handleSaveInsurance = async () => { if (!selectedRecord) return; const updatedRecord = { ...selectedRecord, insuranceData: insuranceForm }; const totalCost = (Number(insuranceForm.cost) || 0) + (insuranceForm.endorsements || []).reduce((acc, e) => acc + e.amount, 0); if (!updatedRecord.stages[TradeStage.INSURANCE]) updatedRecord.stages[TradeStage.INSURANCE] = getStageData(updatedRecord, TradeStage.INSURANCE); updatedRecord.stages[TradeStage.INSURANCE].costRial = totalCost; updatedRecord.stages[TradeStage.INSURANCE].isCompleted = !!insuranceForm.policyNumber; await updateTradeRecord(updatedRecord); setSelectedRecord(updatedRecord); alert("اطلاعات بیمه ذخیره شد."); };
    const handleAddEndorsement = async () => { if (!selectedRecord || !newEndorsement.amount) return; const amount = endorsementType === 'increase' ? Number(newEndorsement.amount) : -Number(newEndorsement.amount); const endorsement: InsuranceEndorsement = { id: generateUUID(), date: newEndorsement.date || '', amount: amount, description: newEndorsement.description || '' }; const updatedEndorsements = [...(insuranceForm.endorsements || []), endorsement]; const updatedForm = { ...insuranceForm, endorsements: updatedEndorsements }; setInsuranceForm(updatedForm); setNewEndorsement({ amount: 0, description: '', date: '' }); const updatedRecord = { ...selectedRecord, insuranceData: updatedForm }; const totalCost = (Number(updatedForm.cost) || 0) + (updatedForm.endorsements || []).reduce((acc, e) => acc + e.amount, 0); if (!updatedRecord.stages[TradeStage.INSURANCE]) updatedRecord.stages[TradeStage.INSURANCE] = getStageData(updatedRecord, TradeStage.INSURANCE); updatedRecord.stages[TradeStage.INSURANCE].costRial = totalCost; updatedRecord.stages[TradeStage.INSURANCE].isCompleted = !!updatedForm.policyNumber; await updateTradeRecord(updatedRecord); setSelectedRecord(updatedRecord); };
    const handleDeleteEndorsement = async (id: string) => { if (!selectedRecord) return; const updatedEndorsements = (insuranceForm.endorsements || []).filter(e => e.id !== id); const updatedForm = { ...insuranceForm, endorsements: updatedEndorsements }; setInsuranceForm(updatedForm); const updatedRecord = { ...selectedRecord, insuranceData: updatedForm }; const totalCost = (Number(updatedForm.cost) || 0) + (updatedForm.endorsements || []).reduce((acc, e) => acc + e.amount, 0); if (!updatedRecord.stages[TradeStage.INSURANCE]) updatedRecord.stages[TradeStage.INSURANCE] = getStageData(updatedRecord, TradeStage.INSURANCE); updatedRecord.stages[TradeStage.INSURANCE].costRial = totalCost; updatedRecord.stages[TradeStage.INSURANCE].isCompleted = !!updatedForm.policyNumber; await updateTradeRecord(updatedRecord); setSelectedRecord(updatedRecord); };
    const handleAddInspectionCertificate = async () => { if (!selectedRecord || !newInspectionCertificate.amount) return; const cert: InspectionCertificate = { id: generateUUID(), part: newInspectionCertificate.part || 'Part', company: newInspectionCertificate.company || '', certificateNumber: newInspectionCertificate.certificateNumber || '', amount: Number(newInspectionCertificate.amount), description: '' }; const updatedCertificates = [...(inspectionForm.certificates || []), cert]; const updatedData = { ...inspectionForm, certificates: updatedCertificates }; setInspectionForm(updatedData); setNewInspectionCertificate({ part: '', company: '', certificateNumber: '', amount: 0 }); const updatedRecord = { ...selectedRecord, inspectionData: updatedData }; if (!updatedRecord.stages[TradeStage.INSPECTION]) updatedRecord.stages[TradeStage.INSPECTION] = getStageData(updatedRecord, TradeStage.INSPECTION); updatedRecord.stages[TradeStage.INSPECTION].isCompleted = updatedCertificates.length > 0; await updateTradeRecord(updatedRecord); setSelectedRecord(updatedRecord); };
    const handleDeleteInspectionCertificate = async (id: string) => { if (!selectedRecord) return; const updatedCertificates = (inspectionForm.certificates || []).filter(c => c.id !== id); const updatedData = { ...inspectionForm, certificates: updatedCertificates }; setInspectionForm(updatedData); const updatedRecord = { ...selectedRecord, inspectionData: updatedData }; await updateTradeRecord(updatedRecord); setSelectedRecord(updatedRecord); };
    const handleAddInspectionPayment = async () => { if (!selectedRecord || !newInspectionPayment.amount) return; const payment: InspectionPayment = { id: generateUUID(), part: newInspectionPayment.part || 'Part', amount: Number(newInspectionPayment.amount), date: newInspectionPayment.date || '', bank: newInspectionPayment.bank || '', description: '' }; const updatedPayments = [...(inspectionForm.payments || []), payment]; const updatedData = { ...inspectionForm, payments: updatedPayments }; setInspectionForm(updatedData); setNewInspectionPayment({ part: '', amount: 0, date: '', bank: '' }); const updatedRecord = { ...selectedRecord, inspectionData: updatedData }; if (!updatedRecord.stages[TradeStage.INSPECTION]) updatedRecord.stages[TradeStage.INSPECTION] = getStageData(updatedRecord, TradeStage.INSPECTION); updatedRecord.stages[TradeStage.INSPECTION].costRial = updatedPayments.reduce((acc, p) => acc + p.amount, 0); await updateTradeRecord(updatedRecord); setSelectedRecord(updatedRecord); };
    const handleDeleteInspectionPayment = async (id: string) => { if (!selectedRecord) return; const updatedPayments = (inspectionForm.payments || []).filter(p => p.id !== id); const updatedData = { ...inspectionForm, payments: updatedPayments }; setInspectionForm(updatedData); const updatedRecord = { ...selectedRecord, inspectionData: updatedData }; if (!updatedRecord.stages[TradeStage.INSPECTION]) updatedRecord.stages[TradeStage.INSPECTION] = getStageData(updatedRecord, TradeStage.INSPECTION); updatedRecord.stages[TradeStage.INSPECTION].costRial = updatedPayments.reduce((acc, p) => acc + p.amount, 0); await updateTradeRecord(updatedRecord); setSelectedRecord(updatedRecord); };
    const handleAddWarehouseReceipt = async () => { if (!selectedRecord || !newWarehouseReceipt.number) return; const receipt: WarehouseReceipt = { id: generateUUID(), number: newWarehouseReceipt.number || '', part: newWarehouseReceipt.part || '', issueDate: newWarehouseReceipt.issueDate || '' }; const updatedReceipts = [...(clearanceForm.receipts || []), receipt]; const updatedData = { ...clearanceForm, receipts: updatedReceipts }; setClearanceForm(updatedData); setNewWarehouseReceipt({ number: '', part: '', issueDate: '' }); const updatedRecord = { ...selectedRecord, clearanceData: updatedData }; if (!updatedRecord.stages[TradeStage.CLEARANCE_DOCS]) updatedRecord.stages[TradeStage.CLEARANCE_DOCS] = getStageData(updatedRecord, TradeStage.CLEARANCE_DOCS); updatedRecord.stages[TradeStage.CLEARANCE_DOCS].isCompleted = updatedReceipts.length > 0; await updateTradeRecord(updatedRecord); setSelectedRecord(updatedRecord); };
    const handleDeleteWarehouseReceipt = async (id: string) => { if (!selectedRecord) return; const updatedReceipts = (clearanceForm.receipts || []).filter(r => r.id !== id); const updatedData = { ...clearanceForm, receipts: updatedReceipts }; setClearanceForm(updatedData); const updatedRecord = { ...selectedRecord, clearanceData: updatedData }; await updateTradeRecord(updatedRecord); setSelectedRecord(updatedRecord); };
    const handleAddClearancePayment = async () => { if (!selectedRecord || !newClearancePayment.amount) return; const payment: ClearancePayment = { id: generateUUID(), amount: Number(newClearancePayment.amount), part: newClearancePayment.part || '', bank: newClearancePayment.bank || '', date: newClearancePayment.date || '', payingBank: newClearancePayment.payingBank }; const updatedPayments = [...(clearanceForm.payments || []), payment]; const updatedData = { ...clearanceForm, payments: updatedPayments }; setClearanceForm(updatedData); setNewClearancePayment({ amount: 0, part: '', bank: '', date: '', payingBank: '' }); const totalCost = updatedPayments.reduce((acc, p) => acc + p.amount, 0); const updatedRecord = { ...selectedRecord, clearanceData: updatedData }; if (!updatedRecord.stages[TradeStage.CLEARANCE_DOCS]) updatedRecord.stages[TradeStage.CLEARANCE_DOCS] = getStageData(updatedRecord, TradeStage.CLEARANCE_DOCS); updatedRecord.stages[TradeStage.CLEARANCE_DOCS].costRial = totalCost; await updateTradeRecord(updatedRecord); setSelectedRecord(updatedRecord); };
    const handleDeleteClearancePayment = async (id: string) => { if (!selectedRecord) return; const updatedPayments = (clearanceForm.payments || []).filter(p => p.id !== id); const updatedData = { ...clearanceForm, payments: updatedPayments }; setClearanceForm(updatedData); const totalCost = updatedPayments.reduce((acc, p) => acc + p.amount, 0); const updatedRecord = { ...selectedRecord, clearanceData: updatedData }; if (!updatedRecord.stages[TradeStage.CLEARANCE_DOCS]) updatedRecord.stages[TradeStage.CLEARANCE_DOCS] = getStageData(updatedRecord, TradeStage.CLEARANCE_DOCS); updatedRecord.stages[TradeStage.CLEARANCE_DOCS].costRial = totalCost; await updateTradeRecord(updatedRecord); setSelectedRecord(updatedRecord); };
    const calculateGreenLeafTotal = (data: GreenLeafData) => { let total = 0; total += data.duties.reduce((acc, d) => acc + d.amount, 0); total += data.taxes.reduce((acc, t) => acc + t.amount, 0); total += data.roadTolls.reduce((acc, r) => acc + r.amount, 0); return total; };
    const updateGreenLeafRecord = async (newData: GreenLeafData) => { if (!selectedRecord) return; setGreenLeafForm(newData); const totalCost = calculateGreenLeafTotal(newData); const updatedRecord = { ...selectedRecord, greenLeafData: newData }; if (!updatedRecord.stages[TradeStage.GREEN_LEAF]) updatedRecord.stages[TradeStage.GREEN_LEAF] = getStageData(updatedRecord, TradeStage.GREEN_LEAF); updatedRecord.stages[TradeStage.GREEN_LEAF].costRial = totalCost; updatedRecord.stages[TradeStage.GREEN_LEAF].isCompleted = (newData.duties.length > 0); await updateTradeRecord(updatedRecord); setSelectedRecord(updatedRecord); };
    const handleAddCustomsDuty = async () => { if (!newCustomsDuty.cottageNumber || !newCustomsDuty.amount) return; const duty: GreenLeafCustomsDuty = { id: generateUUID(), cottageNumber: newCustomsDuty.cottageNumber, part: newCustomsDuty.part || '', amount: Number(newCustomsDuty.amount), paymentMethod: (newCustomsDuty.paymentMethod as 'Bank' | 'Guarantee') || 'Bank', bank: newCustomsDuty.bank, date: newCustomsDuty.date }; const updatedDuties = [...greenLeafForm.duties, duty]; await updateGreenLeafRecord({ ...greenLeafForm, duties: updatedDuties }); setNewCustomsDuty({ cottageNumber: '', part: '', amount: 0, paymentMethod: 'Bank', bank: '', date: '' }); };
    const handleDeleteCustomsDuty = async (id: string) => { const updatedDuties = greenLeafForm.duties.filter(d => d.id !== id); const updatedGuarantees = greenLeafForm.guarantees.filter(g => g.relatedDutyId !== id); await updateGreenLeafRecord({ ...greenLeafForm, duties: updatedDuties, guarantees: updatedGuarantees }); };
    const handleAddGuarantee = async () => { 
        if (!selectedDutyForGuarantee || !newGuaranteeDetails.guaranteeNumber) return; 
        const duty = greenLeafForm.duties.find(d => d.id === selectedDutyForGuarantee); 
        
        const rawGuaranteeAmt = Number(newGuaranteeDetails.guaranteeAmount) || 0;
        const rawCashAmt = Number(newGuaranteeDetails.cashAmount) || 0;
        const rawDutyCashAmt = Number(newGuaranteeDetails.dutyCashAmount) || 0;
        
        const guarantee: GreenLeafGuarantee = { 
            id: generateUUID(), 
            relatedDutyId: selectedDutyForGuarantee, 
            guaranteeNumber: newGuaranteeDetails.guaranteeNumber, 
            sepamNumber: newGuaranteeDetails.sepamNumber || '',
            guaranteeBank: newGuaranteeDetails.guaranteeBank || '',
            guaranteeType: newGuaranteeDetails.guaranteeType || 'cheque',
            guaranteeAmount: rawGuaranteeAmt,
            dutyCashAmount: rawDutyCashAmt,
            chequeNumber: newGuaranteeDetails.chequeNumber || '', 
            chequeBank: newGuaranteeDetails.chequeBank || '', 
            chequeDate: newGuaranteeDetails.chequeDate || '', 
            chequeAmount: newGuaranteeDetails.guaranteeType === 'credit' ? 0 : rawGuaranteeAmt, 
            isDelivered: false, 
            cashAmount: rawCashAmt, 
            cashBank: newGuaranteeDetails.cashBank || '', 
            cashDate: newGuaranteeDetails.cashDate || '', 
            part: duty?.part 
        }; 
        
        const updatedGuarantees = [...greenLeafForm.guarantees, guarantee]; 
        await updateGreenLeafRecord({ ...greenLeafForm, guarantees: updatedGuarantees }); 
        setNewGuaranteeDetails({ 
            guaranteeNumber: '', 
            sepamNumber: '',
            guaranteeBank: '',
            guaranteeType: 'cheque',
            guaranteeAmount: 0,
            dutyCashAmount: 0,
            chequeNumber: '', 
            chequeBank: '', 
            chequeDate: '', 
            cashAmount: 0, 
            cashBank: '', 
            cashDate: '', 
            chequeAmount: 0 
        }); 
        setSelectedDutyForGuarantee(''); 
    };
    const handleDeleteGuarantee = async (id: string) => { const updatedGuarantees = greenLeafForm.guarantees.filter(g => g.id !== id); await updateGreenLeafRecord({ ...greenLeafForm, guarantees: updatedGuarantees }); };
    const handleToggleGuaranteeDelivery = async (id: string) => { const updatedGuarantees = greenLeafForm.guarantees.map(g => g.id === id ? { ...g, isDelivered: !g.isDelivered } : g); await updateGreenLeafRecord({ ...greenLeafForm, guarantees: updatedGuarantees }); };
    const handleAddTax = async () => { if (!newTax.amount) return; const tax: GreenLeafTax = { id: generateUUID(), amount: Number(newTax.amount), part: newTax.part || '', bank: newTax.bank || '', date: newTax.date || '' }; const updatedTaxes = [...greenLeafForm.taxes, tax]; await updateGreenLeafRecord({ ...greenLeafForm, taxes: updatedTaxes }); setNewTax({ part: '', amount: 0, bank: '', date: '' }); };
    const handleDeleteTax = async (id: string) => { const updatedTaxes = greenLeafForm.taxes.filter(t => t.id !== id); await updateGreenLeafRecord({ ...greenLeafForm, taxes: updatedTaxes }); };
    const handleAddRoadToll = async () => { if (!newRoadToll.amount) return; const toll: GreenLeafRoadToll = { id: generateUUID(), amount: Number(newRoadToll.amount), part: newRoadToll.part || '', bank: newRoadToll.bank || '', date: newRoadToll.date || '' }; const updatedTolls = [...greenLeafForm.roadTolls, toll]; await updateGreenLeafRecord({ ...greenLeafForm, roadTolls: updatedTolls }); setNewRoadToll({ part: '', amount: 0, bank: '', date: '' }); };
    const handleDeleteRoadToll = async (id: string) => { const updatedTolls = greenLeafForm.roadTolls.filter(t => t.id !== id); await updateGreenLeafRecord({ ...greenLeafForm, roadTolls: updatedTolls }); };
    const handleAddShippingPayment = async () => { if (!selectedRecord || !newShippingPayment.amount) return; const payment: ShippingPayment = { id: generateUUID(), part: newShippingPayment.part || '', amount: Number(newShippingPayment.amount), date: newShippingPayment.date || '', bank: newShippingPayment.bank || '', description: newShippingPayment.description || '' }; const updatedPayments = [...(internalShippingForm.payments || []), payment]; const updatedData = { ...internalShippingForm, payments: updatedPayments }; setInternalShippingForm(updatedData); setNewShippingPayment({ part: '', amount: 0, date: '', bank: '', description: '' }); const updatedRecord = { ...selectedRecord, internalShippingData: updatedData }; if (!updatedRecord.stages[TradeStage.INTERNAL_SHIPPING]) updatedRecord.stages[TradeStage.INTERNAL_SHIPPING] = getStageData(updatedRecord, TradeStage.INTERNAL_SHIPPING); updatedRecord.stages[TradeStage.INTERNAL_SHIPPING].costRial = updatedPayments.reduce((acc, p) => acc + p.amount, 0); updatedRecord.stages[TradeStage.INTERNAL_SHIPPING].isCompleted = updatedPayments.length > 0; await updateTradeRecord(updatedRecord); setSelectedRecord(updatedRecord); };
    const handleDeleteShippingPayment = async (id: string) => { if (!selectedRecord) return; const updatedPayments = (internalShippingForm.payments || []).filter(p => p.id !== id); const updatedData = { ...internalShippingForm, payments: updatedPayments }; setInternalShippingForm(updatedData); const updatedRecord = { ...selectedRecord, internalShippingData: updatedData }; if (!updatedRecord.stages[TradeStage.INTERNAL_SHIPPING]) updatedRecord.stages[TradeStage.INTERNAL_SHIPPING] = getStageData(updatedRecord, TradeStage.INTERNAL_SHIPPING); updatedRecord.stages[TradeStage.INTERNAL_SHIPPING].costRial = updatedPayments.reduce((acc, p) => acc + p.amount, 0); await updateTradeRecord(updatedRecord); setSelectedRecord(updatedRecord); };
    const handleAddAgentPayment = async () => { if (!selectedRecord || !newAgentPayment.amount || !newAgentPayment.agentName) return; const payment: AgentPayment = { id: generateUUID(), agentName: newAgentPayment.agentName, amount: Number(newAgentPayment.amount), bank: newAgentPayment.bank || '', date: newAgentPayment.date || '', part: newAgentPayment.part || '', description: newAgentPayment.description || '' }; const updatedPayments = [...(agentForm.payments || []), payment]; const updatedData = { ...agentForm, payments: updatedPayments }; setAgentForm(updatedData); setNewAgentPayment({ agentName: newAgentPayment.agentName, amount: 0, bank: '', date: '', part: '', description: '' }); const updatedRecord = { ...selectedRecord, agentData: updatedData }; if (!updatedRecord.stages[TradeStage.AGENT_FEES]) updatedRecord.stages[TradeStage.AGENT_FEES] = getStageData(updatedRecord, TradeStage.AGENT_FEES); updatedRecord.stages[TradeStage.AGENT_FEES].costRial = updatedPayments.reduce((acc, p) => acc + p.amount, 0); updatedRecord.stages[TradeStage.AGENT_FEES].isCompleted = updatedPayments.length > 0; await updateTradeRecord(updatedRecord); setSelectedRecord(updatedRecord); };
    const handleDeleteAgentPayment = async (id: string) => { if (!selectedRecord) return; const updatedPayments = (agentForm.payments || []).filter(p => p.id !== id); const updatedData = { ...agentForm, payments: updatedPayments }; setAgentForm(updatedData); const updatedRecord = { ...selectedRecord, agentData: updatedData }; if (!updatedRecord.stages[TradeStage.AGENT_FEES]) updatedRecord.stages[TradeStage.AGENT_FEES] = getStageData(updatedRecord, TradeStage.AGENT_FEES); updatedRecord.stages[TradeStage.AGENT_FEES].costRial = updatedPayments.reduce((acc, p) => acc + p.amount, 0); await updateTradeRecord(updatedRecord); setSelectedRecord(updatedRecord); };
    const handleAddCurrencyTranche = async () => { 
        if (!selectedRecord || !newCurrencyTranche.amountStr || !newCurrencyTranche.rialAmountStr) return; 
        
        let updatedTranches = [...(currencyForm.tranches || [])]; 
        const rawAmount = deformatNumberString(newCurrencyTranche.amountStr); 
        const rawRialAmount = deformatNumberString(newCurrencyTranche.rialAmountStr); 
        const rawCurrencyFee = newCurrencyTranche.currencyFeeStr ? deformatNumberString(newCurrencyTranche.currencyFeeStr) : 0; 
        const rawReceived = newCurrencyTranche.receivedAmountStr ? deformatNumberString(newCurrencyTranche.receivedAmountStr) : 0; 
        const rawReturnAmount = newCurrencyTranche.returnAmount ? deformatNumberString(newCurrencyTranche.returnAmount.toString()) : undefined;

        const trancheData: any = { 
            date: newCurrencyTranche.date || '', 
            amount: rawAmount, 
            currencyType: newCurrencyTranche.currencyType || selectedRecord.mainCurrency || 'EUR', 
            brokerName: newCurrencyTranche.brokerName || '', 
            exchangeName: newCurrencyTranche.exchangeName || '', 
            rate: 0, 
            rialAmount: rawRialAmount, 
            currencyFee: rawCurrencyFee, 
            isDelivered: newCurrencyTranche.isDelivered, 
            deliveryDate: newCurrencyTranche.deliveryDate, 
            returnAmount: rawReturnAmount, 
            returnDate: newCurrencyTranche.returnDate, 
            receivedAmount: rawReceived 
        }; 

        if (editingTrancheId) { 
            updatedTranches = updatedTranches.map(t => t.id === editingTrancheId ? { ...t, ...trancheData } : t); 
        } else { 
            updatedTranches.push({ ...trancheData, id: generateUUID() }); 
        } 

        const totalPurchased = updatedTranches.reduce((acc, t) => acc + t.amount, 0); 
        const totalDelivered = updatedTranches.reduce((acc, t) => {
            const deliveriesSum = t.deliveries && t.deliveries.length > 0 ? t.deliveries.reduce((sum: number, d) => sum + d.amount, 0) : 0;
            return acc + (deliveriesSum || t.receivedAmount || (t.isDelivered ? t.amount : 0));
        }, 0); 
        const totalRialCost = updatedTranches.reduce((acc, t) => { 
            return acc + ((t.rialAmount || 0) - (t.returnAmount || 0)); 
        }, 0); 

        const updatedForm = { ...currencyForm, tranches: updatedTranches, purchasedAmount: totalPurchased, deliveredAmount: totalDelivered }; 
        setCurrencyForm(updatedForm); 

        const updatedRecord = { ...selectedRecord, currencyPurchaseData: updatedForm }; 
        if (!updatedRecord.stages[TradeStage.CURRENCY_PURCHASE]) updatedRecord.stages[TradeStage.CURRENCY_PURCHASE] = getStageData(updatedRecord, TradeStage.CURRENCY_PURCHASE); 
        updatedRecord.stages[TradeStage.CURRENCY_PURCHASE].costCurrency = totalPurchased; 
        updatedRecord.stages[TradeStage.CURRENCY_PURCHASE].costRial = totalRialCost; 

        await updateTradeRecord(updatedRecord); 
        setSelectedRecord(updatedRecord); 
        setRecords(prev => prev.map(r => r.id === updatedRecord.id ? updatedRecord : r));
        
        setNewCurrencyTranche({ 
            amount: 0, 
            currencyType: selectedRecord.mainCurrency || 'EUR', 
            date: '', 
            exchangeName: '', 
            brokerName: '', 
            isDelivered: false, 
            returnAmount: '', 
            returnDate: '', 
            receivedAmount: 0, 
            amountStr: '', 
            rialAmountStr: '', 
            receivedAmountStr: '', 
            currencyFeeStr: '' 
        }); 
        setEditingTrancheId(null); 
    };
    const handleEditTranche = (tranche: any) => { setNewCurrencyTranche({ amount: tranche.amount, amountStr: tranche.amount.toString(), currencyType: tranche.currencyType, date: tranche.date, exchangeName: tranche.exchangeName, brokerName: tranche.brokerName, isDelivered: tranche.isDelivered, deliveryDate: tranche.deliveryDate, rate: tranche.rate, rialAmountStr: formatNumberString(tranche.rialAmount || 0), currencyFeeStr: tranche.currencyFee ? tranche.currencyFee.toString() : '', returnAmount: tranche.returnAmount ? formatNumberString(tranche.returnAmount) : '', returnDate: tranche.returnDate, receivedAmount: tranche.receivedAmount, receivedAmountStr: tranche.receivedAmount ? tranche.receivedAmount.toString() : '' }); setEditingTrancheId(tranche.id); };
    const handleCancelEditTranche = () => { setNewCurrencyTranche({ amount: 0, currencyType: selectedRecord?.mainCurrency || 'EUR', date: '', exchangeName: '', brokerName: '', isDelivered: false, returnAmount: '', returnDate: '', receivedAmount: 0, amountStr: '', rialAmountStr: '', receivedAmountStr: '', currencyFeeStr: '' }); setEditingTrancheId(null); };

    const handleShareProforma = async (targetId: string) => {
        if (!selectedRecord) return;
        try {
            const platform = sharePlatform || 'bale';
            const totalAmount = selectedRecord.items.reduce((a, b) => a + b.totalPrice, 0);
            const totalWeight = selectedRecord.items.reduce((a, b) => a + b.weight, 0);
            
            const message = `📄 *پیش‌فاکتور جدید*\n\n` +
                `🏢 شرکت: ${selectedRecord.company}\n` +
                `📦 کالا: ${selectedRecord.goodsName}\n` +
                `🔢 شماره پرونده: ${selectedRecord.fileNumber}\n` +
                `👤 فروشنده: ${selectedRecord.sellerName}\n` +
                `⚖️ وزن کل: ${formatNumberString(totalWeight)} KG\n` +
                `💰 ارزش کل: ${formatNumberString(totalAmount)} ${selectedRecord.mainCurrency}\n\n` +
                `نمایش آنلاین:\n${window.location.origin}/share/proforma/${selectedRecord.id}`;

            const response: any = await apiCall(`/share/${platform}`, 'POST', {
                targetId,
                message,
                documentId: selectedRecord.id,
                documentType: 'PROFORMA'
            });

            if (response.success) {
                alert('پیش‌فاکتور با موفقیت ارسال شد.');
                setSharePlatform(null);
            } else {
                throw new Error(response.error || 'خطا در ارسال');
            }
        } catch (error: any) {
            alert('خطا در ارسال: ' + error.message);
        }
    };

    const handleRemoveTranche = async (id: string) => { 
        if (!selectedRecord) return; 
        if (!confirm('آیا از حذف این پارت مطمئن هستید؟')) return; 
        const updatedTranches = (currencyForm.tranches || []).filter(t => t.id !== id); 
        const totalPurchased = updatedTranches.reduce((acc, t) => acc + t.amount, 0); 
        const totalDelivered = updatedTranches.reduce((acc, t) => {
            const deliveriesSum = t.deliveries && t.deliveries.length > 0 ? t.deliveries.reduce((sum: number, d) => sum + d.amount, 0) : 0;
            return acc + (deliveriesSum || t.receivedAmount || (t.isDelivered ? t.amount : 0));
        }, 0); 
        const totalRialCost = updatedTranches.reduce((acc, t) => { return acc + ((t.rialAmount || 0) - (t.returnAmount || 0)); }, 0); 
        const updatedForm = { ...currencyForm, tranches: updatedTranches, purchasedAmount: totalPurchased, deliveredAmount: totalDelivered }; 
        setCurrencyForm(updatedForm); 
        const updatedRecord = { ...selectedRecord, currencyPurchaseData: updatedForm }; 
        if (!updatedRecord.stages[TradeStage.CURRENCY_PURCHASE]) updatedRecord.stages[TradeStage.CURRENCY_PURCHASE] = getStageData(updatedRecord, TradeStage.CURRENCY_PURCHASE); 
        updatedRecord.stages[TradeStage.CURRENCY_PURCHASE].costCurrency = totalPurchased; 
        updatedRecord.stages[TradeStage.CURRENCY_PURCHASE].costRial = totalRialCost; 
        await updateTradeRecord(updatedRecord); 
        setSelectedRecord(updatedRecord); 
    };

    const handleToggleTrancheDelivery = async (id: string) => { 
        if (!selectedRecord) return; 
        const updatedTranches = (currencyForm.tranches || []).map(t => { 
            if (t.id === id) {
                const isDel = !t.isDelivered;
                const receivedAmt = isDel ? (t.receivedAmount || t.amount) : 0;
                return { ...t, isDelivered: isDel, receivedAmount: receivedAmt }; 
            }
            return t; 
        }); 
        const totalPurchased = updatedTranches.reduce((acc, t) => acc + t.amount, 0); 
        const totalDelivered = updatedTranches.reduce((acc, t) => {
            const deliveriesSum = t.deliveries && t.deliveries.length > 0 ? t.deliveries.reduce((sum: number, d) => sum + d.amount, 0) : 0;
            return acc + (deliveriesSum || t.receivedAmount || (t.isDelivered ? t.amount : 0));
        }, 0); 
        const updatedForm = { ...currencyForm, tranches: updatedTranches, purchasedAmount: totalPurchased, deliveredAmount: totalDelivered }; 
        setCurrencyForm(updatedForm); 
        const updatedRecord = { ...selectedRecord, currencyPurchaseData: updatedForm }; 
        await updateTradeRecord(updatedRecord); 
        setSelectedRecord(updatedRecord); 
    };

    const handleAddTrancheDelivery = async () => {
        if (!selectedRecord || !selectedTrancheForDeliveries || !newDeliveryForm.amount) return;
        const rawAmt = deformatNumberString(String(newDeliveryForm.amount));
        if (rawAmt <= 0) return;

        const newDelivery: CurrencyDelivery = {
            id: generateUUID(),
            amount: rawAmt,
            date: newDeliveryForm.date || '',
            recipientName: newDeliveryForm.recipientName || '',
            description: newDeliveryForm.description || ''
        };

        const updatedTranches = (currencyForm.tranches || []).map(t => {
            if (t.id === selectedTrancheForDeliveries) {
                const currentDeliveries = t.deliveries || [];
                const updatedD = [...currentDeliveries, newDelivery];
                const sum = updatedD.reduce((acc, d) => acc + d.amount, 0);
                return {
                    ...t,
                    deliveries: updatedD,
                    receivedAmount: sum,
                    isDelivered: sum >= t.amount
                };
            }
            return t;
        });

        const totalPurchased = updatedTranches.reduce((acc, t) => acc + t.amount, 0);
        const totalDelivered = updatedTranches.reduce((acc, t) => {
            const deliveriesSum = t.deliveries && t.deliveries.length > 0 ? t.deliveries.reduce((sum: number, d) => sum + d.amount, 0) : 0;
            return acc + (deliveriesSum || t.receivedAmount || (t.isDelivered ? t.amount : 0));
        }, 0);

        const updatedForm = { ...currencyForm, tranches: updatedTranches, purchasedAmount: totalPurchased, deliveredAmount: totalDelivered };
        setCurrencyForm(updatedForm);
        const updatedRecord = { ...selectedRecord, currencyPurchaseData: updatedForm };

        await updateTradeRecord(updatedRecord);
        setSelectedRecord(updatedRecord);
        setNewDeliveryForm({ amount: '', date: '', recipientName: '', description: '' });
    };

    const handleRemoveTrancheDelivery = async (trancheId: string, deliveryId: string) => {
        if (!selectedRecord) return;
        if (!confirm('آیا از حذف این ردیف تحویل مطمئن هستید؟')) return;

        const updatedTranches = (currencyForm.tranches || []).map(t => {
            if (t.id === trancheId) {
                const updatedD = (t.deliveries || []).filter(d => d.id !== deliveryId);
                const sum = updatedD.reduce((acc, d) => acc + d.amount, 0);
                return {
                    ...t,
                    deliveries: updatedD,
                    receivedAmount: sum,
                    isDelivered: sum >= t.amount
                };
            }
            return t;
        });

        const totalPurchased = updatedTranches.reduce((acc, t) => acc + t.amount, 0);
        const totalDelivered = updatedTranches.reduce((acc, t) => {
            const deliveriesSum = t.deliveries && t.deliveries.length > 0 ? t.deliveries.reduce((sum: number, d) => sum + d.amount, 0) : 0;
            return acc + (deliveriesSum || t.receivedAmount || (t.isDelivered ? t.amount : 0));
        }, 0);

        const updatedForm = { ...currencyForm, tranches: updatedTranches, purchasedAmount: totalPurchased, deliveredAmount: totalDelivered };
        setCurrencyForm(updatedForm);
        const updatedRecord = { ...selectedRecord, currencyPurchaseData: updatedForm };

        await updateTradeRecord(updatedRecord);
        setSelectedRecord(updatedRecord);
    };
    const handleAddCurrencyGuarantee = async (newG: GuaranteeCheque) => {
        if (!selectedRecord) return;
        const currentGuarantees = currencyForm.guaranteeCheques || (currencyForm.guaranteeCheque ? [currencyForm.guaranteeCheque] : []);
        const updatedGuarantees = [...currentGuarantees, newG];
        const updatedForm: CurrencyPurchaseData = { 
            ...currencyForm, 
            guaranteeCheques: updatedGuarantees,
            guaranteeCheque: currencyForm.guaranteeCheque || newG 
        };
        setCurrencyForm(updatedForm);
        const updatedRecord = { ...selectedRecord, currencyPurchaseData: updatedForm };
        await updateTradeRecord(updatedRecord);
        setSelectedRecord(updatedRecord);
        alert("چک ضمانت ارزی جدید با موفقیت ثبت شد.");
    };

    const handleDeleteCurrencyGuarantee = async (idx: number) => {
        if (!selectedRecord) return;
        if (!confirm('آیا قصد حذف این چک ضمانت ارزی را دارید؟')) return;
        const currentGuarantees = currencyForm.guaranteeCheques || (currencyForm.guaranteeCheque ? [currencyForm.guaranteeCheque] : []);
        const updatedGuarantees = currentGuarantees.filter((_, i) => i !== idx);
        const updatedForm: CurrencyPurchaseData = { 
            ...currencyForm, 
            guaranteeCheques: updatedGuarantees,
            guaranteeCheque: updatedGuarantees.length > 0 ? updatedGuarantees[0] : undefined
        };
        setCurrencyForm(updatedForm);
        const updatedRecord = { ...selectedRecord, currencyPurchaseData: updatedForm };
        await updateTradeRecord(updatedRecord);
        setSelectedRecord(updatedRecord);
        alert("چک ضمانت ارزی مورد نظر حذف شد.");
    };

    const handleToggleCurrencyGuaranteeDelivery = async (idx?: number) => {
        if (!selectedRecord) return;
        const currentGuarantees = currencyForm.guaranteeCheques || (currencyForm.guaranteeCheque ? [currencyForm.guaranteeCheque] : []);
        if (currentGuarantees.length === 0) return;
        
        const targetIdx = typeof idx === 'number' ? idx : 0;
        const updatedGuarantees = currentGuarantees.map((item, i) => 
            i === targetIdx ? { ...item, isDelivered: !item.isDelivered } : item
        );
        const updatedForm: CurrencyPurchaseData = { 
            ...currencyForm, 
            guaranteeCheques: updatedGuarantees,
            guaranteeCheque: updatedGuarantees.length > 0 ? updatedGuarantees[0] : undefined
        };
        setCurrencyForm(updatedForm);
        const updatedRecord = { ...selectedRecord, currencyPurchaseData: updatedForm };
        await updateTradeRecord(updatedRecord);
        setSelectedRecord(updatedRecord);
    };
    const handleAddInvoiceItem = () => { if (!newInvoiceItem.name) return; const newItem: InvoiceItem = { id: generateUUID(), name: newInvoiceItem.name, weight: Number(newInvoiceItem.weight), unitPrice: Number(newInvoiceItem.unitPrice), totalPrice: Number(newInvoiceItem.totalPrice) || (Number(newInvoiceItem.weight) * Number(newInvoiceItem.unitPrice)), part: newInvoiceItem.part || '' }; setShippingDocForm(prev => ({ ...prev, invoiceItems: [...(prev.invoiceItems || []), newItem] })); setNewInvoiceItem({ name: '', weight: 0, unitPrice: 0, totalPrice: 0, part: '' }); };
    const handleRemoveInvoiceItem = (id: string) => { setShippingDocForm(prev => ({ ...prev, invoiceItems: (prev.invoiceItems || []).filter(i => i.id !== id) })); };
    const handleAddPackingItem = () => { if (!newPackingItem.description) return; const item: PackingItem = { id: generateUUID(), description: newPackingItem.description, netWeight: Number(newPackingItem.netWeight), grossWeight: Number(newPackingItem.grossWeight), packageCount: Number(newPackingItem.packageCount), part: newPackingItem.part || '' }; setShippingDocForm(prev => ({ ...prev, packingItems: [...(prev.packingItems || []), item] })); setNewPackingItem({ description: '', netWeight: 0, grossWeight: 0, packageCount: 0, part: '' }); };
    const handleRemovePackingItem = (id: string) => { setShippingDocForm(prev => ({ ...prev, packingItems: (prev.packingItems || []).filter(i => i.id !== id) })); };
    const handleDocFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (!file) return; setUploadingDocFile(true); const reader = new FileReader(); reader.onload = async (ev) => { const base64 = ev.target?.result as string; try { const result = await uploadFile(file.name, base64); setShippingDocForm(prev => ({ ...prev, attachments: [...(prev.attachments || []), { fileName: result.fileName, url: result.url }] })); } catch (error) { alert('خطا در آپلود فایل'); } finally { setUploadingDocFile(false); } }; reader.readAsDataURL(file); e.target.value = ''; };
    const handleSaveShippingDoc = async () => { if (!selectedRecord || !shippingDocForm.documentNumber) return; let totalNet = shippingDocForm.netWeight; let totalGross = shippingDocForm.grossWeight; let totalPackages = shippingDocForm.packagesCount; if (activeShippingSubTab === 'Packing List' && shippingDocForm.packingItems && shippingDocForm.packingItems.length > 0) { totalNet = shippingDocForm.packingItems.reduce((acc, i) => acc + i.netWeight, 0); totalGross = shippingDocForm.packingItems.reduce((acc, i) => acc + i.grossWeight, 0); totalPackages = shippingDocForm.packingItems.reduce((acc, i) => acc + i.packageCount, 0); } const newDoc: ShippingDocument = { id: generateUUID(), type: activeShippingSubTab, status: shippingDocForm.status || 'Draft', documentNumber: shippingDocForm.documentNumber, documentDate: shippingDocForm.documentDate || '', createdAt: Date.now(), createdBy: currentUser.fullName, attachments: shippingDocForm.attachments || [], invoiceItems: activeShippingSubTab === 'Commercial Invoice' ? shippingDocForm.invoiceItems : undefined, packingItems: activeShippingSubTab === 'Packing List' ? shippingDocForm.packingItems : undefined, freightCost: activeShippingSubTab === 'Commercial Invoice' ? Number(shippingDocForm.freightCost) : undefined, currency: shippingDocForm.currency, netWeight: totalNet, grossWeight: totalGross, packagesCount: totalPackages, vesselName: shippingDocForm.vesselName, portOfLoading: shippingDocForm.portOfLoading, portOfDischarge: shippingDocForm.portOfDischarge, description: shippingDocForm.description }; const updatedDocs = [...(selectedRecord.shippingDocuments || []), newDoc]; const updatedRecord = { ...selectedRecord, shippingDocuments: updatedDocs }; if (!updatedRecord.stages[TradeStage.SHIPPING_DOCS]) updatedRecord.stages[TradeStage.SHIPPING_DOCS] = getStageData(updatedRecord, TradeStage.SHIPPING_DOCS); if (activeShippingSubTab === 'Commercial Invoice') { updatedRecord.stages[TradeStage.SHIPPING_DOCS].costCurrency = updatedDocs.filter(d => d.type === 'Commercial Invoice').reduce((acc, d) => acc + (d.invoiceItems?.reduce((sum, i) => sum + i.totalPrice, 0) || 0) + (d.freightCost || 0), 0); } await updateTradeRecord(updatedRecord); setSelectedRecord(updatedRecord); setShippingDocForm({ status: 'Draft', documentNumber: '', documentDate: '', attachments: [], invoiceItems: [], packingItems: [], freightCost: 0 }); };
    const handleDeleteShippingDoc = async (id: string) => { if (!selectedRecord) return; const updatedDocs = (selectedRecord.shippingDocuments || []).filter(d => d.id !== id); const updatedRecord = { ...selectedRecord, shippingDocuments: updatedDocs }; await updateTradeRecord(updatedRecord); setSelectedRecord(updatedRecord); };
    const handleSyncInvoiceToProforma = async () => { if (!selectedRecord) return; if (!confirm('آیا مطمئن هستید؟ این عملیات اقلام و هزینه حمل پروفرما را با مقادیر این اینویس جایگزین می‌کند. اقلام هم‌نام (از پارت‌های مختلف) تجمیع خواهند شد.')) return; const invoiceItems = shippingDocForm.invoiceItems || []; const aggregatedMap = new Map<string, { weight: number, totalPrice: number }>(); for (const item of invoiceItems) { const name = item.name.trim(); const current = aggregatedMap.get(name) || { weight: 0, totalPrice: 0 }; aggregatedMap.set(name, { weight: current.weight + item.weight, totalPrice: current.totalPrice + item.totalPrice }); } const newItems: TradeItem[] = []; aggregatedMap.forEach((val, name) => { newItems.push({ id: generateUUID(), name: name, weight: val.weight, unitPrice: val.weight > 0 ? val.totalPrice / val.weight : 0, totalPrice: val.totalPrice, hsCode: '' }); }); const updatedRecord = { ...selectedRecord, items: newItems, freightCost: Number(shippingDocForm.freightCost) || 0 }; await updateTradeRecord(updatedRecord); setSelectedRecord(updatedRecord); alert('پروفرما با موفقیت بروزرسانی شد (تجمیع بر اساس نام کالا).'); };
    const handleStageClick = (stage: TradeStage) => { const data = getStageData(selectedRecord, stage); setEditingStage(stage); setStageFormData(data); };
    const handleStageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (!file) return; setUploadingStageFile(true); const reader = new FileReader(); reader.onload = async (ev) => { const base64 = ev.target?.result as string; try { const result = await uploadFile(file.name, base64); setStageFormData(prev => ({ ...prev, attachments: [...(prev.attachments || []), { fileName: result.fileName, url: result.url }] })); } catch (error) { alert('خطا در آپلود'); } finally { setUploadingStageFile(false); } }; reader.readAsDataURL(file); e.target.value = ''; };
    const handleSaveStage = async () => { if (!selectedRecord || !editingStage) return; const updatedRecord = { ...selectedRecord }; updatedRecord.stages[editingStage] = { ...getStageData(selectedRecord, editingStage), ...stageFormData, updatedAt: Date.now(), updatedBy: currentUser.fullName }; if (editingStage === TradeStage.ALLOCATION_QUEUE && stageFormData.queueDate) { updatedRecord.stages[TradeStage.ALLOCATION_QUEUE].queueDate = stageFormData.queueDate; } if (editingStage === TradeStage.ALLOCATION_APPROVED) { updatedRecord.stages[TradeStage.ALLOCATION_APPROVED].allocationDate = stageFormData.allocationDate; updatedRecord.stages[TradeStage.ALLOCATION_APPROVED].allocationCode = stageFormData.allocationCode; updatedRecord.stages[TradeStage.ALLOCATION_APPROVED].allocationExpiry = stageFormData.allocationExpiry; } await updateTradeRecord(updatedRecord); setSelectedRecord(updatedRecord); setEditingStage(null); };
    const toggleCommitment = async () => { if (!selectedRecord) return; const updatedRecord = { ...selectedRecord, isCommitmentFulfilled: !selectedRecord.isCommitmentFulfilled }; await updateTradeRecord(updatedRecord); setSelectedRecord(updatedRecord); setSelectedRecord(updatedRecord); };
    const handleArchiveRecord = async () => { if (!selectedRecord) return; if (!confirm('آیا از انتقال این پرونده به بایگانی (ترخیص شده) اطمینان دارید؟')) return; const updatedRecord = { ...selectedRecord, isArchived: true, status: 'Completed' as const }; await updateTradeRecord(updatedRecord); setSelectedRecord(updatedRecord); alert('پرونده با موفقیت بایگانی شد.'); setViewMode('dashboard'); loadRecords(); };
    const handleUnarchiveRecord = async () => { if (!selectedRecord) return; if (!confirm('آیا از بازگرداندن این پرونده به جریان کاری اطمینان دارید؟')) return; const updatedRecord = { ...selectedRecord, isArchived: false, status: 'Active' as const }; await updateTradeRecord(updatedRecord); setSelectedRecord(updatedRecord); alert('پرونده بازیابی شد.'); };
    const getAllGuarantees = () => {
        const list: any[] = [];
        if (selectedRecord && selectedRecord.currencyPurchaseData) {
            const currencyGuarantees = selectedRecord.currencyPurchaseData.guaranteeCheques || 
                (selectedRecord.currencyPurchaseData.guaranteeCheque ? [selectedRecord.currencyPurchaseData.guaranteeCheque] : []);
            currencyGuarantees.forEach((g, idx) => {
                list.push({
                    id: `currency_g_${idx}`,
                    type: 'ارزی',
                    number: g.chequeNumber,
                    bank: g.bank,
                    amount: g.amount,
                    isDelivered: g.isDelivered,
                    toggleFunc: () => handleToggleCurrencyGuaranteeDelivery(idx)
                });
            });
        }
        if (selectedRecord && selectedRecord.greenLeafData?.guarantees) {
            selectedRecord.greenLeafData.guarantees.forEach(g => {
                list.push({
                    id: g.id,
                    type: 'گمرکی',
                    number: g.guaranteeNumber + (g.sepamNumber ? ` / سپام: ${g.sepamNumber}` : '') + (g.guaranteeType === 'credit' ? ' (حد اعتبار)' : (g.chequeNumber ? ` / چک: ${g.chequeNumber}` : '')),
                    bank: g.guaranteeBank || (g.guaranteeType === 'credit' ? 'حد اعتبار بانکی' : (g.chequeBank || 'مشخص‌نشده')),
                    amount: g.guaranteeAmount || g.chequeAmount || 0,
                    isDelivered: g.isDelivered,
                    toggleFunc: () => handleToggleGuaranteeDelivery(g.id)
                });
            });
        }
        return list;
    };

    const openEditMetadata = () => {
        if (!selectedRecord) return;
        setEditMetadataForm({
            fileNumber: selectedRecord.fileNumber,
            goodsName: selectedRecord.goodsName,
            sellerName: selectedRecord.sellerName,
            mainCurrency: selectedRecord.mainCurrency,
            commodityGroup: selectedRecord.commodityGroup,
            company: selectedRecord.company,
            registrationNumber: selectedRecord.registrationNumber,
            operatingBank: selectedRecord.operatingBank
        });
        setShowEditMetadataModal(true);
    };

    const saveMetadata = async () => {
        if (!selectedRecord) return;
        const updatedRecord = { ...selectedRecord, ...editMetadataForm };
        await updateTradeRecord(updatedRecord);
        setSelectedRecord(updatedRecord);
        setRecords(prev => prev.map(r => r.id === updatedRecord.id ? updatedRecord : r));
        setShowEditMetadataModal(false);
        alert('مشخصات پرونده بروزرسانی شد.');
    };

    const handlePrintReport = () => {
        window.print();
    };

    const handlePrintTrade = () => {
        setShowFinalReportPrint(true);
    };

    const handleDownloadFinalReportPDF = () => {
        setShowFinalReportPrint(true);
    };

    const renderReportContent = useMemo(() => {
        const safeSettings = settings || { currentTrackingNumber: 1000, currentExitPermitNumber: 1000, companyNames: [], companies: [], defaultCompany: '', bankNames: [], operatingBankNames: [], commodityGroups: [], rolePermissions: {}, savedContacts: [], warehouseSequences: {}, companyNotifications: {}, insuranceCompanies: [] };

        const currentList = Array.isArray(records) ? records : [];

        switch (activeReport) {
            case 'general':
                return (
                    <div className="glass-panel p-6 rounded-xl shadow-sm border overflow-x-auto">
                        <table className="w-full text-sm text-right">
                            <thead className="bg-gray-100 dark:bg-gray-800/40 text-gray-800 dark:text-gray-200 text-gray-700">
                                <tr>
                                    <th className="p-3">شماره پرونده</th>
                                    <th className="p-3">کالا</th>
                                    <th className="p-3">شرکت</th>
                                    <th className="p-3">فروشنده</th>
                                    <th className="p-3">ارز</th>
                                    <th className="p-3">وضعیت</th>
                                </tr>
                            </thead>
                            <tbody>
                                {currentList
                                    .filter(r => (!reportFilterCompany || r.company === reportFilterCompany) && (
                                        r.fileNumber.includes(reportSearchTerm) || 
                                        r.goodsName.includes(reportSearchTerm)
                                    ))
                                    .map(r => (
                                    <tr key={r.id} className="border-b hover:bg-gray-50 dark:bg-gray-900/40 text-gray-800 dark:text-gray-200">
                                        <td className="p-3 font-bold">{r.fileNumber}</td>
                                        <td className="p-3">{r.goodsName}</td>
                                        <td className="p-3">{r.company}</td>
                                        <td className="p-3">{r.sellerName}</td>
                                        <td className="p-3 font-mono">{r.mainCurrency}</td>
                                        <td className="p-3"><span className="bg-gray-100 px-2 py-1 rounded text-xs">{getStatusLabel(r.status as any) || r.status}</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                );
            case 'allocation_queue':
                return <AllocationReport records={currentList.filter(r => !reportFilterCompany || r.company === reportFilterCompany)} onUpdateRecord={async (r, u) => { const updated = {...r, ...u}; await updateTradeRecord(updated); setRecords(prev => prev.map(rec => rec.id === updated.id ? updated : rec)); }} settings={safeSettings} />;
            case 'currency':
                return (
                    <CurrencyReport 
                        onUpdateRecord={updateTradeRecord}
                        records={currentList.filter(r => !reportFilterCompany || r.company === reportFilterCompany)} 
                        onSelectTranche={(recordId, trancheId) => {
                            const rec = records.find(r => r.id === recordId);
                            if (rec) {
                                setSelectedRecord(rec);
                                setViewMode('details');
                                setActiveTab('currency_purchase');
                                if (trancheId && trancheId !== 'main') {
                                    setTimeout(() => {
                                        setSelectedTrancheForDeliveries(trancheId);
                                        setNewDeliveryForm({ amount: '', date: '', recipientName: '', description: '' });
                                    }, 150);
                                }
                            }
                        }}
                    />
                );
            case 'company_performance':
                return <CompanyPerformanceReport records={currentList} />;
            case 'insurance_ledger':
                return <InsuranceLedgerReport records={currentList.filter(r => !reportFilterCompany || r.company === reportFilterCompany)} settings={safeSettings} />; 
            case 'guarantee':
                return <GuaranteeReport records={currentList.filter(r => !reportFilterCompany || r.company === reportFilterCompany)} />;
            default:
                return <div className="p-8 text-center text-gray-500">گزارش در حال تکمیل است...</div>;
        }
    }, [activeReport, records, reportFilterCompany, reportSearchTerm, settings]);

    if (viewMode === 'reports') {
        return (
            <div className="flex flex-col h-[calc(100dvh-140px)] md:h-[calc(100vh-100px)] bg-gray-50 md:rounded-2xl overflow-hidden md:border">
                
                {/* --- RESPONSIVE HEADER NAV FOR MOBILE --- */}
                <div className="md:hidden glass-panel border-b p-3 flex gap-2 overflow-x-auto whitespace-nowrap shadow-sm z-20">
                    <button onClick={() => setViewMode('dashboard')} className="p-2 bg-gray-100 rounded-lg"><ChevronRight size={20}/></button>
                    <button onClick={() => setActiveReport('general')} className={`px-3 py-1.5 rounded-lg text-xs border ${activeReport === 'general' ? 'bg-blue-600 text-white' : 'glass-panel text-gray-700'}`}>لیست کلی</button>
                    <button onClick={() => setActiveReport('allocation_queue')} className={`px-3 py-1.5 rounded-lg text-xs border ${activeReport === 'allocation_queue' ? 'bg-blue-600 text-white' : 'glass-panel text-gray-700'}`}>صف تخصیص</button>
                    <button onClick={() => setActiveReport('currency')} className={`px-3 py-1.5 rounded-lg text-xs border ${activeReport === 'currency' ? 'bg-blue-600 text-white' : 'glass-panel text-gray-700'}`}>خرید ارز</button>
                    <button onClick={() => setActiveReport('guarantee')} className={`px-3 py-1.5 rounded-lg text-xs border ${activeReport === 'guarantee' ? 'bg-blue-600 text-white' : 'glass-panel text-gray-700'}`}>تضامین</button>
                    <button onClick={() => setActiveReport('insurance_ledger')} className={`px-3 py-1.5 rounded-lg text-xs border ${activeReport === 'insurance_ledger' ? 'bg-blue-600 text-white' : 'glass-panel text-gray-700'}`}>بیمه</button>
                    <button onClick={() => setActiveReport('company_performance')} className={`px-3 py-1.5 rounded-lg text-xs border ${activeReport === 'company_performance' ? 'bg-blue-600 text-white' : 'glass-panel text-gray-700'}`}>عملکرد</button>
                </div>

                <div className="flex flex-1 overflow-hidden">
                    {/* Desktop Sidebar (Hidden on Mobile) */}
                    <div className="hidden md:flex w-64 glass-panel border-l p-4 flex-col gap-2 flex-shrink-0 h-full overflow-y-auto z-10">
                        <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><FileSpreadsheet size={20}/> گزارشات بازرگانی</h3>
                        
                        <div className="mb-2 relative">
                            <input 
                                className="w-full border rounded p-2 text-sm pl-8" 
                                placeholder="جستجو..." 
                                value={reportSearchTerm} 
                                onChange={e => setReportSearchTerm(e.target.value)}
                            />
                            <Search size={16} className="absolute left-2 top-2.5 text-gray-400"/>
                        </div>

                        <div className="mb-4"><label className="text-xs font-bold text-gray-500 mb-1 block">فیلتر شرکت</label><select className="w-full border rounded p-1 text-sm" value={reportFilterCompany} onChange={e => setReportFilterCompany(e.target.value)}><option value="">همه شرکت‌ها</option>{availableCompanies.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                        <div className="flex flex-col gap-2">
                            <button onClick={() => setActiveReport('general')} className={`p-2 rounded text-right text-sm ${activeReport === 'general' ? 'bg-blue-50 text-blue-700 font-bold' : 'hover:bg-gray-50'}`}>📄 لیست کلی پرونده‌ها</button>
                            <button onClick={() => setActiveReport('allocation_queue')} className={`p-2 rounded text-right text-sm ${activeReport === 'allocation_queue' ? 'bg-blue-50 text-blue-700 font-bold' : 'hover:bg-gray-50'}`}>⏳ در صف تخصیص</button>
                            <button onClick={() => setActiveReport('currency')} className={`p-2 rounded text-right text-sm ${activeReport === 'currency' ? 'bg-blue-50 text-blue-700 font-bold' : 'hover:bg-gray-50'}`}>💰 وضعیت خرید ارز</button>
                            <button onClick={() => setActiveReport('guarantee')} className={`p-2 rounded text-right text-sm ${activeReport === 'guarantee' ? 'bg-blue-50 text-blue-700 font-bold' : 'hover:bg-gray-50'}`}>🛡️ گزارش چک‌های تضمین</button>
                            <button onClick={() => setActiveReport('insurance_ledger')} className={`p-2 rounded text-right text-sm ${activeReport === 'insurance_ledger' ? 'bg-blue-50 text-blue-700 font-bold' : 'hover:bg-gray-50'}`}>📑 صورتحساب بیمه</button>
                            <button onClick={() => setActiveReport('company_performance')} className={`p-2 rounded text-right text-sm ${activeReport === 'company_performance' ? 'bg-blue-50 text-blue-700 font-bold' : 'hover:bg-gray-50'}`}>📊 عملکرد شرکت‌ها</button>
                        </div>
                        <div className="mt-auto pt-4">
                            <button onClick={handlePrintReport} className="w-full flex items-center justify-center gap-2 border p-2 rounded hover:bg-gray-50 text-gray-600"><Printer size={16}/> چاپ گزارش</button>
                            <button onClick={() => setViewMode('dashboard')} className="w-full mt-2 flex items-center justify-center gap-2 bg-gray-800 text-white p-2 rounded hover:bg-gray-900">بازگشت به داشبورد</button>
                        </div>
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 p-2 md:p-6 overflow-hidden flex flex-col w-full min-h-0 bg-gray-50">
                        <h2 className="text-xl font-bold mb-4 hidden md:block">
                            {activeReport === 'general' ? 'لیست کلی پرونده‌ها' : 
                            activeReport === 'allocation_queue' ? 'گزارش صف تخصیص' : 
                            activeReport === 'currency' ? 'گزارش وضعیت خرید ارز' : 
                            activeReport === 'company_performance' ? 'خلاصه عملکرد شرکت‌ها' : 
                            activeReport === 'insurance_ledger' ? 'صورتحساب و مانده بیمه' :
                            activeReport === 'guarantee' ? 'گزارش جامع چک‌های تضمین' :
                            'گزارش'}
                        </h2>
                        {renderReportContent}
                    </div>
                </div>
            </div>
        );
    }


    const renderTrancheDeliveriesModal = () => {
        if (!selectedTrancheForDeliveries) return null;
        const tr = (selectedRecord?.currencyPurchaseData?.tranches || []).find((t) => t.id === selectedTrancheForDeliveries) || 
                   currencyForm.tranches?.find(t => t.id === selectedTrancheForDeliveries);
        if (!tr) return null;
        const deliveries = tr.deliveries || [];
        return (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
                <div className="glass-panel rounded-2xl shadow-xl w-full max-w-4xl bg-white p-6 animate-scale-in max-h-[90vh] overflow-y-auto text-right" dir="rtl">
                    <div className="flex justify-between items-center mb-6 border-b pb-3">
                        <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                            <Coins size={22} className="text-green-600"/>
                            ثبت و مدیریت تحویل‌های پارت
                        </h3>
                        <button onClick={() => setSelectedTrancheForDeliveries(null)} className="p-1 hover:bg-gray-100 rounded-lg"><X size={20} className="text-gray-400 hover:text-red-500" /></button>
                    </div>

                    {/* Tranche Specs Card */}
                    <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 mb-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                        <div><span className="text-gray-500 block">مبلغ کل پارت:</span><span className="font-bold font-mono text-amber-800 text-sm">{formatNumberString(tr.amount)} {tr.currencyType}</span></div>
                        <div><span className="text-gray-500 block">کل هزینه ریالی:</span><span className="font-bold font-mono text-gray-800">{formatNumberString(tr.rialAmount || 0)} ریال</span></div>
                        <div><span className="text-gray-500 block">صرافی/کارگزار:</span><span className="font-bold">{tr.exchangeName || '-'} {tr.brokerName ? `(${tr.brokerName})` : ''}</span></div>
                        <div><span className="text-gray-500 block">تاریخ خرید:</span><span className="font-bold">{tr.date || '-'}</span></div>
                    </div>

                    {/* Add Delivery Form */}
                    <div className="border p-4 rounded-xl mb-6 bg-gray-50 text-right">
                        <h4 className="font-bold text-sm text-gray-700 mb-3 flex items-center gap-1">افزودن تحویل جدید</h4>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-600">مقدار تحویلی *</label>
                                <input 
                                    className="w-full border rounded-lg p-2 text-sm dir-ltr font-bold text-green-700 bg-white" 
                                    value={newDeliveryForm.amount} 
                                    onChange={e => setNewDeliveryForm({...newDeliveryForm, amount: e.target.value})} 
                                    onBlur={e => setNewDeliveryForm({...newDeliveryForm, amount: formatNumberString(deformatNumberString(e.target.value))})}
                                    placeholder="مقدار ارز..." 
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-600">تاریخ تحویل</label>
                                <input 
                                    className="w-full border rounded-lg p-2 text-sm dir-ltr bg-white" 
                                    value={newDeliveryForm.date} 
                                    onChange={e => setNewDeliveryForm({...newDeliveryForm, date: e.target.value})} 
                                    placeholder="۱۴۰۳/۰۱/۰۱" 
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-600 font-sans">تحویل‌گیرنده</label>
                                <input 
                                    className="w-full border rounded-lg p-2 text-sm bg-white" 
                                    value={newDeliveryForm.recipientName} 
                                    onChange={e => setNewDeliveryForm({...newDeliveryForm, recipientName: e.target.value})} 
                                    placeholder="نام شخص..." 
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-600 font-sans">توضیحات</label>
                                <input 
                                    className="w-full border rounded-lg p-2 text-sm bg-white" 
                                    value={newDeliveryForm.description} 
                                    onChange={e => setNewDeliveryForm({...newDeliveryForm, description: e.target.value})} 
                                    placeholder="توضیحات..." 
                                />
                            </div>
                        </div>
                        <button 
                            onClick={handleAddTrancheDelivery} 
                            className="mt-4 w-full bg-green-600 text-white rounded-lg p-2 font-bold hover:bg-green-700 text-sm transition-all flex items-center justify-center gap-1"
                        >
                            <Plus size={16}/> ثبت تحویل
                        </button>
                    </div>

                    {/* Deliveries List */}
                    <h4 className="font-bold text-sm text-gray-700 mb-3">تحویل‌های ثبت شده</h4>
                    {deliveries.length === 0 ? (
                        <div className="text-center py-6 text-xs text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">تحویلی برای این پارت ثبت نشده است.</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs text-right mt-1 border-collapse">
                                <thead className="bg-blue-800 text-white shadow-sm border-b-2 border-slate-200">
                                    <tr>
                                        <th className="p-3 text-center align-middle border border-blue-700">تاریخ</th>
                                        <th className="p-3 text-center align-middle border border-blue-700">مقدار ارز خریداری شده (پارت)</th>
                                        <th className="p-3 text-center align-middle border border-blue-700 bg-blue-700">مقدار تحویلی</th>
                                        <th className="p-3 text-center align-middle border border-blue-700">معادل دلاری خرید ارز</th>
                                        <th className="p-3 text-center align-middle border border-blue-700">معادل دلاری تحویلی</th>
                                        <th className="p-3 text-center align-middle border border-blue-700">تحویل‌گیرنده</th>
                                        <th className="p-3 text-center align-middle border border-blue-700">توضیحات</th>
                                        <th className="p-3 text-center align-middle border border-blue-700">حذف</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {deliveries.map((delivery, dIdx) => (
                                        <tr key={delivery.id} className={`border-b transition-colors hover:bg-blue-50 ${dIdx % 2 === 0 ? 'bg-slate-50' : 'bg-white'}`}>
                                            <td className="p-3 font-mono text-center align-middle border border-slate-200">{delivery.date || '-'}</td>
                                            <td className="p-3 font-mono font-bold text-slate-700 text-center align-middle border border-slate-200">{formatNumberString(tr.amount)} <span className="text-[10px] text-slate-500 font-sans">{tr.currencyType}</span></td>
                                            <td className="p-3 font-mono font-bold text-green-700 text-center align-middle border border-slate-200 bg-green-50/50">{formatNumberString(delivery.amount)} <span className="text-[10px] text-green-500 font-sans">{tr.currencyType}</span></td>
                                            <td className="p-3 font-mono font-bold text-blue-700 text-center align-middle border border-slate-200">
                                                {(() => {
                                                    let usdRate = 0;
                                                    const cType = tr.currencyType;
                                                    if (cType === 'EUR') usdRate = 1.08;
                                                    else if (cType === 'AED') usdRate = 0.272;
                                                    else if (cType === 'CNY') usdRate = 0.14;
                                                    else if (cType === 'TRY') usdRate = 0.031;
                                                    else if (cType === 'USD') usdRate = 1;
                                                    return usdRate > 0 ? (tr.amount * usdRate).toLocaleString('en-US', {maximumFractionDigits:2}) + ' $' : '-';
                                                })()}
                                            </td>
                                            <td className="p-3 font-mono font-bold text-blue-700 text-center align-middle border border-slate-200 bg-blue-50/50">
                                                {(() => {
                                                    let usdRate = 0;
                                                    const cType = tr.currencyType;
                                                    if (cType === 'EUR') usdRate = 1.08;
                                                    else if (cType === 'AED') usdRate = 0.272;
                                                    else if (cType === 'CNY') usdRate = 0.14;
                                                    else if (cType === 'TRY') usdRate = 0.031;
                                                    else if (cType === 'USD') usdRate = 1;
                                                    return usdRate > 0 ? (delivery.amount * usdRate).toLocaleString('en-US', {maximumFractionDigits:2}) + ' $' : '-';
                                                })()}
                                            </td>
                                            <td className="p-3 text-center align-middle border border-slate-200 text-slate-700">{delivery.recipientName || '-'}</td>
                                            <td className="p-3 text-slate-500 text-center align-middle border border-slate-200">{delivery.description || '-'}</td>
                                            <td className="p-3 text-center align-middle border border-slate-200">
                                                <button 
                                                    onClick={() => handleRemoveTrancheDelivery(tr.id, delivery.id)} 
                                                    className="text-red-500 hover:text-red-700 transition"
                                                >
                                                    <Trash2 size={16}/>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-slate-100 border-t-2 border-slate-300 font-bold">
                                    <tr>
                                        <td className="p-3 text-center align-middle border border-slate-200">مجموع تحویل‌ها</td>
                                        <td className="p-3 text-center align-middle border border-slate-200 font-mono text-slate-800">{formatNumberString(tr.amount)} {tr.currencyType}</td>
                                        <td className="p-3 text-center align-middle border border-slate-200 font-mono text-green-800 bg-green-100/50">{formatNumberString(deliveries.reduce((sum, d) => sum + d.amount, 0))} {tr.currencyType}</td>
                                        <td colSpan={5} className="border border-slate-200"></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    if (selectedRecord && viewMode === 'details') {
        const tabList = [
            { key: 'timeline', label: 'روندنما', icon: <History size={16} /> },
            { key: 'proforma', label: 'پروفرما و اقلام', icon: <FileText size={16} /> },
            { key: 'insurance', label: 'بیمه', icon: <Shield size={16} /> },
            { key: 'currency_purchase', label: 'خرید ارز', icon: <Coins size={16} /> },
            { key: 'shipping_docs', label: 'اسناد حمل', icon: <Box size={16} /> },
            { key: 'inspection', label: 'بازرسی', icon: <Microscope size={16} /> },
            { key: 'clearance_docs', label: 'ترخیصیه و انبار', icon: <Warehouse size={16} /> },
            { key: 'green_leaf', label: 'برگ سبز', icon: <Leaf size={16} /> },
            { key: 'internal_shipping', label: 'حمل داخلی', icon: <Truck size={16} /> },
            { key: 'agent_fees', label: 'هزینه‌های ترخیص', icon: <FileSpreadsheet size={16} /> },
            { key: 'final_calculation', label: 'محاسبه بهای کالا', icon: <Calculator size={16} /> },
        ];

        return (
            <div className="flex flex-col h-full bg-gray-50/50">
                {/* Header */}
                <div className="p-4 bg-white border-b sticky top-0 z-30 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <button onClick={() => {setSelectedRecord(null); setViewMode('dashboard');}} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all active:scale-95 text-gray-700">
                            <ChevronRight size={18}/>
                        </button>
                        <div className="border-r pr-3">
                            <h2 className="text-xl font-black text-gray-800 flex items-center gap-2">
                                پرونده: {selectedRecord.fileNumber}
                                <button 
                                    onClick={async () => {
                                        const newStatus: 'Active' | 'Completed' = selectedRecord.status === 'Completed' ? 'Active' : 'Completed';
                                        const updated: TradeRecord = { ...selectedRecord, status: newStatus };
                                        await updateTradeRecord(updated);
                                        setSelectedRecord(updated);
                                        setRecords(prev => prev.map(r => r.id === updated.id ? updated : r));
                                    }}
                                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold cursor-pointer transition-all active:scale-95 ${selectedRecord.status === 'Completed' ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'}`}
                                >
                                    {selectedRecord.status === 'Completed' ? 'پایان یافته (تغییر)' : 'درحال اقدام (تغییر)'}
                                </button>
                            </h2>
                            <p className="text-xs text-gray-500 font-medium">{selectedRecord.goodsName} - {selectedRecord.company}</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2 w-full md:w-auto">
                        <button 
                            onClick={() => setShowFinalReportPrint(true)} 
                            className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all"
                        >
                            <Printer size={14} /> گزارش هزینه نهایی
                        </button>
                        <button 
                            onClick={() => setShowClearancePrint(true)} 
                            className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all"
                        >
                            <Printer size={14} /> پیوست ترخیص
                        </button>
                    </div>
                </div>

                {/* Main Tabs Horizontal Row */}
                <div className="bg-white border-b px-4 py-2 overflow-x-auto whitespace-nowrap scrollbar-hide flex gap-1.5 scroll-smooth z-20">
                    {tabList.map(tab => {
                        const isActive = activeTab === tab.key;
                        return (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key as any)}
                                className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${isActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/10' : 'text-gray-600 hover:bg-gray-100'}`}
                            >
                                {tab.icon}
                                {tab.label}
                            </button>
                        );
                    })}
                </div>

                {/* Tab Contents Frame */}
                <div className="flex-1 overflow-auto p-4 md:p-6 custom-scrollbar font-sans text-right">
                    
                    {/* TIMELINE TAB */}
                    {activeTab === 'timeline' && (
                        <div className="max-w-4xl mx-auto space-y-6">
                            <div className="glass-panel p-6 rounded-2xl border border-gray-200/80 shadow-sm space-y-6">
                                <h3 className="font-black text-lg text-gray-800">روندنمای پیشرفت مراحل پرونده</h3>
                                <div className="space-y-4 relative pr-4 border-r border-blue-100/60 mr-2">
                                    {Object.values(TradeStage).map((stage, idx) => {
                                        const stageData = getStageData(selectedRecord, stage);
                                        const isCompleted = stageData.isCompleted;

                                        return (
                                            <div key={idx} className="relative flex justify-between items-start gap-4 pb-4">
                                                {/* Bullet Bullet */}
                                                <div className={`absolute right-[-21px] top-1 w-3 h-3 rounded-full border-2 bg-white transition-colors ${isCompleted ? 'bg-green-500 border-green-500' : 'bg-gray-200 border-gray-300'}`} />
                                                
                                                <div className="flex-1 bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-3 hover:shadow-md transition-all">
                                                    <div>
                                                        <h4 className="font-bold text-sm text-gray-800 dark:text-gray-200">{stage}</h4>
                                                        {stageData.updatedAt ? <p className="text-[10px] text-gray-400 font-mono mt-1">بروزرسانی: {new Date(stageData.updatedAt).toLocaleDateString('fa-IR')}</p> : null}
                                                        {stageData.description && <p className="text-xs text-slate-500 mt-2 whitespace-pre-line leading-relaxed">{stageData.description}</p>}
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        {stageData.costRial > 0 && <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-1 rounded-lg font-mono">{formatCurrency(stageData.costRial)} ریال</span>}
                                                        <button 
                                                            onClick={() => {
                                                                setEditingStage(stage);
                                                                setStageFormData(stageData);
                                                            }}
                                                            className="text-xs font-black text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-all"
                                                        >
                                                            بروزرسانی وضعیت
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* PROFORMA TAB */}
                    {activeTab === 'proforma' && (
                        <div className="max-w-5xl mx-auto space-y-6">
                            {/* Proforma Overview Card */}
                            <div className="glass-panel p-6 rounded-2xl border border-gray-200/80 shadow-sm space-y-6">
                                <h3 className="font-black text-lg text-gray-800 flex justify-between items-center pb-2 border-b">
                                    <span>مشخصات پروفرما و مجوزها</span>
                                    <button 
                                        onClick={() => setShowEditMetadataModal(true)} 
                                        className="text-xs bg-gray-50 hover:bg-gray-100 text-blue-600 font-bold px-3 py-1.5 rounded-lg border flex items-center gap-1"
                                    >
                                        <Edit size={12} /> ویرایش فیلدهای اصلی
                                    </button>
                                </h3>

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-bold text-gray-600 font-sans">
                                    <div className="space-y-1 bg-gray-50 p-3 rounded-xl border">
                                        <span className="text-slate-400">شماره ثبت سفارش:</span>
                                        <div className="text-sm font-black text-slate-800 font-mono">{selectedRecord.registrationNumber || '-'}</div>
                                    </div>
                                    <div className="space-y-1 bg-gray-50 p-3 rounded-xl border">
                                        <span className="text-slate-400">تاریخ ثبت سفارش:</span>
                                        <div className="text-sm font-black text-slate-800 font-mono">{selectedRecord.registrationDate || '-'}</div>
                                    </div>
                                    <div className="space-y-1 bg-gray-50 p-3 rounded-xl border">
                                        <span className="text-slate-400">فروشنده خارجی:</span>
                                        <div className="text-sm font-black text-slate-800">{selectedRecord.sellerName || '-'}</div>
                                    </div>
                                    <div className="space-y-1 bg-gray-50 p-3 rounded-xl border">
                                        <span className="text-slate-400">شرح کالا (پروفرما):</span>
                                        <div className="text-sm font-black text-slate-800">{selectedRecord.goodsName || '-'}</div>
                                    </div>
                                </div>
                            </div>

                            {/* Proforma Items Card */}
                            <div className="glass-panel p-6 rounded-2xl border border-gray-200/80 shadow-sm space-y-6">
                                <div className="flex justify-between items-center pb-2 border-b">
                                    <h4 className="font-black text-md text-gray-800">اقلام ثبت سفارش (پروفرما)</h4>
                                    <button 
                                        onClick={async () => {
                                            if (window.confirm('آیا از بازنشانی و همگام‌سازی اقلام پروفرما بر اساس اقلام اسناد حمل (سیاهه تجاری) اطمینان دارید؟')) {
                                                const shippingInvoices = selectedRecord.shippingDocuments?.find(d => d.type === 'Commercial Invoice' && d.invoiceItems?.length);
                                                if (!shippingInvoices) {
                                                    alert('هیچ سیاهه تجاری نهایی با اقلام ثبت شده جهت همگام‌سازی یافت نشد.');
                                                    return;
                                                }
                                                const updatedItems = shippingInvoices.invoiceItems.map(x => ({
                                                    id: generateUUID(),
                                                    name: x.name,
                                                    weight: x.weight || 0,
                                                    unitPrice: x.unitPrice || 0,
                                                    totalPrice: x.totalPrice || 0,
                                                    hsCode: ''
                                                }));
                                                const updated = { ...selectedRecord, items: updatedItems };
                                                await updateTradeRecord(updated);
                                                setSelectedRecord(updated);
                                                alert('همگام‌سازی با موفقیت انجام شد.');
                                            }
                                        }}
                                        className="text-[10px] bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold px-2 py-1 rounded border border-amber-200 flex items-center gap-1 transition-all active:scale-95"
                                    >
                                        <RefreshCw size={10} /> همگام‌سازی از سیاهه تجاری
                                    </button>
                                </div>

                                {/* Add proforma item form */}
                                <div className="grid grid-cols-1 md:grid-cols-5 gap-3 bg-gray-50/50 p-4 rounded-xl border font-sans">
                                    <div className="space-y-1 col-span-1 md:col-span-2">
                                        <label className="text-xs font-black text-slate-600">شرح تفصیلی محصول</label>
                                        <input 
                                            className="w-full border rounded-lg p-2 text-sm bg-white" 
                                            value={newItem.name || ''} 
                                            onChange={e => setNewItem({...newItem, name: e.target.value})} 
                                            placeholder="نام محصول..." 
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-black text-slate-600">وزن کل (KG)</label>
                                        <input 
                                            className="w-full border rounded-lg p-2 text-sm bg-white font-mono text-left dir-ltr" 
                                            value={newItem.weightStr || ''} 
                                            onChange={e => {
                                                const formatted = formatNumberString(deformatNumberString(e.target.value));
                                                setNewItem({...newItem, weightStr: formatted});
                                            }} 
                                            placeholder="وزن کیلوگرم..." 
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-black text-slate-600">ارزش کل FOB ({selectedRecord.mainCurrency})</label>
                                        <input 
                                            className="w-full border rounded-lg p-2 text-sm bg-white font-mono text-left dir-ltr" 
                                            value={newItem.unitPriceStr || ''} 
                                            onChange={e => {
                                                const formatted = formatNumberString(deformatNumberString(e.target.value));
                                                setNewItem({...newItem, unitPriceStr: formatted});
                                            }} 
                                            placeholder="مبلغ کل FOB..." 
                                        />
                                    </div>
                                    <div className="space-y-1 flex items-end">
                                        <button 
                                            onClick={handleAddItem}
                                            disabled={!newItem.name}
                                            className="w-full bg-blue-600 text-white rounded-lg p-2 font-bold hover:bg-blue-700 transition-all flex justify-center items-center gap-1 text-xs"
                                        >
                                            <Plus size={14} /> {editingItemId ? 'ویرایش کالا' : 'افزودن کالا'}
                                        </button>
                                    </div>
                                </div>

                                {/* Items list table */}
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs text-right mt-1 font-sans">
                                        <thead className="bg-gray-100 text-gray-700 border-b">
                                            <tr>
                                                <th className="p-3">نام و شرح تفصیلی</th>
                                                <th className="p-3 text-center">وزن فیزیکی (KG)</th>
                                                <th className="p-3 text-center">ارزش FOB ({selectedRecord.mainCurrency})</th>
                                                <th className="p-3 text-center">قیمت واحد FOB</th>
                                                <th className="p-3 text-center">عملیات</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {selectedRecord.items?.map((item, idx) => (
                                                <tr key={item.id} className="border-b hover:bg-gray-50/50">
                                                    <td className="p-3 font-bold text-slate-800">{item.name}</td>
                                                    <td className="p-3 text-center font-mono">{formatNumberString(item.weight)}</td>
                                                    <td className="p-3 text-center font-mono font-bold text-blue-600">{formatNumberString(item.totalPrice)}</td>
                                                    <td className="p-3 text-center font-mono text-slate-500">{formatNumberString(item.unitPrice)}</td>
                                                    <td className="p-3 text-center flex justify-center gap-2">
                                                        <button onClick={() => handleEditItem(item)} className="text-blue-600 hover:text-blue-800 font-bold">ویرایش</button>
                                                        <button onClick={() => handleRemoveItem(item.id)} className="text-red-600 hover:text-red-800 font-bold">حذف</button>
                                                    </td>
                                                </tr>
                                            ))}
                                            {selectedRecord.items?.length === 0 && (
                                                <tr>
                                                    <td colSpan={5} className="p-6 text-center text-slate-400 italic">هیچ کالایی برای این پروفرما ثبت نشده است.</td>
                                                </tr>
                                            )}
                                        </tbody>
                                        {selectedRecord.items?.length > 0 && (
                                            <tfoot className="bg-gray-50 font-black text-slate-800 border-t">
                                                <tr>
                                                    <td className="p-3 font-bold text-slate-800">جمع کل</td>
                                                    <td className="p-3 text-center font-mono text-amber-800">{formatNumberString(selectedRecord.items.reduce((acc, t) => acc + t.weight, 0))} <span className="text-[9px] text-slate-400 font-sans">KG</span></td>
                                                    <td className="p-3 text-center font-mono text-blue-800">{formatNumberString(selectedRecord.items.reduce((acc, t) => acc + t.totalPrice, 0))} <span className="text-[9px] text-slate-400 font-sans">{selectedRecord.mainCurrency}</span></td>
                                                    <td colSpan={2}></td>
                                                </tr>
                                            </tfoot>
                                        )}
                                    </table>
                                </div>
                            </div>

                            {/* Ordering License / Govt Expenses */}
                            <div className="glass-panel p-6 rounded-2xl border border-gray-200/80 shadow-sm space-y-6">
                                <h4 className="font-black text-md text-gray-800">کارمزدها و هزینه‌های بانکی ثبت سفارش (ریال)</h4>
                                
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-gray-50/50 p-4 rounded-xl border font-sans">
                                    <div className="space-y-1">
                                        <label className="text-xs font-black text-slate-600">باکس / بانک پرداخت‌کننده</label>
                                        <input className="w-full border rounded-lg p-2 text-sm bg-white" value={newLicenseTx.bank || ''} onChange={e => setNewLicenseTx({...newLicenseTx, bank: e.target.value})} placeholder="نام بانک..." />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-black text-slate-600">مبلغ کارمزد (ریال)</label>
                                        <input className="w-full border rounded-lg p-2 text-sm bg-white font-mono text-left dir-ltr" value={newLicenseTx.amount ? formatNumberString(newLicenseTx.amount) : ''} onChange={e => setNewLicenseTx({...newLicenseTx, amount: Number(deformatNumberString(e.target.value))})} placeholder="مبلغ ریالی..." />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-black text-slate-600">شرح تراکنش</label>
                                        <input className="w-full border rounded-lg p-2 text-sm bg-white" value={newLicenseTx.description || ''} onChange={e => setNewLicenseTx({...newLicenseTx, description: e.target.value})} placeholder="بابت..." />
                                    </div>
                                    <div className="space-y-1 flex items-end">
                                        <button onClick={handleAddLicenseTx} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold p-2 text-xs rounded-lg transition-all flex items-center justify-center gap-1"><Plus size={14} /> ثبت هزینه</button>
                                    </div>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs text-right mt-1 font-sans">
                                        <thead className="bg-gray-100 text-gray-700 border-b">
                                            <tr>
                                                <th className="p-3">شرح بابت</th>
                                                <th className="p-3 text-center">بانک</th>
                                                <th className="p-3 text-center">مبلغ تراکنش (ریال)</th>
                                                <th className="p-3 text-center">تاریخ ثبت</th>
                                                <th className="p-3 text-center">حذف</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {selectedRecord.licenseData?.transactions?.map((tx, idx) => (
                                                <tr key={tx.id || idx} className="border-b hover:bg-gray-50/50">
                                                    <td className="p-3 font-bold text-slate-800">{tx.description}</td>
                                                    <td className="p-3 text-center">{tx.bank}</td>
                                                    <td className="p-3 text-center font-mono font-bold text-blue-600">{formatNumberString(tx.amount)}</td>
                                                    <td className="p-3 text-center font-mono">{tx.date || '-'}</td>
                                                    <td className="p-3 text-center">
                                                        <button onClick={() => handleRemoveLicenseTx(tx.id)} className="text-red-600 hover:text-red-800 font-bold">حذف</button>
                                                    </td>
                                                </tr>
                                            ))}
                                            {(selectedRecord.licenseData?.transactions || []).length === 0 && (
                                                <tr>
                                                    <td colSpan={5} className="p-6 text-center text-slate-400 italic">هیچ تراکنش کارمزدی ثبت نشده است.</td>
                                                </tr>
                                            )}
                                        </tbody>
                                        {(selectedRecord.licenseData?.transactions || []).length > 0 && (
                                            <tfoot className="bg-gray-50 border-t font-black">
                                                <tr>
                                                    <td colSpan={2} className="p-3">جمع تراکنش‌ها</td>
                                                    <td className="p-3 text-center font-mono text-blue-800">{formatNumberString((selectedRecord.licenseData?.transactions || []).reduce((acc, t) => acc + t.amount, 0))} ریال</td>
                                                    <td colSpan={2}></td>
                                                </tr>
                                            </tfoot>
                                        )}
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* INSURANCE TAB */}
                    {activeTab === 'insurance' && (
                        <div className="max-w-4xl mx-auto space-y-6">
                            <InsuranceTab 
                                form={insuranceForm} 
                                setForm={setInsuranceForm} 
                                companies={settings?.insuranceCompanies || []} 
                                banks={availableBanks.length > 0 ? availableBanks : operatingBanks} 
                                onSave={handleSaveInsurance} 
                                newEndorsement={newEndorsement} 
                                setNewEndorsement={setNewEndorsement} 
                                endorsementType={endorsementType} 
                                setEndorsementType={setEndorsementType} 
                                onAddEndorsement={handleAddEndorsement} 
                                onDeleteEndorsement={handleDeleteEndorsement} 
                            />
                        </div>
                    )}

                    {/* CURRENCY PURCHASE TAB */}
                    {activeTab === 'currency_purchase' && (
                        <div className="max-w-5xl mx-auto space-y-6">
                            <div className="glass-panel p-6 rounded-2xl border border-gray-200/80 shadow-sm space-y-6">
                                <h3 className="font-black text-lg text-gray-800 pb-2 border-b">مدیریت پارت‌های خرید ارز (حوالجات)</h3>

                                {/* Add currency tranche form */}
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-gray-50/50 p-4 rounded-xl border mt-3 text-right">
                                    <div className="space-y-1">
                                        <label className="text-xs font-black text-slate-600">صرافی / کارگزار</label>
                                        <input className="w-full border rounded-lg p-2 text-sm bg-white" value={newCurrencyTranche.exchangeName || ''} onChange={e => setNewCurrencyTranche({...newCurrencyTranche, exchangeName: e.target.value})} placeholder="نام صرافی..." />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-black text-slate-600">رابط / کارگزار بانک</label>
                                        <input className="w-full border rounded-lg p-2 text-sm bg-white" value={newCurrencyTranche.brokerName || ''} onChange={e => setNewCurrencyTranche({...newCurrencyTranche, brokerName: e.target.value})} placeholder="رابط کارگزار..." />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-black text-slate-600">مقدار ارز خریدی</label>
                                        <input className="w-full border rounded-lg p-2 text-sm bg-white font-mono text-left dir-ltr" value={newCurrencyTranche.amountStr || ''} onChange={e => setNewCurrencyTranche({...newCurrencyTranche, amountStr: formatNumberString(deformatNumberString(e.target.value))})} placeholder="ارز خریداری شده..." />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-black text-slate-600">نرخ تسویه ریالی</label>
                                        <input className="w-full border rounded-lg p-2 text-sm bg-white font-mono text-left dir-ltr" value={newCurrencyTranche.rialAmountStr || ''} onChange={e => setNewCurrencyTranche({...newCurrencyTranche, rialAmountStr: formatNumberString(deformatNumberString(e.target.value))})} placeholder="نرخ تمام شده..." />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-black text-slate-600">کارمزد ارزی</label>
                                        <input className="w-full border rounded-lg p-2 text-sm bg-white font-mono text-left dir-ltr" value={newCurrencyTranche.currencyFeeStr || ''} onChange={e => setNewCurrencyTranche({...newCurrencyTranche, currencyFeeStr: formatNumberString(deformatNumberString(e.target.value))})} placeholder="کارمزد خرید..." />
                                    </div>
                                    <div className="space-y-1 col-span-1 md:col-span-2 flex items-center gap-3">
                                        <label className="flex items-center gap-2 cursor-pointer mt-4 text-xs font-black text-slate-700">
                                            <input type="checkbox" checked={!!newCurrencyTranche.isDelivered} onChange={e => setNewCurrencyTranche({...newCurrencyTranche, isDelivered: e.target.checked})} />
                                            پارت ارز تحویل شده است
                                        </label>
                                    </div>
                                    <div className="space-y-1 flex items-end">
                                        <button onClick={handleAddCurrencyTranche} className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold p-2 text-xs rounded-lg flex items-center justify-center gap-1"><Plus size={14} /> {editingTrancheId ? 'ویرایش حواله' : 'ثبت حواله جدید'}</button>
                                    </div>
                                </div>

                                {/* Tranches Table */}
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs text-right mt-1 font-sans">
                                        <thead className="bg-gray-100 text-gray-700 border-b">
                                            <tr>
                                                <th className="p-3">صرافی / کارگزار</th>
                                                <th className="p-3 text-center">تاریخ</th>
                                                <th className="p-3 text-center">مقدار ارز خریداری</th>
                                                <th className="p-3 text-center">پرداختی (ریال)</th>
                                                <th className="p-3 text-center">کارمزد</th>
                                                <th className="p-3 text-center">تحویل</th>
                                                <th className="p-3 text-center">عملیات</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(selectedRecord.currencyPurchaseData?.tranches || currencyForm.tranches)?.map((t, idx) => (
                                                <tr key={t.id || idx} className="border-b hover:bg-gray-50/50">
                                                    <td className="p-3 font-bold text-slate-800">{t.exchangeName} {t.brokerName ? `(${t.brokerName})` : ''}</td>
                                                    <td className="p-3 text-center font-mono">{t.date || '-'}</td>
                                                    <td className="p-3 text-center font-mono font-bold text-blue-600">{formatNumberString(t.amount)} {t.currencyType}</td>
                                                    <td className="p-3 text-center font-mono text-emerald-700">{formatNumberString(t.rialAmount || 0)} ریال</td>
                                                    <td className="p-3 text-center font-mono text-slate-400">{t.currencyFee ? formatNumberString(t.currencyFee) : '-'}</td>
                                                    <td className="p-3 text-center">
                                                        <button 
                                                            onClick={() => handleToggleTrancheDelivery(t.id)}
                                                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${t.isDelivered ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                                                        >
                                                            {t.isDelivered ? 'تحویل شده' : 'ناقص (کلیک برای تحویل)'}
                                                        </button>
                                                    </td>
                                                    <td className="p-3 text-center flex justify-center gap-2">
                                                        <button onClick={() => { setSelectedTrancheForDeliveries(t.id); }} className="text-slate-600 hover:text-slate-800 font-bold">تحویلی‌ها({t.deliveries?.length || 0})</button>
                                                        <button onClick={() => handleEditTranche(t)} className="text-blue-600 hover:text-blue-800 font-bold">ویرایش</button>
                                                        <button onClick={() => handleRemoveTranche(t.id)} className="text-red-600 hover:text-red-800 font-bold">حذف</button>
                                                    </td>
                                                </tr>
                                            ))}
                                            {((selectedRecord.currencyPurchaseData?.tranches || currencyForm.tranches) || []).length === 0 && (
                                                <tr>
                                                    <td colSpan={7} className="p-6 text-center text-slate-400 italic">هیچ حواله‌ای ثبت نشده است.</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Currency Guarantees Section */}
                            <div className="glass-panel p-6 rounded-2xl border border-gray-200/80 shadow-sm space-y-6">
                                <CurrencyGuaranteeSection 
                                    guarantees={selectedRecord.currencyPurchaseData?.guaranteeCheques || currencyForm.guaranteeCheques || []}
                                    onAdd={handleAddCurrencyGuarantee}
                                    onDelete={handleDeleteCurrencyGuarantee}
                                    onToggleDelivery={handleToggleCurrencyGuaranteeDelivery}
                                    companyBanks={availableBanks.length > 0 ? availableBanks : operatingBanks}
                                />
                            </div>
                        </div>
                    )}

                    {/* SHIPPING DOCUMENTS SUB-TAB SYSTEM */}
                    {activeTab === 'shipping_docs' && (
                        <div className="max-w-5xl mx-auto space-y-6">
                            <div className="flex flex-col md:flex-row gap-6">
                                {/* Subtab list vertical sidebar */}
                                <div className="w-full md:w-48 flex flex-row md:flex-col gap-2 font-sans">
                                    {['Commercial Invoice', 'Packing List', 'Bill of Lading', 'Certificate of Origin'].map((docType) => {
                                        const isActive = activeShippingSubTab === docType;
                                        return (
                                            <button
                                                key={docType}
                                                onClick={() => setActiveShippingSubTab(docType as any)}
                                                className={`flex-1 p-3 rounded-xl text-xs font-bold text-center md:text-right transition-all cursor-pointer ${isActive ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 hover:bg-gray-200 text-slate-700'}`}
                                            >
                                                {docType === 'Commercial Invoice' ? 'سیاهه تجاری / Invoice' : 
                                                 docType === 'Packing List' ? 'عدل‌بندی / Packing List' : 
                                                 docType === 'Bill of Lading' ? 'بارنامه حمل' : 'گواهی مبدا'}
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Form Frame */}
                                <div className="flex-1 bg-white p-6 rounded-2xl border shadow-sm space-y-6">
                                    <h4 className="font-black text-md text-gray-800 pb-2 border-b">
                                        {activeShippingSubTab === 'Commercial Invoice' ? 'سیاهه تجاری (Commercial Invoice)' : 
                                         activeShippingSubTab === 'Packing List' ? 'لیست عدل‌بندی (Packing List)' : 
                                         activeShippingSubTab === 'Bill of Lading' ? 'بارنامه حمل / Bill of Lading' : 'گواهی مبدا سفر'}
                                    </h4>

                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 font-sans">
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-slate-600">شماره سند / مدرک</label>
                                            <input className="w-full border rounded-lg p-2 text-sm bg-white font-mono text-left dir-ltr" value={shippingDocForm.documentNumber || ''} onChange={e => setShippingDocForm({...shippingDocForm, documentNumber: e.target.value})} placeholder="Doc Number..." />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-slate-600">پارت / دوره حمل</label>
                                            <input className="w-full border rounded-lg p-2 text-sm bg-white" placeholder="مثلا دور اول" value={shippingDocForm.description || ''} onChange={e => setShippingDocForm({...shippingDocForm, description: e.target.value})} />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-slate-600">تاریخ ثبت سند</label>
                                            <input className="w-full border rounded-lg p-2 text-sm bg-white font-mono text-left dir-ltr" value={shippingDocForm.documentDate || ''} onChange={e => setShippingDocForm({...shippingDocForm, documentDate: e.target.value})} placeholder="۱۴۰۳/۰۱/۰۱" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-slate-600">وضعیت سند</label>
                                            <select className="w-full border rounded-lg p-2 text-sm bg-white" value={shippingDocForm.status || 'Draft'} onChange={e => setShippingDocForm({...shippingDocForm, status: e.target.value as any})}>
                                                <option value="Draft">پیش‌نویس</option>
                                                <option value="Final">نهایی کانتینر</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* Invoice items layout */}
                                    {activeShippingSubTab === 'Commercial Invoice' && (
                                        <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100/50 space-y-4">
                                            <h5 className="font-bold text-xs text-blue-800">اقلام فاکتور خرید خارجی کالا</h5>
                                            <div className="grid grid-cols-1 md:grid-cols-4 gap-2 font-sans text-xs">
                                                <input className="border rounded-lg p-2" placeholder="نام کالا..." value={newInvoiceItem.name || ''} onChange={e => setNewInvoiceItem({...newInvoiceItem, name: e.target.value})} />
                                                <input className="border rounded-lg p-2 font-mono text-left" placeholder="وزن خالص..." value={newInvoiceItem.weight || ''} onChange={e => setNewInvoiceItem({...newInvoiceItem, weight: Number(e.target.value)})} />
                                                <input className="border rounded-lg p-2 font-mono text-left" placeholder="ارزش FOB..." value={newInvoiceItem.totalPrice || ''} onChange={e => setNewInvoiceItem({...newInvoiceItem, totalPrice: Number(e.target.value)})} />
                                                <button 
                                                    onClick={async () => {
                                                        if (!newInvoiceItem.name || !newInvoiceItem.totalPrice) return;
                                                        const newItemData: InvoiceItem = { 
                                                            id: generateUUID(), 
                                                            name: newInvoiceItem.name || '',
                                                            weight: newInvoiceItem.weight || 0,
                                                            totalPrice: newInvoiceItem.totalPrice || 0,
                                                            unitPrice: (newInvoiceItem.weight || 0) > 0 ? (newInvoiceItem.totalPrice / (newInvoiceItem.weight || 0)) : 0,
                                                            part: newInvoiceItem.part || ''
                                                        };
                                                        const updatedItems = [...(shippingDocForm.invoiceItems || []), newItemData];
                                                        setShippingDocForm({...shippingDocForm, invoiceItems: updatedItems});
                                                        setNewInvoiceItem({ name: '', weight: 0, unitPrice: 0, totalPrice: 0, part: '' });
                                                    }}
                                                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold p-2 rounded-lg flex items-center justify-center gap-1 active:scale-95"
                                                >
                                                    <Plus size={14} /> ثبت ردیف کالا
                                                </button>
                                            </div>

                                            {/* Local invoice items table */}
                                            <table className="w-full text-right text-[11px] font-sans mt-2">
                                                <thead className="bg-white border-b">
                                                    <tr>
                                                        <th className="p-2">کالا</th>
                                                        <th className="p-2 text-center">وزن (KG)</th>
                                                        <th className="p-2 text-center">ارزش کل FOB</th>
                                                        <th className="p-2 text-center">قیمت واحد</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {shippingDocForm.invoiceItems?.map((x, idx) => (
                                                        <tr key={x.id || idx}>
                                                            <td className="p-2 font-bold">{x.name}</td>
                                                            <td className="p-2 text-center font-mono">{formatNumberString(x.weight)}</td>
                                                            <td className="p-2 text-center font-mono font-bold text-blue-600">{formatNumberString(x.totalPrice)}</td>
                                                            <td className="p-2 text-center font-mono text-slate-400">{formatNumberString(x.unitPrice)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}

                                    {/* Action Button to Save shipping doc */}
                                    <div className="flex justify-end pt-4 border-t">
                                        <button 
                                            onClick={async () => {
                                                const doc: ShippingDocument = {
                                                    id: generateUUID(),
                                                    type: activeShippingSubTab,
                                                    documentNumber: shippingDocForm.documentNumber || '',
                                                    documentDate: shippingDocForm.documentDate || '',
                                                    status: shippingDocForm.status || 'Draft',
                                                    description: shippingDocForm.description || '',
                                                    attachments: shippingDocForm.attachments || [],
                                                    invoiceItems: shippingDocForm.invoiceItems || [],
                                                    packingItems: shippingDocForm.packingItems || [],
                                                    freightCost: shippingDocForm.freightCost || 0,
                                                    createdAt: Date.now(),
                                                    createdBy: currentUser.fullName
                                                };
                                                const updatedDocs = [...(selectedRecord.shippingDocuments || []), doc];
                                                const updated = { ...selectedRecord, shippingDocuments: updatedDocs };
                                                
                                                // Automatic sync of freight costs for stage costings
                                                if (doc.type === 'Bill of Lading' && doc.freightCost) {
                                                    if (!updated.stages[TradeStage.SHIPPING_DOCS]) updated.stages[TradeStage.SHIPPING_DOCS] = getStageData(updated, TradeStage.SHIPPING_DOCS);
                                                    updated.stages[TradeStage.SHIPPING_DOCS].costRial = Number(doc.freightCost);
                                                }

                                                await updateTradeRecord(updated);
                                                setSelectedRecord(updated);
                                                setRecords(prev => prev.map(r => r.id === updated.id ? updated : r));
                                                
                                                setShippingDocForm({ status: 'Draft', documentNumber: '', documentDate: '', attachments: [], invoiceItems: [], packingItems: [], freightCost: 0 });
                                                alert('سند حمل با موفقیت ذخیره شد.');
                                            }}
                                            className="bg-green-600 hover:bg-green-700 text-white font-black px-5 py-2.5 rounded-xl transition-all active:scale-95 text-xs"
                                        >
                                            اضافه کردن این سند به پرونده
                                        </button>
                                    </div>

                                    {/* List of existing saved documents in record */}
                                    <div className="pt-6 font-sans">
                                        <h5 className="font-bold text-sm text-slate-800 border-b pb-2 mb-3">اسناد بارگذاری شده پرونده</h5>
                                        <div className="space-y-3">
                                            {(selectedRecord.shippingDocuments || []).map((doc, idx) => (
                                                <div key={doc.id || idx} className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex justify-between items-center text-xs">
                                                    <div>
                                                        <span className="font-black text-slate-800 bg-white border px-2 py-0.5 rounded mr-1">
                                                            {doc.type === 'Commercial Invoice' ? 'سیاهه تجاری / Invoice' : 
                                                             doc.type === 'Packing List' ? 'عدل‌بندی / Packing List' : 
                                                             doc.type === 'Bill of Lading' ? 'بارنامه حمل' : 'گواهی مبدا'}
                                                        </span>
                                                        <span className="font-mono font-bold text-slate-600"> شماره سند: {doc.documentNumber || '-'}</span>
                                                        {doc.description && <p className="text-[10px] text-slate-400 mt-1">بابت: {doc.description}</p>}
                                                    </div>
                                                    <div>
                                                        <button 
                                                            onClick={async () => {
                                                                const updatedDocs = (selectedRecord.shippingDocuments || []).filter(d => d.id !== doc.id);
                                                                const updated = { ...selectedRecord, shippingDocuments: updatedDocs };
                                                                await updateTradeRecord(updated);
                                                                setSelectedRecord(updated);
                                                            }}
                                                            className="text-red-600 hover:text-red-800 font-bold"
                                                        >
                                                            حذف سند
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                            {(selectedRecord.shippingDocuments || []).length === 0 && (
                                                <p className="text-xs text-slate-400 italic">هیچ سندی تاکنون برای این پرونده ذخیره نشده است.</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* INSPECTION TAB */}
                    {activeTab === 'inspection' && (
                        <div className="max-w-4xl mx-auto space-y-6">
                            {/* Certificates Section */}
                            <div className="glass-panel p-6 rounded-2xl border border-gray-200/80 shadow-sm space-y-6">
                                <h3 className="font-black text-lg text-gray-800 pb-2 border-b">بارگیری گواهی‌های بازرسی (COI)</h3>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-gray-50/50 p-4 rounded-xl border font-sans">
                                    <div className="space-y-1">
                                        <label className="text-xs font-black text-slate-600">شرکت بازرسی کننده</label>
                                        <input className="w-full border rounded-lg p-2 text-sm bg-white" value={newInspectionCertificate.company || ''} onChange={e => setNewInspectionCertificate({...newInspectionCertificate, company: e.target.value})} placeholder="SGS /..." />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-black text-slate-600">شماره گواهی</label>
                                        <input className="w-full border rounded-lg p-2 text-sm bg-white font-mono text-left dir-ltr" value={newInspectionCertificate.certificateNumber || ''} onChange={e => setNewInspectionCertificate({...newInspectionCertificate, certificateNumber: e.target.value})} placeholder="Cert No..." />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-black text-slate-600">پارت / دوره</label>
                                        <input className="w-full border rounded-lg p-2 text-sm bg-white" value={newInspectionCertificate.part || ''} onChange={e => setNewInspectionCertificate({...newInspectionCertificate, part: e.target.value})} placeholder="پارت..." />
                                    </div>
                                    <div className="space-y-1 flex items-end">
                                        <button 
                                            onClick={async () => {
                                                if (!selectedRecord || !newInspectionCertificate.certificateNumber) return;
                                                const cert = { ...newInspectionCertificate, id: generateUUID() };
                                                const currentInspectionData = selectedRecord.inspectionData || { certificates: [], payments: [] };
                                                const updatedCerts = [...(currentInspectionData.certificates || []), cert as any];
                                                const updated = { ...selectedRecord, inspectionData: { ...currentInspectionData, certificates: updatedCerts } };
                                                await updateTradeRecord(updated);
                                                setSelectedRecord(updated);
                                                setNewInspectionCertificate({ part: '', company: '', certificateNumber: '', amount: 0 });
                                                alert('گواهی بازرسی با موفقیت ثبت شد.');
                                            }}
                                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold p-2 text-xs rounded-lg transition-all"
                                        >
                                            ثبت گواهی
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    {(selectedRecord.inspectionData?.certificates || []).map((x, idx) => (
                                        <div key={idx} className="bg-slate-50 p-3 rounded-xl border flex justify-between items-center text-xs font-sans">
                                            <div>
                                                <span className="font-bold text-slate-700">{x.company}</span>
                                                <span className="text-slate-400 font-mono"> - شماره: {x.certificateNumber}</span>
                                                {x.part && <span className="bg-slate-200 px-1.5 py-0.5 rounded font-bold text-[9px] mr-2">پارت {x.part}</span>}
                                            </div>
                                            <button 
                                                onClick={async () => {
                                                    const currentInspectionData = selectedRecord.inspectionData || { certificates: [], payments: [] };
                                                    const updatedCerts = (currentInspectionData.certificates || []).filter(c => c.id !== x.id);
                                                    const updated = { ...selectedRecord, inspectionData: { ...currentInspectionData, certificates: updatedCerts } };
                                                    await updateTradeRecord(updated);
                                                    setSelectedRecord(updated);
                                                }}
                                                className="text-red-500 hover:text-red-700 font-bold"
                                            >
                                                حذف
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Payments Section */}
                            <div className="glass-panel p-6 rounded-2xl border border-gray-200/80 shadow-sm space-y-6">
                                <h3 className="font-black text-lg text-gray-800 pb-2 border-b">کارمزدهای پرداخت شده بازرسی (ریال)</h3>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-gray-50/50 p-4 rounded-xl border font-sans">
                                    <div className="space-y-1">
                                        <label className="text-xs font-black text-slate-600">باکس پرداخت کننده / بانک</label>
                                        <input className="w-full border rounded-lg p-2 text-sm bg-white" value={newInspectionPayment.bank || ''} onChange={e => setNewInspectionPayment({...newInspectionPayment, bank: e.target.value})} placeholder="نام بانک..." />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-black text-slate-600">مبلغ پرداخت شده (ریال)</label>
                                        <input className="w-full border rounded-lg p-2 text-sm bg-white font-mono text-left dir-ltr" value={newInspectionPayment.amount ? formatNumberString(newInspectionPayment.amount) : ''} onChange={e => setNewInspectionPayment({...newInspectionPayment, amount: Number(deformatNumberString(e.target.value))})} placeholder="کارمزد ریالی..." />
                                    </div>
                                    <div className="space-y-1 border-gray-100 flex items-end">
                                        <button 
                                            onClick={async () => {
                                                if (!selectedRecord || !newInspectionPayment.amount) return;
                                                const pay = { ...newInspectionPayment, id: generateUUID() };
                                                const currentInspectionData = selectedRecord.inspectionData || { certificates: [], payments: [] };
                                                const updatedPayments = [...(currentInspectionData.payments || []), pay as any];
                                                const updated = { ...selectedRecord, inspectionData: { ...currentInspectionData, payments: updatedPayments } };
                                                
                                                // auto update stage cost
                                                const totalCosts = updatedPayments.reduce((acc, p) => acc + (p.amount || 0), 0);
                                                if (!updated.stages[TradeStage.INSPECTION]) updated.stages[TradeStage.INSPECTION] = getStageData(updated, TradeStage.INSPECTION);
                                                updated.stages[TradeStage.INSPECTION].costRial = totalCosts;
                                                updated.stages[TradeStage.INSPECTION].isCompleted = totalCosts > 0;

                                                await updateTradeRecord(updated);
                                                setSelectedRecord(updated);
                                                setNewInspectionPayment({ part: '', amount: 0, date: '', bank: '' });
                                                alert('پرداخت با موفقیت ثبت شد.');
                                            }}
                                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold p-2 text-xs rounded-lg transition-all"
                                        >
                                            ثبت پرداخت
                                        </button>
                                    </div>
                                </div>

                                <div className="overflow-x-auto font-sans text-xs">
                                    <table className="w-full text-right mt-1">
                                        <thead className="bg-gray-100">
                                            <tr>
                                                <th className="p-3">بانک عامل</th>
                                                <th className="p-3 text-center">مبلغ کارمزد بازرسی (ریال)</th>
                                                <th className="p-3 text-center">حذف</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(selectedRecord.inspectionData?.payments || []).map((x, idx) => (
                                                <tr key={idx} className="border-b">
                                                    <td className="p-3 font-bold text-slate-800">{x.bank}</td>
                                                    <td className="p-3 text-center font-mono font-bold text-emerald-700">{formatNumberString(x.amount)}</td>
                                                    <td className="p-3 text-center">
                                                        <button 
                                                            onClick={async () => {
                                                                const currentInspectionData = selectedRecord.inspectionData || { certificates: [], payments: [] };
                                                                const updatedPayments = (currentInspectionData.payments || []).filter(p => p.id !== x.id);
                                                                const updated = { ...selectedRecord, inspectionData: { ...currentInspectionData, payments: updatedPayments } };
                                                                
                                                                const totalCosts = updatedPayments.reduce((acc, p) => acc + (p.amount || 0), 0);
                                                                if (!updated.stages[TradeStage.INSPECTION]) updated.stages[TradeStage.INSPECTION] = getStageData(updated, TradeStage.INSPECTION);
                                                                updated.stages[TradeStage.INSPECTION].costRial = totalCosts;

                                                                await updateTradeRecord(updated);
                                                                setSelectedRecord(updated);
                                                            }}
                                                            className="text-red-600 font-bold"
                                                        >
                                                            حذف
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

                    {/* CLEARANCE & DELIVERY TAB */}
                    {activeTab === 'clearance_docs' && (
                        <div className="max-w-4xl mx-auto space-y-6 font-sans">
                            {/* Warehouse receipts */}
                            <div className="glass-panel p-6 rounded-2xl border border-gray-200/80 shadow-sm space-y-6">
                                <h3 className="font-black text-lg text-gray-800 pb-2 border-b">رسیدهای انبار و قبوض انبار موقت کالا</h3>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-gray-50/50 p-4 rounded-xl border">
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-600">شماره قبض انبار</label>
                                        <input className="w-full border rounded-lg p-2 text-sm bg-white font-mono text-left dir-ltr" value={newWarehouseReceipt.number || ''} onChange={e => setNewWarehouseReceipt({...newWarehouseReceipt, number: e.target.value})} placeholder="Receipt Number..." />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-600">تاریخ صدور</label>
                                        <input className="w-full border rounded-lg p-2 text-sm bg-white font-mono text-left dir-ltr" value={newWarehouseReceipt.issueDate || ''} onChange={e => setNewWarehouseReceipt({...newWarehouseReceipt, issueDate: e.target.value})} placeholder="۱۴۰۳/۰۱/۰۱" />
                                    </div>
                                    <div className="space-y-1 flex items-end">
                                        <button 
                                            onClick={async () => {
                                                if (!selectedRecord || !newWarehouseReceipt.number) return;
                                                const itemData = { ...newWarehouseReceipt, id: generateUUID() };
                                                const currentForm = selectedRecord.clearanceData || { receipts: [], payments: [] };
                                                const updatedReceipts = [...(currentForm.receipts || []), itemData as any];
                                                const updated = { ...selectedRecord, clearanceData: { ...currentForm, receipts: updatedReceipts } };
                                                await updateTradeRecord(updated);
                                                setSelectedRecord(updated);
                                                setNewWarehouseReceipt({ number: '', part: '', issueDate: '' });
                                                alert('قبض انبار با موفقیت ثبت شد.');
                                            }}
                                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold p-2 text-xs rounded-lg transition-all"
                                        >
                                            ثبت رسید
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    {(selectedRecord.clearanceData?.receipts || []).map((x, idx) => (
                                        <div key={idx} className="bg-slate-50 p-3 rounded-xl border flex justify-between items-center text-xs">
                                            <div>
                                                <span className="font-bold text-slate-700">قبض انبار: </span>
                                                <span className="font-mono font-bold text-slate-800 bg-white border px-2 py-0.5 rounded">{x.number}</span>
                                                {x.issueDate && <span className="text-slate-400 font-mono text-[10px] mr-2">تاریخ: {x.issueDate}</span>}
                                            </div>
                                            <button 
                                                onClick={async () => {
                                                    const currentForm = selectedRecord.clearanceData || { receipts: [], payments: [] };
                                                    const updatedReceipts = (currentForm.receipts || []).filter(r => r.id !== x.id);
                                                    const updated = { ...selectedRecord, clearanceData: { ...currentForm, receipts: updatedReceipts } };
                                                    await updateTradeRecord(updated);
                                                    setSelectedRecord(updated);
                                                }}
                                                className="text-red-500 hover:text-red-700 font-bold"
                                            >
                                                حذف
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Clearance payments */}
                            <div className="glass-panel p-6 rounded-2xl border border-gray-200/80 shadow-sm space-y-6">
                                <h3 className="font-black text-lg text-gray-800 pb-2 border-b">کارمزدها و هزینه‌های دریافت اسناد ترخیصیه</h3>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-gray-50/50 p-4 rounded-xl border">
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-600">بانک عامل پرداخت</label>
                                        <input className="w-full border rounded-lg p-2 text-sm bg-white" value={newClearancePayment.bank || ''} onChange={e => setNewClearancePayment({...newClearancePayment, bank: e.target.value})} placeholder="نام بانک..." />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-600">مبلغ پرداخت شده (ریال)</label>
                                        <input className="w-full border rounded-lg p-2 text-sm bg-white font-mono text-left dir-ltr" value={newClearancePayment.amount ? formatNumberString(newClearancePayment.amount) : ''} onChange={e => setNewClearancePayment({...newClearancePayment, amount: Number(deformatNumberString(e.target.value))})} placeholder="مبلغ ریالی..." />
                                    </div>
                                    <div className="space-y-1 flex items-end">
                                        <button 
                                            onClick={async () => {
                                                if (!selectedRecord || !newClearancePayment.amount) return;
                                                const payment = { ...newClearancePayment, id: generateUUID() };
                                                const currentForm = selectedRecord.clearanceData || { receipts: [], payments: [] };
                                                const updatedPayments = [...(currentForm.payments || []), payment as any];
                                                const updated = { ...selectedRecord, clearanceData: { ...currentForm, payments: updatedPayments } };
                                                
                                                // auto update stage cost
                                                const totalCosts = updatedPayments.reduce((acc, p) => acc + (p.amount || 0), 0);
                                                if (!updated.stages[TradeStage.CLEARANCE_DOCS]) updated.stages[TradeStage.CLEARANCE_DOCS] = getStageData(updated, TradeStage.CLEARANCE_DOCS);
                                                updated.stages[TradeStage.CLEARANCE_DOCS].costRial = totalCosts;
                                                updated.stages[TradeStage.CLEARANCE_DOCS].isCompleted = totalCosts > 0;

                                                await updateTradeRecord(updated);
                                                setSelectedRecord(updated);
                                                setNewClearancePayment({ amount: 0, part: '', bank: '', date: '', payingBank: '' });
                                                alert('هزینه با موفقیت ثبت شد.');
                                            }}
                                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold p-2 text-xs rounded-lg transition-all"
                                        >
                                            ثبت هزینه
                                        </button>
                                    </div>
                                </div>

                                <div className="overflow-x-auto text-xs">
                                    <table className="w-full text-right mt-1">
                                        <thead className="bg-gray-100">
                                            <tr>
                                                <th className="p-3">صندوق / بانک</th>
                                                <th className="p-3 text-center">پرداختی اسناد ترخیصیه (ریال)</th>
                                                <th className="p-3 text-center">حذف</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(selectedRecord.clearanceData?.payments || []).map((x, idx) => (
                                                <tr key={idx} className="border-b">
                                                    <td className="p-3 font-bold text-slate-800">{x.bank}</td>
                                                    <td className="p-3 text-center font-mono font-bold text-emerald-700">{formatNumberString(x.amount)}</td>
                                                    <td className="p-3 text-center">
                                                        <button 
                                                            onClick={async () => {
                                                                const currentForm = selectedRecord.clearanceData || { receipts: [], payments: [] };
                                                                const updatedPayments = (currentForm.payments || []).filter(p => p.id !== x.id);
                                                                const updated = { ...selectedRecord, clearanceData: { ...currentForm, payments: updatedPayments } };
                                                                
                                                                const totalCosts = updatedPayments.reduce((acc, p) => acc + (p.amount || 0), 0);
                                                                if (!updated.stages[TradeStage.CLEARANCE_DOCS]) updated.stages[TradeStage.CLEARANCE_DOCS] = getStageData(updated, TradeStage.CLEARANCE_DOCS);
                                                                updated.stages[TradeStage.CLEARANCE_DOCS].costRial = totalCosts;

                                                                await updateTradeRecord(updated);
                                                                setSelectedRecord(updated);
                                                            }}
                                                            className="text-red-500 font-bold"
                                                        >
                                                            حذف
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

                    {/* GREEN LEAF TAB */}
                    {activeTab === 'green_leaf' && (
                        <div className="max-w-4xl mx-auto space-y-6 font-sans text-xs">
                            {/* Cottage duties */}
                            <div className="glass-panel p-6 rounded-2xl border border-gray-200/80 shadow-sm space-y-6">
                                <h3 className="font-black text-lg text-gray-800 pb-2 border-b">حقوق ورودی و کارمزد گمرک (شماره کوتاژ)</h3>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-gray-50/50 p-4 rounded-xl border">
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-600">شماره کوتاژ گمرکی</label>
                                        <input className="w-full border rounded-lg p-2 text-sm bg-white font-mono text-left dir-ltr" value={newCustomsDuty.cottageNumber || ''} onChange={e => setNewCustomsDuty({...newCustomsDuty, cottageNumber: e.target.value})} placeholder="Cottage Number..." />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-600">مبلغ پرداخت شده (ریال)</label>
                                        <input className="w-full border rounded-lg p-2 text-sm bg-white font-mono text-left dir-ltr" value={newCustomsDuty.amount ? formatNumberString(newCustomsDuty.amount) : ''} onChange={e => setNewCustomsDuty({...newCustomsDuty, amount: Number(deformatNumberString(e.target.value))})} placeholder="مبلغ حقوق ورودی..." />
                                    </div>
                                    <div className="space-y-1 flex items-end">
                                        <button 
                                            onClick={async () => {
                                                if (!selectedRecord || !newCustomsDuty.cottageNumber) return;
                                                const duty = { ...newCustomsDuty, id: generateUUID() };
                                                const currentForm = selectedRecord.greenLeafData || { duties: [], guarantees: [], taxes: [], roadTolls: [] };
                                                const updatedDuties = [...(currentForm.duties || []), duty as any];
                                                const updated = { ...selectedRecord, greenLeafData: { ...currentForm, duties: updatedDuties } };
                                                
                                                // calculate stage cost
                                                const totalCosts = updatedDuties.reduce((acc, d) => acc + (d.amount || 0), 0);
                                                if (!updated.stages[TradeStage.GREEN_LEAF]) updated.stages[TradeStage.GREEN_LEAF] = getStageData(updated, TradeStage.GREEN_LEAF);
                                                updated.stages[TradeStage.GREEN_LEAF].costRial = totalCosts;
                                                updated.stages[TradeStage.GREEN_LEAF].isCompleted = totalCosts > 0;

                                                await updateTradeRecord(updated);
                                                setSelectedRecord(updated);
                                                setNewCustomsDuty({ cottageNumber: '', part: '', amount: 0, paymentMethod: 'Bank', bank: '', date: '' });
                                                alert('رکورد کوتاژ با موفقیت ثبت شد.');
                                            }}
                                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold p-2 text-xs rounded-lg transition-all"
                                        >
                                            ثبت حقوق ورودی
                                        </button>
                                    </div>
                                </div>

                                <table className="w-full text-right font-sans">
                                    <thead className="bg-gray-100">
                                        <tr>
                                            <th className="p-3">شماره کوتاژ</th>
                                            <th className="p-3 text-center">پرداخت حقوق ورودی (ریال)</th>
                                            <th className="p-3 text-center">حذف</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(selectedRecord.greenLeafData?.duties || []).map((x, idx) => (
                                            <tr key={idx} className="border-b">
                                                <td className="p-3 font-mono font-bold text-slate-800">{x.cottageNumber}</td>
                                                <td className="p-3 text-center font-mono font-bold text-emerald-700">{formatNumberString(x.amount)}</td>
                                                <td className="p-3 text-center">
                                                    <button 
                                                        onClick={async () => {
                                                            const currentForm = selectedRecord.greenLeafData || { duties: [], guarantees: [], taxes: [], roadTolls: [] };
                                                            const updatedDuties = (currentForm.duties || []).filter(d => d.id !== x.id);
                                                            const updated = { ...selectedRecord, greenLeafData: { ...currentForm, duties: updatedDuties } };
                                                            
                                                            const totalCosts = updatedDuties.reduce((acc, d) => acc + (d.amount || 0), 0);
                                                            if (!updated.stages[TradeStage.GREEN_LEAF]) updated.stages[TradeStage.GREEN_LEAF] = getStageData(updated, TradeStage.GREEN_LEAF);
                                                            updated.stages[TradeStage.GREEN_LEAF].costRial = totalCosts;

                                                            await updateTradeRecord(updated);
                                                            setSelectedRecord(updated);
                                                        }}
                                                        className="text-red-500 font-bold"
                                                    >
                                                        حذف
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* INTERNAL SHIPPING TAB */}
                    {activeTab === 'internal_shipping' && (
                        <div className="max-w-4xl mx-auto space-y-6 font-sans text-xs">
                            <div className="glass-panel p-6 rounded-2xl border border-gray-200/80 shadow-sm space-y-6">
                                <h3 className="font-black text-lg text-gray-800 pb-2 border-b">لیست پرداخت‌های کرایه حمل داخلی کالا</h3>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-gray-50/50 p-4 rounded-xl border">
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-600">شرکت حمل‌ونقل / راننده</label>
                                        <input className="w-full border rounded-lg p-2 text-sm bg-white" value={newShippingPayment.bank || ''} onChange={e => setNewShippingPayment({...newShippingPayment, bank: e.target.value})} placeholder="باربری..." />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-600">مبلغ کرایه داخلی (ریال)</label>
                                        <input className="w-full border rounded-lg p-2 text-sm bg-white font-mono text-left dir-ltr" value={newShippingPayment.amount ? formatNumberString(newShippingPayment.amount) : ''} onChange={e => setNewShippingPayment({...newShippingPayment, amount: Number(deformatNumberString(e.target.value))})} placeholder="مبلغ ریالی..." />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-600">توضیحات</label>
                                        <input className="w-full border rounded-lg p-2 text-sm bg-white" value={newShippingPayment.description || ''} onChange={e => setNewShippingPayment({...newShippingPayment, description: e.target.value})} placeholder="جزئیات حمل..." />
                                    </div>
                                    <div className="space-y-1 flex items-end">
                                        <button 
                                            onClick={async () => {
                                                if (!selectedRecord || !newShippingPayment.amount) return;
                                                const pay = { ...newShippingPayment, id: generateUUID() };
                                                const currentForm = selectedRecord.internalShippingData || { payments: [] };
                                                const updatedPayments = [...(currentForm.payments || []), pay as any];
                                                const updated = { ...selectedRecord, internalShippingData: { ...currentForm, payments: updatedPayments } };
                                                
                                                // calculate stage cost
                                                const totalCosts = updatedPayments.reduce((acc, p) => acc + (p.amount || 0), 0);
                                                if (!updated.stages[TradeStage.INTERNAL_SHIPPING]) updated.stages[TradeStage.INTERNAL_SHIPPING] = getStageData(updated, TradeStage.INTERNAL_SHIPPING);
                                                updated.stages[TradeStage.INTERNAL_SHIPPING].costRial = totalCosts;
                                                updated.stages[TradeStage.INTERNAL_SHIPPING].isCompleted = totalCosts > 0;

                                                await updateTradeRecord(updated);
                                                setSelectedRecord(updated);
                                                setNewShippingPayment({ part: '', amount: 0, date: '', bank: '', description: '' });
                                                alert('کرایه حمل داخلی با موفقیت ثبت شد.');
                                            }}
                                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold p-2 text-xs rounded-lg transition-all"
                                        >
                                            ثبت کرایه داخلی
                                        </button>
                                    </div>
                                </div>

                                <table className="w-full text-right mt-1">
                                    <thead className="bg-gray-100">
                                        <tr>
                                            <th className="p-3">باربری / راننده</th>
                                            <th className="p-3 text-center">شرح جزئیات</th>
                                            <th className="p-3 text-center">کرایه پرداخت شده (ریال)</th>
                                            <th className="p-3 text-center font-mono font-bold">حذف</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(selectedRecord.internalShippingData?.payments || []).map((x, idx) => (
                                            <tr key={idx} className="border-b">
                                                <td className="p-3 font-bold text-slate-800">{x.bank}</td>
                                                <td className="p-3 text-slate-500">{x.description}</td>
                                                <td className="p-3 text-center font-mono font-bold text-emerald-700">{formatNumberString(x.amount)}</td>
                                                <td className="p-3 text-center">
                                                    <button 
                                                        onClick={async () => {
                                                            const currentForm = selectedRecord.internalShippingData || { payments: [] };
                                                            const updatedPayments = (currentForm.payments || []).filter(p => p.id !== x.id);
                                                            const updated = { ...selectedRecord, internalShippingData: { ...currentForm, payments: updatedPayments } };
                                                            
                                                            const totalCosts = updatedPayments.reduce((acc, p) => acc + (p.amount || 0), 0);
                                                            if (!updated.stages[TradeStage.INTERNAL_SHIPPING]) updated.stages[TradeStage.INTERNAL_SHIPPING] = getStageData(updated, TradeStage.INTERNAL_SHIPPING);
                                                            updated.stages[TradeStage.INTERNAL_SHIPPING].costRial = totalCosts;

                                                            await updateTradeRecord(updated);
                                                            setSelectedRecord(updated);
                                                        }}
                                                        className="text-red-500 font-bold"
                                                    >
                                                        حذف
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* AGENT OR CLEARANCE FEES */}
                    {activeTab === 'agent_fees' && (
                        <div className="max-w-4xl mx-auto space-y-6 font-sans text-xs">
                            <div className="glass-panel p-6 rounded-2xl border border-gray-200/80 shadow-sm space-y-6">
                                <h3 className="font-black text-lg text-gray-800 pb-2 border-b">حق‌العمل، کارمزدها و صورت‌حساب ترخیص‌کار گمرک</h3>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-gray-50/50 p-4 rounded-xl border">
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-600">شرکت ترخیص‌کار / شخص</label>
                                        <input className="w-full border rounded-lg p-2 text-sm bg-white" value={newAgentPayment.agentName || ''} onChange={e => setNewAgentPayment({...newAgentPayment, agentName: e.target.value})} placeholder="ترخیص کار..." />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-600">هزینه کل پرداخت شده (ریال)</label>
                                        <input className="w-full border rounded-lg p-2 text-sm bg-white font-mono text-left dir-ltr" value={newAgentPayment.amount ? formatNumberString(newAgentPayment.amount) : ''} onChange={e => setNewAgentPayment({...newAgentPayment, amount: Number(deformatNumberString(e.target.value))})} placeholder="مبلغ حق العمل..." />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-600">بابت / توضیحات</label>
                                        <input className="w-full border rounded-lg p-2 text-sm bg-white" value={newAgentPayment.description || ''} onChange={e => setNewAgentPayment({...newAgentPayment, description: e.target.value})} placeholder="توضیحات بابت ترخیص..." />
                                    </div>
                                    <div className="space-y-1 flex items-end">
                                        <button 
                                            onClick={async () => {
                                                if (!selectedRecord || !newAgentPayment.amount) return;
                                                const payment = { ...newAgentPayment, id: generateUUID() };
                                                const currentForm = selectedRecord.agentData || { payments: [] };
                                                const updatedPayments = [...(currentForm.payments || []), payment as any];
                                                const updated = { ...selectedRecord, agentData: { ...currentForm, payments: updatedPayments } };
                                                
                                                // calculate stage cost
                                                const totalCosts = updatedPayments.reduce((acc, p) => acc + (p.amount || 0), 0);
                                                if (!updated.stages[TradeStage.AGENT_FEES]) updated.stages[TradeStage.AGENT_FEES] = getStageData(updated, TradeStage.AGENT_FEES);
                                                updated.stages[TradeStage.AGENT_FEES].costRial = totalCosts;
                                                updated.stages[TradeStage.AGENT_FEES].isCompleted = totalCosts > 0;

                                                await updateTradeRecord(updated);
                                                setSelectedRecord(updated);
                                                setNewAgentPayment({ agentName: '', amount: 0, bank: '', date: '', part: '', description: '' });
                                                alert('هزینه صنف ترخیص‌کار ثبت شد.');
                                            }}
                                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold p-2 text-xs rounded-lg transition-all"
                                        >
                                            ثبت هزینه ترخیص‌کار
                                        </button>
                                    </div>
                                </div>

                                <table className="w-full text-right mt-1">
                                    <thead className="bg-gray-100">
                                        <tr>
                                            <th className="p-3">نام ترخیص کار</th>
                                            <th className="p-3 text-center">شرح بابت</th>
                                            <th className="p-3 text-center font-mono font-bold">صورت‌حساب (ریال)</th>
                                            <th className="p-3 text-center font-mono font-bold">حذف</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(selectedRecord.agentData?.payments || []).map((x, idx) => (
                                            <tr key={idx} className="border-b">
                                                <td className="p-3 font-bold text-slate-800">{x.agentName}</td>
                                                <td className="p-3 text-slate-500">{x.description}</td>
                                                <td className="p-3 text-center font-mono font-bold text-emerald-700">{formatNumberString(x.amount)}</td>
                                                <td className="p-3 text-center">
                                                    <button 
                                                        onClick={async () => {
                                                            const currentForm = selectedRecord.agentData || { payments: [] };
                                                            const updatedPayments = (currentForm.payments || []).filter(p => p.id !== x.id);
                                                            const updated = { ...selectedRecord, agentData: { ...currentForm, payments: updatedPayments } };
                                                            
                                                            const totalCosts = updatedPayments.reduce((acc, p) => acc + (p.amount || 0), 0);
                                                            if (!updated.stages[TradeStage.AGENT_FEES]) updated.stages[TradeStage.AGENT_FEES] = getStageData(updated, TradeStage.AGENT_FEES);
                                                            updated.stages[TradeStage.AGENT_FEES].costRial = totalCosts;

                                                            await updateTradeRecord(updated);
                                                            setSelectedRecord(updated);
                                                        }}
                                                        className="text-red-500 font-bold"
                                                    >
                                                        حذف
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* FINAL PRICE SPREADSHEET */}
                    {activeTab === 'final_calculation' && (() => {
                        // Gather values
                        const currencyTranches = selectedRecord.currencyPurchaseData?.tranches || [];
                        const totalTrancheRial = currencyTranches.reduce((acc, t) => acc + (t.rialAmount || 0), 0);
                        const totalTrancheReturnRial = currencyTranches.reduce((acc, t) => acc + (t.returnAmount || 0), 0);
                        const netTrancheRial = totalTrancheRial - totalTrancheReturnRial;
                        const totalTrancheAmount = currencyTranches.reduce((acc, t) => acc + (t.amount || 0), 0);
                        const avgTrancheRate = totalTrancheAmount > 0 ? netTrancheRial / totalTrancheAmount : 0;

                        const totalFobCurrency = selectedRecord.items?.reduce((acc, item) => acc + item.totalPrice, 0) || 0;
                        const finalExchangeVal = avgTrancheRate > 0 ? avgTrancheRate : (calcExchangeRate || 65000) * 10;
                        const computedFobRials = totalFobCurrency * finalExchangeVal;

                        const licenseCosts = selectedRecord.licenseData?.transactions?.reduce((acc, tx) => acc + tx.amount, 0) || 0;
                        const insuranceCosts = (Number(selectedRecord.insuranceData?.cost) || 0) + (selectedRecord.insuranceData?.endorsements || []).reduce((acc, e) => acc + e.amount, 0);
                        const inspectionCosts = selectedRecord.inspectionData?.payments?.reduce((acc, p) => acc + (p.amount || 0), 0) || 0;
                        const customsDuties = selectedRecord.greenLeafData?.duties?.reduce((acc, d) => acc + (d.amount || 0), 0) || 0;
                        const clearanceDocCosts = selectedRecord.clearanceData?.payments?.reduce((acc, p) => acc + (p.amount || 0), 0) || 0;
                        const clearanceAgentCosts = selectedRecord.agentData?.payments?.reduce((acc, p) => acc + (p.amount || 0), 0) || 0;
                        const internalShippings = selectedRecord.internalShippingData?.payments?.reduce((acc, p) => acc + (p.amount || 0), 0) || 0;

                        const grandTotalCostRials = computedFobRials + licenseCosts + insuranceCosts + inspectionCosts + customsDuties + clearanceDocCosts + clearanceAgentCosts + internalShippings;
                        const grandTotalWeight = selectedRecord.items?.reduce((acc, idx) => acc + idx.weight, 0) || 0;
                        const costPerKG = grandTotalWeight > 0 ? grandTotalCostRials / grandTotalWeight : 0;

                        return (
                            <div className="max-w-4xl mx-auto space-y-6">
                                <div className="glass-panel p-6 rounded-2xl border border-gray-200/80 shadow-sm space-y-6">
                                    <div className="flex justify-between items-center pb-2 border-b">
                                        <h3 className="font-black text-lg text-gray-800">برگه محاسبات و بهای تمام شده کل پرونده گمرکی</h3>
                                        <button onClick={() => setShowFinalReportPrint(true)} className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-black px-4 py-2 rounded-xl flex items-center gap-1 transition-all"><Printer size={14} /> چاپ بهای تمام شده</button>
                                    </div>

                                    {/* Virtual Simulator Exchange rate */}
                                    {avgTrancheRate === 0 && (
                                        <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                                            <div className="text-xs font-black text-amber-800 leading-relaxed max-w-lg">
                                                نرخ حواله ارزی واقعی برای این پرونده یافت نشد. بنابراین ارزش ریالی کالا بر اساس شبیه‌ساز نرخ ذیل (ریال) برآورد شده است:
                                            </div>
                                            <input 
                                                type="text" 
                                                className="border rounded-lg p-2 font-mono text-left max-w-[150px] bg-white text-xs" 
                                                value={calcExchangeRate ? formatNumberString(calcExchangeRate) : ''} 
                                                onChange={e => {
                                                    const cleanNum = deformatNumberString(e.target.value);
                                                    setCalcExchangeRate(cleanNum);
                                                    setSelectedRecord(prev => prev ? { ...prev, calcExchangeRate: cleanNum } : null);
                                                }}
                                                placeholder="نرخ برابری ریالی..." 
                                            />
                                        </div>
                                    )}

                                    {/* Cost Sheet Spreadsheet style table */}
                                    <div className="overflow-x-auto border rounded-xl">
                                        <table className="w-full text-right text-xs">
                                            <thead className="bg-slate-800 text-white font-black">
                                                <tr>
                                                    <th className="p-3 w-12">کد</th>
                                                    <th className="p-3">بخش هزینه / مرحله ترخیص کالا</th>
                                                    <th className="p-3 text-center">ارزش کل تفصیلی (ریال)</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr className="border-b transition-colors hover:bg-slate-50/50">
                                                    <td className="p-3 font-mono text-slate-400">01</td>
                                                    <td className="p-3 font-bold text-slate-800">ارزش خالص خرید کالا FOB ({selectedRecord.mainCurrency} {formatNumberString(totalFobCurrency)})</td>
                                                    <td className="p-3 text-center font-mono font-bold text-blue-700 bg-blue-50/20">{formatNumberString(computedFobRials)} ریال</td>
                                                </tr>
                                                <tr className="border-b transition-colors hover:bg-slate-50/50">
                                                    <td className="p-3 font-mono text-slate-400">02</td>
                                                    <td className="p-3 font-bold text-slate-800">ثبت سفارش و کارمزدهای بانکی پرونده</td>
                                                    <td className="p-3 text-center font-mono">{formatNumberString(licenseCosts)} ریال</td>
                                                </tr>
                                                <tr className="border-b transition-colors hover:bg-slate-50/50">
                                                    <td className="p-3 font-mono text-slate-400">03</td>
                                                    <td className="p-3 font-bold text-slate-800">بیمه‌نامه باربری مرز خارجی</td>
                                                    <td className="p-3 text-center font-mono">{formatNumberString(insuranceCosts)} ریال</td>
                                                </tr>
                                                <tr className="border-b transition-colors hover:bg-slate-50/50">
                                                    <td className="p-3 font-mono text-slate-400">04</td>
                                                    <td className="p-3 font-bold text-slate-800">کارمزد بازرسی COI خارجی</td>
                                                    <td className="p-3 text-center font-mono">{formatNumberString(inspectionCosts)} ریال</td>
                                                </tr>
                                                <tr className="border-b transition-colors hover:bg-slate-50/50">
                                                    <td className="p-3 font-mono text-slate-400">05</td>
                                                    <td className="p-3 font-bold text-slate-800">حقوق گمرکی ورودی کوتاژ (مالیات گمرک)</td>
                                                    <td className="p-3 text-center font-mono">{formatNumberString(customsDuties)} ریال</td>
                                                </tr>
                                                <tr className="border-b transition-colors hover:bg-slate-50/50">
                                                    <td className="p-3 font-mono text-slate-400">06</td>
                                                    <td className="p-3 font-bold text-slate-800">اسناد ترخیصیه و تخلیه کالا</td>
                                                    <td className="p-3 text-center font-mono">{formatNumberString(clearanceDocCosts)} ریال</td>
                                                </tr>
                                                <tr className="border-b transition-colors hover:bg-slate-50/50">
                                                    <td className="p-3 font-mono text-slate-400">07</td>
                                                    <td className="p-3 font-bold text-slate-800">حق العمل ترخیص کار بنادر گمرک</td>
                                                    <td className="p-3 text-center font-mono">{formatNumberString(clearanceAgentCosts)} ریال</td>
                                                </tr>
                                                <tr className="border-b transition-colors hover:bg-slate-50/50">
                                                    <td className="p-3 font-mono text-slate-400">08</td>
                                                    <td className="p-3 font-bold text-slate-800">کرایه حمل و نقل داخلی به کارخانه باربری</td>
                                                    <td className="p-3 text-center font-mono">{formatNumberString(internalShippings)} ریال</td>
                                                </tr>
                                            </tbody>
                                            <tfoot className="bg-amber-50 font-black text-amber-900 border-t-2">
                                                <tr className="border-b border-amber-200">
                                                    <td colSpan={2} className="p-4 font-black">کل بهای تمام شده کالا (وارد به کارخانه)</td>
                                                    <td className="p-4 text-center font-mono font-black text-sm">{formatNumberString(grandTotalCostRials)} ریال</td>
                                                </tr>
                                                <tr className="border-b border-amber-200 text-xs">
                                                    <td colSpan={2} className="p-3">وزن خالص کل اقلام کالا</td>
                                                    <td className="p-3 text-center font-mono">{formatNumberString(grandTotalWeight)} کیلوگرم</td>
                                                </tr>
                                                <tr className="bg-emerald-50 text-emerald-900">
                                                    <td colSpan={2} className="p-4 font-black text-sm">قیمت نهایی تمام شده به ازای هر کیلوگرم کالا</td>
                                                    <td className="p-4 text-center font-mono font-black text-md">{formatNumberString(Math.round(costPerKG))} ریال / KG</td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}

                </div>

                {/* EDITING STAGE DIALOG BACKDROP MODAL */}
                {editingStage && (
                    <div className="fixed inset-0 bg-black/55 z-[100] flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 font-sans text-right dir-rtl animate-scale-in">
                            <div className="flex justify-between items-center mb-6 border-b pb-3">
                                <h3 className="font-black text-lg text-gray-800">بروزرسانی وضعیت: {editingStage}</h3>
                                <button onClick={() => setEditingStage(null)}><X size={20} className="text-gray-400 hover:text-red-500" /></button>
                            </div>
                            <div className="space-y-4 text-xs font-bold">
                                <div className="space-y-1">
                                    <label className="text-slate-600 block mb-1">هزینه ریالی این مرحله</label>
                                    <input 
                                        type="text"
                                        className="w-full border rounded-lg p-2.5 font-mono text-left dir-ltr bg-slate-50"
                                        value={stageFormData.costRial ? formatNumberString(stageFormData.costRial) : ''}
                                        onChange={e => setStageFormData({...stageFormData, costRial: Number(deformatNumberString(e.target.value))})}
                                        placeholder="هزینه ریالی..."
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-slate-600 block mb-1">توضیحات و اقدامات صورت‌گرفته</label>
                                    <textarea 
                                        rows={4}
                                        className="w-full border rounded-lg p-2.5 bg-slate-50 resize-none font-sans"
                                        value={stageFormData.description || ''}
                                        onChange={e => setStageFormData({...stageFormData, description: e.target.value})}
                                        placeholder="شرح اقدامات..."
                                    />
                                </div>
                                <div className="space-y-1 pt-2">
                                    <label className="flex items-center gap-2 cursor-pointer font-black text-slate-700">
                                        <input 
                                            type="checkbox" 
                                            checked={!!stageFormData.isCompleted} 
                                            onChange={e => setStageFormData({...stageFormData, isCompleted: e.target.checked})} 
                                        />
                                        این مرحله با موفقیت تکمیل شده است
                                    </label>
                                </div>

                                <button 
                                    onClick={handleSaveStage}
                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-black mt-4 transition-all"
                                >
                                    ذخیره ویرایش‌ها
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // Default Dashboard View
    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <Container className="text-blue-600" /> پرونده‌های بازرگانی
                    </h1>
                    <div className="text-sm text-gray-500 mt-1 flex items-center gap-2 overflow-x-auto whitespace-nowrap pb-2 no-scrollbar scroll-smooth">
                        <button onClick={goRoot} className="hover:text-blue-600 flex items-center gap-1 shrink-0 bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-full transition-colors active:scale-95"><Home size={14}/> خانه</button>
                        {selectedCompany && <><ChevronLeft size={14} className="shrink-0 text-gray-400"/> <button onClick={() => goCompany(selectedCompany)} className="hover:text-blue-600 shrink-0 bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-full transition-colors active:scale-95">{selectedCompany}</button></>}
                        {selectedGroup && <><ChevronLeft size={14} className="shrink-0 text-gray-400"/> <span className="shrink-0 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-3 py-1.5 rounded-full font-bold">{selectedGroup}</span></>}
                    </div>
                </div>
                <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-end">
                    <div className="relative flex-1 sm:flex-none min-w-[120px]">
                        <input className="w-full border rounded-xl pl-8 pr-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all" placeholder="جستجو..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        <Search className="absolute left-2 top-2.5 text-gray-400" size={16} />
                    </div>
                    <button 
                        onClick={() => setShowArchived(!showArchived)} 
                        className={`p-2 sm:px-4 sm:py-2 rounded-xl flex items-center gap-2 font-bold transition-colors border ${showArchived ? 'bg-amber-100 text-amber-700 border-amber-200' : 'glass-panel text-gray-600 border-gray-300 hover:bg-gray-50'}`}
                        title={showArchived ? 'نمایش جاری' : 'نمایش بایگانی'}
                    >
                        <Archive size={20} />
                        <span className="hidden sm:inline">{showArchived ? 'نمایش جاری' : 'نمایش بایگانی'}</span>
                    </button>
                    <button onClick={() => setViewMode('reports')} className="glass-panel border border-gray-300 text-gray-700 p-2 sm:px-4 sm:py-2 rounded-xl flex items-center gap-2 hover:bg-gray-50 font-bold transition-colors" title="گزارشات">
                        <FileSpreadsheet size={20} /> <span className="hidden sm:inline">گزارشات</span>
                    </button>
                    <button onClick={() => setShowNewModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white p-2 sm:px-4 sm:py-2 rounded-xl flex items-center gap-2 font-bold transition-colors shadow-lg shadow-blue-600/20" title="ثبت پرونده جدید">
                        <Plus size={20} /> <span className="hidden sm:inline">جدید</span>
                    </button>
                </div>
            </div>

            {/* Dashboard Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {navLevel !== 'GROUP' ? (
                    groupedData.map((item: any) => (
                        <div key={item.name} onClick={() => item.type === 'company' ? goCompany(item.name) : goGroup(item.name)} className="glass-panel p-6 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all cursor-pointer group relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-2 h-full bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <div className="flex justify-between items-center mb-4">
                                <div className="bg-blue-50 p-3 rounded-xl text-blue-600 group-hover:scale-110 transition-transform">
                                    {item.type === 'company' ? <Building2 size={24} /> : <Package size={24} />}
                                </div>
                                <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-xs font-bold">{item.count} پرونده</span>
                            </div>
                            <h3 className="font-bold text-gray-800 text-lg mb-1">{item.name}</h3>
                            <p className="text-xs text-gray-500">کلیک برای مشاهده جزئیات</p>
                        </div>
                    ))
                ) : (
                    safeRecords
                        .filter(r => {
                            const matchSearch = searchTerm.trim() === '' || 
                                r.goodsName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                r.fileNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                (r.sellerName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                                (r.orderNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                                (r.registrationNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                                r.items.some(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()));

                            return (showArchived ? r.isArchived : !r.isArchived) && 
                                   ((r.company || 'بدون شرکت') === selectedCompany) && 
                                   ((r.commodityGroup || 'سایر') === selectedGroup) && 
                                   matchSearch;
                        })
                        .map(record => (
                            <div key={record.id} onClick={() => { setSelectedRecord(record); setViewMode('details'); setActiveTab('timeline'); }} className="glass-panel p-5 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all cursor-pointer group border-l-4 border-l-transparent hover:border-l-blue-500 relative">
                                {/* DELETE BUTTON ADDED HERE - Moved to Right to avoid status overlap */}
                                <button 
                                    onClick={(e) => handleDeleteRecord(record.id, e)} 
                                    className="absolute top-4 right-4 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all z-10"
                                    title="حذف پرونده"
                                >
                                    <Trash2 size={18}/>
                                </button>

                                <div className="flex justify-between items-start mb-3">
                                    <h3 className="font-bold text-gray-800 line-clamp-1 pr-8" title={record.goodsName}>{record.goodsName}</h3>
                                    <span className={`text-[10px] px-2 py-1 rounded-lg ${record.status === 'Completed' ? 'bg-green-100 text-green-700' : 'bg-blue-50 text-blue-700'}`}>{record.status === 'Completed' ? 'تکمیل شده' : 'جاری'}</span>
                                </div>
                                <div className="space-y-1.5 text-xs text-gray-500">
                                    <div className="flex items-center gap-1"><FolderOpen size={12} /> پرونده: <span className="font-mono text-gray-700 font-bold">{record.fileNumber}</span></div>
                                    <div className="flex items-center gap-1"><Building2 size={12} /> فروشنده: <span className="text-gray-700">{record.sellerName}</span></div>
                                    <div className="flex items-center gap-1"><History size={12} /> شروع: <span>{new Date(record.startDate).toLocaleDateString('fa-IR')}</span></div>
                                </div>
                            </div>
                        ))
                )}
            </div>
            
            {/* New Record Modal */}
            {showNewModal && (
                <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
                    <div className="glass-panel rounded-2xl shadow-xl w-full max-w-md p-6 animate-scale-in">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-xl text-gray-800">ثبت پرونده جدید</h3>
                            <button onClick={() => setShowNewModal(false)}><X size={24} className="text-gray-400 hover:text-red-500" /></button>
                        </div>
                        <div className="space-y-4">
                            <div><label className="block text-sm font-bold text-gray-700 mb-1">شماره پرونده</label><input className="w-full border rounded-xl p-3 bg-gray-50 font-mono text-left dir-ltr" value={newFileNumber} onChange={e => setNewFileNumber(e.target.value)} placeholder="File No..." /></div>
                            <div><label className="block text-sm font-bold text-gray-700 mb-1">نام کالا (شرح کلی)</label><input className="w-full border rounded-xl p-3" value={newGoodsName} onChange={e => setNewGoodsName(e.target.value)} placeholder="مثال: قطعات یدکی..." /></div>
                            <div><label className="block text-sm font-bold text-gray-700 mb-1">فروشنده</label><input className="w-full border rounded-xl p-3" value={newSellerName} onChange={e => setNewSellerName(e.target.value)} placeholder="Seller Name..." /></div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div><label className="block text-sm font-bold text-gray-700 mb-1">گروه کالایی</label><input list="commodity-groups" className="w-full border rounded-xl p-3" value={newCommodityGroup} onChange={e => setNewCommodityGroup(e.target.value)} placeholder="انتخاب..." /><datalist id="commodity-groups">{commodityGroups.map(g => <option key={g} value={g} />)}</datalist></div>
                                <div><label className="block text-sm font-bold text-gray-700 mb-1">ارز پایه</label><select className="w-full border rounded-xl p-3 glass-panel" value={newMainCurrency} onChange={e => setNewMainCurrency(e.target.value)}>{CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}</select></div>
                            </div>
                            <div><label className="block text-sm font-bold text-gray-700 mb-1">شرکت</label><select className="w-full border rounded-xl p-3 glass-panel" value={newRecordCompany} onChange={e => setNewRecordCompany(e.target.value)}><option value="">انتخاب شرکت...</option>{availableCompanies.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                            <button onClick={handleCreateRecord} disabled={!newFileNumber || !newGoodsName || !newRecordCompany} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-600/20 mt-4 disabled:opacity-50 transition-all">ایجاد پرونده</button>
                        </div>
                    </div>
                </div>
            )}
            {/* Tranche Deliveries Modal */}
            {renderTrancheDeliveriesModal()}

            {/* Subtab Back Trigger */}
            {viewMode === 'details' ? (
                <button data-subtab-back="true" onClick={() => { setViewMode('dashboard'); setSelectedRecord(null); }} className="hidden" />
            ) : (
                viewMode !== 'dashboard' && (
                    <button data-subtab-back="true" onClick={() => setViewMode('dashboard')} className="hidden" />
                )
            )}
        </div>
    );
};

export default TradeModule;