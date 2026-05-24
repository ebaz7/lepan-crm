
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
import { CustomerBalanceModule } from './components/CustomerBalanceModule';
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

  const activeTabRef = useRef(activeTab);
  const tabHistoryRef = useRef(tabHistory);
  const customBackRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const registerBack = (e: any) => { customBackRef.current = e.detail; };
    const unregisterBack = () => { customBackRef.current = null; };
    window.addEventListener('REGISTER_BACK_ACTION', registerBack);
    window.addEventListener('UNREGISTER_BACK_ACTION', unregisterBack);
    return () => {
        window.removeEventListener('REGISTER_BACK_ACTION', registerBack);
        window.removeEventListener('UNREGISTER_BACK_ACTION', unregisterBack);
    }
  }, []);

  useEffect(() => {
      activeTabRef.current = activeTab;
      tabHistoryRef.current = tabHistory;
  }, [activeTab, tabHistory]);

  const setActiveTab = (tab: string, addToHistory = true) => {
      if (tab === activeTabRef.current) return;
      
      setActiveTabState(tab);
      if (addToHistory) {
          setTabHistory(prev => {
              if (prev[prev.length - 1] === tab) return prev;
              return [...prev.slice(-14), tab]; // Keep last 15
          });
          
          // Browser history support
          const hash = `#${tab}`;
          if (window.location.hash !== hash) {
              try {
                  window.history.pushState({ tab }, '', hash);
              } catch (e) {
                  window.location.hash = hash;
              }
          }
      }
  };

  const goBack = (isPopState: boolean = false) => {
      // 1. Registered custom handler
      if (customBackRef.current) {
          customBackRef.current();
          return true;
      }
      
      // 2. Modals check
      const activeModals = document.querySelectorAll('.fixed.inset-0, [role="dialog"], .notification-dropdown-container, .glass-panel.fixed, .modal-active');
      if (activeModals.length > 0) {
          const lastModal = activeModals[activeModals.length - 1];
          const closeBtn = lastModal.querySelector('button[onClick], .modal-close-btn, [aria-label="بستن"], [data-close-modal="true"], [data-close-announcement="true"]') as HTMLElement;
          if (closeBtn) {
              closeBtn.click();
          } else {
              window.dispatchEvent(new CustomEvent('CLOSE_ACTIVE_MODALS'));
          }
          return true;
      }

      // 3. Tab history back
      if (tabHistoryRef.current.length > 1) {
          setTabHistory(prev => {
              const newHist = [...prev];
              newHist.pop();
              const prevTab = newHist[newHist.length - 1];
              setActiveTabState(prevTab);
              safeReplaceState({ tab: prevTab }, '', `#${prevTab}`);
              return newHist;
          });
          return true;
      }

      // 4. Force back to dashboard if not at dashboard
      if (activeTabRef.current !== 'dashboard') {
          setActiveTab('dashboard', false);
          // Force ref update for tab state in case rendering is slow
          activeTabRef.current = 'dashboard';
          return true;
      }

      return false; // Let native behavior handle exit
  };

  const safePushState = (state: any, title: string, url: string) => {
    try { window.history.pushState(state, title, url); } catch (e) { window.location.hash = url; }
  };
  
  const safeReplaceState = (state: any, title: string, url: string) => {
    try { window.history.replaceState(state, title, url); } catch (e) { window.location.hash = url; }
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
  const [orders, setOrders] = useState<PaymentOrder[]>(() => {
    try { const item = localStorage.getItem('app_data_orders'); return item ? JSON.parse(item) : []; } catch { return []; }
  });
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
    try { const item = localStorage.getItem('app_data_chat'); return item ? JSON.parse(item) : []; } catch { return []; }
  }); 
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [manageOrdersInitialTab, setManageOrdersInitialTab] = useState<'current' | 'archive'>('current');
  const [dashboardStatusFilter, setDashboardStatusFilter] = useState<any>(null); 
  const [exitPermitStatusFilter, setExitPermitStatusFilter] = useState<'pending' | null>(null);

  const [toast, setToast] = useState<{show: boolean, title: string, message: string} | null>(null);
  const toastTimeoutRef = useRef<any>(null);

  const [backgroundJobs, setBackgroundJobs] = useState<{order: PaymentOrder, type: 'create' | 'approve'}[]>([]);
  const [sharedData, setSharedData] = useState<{ fileUrl?: string; text?: string; title?: string } | null>(null);
  const processingJobRef = useRef(false);

  const isSyncingRef = useRef(false);
  const isFirstLoad = useRef(true);
  const idleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const IDLE_LIMIT = 60 * 60 * 1000; 
  const NOTIFICATION_CHECK_KEY = 'last_notification_check';
  
  const lastChatMsgIdRef = useRef<string | null>(null);
  const isNative = Capacitor.isNativePlatform();

  useEffect(() => {
    if (isNative) {
        let backListener: any;
        try {
            CapacitorApp.addListener('backButton', ({ canGoBack }) => {
                const handled = goBackGlobal();
                if (!handled && !canGoBack && activeTabRef.current === 'dashboard') {
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

        // --- ANDROID SHARE INTENT SUPPORT ---
        try {
            CapacitorApp.addListener('appRestoredResult', (data: any) => {
                if (data.pluginId === 'Share' || data.pluginId === 'App') {
                    const result = data.data;
                    if (result && (result.url || result.text)) {
                         setSharedData({ fileUrl: result.url, text: result.text, title: result.title });
                         setActiveTab('chat');
                    }
                }
            });
        } catch (e) { console.error("Share Intent Error", e); }

        return () => {
            if (backListener) backListener.remove();
        };
    }
  }, []);

  useEffect(() => {
      const handleJob = (e: CustomEvent) => { setBackgroundJobs(prev => [...prev, e.detail]); };
      const handleGoBack = () => { goBackGlobal(); };
      window.addEventListener('QUEUE_WHATSAPP_JOB' as any, handleJob);
      window.addEventListener('GO_BACK', handleGoBack);
      return () => {
          window.removeEventListener('QUEUE_WHATSAPP_JOB' as any, handleJob);
          window.removeEventListener('GO_BACK', handleGoBack);
      };
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
    
    // Ensure we have a base history entry
    if (window.history.length <= 1) {
        safeReplaceState({ tab: 'dashboard' }, '', '#dashboard');
        // Push once so we can "pop" to dashboard without leaving
        safePushState({ tab: 'dashboard', root: true }, '', '#dashboard');
    }

    const hash = window.location.hash.replace('#', '');
    if (hash && ['dashboard', 'create', 'manage', 'chat', 'trade', 'users', 'settings', 'create-exit', 'manage-exit', 'manage-invoices', 'warehouse', 'security', 'purchase', 'balances'].includes(hash)) {
        setActiveTabState(hash); 
        safeReplaceState({ tab: hash }, '', `#${hash}`);
    } else { 
        safeReplaceState({ tab: 'dashboard' }, '', '#dashboard'); 
    }

    const handlePopState = (event: PopStateEvent) => {
        const handled = goBackGlobal(true);
        if (!handled && event.state?.tab) {
            setActiveTab(event.state.tab, false);
        }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    const handleUrlOpen = (data: any) => {
        try {
            const url = new URL(data.url);
            const params = new URLSearchParams(url.search);
            const sUrl = params.get('sharedFileUrl');
            const sText = params.get('sharedText');
            if (sUrl || sText) {
                setSharedData({ fileUrl: sUrl || undefined, text: sText || undefined });
                setActiveTab('chat');
            }
        } catch (e) {}
    };

    if (isNative) {
        CapacitorApp.addListener('appUrlOpen', handleUrlOpen);
    }

    const params = new URLSearchParams(window.location.search);
    const sharedFileUrl = params.get('sharedFileUrl');
    const sharedText = params.get('sharedText');
    const sharedTitle = params.get('sharedTitle');

    if (sharedFileUrl || sharedText || sharedTitle) {
      setSharedData({
        fileUrl: sharedFileUrl || undefined,
        text: sharedText || undefined,
        title: sharedTitle || undefined,
      });
      // Switch to the chat tab
      setActiveTab('chat');
      
      // Clean up URL query parameters so refresh doesn't trigger again
      try {
        const urlWithoutParams = window.location.protocol + "//" + window.location.host + window.location.pathname + window.location.hash;
        window.history.replaceState({ path: urlWithoutParams }, '', urlWithoutParams);
      } catch (e) {
        console.error("Failed to clean query parameters", e);
      }
    }
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

        const iconUrl = settings.pwaIcon || "https://cdn-icons-png.flaticon.com/512/3135/3135706.png";

        // Favicon update
        let favicon = document.querySelector('link[rel="icon"]');
        if (!favicon) {
            favicon = document.createElement('link');
            // @ts-ignore
            favicon.rel = 'icon';
            document.head.appendChild(favicon);
        }
        favicon.setAttribute('href', iconUrl);

        // Apple Touch Icon
        let appleIcon = document.querySelector('link[rel="apple-touch-icon"]');
        if (!appleIcon) {
            appleIcon = document.createElement('link');
            // @ts-ignore
            appleIcon.rel = 'apple-touch-icon';
            document.head.appendChild(appleIcon);
        }
        appleIcon.setAttribute('href', iconUrl);

        // Manifest - Use the server-side generated route
        let manifestLink = document.querySelector('link[rel="manifest"]');
        if (!manifestLink) {
            manifestLink = document.createElement('link');
            // @ts-ignore
            manifestLink.rel = 'manifest';
            document.head.appendChild(manifestLink);
        }
        // Force refresh manifest if icon changes by adding dynamic version
        const iconHash = iconUrl.substring(iconUrl.length - 10);
        manifestLink.setAttribute('href', `/manifest.json?v=${iconHash}`);
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
      toastTimeoutRef.current = setTimeout(() => setToast(null), 3000);
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
         const NOTIFICATION_HISTORY_KEY = 'notification_history';
         const history = JSON.parse(localStorage.getItem(NOTIFICATION_HISTORY_KEY) || '[]');
         
         newEvents.forEach(newItem => {
            const status = newItem.status;
            const isAdmin = user.role === UserRole.ADMIN;
            const notificationId = `${newItem.trackingNumber}_${status}_${newItem.updatedAt}`;
            
            if (history.includes(notificationId)) return;
            
            if (isAdmin) {
                 const isAdminSelfChange = (status === OrderStatus.PENDING && newItem.requester === user.fullName); 
                 if (!isAdminSelfChange) { addAppNotification(`تغییر وضعیت (${newItem.trackingNumber})`, `وضعیت جدید: ${status}`); }
            }
            if (status === OrderStatus.PENDING && user.role === UserRole.FINANCIAL) { addAppNotification('درخواست پرداخت جدید', `شماره: ${newItem.trackingNumber} | درخواست کننده: ${newItem.requester}`); }
            else if (status === OrderStatus.APPROVED_FINANCE && user.role === UserRole.MANAGER) { addAppNotification('تایید مالی شد', `درخواست ${newItem.trackingNumber} منتظر تایید مدیریت است.`); }
            else if (status === OrderStatus.APPROVED_MANAGER && user.role === UserRole.CEO) { addAppNotification('تایید مدیریت شد', `درخواست ${newItem.trackingNumber} منتظر تایید نهایی شماست.`); }
            else if (status === OrderStatus.APPROVED_CEO) { if (user.role === UserRole.FINANCIAL) { addAppNotification('تایید نهایی شد (پرداخت)', `درخواست ${newItem.trackingNumber} تایید شد. لطفا اقدام به پرداخت کنید.`); } if (newItem.requester === user.fullName) { addAppNotification('درخواست تایید شد', `درخواست شما (${newItem.trackingNumber}) تایید نهایی شد.`); } }
            else if (status === OrderStatus.REJECTED && newItem.requester === user.fullName) { addAppNotification('درخواست رد شد', `درخواست ${newItem.trackingNumber} رد شد. دلیل: ${newItem.rejectionReason || 'نامشخص'}`); }
            
            history.push(notificationId);
         });
         
         if (history.length > 50) history.splice(0, history.length - 50);
         localStorage.setItem(NOTIFICATION_HISTORY_KEY, JSON.stringify(history));
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
      
      if (Capacitor.isNativePlatform()) {
          CapacitorApp.addListener('appStateChange', handleAppStateChange).then(l => { listener = l; });
      }
      return () => { 
        if (listener) listener.remove(); 
      };
  }, [currentUser]);

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
            <div className="fixed inset-x-0 top-6 z-[9999999] flex justify-center pointer-events-none w-full px-4">
                <div className="glass-panel border border-white/50 dark:border-white/10 shadow-2xl rounded-2xl p-3 flex items-center gap-3 min-w-[280px] max-w-sm animate-slide-down backdrop-blur-3xl overflow-hidden pointer-events-auto cursor-pointer relative" onClick={closeToast}>
                    <div className="absolute top-0 right-0 w-1 h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
                    <div className="bg-gradient-to-tr from-blue-500 to-indigo-600 p-2 rounded-xl text-white shadow-lg flex-shrink-0">
                        <Bell size={18} />
                    </div>
                    <div className="flex-1 text-right">
                        <h4 className="font-bold text-gray-900 dark:text-white text-xs mb-0.5 tracking-tight">{toast.title}</h4>
                        <p className="text-[10px] text-gray-600 dark:text-gray-300 leading-tight font-medium">{toast.message}</p>
                    </div>
                </div>
            </div>
        )}
        {!currentUser ? (
            <Login onLogin={handleLogin} />
        ) : (
            <Layout 
            onBack={goBack}
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

            <div className="flex-1 relative flex flex-col min-h-0">
                {loading && (
                    <div className="fixed top-20 right-4 z-[999] bg-white/80 dark:bg-gray-800/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-blue-200 dark:border-blue-800 shadow-lg flex items-center gap-2 animate-fade-in">
                        <Loader2 size={16} className="animate-spin text-blue-600" />
                        <span className="text-[10px] font-bold text-gray-600 dark:text-gray-300">در حال بروزرسانی دیتابیس...</span>
                    </div>
                )}
                <div className={activeTab === 'dashboard' ? 'block h-full' : 'hidden'}>
                    <Dashboard orders={orders} settings={settings} currentUser={currentUser} onViewArchive={handleViewArchive} onFilterByStatus={handleDashboardFilter} onGoToPaymentApprovals={handleGoToPaymentApprovals} onGoToExitApprovals={handleGoToExitApprovals} onGoToBijakApprovals={handleGoToWarehouseApprovals} onGoToPurchaseApprovals={handleGoToPurchaseApprovals} financialYear={financialYear} />
                </div>
                {activeTab === 'create' && <CreateOrder onSuccess={handleOrderCreated} currentUser={currentUser} />}
                {activeTab === 'manage' && <ManageOrders orders={orders} refreshData={() => loadData(true)} currentUser={currentUser} initialTab={manageOrdersInitialTab} settings={settings} statusFilter={dashboardStatusFilter} financialYear={financialYear} />}
                {activeTab === 'create-exit' && <CreateExitPermit onSuccess={() => setActiveTab('manage-exit')} currentUser={currentUser} />}
                {activeTab === 'manage-invoices' && <ManageExitPermits currentUser={currentUser} settings={settings} statusFilter={exitPermitStatusFilter} financialYear={financialYear} mode="INVOICE" />}
                {activeTab === 'manage-exit' && <ManageExitPermits currentUser={currentUser} settings={settings} statusFilter={exitPermitStatusFilter} financialYear={financialYear} mode="EXIT" />}
                {activeTab === 'warehouse' && <WarehouseModule currentUser={currentUser} settings={settings} initialTab={warehouseInitialTab} financialYear={financialYear} />}
                {activeTab === 'trade' && <TradeModule currentUser={currentUser} />}
                {activeTab === 'balances' && <CustomerBalanceModule currentUser={currentUser} />}
                {activeTab === 'sales' && <SalesCRMModule />}
                {activeTab === 'products' && <ProductsModule />}
                {activeTab === 'tickets' && <Tickets />}
                {activeTab === 'users' && <ManageUsers />}
                {activeTab === 'settings' && <Settings financialYear={financialYear} settings={settings} onUpdateSettings={setSettings} />}
                {(activeTab === 'knowledge' || activeTab === 'notes') && <KnowledgeBaseModule currentUser={currentUser} settings={settings} onUpdateSettings={setSettings} />}
                {activeTab === 'security' && <SecurityModule currentUser={currentUser} financialYear={financialYear} />}
                {activeTab === 'meetings' && <MeetingModule currentUser={currentUser} />}
                {activeTab === 'purchase' && <PurchaseModule currentUser={currentUser} settings={settings || undefined} initialTab={purchaseInitialTab} />}
                
                <div className={activeTab === 'chat' ? 'flex-1 flex flex-col w-full min-h-0' : 'fixed inset-0 pointer-events-none opacity-0 invisible overflow-hidden h-0'}>
                    <ChatRoom 
                        currentUser={currentUser} 
                        preloadedMessages={chatMessages}
                        onRefresh={() => loadData(true)} 
                        sharedData={sharedData}
                        onClearSharedData={() => setSharedData(null)}
                    />
                </div> 
            </div>
            </Layout>
        )}
    </>
  );
}
export default App;
