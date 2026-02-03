
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

export interface CompanyBank {
  id: string;
  bankName: string;
  accountNumber: string;
  sheba?: string;
  formLayoutId?: string;
  internalTransferTemplateId?: string;
  enableDualPrint?: boolean;
  internalWithdrawalTemplateId?: string;
  internalDepositTemplateId?: string;
}

export interface Company {
  id: string;
  name: string;
  logo?: string;
  showInWarehouse?: boolean;
  banks?: CompanyBank[];
  letterhead?: string;
  registrationNumber?: string;
  nationalId?: string;
  address?: string;
  phone?: string;
  fax?: string;
  postalCode?: string;
  economicCode?: string;
}

export interface CustomRole {
  id: string;
  label: string;
}

export interface Contact {
  id: string;
  name: string;
  number: string;
  isGroup: boolean;
  baleId?: string;
}

export interface PrintField {
  id: string;
  key: string;
  label: string;
  x: number;
  y: number;
  width?: number;
  fontSize: number;
  align: 'right' | 'left' | 'center';
  isBold: boolean;
  letterSpacing?: number;
}

export interface PrintTemplate {
  id: string;
  name: string;
  width: number;
  height: number;
  pageSize: 'A4' | 'A5';
  orientation: 'portrait' | 'landscape';
  backgroundImage: string;
  fields: PrintField[];
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

export interface CompanySequenceConfig {
  startTrackingNumber: number;
  startExitPermitNumber: number;
  startBijakNumber: number;
}

export interface FiscalYear {
  id: string;
  label: string;
  isClosed: boolean;
  companySequences?: Record<string, CompanySequenceConfig>;
  createdAt: number;
}

export interface DailySecurityMeta {
  dailyDescription?: string;
  morningGuard?: { name: string; entry: string; exit: string };
  eveningGuard?: { name: string; entry: string; exit: string };
  nightGuard?: { name: string; entry: string; exit: string };
  isFactoryDailyApproved?: boolean;
  isCeoDailyApproved?: boolean;
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
  rolePermissions?: Record<string, RolePermissions>;
  customRoles?: CustomRole[];
  pwaIcon?: string;
  telegramBotToken?: string;
  telegramAdminId?: string;
  baleBotToken?: string;
  smsApiKey?: string;
  smsSenderNumber?: string;
  googleCalendarId?: string;
  whatsappNumber?: string;
  geminiApiKey?: string;
  companyNotifications?: Record<string, any>;
  defaultWarehouseGroup?: string;
  defaultSalesManager?: string;
  insuranceCompanies?: string[];
  exitPermitNotificationGroup?: string;
  exitPermitSecondGroupConfig?: any;
  printTemplates?: PrintTemplate[];
  dailySecurityMeta?: Record<string, DailySecurityMeta>;
}

export enum PaymentMethod {
  TRANSFER = 'حواله بانکی',
  CHEQUE = 'چک',
  SHEBA = 'شبا',
  SATNA = 'ساتنا',
  PAYA = 'پایا',
  INTERNAL_TRANSFER = 'حواله داخلی',
  CASH = 'نقدی',
  POS = 'کارتخوان'
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
  attachments?: { fileName: string; data: string }[];
  approverFinancial?: string;
  approverManager?: string;
  approverCeo?: string;
  rejectionReason?: string;
  rejectedBy?: string;
}

export enum TradeStage {
  PROFORMA = 'پروفرما',
  LICENSES = 'ثبت سفارش و بانکی',
  INSURANCE = 'بیمه باربری',
  ALLOCATION_QUEUE = 'صف تخصیص ارز',
  ALLOCATION_APPROVED = 'تخصیص ارز (تایید)',
  CURRENCY_PURCHASE = 'خرید ارز',
  SHIPPING_DOCS = 'اسناد حمل',
  INSPECTION = 'بازرسی (COI)',
  CLEARANCE_DOCS = 'ترخیصیه و انبارداری',
  GREEN_LEAF = 'برگ سبز (گمرک)',
  INTERNAL_SHIPPING = 'حمل داخلی',
  AGENT_FEES = 'کارمزد ترخیص',
  FINAL_COST = 'محاسبه قیمت تمام شده'
}

export interface TradeStageData {
  stage: TradeStage;
  isCompleted: boolean;
  description?: string;
  costRial: number;
  costCurrency: number;
  currencyType: string;
  attachments: { fileName: string; url: string }[];
  updatedAt: number;
  updatedBy: string;
  queueDate?: string;
  allocationDate?: string;
  allocationCode?: string;
  allocationExpiry?: string;
}

export interface TradeItem {
  id: string;
  name: string;
  weight: number;
  unitPrice: number;
  totalPrice: number;
  hsCode?: string;
}

export interface InsuranceEndorsement {
  id: string;
  date: string;
  amount: number;
  description: string;
}

export interface InsuranceData {
  policyNumber: string;
  company: string;
  cost: number;
  bank: string;
  endorsements: InsuranceEndorsement[];
  isPaid: boolean;
  paymentDate: string;
}

export interface CurrencyTranche {
  id: string;
  date: string;
  amount: number;
  currencyType: string;
  rialAmount: number;
  rate?: number;
  exchangeName: string;
  brokerName: string;
  isDelivered: boolean;
  deliveryDate?: string;
  returnAmount?: number;
  returnDate?: string;
  receivedAmount?: number;
  currencyFee?: number;
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
    amount: number;
    bank: string;
    chequeNumber: string;
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

export type DocStatus = 'Draft' | 'Final';
export type ShippingDocType = 'Commercial Invoice' | 'Packing List' | 'Bill of Lading' | 'Certificate of Origin';

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

export interface ShippingDocument {
  id: string;
  type: ShippingDocType;
  status: DocStatus;
  documentNumber: string;
  documentDate: string;
  createdAt: number;
  createdBy: string;
  attachments: { fileName: string; url: string }[];
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
  createdBy?: string;
  orderNumber?: string;
  registrationNumber?: string;
  registrationDate?: string;
  registrationExpiry?: string;
  currencyAllocationType?: string;
  allocationCurrencyRank?: 'Type1' | 'Type2';
  operatingBank?: string;
  exchangeRate?: number;
  isCommitmentFulfilled?: boolean;
  insuranceData?: InsuranceData;
  inspectionData?: InspectionData;
  clearanceData?: ClearanceData;
  greenLeafData?: GreenLeafData;
  internalShippingData?: InternalShippingData;
  agentData?: AgentData;
  currencyPurchaseData?: CurrencyPurchaseData;
  licenseData?: { transactions: TradeTransaction[] };
  shippingDocuments?: ShippingDocument[];
  isPriority?: boolean;
}

export enum SecurityStatus {
  PENDING_SUPERVISOR = 'در انتظار بررسی سرپرست',
  PENDING_FACTORY = 'در انتظار تایید کارخانه',
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
  approverSupervisor?: string;
  approverFactory?: string;
  approverCeo?: string;
  rejectionReason?: string;
  shiftManagerOpinion?: string;
  hrAction?: string;
  safetyAction?: string;
}

export enum ExitPermitStatus {
  PENDING_CEO = 'در انتظار تایید مدیرعامل',
  PENDING_FACTORY = 'در انتظار تایید مدیر کارخانه',
  PENDING_WAREHOUSE = 'در انتظار تایید انبار',
  PENDING_SECURITY = 'در انتظار تایید خروج',
  EXITED = 'خارج شده',
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
  phone: string;
}

export interface ExitPermit {
  id: string;
  permitNumber: number;
  company: string;
  date: string;
  requester: string;
  items: ExitPermitItem[];
  destinations: ExitPermitDestination[];
  goodsName: string;
  recipientName: string;
  cartonCount: number;
  weight: number;
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
  destinationAddress?: string;
  rejectionReason?: string;
  rejectedBy?: string;
}

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
  isEdited?: boolean;
  attachment?: {
    fileName: string;
    url: string;
  };
  audioUrl?: string;
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
  proformaNumber?: string;
  rejectionReason?: string;
}

export interface WarehouseItem {
  id: string;
  company: string;
  name: string;
  code?: string;
  unit: string;
  initialCount: number;
  initialWeight: number;
}
