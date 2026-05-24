
import React, { useState, useEffect, useRef } from 'react';
import { BookOpen, LayoutDashboard, PlusCircle, ListChecks, FileText, Inbox, Users, LogOut, User as UserIcon, Settings, Bell, BellOff, MessageSquare, X, Check, Container, KeyRound, Save, Upload, Camera, Download, Share, ChevronRight, Home, Send, BrainCircuit, Mic, StopCircle, Loader2, Truck, ClipboardList, Package, Printer, CheckSquare, ShieldCheck, Shield, Phone, RefreshCw, Smartphone, MonitorDown, BellRing, Smartphone as MobileIcon, Trash2, Menu, Edit3, Sun, Moon, ShoppingCart, Wallet } from 'lucide-react';
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

  // Max 5 items in bottom bar (including "More" if needed)
  const limit = 5;
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
      
      {/* Profile Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4 animate-fade-in">
            <div className="glass-panel rounded-3xl shadow-2xl w-full max-w-md overflow-hidden relative max-h-[85vh] flex flex-col">
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 flex flex-col items-center justify-center text-white relative shrink-0">
                    <button onClick={() => setShowProfileModal(false)} className="absolute top-4 right-4 text-white/70 hover:text-white p-2 hover:bg-white/10 rounded-full transition-colors"><X size={20}/></button>
                    <div className="relative group cursor-pointer mb-2" onClick={() => avatarInputRef.current?.click()}>
                        <div className="w-16 h-16 rounded-full bg-white/20 border-4 border-white/30 overflow-hidden shadow-lg">
                            {currentUser.avatar ? <img src={resolveImageUrl(currentUser.avatar)} alt="Profile" className="w-full h-full object-cover" /> : <UserIcon size={32} className="w-full h-full p-3 text-white" />}
                        </div>
                        <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            {uploadingAvatar ? <Loader2 size={20} className="animate-spin text-white"/> : <Camera size={20} className="text-white"/>}
                        </div>
                        <input type="file" ref={avatarInputRef} className="hidden" accept="image/*" onChange={handleAvatarChange} disabled={uploadingAvatar} />
                    </div>
                    <h3 className="text-md font-black tracking-tight">{currentUser.fullName}</h3>
                    <p className="text-[10px] font-bold opacity-80">{currentUser.role}</p>
                </div>
                <div className="p-4 overflow-y-auto flex-1 custom-scrollbar">
                    <form onSubmit={handleUpdateProfile} className="space-y-4 pb-2">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1"><label className="text-xs font-bold text-gray-500">رمز عبور جدید</label><input type="password" value={profileForm.password} onChange={e => setProfileForm({...profileForm, password: e.target.value})} className="w-full border rounded-lg p-2 text-sm" placeholder="******"/></div>
                            <div className="space-y-1"><label className="text-xs font-bold text-gray-500">تکرار رمز</label><input type="password" value={profileForm.confirmPassword} onChange={e => setProfileForm({...profileForm, confirmPassword: e.target.value})} className="w-full border rounded-lg p-2 text-sm" placeholder="******"/></div>
                        </div>
                        <div className="space-y-1"><label className="text-xs font-bold text-gray-500">شماره موبایل (واتساپ)</label><input type="tel" value={profileForm.phoneNumber} onChange={e => setProfileForm({...profileForm, phoneNumber: e.target.value})} className="w-full border rounded-lg p-2 text-sm dir-ltr" placeholder="98912..."/></div>
                        
                        <div className="space-y-4 pt-4 border-t">
                            <h4 className="text-xs font-bold text-gray-700 flex items-center gap-2"><Smartphone size={16}/> اولویت نوار پایین موبایل</h4>
                            <div className="bg-blue-50 p-3 rounded-xl border border-blue-100 text-[10px] text-blue-700 leading-relaxed mb-2">
                                ترتیب آیکون‌ها در نوار پایین گوشی را می‌توانید شخصی‌سازی کنید.
                            </div>
                            <div className="grid grid-cols-1 gap-1.5 max-h-40 overflow-y-auto p-2 bg-gray-50 rounded-xl border border-gray-100">
                                {(profileForm.mobileNavOrder?.length ? profileForm.mobileNavOrder : DEFAULT_MOBILE_NAV_ORDER).map((itemId, idx) => {
                                    const navLabel = {
                                        dashboard: 'داشبورد',
                                        create: 'ثبت پرداخت',
                                        manage: 'سوابق پرداخت',
                                        'create-exit': 'ثبت خروج',
                                        'manage-invoices': 'مدیریت فاکتورها',
                                        'manage-exit': 'سوابق خروج',
                                        warehouse: 'مدیریت انبار',
                                        security: 'انتظامات',
                                        meetings: 'جلسات تولید',
                                        purchase: 'درخواست خرید',
                                        chat: 'گفتگو',
                                        knowledge: 'اطلاعات و یادداشت ها',
                                        trade: 'بازرگانی',
                                        balances: 'مانده حساب مشتریان',
                                        products: 'کالاها',
                                        sales: 'مشتریان',
                                        tickets: 'تیکت‌ها',
                                        users: 'کاربران',
                                        settings: 'تنظیمات'
                                    }[itemId] || itemId;

                                    return (
                                        <div key={itemId} className="flex items-center justify-between bg-white p-1.5 rounded-lg border border-gray-100 shadow-sm">
                                            <span className="text-[10px] font-bold text-gray-700 truncate">{navLabel}</span>
                                            <div className="flex gap-1">
                                                    <button 
                                                        type="button"
                                                        onClick={() => {
                                                            const defaultOrder = DEFAULT_MOBILE_NAV_ORDER;
                                                            const currentOrder = profileForm.mobileNavOrder?.length ? profileForm.mobileNavOrder : defaultOrder;
                                                            const order = [...currentOrder];
                                                            if (idx > 0) {
                                                                const temp = order[idx];
                                                                order[idx] = order[idx-1];
                                                                order[idx-1] = temp;
                                                                setProfileForm({...profileForm, mobileNavOrder: order});
                                                            }
                                                        }}
                                                        className="p-1 hover:bg-gray-100 rounded text-gray-500"
                                                        disabled={idx === 0}
                                                    >
                                                        <RefreshCw size={12} className="rotate-90"/>
                                                    </button>
                                                    <button 
                                                        type="button"
                                                        onClick={() => {
                                                            const defaultOrder = DEFAULT_MOBILE_NAV_ORDER;
                                                            const currentOrder = profileForm.mobileNavOrder?.length ? profileForm.mobileNavOrder : defaultOrder;
                                                            const order = [...currentOrder];
                                                            if (idx < order.length - 1) {
                                                                const temp = order[idx];
                                                                order[idx] = order[idx+1];
                                                                order[idx+1] = temp;
                                                                setProfileForm({...profileForm, mobileNavOrder: order});
                                                            }
                                                        }}
                                                        className="p-1 hover:bg-gray-100 rounded text-gray-500"
                                                        disabled={idx === (profileForm.mobileNavOrder?.length || 19) - 1}
                                                    >
                                                        <RefreshCw size={12} className="-rotate-90"/>
                                                    </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {canSeeNotifications && (
                            <label className="flex items-center gap-2 text-sm cursor-pointer bg-gray-50 p-3 rounded-lg">
                                <input type="checkbox" checked={profileForm.receiveNotifications} onChange={e => setProfileForm({...profileForm, receiveNotifications: e.target.checked})} className="w-4 h-4 text-blue-600 rounded" />
                                <span className="text-gray-700 dark:text-gray-300">دریافت پیام‌های اطلاع‌رسانی</span>
                            </label>
                        )}

                        <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition-all mt-2">ذخیره تغییرات</button>
                    </form>
                </div>
            </div>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className={`flex-shrink-0 hidden md:flex flex-col no-print relative h-screen sticky top-0 transition-all duration-300 z-[60] bg-white/70 dark:bg-gray-950/90 backdrop-blur-2xl border-l border-gray-200/50 dark:border-white/10 shadow-[4px_0_24px_rgba(0,0,0,0.02)] text-gray-800 dark:text-gray-100 ${isSidebarOpen ? 'w-64' : 'w-20'}`}>
          <div className="p-6 border-b border-gray-200/50 dark:border-white/10 flex items-center justify-between gap-3">
              <div className={`flex items-center gap-3 overflow-hidden ${!isSidebarOpen && 'hidden'}`}>
                  <div className="bg-blue-600 p-2 rounded-xl text-white shadow-lg shadow-blue-600/20"><FileText className="w-5 h-5" /></div>
                  <div className="whitespace-nowrap"><h1 className="text-base font-bold tracking-tight">{settings?.appName || 'سیستم مالی'}</h1><span className="text-[10px] text-gray-500 dark:text-gray-400 font-bold">پنل کاربری</span></div>
              </div>
              <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 bg-gray-100 dark:bg-gray-800/40 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700/60 rounded-xl transition-colors mx-auto">
                 <Menu size={20}/>
              </button>
          </div>
          
          <div className={`p-4 bg-white/50 dark:bg-gray-800/20 mx-4 mt-4 rounded-2xl flex items-center gap-3 border border-gray-100/50 dark:border-white/5 relative group cursor-pointer hover:glass-panel hover:shadow-sm transition-all ${!isSidebarOpen && 'justify-center mx-2 px-0'}`} onClick={() => setShowProfileModal(true)} title="تنظیمات کاربری">
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center overflow-hidden shrink-0 text-white shadow-md">
                 {currentUser.avatar ? <img src={resolveImageUrl(currentUser.avatar)} alt="" className="w-full h-full object-cover"/> : <span className="font-bold">{currentUser.fullName.charAt(0)}</span>}
              </div>
              {isSidebarOpen && (
                 <div className="overflow-hidden flex-1">
                     <p className="text-sm font-bold truncate text-gray-800 dark:text-gray-100">{currentUser.fullName}</p>
                     <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate font-bold bg-gray-100 dark:bg-gray-700/50 inline-block px-1.5 py-0.5 rounded mt-0.5">نقش: {currentUser.role}</p>
                 </div>
              )}
          </div>
          
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto custom-scrollbar">
              {navItems.map((item) => { 
                  const Icon = item.icon; 
                  const isActive = activeTab === item.id;
                  return (
                    <button 
                        key={item.id} 
                        onClick={() => setActiveTab(item.id)} 
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative ${isActive ? 'text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10'} ${!isSidebarOpen && 'justify-center'}`} 
                        title={item.label}
                    >
                        <div className="relative z-10 flex items-center justify-between w-full">
                            <div className="flex items-center gap-3">
                                <Icon size={20} className={isActive ? '' : 'group-hover:scale-110 transition-transform'} />
                                {isSidebarOpen && <span className="font-bold text-sm whitespace-nowrap">{item.label}</span>}
                            </div>
                            {item.id === 'chat' && unreadChatCount > 0 && isSidebarOpen && (
                                <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full min-w-[18px] text-center font-bold shadow-sm animate-pulse">{unreadChatCount}</span>
                            )}
                            {item.id === 'chat' && unreadChatCount > 0 && !isSidebarOpen && (
                                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-gray-900 animate-pulse"></span>
                            )}
                        </div>
                        {isActive && (
                            <motion.div
                                layoutId="desktopActiveTab"
                                className="absolute inset-0 bg-blue-600 rounded-xl shadow-lg shadow-blue-600/20"
                                transition={{ type: "spring", bounce: 0.35, duration: 0.6 }}
                            />
                        )}
                    </button>
                  ); 
              })}
              
              {canSeeNotifications && (
                  <div className="pt-4 mt-2 border-t border-gray-200/50 dark:border-white/5 relative" ref={notifRef}>
                      <button onClick={() => setShowNotifDropdown(!showNotifDropdown)} className={`notification-trigger w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm relative ${unreadCount > 0 ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 font-bold' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5'} ${!isSidebarOpen && 'justify-center'}`} title="اعلان‌ها">
                          <div className="relative">
                              <Bell size={20} />
                              {unreadCount > 0 && (<span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center border-2 border-white animate-bounce">{unreadCount}</span>)}
                          </div>
                          {isSidebarOpen && <span className="font-bold whitespace-nowrap">مرکز اعلان‌ها</span>}
                      </button>
                      {showNotifDropdown && <NotificationDropdown />}
                      
                      {!notifEnabled && isSidebarOpen && (
                          <button onClick={handleToggleNotif} className="mt-4 w-full flex items-center justify-center gap-2 px-3 py-3 rounded-xl text-xs bg-red-50 text-red-600 hover:bg-red-100 transition-all font-black border border-red-100">
                              <BellRing size={18} />
                              <span>فعال‌سازی نوتـیفـیکیشـن</span>
                          </button>
                      )}
                  </div>
              )}
          </nav>
          
          <div className="p-4 border-t border-gray-200/50 dark:border-white/10 flex flex-col gap-2">
              <button onClick={toggleTheme} className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors font-bold ${!isSidebarOpen && 'justify-center'}`} title="تغییر پوسته">
                  {theme === 'light' ? <Moon size={20} className="text-gray-600 dark:text-gray-400" /> : <Sun size={20} className="text-yellow-400" />}
                  {isSidebarOpen && <span className="whitespace-nowrap dark:text-gray-300">تغییر پوسته</span>}
              </button>
              <button onClick={handleLogout} className={`w-full flex items-center gap-3 px-3 py-2.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-colors font-bold ${!isSidebarOpen && 'justify-center'}`} title="خروج از سیستم">
                  <LogOut size={20} />
                  {isSidebarOpen && <span className="whitespace-nowrap">خروج از سیستم</span>}
              </button>
          </div>
      </aside>
      
      {/* Mobile Drawer */}
      {showMobileMenu && (
          <div className="fixed inset-0 z-[100] md:hidden animate-fade-in flex justify-end">
              <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={() => setShowMobileMenu(false)}></div>
              <div className="relative w-72 bg-white/90 backdrop-blur-2xl h-full shadow-2xl flex flex-col transform transition-transform border-l border-white/50 animate-slide-in-right">
                  {/* Header */}
                  <div className="p-6 border-b border-white/40 flex justify-between items-center bg-white/40">
                      <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold shadow-lg shadow-blue-500/30 border border-white">
                              {currentUser.fullName.charAt(0)}
                          </div>
                          <div>
                              <div className="font-black text-gray-800 text-sm">{currentUser.fullName}</div>
                              <div className="text-[10px] text-gray-500 font-bold bg-gray-100/50 px-2 rounded-full inline-block">{currentUser.role}</div>
                          </div>
                      </div>
                  </div>
                  
                  {/* Notification Toggle */}
                  {canSeeNotifications && !notifEnabled && (
                      <div className="px-5 mt-5">
                          <div className="bg-red-50/80 border border-red-100 p-3 rounded-2xl flex flex-col gap-2 shadow-sm backdrop-blur-md">
                              <div className="flex items-center gap-2 text-red-600 text-xs font-bold">
                                  <Bell size={16} />
                                  <span>اعلان‌ها غیرفعال است</span>
                              </div>
                              <button onClick={handleToggleNotif} className="bg-red-600 text-white w-full py-2 rounded-xl text-xs font-bold shadow-md hover:bg-red-700">
                                  فعال‌سازی (الزامی)
                              </button>
                          </div>
                      </div>
                  )}

                  {/* Settings User Shortcut */}
                  <div className="px-5 mt-4">
                      <button onClick={() => { setShowMobileMenu(false); setShowProfileModal(true); }} className="w-full flex items-center gap-3 p-3 bg-white/60 hover:bg-white/90 rounded-2xl border border-white shadow-sm transition-colors text-gray-700 font-bold text-xs">
                          <Settings size={18} className="text-gray-500"/> تنظیمات پروفایل
                      </button>
                  </div>

                  {/* List Menu */}
                  <div className="p-3 flex-1 overflow-y-auto custom-scrollbar mt-2">
                      <div className="space-y-1">
                          {navItems.map((item) => {
                              const Icon = item.icon;
                              const isActive = activeTab === item.id;
                              return (
                                  <button 
                                    key={item.id} 
                                    onClick={() => { setActiveTab(item.id); setShowMobileMenu(false); }}
                                    className={`w-full flex items-center justify-between p-3 rounded-2xl transition-all ${isActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-gray-600 hover:bg-white/80'}`}
                                  >
                                      <div className="flex items-center gap-3">
                                          <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                                          <span className="text-xs font-bold">{item.label}</span>
                                      </div>
                                      {item.id === 'chat' && unreadChatCount > 0 && (
                                          <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full min-w-[18px] text-center font-bold shadow-sm">{unreadChatCount}</span>
                                      )}
                                  </button>
                              );
                          })}
                      </div>
                  </div>
                  
                  <div className="p-5 border-t border-white/50 dark:border-white/10 bg-white/40 dark:bg-black/20 flex flex-col gap-2">
                      <button onClick={toggleTheme} className="w-full p-3 bg-white/60 dark:bg-white/10 text-gray-700 dark:text-gray-300 rounded-2xl border border-white dark:border-white/5 font-bold text-sm hover:bg-white/80 dark:hover:bg-white/20 transition-colors flex items-center justify-center gap-2 shadow-sm">
                          {theme === 'light' ? <Moon size={18}/> : <Sun size={18} className="text-yellow-400"/>} تغییر پوسته
                      </button>
                      <button onClick={handleLogout} className="w-full p-3 bg-white/60 dark:bg-white/10 text-red-600 dark:text-red-400 rounded-2xl border border-white dark:border-white/5 font-bold text-sm hover:bg-red-50 dark:hover:bg-red-500/20 transition-colors flex items-center justify-center gap-2 shadow-sm">
                          <LogOut size={18}/> خروج از سیستم
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Mobile Bottom Navigation - Attractive Float Pill */}
      <AnimatePresence>
        {activeTab === 'dashboard' && (
          <motion.div 
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="bottom-nav-bar md:hidden fixed z-[90] bottom-6 left-6 right-6 glass-panel border border-white/40 dark:border-white/10 flex justify-around items-center p-2.5 shadow-[0_8px_32px_rgba(0,0,0,0.15)] rounded-[2.5rem] backdrop-blur-3xl"
          >
              {bottomVisibleItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                      <button 
                          key={item.id}
                          onClick={() => setActiveTab(item.id)} 
                          className={`flex flex-col items-center gap-0.5 p-1 transition-all duration-300 flex-1 relative ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`}
                      >
                          <div className={`p-2 rounded-2xl transition-all duration-300 ${isActive ? 'bg-blue-100/50 dark:bg-blue-900/30 ring-1 ring-blue-200 dark:ring-blue-800' : 'active:scale-95'}`}>
                              <Icon size={22} strokeWidth={isActive ? 2.5 : 2} className={isActive ? 'animate-pulse-subtle' : ''}/>
                              {item.id === 'chat' && unreadChatCount > 0 && (
                                <span className="absolute top-1.5 right-1/4 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-gray-950 shadow-sm"></span>
                              )}
                          </div>
                          <span className={`text-[10px] font-black tracking-tight transition-all duration-300 mt-1 ${isActive ? 'text-blue-600' : 'text-gray-500'}`}>{item.label}</span>
                          {isActive && <motion.div layoutId="bottomNavDot" className="absolute -bottom-1 w-1 h-1 bg-blue-600 rounded-full" />}
                      </button>
                  );
              })}
              
              {hasMore && (
                  <button 
                      onClick={() => setShowMobileMenu(true)} 
                      className={`flex flex-col items-center gap-0.5 p-1 transition-all duration-300 flex-1 relative ${menuItems.some(m => m.id === activeTab) ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`}
                  >
                      <div className={`p-2 rounded-2xl transition-all duration-300 ${menuItems.some(m => m.id === activeTab) ? 'bg-blue-100/50 dark:bg-blue-900/30 ring-1 ring-blue-200 dark:ring-blue-800' : 'active:scale-95'}`}>
                          <Menu size={22} strokeWidth={menuItems.some(m => m.id === activeTab) ? 2.5 : 2} />
                          {menuItems.some(m => m.id === 'chat' && unreadChatCount > 0) && (
                            <span className="absolute top-1.5 right-1/4 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-gray-950 shadow-sm"></span>
                          )}
                      </div>
                      <span className={`text-[10px] font-black tracking-tight transition-all duration-300 mt-1 ${menuItems.some(m => m.id === activeTab) ? 'text-blue-600' : 'text-gray-500'}`}>بیشتر</span>
                  </button>
              )}
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex flex-1 flex-col overflow-hidden relative min-w-0 min-h-0">
      {/* Mobile Header */}
        <header className="glass-header p-4 md:hidden no-print flex items-center justify-between shrink-0 relative z-[60] safe-pt py-3 sticky top-0 shadow-lg rounded-b-[2rem]">
            <div className="flex items-center gap-3">
                {activeTab === 'dashboard' ? (
                <button 
                    onClick={() => setActiveTab('dashboard')} 
                    className="flex items-center gap-3 transition-all active:scale-95"
                >
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-xl border-2 border-white/50 rotate-3 transition-transform hover:rotate-0">
                        {currentUser.avatar ? <img src={resolveImageUrl(currentUser.avatar)} alt="" className="w-full h-full object-cover rounded-2xl"/> : currentUser.fullName.charAt(0)}
                    </div>
                </button>
                ) : (
                <button 
                    onClick={onBack} 
                    className="flex items-center justify-center w-10 h-10 bg-white/50 dark:bg-gray-800/50 backdrop-blur-md rounded-2xl shadow-sm border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-200 active:scale-95 transition-all"
                >
                    <ChevronRight size={24} />
                </button>
                )}
                <div>
                   <h1 className="font-black text-gray-800 dark:text-gray-100 text-sm tracking-tight">{navItems.find(i => i.id === activeTab)?.label || 'داشبورد'}</h1>
                </div>
            </div>
            <div className="flex items-center gap-2">
                {financialYear && setFinancialYear && (
                    <select 
                        value={financialYear} 
                        onChange={(e) => setFinancialYear(e.target.value)}
                        className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-md border border-gray-200/50 dark:border-white/10 text-gray-700 dark:text-gray-200 font-bold rounded-xl text-xs px-2 py-2 mr-2 shadow-sm"
                        dir="ltr"
                    >
                        {settings?.fiscalYears?.map(fy => (
                            <option key={fy.id} value={fy.label} className="bg-white dark:bg-gray-800">{fy.label}</option>
                        )) || <>
                            <option value="1402">1402</option>
                            <option value="1403">1403</option>
                            <option value="1404">1404</option>
                            <option value="1405">1405</option>
                        </>
                        }
                    </select>
                )}
                <button 
                  onClick={toggleTheme}
                  className="p-2.5 bg-white/50 dark:bg-gray-800/50 backdrop-blur-md border border-gray-200/50 dark:border-white/10 rounded-xl text-gray-700 dark:text-gray-300 shadow-sm"
                >
                    {theme === 'light' ? <Moon size={20} /> : <Sun size={20} className="text-yellow-400" />}
                </button>
                {canSeeNotifications && (
                    <div className="relative notification-trigger" ref={mobileNotifRef}>
                        <button onClick={() => setShowNotifDropdown(!showNotifDropdown)} className="relative p-2.5 bg-white/50 dark:bg-gray-800/50 backdrop-blur-md border border-gray-200/50 dark:border-white/10 rounded-xl hover:glass-panel transition-colors shadow-sm">
                            <Bell size={20} className="text-gray-700 dark:text-gray-200" />
                            {unreadCount > 0 && <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>}
                        </button>
                        {showNotifDropdown && <NotificationDropdown />}
                    </div>
                )}
            </div>
        </header>
        
        <div className={`flex-1 ${activeTab === 'chat' ? 'flex flex-col overflow-hidden pb-0 min-h-0' : `overflow-y-auto ${activeTab === 'dashboard' ? 'pb-[calc(140px+env(safe-area-inset-bottom))]' : 'pb-[calc(80px+env(safe-area-inset-bottom))]'}`} bg-transparent md:pb-0 min-w-0 ${isUpdateAvailable ? 'pt-12' : ''} custom-scrollbar`} id="main-scroll-container">
                    <div className={`${activeTab === 'chat' ? 'hidden' : 'hidden md:flex'} justify-end p-4 bg-transparent border-b border-gray-200/50 dark:border-white/10 z-40 shadow-sm no-print items-center glass-header`}>
                <span className="font-bold text-gray-600 dark:text-gray-300 mr-3 text-sm">سال مالی:</span>
                {settings?.fiscalYears && (
                    <select 
                        value={settings.activeFiscalYearId || ''} 
                        onChange={async (e) => {
                            const newYearId = e.target.value;
                            const newSettings = { ...settings, activeFiscalYearId: newYearId };
                            await saveSettings(newSettings);
                            // Force reload to apply new context globally
                            window.location.reload(); 
                        }}
                        className="bg-blue-50 text-blue-800 font-black border-2 border-blue-200 outline-none rounded-xl px-4 py-2 hover:bg-blue-100 transition-colors cursor-pointer"
                        dir="ltr"
                    >
                        {settings.fiscalYears.map(fy => (
                            <option key={fy.id} value={fy.id}>{fy.label} سال مالی</option>
                        ))}
                    </select>
                )}
            </div>
            <div className={`${activeTab === 'chat' ? 'p-0 w-full flex-1 flex flex-col min-h-0' : 'p-4 md:p-8 max-w-7xl w-full min-h-full'} mx-auto min-w-0`}>
                {children}
            </div>
        </div>
      </main>
    </div>
  );
};

export default Layout;
