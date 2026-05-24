
import React, { useState, useEffect, useRef } from 'react';
import { BookOpen, LayoutDashboard, PlusCircle, ListChecks, FileText, Inbox, Users, LogOut, User as UserIcon, Settings, Bell, BellOff, MessageSquare, X, Check, Container, KeyRound, Save, Upload, Camera, Download, Share, ChevronRight, Home, Send, BrainCircuit, Mic, StopCircle, Loader2, Truck, ClipboardList, Package, Printer, CheckSquare, ShieldCheck, Shield, Phone, RefreshCw, Smartphone, MonitorDown, BellRing, Smartphone as MobileIcon, Trash2, Menu, Edit3, Sun, Moon, ShoppingCart, Wallet, Calendar as CalendarIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { User, UserRole, AppNotification, SystemSettings } from '../types';
import { logout, hasPermission, getRolePermissions, updateUser } from '../services/authService';
import { requestNotificationPermission, setNotificationPreference, isNotificationEnabledInApp, sendNotification } from '../services/notificationService';
import { getSettings, saveSettings, uploadFile } from '../services/storageService';
import { apiCall, resolveImageUrl } from '../services/apiService';
import { DEFAULT_MOBILE_NAV_ORDER } from '../constants';
import { Capacitor } from '@capacitor/core';

interface LayoutProps {
  children: React.ReactNode;
  onBack: () => boolean;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  currentUser: User;
  onLogout: () => void;
  notifications: AppNotification[];
  clearNotifications: () => void;
  onAddNotification: (title: string, message: string) => void;
  onRemoveNotification: (id: string) => void;
  financialYear?: string;
  setFinancialYear?: (y: string) => void;
  settings?: SystemSettings | null;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  unreadChatCount?: number;
}

const Layout: React.FC<LayoutProps> = ({ children, onBack, activeTab, setActiveTab, currentUser, onLogout, notifications, clearNotifications, onAddNotification, onRemoveNotification, financialYear, setFinancialYear, settings: propSettings, theme, toggleTheme, unreadChatCount = 0 }) => {
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [settings, setSettings] = useState<SystemSettings | null>(propSettings || null);

  useEffect(() => {
    const handleGlobalClose = () => {
        setShowNotifDropdown(false);
        setShowMobileMenu(false);
        setShowProfileModal(false);
        setShowIOSPrompt(false);
    };
    window.addEventListener('CLOSE_ACTIVE_MODALS', handleGlobalClose);
    return () => window.removeEventListener('CLOSE_ACTIVE_MODALS', handleGlobalClose);
  }, []);

  useEffect(() => {
    if (propSettings) {
        setSettings(propSettings);
    }
  }, [propSettings]);
  const isSecure = window.isSecureContext;
  const notifRef = useRef<HTMLDivElement>(null);
  const mobileNotifRef = useRef<HTMLDivElement>(null);
  
  // Mobile Drawer State
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // PWA & Install State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);

  // Profile/Password Modal State
  const [showProfileModal, setShowProfileModal] = useState(false);
  
  // Local Profile Form State
  const [profileForm, setProfileForm] = useState<{
      password?: string;
      confirmPassword?: string;
      telegramChatId: string;
      phoneNumber: string;
      receiveNotifications: boolean;
      mobileNavOrder: string[];
  }>({
      password: '',
      confirmPassword: '',
      telegramChatId: '',
      phoneNumber: '',
      receiveNotifications: true,
      mobileNavOrder: []
  });

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Update Detection State
  const [serverVersion, setServerVersion] = useState<string | null>(null);
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);

  useEffect(() => {
    if (showProfileModal && currentUser) {
        setProfileForm({
            password: '',
            confirmPassword: '',
            telegramChatId: currentUser.telegramChatId || '',
            phoneNumber: currentUser.phoneNumber || '',
            receiveNotifications: currentUser.receiveNotifications !== false,
            mobileNavOrder: currentUser.mobileNavOrder || []
        });
    }
  }, [showProfileModal, currentUser]);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
        setNotifEnabled(isNotificationEnabledInApp());
    } else {
        try {
            if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted' && isNotificationEnabledInApp()) {
                setNotifEnabled(true);
            } else {
                setNotifEnabled(false);
            }
        } catch(e) {
            console.warn("Notification API not supported or blocked");
            setNotifEnabled(false);
        }
    }
  }, []);

  useEffect(() => {
    checkVersion();
    const interval = setInterval(checkVersion, 60000);
    return () => clearInterval(interval);
  }, []);

  const checkVersion = async () => {
    try {
      const response = await apiCall<{version: string}>(`/version?t=${Date.now()}`);
      if (response && response.version) {
        if (serverVersion === null) {
          setServerVersion(response.version);
        } else if (serverVersion !== response.version) {
          setIsUpdateAvailable(true);
        }
      }
    } catch (e) {}
  };

  const handleReload = () => {
    window.location.reload();
  };

  useEffect(() => {
    getSettings().then(data => {
        setSettings(data);
        if (data.appName) {
            document.title = data.appName;
        }
        if (data.pwaIcon) {
            const timestamp = Date.now();
            const iconUrl = data.pwaIcon.includes('?') ? `${data.pwaIcon}&t=${timestamp}` : `${data.pwaIcon}?t=${timestamp}`;
            
            // Update Apple Icon
            const appleLink = document.querySelector("link[rel*='apple-touch-icon']") as HTMLLinkElement;
            if (appleLink) { appleLink.href = iconUrl; } else { const newLink = document.createElement('link'); newLink.rel = 'apple-touch-icon'; newLink.href = iconUrl; document.head.appendChild(newLink); }
            
            // Update Shortcut Icon
            const iconLink = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
            if (iconLink) { iconLink.href = iconUrl; } else { const newLink = document.createElement('link'); newLink.rel = 'shortcut icon'; newLink.href = iconUrl; document.head.appendChild(newLink); }
        }
    });
    
    const handleClickOutside = (event: MouseEvent) => { 
        const target = event.target as Element;
        if (showNotifDropdown && !target.closest('.notification-dropdown-container') && !target.closest('.notification-trigger')) {
            setShowNotifDropdown(false);
        }
    };
    document.addEventListener("mousedown", handleClickOutside);
    
    window.addEventListener('beforeinstallprompt', (e) => { 
        e.preventDefault(); 
        setDeferredPrompt(e); 
    });

    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    try {
        const isInStandaloneMode = ('standalone' in window.navigator) && (window.navigator as any).standalone;
        const isDisplayModeStandalone = window.matchMedia('(display-mode: standalone)').matches;
        setIsStandalone(isInStandaloneMode || isDisplayModeStandalone);
    } catch(e) {
        setIsStandalone(false);
    }

    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showNotifDropdown]);

  const handleLogout = () => { logout(); onLogout(); };
  
  const handleToggleNotif = async () => { 
      if (!Capacitor.isNativePlatform()) {
          if (typeof window === 'undefined' || !('Notification' in window)) {
              alert("این دستگاه/مرورگر از اعلان‌های وب پشتیبانی نمی‌کند.");
              return;
          }

          if (!isSecure && window.location.hostname !== 'localhost') { 
              alert("⚠️ مرورگرها اجازه فعال‌سازی نوتیفیکیشن در شبکه غیرامن (HTTP) را نمی‌دهند."); 
              return; 
          } 
      }
      
      if (notifEnabled) { 
          setNotifEnabled(false); 
          setNotificationPreference(false); 
          return;
      } 

      try {
          const granted = await requestNotificationPermission(); 
          if (granted) { 
              setNotifEnabled(true); 
              setNotificationPreference(true); 
              onAddNotification("سیستم دستور پرداخت", "نوتیفیکیشن‌ها با موفقیت فعال شدند."); 
          } else {
              setNotifEnabled(false);
              if (!Capacitor.isNativePlatform()) {
                  if (Notification.permission === 'denied') {
                      alert("دسترسی به نوتیفیکیشن توسط شما مسدود شده است.");
                  } else {
                      alert("امکان فعال‌سازی وجود ندارد.");
                  }
              }
          } 
      } catch (err) {
          console.error("Notification toggle error:", err);
          if(!Capacitor.isNativePlatform()) alert("خطا در فعال‌سازی نوتیفیکیشن");
      }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => { 
      e.preventDefault(); 
      const updates: Partial<User> = {}; 
      if (profileForm.password) { 
          if (profileForm.password !== profileForm.confirmPassword) { alert('رمز عبور و تکرار آن مطابقت ندارند.'); return; } 
          if (profileForm.password.length < 4) { alert('رمز عبور باید حداقل ۴ کاراکتر باشد.'); return; } 
          updates.password = profileForm.password; 
      } 
      updates.telegramChatId = profileForm.telegramChatId;
      updates.phoneNumber = profileForm.phoneNumber;
      updates.receiveNotifications = profileForm.receiveNotifications;
      updates.mobileNavOrder = profileForm.mobileNavOrder;
      try { await updateUser({ ...currentUser, ...updates }); alert('اطلاعات با موفقیت بروزرسانی شد.'); setProfileForm(prev => ({...prev, password: '', confirmPassword: ''})); setShowProfileModal(false); window.location.reload(); } catch (err) { alert('خطا در بروزرسانی اطلاعات'); } 
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => { 
      const file = e.target.files?.[0]; if (!file) return; 
      setUploadingAvatar(true); 
      const reader = new FileReader(); 
      reader.onload = async (ev) => { 
          const base64 = ev.target?.result as string; 
          try { const result = await uploadFile(file.name, base64); await updateUser({ ...currentUser, avatar: result.url }); window.location.reload(); } catch (error) { alert('خطا در آپلود تصویر'); } finally { setUploadingAvatar(false); } 
      }; 
      reader.readAsDataURL(file); 
  };

  const unreadCount = notifications.filter(n => !n.read).length;
  // Calculate Permissions
  const perms = settings ? getRolePermissions(currentUser.role, settings, currentUser) : { canCreatePaymentOrder: false, canViewPaymentOrders: false };
  
  // Specific Access Flags
  const canCreatePayment = perms.canCreatePaymentOrder === true;
  const canViewPayment = perms.canViewPaymentOrders === true;
  const canCreateExit = perms.canCreateExitPermit === true;
  const canViewInvoices = perms.canViewInvoices === true;
  const canViewExit = perms.canViewExitPermits === true;
  const canManageWarehouse = currentUser.role === UserRole.ADMIN || perms.canManageWarehouse === true;
  const canSeeTrade = perms.canManageTrade === true;
  const canSeeBalances = currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.FINANCIAL || (perms as any).canViewCustomerBalances === true;
  const canSeeProducts = currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.SALES_MANAGER || perms.canManageSales === true; // Sales manager & admins
  const canSeeSettings = currentUser.role === UserRole.ADMIN || perms.canManageSettings === true || perms.canManageTradeSettings === true;
  const canSeeSecurity = currentUser.role === UserRole.ADMIN || perms.canViewSecurity === true;
  const canSeeKnowledgeBase = currentUser.role === UserRole.ADMIN || perms.canViewKnowledgeBase === true || perms.canManageKnowledgeBase === true;
  const canSeeMeetings = currentUser.role === UserRole.ADMIN || perms.canViewMeetings === true;
  const canSeePurchase = currentUser.role === UserRole.ADMIN || (perms.canView === true);
  const canSeeNotifications = currentUser.role === UserRole.ADMIN || perms.canViewNotifications === true;

  const navItems = [
    { id: 'dashboard', label: 'داشبورد', icon: LayoutDashboard },
  ];
  if (canCreatePayment) navItems.push({ id: 'create', label: 'ثبت پرداخت', icon: PlusCircle });
  if (canViewPayment) navItems.push({ id: 'manage', label: 'سوابق پرداخت', icon: ListChecks });
  if (canCreateExit) navItems.push({ id: 'create-exit', label: 'ثبت خروج', icon: Truck });
  if (canViewInvoices) navItems.push({ id: 'manage-invoices', label: 'مدیریت فاکتورها', icon: FileText });
  if (canViewExit) navItems.push({ id: 'manage-exit', label: 'سوابق خروج', icon: ClipboardList });
  if (canManageWarehouse) navItems.push({ id: 'warehouse', label: 'مدیریت انبار', icon: Package });
  if (canSeeSecurity) navItems.push({ id: 'security', label: 'انتظامات', icon: Shield });
  if (canSeeMeetings) navItems.push({ id: 'meetings', label: 'جلسات تولید', icon: ClipboardList });
  if (canSeePurchase) navItems.push({ id: 'purchase', label: 'درخواست خرید', icon: ShoppingCart });
  navItems.push({ id: 'chat', label: 'گفتگو', icon: MessageSquare });
  if (canSeeKnowledgeBase) navItems.push({ id: 'knowledge', label: 'اطلاعات و یادداشت ها', icon: BookOpen });
  if (canSeeTrade) navItems.push({ id: 'trade', label: 'بازرگانی', icon: Container });
  if (canSeeBalances) navItems.push({ id: 'balances', label: 'مانده حساب مشتریان', icon: Wallet });
  if (canSeeProducts) {
      navItems.push({ id: 'products', label: 'کالاها', icon: Package });
      navItems.push({ id: 'sales', label: 'مشتریان', icon: Users });
      navItems.push({ id: 'tickets', label: 'تیکت‌ها', icon: Inbox });
  }
  if (hasPermission(currentUser, 'manage_users')) navItems.push({ id: 'users', label: 'کاربران', icon: Users });
  if (canSeeSettings) navItems.push({ id: 'settings', label: 'تنظیمات', icon: Settings });

  // Dynamic Navigation Logic
  const mobileNavOrder_val = currentUser.mobileNavOrder || settings?.mobileNavOrder || DEFAULT_MOBILE_NAV_ORDER;

  const allAvailableItems = navItems.filter(item => {
      // Dashboard is usually always there if possible
      if (item.id === 'dashboard') return true;
      return true; // navItems is already filtered by perms
  });

  const sortedItems = [...allAvailableItems].sort((a, b) => {
      const idxA = mobileNavOrder_val.indexOf(a.id);
      const idxB = mobileNavOrder_val.indexOf(b.id);
      if (idxA === -1 && idxB === -1) return 0;
      if (idxA === -1) return 1;
      if (idxB === -1) return -1;
      return idxA - idxB;
  });

  // Max 6 items in bottom bar (including "More" if needed)
  const limit = 6;
  const hasMore = sortedItems.length > limit;
  const bottomVisibleItems = hasMore ? sortedItems.slice(0, limit - 1) : sortedItems;
  const menuItems = hasMore ? sortedItems.slice(limit - 1) : [];

  const NotificationDropdown = () => ( 
    <div role="dialog" aria-label="اعلان‌ها" className="notification-dropdown-container fixed top-16 left-4 right-4 md:absolute md:top-auto md:bottom-16 md:left-2 md:right-auto md:w-80 glass-panel rounded-xl shadow-2xl border border-gray-200/50 dark:border-white/10 text-gray-800 dark:text-gray-200 z-[9999] overflow-hidden origin-top md:origin-bottom-left animate-scale-in max-h-[60vh] flex flex-col">
        <div className="bg-blue-50 p-3 flex justify-between items-center border-b border-blue-100 shrink-0">
            <div className="flex items-center gap-2">
                {notifEnabled ? <Bell size={16} className="text-blue-600"/> : <BellOff size={16} className="text-gray-500 dark:text-gray-500"/>}
                <span className="text-xs font-bold text-blue-800">وضعیت اعلان‌ها:</span>
            </div>
            <button onClick={handleToggleNotif} className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${notifEnabled ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700 hover:bg-red-200 animate-pulse'}`}>
                {notifEnabled ? 'فعال است' : 'فعال‌سازی'}
            </button>
        </div>
        <div className="bg-gray-50 dark:bg-gray-900/40 text-gray-800 dark:text-gray-200 p-2 flex justify-between items-center border-b shrink-0">
            <span className="text-xs font-bold text-gray-600 dark:text-gray-400">پیام‌های سیستم</span>
            {notifications.length > 0 && (
                <button onClick={clearNotifications} className="text-gray-400 hover:text-red-500 flex items-center gap-1 text-[10px]">
                    <Trash2 size={12} /> پاک کردن همه
                </button>
            )}
        </div>
        <div className="overflow-y-auto flex-1 custom-scrollbar">
            {notifications.length === 0 ? (
                <div className="p-6 text-center text-xs text-gray-400 flex flex-col items-center">
                    <BellOff size={24} className="mb-2 opacity-20"/>
                    هیچ پیامی نیست
                </div>
            ) : (
                notifications.map(n => (
                    <div key={n.id} className="p-3 border-b hover:bg-gray-50 text-right last:border-0 relative group">
                        <div className="flex justify-between items-start pl-6">
                            <div className="text-xs font-bold text-gray-800 mb-1">{n.title}</div>
                            <div className="text-[9px] text-gray-400 whitespace-nowrap">{new Date(n.timestamp).toLocaleTimeString('fa-IR', {hour: '2-digit', minute:'2-digit'})}</div>
                        </div>
                        <div className="text-xs text-gray-600 leading-tight">{n.message}</div>
                        <button 
                            onClick={(e) => { e.stopPropagation(); onRemoveNotification(n.id); }} 
                            className="absolute top-3 left-2 text-gray-300 hover:text-red-500 p-1 rounded-full hover:bg-red-50 transition-colors"
                            title="حذف پیام"
                        >
                            <X size={14}/>
                        </button>
                    </div>
                ))
            )}
        </div>
    </div> 
  );

  return (
    <div className="flex h-[100dvh] w-full bg-transparent text-[var(--text-primary)] font-sans relative overflow-hidden">
      {/* Background Blobs for fluid depth */}
      <div className="bg-blobs">
          <div className="blob blob-1"></div>
          <div className="blob blob-2"></div>
          <div className="blob blob-3"></div>
      </div>
      
      {isUpdateAvailable && (<div className="fixed top-0 left-0 right-0 bg-blue-600 text-white z-[9999] p-3 text-center shadow-lg animate-slide-down flex justify-center items-center gap-4"><div className="flex items-center gap-2"><RefreshCw size={20} className="animate-spin"/><span className="font-bold text-sm">نسخه جدید نرم‌افزار در دسترس است!</span></div><button onClick={handleReload} className="glass-panel text-blue-600 px-4 py-1 rounded-full text-xs font-bold hover:bg-blue-50 transition-colors shadow-sm">بروزرسانی (رفرش)</button></div>)}
      
      {/* One UI Style Profile Modal */}
      <AnimatePresence>
        {showProfileModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/40 backdrop-blur-md" 
                onClick={() => setShowProfileModal(false)} 
              />
              <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 30 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 30 }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="relative bg-white dark:bg-gray-900 rounded-[3.5rem] shadow-2xl w-full max-w-sm overflow-hidden flex flex-col border border-white/20 dark:border-white/5"
              >
                  <div className="p-8 pb-4 flex flex-col items-center">
                      <div className="w-full flex justify-between items-center mb-6">
                            <button onClick={() => setShowProfileModal(false)} className="p-3 bg-gray-100 dark:bg-gray-800 rounded-full text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                                <X size={20}/>
                            </button>
                            <h3 className="text-xl font-black tracking-tighter">حساب کاربری</h3>
                            <div className="w-10"></div>
                      </div>

                      <div className="relative group cursor-pointer mb-4" onClick={() => avatarInputRef.current?.click()}>
                          <div className="w-28 h-28 rounded-[2.5rem] bg-blue-50 dark:bg-blue-900/20 overflow-hidden shadow-inner flex items-center justify-center border-4 border-white dark:border-gray-800 rotate-3 transition-transform hover:rotate-0">
                                {currentUser.avatar ? <img src={resolveImageUrl(currentUser.avatar)} alt="Profile" className="w-full h-full object-cover" /> : <UserIcon size={44} className="text-blue-500" />}
                          </div>
                          <div className="absolute -bottom-1 -right-1 bg-blue-600 p-2.5 rounded-2xl text-white shadow-lg border-4 border-white dark:border-gray-900">
                                {uploadingAvatar ? <Loader2 size={16} className="animate-spin"/> : <Camera size={16}/>}
                          </div>
                          <input type="file" ref={avatarInputRef} className="hidden" accept="image/*" onChange={handleAvatarChange} disabled={uploadingAvatar} />
                      </div>
                      
                      <h2 className="text-xl font-black text-gray-900 dark:text-white tracking-tight text-center">{currentUser.fullName}</h2>
                      <div className="flex gap-2 mt-2 justify-center">
                        <span className="text-[10px] font-black text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-3 py-1 rounded-full uppercase tracking-wider">{currentUser.role}</span>
                        <span className="text-[10px] font-black text-gray-400 bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full">{currentUser.username}</span>
                      </div>
                  </div>

                  <div className="px-8 pb-8 overflow-y-auto flex-1 custom-scrollbar">
                      <form onSubmit={handleUpdateProfile} className="space-y-6">
                          <div className="space-y-2">
                              <label className="text-[10px] font-black text-gray-400 mr-2 uppercase tracking-widest">تغییر رمز عبور</label>
                              <div className="grid grid-cols-1 gap-2">
                                  <input type="password" value={profileForm.password} onChange={e => setProfileForm({...profileForm, password: e.target.value})} className="w-full bg-gray-50 dark:bg-gray-800/50 border-none rounded-2xl p-4 text-sm focus:ring-2 focus:ring-blue-500 transition-all font-bold" placeholder="رمز عبور جدید"/>
                                  <input type="password" value={profileForm.confirmPassword} onChange={e => setProfileForm({...profileForm, confirmPassword: e.target.value})} className="w-full bg-gray-50 dark:bg-gray-800/50 border-none rounded-2xl p-4 text-sm focus:ring-2 focus:ring-blue-500 transition-all font-bold" placeholder="تکرار رمز عبور"/>
                              </div>
                          </div>

                          <div className="space-y-2">
                              <label className="text-[10px] font-black text-gray-400 mr-2 uppercase tracking-widest">شماره موبایل</label>
                              <input type="text" value={profileForm.phoneNumber} onChange={e => setProfileForm({...profileForm, phoneNumber: e.target.value})} className="w-full bg-gray-50 dark:bg-gray-800/50 border-none rounded-2xl p-4 text-sm focus:ring-2 focus:ring-blue-500 transition-all font-bold" placeholder="0912..."/>
                          </div>

                          <div className="space-y-2">
                              <label className="text-[10px] font-black text-gray-400 mr-2 uppercase tracking-widest">آیدی تلگرام برای اعلان‌ها</label>
                              <input type="text" value={profileForm.telegramChatId} onChange={e => setProfileForm({...profileForm, telegramChatId: e.target.value})} className="w-full bg-gray-50 dark:bg-gray-800/50 border-none rounded-2xl p-4 text-sm focus:ring-2 focus:ring-blue-500 transition-all font-bold" placeholder="Telegram Chat ID"/>
                          </div>

                          {navItems.length > 5 && (
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 mr-2 uppercase tracking-widest">ترتیب آیکون‌های نوار پایین</label>
                                <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-2xl max-h-32 overflow-y-auto space-y-1">
                                    {(profileForm.mobileNavOrder.length > 0 ? profileForm.mobileNavOrder : DEFAULT_MOBILE_NAV_ORDER).map((id, idx) => {
                                        const item = navItems.find(i => i.id === id);
                                        if (!item) return null;
                                        return (
                                            <div key={id} className="flex items-center justify-between text-[11px] font-bold p-1">
                                                <span>{item.label}</span>
                                                <div className="flex gap-2">
                                                    <button type="button" onClick={() => {
                                                        const newOrder = [...profileForm.mobileNavOrder];
                                                        if (idx > 0) {
                                                            [newOrder[idx], newOrder[idx-1]] = [newOrder[idx-1], newOrder[idx]];
                                                            setProfileForm({...profileForm, mobileNavOrder: newOrder});
                                                        }
                                                    }} className="text-blue-500">↑</button>
                                                    <button type="button" onClick={() => {
                                                        const newOrder = [...profileForm.mobileNavOrder];
                                                        if (idx < newOrder.length - 1) {
                                                            [newOrder[idx], newOrder[idx+1]] = [newOrder[idx+1], newOrder[idx]];
                                                            setProfileForm({...profileForm, mobileNavOrder: newOrder});
                                                        }
                                                    }} className="text-blue-500">↓</button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                          )}

                          <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-[2rem] flex items-center justify-between group">
                              <div className="flex items-center gap-4">
                                  <div className="bg-white dark:bg-gray-700 p-3 rounded-2xl text-blue-600 shadow-sm">
                                      <Bell size={20}/>
                                  </div>
                                  <div>
                                      <div className="text-xs font-black text-gray-900 dark:text-white text-right">اعلان‌ها</div>
                                      <div className="text-[10px] text-gray-500 font-bold text-right">نمایش نوتیفیکیشن سیستم</div>
                                  </div>
                              </div>
                              <button 
                                  type="button"
                                  onClick={() => setProfileForm({...profileForm, receiveNotifications: !profileForm.receiveNotifications})}
                                  className={`w-14 h-8 rounded-full p-1.5 transition-colors relative ${profileForm.receiveNotifications ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-700'}`}
                              >
                                  <motion.div 
                                      animate={{ x: profileForm.receiveNotifications ? 24 : 0 }} 
                                      className="w-5 h-5 bg-white rounded-full shadow-lg"
                                  />
                              </button>
                          </div>

                          <button 
                              type="submit" 
                              className="w-full bg-blue-600 text-white py-5 rounded-3xl font-black text-sm hover:bg-blue-700 shadow-2xl shadow-blue-600/30 active:scale-[0.98] transition-all"
                          >
                              ذخیره تغییرات
                          </button>
                          
                          <button 
                              type="button"
                              onClick={handleLogout}
                              className="w-full flex items-center justify-center gap-2 py-4 text-red-500 font-black text-xs hover:bg-red-50 dark:hover:bg-red-900/20 rounded-2xl transition-colors"
                          >
                              <LogOut size={16}/> خروج از حساب کاربری
                          </button>
                      </form>
                  </div>
              </motion.div>
          </div>
        )}
      </AnimatePresence>


      {/* Modern Side Menu (Samsung Inspired) */}
      <aside className={`flex-shrink-0 hidden md:flex flex-col no-print h-screen sticky top-0 transition-all duration-500 z-[100] ${isSidebarOpen ? 'w-72' : 'w-24'}`}>
          <div className="flex flex-col h-full bg-white/70 dark:bg-gray-950/70 backdrop-blur-3xl border-l border-white/20 dark:border-white/5 m-4 mr-0 rounded-[3rem] shadow-2xl overflow-hidden p-4">
              <div className="p-4 flex items-center justify-between mb-6">
                  {isSidebarOpen && (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-xl rotate-6">
                            <PlusCircle size={24} />
                        </div>
                        <div className="text-right">
                            <h1 className="text-lg font-black tracking-tighter leading-none">{settings?.appName || 'مدیریت'}</h1>
                            <span className="text-[10px] font-black text-gray-400 tracking-widest uppercase">One UI 8</span>
                        </div>
                    </motion.div>
                  )}
                  <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className={`p-4 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-[1.5rem] transition-all ${!isSidebarOpen && 'mx-auto'}`}>
                      {isSidebarOpen ? <X size={20}/> : <Menu size={20}/>}
                  </button>
              </div>

              <nav className="flex-1 space-y-1.5 overflow-y-auto custom-scrollbar px-2">
                  {navItems.map((item) => {
                      const Icon = item.icon;
                      const isActive = activeTab === item.id;
                      return (
                        <button 
                            key={item.id} 
                            onClick={() => setActiveTab(item.id)} 
                            className={`w-full flex items-center gap-5 px-5 py-4 rounded-[1.8rem] transition-all relative group ${isActive ? 'text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/60'}`}
                        >
                            <Icon size={isActive ? 24 : 22} strokeWidth={isActive ? 2.5 : 2} className="relative z-10 shrink-0 transition-transform group-hover:scale-110" />
                            {isSidebarOpen && (
                                <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="font-black text-sm whitespace-nowrap relative z-10 tracking-tight">{item.label}</motion.span>
                            )}
                            {isActive && (
                                <motion.div layoutId="navHighlight" className="absolute inset-0 bg-blue-600 rounded-[1.8rem] shadow-2xl shadow-blue-600/30" />
                            )}
                            {item.id === 'chat' && unreadChatCount > 0 && (
                                <span className="absolute left-4 top-4 w-6 h-6 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-black animate-bounce border-4 border-white dark:border-gray-900 z-20 shadow-lg">{unreadChatCount}</span>
                            )}
                        </button>
                      );
                  })}
              </nav>

              <div className="mt-4 p-4 bg-gray-50 dark:bg-white/5 rounded-[2.2rem] flex flex-col gap-3">
                  <button onClick={() => setShowProfileModal(true)} className="flex items-center gap-4 p-2 hover:bg-white dark:hover:bg-gray-800 rounded-[1.5rem] transition-all group overflow-hidden">
                      <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-900/30 border-2 border-white dark:border-gray-800 overflow-hidden shrink-0 shadow-sm">
                          {currentUser.avatar ? <img src={resolveImageUrl(currentUser.avatar)} className="w-full h-full object-cover"/> : <UserIcon className="w-full h-full p-2.5 text-blue-500"/>}
                      </div>
                      {isSidebarOpen && (
                        <div className="text-right overflow-hidden flex-1">
                            <div className="text-sm font-black text-gray-900 dark:text-white truncate">{currentUser.fullName}</div>
                            <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{currentUser.role}</div>
                        </div>
                      )}
                  </button>
                  <div className="flex gap-2">
                       <button onClick={toggleTheme} className="flex-1 h-14 bg-white dark:bg-gray-800 rounded-[1.2rem] hover:bg-gray-50 transition-all shadow-sm text-gray-500 dark:text-gray-300 flex items-center justify-center">
                          {theme === 'light' ? <Moon size={20}/> : <Sun size={20} className="text-yellow-400"/>}
                      </button>
                  </div>
              </div>
          </div>
      </aside>
      
      {/* One UI 8 Inspired Mobile Drawer */}
      <AnimatePresence>
        {showMobileMenu && (
          <div className="fixed inset-0 z-[300] md:hidden">
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/60 backdrop-blur-xl" 
                onClick={() => setShowMobileMenu(false)} 
              />
              <motion.div 
                initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="absolute right-0 top-0 bottom-0 w-[85%] bg-white dark:bg-gray-950 shadow-2xl flex flex-col p-8 rounded-r-[3.5rem] border-l border-white/20"
              >
                  <div className="flex justify-between items-center mb-10">
                      <div className="flex items-center gap-4">
                          <div className="w-14 h-14 bg-blue-600 rounded-3xl flex items-center justify-center text-white shadow-xl rotate-3">
                              <UserIcon size={28}/>
                          </div>
                          <div>
                              <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tighter">{currentUser.fullName}</h3>
                              <span className="text-[10px] font-black text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-3 py-1 rounded-full uppercase tracking-widest">{currentUser.role}</span>
                          </div>
                      </div>
                      <button onClick={() => setShowMobileMenu(false)} className="p-3 bg-gray-100 dark:bg-gray-800 rounded-full text-gray-400">
                          <X size={20}/>
                      </button>
                  </div>

                  <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-2">
                       {navItems.map(item => {
                           const Icon = item.icon;
                           const isActive = activeTab === item.id;
                           return (
                               <button 
                                key={item.id}
                                onClick={() => { setActiveTab(item.id); setShowMobileMenu(false); }}
                                className={`w-full flex items-center justify-between p-5 rounded-[2rem] transition-all ${isActive ? 'bg-blue-600 text-white shadow-2xl shadow-blue-600/30' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                               >
                                   <div className="flex items-center gap-5">
                                       <Icon size={22} strokeWidth={isActive ? 3 : 2.5} />
                                       <span className="text-sm font-black tracking-tight">{item.label}</span>
                                   </div>
                                   {item.id === 'chat' && unreadChatCount > 0 && (
                                       <span className="w-6 h-6 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-black animate-bounce border-2 border-white">{unreadChatCount}</span>
                                   )}
                               </button>
                           );
                       })}
                  </div>

                  <div className="mt-8 space-y-4">
                       <button onClick={toggleTheme} className="w-full flex items-center justify-between p-6 bg-gray-50 dark:bg-gray-900 rounded-[2.5rem] border border-gray-100 dark:border-white/5 group">
                           <div className="flex items-center gap-4">
                               <div className="bg-white dark:bg-gray-800 p-3 rounded-2xl text-blue-600 shadow-sm">
                                   {theme === 'light' ? <Moon size={20}/> : <Sun size={20} className="text-yellow-400"/>}
                               </div>
                               <span className="text-sm font-black text-gray-900 dark:text-white">تغییر پوسته</span>
                           </div>
                           <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{theme === 'light' ? 'تیره' : 'روشن'}</div>
                       </button>
                       
                       <button onClick={handleLogout} className="w-full flex items-center gap-4 p-6 text-red-500 font-black text-sm hover:bg-red-50 dark:hover:bg-red-900/20 rounded-[2rem] transition-all">
                           <LogOut size={20}/> خروج از حساب کاربری
                       </button>
                  </div>
              </motion.div>
          </div>
        )}
      </AnimatePresence>

      <main className="flex-1 flex flex-col min-w-0 transition-all duration-500 relative z-10 p-0 md:p-6 lg:p-8">
          <div className="flex-1 bg-white/40 dark:bg-gray-950/40 backdrop-blur-3xl border border-white/30 dark:border-white/5 rounded-none md:rounded-[4rem] shadow-none md:shadow-2xl overflow-hidden flex flex-col relative min-h-0">
               
               {/* Translucent App Header (Modern Android style) */}
               <header className="h-24 shrink-0 flex items-center justify-between px-10 relative z-[60] no-print">
                    <div className="flex items-center gap-8">
                        <button 
                            onClick={onBack} 
                            className="w-14 h-14 bg-white/80 dark:bg-black/20 hover:bg-white dark:hover:bg-black/40 rounded-[1.8rem] border border-white dark:border-white/5 shadow-sm flex items-center justify-center transition-all group active:scale-90"
                        >
                            <ChevronRight size={28} className="group-hover:translate-x-1 transition-transform rtl:rotate-0" />
                        </button>
                        <div className="flex flex-col">
                            <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tighter leading-none mb-1">
                                {navItems.find(i => i.id === activeTab)?.label}
                            </h2>
                            <div className="flex items-center gap-4 text-[10px] font-black text-gray-400 tracking-widest uppercase">
                                <div className="flex items-center gap-2 bg-gray-100/50 dark:bg-white/5 px-2 py-0.5 rounded-full border border-white/20">
                                    <CalendarIcon size={12} className="text-blue-500" />
                                    <select 
                                        value={financialYear} 
                                        onChange={(e) => (window as any).setAppFinancialYear?.(e.target.value)}
                                        className="bg-transparent border-none p-0 text-[10px] font-black text-gray-700 dark:text-gray-300 outline-none cursor-pointer focus:ring-0"
                                    >
                                        {settings?.fiscalYears?.length ? (
                                            settings.fiscalYears.map((y: any) => (
                                                <option key={y.id} value={y.label}>{y.label}</option>
                                            ))
                                        ) : (
                                            <>
                                                <option value="1403">۱۴۰۳</option>
                                                <option value="1404">۱۴۰۴</option>
                                            </>
                                        )}
                                    </select>
                                </div>
                                <span className="w-1 h-1 bg-gray-300 rounded-full" />
                                <span className="text-blue-500">{currentUser.role}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                         <div className="hidden sm:flex items-center bg-gray-100/50 dark:bg-white/5 pl-2 pr-6 py-2 rounded-[2rem] gap-4 border border-white dark:border-white/5">
                             <div className="text-right">
                                 <div className="text-[10px] font-black text-gray-400 tracking-widest uppercase">خوش آمدید</div>
                                 <div className="text-xs font-black text-gray-900 dark:text-white">{currentUser.fullName}</div>
                             </div>
                             <button onClick={() => setShowProfileModal(true)} className="w-12 h-12 rounded-[1.2rem] overflow-hidden shadow-xl border-4 border-white dark:border-gray-800 rotate-3 transition-transform hover:rotate-0 shrink-0">
                                 {currentUser.avatar ? <img src={resolveImageUrl(currentUser.avatar)} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-blue-600" />}
                             </button>
                         </div>
                         
                         {canSeeNotifications && (
                            <div className="relative" ref={mobileNotifRef}>
                                <button onClick={() => setShowNotifDropdown(!showNotifDropdown)} className="w-14 h-14 bg-white dark:bg-white/5 rounded-3xl shadow-sm border border-white dark:border-white/5 flex items-center justify-center relative transition-all active:scale-95 group overflow-hidden">
                                    <Bell size={24} className={unreadCount > 0 ? 'text-blue-600 animate-swing' : 'text-gray-400 group-hover:text-blue-500 transition-colors'} />
                                    {unreadCount > 0 && <span className="absolute top-4 right-4 w-3 h-3 bg-red-500 rounded-full border-[3px] border-white dark:border-gray-950" />}
                                </button>
                                {showNotifDropdown && <NotificationDropdown />}
                            </div>
                         )}

                         <button 
                            onClick={() => setShowMobileMenu(true)} 
                            className="md:hidden w-14 h-14 bg-blue-600 text-white rounded-3xl shadow-2xl shadow-blue-600/30 flex items-center justify-center active:scale-90 transition-all"
                         >
                            <Menu size={24} />
                         </button>
                    </div>
               </header>

               {/* Viewport Content */}
               <div className="flex-1 min-h-0 relative flex flex-col overflow-hidden h-full">
                    <div className={`flex-1 overflow-y-auto ${activeTab === 'chat' ? 'min-h-0 h-full' : 'pb-36 lg:pb-12 px-4 md:px-12 lg:px-16'} custom-scrollbar scroll-smooth`}>
                         <motion.div 
                            key={activeTab}
                            initial={{ opacity: 0, scale: 0.98, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            transition={{ type: "spring", damping: 25, stiffness: 200 }}
                            className="h-full w-full max-w-7xl mx-auto"
                         >
                            {children}
                         </motion.div>
                    </div>
               </div>
          </div>
      </main>

      {/* Floating Bottom Navigation Pill (Samsung Inspired) */}
      <AnimatePresence>
        {activeTab && (
            <motion.nav 
                initial={{ y: 120 }} animate={{ y: 0 }} exit={{ y: 120 }}
                transition={{ type: "spring", damping: 20, stiffness: 180 }}
                className="md:hidden fixed bottom-8 left-8 right-8 z-[200] no-print"
            >
                <div className="p-3 bg-white/80 dark:bg-gray-950/90 backdrop-blur-3xl border border-white/20 dark:border-white/5 rounded-full shadow-[0_30px_70px_rgba(0,0,0,0.4)] flex justify-between items-center gap-2 px-5">
                    {bottomVisibleItems.map(item => {
                        const Icon = item.icon;
                        const isActive = activeTab === item.id;
                        return (
                            <button 
                                key={item.id}
                                onClick={() => setActiveTab(item.id)}
                                className={`flex-1 flex flex-col items-center justify-center pt-3 pb-2.5 px-1 rounded-3xl transition-all relative ${isActive ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                            >
                                <Icon size={isActive ? 22 : 20} strokeWidth={isActive ? 2.5 : 2} className="relative z-10 transition-transform mb-1.5" />
                                <span className={`text-[10px] font-black relative z-10 tracking-tighter leading-none ${isActive ? 'opacity-100 text-blue-600' : 'opacity-80'}`} style={{fontSize: 'calc(10px + 0vw)'}}>
                                    {item.label}
                                </span>
                                {isActive && (
                                    <motion.div layoutId="activeTabPill" className="absolute inset-x-1 inset-y-1 bg-blue-50 dark:bg-blue-900/30 rounded-2xl border border-blue-100 dark:border-blue-700 shadow-inner" />
                                )}
                                {item.id === 'chat' && unreadChatCount > 0 && (
                                    <span className="absolute top-1 right-1/2 translate-x-3 w-4 h-4 bg-red-500 text-white text-[8px] rounded-full flex items-center justify-center font-black animate-bounce border-2 border-white dark:border-gray-950 shadow-lg z-20">{unreadChatCount}</span>
                                )}
                            </button>
                        );
                    })}
                    {hasMore && (
                        <button 
                            onClick={() => setShowMobileMenu(true)}
                            className="flex-none flex flex-col items-center justify-center pt-2 pb-1.5 px-3 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 bg-gray-50 dark:bg-white/10 rounded-2xl border border-white/10"
                        >
                            <Menu size={20} strokeWidth={2} className="mb-1" />
                            <span className="text-[10px] font-black leading-none" style={{fontSize: 'calc(10px + 0vw)'}}>بیشتر</span>
                        </button>
                    )}
                </div>
            </motion.nav>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Layout;
