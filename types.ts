
export enum UserRole {
  ADMIN = 'admin',
  CEO = 'ceo',
  FINANCIAL = 'financial',
  MANAGER = 'manager',
  SALES_MANAGER = 'sales_manager',
  FACTORY_MANAGER = 'factory_manager',
  WAREHOUSE_KEEPER = 'warehouse_keeper',
  SECURITY_HEAD = 'security_head',
  SECURITY_GUARD = 'security_guard',
  USER = 'user'
}

export interface User {
  id: string;
  username: string;
  password?: string;
  fullName: string;
  role: UserRole | string;
  avatar?: string;
  phoneNumber?: string;
  telegramChatId?: string;
  baleChatId?: string;
  canManageTrade?: boolean;
  receiveNotifications?: boolean;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
}

export interface Company {
  id: string;
  name: string;
  logo?: string;
  showInWarehouse?: boolean;
  banks?: CompanyBank[];
  // Added missing company info properties
  letterhead?: string;
  registrationNumber?: string;
  nationalId?: string;
  address?: string;
  phone?: string;
  fax?: string;
  postalCode?: string;
  economicCode?: string;
}

export interface CompanyBank {
  id: string;
  bankName: string;
  accountNumber: string;
  sheba?: string;
  formLayoutId?: string;
  internalTransferTemplateId?: string;
  internalWithdrawalTemplateId?: string;
  internalDepositTemplateId?: string;
  enableDualPrint?: boolean;
}

export interface Contact {
  id: string;
  name: string;
  number: string;
  isGroup: boolean;
  baleId?: string;
}

export interface RolePermissions {
  canViewAll: boolean;
  canCreatePaymentOrder: boolean;
  canViewPaymentOrders: boolean;
  canApproveFinancial: boolean;
  canApproveManager: boolean;
  canApproveCeo: boolean;
  canEditOwn: boolean;
  canEditAll: boolean;
  canDeleteOwn: boolean;
  canDeleteAll: boolean;
  canManageTrade: boolean;
  canManageSettings: boolean;
  canCreateExitPermit: boolean;
  canViewExitPermits: boolean;
  canApproveExitCeo: boolean;
  canApproveExitFactory: boolean;
  canApproveExitWarehouse: boolean;
  canApproveExitSecurity: boolean;
  canViewExitArchive: boolean;
  canEditExitArchive: boolean;
  canManageWarehouse: boolean;
  canViewWarehouseReports: boolean;
  canApproveBijak: boolean;
  canViewSecurity: boolean;
  canCreateSecurityLog: boolean;
  canApproveSecuritySupervisor: boolean;
}

export interface CustomRole {
  id: string;
  label: string;
}

export interface FiscalYear {
  id: string;
  label: string;
  isClosed: boolean;
  companySequences?: Record<string, CompanySequenceConfig>;
  createdAt: number;
}

export interface CompanySequenceConfig {
  startTrackingNumber: number;
  startExitPermitNumber: number;
  startBijakNumber: number;
}

export interface PrintTemplate {
  id: string;
  name: string;
  width: number;
  height: number;
  pageSize: 'A4' | 'A5';
  orientation: 'portrait' | 'landscape';
  backgroundImage?: string;
  fields: PrintField[];
}

export interface PrintField {
  id: string;
  key: string;
  label: string;
  x: number;
  y: number;
  width?: number;
  fontSize: number;
  align?: 'left' | 'center' | 'right';
  isBold?: boolean;
  letterSpacing?: number;
}

export interface SystemSettings {
  currentTrackingNumber: number;
  currentExitPermitNumber: number;
  companyNames: string[];
  companies?: Company[];
  defaultCompany?: string;
  warehouseSequences?: Record<string, number>;
  bongahGroupId?: string;
  bongahTelegramId?: string;
  bongahBaleId?: string;
  activeFiscalYearId?: string;
  fiscalYears?: FiscalYear[];
  savedContacts?: Contact[];
  bankNames?: string[];
  operatingBankNames?: string[];
  commodityGroups: string[];
  // Added missing settings properties
  insuranceCompanies?: string[];
  companyNotifications?: Record<string, { salesManager?: string, warehouseGroup?: string }>;
  customRoles?: CustomRole[];
  printTemplates?: PrintTemplate[];
  rolePermissions?: Record<string, Partial<RolePermissions>>;
  pwaIcon?: string;
  telegramBotToken?: string;
  telegramAdminId?: string;
  baleBotToken?: string;
  smsApiKey?: string;
  smsSenderNumber?: string;
  googleCalendarId?: string;
  whatsappNumber?: string;
  geminiApiKey?: string;
  defaultWarehouseGroup?: string;
  defaultSalesManager?: string;
  exitPermitNotificationGroup?: string;
  exitPermitSecondGroupConfig?: { groupId: string; activeStatuses: string[] };
  dailySecurityMeta?: Record<string, DailySecurityMeta>;
}

// --- WAREHOUSE ---
export interface WarehouseItem {
  id: string;
  name: string;
  code: string;
  unit: string;
  containerCapacity?: number;
}

export interface WarehouseTransactionItem {
  itemId: string;
  itemName: string;
  quantity: number;
  weight: number;
  unitPrice?: number;
}

export interface WarehouseTransaction {
  id: string;
  type: 'IN' | 'OUT';
  date: string;
  company: string;
  number: number;
  items: WarehouseTransactionItem[];
  createdAt: number;
  createdBy: string;
  proformaNumber?: string;
  recipientName?: string;
  driverName?: string;
  plateNumber?: string;
  destination?: string;
  status?: 'PENDING' | 'APPROVED' | 'REJECTED';
  approvedBy?: string;
  description?: string;
  rejectionReason?: string;
}

// --- BROKERAGE WAREHOUSE ---
export interface BrokerageItem {
  id: string;
  companyName: string;
  name: string;
  color?: string;
  code?: string;
  unit: string;
  initialQuantity: number;
  initialWeight: number;
}

export interface BrokerageTransactionItem {
  itemId: string;
  itemName: string;
  color?: string;
  quantity: number;
  weight: number;
}

export interface BrokerageTransaction {
  id: string;
  type: 'IN' | 'OUT';
  date: string;
  companyName: string;
  serialNumber: number;
  items: BrokerageTransactionItem[];
  recipientName?: string;
  driverName?: string;
  plateNumber?: string;
  destination?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdBy: string;
  approvedBy?: string;
  createdAt: number;
  updatedAt?: number;
  description?: string;
}

// --- PAYMENT ---
export enum PaymentMethod {
  TRANSFER = 'حواله بانکی',
  CHEQUE = 'چک صیادی',
  CASH = 'نقدی',
  POS = 'کارتخوان',
  INTERNAL_TRANSFER = 'حواله داخلی',
  SHEBA = 'شبا',
  SATNA = 'ساتنا',
  PAYA = 'پایا'
}

export interface PaymentDetail {
  id: string;
  method: PaymentMethod;
  amount: number;
  chequeNumber?: string;
  bankName?: string;
  description?: string;
  chequeDate?: string;
  sheba?: string;
  recipientBank?: string;
  paymentId?: string;
  destinationAccount?: string;
  destinationOwner?: string;
  destinationBranch?: string;
}

export enum OrderStatus {
  PENDING = 'در انتظار بررسی مالی',
  APPROVED_FINANCE = 'تایید مالی / در انتظار مدیریت',
  APPROVED_MANAGER = 'تایید مدیریت / در انتظار مدیرعامل',
  APPROVED_CEO = 'تایید نهایی',
  REJECTED = 'رد شده',
  REVOCATION_PENDING_FINANCE = 'درخواست ابطال (مالی)',
  REVOCATION_PENDING_MANAGER = 'تایید ابطال (مدیریت)',
  REVOCATION_PENDING_CEO = 'تایید ابطال (مدیرعامل)',
  REVOKED = 'باطل شده'
}

export interface PaymentOrder {
  id: string;
  trackingNumber: number;
  date: string;
  payee: string;
  totalAmount: number;
  description: string;
  status: OrderStatus;
  requester: string;
  createdAt: number;
  updatedAt?: number;
  paymentDetails: PaymentDetail[];
  payingCompany?: string;
  attachments?: { fileName: string, data: string }[];
  rejectionReason?: string;
  rejectedBy?: string;
  approverFinancial?: string;
  approverManager?: string;
  approverCeo?: string;
}

// --- EXIT PERMIT ---
export enum ExitPermitStatus {
  PENDING_CEO = 'در انتظار تایید مدیرعامل',
  PENDING_FACTORY = 'تایید مدیرعامل / در انتظار خروج (کارخانه)',
  PENDING_WAREHOUSE = 'تایید مدیر کارخانه / در انتظار توزین انبار',
  PENDING_SECURITY = 'تایید انبار / در انتظار تایید نهایی خروج',
  EXITED = 'خروج نهایی',
  REJECTED = 'رد شده'
}

export interface ExitPermitItem {
  id: string;
  goodsName: string;
  cartonCount: number;
  weight: number;
  deliveredCartonCount?: number;
  deliveredWeight?: number;
}

export interface ExitPermitDestination {
  id: string;
  recipientName: string;
  address: string;
  phone?: string;
}

export interface ExitPermit {
  id: string;
  permitNumber: number;
  company: string;
  date: string;
  requester: string;
  items: ExitPermitItem[];
  destinations: ExitPermitDestination[];
  goodsName?: string;
  recipientName?: string;
  destinationAddress?: string;
  cartonCount?: number;
  weight?: number;
  plateNumber?: string;
  driverName?: string;
  description?: string;
  status: ExitPermitStatus;
  createdAt: number;
  updatedAt?: number;
  approverCeo?: string;
  approverFactory?: string;
  approverWarehouse?: string;
  approverSecurity?: string;
  exitTime?: string;
  rejectionReason?: string;
  rejectedBy?: string;
}

// --- SECURITY ---
export enum SecurityStatus {
  PENDING_SUPERVISOR = 'در انتظار تایید سرپرست',
  PENDING_FACTORY = 'در انتظار تایید مدیر کارخانه',
  PENDING_CEO = 'در انتظار تایید مدیرعامل',
  ARCHIVED = 'بایگانی شده',
  REJECTED = 'رد شده'
}

export interface SecurityLog {
  id: string;
  rowNumber: number;
  date: string;
  shift: string;
  origin: string;
  entryTime: string;
  exitTime: string;
  driverName: string;
  plateNumber: string;
  goodsName: string;
  quantity: string;
  destination: string;
  receiver: string;
  workDescription: string;
  permitProvider: string;
  registrant: string;
  status: SecurityStatus;
  createdAt: number;
  approverSupervisor?: string;
  approverFactory?: string;
  approverCeo?: string;
}

export interface PersonnelDelay {
  id: string;
  date: string;
  personnelName: string;
  unit: string;
  arrivalTime: string;
  delayAmount: string;
  repeatCount: string;
  instruction: string;
  registrant: string;
  status: SecurityStatus;
  createdAt: number;
  approverSupervisor?: string;
  approverFactory?: string;
  approverCeo?: string;
}

export interface SecurityIncident {
  id: string;
  reportNumber: string;
  date: string;
  subject: string;
  description: string;
  shift: string;
  witnesses: string;
  registrant: string;
  status: SecurityStatus;
  createdAt: number;
  rejectionReason?: string;
  approverSupervisor?: string;
  approverFactory?: string;
  approverCeo?: string;
  shiftManagerOpinion?: string;
  hrAction?: string;
  safetyAction?: string;
}

export interface DailySecurityMeta {
  dailyDescription?: string;
  morningGuard?: { name: string, entry: string, exit: string };
  eveningGuard?: { name: string, entry: string, exit: string };
  nightGuard?: { name: string, entry: string, exit: string };
  isFactoryDailyApproved?: boolean;
  isCeoDailyApproved?: boolean;
}

// --- TRADE ---
export enum TradeStage {
  PROFORMA = 'دریافت پروفرما',
  INSURANCE = 'بیمه باربری',
  LICENSES = 'ثبت سفارش و مجوزها',
  ALLOCATION_QUEUE = 'صف تخصیص ارز',
  ALLOCATION_APPROVED = 'تخصیص ارز انجام شد',
  CURRENCY_PURCHASE = 'خرید و حواله ارز',
  SHIPPING_DOCS = 'اسناد حمل',
  INSPECTION = 'بازرسی کالا',
  CLEARANCE_DOCS = 'ترخیصیه و قبض انبار',
  GREEN_LEAF = 'اظهارنامه (برگ سبز)',
  INTERNAL_SHIPPING = 'حمل داخلی',
  AGENT_FEES = 'هزینه‌های ترخیص',
  FINAL_COST = 'محاسبه بهای تمام شده'
}

export interface TradeItem {
  id: string;
  name: string;
  weight: number;
  unitPrice: number;
  totalPrice: number;
  hsCode?: string;
}

export interface TradeStageData {
  stage: TradeStage;
  isCompleted: boolean;
  description?: string;
  costRial: number;
  costCurrency: number;
  currencyType: string;
  attachments: { fileName: string, url: string }[];
  updatedAt: number;
  updatedBy: string;
  queueDate?: string;
  allocationDate?: string;
  allocationCode?: string;
  allocationExpiry?: string;
}

export interface InsuranceEndorsement {
  id: string;
  date: string;
  amount: number;
  description: string;
}

export interface CurrencyTranche {
  id: string;
  date: string;
  amount: number;
  currencyType: string;
  exchangeName: string;
  brokerName: string;
  rate?: number;
  rialAmount?: number;
  currencyFee?: number;
  isDelivered: boolean;
  deliveryDate?: string;
  receivedAmount?: number;
  returnAmount?: number;
  returnDate?: string;
}

export interface CurrencyPurchaseData {
  payments: any[];
  purchasedAmount: number;
  purchasedCurrencyType: string;
  purchaseDate: string;
  brokerName: string;
  exchangeName: string;
  deliveredAmount: number;
  deliveredCurrencyType: string;
  deliveryDate: string;
  recipientName: string;
  remittedAmount: number;
  isDelivered: boolean;
  tranches: CurrencyTranche[];
  guaranteeCheque?: {
    chequeNumber: string;
    bank: string;
    amount: number;
    dueDate: string;
    isDelivered: boolean;
  };
}

export interface TradeTransaction {
  id: string;
  date: string;
  amount: number;
  bank: string;
  description: string;
}

export interface ShippingDocument {
  id: string;
  type: ShippingDocType;
  status: DocStatus;
  documentNumber: string;
  documentDate: string;
  createdAt: number;
  createdBy: string;
  attachments: { fileName: string, url: string }[];
  invoiceItems?: InvoiceItem[];
  packingItems?: PackingItem[];
  freightCost?: number;
  currency?: string;
  netWeight?: number;
  grossWeight?: number;
  packagesCount?: number;
  vesselName?: string;
  portOfLoading?: string;
  portOfDischarge?: string;
  description?: string;
}

export type ShippingDocType = 'Commercial Invoice' | 'Packing List' | 'Bill of Lading' | 'Certificate of Origin';
export type DocStatus = 'Draft' | 'Final';

export interface InvoiceItem {
  id: string;
  name: string;
  weight: number;
  unitPrice: number;
  totalPrice: number;
  part: string;
}

export interface PackingItem {
  id: string;
  description: string;
  netWeight: number;
  grossWeight: number;
  packageCount: number;
  part: string;
}

export interface InspectionCertificate {
  id: string;
  part: string;
  company: string;
  certificateNumber: string;
  amount: number;
  description?: string;
}

export interface InspectionPayment {
  id: string;
  part: string;
  amount: number;
  date: string;
  bank: string;
  description?: string;
}

export interface InspectionData {
  certificates: InspectionCertificate[];
  payments: InspectionPayment[];
  certificateNumber?: string;
  inspectionCompany?: string;
  totalInvoiceAmount?: number;
}

export interface WarehouseReceipt {
  id: string;
  number: string;
  part: string;
  issueDate: string;
}

export interface ClearancePayment {
  id: string;
  amount: number;
  part: string;
  bank: string;
  date: string;
  payingBank?: string;
}

export interface ClearanceData {
  receipts: WarehouseReceipt[];
  payments: ClearancePayment[];
}

export interface GreenLeafCustomsDuty {
  id: string;
  cottageNumber: string;
  part: string;
  amount: number;
  paymentMethod: 'Bank' | 'Guarantee';
  bank?: string;
  date?: string;
}

export interface GreenLeafGuarantee {
  id: string;
  relatedDutyId: string;
  guaranteeNumber: string;
  chequeNumber?: string;
  chequeBank?: string;
  chequeDate?: string;
  chequeAmount?: number;
  isDelivered: boolean;
  cashAmount?: number;
  cashBank?: string;
  cashDate?: string;
  part?: string;
  guaranteeBank?: string;
}

export interface GreenLeafTax {
  id: string;
  amount: number;
  part: string;
  bank: string;
  date: string;
}

export interface GreenLeafRoadToll {
  id: string;
  amount: number;
  part: string;
  bank: string;
  date: string;
}

export interface GreenLeafData {
  duties: GreenLeafCustomsDuty[];
  guarantees: GreenLeafGuarantee[];
  taxes: GreenLeafTax[];
  roadTolls: GreenLeafRoadToll[];
}

export interface ShippingPayment {
  id: string;
  part: string;
  amount: number;
  date: string;
  bank: string;
  description: string;
}

export interface InternalShippingData {
  payments: ShippingPayment[];
}

export interface AgentPayment {
  id: string;
  agentName: string;
  amount: number;
  bank: string;
  date: string;
  part: string;
  description: string;
}

export interface AgentData {
  payments: AgentPayment[];
}

export interface TradeRecord {
    id: string;
    fileNumber: string;
    orderNumber?: string; // Added missing property
    goodsName: string;
    sellerName: string;
    commodityGroup: string;
    mainCurrency: string;
    company: string;
    status: 'Active' | 'Completed';
    isArchived?: boolean;
    stages: Record<string, TradeStageData>;
    items: TradeItem[];
    freightCost: number;
    startDate: string;
    createdAt: number;
    // Added missing data properties
    registrationNumber?: string;
    registrationDate?: string;
    registrationExpiry?: string;
    currencyAllocationType?: string;
    allocationCurrencyRank?: 'Type1' | 'Type2';
    operatingBank?: string;
    isPriority?: boolean;
    licenseData?: { transactions: TradeTransaction[] };
    insuranceData?: {
        policyNumber: string;
        company: string;
        cost: number;
        bank: string;
        endorsements: InsuranceEndorsement[];
        isPaid: boolean;
        paymentDate: string;
    };
    inspectionData?: InspectionData;
    currencyPurchaseData?: CurrencyPurchaseData;
    shippingDocuments?: ShippingDocument[];
    clearanceData?: ClearanceData;
    greenLeafData?: GreenLeafData;
    internalShippingData?: InternalShippingData;
    agentData?: AgentData;
    isCommitmentFulfilled?: boolean;
    exchangeRate?: number;
    createdBy?: string;
}

// --- CHAT ---
export interface ChatMessage {
  id: string;
  sender: string;
  senderUsername: string;
  role: string;
  message: string;
  timestamp: number;
  recipient?: string;
  groupId?: string;
  replyTo?: {
    id: string;
    sender: string;
    message: string;
  };
  audioUrl?: string;
  attachment?: {
    fileName: string;
    url: string;
  };
  isEdited?: boolean;
}

export interface ChatGroup {
  id: string;
  name: string;
  members: string[];
  createdBy: string;
}

export interface GroupTask {
  id: string;
  groupId: string;
  title: string;
  isCompleted: boolean;
  createdBy: string;
  createdAt: number;
}
