
import React, { useState, useEffect, useRef, useMemo } from 'react';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import CreateOrder from './components/CreateOrder';
import ManageOrders from './components/ManageOrders';
import Login from './components/Login';
import ManageUsers from './components/ManageUsers';
import Settings from './components/Settings';
import ChatRoom from './components/ChatRoom';
import TradeModule from './components/TradeModule';
import CreateExitPermit from './components/CreateExitPermit'; 
import ManageExitPermits from './components/ManageExitPermits'; 
import WarehouseModule from './components/WarehouseModule';
import SecurityModule from './components/SecurityModule'; 
import MeetingModule from './components/MeetingModule';
import PurchaseModule from './components/PurchaseModule';
import PrintVoucher from './components/PrintVoucher';
import NotificationController from './components/NotificationController'; 
import SalesCRMModule from './components/SalesCRMModule';
import ProductsModule from './components/ProductsModule';
import { Tickets } from './components/Tickets';
import KnowledgeBaseModule from './components/KnowledgeBaseModule';
import { getOrders, getSettings, getMessages, saveSettings, getSystemAnnouncements } from './services/storageService'; 
import { getCurrentUser, getUsers } from './services/authService';
import { PaymentOrder, User, OrderStatus, UserRole, AppNotification, SystemSettings, PaymentMethod, ChatMessage, SystemAnnouncement } from './types';
import { Loader2, Bell, X } from 'lucide-react';
import { generateUUID, parsePersianDate, formatCurrency } from './constants';
import { apiCall, getLocalData, LS_KEYS } from './services/apiService'; 
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app'; 
import { PushNotifications } from '@capacitor/push-notifications'; 
import { sendNotification } from './services/notificationService';

function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [settings, setSettings] = useState<SystemSettings | undefined>(undefined);
  const [activeTab, setActiveTabState] = useState('dashboard');
  const [tabHistory, setTabHistory] = useState<string[]>(['dashboard']);

  const changeTab = (tab: string, addToHistory = true) => {
      setActiveTabState(tab);
      if (addToHistory && tab !== tabHistory[tabHistory.length - 1]) {
          setTabHistory(prev => [...prev.slice(-9), tab]); // Keep last 10 steps
      }
  };
  const [financialYear, setFinancialYearState] = useState<string>(new Date().toLocaleDateString('fa-IR-u-nu-latn').split('/')[0]);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        setTheme('dark');
        document.documentElement.classList.add('dark');
    } else {
        setTheme('light');
        document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleTheme = () => {
      const newTheme = theme === 'light' ? 'dark' : 'light';
      setTheme(newTheme);
      localStorage.setItem('theme', newTheme);
      if (newTheme === 'dark') {
          document.documentElement.classList.add('dark');
      } else {
          document.documentElement.classList.remove('dark');
      }
  };
  const [orders, setOrders] = useState<PaymentOrder[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]); 
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [manageOrdersInitialTab, setManageOrdersInitialTab] = useState<'current' | 'archive'>('current');
  const [dashboardStatusFilter, setDashboardStatusFilter] = useState<any>(null); 
  const [exitPermitStatusFilter, setExitPermitStatusFilter] = useState<'pending' | null>(null);

  const [toast, setToast] = useState<{show: boolean, title: string, message: string} | null>(null);
  const toastTimeoutRef = useRef<any>(null);

  const [backgroundJobs, setBackgroundJobs] = useState<{order: PaymentOrder, type: 'create' | 'approve'}[]>([]);
  const processingJobRef = useRef(false);

  const isSyncingRef = useRef(false);
  const isFirstLoad = useRef(true);
  const idleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const IDLE_LIMIT = 60 * 60 * 1000; 
  const NOTIFICATION_CHECK_KEY = 'last_notification_check';
  
  const lastChatMsgIdRef = useRef<string | null>(null);
  const isNative = Capacitor.isNativePlatform();

  const safePushState = (state: any, title: string, url?: string) => { 
      if (isNative) return; 
      try { if (url) window.history.pushState(state, title, url); else window.history.pushState(state, title); } catch (e) { try { window.history.pushState(state, title); } catch(e2) {} } 
  };
  const safeReplaceState = (state: any, title: string, url?: string) => { 
      if (isNative) return; 
      try { if (url) window.history.replaceState(state, title, url); else window.history.replaceState(state, title); } catch (e) { try { window.history.replaceState(state, title); } catch(e2) {} } 
  };
  
  const setActiveTab = (tab: string, addToHistory = true) => { 
      setActiveTabState(tab); 
      if (addToHistory) {
          safePushState({ tab }, '', `#${tab}`); 
          if (tab !== tabHistory[tabHistory.length - 1]) {
              setTabHistory(prev => [...prev.slice(-9), tab]);
          }
      }
  };

  useEffect(() => {
    if (isNative) {
        let backListener: any;
        try {
            CapacitorApp.addListener('backButton', ({ canGoBack }) => {
                if (tabHistory.length > 1) {
                    const newHistory = [...tabHistory];
                    newHistory.pop(); // remove current
                    const prevTab = newHistory[newHistory.length - 1];
                    setTabHistory(newHistory);
                    setActiveTab(prevTab, false);
                } else if (activeTab !== 'dashboard') {
                    setActiveTab('dashboard');
                } else if (!canGoBack) {
                    CapacitorApp.exitApp();
                }
            }).then(l => { backListener = l; });
        } catch(e) { console.error("Back button listener error", e); }
        
        try {
            PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
                const data = notification.notification.data;
                if (data && data.url) {
                    const target = data.url.replace('#', '');
                    setActiveTab(target);
                }
            });
        } catch(e) { console.error("Push Listener Error", e); }
    }
  }, []);

  useEffect(() => {
      const handleJob = (e: CustomEvent) => { setBackgroundJobs(prev => [...prev, e.detail]); };
      window.addEventListener('QUEUE_WHATSAPP_JOB' as any, handleJob);
      return () => window.removeEventListener('QUEUE_WHATSAPP_JOB' as any, handleJob);
  }, []);

  useEffect(() => { if (backgroundJobs.length > 0 && !processingJobRef.current) { processNextJob(); } }, [backgroundJobs]);

  const processNextJob = async () => {
      processingJobRef.current = true;
      const job = backgroundJobs[0];
      const { order, type } = job;
      await new Promise(resolve => setTimeout(resolve, 1500));
      const element = document.getElementById(`bg-print-voucher-${order.id}`);
      if (element) {
          try {
              // @ts-ignore
              const canvas = await window.html2canvas(element, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
              const base64 = canvas.toDataURL('image/png').split(',')[1];
              const usersList = await getUsers();
              let targetUser: User | undefined;
              let caption = '';
              const mode = settings?.botPaymentNotificationMode || 'step_by_step';
              
              if (type === 'create') {
                  targetUser = usersList.find(u => u.role === UserRole.FINANCIAL && u.phoneNumber);
                  caption = `📢 *درخواست پرداخت جدید*\nشماره: ${order.trackingNumber}\nمبلغ: ${formatCurrency(order.totalAmount)}\nدرخواست کننده: ${order.requester}\n\nلطفا بررسی نمایید.`;
              } else if (type === 'approve') {
                  const isFinal = order.status === OrderStatus.APPROVED_CEO || order.status === OrderStatus.PAID;
                  
                  if (mode === 'after_submit') {
                      processingJobRef.current = false;
                      setBackgroundJobs(prev => prev.slice(1));
                      return;
                  }
                  if (mode === 'after_final' && !isFinal) {
                      processingJobRef.current = false;
                      setBackgroundJobs(prev => prev.slice(1));
                      return;
                  }

                  if (order.status === OrderStatus.APPROVED_FINANCE) { targetUser = usersList.find(u => u.role === UserRole.MANAGER && u.phoneNumber); caption = `✅ *تایید مالی انجام شد*\nشماره: ${order.trackingNumber}\nمنتظر تایید مدیریت.`; }
                  else if (order.status === OrderStatus.APPROVED_MANAGER) { targetUser = usersList.find(u => u.role === UserRole.CEO && u.phoneNumber); caption = `✅ *تایید مدیریت انجام شد*\nشماره: ${order.trackingNumber}\nمنتظر تایید نهایی مدیرعامل.`; }
                  else if (order.status === OrderStatus.APPROVED_CEO) { targetUser = usersList.find(u => u.role === UserRole.FINANCIAL && u.phoneNumber); caption = `💰 *دستور پرداخت تایید نهایی شد*\nشماره: ${order.trackingNumber}\nلطفا پرداخت نمایید.`; }
              }
              if (targetUser && targetUser.phoneNumber) {
                  await apiCall('/send-whatsapp', 'POST', { number: targetUser.phoneNumber, message: caption, mediaData: { data: base64, mimeType: 'image/png', filename: `Order_${order.trackingNumber}.png` } });
              }
          } catch (e) { console.error("Background Job Failed", e); }
      }
      setBackgroundJobs(prev => prev.slice(1));
      processingJobRef.current = false;
  };

  useEffect(() => {
    if (isNative) return; 
    const hash = window.location.hash.replace('#', '');
    if (hash && ['dashboard', 'create', 'manage', 'chat', 'trade', 'users', 'settings', 'create-exit', 'manage-exit', 'manage-invoices', 'warehouse', 'security', 'purchase'].includes(hash)) {
        setActiveTabState(hash); safeReplaceState({ tab: hash }, '', `#${hash}`);
    } else { safeReplaceState({ tab: 'dashboard' }, '', '#dashboard'); }
    const handlePopState = (event: PopStateEvent) => { if (event.state && event.state.tab) setActiveTabState(event.state.tab); else setActiveTabState('dashboard'); };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => { const user = getCurrentUser(); if (user) setCurrentUser(user); }, []);

  useEffect(() => {
    const handleTabChange = (e: any) => {
        if (e.detail) setActiveTab(e.detail);
    };
    const handleOpenNotes = () => setActiveTab('notes');
    window.addEventListener('CHANGE_TAB' as any, handleTabChange);
    window.addEventListener('OPEN_NOTES_TAB' as any, handleOpenNotes);
    return () => {
        window.removeEventListener('CHANGE_TAB' as any, handleTabChange);
        window.removeEventListener('OPEN_NOTES_TAB' as any, handleOpenNotes);
    };
  }, []);

  const handleLogout = () => { setCurrentUser(null); isFirstLoad.current = true; if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current); };

  useEffect(() => {
    if (settings) {
        // Meta Updates
        if (settings.appName) {
            document.title = settings.appName;
            const appleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
            if (appleTitle) appleTitle.setAttribute('content', settings.appName);
        }

        // Dynamic Manifest
        const manifest = {
            name: settings.appName || "Payment & Order System",
            short_name: settings.appName || "FinanceApp",
            start_url: "/",
            display: "standalone",
            background_color: "#ffffff",
            theme_color: "#2563eb",
            orientation: "portrait",
            icons: [
                {
                    src: settings.pwaIcon || "https://cdn-icons-png.flaticon.com/512/3135/3135706.png",
                    sizes: "192x192",
                    type: "image/png"
                },
                {
                    src: settings.pwaIcon || "https://cdn-icons-png.flaticon.com/512/3135/3135706.png",
                    sizes: "512x512",
                    type: "image/png"
                }
            ]
        };

        const stringManifest = JSON.stringify(manifest);
        const blob = new Blob([stringManifest], {type: 'application/json'});
        const manifestURL = URL.createObjectURL(blob);
        
        let link = document.querySelector('link[rel="manifest"]');
        if (!link) {
            link = document.createElement('link');
            // @ts-ignore
            link.rel = 'manifest';
            document.head.appendChild(link);
        }
        link.setAttribute('href', manifestURL);

        // Apple Touch Icon
        let appleIcon = document.querySelector('link[rel="apple-touch-icon"]');
        if (!appleIcon) {
            appleIcon = document.createElement('link');
            // @ts-ignore
            appleIcon.rel = 'apple-touch-icon';
            document.head.appendChild(appleIcon);
        }
        if (settings.pwaIcon) appleIcon.setAttribute('href', settings.pwaIcon);
    }
  }, [settings]);

  useEffect(() => {
    if (currentUser) {
        const resetIdleTimer = () => {
            if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
            idleTimeoutRef.current = setTimeout(() => { handleLogout(); alert("به دلیل عدم فعالیت به مدت ۱ ساعت، از سیستم خارج شدید."); }, IDLE_LIMIT);
        };
        const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
        events.forEach(event => window.addEventListener(event, resetIdleTimer));
        resetIdleTimer();
        return () => { events.forEach(event => window.removeEventListener(event, resetIdleTimer)); if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current); };
    }
  }, [currentUser]);

  const playNotificationSound = () => { 
      try { 
          // Offline-safe beep sound (Base64)
          const beep = "data:audio/wav;base64,UklGRl9vT1dAVEfmt"; 
          const audio = new Audio(beep); 
          audio.volume = 1.0; 
          audio.play().catch(e => console.log("Audio blocked")); 
      } catch (e) { } 
  };

  const addAppNotification = (title: string, message: string) => { 
      setNotifications(prev => [{ id: generateUUID(), title, message, timestamp: Date.now(), read: false }, ...prev]); 
      playNotificationSound();
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      setToast({ show: true, title, message });
      toastTimeoutRef.current = setTimeout(() => setToast(null), 5000);
      sendNotification(title, message);
  };

  const removeNotification = (id: string) => { setNotifications(prev => prev.filter(n => n.id !== id)); };
  const closeToast = () => { setToast(null); if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current); };

  const setFinancialYear = async (yearLabel: string) => {
      setFinancialYearState(yearLabel);
      if (settings && settings.fiscalYears) {
          const year = settings.fiscalYears.find(y => y.label === yearLabel);
          if (year && year.id !== settings.activeFiscalYearId) {
              const updated = { ...settings, activeFiscalYearId: year.id };
              await saveSettings(updated);
              setSettings(updated);
          }
      }
  };

  const loadData = async (silent = false) => {
    if (!currentUser || isSyncingRef.current) return;
    isSyncingRef.current = true;
    
    if (!silent && isFirstLoad.current) {
        const cachedOrders = getLocalData<PaymentOrder[]>(LS_KEYS.ORDERS, []);
        const cachedSettings = getLocalData<SystemSettings>(LS_KEYS.SETTINGS, { currentTrackingNumber: 1000 } as any);
        const cachedMessages = getLocalData<ChatMessage[]>(LS_KEYS.CHAT, []); 
        
        if (cachedOrders.length > 0) setOrders(cachedOrders);
        if (cachedSettings) {
            setSettings(cachedSettings);
            if (cachedSettings.activeFiscalYearId && cachedSettings.fiscalYears) {
                const activeYear = cachedSettings.fiscalYears.find(y => y.id === cachedSettings.activeFiscalYearId);
                if (activeYear) setFinancialYearState(activeYear.label);
            }
        }
        if (cachedMessages.length > 0) {
            setChatMessages(cachedMessages);
            if (cachedMessages.length > 0) lastChatMsgIdRef.current = cachedMessages[cachedMessages.length - 1].id;
        }
    }

    if (!silent && orders.length === 0) setLoading(true);

    try {
        // --- OPTIMIZATION: LOAD SETTINGS SEPARATELY FIRST ---
        // This ensures the UI renders correctly (permissions etc.) even if heavy data lags
        getSettings().then(settingsData => {
            if (settingsData) {
                // Sanitize settings arrays just in case
                if (!Array.isArray(settingsData.companies)) settingsData.companies = [];
                if (!Array.isArray(settingsData.companyNames)) settingsData.companyNames = [];
                if (!Array.isArray(settingsData.fiscalYears)) settingsData.fiscalYears = [];
                if (!Array.isArray(settingsData.savedContacts)) settingsData.savedContacts = [];
                setSettings(settingsData);
                
                // Sync financial year state from server settings
                if (settingsData.activeFiscalYearId && settingsData.fiscalYears) {
                    const activeYear = settingsData.fiscalYears.find(y => y.id === settingsData.activeFiscalYearId);
                    if (activeYear) setFinancialYearState(activeYear.label);
                }
            }
        }).catch(err => console.error("Settings load error", err));

        // Load Heavy Data in Parallel
        const [ordersData, messagesData, announcementsData] = await Promise.all([getOrders(), getMessages(), getSystemAnnouncements()]);
        
        // --- SAFE GUARD & DEEP SANITIZATION ---
        const safeOrders = Array.isArray(ordersData) ? ordersData.map(o => ({
            ...o,
            paymentDetails: Array.isArray(o.paymentDetails) ? o.paymentDetails : [],
            attachments: Array.isArray(o.attachments) ? o.attachments : []
        })) : [];

        const safeMessages = Array.isArray(messagesData) ? messagesData : [];
        const safeAnnouncements = Array.isArray(announcementsData) ? announcementsData : [];
        
        // --- OPTIMIZATION: ONLY SET IF CHANGED ---
        setOrders(prev => JSON.stringify(prev) !== JSON.stringify(safeOrders) ? safeOrders : prev);
        setChatMessages(prev => JSON.stringify(prev) !== JSON.stringify(safeMessages) ? safeMessages : prev); 
        
        const lastCheck = parseInt(localStorage.getItem(NOTIFICATION_CHECK_KEY) || '0');
        checkForNotifications(safeOrders, safeAnnouncements, currentUser, lastCheck);
        
        if (safeMessages && safeMessages.length > 0) {
            const lastMsg = safeMessages[safeMessages.length - 1];
            if (lastChatMsgIdRef.current && lastMsg.id !== lastChatMsgIdRef.current && lastMsg.senderUsername !== currentUser.username) {
                if (activeTab !== 'chat') {
                    let body = lastMsg.message || 'فایل ضمیمه';
                    if (body.startsWith('CALL_INVITE|')) body = '📞 تماس ورودی...';
                    addAppNotification(`پیام جدید از ${lastMsg.sender}`, body);
                }
            }
            lastChatMsgIdRef.current = lastMsg.id;
        }

        if (isFirstLoad.current) { checkChequeAlerts(safeOrders); }
        
        localStorage.setItem(NOTIFICATION_CHECK_KEY, Date.now().toString());
        isFirstLoad.current = false;
    } catch (error) { 
        console.error("Failed to load data", error); 
    } finally { 
        if (!silent) setLoading(false); 
        isSyncingRef.current = false;
        isFirstLoad.current = false;
    }
  };

  const checkChequeAlerts = (list: PaymentOrder[]) => {
      const now = new Date();
      let alertCount = 0;
      list.forEach(order => {
          // Double check array existence even after sanitization
          if (order.paymentDetails && Array.isArray(order.paymentDetails)) {
              order.paymentDetails.forEach(detail => {
                  if (detail.method === PaymentMethod.CHEQUE && detail.chequeDate) {
                      const dueDate = parsePersianDate(detail.chequeDate);
                      if (dueDate) {
                          const diffTime = dueDate.getTime() - now.getTime();
                          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                          if (diffDays <= 2 && diffDays >= 0) { alertCount++; }
                      }
                  }
              });
          }
      });
      if (alertCount > 0) { addAppNotification('هشدار سررسید چک', `${alertCount} چک در ۲ روز آینده سررسید می‌شوند.`); }
  };

  const checkForNotifications = (newList: PaymentOrder[], announcementsList: SystemAnnouncement[], user: User, lastCheckTime: number) => {
     // Safe guard against non-array input
     if (Array.isArray(newList)) {
         const newEvents = newList.filter(o => o.updatedAt && o.updatedAt > lastCheckTime);
         newEvents.forEach(newItem => {
            const status = newItem.status;
            const isAdmin = user.role === UserRole.ADMIN;
            if (isAdmin) {
                 const isAdminSelfChange = (status === OrderStatus.PENDING && newItem.requester === user.fullName); 
                 if (!isAdminSelfChange) { addAppNotification(`تغییر وضعیت (${newItem.trackingNumber})`, `وضعیت جدید: ${status}`); }
            }
            if (status === OrderStatus.PENDING && user.role === UserRole.FINANCIAL) { addAppNotification('درخواست پرداخت جدید', `شماره: ${newItem.trackingNumber} | درخواست کننده: ${newItem.requester}`); }
            else if (status === OrderStatus.APPROVED_FINANCE && user.role === UserRole.MANAGER) { addAppNotification('تایید مالی شد', `درخواست ${newItem.trackingNumber} منتظر تایید مدیریت است.`); }
            else if (status === OrderStatus.APPROVED_MANAGER && user.role === UserRole.CEO) { addAppNotification('تایید مدیریت شد', `درخواست ${newItem.trackingNumber} منتظر تایید نهایی شماست.`); }
            else if (status === OrderStatus.APPROVED_CEO) { if (user.role === UserRole.FINANCIAL) { addAppNotification('تایید نهایی شد (پرداخت)', `درخواست ${newItem.trackingNumber} تایید شد. لطفا اقدام به پرداخت کنید.`); } if (newItem.requester === user.fullName) { addAppNotification('درخواست تایید شد', `درخواست شما (${newItem.trackingNumber}) تایید نهایی شد.`); } }
            else if (status === OrderStatus.REJECTED && newItem.requester === user.fullName) { addAppNotification('درخواست رد شد', `درخواست ${newItem.trackingNumber} رد شد. دلیل: ${newItem.rejectionReason || 'نامشخص'}`); }
         });
     }

     if (Array.isArray(announcementsList)) {
         const newAnnouncements = announcementsList.filter(a => a.createdAt > lastCheckTime && (!a.targetUsers || a.targetUsers.length === 0 || a.targetUsers.includes(user.id) || a.targetUsers.includes(user.role)));
         newAnnouncements.forEach(ann => {
             addAppNotification('اعلان جدید داشبورد', ann.message);
         });
     }
  };

  useEffect(() => {
      const handleAppStateChange = async (state: any) => {
          if (state.isActive && currentUser) {
              await loadData(true);
          }
      };
      let listener: any;
      let backListener: any;
      
      if (Capacitor.isNativePlatform()) {
          CapacitorApp.addListener('appStateChange', handleAppStateChange).then(l => { listener = l; });
          
          CapacitorApp.addListener('backButton', ({ canGoBack }) => {
            if (tabHistory.length > 1) {
                const newHistory = [...tabHistory];
                newHistory.pop(); // remove current
                const prevTab = newHistory[newHistory.length - 1];
                setTabHistory(newHistory);
                changeTab(prevTab, false);
            } else if (activeTab !== 'dashboard') {
                changeTab('dashboard');
            } else if (!canGoBack) {
                CapacitorApp.exitApp();
            }
          }).then(l => { backListener = l; });
      }
      return () => { 
        if (listener) listener.remove(); 
        if (backListener) backListener.remove();
      };
  }, [currentUser, activeTab]);

  useEffect(() => { 
      if (currentUser) { 
          loadData(false); 
          // INCREASED INTERVAL TO 20 SECONDS TO REDUCE SERVER LOAD
          const intervalId = setInterval(() => loadData(true), 20000); 
          
          // Heartbeat for Last Seen (Every 1 minute)
          const heartbeatId = setInterval(() => {
              apiCall('/heartbeat', 'POST', { username: currentUser.username }).catch(console.error);
          }, 60000);

          return () => { 
              clearInterval(intervalId); 
              clearInterval(heartbeatId);
          }; 
      } 
  }, [currentUser]);

  const handleOrderCreated = () => { loadData(); setManageOrdersInitialTab('current'); setDashboardStatusFilter(null); setActiveTab('manage'); };
  const handleLogin = (user: User) => { setCurrentUser(user); setActiveTab('dashboard'); };
  const handleViewArchive = () => { setManageOrdersInitialTab('archive'); setDashboardStatusFilter(null); setActiveTab('manage'); };
  const handleDashboardFilter = (status: any) => { setDashboardStatusFilter(status); setManageOrdersInitialTab('current'); setActiveTab('manage'); };

  const handleGoToPaymentApprovals = () => {
      let filter: any = 'pending_all';
      if (currentUser?.role === UserRole.FINANCIAL) filter = 'cartable_financial';
      else if (currentUser?.role === UserRole.MANAGER) filter = 'cartable_manager';
      else if (currentUser?.role === UserRole.CEO) filter = 'cartable_ceo';
      setDashboardStatusFilter(filter);
      setManageOrdersInitialTab('current');
      setActiveTab('manage');
  };

    const handleGoToExitApprovals = () => { 
      setExitPermitStatusFilter('pending'); 
      if (currentUser?.role === UserRole.CEO || currentUser?.role === UserRole.SALES_MANAGER) {
          setActiveTab('manage-invoices'); 
      } else {
          setActiveTab('manage-exit'); 
      }
    };
  const [warehouseInitialTab, setWarehouseInitialTab] = useState<'dashboard' | 'approvals'>('dashboard');
  const handleGoToWarehouseApprovals = () => { setWarehouseInitialTab('approvals'); setActiveTab('warehouse'); };
  const [purchaseInitialTab, setPurchaseInitialTab] = useState<'REQUESTS' | 'PARTS' | 'KARDEX' | 'ARCHIVE'>('REQUESTS');
  const handleGoToPurchaseApprovals = () => { setPurchaseInitialTab('REQUESTS'); setActiveTab('purchase'); };

  const unreadChatCount = useMemo(() => {
      if (!currentUser) return 0;
      return chatMessages.filter(m => {
          if (m.senderUsername === currentUser.username) return false;
          if (m.readBy?.includes(currentUser.username)) return false;
          if (m.groupId) return true;
          if (m.recipient && m.recipient !== currentUser.username) return false;
          return true;
      }).length;
  }, [chatMessages, currentUser]);

  return (
    <>
        {toast && toast.show && (
            <div className="fixed inset-0 flex items-center justify-center p-6 z-[9999999] pointer-events-none">
                <div className="glass-panel border border-white/50 dark:border-white/10 shadow-2xl rounded-[2.5rem] p-6 flex items-center gap-5 min-w-[320px] max-w-[95vw] animate-scale-in backdrop-blur-3xl overflow-hidden pointer-events-auto cursor-pointer relative" onClick={closeToast}>
                    <div className="absolute top-0 right-0 w-2 h-full bg-blue-500 shadow-[0_0_25px_rgba(59,130,246,0.5)]"></div>
                    <div className="bg-blue-600 p-4 rounded-[1.5rem] text-white shadow-lg flex-shrink-0 animate-pulse">
                        <Bell size={28} />
                    </div>
                    <div className="flex-1 pr-1 text-right">
                        <h4 className="font-extrabold text-gray-900 dark:text-white text-lg mb-1 tracking-tight">{toast.title}</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-200 leading-relaxed font-bold">{toast.message}</p>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); closeToast(); }} className="text-gray-400 hover:text-red-500 p-2.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-2xl transition-all active:scale-95 flex-shrink-0">
                        <X size={24} />
                    </button>
                </div>
            </div>
        )}
        {!currentUser ? (
            <Login onLogin={handleLogin} />
        ) : (
            <Layout 
            activeTab={activeTab} 
            setActiveTab={(t) => { setActiveTab(t); if(t!=='warehouse') setWarehouseInitialTab('dashboard'); if(t!=='manage-exit') setExitPermitStatusFilter(null); if(t!=='manage') setDashboardStatusFilter(null); if(t!=='purchase') setPurchaseInitialTab('REQUESTS'); }} 
            currentUser={currentUser} 
            onLogout={handleLogout} 
            notifications={notifications} 
            clearNotifications={() => setNotifications([])}
            onAddNotification={addAppNotification}
            onRemoveNotification={removeNotification}
            financialYear={financialYear}
            setFinancialYear={setFinancialYear}
            settings={settings}
            theme={theme}
            toggleTheme={toggleTheme}
            unreadChatCount={unreadChatCount}
            >
            
            <NotificationController currentUser={currentUser} />

            {backgroundJobs.length > 0 && (
                <div className="hidden-print-export" style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}>
                    <div id={`bg-print-voucher-${backgroundJobs[0].order.id}`}>
                        <PrintVoucher order={backgroundJobs[0].order} embed settings={settings || undefined} />
                    </div>
                </div>
            )}

            <div className={`relative ${activeTab === 'chat' ? 'flex-1 flex flex-col w-full min-h-0' : 'h-full'}`}>
                {loading && (
                    <div className="fixed top-20 right-4 z-[999] bg-white/80 dark:bg-gray-800/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-blue-200 dark:border-blue-800 shadow-lg flex items-center gap-2 animate-fade-in">
                        <Loader2 size={16} className="animate-spin text-blue-600" />
                        <span className="text-[10px] font-bold text-gray-600 dark:text-gray-300">در حال بروزرسانی دیتابیس...</span>
                    </div>
                )}
                {activeTab === 'dashboard' && <Dashboard orders={orders} settings={settings} currentUser={currentUser} onViewArchive={handleViewArchive} onFilterByStatus={handleDashboardFilter} onGoToPaymentApprovals={handleGoToPaymentApprovals} onGoToExitApprovals={handleGoToExitApprovals} onGoToBijakApprovals={handleGoToWarehouseApprovals} onGoToPurchaseApprovals={handleGoToPurchaseApprovals} financialYear={financialYear} />}
                {activeTab === 'create' && <CreateOrder onSuccess={handleOrderCreated} currentUser={currentUser} />}
                {activeTab === 'manage' && <ManageOrders orders={orders} refreshData={() => loadData(true)} currentUser={currentUser} initialTab={manageOrdersInitialTab} settings={settings} statusFilter={dashboardStatusFilter} financialYear={financialYear} />}
                {activeTab === 'create-exit' && <CreateExitPermit onSuccess={() => setActiveTab('manage-exit')} currentUser={currentUser} />}
                {activeTab === 'manage-invoices' && <ManageExitPermits currentUser={currentUser} settings={settings} statusFilter={exitPermitStatusFilter} financialYear={financialYear} mode="INVOICE" />}
                {activeTab === 'manage-exit' && <ManageExitPermits currentUser={currentUser} settings={settings} statusFilter={exitPermitStatusFilter} financialYear={financialYear} mode="EXIT" />}
                {activeTab === 'warehouse' && <WarehouseModule currentUser={currentUser} settings={settings} initialTab={warehouseInitialTab} financialYear={financialYear} />}
                {activeTab === 'trade' && <TradeModule currentUser={currentUser} />}
                {activeTab === 'sales' && <SalesCRMModule />}
                {activeTab === 'products' && <ProductsModule />}
                {activeTab === 'tickets' && <Tickets />}
                {activeTab === 'users' && <ManageUsers />}
                {activeTab === 'settings' && <Settings financialYear={financialYear} settings={settings} onUpdateSettings={setSettings} />}
                {(activeTab === 'knowledge' || activeTab === 'notes') && <KnowledgeBaseModule currentUser={currentUser} settings={settings} onUpdateSettings={setSettings} />}
                {activeTab === 'security' && <SecurityModule currentUser={currentUser} financialYear={financialYear} />}
                {activeTab === 'meetings' && <MeetingModule currentUser={currentUser} />}
                {activeTab === 'purchase' && <PurchaseModule currentUser={currentUser} settings={settings || undefined} initialTab={purchaseInitialTab} />}
                {activeTab === 'chat' && (
                    <ChatRoom 
                        currentUser={currentUser} 
                        preloadedMessages={chatMessages}
                        onRefresh={() => loadData(true)} 
                    />
                )} 
            </div>
            </Layout>
        )}
    </>
  );
}
export default App;
