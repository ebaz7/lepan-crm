import React, { useState, useEffect, useRef } from 'react';
import { LayoutDashboard, PlusCircle, ListChecks, FileText, Users, LogOut, User as UserIcon, Settings, Bell, BellOff, MessageSquare, X, Container, Shield, RefreshCw, Menu, ChevronRight } from 'lucide-react';
import { User, UserRole, AppNotification, SystemSettings } from '../types';
import { logout, hasPermission, getRolePermissions, updateUser } from '../services/authService';
import { requestNotificationPermission, setNotificationPreference, isNotificationEnabledInApp } from '../services/notificationService';
import { getSettings, uploadFile } from '../services/storageService';
import { apiCall } from '../services/apiService';
import { Capacitor } from '@capacitor/core';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  currentUser: User;
  onLogout: () => void;
  notifications: AppNotification[];
  clearNotifications: () => void;
  onAddNotification: (title: string, message: string) => void;
  onRemoveNotification: (id: string) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab, currentUser, onLogout, notifications, clearNotifications, onAddNotification, onRemoveNotification }) => {
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const isSecure = window.isSecureContext;
  const notifRef = useRef<HTMLDivElement>(null);
  const mobileNotifRef = useRef<HTMLDivElement>(null);
  
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  
  const [profileForm, setProfileForm] = useState({
      password: '',
      confirmPassword: '',
      telegramChatId: '',
      phoneNumber: '',
      receiveNotifications: true
  });

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [serverVersion, setServerVersion] = useState<string | null>(null);
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);

  useEffect(() => {
    if (showProfileModal && currentUser) {
        setProfileForm({
            password: '',
            confirmPassword: '',
            telegramChatId: currentUser.telegramChatId || '',
            phoneNumber: currentUser.phoneNumber || '',
            receiveNotifications: currentUser.receiveNotifications !== false 
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
    });
    
    const handleClickOutside = (event: MouseEvent) => { 
        const target = event.target as Element;
        if (showNotifDropdown && !target.closest('.notification-dropdown-container') && !target.closest('.notification-trigger')) {
            setShowNotifDropdown(false);
        }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showNotifDropdown]);

  const handleLogout = () => { logout(); onLogout(); };
  
  const handleToggleNotif = async () => { 
      if (notifEnabled) { setNotifEnabled(false); setNotificationPreference(false); return; } 
      try {
          const granted = await requestNotificationPermission(); 
          if (granted) { setNotifEnabled(true); setNotificationPreference(true); onAddNotification("سیستم دستور پرداخت", "نوتیفیکیشن‌ها با موفقیت فعال شدند."); }
      } catch (err) {}
  };

  const handleUpdateProfile = async (e: React.FormEvent) => { 
      e.preventDefault(); 
      const updates: Partial<User> = {}; 
      if (profileForm.password) { 
          if (profileForm.password !== profileForm.confirmPassword) { alert('رمز عبور و تکرار آن مطابقت ندارند.'); return; } 
          updates.password = profileForm.password; 
      } 
      updates.telegramChatId = profileForm.telegramChatId;
      updates.phoneNumber = profileForm.phoneNumber;
      updates.receiveNotifications = profileForm.receiveNotifications;
      try { await updateUser({ ...currentUser, ...updates }); alert('اطلاعات با موفقیت بروزرسانی شد.'); setShowProfileModal(false); window.location.reload(); } catch (err) { alert('خطا در بروزرسانی اطلاعات'); } 
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
  const perms = settings ? getRolePermissions(currentUser.role, settings, currentUser) : { canCreatePaymentOrder: false, canViewPaymentOrders: false };
  
  const canCreatePayment = perms.canCreatePaymentOrder === true;
  const canViewPayment = perms.canViewPaymentOrders === true;
  const canSeeTrade = perms.canManageTrade === true;
  const canSeeSettings = currentUser.role === UserRole.ADMIN || perms.canManageSettings === true;
  const canSeeSecurity = currentUser.role === UserRole.ADMIN || perms.canViewSecurity === true;

  const navItems = [
    { id: 'dashboard', label: 'داشبورد', icon: LayoutDashboard },
  ];
  if (canCreatePayment) navItems.push({ id: 'create', label: 'ثبت پرداخت', icon: PlusCircle });
  if (canViewPayment) navItems.push({ id: 'manage', label: 'سوابق پرداخت', icon: ListChecks });
  if (canSeeSecurity) navItems.push({ id: 'security', label: 'انتظامات', icon: Shield });
  navItems.push({ id: 'chat', label: 'گفتگو', icon: MessageSquare });
  if (canSeeTrade) navItems.push({ id: 'trade', label: 'بازرگانی', icon: Container });
  if (hasPermission(currentUser, 'manage_users')) navItems.push({ id: 'users', label: 'کاربران', icon: Users });
  if (canSeeSettings) navItems.push({ id: 'settings', label: 'تنظیمات', icon: Settings });

  const bottomNavItems = [
      { id: 'dashboard', label: 'خانه', icon: LayoutDashboard },
      { id: 'create', label: 'ثبت', icon: PlusCircle, show: canCreatePayment },
      { id: 'manage', label: 'کارتابل', icon: ListChecks, show: canViewPayment },
      { id: 'chat', label: 'گفتگو', icon: MessageSquare },
  ].filter(i => i.show !== false);

  const NotificationDropdown = () => ( 
    <div className="notification-dropdown-container fixed top-16 left-4 right-4 md:absolute md:top-auto md:bottom-16 md:left-2 md:right-auto md:w-80 bg-white rounded-xl shadow-2xl border border-gray-200 text-gray-800 z-[9999] overflow-hidden flex flex-col">
        <div className="bg-blue-50 p-3 flex justify-between items-center border-b shrink-0">
            <span className="text-xs font-bold text-blue-800">وضعیت اعلان‌ها</span>
            <button onClick={handleToggleNotif} className={`px-3 py-1 rounded-md text-[10px] font-bold ${notifEnabled ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {notifEnabled ? 'فعال' : 'غیرفعال'}
            </button>
        </div>
        <div className="overflow-y-auto flex-1 max-h-[40vh]">
            {notifications.length === 0 ? (
                <div className="p-6 text-center text-xs text-gray-400">پیامی نیست</div>
            ) : (
                notifications.map(n => (
                    <div key={n.id} className="p-3 border-b hover:bg-gray-50 text-right last:border-0 relative">
                        <div className="text-xs font-bold text-gray-800 mb-1">{n.title}</div>
                        <div className="text-[10px] text-gray-600 leading-tight">{n.message}</div>
                        <button onClick={(e) => { e.stopPropagation(); onRemoveNotification(n.id); }} className="absolute top-2 left-2 text-gray-300 hover:text-red-500"><X size={12}/></button>
                    </div>
                ))
            )}
        </div>
    </div> 
  );

  return (
    <div className="flex min-h-[100dvh] bg-gray-50 text-gray-800 font-sans relative">
      {isUpdateAvailable && (<div className="fixed top-0 left-0 right-0 bg-blue-600 text-white z-[9999] p-3 text-center shadow-lg animate-slide-down flex justify-center items-center gap-4"><span className="font-bold text-sm">نسخه جدید نرم‌افزار در دسترس است!</span><button onClick={handleReload} className="bg-white text-blue-600 px-4 py-1 rounded-full text-xs font-bold hover:bg-blue-50">بروزرسانی</button></div>)}
      
      {showProfileModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 flex flex-col items-center justify-center text-white relative">
                    <button onClick={() => setShowProfileModal(false)} className="absolute top-4 right-4 text-white/70 hover:text-white"><X size={20}/></button>
                    <div className="w-20 h-20 rounded-full bg-white/20 border-4 border-white/30 overflow-hidden mb-3">
                        {currentUser.avatar ? <img src={currentUser.avatar} alt="" className="w-full h-full object-cover" /> : <UserIcon size={40} className="w-full h-full p-4" />}
                    </div>
                    <h3 className="text-lg font-bold">{currentUser.fullName}</h3>
                </div>
                <div className="p-6">
                    <form onSubmit={handleUpdateProfile} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1"><label className="text-xs font-bold text-gray-500">رمز عبور جدید</label><input type="password" value={profileForm.password} onChange={e => setProfileForm({...profileForm, password: e.target.value})} className="w-full border rounded-lg p-2 text-sm"/></div>
                            <div className="space-y-1"><label className="text-xs font-bold text-gray-500">تکرار رمز</label><input type="password" value={profileForm.confirmPassword} onChange={e => setProfileForm({...profileForm, confirmPassword: e.target.value})} className="w-full border rounded-lg p-2 text-sm"/></div>
                        </div>
                        <div className="space-y-1"><label className="text-xs font-bold text-gray-500">موبایل</label><input type="tel" value={profileForm.phoneNumber} onChange={e => setProfileForm({...profileForm, phoneNumber: e.target.value})} className="w-full border rounded-lg p-2 text-sm dir-ltr"/></div>
                        <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 mt-2">ذخیره تغییرات</button>
                    </form>
                </div>
            </div>
        </div>
      )}

      <aside className="w-64 bg-slate-800 text-white flex-shrink-0 hidden md:flex flex-col no-print shadow-xl sticky top-0 h-screen">
          <div className="p-6 border-b border-slate-700 flex items-center gap-3"><FileText className="w-6 h-6 text-blue-500" /><h1 className="text-lg font-bold">سیستم مالی</h1></div>
          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
              {navItems.map((item) => { const Icon = item.icon; return (<button key={item.id} onClick={() => setActiveTab(item.id)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === item.id ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-300 hover:bg-slate-700'}`}><Icon size={20} /><span className="font-medium text-sm">{item.label}</span></button>); })}
              <div className="pt-4 mt-2 border-t border-slate-700 relative" ref={notifRef}>
                  <button onClick={() => setShowNotifDropdown(!showNotifDropdown)} className={`notification-trigger w-full flex items-center gap-3 px-4 py-2 rounded-lg transition-colors text-sm relative ${unreadCount > 0 ? 'text-white bg-slate-700' : 'text-slate-400 hover:bg-slate-700'}`}><div className="relative"><Bell size={18} />{unreadCount > 0 && (<span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">{unreadCount}</span>)}</div><span>اعلان‌ها</span></button>
                  {showNotifDropdown && <NotificationDropdown />}
              </div>
          </nav>
          <div className="p-4 border-t border-slate-700"><button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-2 text-red-400 hover:bg-slate-700 rounded-lg transition-colors"><LogOut size={20} /><span>خروج</span></button></div>
      </aside>
      
      {showMobileMenu && (
          <div className="fixed inset-0 z-[60] md:hidden animate-fade-in">
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowMobileMenu(false)}></div>
              <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-[2rem] max-h-[80vh] overflow-y-auto animate-slide-up pb-8 shadow-2xl flex flex-col p-5">
                  <div className="grid grid-cols-3 gap-3">
                      {navItems.map((item) => { const Icon = item.icon; return (<button key={item.id} onClick={() => { setActiveTab(item.id); setShowMobileMenu(false); }} className={`flex flex-col items-center justify-center gap-2 p-3 rounded-2xl border aspect-square ${activeTab === item.id ? 'bg-blue-600 text-white border-blue-600 shadow-lg' : 'bg-gray-50 text-gray-600 border-gray-100'}`}><Icon size={24} /><span className="text-[10px] font-bold text-center">{item.label}</span></button>); })}
                  </div>
              </div>
          </div>
      )}

      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-200 flex justify-around items-center py-2 pb-safe z-50 shadow-lg">
        {bottomNavItems.map((item) => { const Icon = item.icon; return (<button key={item.id} onClick={() => setActiveTab(item.id)} className={`flex flex-col items-center gap-1 p-2 ${activeTab === item.id ? 'text-blue-600' : 'text-gray-400'}`}><Icon size={24} /><span className="text-[10px] font-bold">{item.label}</span></button>); })}
        <button onClick={() => setShowMobileMenu(true)} className="flex flex-col items-center gap-1 p-2 text-gray-400"><Menu size={24} /><span className="text-[10px] font-bold">بیشتر</span></button>
      </div>

      <main className="flex-1 flex flex-col h-[100dvh] overflow-hidden relative">
        <header className="bg-white shadow-sm p-4 md:hidden no-print flex items-center justify-between shrink-0 safe-pt sticky top-0 z-40">
            <div className="flex items-center gap-3">
                {activeTab !== 'dashboard' && (<button onClick={() => setActiveTab('dashboard')} className="p-2 -ml-2 text-gray-600"><ChevronRight size={24} /></button>)}
                <h1 className="font-black text-gray-800 text-sm">{navItems.find(i => i.id === activeTab)?.label || 'سیستم مالی'}</h1>
            </div>
            <div className="relative notification-trigger" ref={mobileNotifRef}>
                <button onClick={() => setShowNotifDropdown(!showNotifDropdown)} className="relative p-2 bg-gray-50 rounded-xl">
                    <Bell size={20} className="text-gray-600" />
                    {unreadCount > 0 && <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>}
                </button>
                {showNotifDropdown && <NotificationDropdown />}
            </div>
        </header>
        <div className="flex-1 overflow-y-auto bg-gray-50 p-4 md:p-8 max-w-7xl mx-auto w-full">
            {children}
        </div>
      </main>
    </div>
  );
};
export default Layout;
