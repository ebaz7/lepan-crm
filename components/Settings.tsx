
import React, { useState, useEffect, useRef } from 'react';
import { getSettings, saveSettings, uploadFile } from '../services/storageService';
import { SystemSettings, Company, Contact, CompanyBank, User, PrintTemplate } from '../types';
import { Settings as SettingsIcon, Save, Loader2, Database, Bell, Plus, Trash2, Building, ShieldCheck, Landmark, AppWindow, BellRing, BellOff, Send, Image as ImageIcon, Pencil, X, Check, MessageCircle, RefreshCw, Users, FolderSync, Smartphone, Link, Truck, DownloadCloud, UploadCloud, Warehouse, FileText, Container, LayoutTemplate, WifiOff, Info, RefreshCcw } from 'lucide-react';
import { apiCall } from '../services/apiService';
import { requestNotificationPermission, setNotificationPreference, isNotificationEnabledInApp } from '../services/notificationService';
import { getUsers } from '../services/authService';
import { generateUUID } from '../constants';
import PrintTemplateDesigner from './PrintTemplateDesigner';
import { FiscalYearManager } from './FiscalModule'; 
import SecondExitGroupSettings from './settings/SecondExitGroupSettings';
import RolePermissionsEditor from './settings/RolePermissionsEditor';
import BackupManager from './settings/BackupManager'; 
import BotManager from './settings/BotManager'; 

// Internal QRCode Component with Error Handling
const QRCode = ({ value, size }: { value: string, size: number }) => { 
    const [error, setError] = useState(false);
    
    if (error) {
        return (
            <div className="flex flex-col items-center justify-center text-gray-400 text-xs border-2 border-dashed border-gray-300 rounded-lg p-2" style={{width: size, height: size}}>
                <WifiOff size={24} className="mb-2"/>
                <span className="text-center">امکان نمایش QR وجود ندارد (آفلاین)</span>
            </div>
        );
    }

    return (
        <img 
            src={`https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(value)}`} 
            alt="QR Code" 
            width={size} 
            height={size} 
            className="mix-blend-multiply" 
            onError={() => setError(true)}
        />
    ); 
};

const Settings: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<'system' | 'fiscal' | 'data' | 'integrations' | 'whatsapp' | 'permissions' | 'warehouse' | 'commerce' | 'templates'>('system');
  const [settings, setSettings] = useState<SystemSettings>({ 
      currentTrackingNumber: 1000, 
      currentExitPermitNumber: 1000, 
      companyNames: [], 
      companies: [], 
      defaultCompany: '', 
      bankNames: [], 
      operatingBankNames: [], 
      commodityGroups: [], 
      rolePermissions: {}, 
      customRoles: [], 
      savedContacts: [], 
      pwaIcon: '', 
      telegramBotToken: '', 
      telegramAdminId: '', 
      baleBotToken: '', 
      smsApiKey: '', 
      smsSenderNumber: '', 
      googleCalendarId: '', 
      whatsappNumber: '', 
      geminiApiKey: '',
      warehouseSequences: {},
      companyNotifications: {},
      defaultWarehouseGroup: '',
      defaultSalesManager: '',
      insuranceCompanies: [],
      exitPermitNotificationGroup: '',
      printTemplates: [],
      fiscalYears: []
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [restoring, setRestoring] = useState(false);
  
  // Designer State
  const [showDesigner, setShowDesigner] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<PrintTemplate | null>(null);

  // Local States for Form Inputs
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyLogo, setNewCompanyLogo] = useState('');
  const [newCompanyShowInWarehouse, setNewCompanyShowInWarehouse] = useState(true);
  const [newCompanyBanks, setNewCompanyBanks] = useState<CompanyBank[]>([]);
  const [newCompanyLetterhead, setNewCompanyLetterhead] = useState('');
  
  // New Company Fields
  const [newCompanyRegNum, setNewCompanyRegNum] = useState('');
  const [newCompanyNatId, setNewCompanyNatId] = useState('');
  const [newCompanyAddress, setNewCompanyAddress] = useState('');
  const [newCompanyPhone, setNewCompanyPhone] = useState('');
  const [newCompanyFax, setNewCompanyFax] = useState('');
  const [newCompanyPostalCode, setNewCompanyPostalCode] = useState('');
  const [newCompanyEcoCode, setNewCompanyEcoCode] = useState('');

  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null);
  const [editingBankId, setEditingBankId] = useState<string | null>(null);
  
  // Local states for adding/editing banks
  const [tempBankName, setTempBankName] = useState('');
  const [tempAccountNum, setTempAccountNum] = useState('');
  const [tempBankSheba, setTempBankSheba] = useState('');
  const [tempBankLayout, setTempBankLayout] = useState<string>('');
  const [tempInternalLayout, setTempInternalLayout] = useState<string>('');
  const [tempInternalWithdrawalLayout, setTempInternalWithdrawalLayout] = useState<string>('');
  const [tempInternalDepositLayout, setTempInternalDepositLayout] = useState<string>('');
  const [tempDualPrint, setTempDualPrint] = useState(false);

  // Commerce Local States
  const [newInsuranceCompany, setNewInsuranceCompany] = useState('');

  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingLetterhead, setIsUploadingLetterhead] = useState(false);
  const companyLogoInputRef = useRef<HTMLInputElement>(null);
  const companyLetterheadInputRef = useRef<HTMLInputElement>(null);

  const [whatsappStatus, setWhatsappStatus] = useState<{ready: boolean, qr: string | null, user: string | null} | null>(null);
  const [refreshingWA, setRefreshingWA] = useState(false);
  const [restartingWA, setRestartingWA] = useState(false); 
  
  // Contact States
  const [contactName, setContactName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [contactBaleId, setContactBaleId] = useState('');
  const [isGroupContact, setIsGroupContact] = useState(false);
  const [editingContactId, setEditingContactId] = useState<string | null>(null); 
  
  const [fetchingGroups, setFetchingGroups] = useState(false);
  const [newOperatingBank, setNewOperatingBank] = useState('');
  const [newCommodity, setNewCommodity] = useState('');
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const iconInputRef = useRef<HTMLInputElement>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const isSecure = window.isSecureContext;
  
  // App Users to merge into contacts list
  const [appUsers, setAppUsers] = useState<(Contact | User)[]>([]);

  useEffect(() => { 
      loadSettings(); 
      setNotificationsEnabled(isNotificationEnabledInApp()); 
      checkWhatsappStatus();
      loadAppUsers();
  }, []);

  const loadSettings = async () => { 
      try { 
          const data = await getSettings(); 
          let safeData = { ...data };
          // Ensure arrays exist
          safeData.currentExitPermitNumber = safeData.currentExitPermitNumber || 1000;
          safeData.companies = safeData.companies || [];
          safeData.operatingBankNames = safeData.operatingBankNames || [];
          safeData.insuranceCompanies = safeData.insuranceCompanies || [];
          if (safeData.companyNames?.length > 0 && safeData.companies.length === 0) {
              safeData.companies = safeData.companyNames.map(name => ({ id: generateUUID(), name, showInWarehouse: true, banks: [] }));
          }
          if(!safeData.warehouseSequences) safeData.warehouseSequences = {};
          if(!safeData.companyNotifications) safeData.companyNotifications = {};
          if(!safeData.customRoles) safeData.customRoles = [];
          if(!safeData.printTemplates) safeData.printTemplates = [];
          if(!safeData.fiscalYears) safeData.fiscalYears = [];
          if(!safeData.rolePermissions) safeData.rolePermissions = {}; // Ensure defined

          setSettings(safeData); 
      } catch (e) { console.error("Failed to load settings"); } 
  };

  const loadAppUsers = async () => {
      try {
          const users = await getUsers();
          const contacts = users
              .filter(u => u.phoneNumber)
              .map(u => ({
                  id: u.id,
                  name: `(کاربر) ${u.fullName}`,
                  number: u.phoneNumber!,
                  isGroup: false,
                  baleId: u.baleChatId
              }));
          setAppUsers(contacts);
      } catch (e) { console.error("Failed to load users"); }
  };

  const checkWhatsappStatus = async () => {
      setRefreshingWA(true);
      try {
          const status = await apiCall<{ready: boolean, qr: string | null, user: string | null}>('/whatsapp/status');
          setWhatsappStatus(status);
      } catch (e) { console.error("Failed to check WA status"); } finally { setRefreshingWA(false); }
  };

  const handleWhatsappLogout = async () => {
      if(!confirm('آیا مطمئن هستید؟')) return;
      try { await apiCall('/whatsapp/logout', 'POST'); setTimeout(checkWhatsappStatus, 2000); } catch (e) { alert('خطا'); }
  };
  
  // FORCE RESTART HANDLER
  const handleWhatsappRestart = async () => {
      if (!confirm('آیا می‌خواهید سرویس واتساپ را بازنشانی کنید؟ این کار اتصال فعلی را قطع و یک QR کد جدید تولید می‌کند.')) return;
      setRestartingWA(true);
      try {
          await apiCall('/whatsapp/restart', 'POST');
          alert('درخواست بازنشانی ارسال شد. لطفاً چند لحظه صبر کنید تا QR کد جدید ظاهر شود.');
          // Poll immediately
          setTimeout(checkWhatsappStatus, 3000);
      } catch (e) {
          alert('خطا در بازنشانی سرویس');
      } finally {
          setRestartingWA(false);
      }
  };

  const handleFetchGroups = async () => {
      if (!whatsappStatus?.ready) { alert("واتساپ متصل نیست."); return; }
      setFetchingGroups(true);
      try {
          const response = await apiCall<{success: boolean, groups: {id: string, name: string}[]}>('/whatsapp/groups');
          if (response.success && response.groups) {
              const existingIds = new Set((settings.savedContacts || []).map(c => c.number));
              const newGroups = response.groups.filter(g => !existingIds.has(g.id)).map(g => ({ id: generateUUID(), name: g.name, number: g.id, isGroup: true }));
              if (newGroups.length > 0) {
                  setSettings({ ...settings, savedContacts: [...(settings.savedContacts || []), ...newGroups] });
                  alert(`${newGroups.length} گروه اضافه شد.`);
              } else alert("گروه جدیدی یافت نشد.");
          }
      } catch (e) { alert("خطا در دریافت."); } finally { setFetchingGroups(false); }
  };

  useEffect(() => {
      let interval: any;
      if (activeCategory === 'whatsapp' && whatsappStatus && !whatsappStatus.ready) {
          interval = setInterval(checkWhatsappStatus, 3000); 
      }
      return () => clearInterval(interval);
  }, [activeCategory, whatsappStatus]);

  const handleSave = async (e: React.FormEvent) => { 
      e.preventDefault(); setLoading(true); 
      try { 
          let currentCompanies = [...(settings.companies || [])];
          
          if (activeCategory === 'data' && (newCompanyName.trim() || editingCompanyId)) {
              if (editingCompanyId) {
                  currentCompanies = currentCompanies.map(c =>
                      c.id === editingCompanyId
                          ? { 
                              ...c, 
                              name: newCompanyName.trim(), 
                              logo: newCompanyLogo, 
                              showInWarehouse: newCompanyShowInWarehouse,
                              banks: newCompanyBanks,
                              letterhead: newCompanyLetterhead,
                              registrationNumber: newCompanyRegNum,
                              nationalId: newCompanyNatId,
                              address: newCompanyAddress,
                              phone: newCompanyPhone,
                              fax: newCompanyFax,
                              postalCode: newCompanyPostalCode,
                              economicCode: newCompanyEcoCode
                            }
                          : c
                  );
              } else if (newCompanyName.trim()) {
                  currentCompanies = [...currentCompanies, {
                      id: generateUUID(),
                      name: newCompanyName.trim(),
                      logo: newCompanyLogo,
                      showInWarehouse: newCompanyShowInWarehouse,
                      banks: newCompanyBanks,
                      letterhead: newCompanyLetterhead,
                      registrationNumber: newCompanyRegNum,
                      nationalId: newCompanyNatId,
                      address: newCompanyAddress,
                      phone: newCompanyPhone,
                      fax: newCompanyFax,
                      postalCode: newCompanyPostalCode,
                      economicCode: newCompanyEcoCode
                  }];
              }
              resetCompanyForm();
          }

          const syncedSettings = { 
              ...settings, 
              companies: currentCompanies,
              companyNames: currentCompanies.map(c => c.name),
              // Ensure legacy mapping for notification group
              exitPermitNotificationGroup: settings.defaultWarehouseGroup
          };

          await saveSettings(syncedSettings); 
          setSettings(syncedSettings);
          setMessage('ذخیره شد ✅'); setTimeout(() => setMessage(''), 3000); 
      } catch (e) { setMessage('خطا ❌'); } finally { setLoading(false); } 
  };

  // ... (Keep existing contact handlers) ...
  const handleAddOrUpdateContact = () => { 
      if (!contactName.trim() || !contactNumber.trim()) return; 
      
      const newContactData: Contact = { 
          id: editingContactId || generateUUID(), 
          name: contactName.trim(), 
          number: contactNumber.trim(), 
          baleId: contactBaleId.trim(),
          isGroup: isGroupContact 
      }; 
      
      let updatedContacts;
      if (editingContactId) {
          updatedContacts = (settings.savedContacts || []).map(c => c.id === editingContactId ? newContactData : c);
      } else {
          updatedContacts = [...(settings.savedContacts || []), newContactData];
      }

      setSettings({ ...settings, savedContacts: updatedContacts }); 
      resetContactForm();
  };

  const handleEditContact = (c: Contact) => {
      setEditingContactId(c.id);
      setContactName(c.name);
      setContactNumber(c.number);
      setContactBaleId(c.baleId || '');
      setIsGroupContact(c.isGroup);
  };

  const handleDeleteContact = (id: string) => { 
      if(confirm('حذف شود؟')) {
        setSettings({ ...settings, savedContacts: (settings.savedContacts || []).filter(c => c.id !== id) }); 
        if(editingContactId === id) resetContactForm();
      }
  };

  const resetContactForm = () => {
      setContactName(''); 
      setContactNumber(''); 
      setContactBaleId('');
      setIsGroupContact(false); 
      setEditingContactId(null);
  };
  
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (!file) return; setIsUploadingLogo(true); const reader = new FileReader(); reader.onload = async (ev) => { try { const result = await uploadFile(file.name, ev.target?.result as string); setNewCompanyLogo(result.url); } catch (error) { alert('خطا در آپلود'); } finally { setIsUploadingLogo(false); } }; reader.readAsDataURL(file); };
  const handleLetterheadUpload = async (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (!file) return; setIsUploadingLetterhead(true); const reader = new FileReader(); reader.onload = async (ev) => { try { const result = await uploadFile(file.name, ev.target?.result as string); setNewCompanyLetterhead(result.url); } catch (error) { alert('خطا در آپلود'); } finally { setIsUploadingLetterhead(false); } }; reader.readAsDataURL(file); };

  const handleSaveCompany = () => { if (!newCompanyName.trim()) return; let updatedCompanies = settings.companies || []; const companyData = { id: editingCompanyId || generateUUID(), name: newCompanyName.trim(), logo: newCompanyLogo, showInWarehouse: newCompanyShowInWarehouse, banks: newCompanyBanks, letterhead: newCompanyLetterhead, registrationNumber: newCompanyRegNum, nationalId: newCompanyNatId, address: newCompanyAddress, phone: newCompanyPhone, fax: newCompanyFax, postalCode: newCompanyPostalCode, economicCode: newCompanyEcoCode }; if (editingCompanyId) { updatedCompanies = updatedCompanies.map(c => c.id === editingCompanyId ? companyData : c); } else { updatedCompanies = [...updatedCompanies, companyData]; } setSettings({ ...settings, companies: updatedCompanies, companyNames: updatedCompanies.map(c => c.name) }); resetCompanyForm(); };
  const handleEditCompany = (c: Company) => { setNewCompanyName(c.name); setNewCompanyLogo(c.logo || ''); setNewCompanyShowInWarehouse(c.showInWarehouse !== false); setNewCompanyBanks(c.banks || []); setNewCompanyLetterhead(c.letterhead || ''); setNewCompanyRegNum(c.registrationNumber || ''); setNewCompanyNatId(c.nationalId || ''); setNewCompanyAddress(c.address || ''); setNewCompanyPhone(c.phone || ''); setNewCompanyFax(c.fax || ''); setNewCompanyPostalCode(c.postalCode || ''); setNewCompanyEcoCode(c.economicCode || ''); setEditingCompanyId(c.id); };
  const resetCompanyForm = () => { setNewCompanyName(''); setNewCompanyLogo(''); setNewCompanyShowInWarehouse(true); setNewCompanyBanks([]); setNewCompanyLetterhead(''); setNewCompanyRegNum(''); setNewCompanyNatId(''); setNewCompanyAddress(''); setNewCompanyPhone(''); setNewCompanyFax(''); setNewCompanyPostalCode(''); setNewCompanyEcoCode(''); setEditingCompanyId(null); resetBankForm(); };
  const resetBankForm = () => { setTempBankName(''); setTempAccountNum(''); setTempBankSheba(''); setTempBankLayout(''); setTempInternalLayout(''); setTempInternalWithdrawalLayout(''); setTempInternalDepositLayout(''); setTempDualPrint(false); setEditingBankId(null); };
  const handleRemoveCompany = (id: string) => { if(confirm("حذف؟")) { const updated = (settings.companies || []).filter(c => c.id !== id); setSettings({ ...settings, companies: updated, companyNames: updated.map(c => c.name) }); } };
  const addOrUpdateCompanyBank = () => { if (!tempBankName) return; const bankData: CompanyBank = { id: editingBankId || generateUUID(), bankName: tempBankName, accountNumber: tempAccountNum, sheba: tempBankSheba, formLayoutId: tempBankLayout, internalTransferTemplateId: tempInternalLayout, enableDualPrint: tempDualPrint, internalWithdrawalTemplateId: tempInternalWithdrawalLayout, internalDepositTemplateId: tempInternalDepositLayout }; if (editingBankId) { setNewCompanyBanks(newCompanyBanks.map(b => b.id === editingBankId ? bankData : b)); } else { setNewCompanyBanks([...newCompanyBanks, bankData]); } resetBankForm(); };
  const editCompanyBank = (bank: CompanyBank) => { setTempBankName(bank.bankName); setTempAccountNum(bank.accountNumber); setTempBankSheba(bank.sheba || ''); setTempBankLayout(bank.formLayoutId || ''); setTempInternalLayout(bank.internalTransferTemplateId || ''); setTempDualPrint(bank.enableDualPrint || false); setTempInternalWithdrawalLayout(bank.internalWithdrawalTemplateId || ''); setTempInternalDepositLayout(bank.internalDepositTemplateId || ''); setEditingBankId(bank.id); };
  const removeCompanyBank = (id: string) => { setNewCompanyBanks(newCompanyBanks.filter(b => b.id !== id)); if (editingBankId === id) resetBankForm(); };

  const handleAddOperatingBank = () => { if (newOperatingBank.trim() && !(settings.operatingBankNames || []).includes(newOperatingBank.trim())) { setSettings({ ...settings, operatingBankNames: [...(settings.operatingBankNames || []), newOperatingBank.trim()] }); setNewOperatingBank(''); } };
  const handleRemoveOperatingBank = (name: string) => { setSettings({ ...settings, operatingBankNames: (settings.operatingBankNames || []).filter(b => b !== name) }); };
  const handleAddCommodity = () => { if (newCommodity.trim() && !settings.commodityGroups.includes(newCommodity.trim())) { setSettings({ ...settings, commodityGroups: [...settings.commodityGroups, newCommodity.trim()] }); setNewCommodity(''); } };
  const handleRemoveCommodity = (name: string) => { setSettings({ ...settings, commodityGroups: settings.commodityGroups.filter(c => c !== name) }); };
  const handleAddInsuranceCompany = () => { if (newInsuranceCompany.trim() && !(settings.insuranceCompanies || []).includes(newInsuranceCompany.trim())) { setSettings({ ...settings, insuranceCompanies: [...(settings.insuranceCompanies || []), newInsuranceCompany.trim()] }); setNewInsuranceCompany(''); } };
  const handleRemoveInsuranceCompany = (name: string) => { setSettings({ ...settings, insuranceCompanies: (settings.insuranceCompanies || []).filter(c => c !== name) }); };
  
  const handleIconChange = async (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (!file) return; setUploadingIcon(true); const reader = new FileReader(); reader.onload = async (ev) => { try { const res = await uploadFile(file.name, ev.target?.result as string); setSettings({ ...settings, pwaIcon: res.url }); } catch (error) { alert('خطا'); } finally { setUploadingIcon(false); } }; reader.readAsDataURL(file); };
  const handleToggleNotifications = async () => { if (!isSecure && window.location.hostname !== 'localhost') { alert("برای فعال‌سازی نوتیفیکیشن نیاز به HTTPS است."); return; } const granted = await requestNotificationPermission(); if (granted) { setNotificationPreference(true); setNotificationsEnabled(true); alert("نوتیفیکیشن فعال شد. اتصال به سرور بروزرسانی شد."); } else { alert("دسترسی به نوتیفیکیشن مسدود است یا پشتیبانی نمی‌شود."); } };
  const handleTestNotification = async () => { try { const userStr = localStorage.getItem('app_current_user'); const username = userStr ? JSON.parse(userStr).username : 'test'; await apiCall('/send-test-push', 'POST', { username }); alert("درخواست تست ارسال شد."); } catch (e: any) { let msg = "خطا در ارسال تست"; if (e.message && e.message.includes('404')) { if (confirm("اشتراک نوتیفیکیشن شما در سرور یافت نشد. آیا می‌خواهید مجدداً فعال‌سازی کنید؟")) { handleToggleNotifications(); return; } msg = "اشتراک یافت نشد."; } else if (e.message) { msg += `: ${e.message}`; } alert(msg); } };
  const handleSaveTemplate = (template: PrintTemplate) => { const existing = settings.printTemplates || []; const updated = editingTemplate ? existing.map(t => t.id === template.id ? template : t) : [...existing, template]; setSettings({ ...settings, printTemplates: updated }); setShowDesigner(false); setEditingTemplate(null); };
  const handleEditTemplate = (t: PrintTemplate) => { setEditingTemplate(t); setShowDesigner(true); };
  const handleDeleteTemplate = (id: string) => { if(!confirm('حذف قالب؟')) return; const updated = (settings.printTemplates || []).filter(t => t.id !== id); setSettings({ ...settings, printTemplates: updated }); };

  const handleUpdateSettings = (newSettings: SystemSettings) => {
      setSettings(newSettings);
  };

  if (showDesigner) {
      return <PrintTemplateDesigner onSave={handleSaveTemplate} onCancel={() => setShowDesigner(false)} initialTemplate={editingTemplate} />;
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col md:flex-row min-h-[600px] mb-20 animate-fade-in">
        
        {/* Sidebar */}
        <div className="w-full md:w-64 bg-gray-50 border-b md:border-b-0 md:border-l border-gray-200 p-4">
            <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2 px-2"><SettingsIcon size={24} className="text-blue-600"/> تنظیمات</h2>
            <nav className="space-y-1">
                <button onClick={() => setActiveCategory('system')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeCategory === 'system' ? 'bg-white shadow text-blue-700 font-bold' : 'text-gray-600 hover:bg-gray-100'}`}><AppWindow size={18}/> عمومی و سیستم</button>
                <button onClick={() => setActiveCategory('fiscal')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeCategory === 'fiscal' ? 'bg-white shadow text-emerald-700 font-bold' : 'text-gray-600 hover:bg-gray-100'}`}><FolderSync size={18}/> مدیریت سال مالی</button>
                <button onClick={() => setActiveCategory('data')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeCategory === 'data' ? 'bg-white shadow text-indigo-700 font-bold' : 'text-gray-600 hover:bg-gray-100'}`}><Database size={18}/> اطلاعات پایه</button>
                <button onClick={() => setActiveCategory('templates')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeCategory === 'templates' ? 'bg-white shadow text-teal-700 font-bold' : 'text-gray-600 hover:bg-gray-100'}`}><LayoutTemplate size={18}/> قالب‌های چاپ</button>
                <button onClick={() => setActiveCategory('commerce')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeCategory === 'commerce' ? 'bg-white shadow text-rose-700 font-bold' : 'text-gray-600 hover:bg-gray-100'}`}><Container size={18}/> تنظیمات بازرگانی</button>
                <button onClick={() => setActiveCategory('warehouse')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeCategory === 'warehouse' ? 'bg-white shadow text-orange-700 font-bold' : 'text-gray-600 hover:bg-gray-100'}`}><Warehouse size={18}/> انبار</button>
                <button onClick={() => setActiveCategory('integrations')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeCategory === 'integrations' ? 'bg-white shadow text-purple-700 font-bold' : 'text-gray-600 hover:bg-gray-100'}`}><Link size={18}/> اتصالات (API)</button>
                <button onClick={() => setActiveCategory('whatsapp')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeCategory === 'whatsapp' ? 'bg-white shadow text-green-700 font-bold' : 'text-gray-600 hover:bg-gray-100'}`}><MessageCircle size={18}/> پیام‌رسان‌ها</button>
                <button onClick={() => setActiveCategory('permissions')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeCategory === 'permissions' ? 'bg-white shadow text-amber-700 font-bold' : 'text-gray-600 hover:bg-gray-100'}`}><ShieldCheck size={18}/> دسترسی‌ها و نقش‌ها</button>
            </nav>
        </div>

        <div className="flex-1 p-6 md:p-8 overflow-y-auto max-h-[calc(100vh-100px)]">
            {activeCategory === 'fiscal' ? (
                <FiscalYearManager />
            ) : (
                <form onSubmit={handleSave} className="space-y-8 max-w-4xl mx-auto">
                    
                    {activeCategory === 'system' && (
                        <div className="space-y-8 animate-fade-in">
                             <div className="space-y-4">
                                <h3 className="font-bold text-gray-800 border-b pb-2">تنظیمات ظاهری و اعلان‌ها</h3>
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 rounded-xl border border-gray-200 overflow-hidden flex items-center justify-center bg-gray-50">{settings.pwaIcon ? <img src={settings.pwaIcon} className="w-full h-full object-cover" /> : <ImageIcon className="text-gray-300" />}</div>
                                    <div>
                                        <input type="file" ref={iconInputRef} className="hidden" accept="image/*" onChange={handleIconChange} />
                                        <button type="button" onClick={() => iconInputRef.current?.click()} className="text-blue-600 text-sm hover:underline font-bold" disabled={uploadingIcon}>{uploadingIcon ? '...' : 'تغییر آیکون برنامه'}</button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <button type="button" onClick={handleToggleNotifications} className={`w-full px-4 py-2 rounded-lg border flex items-center justify-center gap-2 transition-colors ${notificationsEnabled ? 'bg-green-50 border-green-200 text-green-700' : 'bg-gray-50 text-gray-600'}`}>
                                        {notificationsEnabled ? <BellRing size={18} /> : <BellOff size={18} />}
                                        <span>{notificationsEnabled ? 'نوتیفیکیشن‌ها فعال است' : 'فعال‌سازی نوتیفیکیشن'}</span>
                                    </button>
                                    <button type="button" onClick={handleTestNotification} className="w-full px-4 py-2 rounded-lg border bg-blue-50 border-blue-200 text-blue-700 flex items-center justify-center gap-2 transition-colors hover:bg-blue-100">
                                        <Send size={18}/> <span>ارسال پیام تست</span>
                                    </button>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <h3 className="font-bold text-gray-800 border-b pb-2 flex items-center gap-2"><Truck size={20}/> شماره‌گذاری اسناد (تنظیمات پیش‌فرض)</h3>
                                <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 text-xs text-amber-800 mb-2">
                                    نکته: این تنظیمات فقط در صورتی اعمال می‌شود که سال مالی فعال نباشد یا تنظیمی برای شرکت در سال مالی وجود نداشته باشد.
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div><label className="text-sm font-bold text-gray-700 block mb-1">شروع شماره دستور پرداخت</label><input type="number" className="w-full border rounded-lg p-2 dir-ltr text-left" value={settings.currentTrackingNumber} onChange={(e) => setSettings({...settings, currentTrackingNumber: Number(e.target.value)})} /></div>
                                    <div><label className="text-sm font-bold text-gray-700 block mb-1">شروع شماره مجوز خروج</label><input type="number" className="w-full border rounded-lg p-2 dir-ltr text-left" value={settings.currentExitPermitNumber} onChange={(e) => setSettings({...settings, currentExitPermitNumber: Number(e.target.value)})} /></div>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {activeCategory === 'whatsapp' && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="flex justify-between items-center border-b pb-2">
                                <h3 className="font-bold text-gray-800 flex items-center gap-2"><MessageCircle size={20}/> مدیریت پیام‌رسان‌ها (واتساپ و بله)</h3>
                                <div className="flex gap-2">
                                    <button type="button" onClick={handleFetchGroups} className="text-xs bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-indigo-100">
                                        {fetchingGroups ? <Loader2 size={14} className="animate-spin"/> : <RefreshCw size={14}/>} بروزرسانی گروه‌ها
                                    </button>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <h4 className="font-bold text-sm text-gray-600">اتصال واتساپ (Web JS)</h4>
                                    <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 flex flex-col items-center justify-center min-h-[250px] bg-gray-50 relative">
                                        {whatsappStatus?.ready ? (
                                            <div className="text-center animate-fade-in">
                                                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3 text-green-600"><Check size={32}/></div>
                                                <h4 className="font-bold text-green-700 mb-1">متصل است</h4>
                                                <p className="text-xs text-gray-500">{whatsappStatus.user}</p>
                                                <button type="button" onClick={handleWhatsappLogout} className="mt-4 text-xs text-red-600 hover:underline">خروج از حساب</button>
                                            </div>
                                        ) : (
                                            <div className="text-center w-full">
                                                {refreshingWA ? (
                                                    <div className="flex flex-col items-center gap-2"><Loader2 className="animate-spin text-gray-400" size={32}/><span className="text-xs text-gray-500">در حال بررسی وضعیت...</span></div>
                                                ) : whatsappStatus?.qr ? (
                                                    <div className="flex flex-col items-center animate-scale-in">
                                                        <div className="bg-white p-2 rounded-lg shadow-sm mb-3"><QRCode value={whatsappStatus.qr} size={180} /></div>
                                                        <p className="text-xs text-gray-600 font-bold mb-1">اسکن کنید</p>
                                                        <p className="text-[10px] text-gray-400">QR کد هر 30 ثانیه منقضی می‌شود</p>
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col items-center">
                                                        <p className="text-sm text-gray-500 mb-3">QR کد یافت نشد. سرویس را بررسی کنید.</p>
                                                        <button type="button" onClick={checkWhatsappStatus} className="text-xs bg-blue-50 text-blue-600 px-3 py-1 rounded">تلاش مجدد</button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        {restartingWA && (
                                            <div className="absolute inset-0 bg-white/80 backdrop-blur-[1px] flex flex-col items-center justify-center z-10">
                                                <Loader2 className="animate-spin text-purple-600 mb-2" size={32}/>
                                                <span className="text-xs font-bold text-purple-700">در حال بازنشانی سرویس...</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-gray-500">وضعیت سرویس: {whatsappStatus ? 'آنلاین' : 'آفلاین'}</span>
                                        <button type="button" onClick={handleWhatsappRestart} className="text-orange-600 hover:underline font-bold" disabled={restartingWA}>بازنشانی کامل سرویس (Restart)</button>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <h4 className="font-bold text-sm text-gray-600">تنظیمات ربات‌ها (Token)</h4>
                                    <div className="space-y-3">
                                        <div>
                                            <label className="text-xs font-bold text-gray-500 block mb-1">توکن ربات تلگرام</label>
                                            <input className="w-full border rounded p-2 text-xs dir-ltr font-mono" value={settings.telegramBotToken || ''} onChange={e => setSettings({...settings, telegramBotToken: e.target.value})} placeholder="123456:ABC-..." type="password"/>
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-gray-500 block mb-1">شناسه عددی مدیر (تلگرام)</label>
                                            <input className="w-full border rounded p-2 text-xs dir-ltr font-mono" value={settings.telegramAdminId || ''} onChange={e => setSettings({...settings, telegramAdminId: e.target.value})} placeholder="12345678"/>
                                        </div>
                                        <div className="border-t pt-3">
                                            <label className="text-xs font-bold text-gray-500 block mb-1">توکن ربات بله</label>
                                            <input className="w-full border rounded p-2 text-xs dir-ltr font-mono" value={settings.baleBotToken || ''} onChange={e => setSettings({...settings, baleBotToken: e.target.value})} placeholder="Token..." type="password"/>
                                        </div>
                                        <div className="border-t pt-3">
                                            <label className="text-xs font-bold text-gray-500 block mb-1">کلید Gemini AI (اختیاری)</label>
                                            <input className="w-full border rounded p-2 text-xs dir-ltr font-mono" value={settings.geminiApiKey || ''} onChange={e => setSettings({...settings, geminiApiKey: e.target.value})} placeholder="AI Key..." type="password"/>
                                        </div>
                                    </div>
                                    <div className="bg-blue-50 p-3 rounded-lg text-[10px] text-blue-800 leading-relaxed">
                                        نکته: برای دریافت پیام‌های سیستم در تلگرام/بله، ابتدا ربات را استارت کنید. شناسه عددی خود را می‌توانید از ربات‌های userinfobot بگیرید.
                                    </div>
                                </div>
                            </div>
                            <div className="border-t pt-6">
                                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Users size={20}/> دفترچه تلفن (مخاطبین و گروه‌ها)</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4 items-end bg-gray-50 p-4 rounded-xl">
                                    <div className="flex-1 w-full"><label className="text-xs font-bold text-gray-500 block mb-1">نام مخاطب / گروه</label><input className="w-full border rounded-lg p-2 text-sm" value={contactName} onChange={e => setContactName(e.target.value)} placeholder="مثال: مدیر مالی"/></div>
                                    <div className="flex-1 w-full"><label className="text-xs font-bold text-gray-500 block mb-1">شماره / شناسه گروه (واتساپ)</label><input className="w-full border rounded-lg p-2 text-sm dir-ltr" value={contactNumber} onChange={e => setContactNumber(e.target.value)} placeholder="98912... / 123@g.us"/></div>
                                    <div className="flex-1 w-full"><label className="text-xs font-bold text-gray-500 block mb-1">آیدی بله (اختیاری)</label><input className="w-full border rounded-lg p-2 text-sm dir-ltr" value={contactBaleId} onChange={e => setContactBaleId(e.target.value)} placeholder="@id"/></div>
                                    <div className="flex items-center gap-2 mb-2"><input type="checkbox" id="isGroup" checked={isGroupContact} onChange={e => setIsGroupContact(e.target.checked)} className="w-4 h-4"/><label htmlFor="isGroup" className="text-xs font-bold text-gray-600">این یک گروه است</label></div>
                                    <div className="flex gap-2 w-full md:w-auto">{editingContactId && <button type="button" onClick={resetContactForm} className="bg-gray-200 text-gray-700 p-2 rounded-lg"><X size={18}/></button>}<button type="button" onClick={handleAddOrUpdateContact} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-700 flex-1">{editingContactId ? 'ویرایش' : 'افزودن'}</button></div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-60 overflow-y-auto pr-1">
                                    {settings.savedContacts?.map(c => (
                                        <div key={c.id} className="flex items-center justify-between p-3 bg-white border rounded-lg shadow-sm group hover:border-blue-300 transition-colors">
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <div className={`p-2 rounded-full shrink-0 ${c.isGroup ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>{c.isGroup ? <Users size={16}/> : <Smartphone size={16}/>}</div>
                                                <div className="truncate"><div className="font-bold text-xs text-gray-800 truncate">{c.name}</div><div className="text-[10px] text-gray-400 font-mono truncate">{c.number}</div></div>
                                            </div>
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"><button type="button" onClick={() => handleEditContact(c)} className="p-1 text-blue-500 hover:bg-blue-50 rounded"><Pencil size={14}/></button><button type="button" onClick={() => handleDeleteContact(c.id)} className="p-1 text-red-500 hover:bg-red-50 rounded"><Trash2 size={14}/></button></div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <BotManager />
                        </div>
                    )}
                    
                    {activeCategory === 'warehouse' && (
                        <div className="space-y-6 animate-fade-in">
                            <h3 className="font-bold text-gray-800 border-b pb-2 flex items-center gap-2"><Warehouse size={20}/> تنظیمات انبار</h3>
                            
                            {/* UPDATED: Default Group Settings with 3 Columns */}
                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                                <h4 className="font-bold text-sm text-gray-700 mb-3 border-b pb-1">گروه اطلاع‌رسانی پیش‌فرض (عمومی)</h4>
                                <p className="text-xs text-gray-500 mb-3">اگر برای شرکتی گروه اختصاصی تنظیم نشود، پیام‌ها به این مقصدها ارسال خواهند شد.</p>
                                
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    {/* WhatsApp */}
                                    <div className="bg-green-50 p-2 rounded border border-green-200">
                                        <div className="flex items-center gap-1 mb-1 text-green-700 font-bold text-[10px]">
                                            <MessageCircle size={12}/> واتساپ (گروه)
                                        </div>
                                        <select 
                                            className="w-full border rounded-lg p-2 text-sm bg-white" 
                                            value={settings.defaultWarehouseGroup || ''} 
                                            onChange={e => setSettings({...settings, defaultWarehouseGroup: e.target.value})}
                                        >
                                            <option value="">-- انتخاب گروه --</option>
                                            {settings.savedContacts?.filter(c => c.isGroup).map(c => (
                                                <option key={c.id} value={c.number}>{c.name} {c.baleId ? '(+Bale)' : ''}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Bale */}
                                    <div className="bg-cyan-50 p-2 rounded border border-cyan-200">
                                        <div className="flex items-center gap-1 mb-1 text-cyan-700 font-bold text-[10px]">
                                            <Send size={12}/> بله (شناسه گروه/کانال)
                                        </div>
                                        <input 
                                            className="w-full border rounded p-2 text-sm dir-ltr bg-white" 
                                            placeholder="ID..." 
                                            value={settings.exitPermitNotificationBaleId || ''}
                                            onChange={e => setSettings({...settings, exitPermitNotificationBaleId: e.target.value})}
                                        />
                                    </div>

                                    {/* Telegram */}
                                    <div className="bg-blue-50 p-2 rounded border border-blue-200">
                                        <div className="flex items-center gap-1 mb-1 text-blue-700 font-bold text-[10px]">
                                            <Send size={12}/> تلگرام (Chat ID)
                                        </div>
                                        <input 
                                            className="w-full border rounded p-2 text-sm dir-ltr bg-white" 
                                            placeholder="-100..." 
                                            value={settings.exitPermitNotificationTelegramId || ''}
                                            onChange={e => setSettings({...settings, exitPermitNotificationTelegramId: e.target.value})}
                                        />
                                    </div>
                                </div>
                            </div>
                            
                            <div className="space-y-4">
                                <div>
                                    <label className="text-sm font-bold text-gray-700 block mb-1">شماره مدیر فروش (پیش‌فرض)</label>
                                    <input className="w-full border rounded-lg p-3 dir-ltr text-left" value={settings.defaultSalesManager || ''} onChange={e => setSettings({...settings, defaultSalesManager: e.target.value})} placeholder="98912..." />
                                </div>
                            </div>

                            <div className="mt-6">
                                <h4 className="font-bold text-sm text-gray-700 mb-3 border-b pb-1">تنظیمات اطلاع‌رسانی خروج (شرکت‌ها)</h4>
                                <div className="space-y-3">
                                    {settings.companies?.filter(c => c.showInWarehouse !== false).map(c => {
                                        const conf = settings.companyNotifications?.[c.name] || {};
                                        return (
                                            <div key={c.id} className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                                                <h5 className="font-bold text-sm text-blue-800 mb-3 border-b border-gray-200 pb-1">{c.name}</h5>
                                                
                                                <div className="space-y-3">
                                                    <div>
                                                        <label className="text-xs block mb-1 font-bold text-gray-600">مدیر فروش (واتساپ):</label>
                                                        <input 
                                                            className="w-full border rounded p-2 text-xs dir-ltr" 
                                                            value={conf.salesManager || ''} 
                                                            onChange={e => {
                                                                const newConf = { ...settings.companyNotifications, [c.name]: { ...conf, salesManager: e.target.value } };
                                                                setSettings({ ...settings, companyNotifications: newConf });
                                                            }} 
                                                            placeholder="98912..." 
                                                        />
                                                    </div>

                                                    {/* UPDATED: Unified Group Config (WhatsApp, Bale, Telegram) */}
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                        {/* WhatsApp */}
                                                        <div className="bg-green-50 p-2 rounded border border-green-200">
                                                            <div className="flex items-center gap-1 mb-1 text-green-700 font-bold text-[10px]">
                                                                <MessageCircle size={12}/> واتساپ (گروه)
                                                            </div>
                                                            <select 
                                                                className="w-full border rounded p-1.5 text-xs dir-ltr bg-white" 
                                                                value={conf.warehouseGroup || ''} 
                                                                onChange={e => {
                                                                    const newConf = { ...settings.companyNotifications, [c.name]: { ...conf, warehouseGroup: e.target.value } };
                                                                    setSettings({ ...settings, companyNotifications: newConf });
                                                                }}
                                                            >
                                                                <option value="">-- انتخاب --</option>
                                                                {settings.savedContacts?.filter(c => c.isGroup).map(grp => (
                                                                    <option key={grp.id} value={grp.number}>{grp.name}</option>
                                                                ))}
                                                            </select>
                                                        </div>

                                                        {/* Bale */}
                                                        <div className="bg-cyan-50 p-2 rounded border border-cyan-200">
                                                            <div className="flex items-center gap-1 mb-1 text-cyan-700 font-bold text-[10px]">
                                                                <Send size={12}/> بله (شناسه)
                                                            </div>
                                                            <input 
                                                                className="w-full border rounded p-1.5 text-xs dir-ltr bg-white" 
                                                                placeholder="ID..." 
                                                                value={conf.baleChannelId || ''}
                                                                onChange={e => {
                                                                    const newConf = { ...settings.companyNotifications, [c.name]: { ...conf, baleChannelId: e.target.value } };
                                                                    setSettings({ ...settings, companyNotifications: newConf });
                                                                }}
                                                            />
                                                        </div>

                                                        {/* Telegram */}
                                                        <div className="bg-blue-50 p-2 rounded border border-blue-200">
                                                            <div className="flex items-center gap-1 mb-1 text-blue-700 font-bold text-[10px]">
                                                                <Send size={12}/> تلگرام (Chat ID)
                                                            </div>
                                                            <input 
                                                                className="w-full border rounded p-1.5 text-xs dir-ltr bg-white" 
                                                                placeholder="-100..." 
                                                                value={conf.telegramChannelId || ''}
                                                                onChange={e => {
                                                                    const newConf = { ...settings.companyNotifications, [c.name]: { ...conf, telegramChannelId: e.target.value } };
                                                                    setSettings({ ...settings, companyNotifications: newConf });
                                                                }}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                            
                            <SecondExitGroupSettings 
                                settings={settings} 
                                setSettings={setSettings} 
                                contacts={[...(settings.savedContacts || []), ...appUsers as Contact[]]} 
                            />
                        </div>
                    )}
                    
                    {activeCategory === 'data' && (
                         <div className="space-y-8 animate-fade-in">
                            <BackupManager />
                            <div className="space-y-4">
                            <h3 className="font-bold text-gray-800 border-b pb-2 flex items-center gap-2"><Building size={20}/> مدیریت شرکت‌ها و بانک‌ها</h3>
                            
                            {/* Company Form */}
                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                                <div className="flex justify-between items-center mb-4">
                                    <h4 className="font-bold text-sm text-gray-700">{editingCompanyId ? 'ویرایش شرکت' : 'افزودن شرکت جدید'}</h4>
                                    {editingCompanyId && <button type="button" onClick={resetCompanyForm} className="text-xs text-red-500 bg-white border border-red-100 px-2 py-1 rounded">انصراف</button>}
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                    <div><label className="text-xs font-bold block mb-1 text-gray-500">نام شرکت</label><input type="text" className="w-full border rounded-lg p-2 text-sm" placeholder="نام شرکت..." value={newCompanyName} onChange={(e) => setNewCompanyName(e.target.value)} /></div>
                                    <div className="flex gap-2 items-end">
                                        <div className="flex-1"><label className="text-xs font-bold block mb-1 text-gray-500">لوگو</label><div className="flex items-center gap-2 border rounded-lg p-1 bg-white h-[42px]"><input type="file" ref={companyLogoInputRef} className="hidden" onChange={handleLogoUpload} accept="image/*"/><button type="button" onClick={() => companyLogoInputRef.current?.click()} className="text-xs bg-gray-100 px-2 py-1 rounded hover:bg-gray-200" disabled={isUploadingLogo}>{isUploadingLogo ? '...' : 'انتخاب'}</button>{newCompanyLogo && <img src={newCompanyLogo} className="h-8 w-8 object-contain"/>}</div></div>
                                        <div className="flex-1"><label className="text-xs font-bold block mb-1 text-gray-500">سربرگ (A4)</label><div className="flex items-center gap-2 border rounded-lg p-1 bg-white h-[42px]"><input type="file" ref={companyLetterheadInputRef} className="hidden" onChange={handleLetterheadUpload} accept="image/*"/><button type="button" onClick={() => companyLetterheadInputRef.current?.click()} className="text-xs bg-gray-100 px-2 py-1 rounded hover:bg-gray-200" disabled={isUploadingLetterhead}>{isUploadingLetterhead ? '...' : 'انتخاب'}</button>{newCompanyLetterhead && <span className="text-[10px] text-green-600 truncate">دارد</span>}</div></div>
                                    </div>
                                    <div className={`flex items-center gap-2 bg-white px-2 py-2 rounded border cursor-pointer flex-1 h-[42px] ${newCompanyShowInWarehouse ? 'border-green-200 bg-green-50 text-green-700' : ''}`} onClick={() => setNewCompanyShowInWarehouse(!newCompanyShowInWarehouse)}><input type="checkbox" checked={newCompanyShowInWarehouse} onChange={e => setNewCompanyShowInWarehouse(e.target.checked)} className="w-4 h-4"/><span className="text-xs font-bold select-none">نمایش در انبار</span></div>
                                    <div><label className="text-xs font-bold block mb-1 text-gray-500">شناسه ملی</label><input className="w-full border rounded-lg p-2 text-sm dir-ltr" value={newCompanyNatId} onChange={e => setNewCompanyNatId(e.target.value)}/></div>
                                    <div><label className="text-xs font-bold block mb-1 text-gray-500">شماره ثبت</label><input className="w-full border rounded-lg p-2 text-sm dir-ltr" value={newCompanyRegNum} onChange={e => setNewCompanyRegNum(e.target.value)}/></div>
                                    <div><label className="text-xs font-bold block mb-1 text-gray-500">کد اقتصادی</label><input className="w-full border rounded-lg p-2 text-sm dir-ltr" value={newCompanyEcoCode} onChange={e => setNewCompanyEcoCode(e.target.value)}/></div>
                                    <div><label className="text-xs font-bold block mb-1 text-gray-500">تلفن</label><input className="w-full border rounded-lg p-2 text-sm dir-ltr" value={newCompanyPhone} onChange={e => setNewCompanyPhone(e.target.value)}/></div>
                                    <div><label className="text-xs font-bold block mb-1 text-gray-500">فکس</label><input className="w-full border rounded-lg p-2 text-sm dir-ltr" value={newCompanyFax} onChange={e => setNewCompanyFax(e.target.value)}/></div>
                                    <div><label className="text-xs font-bold block mb-1 text-gray-500">کد پستی</label><input className="w-full border rounded-lg p-2 text-sm dir-ltr" value={newCompanyPostalCode} onChange={e => setNewCompanyPostalCode(e.target.value)}/></div>
                                    <div className="md:col-span-2"><label className="text-xs font-bold block mb-1 text-gray-500">آدرس</label><input className="w-full border rounded-lg p-2 text-sm" value={newCompanyAddress} onChange={e => setNewCompanyAddress(e.target.value)}/></div>
                                </div>
                                
                                {/* Company Banks Management */}
                                <div className="bg-white p-3 rounded-lg border border-gray-100 mb-4">
                                    <h5 className="font-bold text-xs text-gray-600 mb-2">حساب‌های بانکی شرکت</h5>
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-2 items-end">
                                        <div className="flex-1"><input className="w-full border rounded p-1.5 text-xs" placeholder="نام بانک" value={tempBankName} onChange={e=>setTempBankName(e.target.value)}/></div>
                                        <div className="flex-1"><input className="w-full border rounded p-1.5 text-xs dir-ltr" placeholder="شماره حساب" value={tempAccountNum} onChange={e=>setTempAccountNum(e.target.value)}/></div>
                                        <div className="flex-1"><input className="w-full border rounded p-1.5 text-xs dir-ltr" placeholder="شبا (IR...)" value={tempBankSheba} onChange={e=>setTempBankSheba(e.target.value)}/></div>
                                        <div><select className="w-full border rounded p-1.5 text-xs" value={tempBankLayout} onChange={e=>setTempBankLayout(e.target.value)}><option value="">قالب چاپ چک</option>{settings.printTemplates?.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
                                        <div className="flex-1"><select className="w-full border rounded p-1.5 text-xs" value={tempInternalLayout} onChange={e=>setTempInternalLayout(e.target.value)}><option value="">قالب رسید داخلی</option>{settings.printTemplates?.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
                                        <div className="flex items-center gap-1 border rounded p-1"><input type="checkbox" checked={tempDualPrint} onChange={e=>setTempDualPrint(e.target.checked)} className="w-3 h-3"/><span className="text-[10px]">چاپ دوگانه (واریز/برداشت)</span></div>
                                        {tempDualPrint && (<><div className="flex-1"><select className="w-full border rounded p-1.5 text-[10px]" value={tempInternalWithdrawalLayout} onChange={e=>setTempInternalWithdrawalLayout(e.target.value)}><option value="">قالب برداشت</option>{settings.printTemplates?.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></div><div className="flex-1"><select className="w-full border rounded p-1.5 text-[10px]" value={tempInternalDepositLayout} onChange={e=>setTempInternalDepositLayout(e.target.value)}><option value="">قالب واریز</option>{settings.printTemplates?.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></div></>)}
                                        <button type="button" onClick={addOrUpdateCompanyBank} className="bg-green-100 text-green-700 px-3 py-1.5 rounded text-xs font-bold hover:bg-green-200">{editingBankId ? 'ویرایش بانک' : 'افزودن بانک'}</button>
                                        {editingBankId && <button type="button" onClick={resetBankForm} className="bg-gray-100 text-gray-600 px-2 py-1.5 rounded text-xs">لغو</button>}
                                    </div>
                                    <div className="space-y-1 max-h-32 overflow-y-auto">
                                        {newCompanyBanks.map((b, i) => (
                                            <div key={b.id} className="flex justify-between items-center bg-gray-50 p-2 rounded text-xs border border-gray-100">
                                                <span>{b.bankName} - {b.accountNumber}</span>
                                                <div className="flex gap-1"><button type="button" onClick={()=>editCompanyBank(b)} className="text-blue-500"><Pencil size={12}/></button><button type="button" onClick={()=>removeCompanyBank(b.id)} className="text-red-500"><Trash2 size={12}/></button></div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <button type="button" onClick={handleSaveCompany} className={`w-full text-white px-4 py-2 rounded-lg text-sm h-10 font-bold shadow-sm ${editingCompanyId ? 'bg-amber-600 hover:bg-amber-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}>{editingCompanyId ? 'ذخیره تغییرات شرکت' : 'افزودن شرکت'}</button>
                                <div className="space-y-2 mt-6 max-h-64 overflow-y-auto border-t pt-4">
                                    {settings.companies?.map(c => (
                                        <div key={c.id} className="flex flex-col bg-white p-3 rounded border shadow-sm gap-2">
                                            <div className="flex justify-between items-center">
                                                <div className="flex items-center gap-2">{c.logo && <img src={c.logo} className="w-6 h-6 object-contain"/>}<span className="text-sm font-bold">{c.name}</span></div>
                                                <div className="flex gap-1"><button type="button" onClick={() => handleEditCompany(c)} className="text-blue-500 p-1 hover:bg-blue-50 rounded"><Pencil size={14}/></button><button type="button" onClick={() => handleRemoveCompany(c.id)} className="text-red-500 p-1 hover:bg-red-50 rounded"><Trash2 size={14}/></button></div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            
                            <div className="bg-white p-4 rounded-xl border border-gray-200">
                                <h3 className="font-bold text-gray-800 border-b pb-2 mb-3">بانک‌های عامل (عمومی)</h3>
                                <div className="flex gap-2 mb-2"><input type="text" className="border rounded p-2 text-sm flex-1" placeholder="نام بانک..." value={newOperatingBank} onChange={e=>setNewOperatingBank(e.target.value)}/><button type="button" onClick={handleAddOperatingBank} className="bg-blue-600 text-white px-3 py-2 rounded text-sm font-bold">افزودن</button></div>
                                <div className="flex flex-wrap gap-2">{settings.operatingBankNames?.map(b => <span key={b} className="bg-gray-100 px-3 py-1 rounded-full text-xs flex items-center gap-1">{b} <button onClick={()=>handleRemoveOperatingBank(b)} className="text-red-500 hover:bg-red-100 rounded-full p-0.5"><X size={12}/></button></span>)}</div>
                            </div>
                            </div>
                        </div>
                    )}
                    
                    {activeCategory === 'commerce' && (
                        <div className="space-y-6 animate-fade-in">
                            <h3 className="font-bold text-gray-800 border-b pb-2 flex items-center gap-2"><Container size={20}/> تنظیمات بازرگانی</h3>
                            <div className="bg-white p-4 rounded-xl border border-gray-200">
                                <h4 className="font-bold text-sm text-gray-700 mb-2">گروه‌های کالایی</h4>
                                <div className="flex gap-2 mb-2"><input type="text" className="border rounded p-2 text-sm flex-1" placeholder="نام گروه..." value={newCommodity} onChange={e=>setNewCommodity(e.target.value)}/><button type="button" onClick={handleAddCommodity} className="bg-blue-600 text-white px-3 py-2 rounded text-sm font-bold">افزودن</button></div>
                                <div className="flex flex-wrap gap-2">{settings.commodityGroups?.map(c => <span key={c} className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs flex items-center gap-1">{c} <button onClick={()=>handleRemoveCommodity(c)} className="text-red-500 hover:bg-red-100 rounded-full p-0.5"><X size={12}/></button></span>)}</div>
                            </div>
                            <div className="bg-white p-4 rounded-xl border border-gray-200">
                                <h4 className="font-bold text-sm text-gray-700 mb-2">شرکت‌های بیمه</h4>
                                <div className="flex gap-2 mb-2"><input type="text" className="border rounded p-2 text-sm flex-1" placeholder="نام شرکت بیمه..." value={newInsuranceCompany} onChange={e=>setNewInsuranceCompany(e.target.value)}/><button type="button" onClick={handleAddInsuranceCompany} className="bg-green-600 text-white px-3 py-2 rounded text-sm font-bold">افزودن</button></div>
                                <div className="flex flex-wrap gap-2">{settings.insuranceCompanies?.map(c => <span key={c} className="bg-green-50 text-green-700 px-3 py-1 rounded-full text-xs flex items-center gap-1">{c} <button onClick={()=>handleRemoveInsuranceCompany(c)} className="text-red-500 hover:bg-red-100 rounded-full p-0.5"><X size={12}/></button></span>)}</div>
                            </div>
                        </div>
                    )}
                    
                    {activeCategory === 'permissions' && (
                        <div className="space-y-6 animate-fade-in">
                            <RolePermissionsEditor settings={settings} onUpdateSettings={handleUpdateSettings} />
                        </div>
                    )}

                    {activeCategory === 'templates' && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="flex justify-between items-center border-b pb-2">
                                <h3 className="font-bold text-gray-800 flex items-center gap-2"><LayoutTemplate size={20}/> مدیریت قالب‌های چاپ (چک / فیش)</h3>
                                <button type="button" onClick={() => setShowDesigner(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-blue-700 flex items-center gap-1"><Plus size={16}/> طراحی قالب جدید</button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {settings.printTemplates?.map(t => (
                                    <div key={t.id} className="bg-white p-4 rounded-xl border hover:shadow-md transition-all group relative overflow-hidden">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <h4 className="font-bold text-gray-800">{t.name}</h4>
                                                <span className="text-[10px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{t.pageSize} - {t.orientation}</span>
                                            </div>
                                            <div className="flex gap-1">
                                                <button type="button" onClick={() => handleEditTemplate(t)} className="text-blue-500 hover:bg-blue-50 p-1.5 rounded"><Pencil size={16}/></button>
                                                <button type="button" onClick={() => handleDeleteTemplate(t.id)} className="text-red-500 hover:bg-red-50 p-1.5 rounded"><Trash2 size={16}/></button>
                                            </div>
                                        </div>
                                        <div className="text-[10px] text-gray-400 mt-2">{t.fields.length} فیلد تعریف شده</div>
                                    </div>
                                ))}
                                {(!settings.printTemplates || settings.printTemplates.length === 0) && <div className="col-span-full text-center text-gray-400 py-10">قالبی یافت نشد.</div>}
                            </div>
                        </div>
                    )}
                    
                    {activeCategory === 'integrations' && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="bg-white p-4 rounded-xl border border-gray-200">
                                <h3 className="font-bold text-gray-800 mb-4 border-b pb-2 flex items-center gap-2"><Link size={20}/> تنظیمات اتصال (SMS / تقویم)</h3>
                                <div className="space-y-4">
                                    <div><label className="text-sm font-bold text-gray-700 block mb-1">API Key سامانه پیامک</label><input type="password" className="w-full border rounded-lg p-2 text-sm dir-ltr" value={settings.smsApiKey} onChange={(e) => setSettings({...settings, smsApiKey: e.target.value})} /></div>
                                    <div><label className="text-sm font-bold text-gray-700 block mb-1">شماره فرستنده پیامک</label><input type="text" className="w-full border rounded-lg p-2 text-sm dir-ltr" value={settings.smsSenderNumber} onChange={(e) => setSettings({...settings, smsSenderNumber: e.target.value})} /></div>
                                    <div><label className="text-sm font-bold text-gray-700 block mb-1">Google Calendar ID</label><input type="text" className="w-full border rounded-lg p-2 text-sm dir-ltr" value={settings.googleCalendarId} onChange={(e) => setSettings({...settings, googleCalendarId: e.target.value})} /></div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end pt-4 border-t sticky bottom-0 bg-white p-4 shadow-inner md:shadow-none md:static">
                        <button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-600/20 transition-all disabled:opacity-70">
                            {loading ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />} ذخیره تنظیمات
                        </button>
                    </div>
                </form>
            )}
        </div>
        {message && (<div className={`fixed bottom-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full text-white text-sm font-bold shadow-2xl z-[100] animate-bounce ${message.includes('خطا') ? 'bg-red-600' : 'bg-green-600'}`}>{message}</div>)}
    </div>
  );
};
export default Settings;
