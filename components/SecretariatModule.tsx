import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Building, 
  Building2, 
  Lock, 
  Unlock, 
  FileText, 
  Archive, 
  Settings2, 
  Plus, 
  Search, 
  FileDown, 
  Upload, 
  Check, 
  UserPlus, 
  MessageSquare, 
  Trash2, 
  Printer, 
  UserCheck, 
  X, 
  Share2, 
  Calendar, 
  ArrowRight, 
  CornerDownLeft, 
  CheckCircle, 
  Image as ImageIcon,
  ChevronLeft,
  Loader2,
  FileCheck,
  Save,
  Award
} from 'lucide-react';

import { 
  User, 
  UserRole, 
  SystemSettings, 
  Company, 
  SecretariatLetter, 
  SecretariatLetterStatus, 
  SecretariatLetterComment, 
  SecretariatLetterAttachment, 
  SecretariatCompanySettings 
} from '../types';

import { 
  getSecretariatLetters, 
  saveSecretariatLetter, 
  updateSecretariatLetter, 
  deleteSecretariatLetter, 
  getSecretariatSettings, 
  saveSecretariatSettings,
  getSettings,
  uploadFile 
} from '../services/storageService';

import { getUsers } from '../services/authService';
import { generateUUID, getCurrentShamsiDate } from '../constants';

interface SecretariatModuleProps {
  currentUser: User;
}

const SecretariatModule: React.FC<SecretariatModuleProps> = ({ currentUser }) => {
  // --- Data Loading & States ---
  const [letters, setLetters] = useState<SecretariatLetter[]>([]);
  const [secSettings, setSecSettings] = useState<SecretariatCompanySettings[]>([]);
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // --- Nav / UI Control ---
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [activeSection, setActiveSection] = useState<'headquarters' | 'factory' | null>(null);
  const [activeTab, setActiveTab] = useState<'cartable' | 'archive' | 'settings'>('cartable');

  // --- Search & Filters ---
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'internal' | 'incoming' | 'outgoing'>('all');

  // --- Modals & Forms ---
  const [showNewLetterModal, setShowNewLetterModal] = useState(false);
  const [selectedLetterForView, setSelectedLetterForView] = useState<SecretariatLetter | null>(null);
  const [isPrintMode, setIsPrintMode] = useState<SecretariatLetter | null>(null);

  // --- New Letter Form State ---
  const [newLetterForm, setNewLetterForm] = useState({
    date: '',
    subject: '',
    content: '',
    sender: '',
    receiver: '',
    type: 'internal' as 'internal' | 'incoming' | 'outgoing',
    attachments: [] as SecretariatLetterAttachment[],
    addCompanyStamp: false,
    signOffText: 'با تشکر'
  });
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [selectedReferrals, setSelectedReferrals] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Settings Tab Form State ---
  const [companySettingsForm, setCompanySettingsForm] = useState<SecretariatCompanySettings>({
    companyId: '',
    headquartersAccessTokens: [],
    factoryAccessTokens: [],
    letterheadUrl: '',
    meetingMinutesTemplate: '',
    companyStampUrl: '',
    metadataTop: undefined,
    metadataLeft: undefined,
    metadataFontSize: undefined
  });
  const [uploadingLetterhead, setUploadingLetterhead] = useState(false);
  const letterheadInputRef = useRef<HTMLInputElement>(null);
  const [uploadingStamp, setUploadingStamp] = useState(false);
  const stampInputRef = useRef<HTMLInputElement>(null);

  // Load Initial Data
  const loadData = async () => {
    setLoading(true);
    try {
      const [lettersData, settingsData, sysSettings, usersData] = await Promise.all([
        getSecretariatLetters(),
        getSecretariatSettings(),
        getSettings(),
        getUsers()
      ]);
      setLetters(lettersData);
      setSecSettings(settingsData);
      setSystemSettings(sysSettings);
      setUsers(usersData);

      // Auto-set shamsi date for form
      const d = getCurrentShamsiDate();
      const shamsiStr = `${d.year}/${String(d.month).padStart(2, '0')}/${String(d.day).padStart(2, '0')}`;
      setNewLetterForm(prev => ({
        ...prev,
        date: shamsiStr
      }));
    } catch (e) {
      console.error('Error loading Secretariat data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Sync settings form when active company changes
  useEffect(() => {
    if (selectedCompany) {
      const activeSettings = secSettings.find(s => s.companyId === selectedCompany.id) || {
        companyId: selectedCompany.id,
        headquartersAccessTokens: [],
        factoryAccessTokens: [],
        letterheadUrl: '',
        meetingMinutesTemplate: '',
        companyStampUrl: '',
        metadataTop: undefined,
        metadataLeft: undefined,
        metadataFontSize: undefined
      };
      setCompanySettingsForm(activeSettings);
    }
  }, [selectedCompany, secSettings]);

  // Auth/Permissions Check helpers
  const userRoles = currentUser.roles || [currentUser.role];
  const isSuperUser = userRoles.includes('admin') || userRoles.includes('ceo') || currentUser.canManageSecretariatSettings;

  const hasSectionAccess = (sec: 'headquarters' | 'factory', companyId: string) => {
    if (isSuperUser) return true;
    const companySet = secSettings.find(s => s.companyId === companyId);
    if (!companySet) {
      // Default to true if not configured yet, so users are not blocked initially
      return currentUser.canAccessSecretariat;
    }
    const tokens = sec === 'headquarters' 
      ? companySet.headquartersAccessTokens || [] 
      : companySet.factoryAccessTokens || [];
    return tokens.includes(currentUser.id) || currentUser.canAccessSecretariat;
  };

  // Companies List derived from system settings
  const availableCompanies = (systemSettings?.companies || []).filter(comp => 
      isSuperUser || 
      !currentUser.secretariatAllowedCompanies || 
      currentUser.secretariatAllowedCompanies.length === 0 || 
      currentUser.secretariatAllowedCompanies.includes(comp.id)
  );

  // Filter letters based on current company, section, tab (cartable vs archive) and search parameters
  const filteredLetters = letters.filter(letter => {
    if (!selectedCompany || !activeSection) return false;
    
    // Match Company and Section
    if (letter.companyId !== selectedCompany.id || letter.section !== activeSection) return false;

    // Match tab (archive displays archived, cartable displays the rest)
    if (activeTab === 'archive') {
      if (letter.status !== SecretariatLetterStatus.ARCHIVED) return false;
    } else {
      if (letter.status === SecretariatLetterStatus.ARCHIVED) return false;
    }

    // Match type filter
    if (filterType !== 'all' && letter.type !== filterType) return false;

    // Match Search query (subject, content, letter number, sender, receiver)
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchSubject = letter.subject?.toLowerCase().includes(query);
      const matchNum = letter.letterNumber?.toLowerCase().includes(query);
      const matchSender = letter.sender?.toLowerCase().includes(query);
      const matchReceiver = letter.receiver?.toLowerCase().includes(query);
      const matchContent = letter.content?.toLowerCase().includes(query);
      return matchSubject || matchNum || matchSender || matchReceiver || matchContent;
    }

    return true;
  });

  // Calculate Sequential Auto-Letter Number
  const getNextLetterNumber = (company: Company, section: 'headquarters' | 'factory') => {
    const prefix = section === 'headquarters' ? 'HQ' : 'FC';
    // Match letters of this company & section to find latest sequence
    const matchedLetters = letters.filter(l => l.companyId === company.id && l.section === section);
    const count = matchedLetters.length + 1;
    const year = String(getCurrentShamsiDate().year);
    const seq = String(count).padStart(4, '0');
    return `${prefix}/${year}/${seq}`;
  };

  // Handlers for Letter Submissions
  const handleCreateLetter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompany || !activeSection) return;

    const autoNum = getNextLetterNumber(selectedCompany, activeSection);
    const newLetter: SecretariatLetter = {
      id: generateUUID(),
      companyId: selectedCompany.id,
      section: activeSection,
      letterNumber: autoNum,
      date: newLetterForm.date,
      subject: newLetterForm.subject,
      content: newLetterForm.content,
      sender: newLetterForm.sender,
      receiver: newLetterForm.receiver,
      type: newLetterForm.type,
      status: SecretariatLetterStatus.PENDING,
      comments: [],
      attachments: newLetterForm.attachments,
      addCompanyStamp: newLetterForm.addCompanyStamp,
      signOffText: newLetterForm.signOffText,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      createdBy: currentUser.fullName
    };

    try {
      const updatedList = await saveSecretariatLetter(newLetter);
      setLetters(updatedList);
      setShowNewLetterModal(false);
      // Reset form
      const d = getCurrentShamsiDate();
      const shamsiStr = `${d.year}/${String(d.month).padStart(2, '0')}/${String(d.day).padStart(2, '0')}`;
      setNewLetterForm({
        date: shamsiStr,
        subject: '',
        content: '',
        sender: '',
        receiver: '',
        type: 'internal',
        attachments: [],
        addCompanyStamp: false
      });
    } catch (err) {
      alert('خطا در ذخیره‌سازی نامه');
    }
  };

  // Upload Attachment Handler
  const handleAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAttachment(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target?.result as string;
      try {
        const res = await uploadFile(file.name, base64);
        setNewLetterForm(prev => ({
          ...prev,
          attachments: [...prev.attachments, { fileName: file.name, url: res.url }]
        }));
      } catch (err) {
        alert('خطا در آپلود فایل');
      } finally {
        setUploadingAttachment(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // Remove Attachment
  const handleRemoveAttachment = (idx: number) => {
    setNewLetterForm(prev => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== idx)
    }));
  };

  // Add Comment to Letter
  const handleAddComment = async () => {
    if (!commentText.trim() || !selectedLetterForView) return;

    const newComment: SecretariatLetterComment = {
      id: generateUUID(),
      userId: currentUser.id,
      username: currentUser.fullName,
      comment: commentText,
      createdAt: Date.now()
    };

    const updatedLetter: SecretariatLetter = {
      ...selectedLetterForView,
      comments: [...(selectedLetterForView.comments || []), newComment],
      updatedAt: Date.now()
    };

    try {
      const updatedList = await updateSecretariatLetter(updatedLetter);
      setLetters(updatedList);
      setSelectedLetterForView(updatedLetter);
      setCommentText('');
    } catch (err) {
      alert('خطا در ثبت نظر');
    }
  };

  // Refer Letter
  const handleReferLetter = async () => {
    if (selectedReferrals.length === 0 || !selectedLetterForView) return;

    const updatedLetter: SecretariatLetter = {
      ...selectedLetterForView,
      referredTo: Array.from(new Set([...(selectedLetterForView.referredTo || []), ...selectedReferrals])),
      referredBy: currentUser.fullName,
      updatedAt: Date.now()
    };

    try {
      const updatedList = await updateSecretariatLetter(updatedLetter);
      setLetters(updatedList);
      setSelectedLetterForView(updatedLetter);
      setSelectedReferrals([]);
      alert('نامه با موفقیت ارجاع داده شد');
    } catch (err) {
      alert('خطا در ارجاع نامه');
    }
  };

  // Approve and Sign Letter
  const handleApproveSign = async () => {
    if (!selectedLetterForView) return;

    if (!currentUser.signatureUrl) {
      alert('کاربر گرامی، امضای واقعی شما در پروفایل آپلود نشده است. لطفا ابتدا از منوی "کاربران" نسبت به آپلود تصویر امضای خود اقدام نمایید.');
      return;
    }

    const currentApprovers = selectedLetterForView.approvedBy || [];
    if (currentApprovers.includes(currentUser.id)) {
      alert('شما قبلا این نامه را تایید و امضا کرده‌اید.');
      return;
    }

    const currentSignatures = selectedLetterForView.signatureImageUrls || [];

    const updatedLetter: SecretariatLetter = {
      ...selectedLetterForView,
      status: SecretariatLetterStatus.APPROVED,
      approvedBy: [...currentApprovers, currentUser.id],
      signatureImageUrls: [...currentSignatures, currentUser.signatureUrl],
      updatedAt: Date.now()
    };

    try {
      const updatedList = await updateSecretariatLetter(updatedLetter);
      setLetters(updatedList);
      setSelectedLetterForView(updatedLetter);
      alert('نامه با موفقیت تایید و امضای واقعی شما درج گردید.');
    } catch (err) {
      alert('خطا در تایید و امضای نامه');
    }
  };

  // Reject Letter
  const handleRejectLetter = async () => {
    if (!selectedLetterForView) return;

    const updatedLetter: SecretariatLetter = {
      ...selectedLetterForView,
      status: SecretariatLetterStatus.REJECTED,
      updatedAt: Date.now()
    };

    try {
      const updatedList = await updateSecretariatLetter(updatedLetter);
      setLetters(updatedList);
      setSelectedLetterForView(updatedLetter);
      alert('نامه رد شد');
    } catch (err) {
      alert('خطا در تغییر وضعیت نامه');
    }
  };

  // Archive / Unarchive Letter
  const handleToggleArchive = async (letter: SecretariatLetter) => {
    const isArchived = letter.status === SecretariatLetterStatus.ARCHIVED;
    const updatedLetter: SecretariatLetter = {
      ...letter,
      status: isArchived ? SecretariatLetterStatus.PENDING : SecretariatLetterStatus.ARCHIVED,
      updatedAt: Date.now()
    };

    try {
      const updatedList = await updateSecretariatLetter(updatedLetter);
      setLetters(updatedList);
      if (selectedLetterForView?.id === letter.id) {
        setSelectedLetterForView(updatedLetter);
      }
      alert(isArchived ? 'نامه از بایگانی خارج شد.' : 'نامه با موفقیت بایگانی گردید.');
    } catch (err) {
      alert('خطا در تغییر وضعیت بایگانی');
    }
  };

  // Delete Letter
  const handleDeleteLetter = async (id: string) => {
    if (!window.confirm('آیا از حذف این نامه اداری اطمینان دارید؟')) return;

    try {
      const updatedList = await deleteSecretariatLetter(id);
      setLetters(updatedList);
      setSelectedLetterForView(null);
      alert('نامه با موفقیت حذف شد.');
    } catch (err) {
      alert('خطا در حذف نامه');
    }
  };

  // Save Secretariat Settings (Access control lists + templates)
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompany) return;

    try {
      const updatedSettings = await saveSecretariatSettings(companySettingsForm);
      setSecSettings(updatedSettings);
      alert('تنظیمات دبیرخانه این شرکت با موفقیت بروزرسانی شد.');
    } catch (err) {
      alert('خطا در ذخیره‌سازی تنظیمات');
    }
  };

  // Upload Letterhead image
  const handleLetterheadUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingLetterhead(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target?.result as string;
      try {
        const res = await uploadFile(file.name, base64);
        setCompanySettingsForm(prev => ({
          ...prev,
          letterheadUrl: res.url
        }));
        alert('تصویر سربرگ با موفقیت بارگذاری شد.');
      } catch (err) {
        alert('خطا در آپلود سربرگ');
      } finally {
        setUploadingLetterhead(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // Upload Company Stamp image
  const handleStampUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingStamp(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target?.result as string;
      try {
        const res = await uploadFile(file.name, base64);
        setCompanySettingsForm(prev => ({
          ...prev,
          companyStampUrl: res.url
        }));
        alert('تصویر مهر رسمی شرکت با موفقیت بارگذاری شد.');
      } catch (err) {
        alert('خطا در آپلود مهر شرکت');
      } finally {
        setUploadingStamp(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // Insert meeting minutes template into new letter content
  const handleInsertMinutesTemplate = () => {
    const activeSettings = secSettings.find(s => s.companyId === selectedCompany?.id);
    if (activeSettings?.meetingMinutesTemplate) {
      setNewLetterForm(prev => ({
        ...prev,
        content: activeSettings.meetingMinutesTemplate || ''
      }));
    } else {
      alert('قالبی برای صورتجلسه این شرکت تنظیم نشده است. ابتدا از تب "تنظیمات دبیرخانه" قالب را ذخیره کنید.');
    }
  };

  // --- RENDERS ---

  // 1. Loading State
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <Loader2 className="w-10 h-10 animate-spin text-purple-600" />
        <span className="text-sm text-gray-500 font-medium">درحال بارگذاری محیط دبیرخانه...</span>
      </div>
    );
  }

  // 1.5 High level access guard
  const isAuthorized = isSuperUser || currentUser.canAccessSecretariat;
  if (!isAuthorized) {
    return (
      <div className="glass-panel text-center p-12 max-w-lg mx-auto mt-12 rounded-2xl border space-y-3 bg-red-50/20 border-red-100" dir="rtl">
        <div className="mx-auto w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-600">
          <Lock size={24} />
        </div>
        <h3 className="font-bold text-red-800 text-base">دسترسی غیرمجاز</h3>
        <p className="text-xs text-red-600 leading-relaxed font-medium">
          شما دسترسی لازم برای ورود به سیستم دبیرخانه اداری را ندارید. لطفا با مدیر سیستم تماس بگیرید تا دسترسی "دبیرخانه" را برای حساب کاربری شما فعال نماید.
        </p>
      </div>
    );
  }

  // 2. Company Initial Selector screen
  if (!selectedCompany) {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4 space-y-8 animate-fade-in">
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-2xl">
            <Building2 className="w-10 h-10" />
          </div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white">سامانه دبیرخانه مرکزی</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">لطفا شرکت مورد نظر خود را جهت ورود به میزکار دبیرخانه انتخاب نمایید.</p>
        </div>

        {availableCompanies.length === 0 ? (
          <div className="glass-panel text-center p-8 rounded-2xl border border-dashed text-gray-500">
            هیچ شرکتی در تنظیمات سیستم تعریف نشده است. لطفا ابتدا شرکت‌ها را در تنظیمات عمومی سیستم مدیریت کنید.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {availableCompanies.map((company) => (
              <motion.div
                key={company.id}
                whileHover={{ y: -4, scale: 1.02 }}
                onClick={() => setSelectedCompany(company)}
                className="glass-panel rounded-2xl border border-gray-150 p-6 flex flex-col justify-between cursor-pointer shadow-sm hover:shadow-md transition-all duration-300 relative group overflow-hidden bg-white/50"
              >
                <div className="absolute top-0 right-0 h-1.5 w-full bg-gradient-to-l from-purple-500 to-indigo-500 transform origin-right scale-x-0 group-hover:scale-x-100 transition-transform duration-300" />
                
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700 font-black border">
                      {company.logo ? (
                        <img src={company.logo} className="w-full h-full object-cover rounded-xl" />
                      ) : (
                        company.name.charAt(0)
                      )}
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-800 text-base">{company.name}</h3>
                      <span className="text-[10px] text-gray-400 font-mono">شناسه ملی: {company.nationalId || '-'}</span>
                    </div>
                  </div>
                  
                  <div className="text-xs text-gray-500 leading-relaxed border-t pt-3 flex flex-col gap-1">
                    <span>شماره ثبت: {company.registrationNumber || '-'}</span>
                    <span>آدرس: {company.address || '-'}</span>
                  </div>
                </div>

                <div className="flex justify-end mt-4 items-center text-purple-600 gap-1 text-xs font-bold">
                  <span>انتخاب شرکت و ورود</span>
                  <ChevronLeft size={16} />
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // 3. Section Selector screen (HQ vs Factory)
  if (selectedCompany && !activeSection) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 space-y-8 animate-fade-in">
        <div className="flex items-center gap-3 justify-between">
          <button 
            onClick={() => setSelectedCompany(null)} 
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ArrowRight size={14} /> بازگشت به لیست شرکت‌ها
          </button>
          <span className="text-xs bg-purple-50 text-purple-700 px-3 py-1 rounded-full font-bold">
            {selectedCompany.name}
          </span>
        </div>

        <div className="text-center space-y-2">
          <h2 className="text-xl font-bold text-gray-900">انتخاب بخش دبیرخانه</h2>
          <p className="text-xs text-gray-500">برای کار با دبیرخانه این شرکت، یکی از بخش‌های مستقل زیر را انتخاب کنید.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Headquarters card */}
          <div 
            onClick={() => {
              if (hasSectionAccess('headquarters', selectedCompany.id)) {
                setActiveSection('headquarters');
              } else {
                alert('شما به بخش دفتر مرکزی دبیرخانه این شرکت دسترسی ندارید.');
              }
            }}
            className={`glass-panel border rounded-2xl p-6 text-center cursor-pointer transition-all ${
              hasSectionAccess('headquarters', selectedCompany.id) 
                ? 'hover:shadow-lg border-purple-200 bg-purple-50/10' 
                : 'opacity-60 bg-gray-50 border-gray-200 cursor-not-allowed'
            }`}
          >
            <div className="mx-auto w-14 h-14 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mb-4 shadow-sm">
              <Building className="w-7 h-7" />
            </div>
            <h3 className="font-bold text-gray-800 text-base mb-1">دبیرخانه دفتر مرکزی</h3>
            <p className="text-[11px] text-gray-500 mb-4">کارتابل و بایگانی مدارک و نامه‌های دفتر مرکزی</p>
            
            <div className="flex justify-center items-center gap-1 text-xs font-bold">
              {hasSectionAccess('headquarters', selectedCompany.id) ? (
                <span className="text-emerald-600 flex items-center gap-1 bg-emerald-50 px-2.5 py-1 rounded-full text-[10px]">
                  <Unlock size={12} /> دسترسی مجاز
                </span>
              ) : (
                <span className="text-red-500 flex items-center gap-1 bg-red-50 px-2.5 py-1 rounded-full text-[10px]">
                  <Lock size={12} /> دسترسی محدود شده
                </span>
              )}
            </div>
          </div>

          {/* Factory card */}
          <div 
            onClick={() => {
              if (hasSectionAccess('factory', selectedCompany.id)) {
                setActiveSection('factory');
              } else {
                alert('شما به بخش کارخانه دبیرخانه این شرکت دسترسی ندارید.');
              }
            }}
            className={`glass-panel border rounded-2xl p-6 text-center cursor-pointer transition-all ${
              hasSectionAccess('factory', selectedCompany.id) 
                ? 'hover:shadow-lg border-indigo-200 bg-indigo-50/10' 
                : 'opacity-60 bg-gray-50 border-gray-200 cursor-not-allowed'
            }`}
          >
            <div className="mx-auto w-14 h-14 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mb-4 shadow-sm">
              <Building2 className="w-7 h-7" />
            </div>
            <h3 className="font-bold text-gray-800 text-base mb-1">دبیرخانه کارخانه</h3>
            <p className="text-[11px] text-gray-500 mb-4">کارتابل و بایگانی مدارک و نامه‌های بخش کارخانه تولیدی</p>
            
            <div className="flex justify-center items-center gap-1 text-xs font-bold">
              {hasSectionAccess('factory', selectedCompany.id) ? (
                <span className="text-emerald-600 flex items-center gap-1 bg-emerald-50 px-2.5 py-1 rounded-full text-[10px]">
                  <Unlock size={12} /> دسترسی مجاز
                </span>
              ) : (
                <span className="text-red-500 flex items-center gap-1 bg-red-50 px-2.5 py-1 rounded-full text-[10px]">
                  <Lock size={12} /> دسترسی محدود شده
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 4. Main Secretariat Dashboard (when company and section are selected)
  return (
    <div className="space-y-6 animate-fade-in relative min-h-screen">
      
      {/* Header Info */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white dark:bg-gray-900 border border-slate-200/60 p-4 rounded-2xl gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl border border-purple-100 hidden sm:block">
            <Building2 size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-black text-gray-800 dark:text-white">{selectedCompany.name}</h1>
              <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-black">دبیرخانه</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${activeSection === 'headquarters' ? 'bg-purple-100 text-purple-700' : 'bg-indigo-100 text-indigo-700'}`}>
                {activeSection === 'headquarters' ? 'دفتر مرکزی' : 'کارخانه'}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1">مدیریت نامه‌ها، کارتابل جاری و آرشیو بایگانی اسناد اداری</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto justify-end">
          <button 
            onClick={() => {
              setActiveSection(null);
              setActiveTab('cartable');
            }} 
            className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3 py-2 rounded-lg transition-all"
          >
            <ArrowRight size={14} /> تغییر بخش دبیرخانه
          </button>
          
          <button 
            onClick={() => {
              setSelectedCompany(null);
              setActiveSection(null);
              setActiveTab('cartable');
            }} 
            className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3 py-2 rounded-lg transition-all"
          >
            تغییر شرکت
          </button>
        </div>
      </div>

      {/* Tabs Row */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b pb-2">
        <div className="flex items-center gap-1.5 bg-slate-100/80 p-1 rounded-xl self-start">
          <button 
            onClick={() => setActiveTab('cartable')}
            className={`flex items-center gap-1.5 text-xs font-black px-4 py-2 rounded-lg transition-all ${activeTab === 'cartable' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            <FileText size={15} /> کارتابل اداری
          </button>
          
          <button 
            onClick={() => setActiveTab('archive')}
            className={`flex items-center gap-1.5 text-xs font-black px-4 py-2 rounded-lg transition-all ${activeTab === 'archive' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            <Archive size={15} /> آرشیو و بایگانی
          </button>

          {isSuperUser && (
            <button 
              onClick={() => setActiveTab('settings')}
              className={`flex items-center gap-1.5 text-xs font-black px-4 py-2 rounded-lg transition-all ${activeTab === 'settings' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              <Settings2 size={15} /> تنظیمات دبیرخانه
            </button>
          )}
        </div>

        {activeTab !== 'settings' && (
          <button 
            onClick={() => setShowNewLetterModal(true)}
            className="flex items-center justify-center gap-1 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-sm hover:shadow transition-all"
          >
            <Plus size={16} /> ثبت نامه اداری جدید
          </button>
        )}
      </div>

      {/* TABS CONTENT */}

      {/* A. CARTABLE AND ARCHIVE VIEWS */}
      {(activeTab === 'cartable' || activeTab === 'archive') && (
        <div className="space-y-4 animate-fade-in">
          
          {/* Controls Bar */}
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            {/* Search Input */}
            <div className="relative flex-1">
              <span className="absolute inset-y-0 right-3 flex items-center text-slate-400">
                <Search size={16} />
              </span>
              <input 
                type="text" 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="جستجو در موضوع، شماره نامه، فرستنده و گیرنده..."
                className="w-full border border-slate-200 rounded-xl pr-9 pl-3 py-2 text-xs focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute inset-y-0 left-3 flex items-center text-slate-400 hover:text-slate-600">
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Letter Type Filters */}
            <div className="flex items-center gap-1 bg-slate-50 border p-1 rounded-xl self-start w-full md:w-auto overflow-x-auto">
              {[
                { id: 'all', label: 'همه نامه‌ها' },
                { id: 'internal', label: 'داخلی' },
                { id: 'incoming', label: 'وارده' },
                { id: 'outgoing', label: 'صادره' }
              ].map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setFilterType(opt.id as any)}
                  className={`text-[11px] font-bold px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${filterType === opt.id ? 'bg-white text-slate-800 shadow-sm border border-slate-100' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Letter List Grid */}
          {filteredLetters.length === 0 ? (
            <div className="glass-panel text-center py-16 px-4 rounded-2xl border border-dashed border-slate-200">
              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="font-bold text-slate-700 text-sm mb-1">نامه‌ای یافت نشد</h3>
              <p className="text-xs text-slate-400">هیچ نامه‌ای با فیلترها و معیارهای مورد نظر شما یافت نشد.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredLetters.map((letter) => {
                const isReferredToMe = letter.referredTo?.includes(currentUser.id);
                return (
                  <motion.div
                    key={letter.id}
                    layoutId={`letter-card-${letter.id}`}
                    whileHover={{ y: -2 }}
                    className={`glass-panel border rounded-2xl p-4 flex flex-col justify-between transition-all bg-white relative ${
                      isReferredToMe ? 'border-amber-200 shadow-sm ring-1 ring-amber-100' : 'border-slate-150 shadow-xs'
                    }`}
                  >
                    {isReferredToMe && (
                      <span className="absolute -top-2.5 -left-2.5 bg-amber-500 text-white font-black text-[9px] px-2 py-0.5 rounded-full shadow-sm flex items-center gap-1">
                        <CornerDownLeft size={10} /> ارجاع به شما
                      </span>
                    )}

                    <div className="space-y-3">
                      <div className="flex items-center justify-between border-b pb-2">
                        <span className="text-[10px] font-mono text-slate-400 font-bold">{letter.letterNumber}</span>
                        <div className="flex gap-1.5 items-center">
                          {/* Type Label Badge */}
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${
                            letter.type === 'internal' ? 'bg-purple-50 text-purple-700 border border-purple-100' :
                            letter.type === 'incoming' ? 'bg-blue-50 text-blue-700 border border-blue-100' :
                            'bg-emerald-50 text-emerald-700 border border-emerald-100'
                          }`}>
                            {letter.type === 'internal' ? 'داخلی' : letter.type === 'incoming' ? 'وارده' : 'صادره'}
                          </span>

                          {/* Status Badge */}
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                            letter.status === SecretariatLetterStatus.APPROVED ? 'bg-emerald-100 text-emerald-800' :
                            letter.status === SecretariatLetterStatus.REJECTED ? 'bg-red-100 text-red-800' :
                            letter.status === SecretariatLetterStatus.DRAFT ? 'bg-gray-100 text-gray-800' :
                            'bg-amber-100 text-amber-800'
                          }`}>
                            {letter.status}
                          </span>
                        </div>
                      </div>

                      <div>
                        <h4 className="font-bold text-gray-800 text-sm line-clamp-1 mb-1">{letter.subject}</h4>
                        <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-500 pt-1">
                          <span className="truncate">فرستنده: <b>{letter.sender}</b></span>
                          <span className="truncate">گیرنده: <b>{letter.receiver}</b></span>
                        </div>
                      </div>
                    </div>

                    <div className="border-t mt-4 pt-3 flex items-center justify-between text-[10px] text-slate-400">
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-0.5"><Calendar size={12} /> {letter.date}</span>
                        {letter.attachments?.length > 0 && (
                          <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                            پیوست: {letter.attachments.length}
                          </span>
                        )}
                        {letter.approvedBy?.length > 0 && (
                          <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded flex items-center gap-0.5 font-bold" title="امضا شده">
                            امضا: {letter.approvedBy.length}
                          </span>
                        )}
                      </div>

                      <div className="flex gap-4 items-center">
                        <button 
                          onClick={() => setIsPrintMode(letter)}
                          className="text-emerald-600 hover:text-emerald-800 font-bold hover:underline flex items-center gap-0.5"
                        >
                          مشاهده نامه <FileText size={12} />
                        </button>
                        <button 
                          onClick={() => setSelectedLetterForView(letter)}
                          className="text-purple-600 hover:text-purple-800 font-bold hover:underline flex items-center gap-0.5"
                        >
                          جزئیات و اقدام <ChevronLeft size={12} />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* B. SECRETARIAT SETTINGS TAB */}
      {activeTab === 'settings' && isSuperUser && (
        <div className="glass-panel border border-slate-200/60 rounded-2xl bg-white p-6 animate-fade-in space-y-6">
          <div className="border-b pb-3 flex items-center gap-2">
            <Settings2 className="text-purple-600" size={20} />
            <h2 className="text-base font-black text-slate-800">تنظیمات دبیرخانه مرکزی برای: {selectedCompany.name}</h2>
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Access Control: Headquarters */}
              <div className="space-y-3 bg-slate-50/50 p-4 border rounded-xl">
                <label className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                  <Lock size={14} className="text-purple-600" /> دسترسی به دبیرخانه دفتر مرکزی
                </label>
                <p className="text-[10px] text-gray-400">کاربرانی که مجاز به دسترسی به کارتابل و آرشیو دفتر مرکزی این شرکت هستند را علامت بزنید.</p>
                
                <div className="max-h-48 overflow-y-auto border bg-white rounded-lg p-2.5 space-y-1.5">
                  {users.map(u => {
                    const isChecked = companySettingsForm.headquartersAccessTokens?.includes(u.id);
                    return (
                      <label key={u.id} className="flex items-center gap-2 text-xs hover:bg-slate-50 p-1 rounded cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={isChecked}
                          onChange={() => {
                            let tokens = [...(companySettingsForm.headquartersAccessTokens || [])];
                            if (tokens.includes(u.id)) {
                              tokens = tokens.filter(t => t !== u.id);
                            } else {
                              tokens.push(u.id);
                            }
                            setCompanySettingsForm(p => ({ ...p, headquartersAccessTokens: tokens }));
                          }}
                          className="rounded text-purple-600 focus:ring-purple-500 w-3.5 h-3.5"
                        />
                        <span className="font-bold text-gray-700">{u.fullName}</span>
                        <span className="text-[9px] text-gray-400">({u.username})</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Access Control: Factory */}
              <div className="space-y-3 bg-slate-50/50 p-4 border rounded-xl">
                <label className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                  <Lock size={14} className="text-indigo-600" /> دسترسی به دبیرخانه کارخانه
                </label>
                <p className="text-[10px] text-gray-400">کاربرانی که مجاز به دسترسی به کارتابل و آرشیو بخش کارخانه این شرکت هستند را علامت بزنید.</p>
                
                <div className="max-h-48 overflow-y-auto border bg-white rounded-lg p-2.5 space-y-1.5">
                  {users.map(u => {
                    const isChecked = companySettingsForm.factoryAccessTokens?.includes(u.id);
                    return (
                      <label key={u.id} className="flex items-center gap-2 text-xs hover:bg-slate-50 p-1 rounded cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={isChecked}
                          onChange={() => {
                            let tokens = [...(companySettingsForm.factoryAccessTokens || [])];
                            if (tokens.includes(u.id)) {
                              tokens = tokens.filter(t => t !== u.id);
                            } else {
                              tokens.push(u.id);
                            }
                            setCompanySettingsForm(p => ({ ...p, factoryAccessTokens: tokens }));
                          }}
                          className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                        />
                        <span className="font-bold text-gray-700">{u.fullName}</span>
                        <span className="text-[9px] text-gray-400">({u.username})</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Design Custom Letterhead and Stamp Uploads */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
              {/* Custom Letterhead Upload */}
              <div className="space-y-3">
                <label className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                  <ImageIcon size={14} /> بارگذاری تصویر سربرگ اداری اختصاصی شرکت
                </label>
                <p className="text-[10px] text-gray-400">تصویر سربرگ شرکت را آپلود کنید تا نامه‌ها با این سربرگ چاپ و خروجی PDF شوند. در صورت عدم تعریف، از قالب پیش‌فرض رسمی سیستم استفاده می‌شود.</p>
                
                <div className="flex items-center gap-4">
                  <div className="w-24 h-24 border rounded-xl overflow-hidden bg-slate-50 flex items-center justify-center p-1">
                    {companySettingsForm.letterheadUrl ? (
                      <img src={companySettingsForm.letterheadUrl} className="w-full h-full object-contain" />
                    ) : (
                      <span className="text-[10px] text-slate-400">بدون سربرگ</span>
                    )}
                  </div>

                  <div className="space-y-2">
                    <input 
                      type="file" 
                      ref={letterheadInputRef} 
                      className="hidden" 
                      accept="image/*" 
                      onChange={handleLetterheadUpload} 
                    />
                    <button
                      type="button"
                      onClick={() => letterheadInputRef.current?.click()}
                      className="flex items-center gap-1 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs px-3 py-2 rounded-lg transition-colors font-bold border border-purple-200"
                      disabled={uploadingLetterhead}
                    >
                      <Upload size={14} /> {uploadingLetterhead ? 'درحال آپلود...' : 'انتخاب و آپلود تصویر سربرگ'}
                    </button>
                    {companySettingsForm.letterheadUrl && (
                      <button
                        type="button"
                        onClick={() => setCompanySettingsForm(p => ({ ...p, letterheadUrl: '' }))}
                        className="text-[10px] text-red-500 hover:underline block font-bold"
                      >
                        حذف سربرگ کنونی
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Custom Company Stamp Upload */}
              <div className="space-y-3">
                <label className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                  <Award size={14} className="text-red-600" /> بارگذاری تصویر مهر رسمی شرکت
                </label>
                <p className="text-[10px] text-gray-400">تصویر مهر شرکت را جهت درج پای نامه‌های اداری آپلود کنید. در صورت فعال بودن تیک مهر، این تصویر در پایین نامه نمایش داده می‌شود.</p>
                
                <div className="flex items-center gap-4">
                  <div className="w-24 h-24 border rounded-xl overflow-hidden bg-slate-50 flex items-center justify-center p-1">
                    {companySettingsForm.companyStampUrl ? (
                      <img src={companySettingsForm.companyStampUrl} className="w-full h-full object-contain mix-blend-multiply" />
                    ) : (
                      <span className="text-[10px] text-slate-400">بدون مهر رسمی</span>
                    )}
                  </div>

                  <div className="space-y-2">
                    <input 
                      type="file" 
                      ref={stampInputRef} 
                      className="hidden" 
                      accept="image/*" 
                      onChange={handleStampUpload} 
                    />
                    <button
                      type="button"
                      onClick={() => stampInputRef.current?.click()}
                      className="flex items-center gap-1 bg-red-50 hover:bg-red-100 text-red-700 text-xs px-3 py-2 rounded-lg transition-colors font-bold border border-red-200"
                      disabled={uploadingStamp}
                    >
                      <Upload size={14} /> {uploadingStamp ? 'درحال آپلود...' : 'انتخاب و آپلود تصویر مهر شرکت'}
                    </button>
                    {companySettingsForm.companyStampUrl && (
                      <button
                        type="button"
                        onClick={() => setCompanySettingsForm(p => ({ ...p, companyStampUrl: '' }))}
                        className="text-[10px] text-red-500 hover:underline block font-bold"
                      >
                        حذف مهر کنونی
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Template and Alignment settings */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
              {/* Default Meeting Minutes template */}
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                  قالب صورتجلسه پیش‌فرض شرکت
                </label>
                <p className="text-[10px] text-gray-400">می‌توانید قالب متنی پیش‌فرض صورتجلسات اداری این شرکت را تعریف کنید تا در هنگام ثبت نامه‌های اداری جدید با یک کلیک درج شود.</p>
                
                <textarea
                  value={companySettingsForm.meetingMinutesTemplate || ''}
                  onChange={e => setCompanySettingsForm(p => ({ ...p, meetingMinutesTemplate: e.target.value }))}
                  rows={5}
                  className="w-full border rounded-xl p-3 text-xs focus:ring-1 focus:ring-purple-500"
                  placeholder="مثال: دستور جلسه مصوبات مورخ... اتخاذ تصمیمات صورت پذیرفته به شرح..."
                />
              </div>

              {/* Letterhead Fields Alignment Coordinates */}
              <div className="space-y-3 bg-slate-50/50 p-4 border rounded-xl">
                <label className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                  <Settings2 size={14} className="text-purple-600" /> تنظیم دقیق موقعیت اطلاعات سربرگ
                </label>
                <p className="text-[10px] text-gray-400">اگر از سربرگ چاپی اختصاصی استفاده می‌کنید، مقادیر زیر را به میلی‌متر (mm) وارد کنید تا اطلاعات (تاریخ، شماره، پیوست) دقیقا در کادر مربوطه روی کاغذ چاپ شوند.</p>
                
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-600 block">فاصله از بالا (mm)</span>
                    <input 
                      type="number"
                      value={companySettingsForm.metadataTop ?? ''}
                      onChange={e => setCompanySettingsForm(p => ({ ...p, metadataTop: e.target.value ? Number(e.target.value) : undefined }))}
                      placeholder="مثال: ۲۵"
                      className="w-full border bg-white rounded-lg px-2.5 py-1.5 text-xs font-mono"
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-600 block">فاصله از چپ (mm)</span>
                    <input 
                      type="number"
                      value={companySettingsForm.metadataLeft ?? ''}
                      onChange={e => setCompanySettingsForm(p => ({ ...p, metadataLeft: e.target.value ? Number(e.target.value) : undefined }))}
                      placeholder="مثال: ۲۰"
                      className="w-full border bg-white rounded-lg px-2.5 py-1.5 text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-600 block">اندازه قلم (px)</span>
                    <input 
                      type="number"
                      value={companySettingsForm.metadataFontSize ?? ''}
                      onChange={e => setCompanySettingsForm(p => ({ ...p, metadataFontSize: e.target.value ? Number(e.target.value) : undefined }))}
                      placeholder="مثال: ۱۱"
                      className="w-full border bg-white rounded-lg px-2.5 py-1.5 text-xs font-mono"
                    />
                  </div>
                </div>
                <div className="text-[9px] text-slate-400 leading-relaxed pt-1">
                  * در صورت خالی رها کردن مقادیر فوق، از تنظیمات تراز پیش‌فرض سیستم استفاده خواهد شد.
                </div>
              </div>
            </div>

            {/* Save Buttons */}
            <div className="flex justify-end pt-4 border-t">
              <button
                type="submit"
                className="flex items-center gap-1 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-sm hover:shadow transition-colors"
              >
                <Save size={15} /> ذخیره کلیه تنظیمات دبیرخانه
              </button>
            </div>
          </form>
        </div>
      )}


      {/* --- ALL MODALS --- */}

      {/* 1. REGISTER NEW LETTER MODAL */}
      <AnimatePresence>
        {showNewLetterModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs overflow-y-auto">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-gray-900 border dark:border-white/10 rounded-2xl max-w-2xl w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto text-right"
              dir="rtl"
            >
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="text-base font-black text-gray-800 dark:text-white">ثبت نامه اداری جدید</h3>
                <button 
                  onClick={() => setShowNewLetterModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleCreateLetter} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Letter Date */}
                  <div className="space-y-1">
                    <label className="text-xs text-slate-500 font-bold">تاریخ نامه (شمسی)</label>
                    <input 
                      required 
                      type="text" 
                      value={newLetterForm.date}
                      onChange={e => setNewLetterForm({...newLetterForm, date: e.target.value})}
                      placeholder="۱۴۰۵/۰۴/۰۶"
                      className="w-full border rounded-lg px-3 py-2 text-xs"
                    />
                  </div>

                  {/* Letter Type */}
                  <div className="space-y-1">
                    <label className="text-xs text-slate-500 font-bold">نوع نامه</label>
                    <select
                      value={newLetterForm.type}
                      onChange={e => setNewLetterForm({...newLetterForm, type: e.target.value as any})}
                      className="w-full border rounded-lg px-3 py-2 text-xs bg-white"
                    >
                      <option value="internal">داخلی (بین بخشی)</option>
                      <option value="incoming">وارده (از سازمان بیرونی)</option>
                      <option value="outgoing">صادره (به سازمان بیرونی)</option>
                    </select>
                  </div>

                  {/* Sender */}
                  <div className="space-y-1">
                    <label className="text-xs text-slate-500 font-bold">فرستنده (از طرف)</label>
                    <input 
                      required 
                      type="text" 
                      list="user-list"
                      value={newLetterForm.sender}
                      onChange={e => setNewLetterForm({...newLetterForm, sender: e.target.value})}
                      placeholder="مثال: مدیریت دفتر مرکزی"
                      className="w-full border rounded-lg px-3 py-2 text-xs"
                    />
                  </div>

                  {/* Receiver */}
                  <div className="space-y-1">
                    <label className="text-xs text-slate-500 font-bold">گیرنده (به سمت)</label>
                    <input 
                      required 
                      type="text" 
                      list="user-list"
                      value={newLetterForm.receiver}
                      onChange={e => setNewLetterForm({...newLetterForm, receiver: e.target.value})}
                      placeholder="مثال: سرپرست کارخانه"
                      className="w-full border rounded-lg px-3 py-2 text-xs"
                    />
                  </div>
                  
                  <datalist id="user-list">
                    {users.map(u => (
                      <option key={u.id} value={u.fullName} />
                    ))}
                  </datalist>
                </div>

                {/* Subject */}
                <div className="space-y-1">
                  <label className="text-xs text-slate-500 font-bold">موضوع نامه</label>
                  <input 
                    required 
                    type="text" 
                    value={newLetterForm.subject}
                    onChange={e => setNewLetterForm({...newLetterForm, subject: e.target.value})}
                    placeholder="مثال: درخواست تأمین تجهیزات حفاظتی"
                    className="w-full border rounded-lg px-3 py-2 text-xs"
                  />
                </div>

                {/* Content Textarea with insert template option */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-slate-500 font-bold">متن نامه اداری</label>
                    <button
                      type="button"
                      onClick={handleInsertMinutesTemplate}
                      className="text-[10px] text-purple-600 hover:text-purple-800 font-black flex items-center gap-0.5 bg-purple-50 px-2 py-0.5 rounded"
                    >
                      <FileCheck size={12} /> درج قالب صورتجلسه پیش‌فرض شرکت
                    </button>
                  </div>
                  <textarea 
                    required 
                    rows={6}
                    value={newLetterForm.content}
                    onChange={e => setNewLetterForm({...newLetterForm, content: e.target.value})}
                    placeholder="متن رسمی و اداری خود را اینجا بنویسید..."
                    className="w-full border rounded-lg p-3 text-xs leading-relaxed"
                  />
                </div>

                {/* Sign-off text */}
                <div className="space-y-1">
                  <label className="text-xs text-slate-500 font-bold">متن پایان نامه (با تشکر...)</label>
                  <input 
                    required 
                    type="text" 
                    value={newLetterForm.signOffText}
                    onChange={e => setNewLetterForm({...newLetterForm, signOffText: e.target.value})}
                    placeholder="مثال: با تشکر"
                    className="w-full border rounded-lg px-3 py-2 text-xs"
                  />
                </div>

                {/* File Attachment Upload */}
                <div className="space-y-2 border-t pt-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-slate-500 font-bold">الصاق فایل‌های پیوست</label>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      className="hidden" 
                      onChange={handleAttachmentUpload} 
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-1 text-[11px] text-slate-600 hover:text-slate-800 font-bold bg-slate-50 border px-3 py-1.5 rounded-lg transition-colors"
                      disabled={uploadingAttachment}
                    >
                      <Upload size={12} /> {uploadingAttachment ? 'درحال آپلود...' : 'انتخاب و الصاق پیوست'}
                    </button>
                  </div>

                  {/* List of Attachments */}
                  {newLetterForm.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {newLetterForm.attachments.map((file, i) => (
                        <span key={i} className="inline-flex items-center gap-1.5 bg-slate-50 border text-slate-700 text-[10px] font-bold px-2.5 py-1 rounded-full">
                          <FileText size={10} />
                          <span className="truncate max-w-[120px]">{file.fileName}</span>
                          <button 
                            type="button" 
                            onClick={() => handleRemoveAttachment(i)}
                            className="text-red-500 hover:text-red-700 font-bold"
                          >
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Company Stamp Checkbox */}
                {companySettingsForm.companyStampUrl && (
                  <div className="flex items-center gap-2 bg-red-50/50 border border-red-100 p-3 rounded-xl">
                    <input 
                      type="checkbox" 
                      id="new-letter-add-stamp"
                      checked={newLetterForm.addCompanyStamp}
                      onChange={e => setNewLetterForm(prev => ({ ...prev, addCompanyStamp: e.target.checked }))}
                      className="rounded text-red-600 focus:ring-red-500 w-4 h-4 cursor-pointer"
                    />
                    <label htmlFor="new-letter-add-stamp" className="text-xs font-black text-slate-700 cursor-pointer select-none flex items-center gap-1.5">
                      <Award size={14} className="text-red-600 animate-pulse" /> درج مهر رسمی شرکت پای این نامه اداری
                    </label>
                  </div>
                )}

                {/* Form Buttons */}
                <div className="flex justify-end gap-2 border-t pt-4">
                  <button
                    type="button"
                    onClick={() => setShowNewLetterModal(false)}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-4 py-2.5 rounded-xl transition-all"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-sm hover:shadow transition-all"
                  >
                    ثبت نهایی و صدور شماره نامه
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 2. DETAILED LETTER VIEW MODAL */}
      <AnimatePresence>
        {selectedLetterForView && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs overflow-y-auto">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-gray-900 border dark:border-white/10 rounded-2xl max-w-3xl w-full p-6 shadow-xl space-y-4 max-h-[92vh] overflow-y-auto text-right"
              dir="rtl"
            >
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black text-gray-800 dark:text-white">بررسی نامه اداری شماره: {selectedLetterForView.letterNumber}</h3>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    selectedLetterForView.type === 'internal' ? 'bg-purple-50 text-purple-700' :
                    selectedLetterForView.type === 'incoming' ? 'bg-blue-50 text-blue-700' :
                    'bg-emerald-50 text-emerald-700'
                  }`}>
                    {selectedLetterForView.type === 'internal' ? 'داخلی' : selectedLetterForView.type === 'incoming' ? 'وارده' : 'صادره'}
                  </span>
                </div>
                
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setIsPrintMode(selectedLetterForView)}
                    className="p-1.5 text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold"
                    title="چاپ با بالاترین کیفیت"
                  >
                    <Printer size={16} /> چاپ و خروجی PDF
                  </button>
                  
                  <button 
                    onClick={() => setSelectedLetterForView(null)}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Main Two Column layout for Actions */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left (Letter view card) */}
                <div className="lg:col-span-7 border rounded-2xl p-4 bg-slate-50/50 space-y-4 shadow-2xs">
                  <div className="bg-white border rounded-xl p-4 space-y-4 font-sans text-xs shadow-3xs relative min-h-[250px] leading-relaxed">
                    {/* Tiny Letter header mockup */}
                    <div className="flex justify-between items-center border-b pb-2 mb-2 text-[10px] text-slate-400 font-mono">
                      <span>{selectedCompany.name}</span>
                      <div className="text-left">
                        <div>تاریخ: {selectedLetterForView.date}</div>
                        <div>شماره: {selectedLetterForView.letterNumber}</div>
                        <div>پیوست: {selectedLetterForView.attachments?.length > 0 ? 'دارد' : 'ندارد'}</div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div><b>به سمت:</b> {selectedLetterForView.receiver}</div>
                      <div><b>از طرف:</b> {selectedLetterForView.sender}</div>
                      <div className="pt-2 border-t border-dashed"><b>موضوع:</b> {selectedLetterForView.subject}</div>
                    </div>

                    {/* Content */}
                    <div className="pt-4 text-slate-700 leading-loose whitespace-pre-wrap font-medium">
                      {selectedLetterForView.content}
                    </div>

                    {/* Real embedded signatures layout */}
                    {selectedLetterForView.approvedBy && selectedLetterForView.approvedBy.length > 0 && (
                      <div className="pt-6 border-t border-dashed flex flex-wrap gap-4 justify-end">
                        {selectedLetterForView.approvedBy.map((userId, i) => {
                          const signer = users.find(u => u.id === userId);
                          const sigUrl = selectedLetterForView.signatureImageUrls?.[i];
                          return (
                            <div key={i} className="text-center space-y-1 bg-slate-50/70 p-1.5 border rounded-lg min-w-[100px]">
                              <span className="text-[10px] text-emerald-600 font-bold block flex items-center gap-0.5 justify-center"><CheckCircle size={10}/> تایید و امضا شد</span>
                              {sigUrl ? (
                                <img src={sigUrl} className="h-10 mx-auto object-contain mix-blend-multiply" />
                              ) : (
                                <div className="h-10 flex items-center justify-center text-[10px] text-slate-400">بدون تصویر امضا</div>
                              )}
                              <span className="text-[9px] font-bold text-gray-700 block">{signer?.fullName || 'کاربر سیستم'}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Letter attachments view link */}
                  {selectedLetterForView.attachments?.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-bold text-slate-500 block">فایل‌های الصاقی (پیوست‌ها):</span>
                      <div className="flex flex-col gap-1.5">
                        {selectedLetterForView.attachments.map((file, i) => (
                          <a 
                            key={i} 
                            href={file.url} 
                            target="_blank" 
                            rel="referrer"
                            className="flex items-center justify-between bg-white border rounded-lg px-3 py-1.5 text-[11px] text-purple-700 hover:text-purple-900 hover:bg-slate-50 transition-all font-bold"
                          >
                            <span className="flex items-center gap-1.5"><FileText size={14}/> {file.fileName}</span>
                            <span className="text-[10px] text-slate-400">دانلود و مشاهده</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Letter Official Export PDF/DOCX */}
                  <div className="space-y-1.5 pt-3 border-t">
                    <span className="text-[11px] font-bold text-slate-500 block">خروجی رسمی نامه اداری:</span>
                    <div className="grid grid-cols-2 gap-2">
                      <a 
                        href={`/api/secretariat/letters/${selectedLetterForView.id}/pdf`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-center gap-1.5 bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 rounded-xl py-2 text-[11px] font-bold transition-all"
                      >
                        <FileText size={14} />
                        دانلود خروجی PDF
                      </a>
                      <a 
                        href={`/api/secretariat/letters/${selectedLetterForView.id}/docx`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-center gap-1.5 bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 rounded-xl py-2 text-[11px] font-bold transition-all"
                      >
                        <FileText size={14} />
                        دانلود خروجی Word
                      </a>
                    </div>
                  </div>
                </div>

                {/* Right (Action items: refer, comment, sign, archive) */}
                <div className="lg:col-span-5 space-y-5">
                  
                  {/* Approval Actions Panel */}
                  <div className="glass-panel p-4 border rounded-2xl bg-white space-y-3">
                    <span className="text-xs font-black text-slate-800 flex items-center gap-1.5 border-b pb-2">
                      <UserCheck size={14} className="text-purple-600" /> اقدامات و تایید نامه
                    </span>

                    <div className="flex flex-col gap-2">
                      {/* Sign and Confirm Button */}
                      <button
                        onClick={handleApproveSign}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2 px-3 rounded-lg shadow-sm hover:shadow transition-colors flex items-center justify-center gap-1"
                      >
                        <Plus size={16} /> تایید و امضای رسمی نامه (الصاق تصویر امضا)
                      </button>

                      {/* Reject Letter */}
                      <button
                        onClick={handleRejectLetter}
                        className="w-full bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs py-2 px-3 rounded-lg border border-red-200 transition-colors flex items-center justify-center gap-1"
                      >
                        مخالفت و رد نامه اداری
                      </button>

                      {/* Company Stamp toggle */}
                      {companySettingsForm.companyStampUrl && (
                        <label className="flex items-center gap-2 bg-red-50/40 border border-red-100 p-2.5 rounded-xl cursor-pointer hover:bg-red-50 transition-colors mt-1">
                          <input 
                            type="checkbox" 
                            checked={selectedLetterForView.addCompanyStamp || false}
                            onChange={async (e) => {
                              const updated: SecretariatLetter = {
                                ...selectedLetterForView,
                                addCompanyStamp: e.target.checked,
                                updatedAt: Date.now()
                              };
                              try {
                                const letters = await updateSecretariatLetter(updated);
                                setLetters(letters);
                                setSelectedLetterForView(updated);
                              } catch (err) {
                                alert('خطا در تغییر وضعیت مهر شرکت');
                              }
                            }}
                            className="rounded text-red-600 focus:ring-red-500 w-4 h-4 cursor-pointer"
                          />
                          <span className="text-xs font-black text-slate-700 flex items-center gap-1">
                            <Award size={14} className="text-red-600" /> درج مهر رسمی شرکت پای نامه
                          </span>
                        </label>
                      )}
                    </div>

                    {/* Quick status controls (Archive/Unarchive/Delete) */}
                    <div className="flex gap-2 border-t pt-3 mt-3">
                      <button
                        onClick={() => handleToggleArchive(selectedLetterForView)}
                        className="flex-1 bg-slate-50 hover:bg-slate-100 border text-slate-700 text-[10px] font-bold py-1.5 px-2.5 rounded-lg transition-colors flex items-center justify-center gap-1"
                      >
                        <Archive size={12} /> {selectedLetterForView.status === SecretariatLetterStatus.ARCHIVED ? 'خروج از بایگانی' : 'انتقال به بایگانی اسناد'}
                      </button>

                      {isSuperUser && (
                        <button
                          onClick={() => handleDeleteLetter(selectedLetterForView.id)}
                          className="bg-red-50 hover:bg-red-100 text-red-600 p-1.5 rounded-lg transition-colors border border-red-100"
                          title="حذف کامل نامه"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Referral Panel */}
                  <div className="glass-panel p-4 border rounded-2xl bg-white space-y-3">
                    <span className="text-xs font-black text-slate-800 flex items-center gap-1.5 border-b pb-2">
                      <Share2 size={14} className="text-amber-600" /> ارجاع نامه به پرسنل و همکاران
                    </span>
                    <p className="text-[10px] text-slate-400">می‌توانید این نامه را جهت پیگیری و اقدام به یک یا چند کاربر سیستم ارجاع دهید.</p>
                    
                    <div className="max-h-32 overflow-y-auto border rounded-lg p-2 space-y-1 bg-slate-50/50">
                      {users.filter(u => u.id !== currentUser.id).map(u => {
                        const isReferred = selectedLetterForView.referredTo?.includes(u.id);
                        const isSelected = selectedReferrals.includes(u.id);
                        return (
                          <label key={u.id} className="flex items-center gap-2 text-xs hover:bg-white p-1 rounded cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={isReferred || isSelected}
                              disabled={isReferred}
                              onChange={() => {
                                if (isSelected) {
                                  setSelectedReferrals(p => p.filter(id => id !== u.id));
                                } else {
                                  setSelectedReferrals(p => [...p, u.id]);
                                }
                              }}
                              className="rounded text-amber-500 focus:ring-amber-500 w-3.5 h-3.5"
                            />
                            <span className={`font-bold ${isReferred ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                              {u.fullName} {isReferred && '(ارجاع شده)'}
                            </span>
                          </label>
                        );
                      })}
                    </div>

                    <button
                      onClick={handleReferLetter}
                      disabled={selectedReferrals.length === 0}
                      className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs py-2 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      ثبت ارجاعات انتخابی
                    </button>
                  </div>

                  {/* Comments Panel */}
                  <div className="glass-panel p-4 border rounded-2xl bg-white space-y-3">
                    <span className="text-xs font-black text-slate-800 flex items-center gap-1.5 border-b pb-2">
                      <MessageSquare size={14} className="text-indigo-600" /> نظرات و پیگیری پاراف‌ها
                    </span>

                    {/* Comments List */}
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                      {(!selectedLetterForView.comments || selectedLetterForView.comments.length === 0) ? (
                        <p className="text-[10px] text-slate-400 text-center py-2">نظری برای این نامه ثبت نشده است.</p>
                      ) : (
                        selectedLetterForView.comments.map(c => (
                          <div key={c.id} className="bg-slate-50 p-2 rounded-lg text-[10px] space-y-1 leading-relaxed border border-slate-100">
                            <div className="flex justify-between items-center text-slate-400">
                              <span className="font-bold text-slate-700">{c.username}</span>
                              <span>{new Date(c.createdAt).toLocaleDateString('fa-IR')}</span>
                            </div>
                            <p className="text-slate-600 font-medium">{c.comment}</p>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Add Comment Textarea */}
                    <div className="flex gap-1.5 pt-2 border-t">
                      <input 
                        type="text"
                        value={commentText}
                        onChange={e => setCommentText(e.target.value)}
                        placeholder="ثبت نظر یا پاراف اداری جدید..."
                        className="flex-1 border rounded-lg px-2.5 py-1.5 text-xs"
                      />
                      <button
                        onClick={handleAddComment}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
                      >
                        ارسال
                      </button>
                    </div>
                  </div>

                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 3. HIGH QUALITY PRINT & PDF GENERATOR LAYOUT MODAL */}
      <AnimatePresence>
        {isPrintMode && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs overflow-y-auto">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl space-y-4 max-h-[96vh] overflow-y-auto text-right"
              dir="rtl"
            >
              {/* UI controls that are hidden on print */}
              <div className="flex items-center justify-between border-b pb-3 print:hidden">
                <div className="flex items-center gap-2">
                  <span className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><Printer size={18}/></span>
                  <div>
                    <h3 className="text-base font-black text-gray-800">پیش‌نمایش چاپ فوق‌العاده با کیفیت (فرمت A4)</h3>
                    <p className="text-[10px] text-slate-400">سیستم به صورت خودکار اندازه، فواصل و سربرگ را متناسب با استانداردهای چاپ تراز می‌کند.</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      // Append custom print styles to ensure perfection
                      const style = document.createElement('style');
                      style.id = 'secretariat-print-style';
                      style.innerHTML = `
                        @media print {
                          body * {
                            visibility: hidden;
                          }
                          #print-content-section, #print-content-section * {
                            visibility: visible;
                          }
                          #print-content-section {
                            position: absolute;
                            left: 0;
                            top: 0;
                            width: 100%;
                            height: 100%;
                            background: white !important;
                            color: black !important;
                            padding: 1.5cm !important;
                          }
                          .print\\:hidden {
                            display: none !important;
                          }
                        }
                      `;
                      document.head.appendChild(style);
                      window.print();
                      // Remove after print starts
                      setTimeout(() => {
                        const s = document.getElementById('secretariat-print-style');
                        if (s) s.remove();
                      }, 500);
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm hover:shadow transition-colors flex items-center gap-1.5 animate-pulse"
                  >
                    <Printer size={16} /> چاپ و ذخیره به عنوان PDF
                  </button>
                  
                  <button 
                    onClick={() => setIsPrintMode(null)}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-4 py-2.5 rounded-xl transition-colors"
                  >
                    بستن پیش‌نمایش
                  </button>
                </div>
              </div>

              {/* PRINTABLE AREA (A4 Container) */}
              <div 
                id="print-content-section" 
                className="bg-white border rounded-xl p-8 max-w-[21cm] mx-auto min-h-[29.7cm] shadow-xs relative text-black"
                style={{ fontFamily: 'sans-serif' }}
              >
                {/* Absolutely positioned metadata block if custom coordinates are defined, or custom letterhead is active */}
                {(companySettingsForm.letterheadUrl || companySettingsForm.metadataTop !== undefined || companySettingsForm.metadataLeft !== undefined) && (
                  <div 
                    style={{
                      position: 'absolute',
                      top: `${companySettingsForm.metadataTop ?? 25}mm`,
                      left: `${companySettingsForm.metadataLeft ?? 20}mm`,
                      fontSize: `${companySettingsForm.metadataFontSize ?? 11}px`,
                      lineHeight: '1.6',
                      fontWeight: 'bold',
                      textAlign: 'right',
                      direction: 'rtl',
                      zIndex: 50
                    }}
                  >
                    <div>تاریخ: {isPrintMode.date}</div>
                    <div>شماره نامه: {isPrintMode.letterNumber}</div>
                    <div>پیوست: {isPrintMode.attachments?.length > 0 ? 'دارد' : 'ندارد'}</div>
                  </div>
                )}

                {/* Custom Image Letterhead Background or Corporate Mockup Header */}
                {companySettingsForm.letterheadUrl ? (
                  <img src={companySettingsForm.letterheadUrl} className="absolute inset-0 w-full h-full object-cover opacity-100 z-0 pointer-events-none print:max-w-none print:max-h-none print:w-[210mm] print:h-[297mm]" />
                ) : (
                  /* Elegant default corporate letterhead */
                  <div className="border-b-2 border-double border-slate-800 pb-4 mb-8 flex justify-between items-center relative z-10">
                    {/* Left: Metadata (Only shown here if NOT absolutely positioned) */}
                    {companySettingsForm.metadataTop === undefined && companySettingsForm.metadataLeft === undefined ? (
                      <div className="text-[11px] font-bold space-y-1.5 text-slate-800 w-1/3 text-right">
                        <div>تاریخ: {isPrintMode.date}</div>
                        <div>شماره نامه: {isPrintMode.letterNumber}</div>
                        <div>پیوست: {isPrintMode.attachments?.length > 0 ? 'دارد' : 'ندارد'}</div>
                      </div>
                    ) : (
                      <div className="w-1/3"></div> /* Empty spacer to preserve layout symmetry */
                    )}

                    {/* Center: Title & Islamic Republic logo element */}
                    <div className="text-center space-y-1.5 flex-1">
                      <span className="text-[10px] text-slate-400 block font-bold">باسمه تعالی</span>
                      <h2 className="text-lg font-black text-slate-900 leading-tight">{selectedCompany.name}</h2>
                      <span className="text-[10px] text-slate-500 font-bold block bg-slate-100 px-3 py-0.5 rounded-full w-fit mx-auto">
                        دبیرخانه مرکزی ({activeSection === 'headquarters' ? 'دفتر مرکزی' : 'کارخانه'})
                      </span>
                    </div>

                    {/* Right: Company Logo Place */}
                    <div className="w-1/3 flex justify-end">
                      <div className="w-16 h-16 border-2 border-double rounded-xl overflow-hidden flex items-center justify-center p-1 bg-slate-50">
                        {selectedCompany.logo ? (
                          <img src={selectedCompany.logo} className="w-full h-full object-contain" />
                        ) : (
                          <span className="text-lg font-black text-slate-700">{selectedCompany.name.charAt(0)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Letter Body Context */}
                <div className="space-y-6 text-sm leading-loose text-slate-800 px-8 min-h-[450px] relative pb-48 pt-32 z-10">
                  
                  {/* Salutations */}
                  <div className="font-bold space-y-2 mb-6">
                    <div className="text-base text-slate-900">{isPrintMode.receiver}</div>
                    <div className="text-base font-medium">با سلام و احترام،</div>
                  </div>

                  {/* Body Content */}
                  <div className="pt-2 text-justify whitespace-pre-wrap leading-loose font-medium text-slate-800 text-[14px]">
                    {isPrintMode.content}
                  </div>

                  {/* Signatures & Stamp block (bottom left aligned) */}
                  <div className="absolute bottom-16 left-12 w-64 text-center space-y-2">
                     <div className="font-bold text-sm mb-4">{isPrintMode.signOffText || 'با تشکر'}</div>
                     <div className="font-bold text-sm">{selectedCompany?.name || ''}</div>
                     <div className="font-bold text-sm mb-2">{isPrintMode.sender}</div>

                     <div className="relative mt-2 flex justify-center items-center">
                        {isPrintMode.approvedBy && isPrintMode.approvedBy.length > 0 && (
                          <div className="flex justify-center gap-2 relative z-10 w-full flex-wrap">
                            {isPrintMode.approvedBy.map((userId, idx) => {
                              const sigUrl = isPrintMode.signatureImageUrls?.[idx];
                              return sigUrl ? (
                                <img key={idx} src={sigUrl} className="h-16 object-contain mix-blend-multiply" />
                              ) : null;
                            })}
                          </div>
                        )}
                        {isPrintMode.addCompanyStamp && companySettingsForm.companyStampUrl && (
                          <img 
                            src={companySettingsForm.companyStampUrl} 
                            className="h-28 w-28 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 object-contain mix-blend-multiply opacity-70 z-0" 
                          />
                        )}
                     </div>
                  </div>
                </div>

                {/* Footer bar containing metadata of address/phone */}
                <div className="absolute bottom-6 left-8 right-8 text-[10px] text-slate-400 border-t pt-2 flex justify-between items-center flex-wrap gap-2 print:border-t">
                  <span>نشانی: {selectedCompany.address || 'ثبت نشده'}</span>
                  <div className="flex gap-4">
                    <span>تلفن: {selectedCompany.phone || 'ثبت نشده'}</span>
                    <span>کدپستی: {selectedCompany.postalCode || '-'}</span>
                  </div>
                </div>

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default SecretariatModule;
