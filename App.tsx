
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
import CctiConverter from './components/CctiConverter';
import { getOrders, getSettings, getMessages, saveSettings, getSystemAnnouncements } from './services/storageService'; 
import { getCurrentUser, getUsers, getRolePermissions } from './services/authService';
import { PaymentOrder, User, OrderStatus, UserRole, AppNotification, SystemSettings, PaymentMethod, ChatMessage, SystemAnnouncement } from './types';
import { Loader2, Bell, X } from 'lucide-react';
import { generateUUID, parsePersianDate, formatCurrency } from './constants';
import { apiCall, getLocalData, LS_KEYS } from './services/apiService'; 
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app'; 
import { PushNotifications } from '@capacitor/push-notifications'; 
import { LocalNotifications } from '@capacitor/local-notifications'; 
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
      
      // Clear custom back ref when changing tab to avoid leaks
      customBackRef.current = null;
      
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
      const activeModals = Array.from(
          document.querySelectorAll('.fixed.inset-0:not(.pointer-events-none):not(.invisible):not(.opacity-0), [role="dialog"], .notification-dropdown-container, .glass-panel.fixed:not(.pointer-events-none):not(.bottom-nav-bar), .modal-active')
      ).filter(el => {
          const style = window.getComputedStyle(el);
          return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0' && !el.classList.contains('pointer-events-none');
      });

      if (activeModals.length > 0) {
          const lastModal = activeModals[activeModals.length - 1];
          const closeBtn = lastModal.querySelector('button[onClick], .modal-close-btn, [aria-label="بستن"], [data-close-modal="true"], [data-close-announcement="true"]') as HTMLElement;
          if (closeBtn) {
              closeBtn.click();
          } else {
              // Brute force click the first button that looks like a close/cancel
              const fallbackBtn = Array.from(lastModal.querySelectorAll('button')).find(btn => {
                  const txt = (btn.textContent || '').trim();
                  const hasCloseIcon = btn.querySelector('.lucide-x, .lucide-x-circle, .lucide-chevron-right, .lucide-arrow-right');
                  const hasRedText = btn.className.includes('red');
                  return txt.includes('بستن') || txt.includes('انصراف') || txt.includes('✕') || hasCloseIcon || hasRedText;
              }) as HTMLElement;
              
              if (fallbackBtn) {
                  fallbackBtn.click();
              } else {
                   window.dispatchEvent(new CustomEvent('CLOSE_ACTIVE_MODALS'));
              }
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
                const handled = goBack();
                if (!handled && !canGoBack && activeTabRef.current === 'dashboard') {
                    CapacitorApp.exitApp();
                }
            }).then(l => { backListener = l; });
        } catch(e) { console.error("Back button listener error", e); }
        
        try {
            const mapNotificationUrlToTab = (url: string | undefined): string | null => {
                if (!url) return null;
                const path = url.replace('#', '').trim().toLowerCase();
                
                if (path.includes('chat')) return 'chat';
                if (path.includes('payment-approvals') || path.includes('payment-orders') || path.includes('manage')) return 'manage';
                if (path.includes('exit-permits') || path.includes('exit-approvals') || path.includes('exit') || path.includes('manage-exit')) return 'manage-exit';
                if (path.includes('security-panel') || path.includes('security')) return 'security';
                if (path.includes('warehouse')) return 'warehouse';
                if (path.includes('balances')) return 'balances';
                if (path.includes('purchase')) return 'purchase';
                if (path.includes('meetings')) return 'meetings';
                if (path.includes('invoices') || path.includes('manage-invoices')) return 'manage-invoices';
                
                const cleaned = path.replace(/^\//, ''); // remove leading slash
                const validTabs = ['dashboard', 'create', 'manage', 'chat', 'trade', 'users', 'settings', 'create-exit', 'manage-exit', 'manage-invoices', 'warehouse', 'security', 'purchase', 'balances', 'meetings', 'knowledge', 'ccti'];
                if (validTabs.includes(cleaned)) {
                    return cleaned;
                }
                return null;
            };

            PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
                const data = notification.notification.data;
                console.log("Push Action Data:", data);
                if (data && data.url) {
                    const mappedTab = mapNotificationUrlToTab(data.url);
                    if (mappedTab) setActiveTab(mappedTab);
                }
            });

            LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
                const data = action.notification.extra;
                console.log("Local action data:", data);
                if (data && data.url) {
                    const mappedTab = mapNotificationUrlToTab(data.url);
                    if (mappedTab) setActiveTab(mappedTab);
                }
            });
        } catch(e) { console.error("Notification Listener Error", e); }

        // --- ANDROID INTENT SUPPORT (Simplified) & SHARE TARGET plugin ---
        try {
            CapacitorApp.addListener('appRestoredResult', (data: any) => {
                if (data.pluginId === 'Share' || data.pluginId === 'App' || !data.pluginId) {
                    const result = data.data;
                    if (result && (result.url || result.text || result.uri)) {
                         setSharedData({ fileUrl: result.url || result.uri, text: result.text, title: result.title });
                         setTimeout(() => setActiveTab('chat'), 500);
                    }
                }
            });
            
            // Also try to catch it in appUrlOpen
            CapacitorApp.addListener('appUrlOpen', (data: any) => {
                if (data.url && (data.url.includes('sharedFileUrl') || data.url.includes('sharedText'))) {
                    // This case is already handled by the other useEffect but let's be sure
                    setTimeout(() => setActiveTab('chat'), 500);
                }
            });

            // Register @capgo/capacitor-share-target listener
            const initShareTarget = async () => {
                try {
                    const { CapacitorShareTarget } = await import('@capgo/capacitor-share-target');
                    CapacitorShareTarget.addListener('shareReceived', (event: any) => {
                        console.log("CapacitorShareTarget shareReceived event:", event);
                        if (event) {
                            const text = event.text || (event.texts && event.texts.length > 0 ? event.texts[0] : undefined);
                            const fileUrl = event.files && event.files.length > 0 ? (event.files[0].uri || event.files[0].url || event.files[0].path) : undefined;
                            const title = event.title || undefined;
                            
                            if (text || fileUrl) {
                                setSharedData({ fileUrl, text, title });
                                setTimeout(() => setActiveTab('chat'), 500);
                            }
                        }
                    });
                } catch (err) {
                    console.error("Failed to load optional CapacitorShareTarget", err);
                }
            };
            initShareTarget();
        } catch (e) { console.error("App Restored Error", e); }

        return () => {
            if (backListener) backListener.remove();
        };
    }
  }, []);

  useEffect(() => {
      const handleJob = (e: CustomEvent) => { setBackgroundJobs(prev => [...prev, e.detail]); };
      const handleGoBack = () => { goBack(); };
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
    const path = window.location.pathname.replace(/^\/+/, '');
    const defaultTab = hash || path || 'dashboard';

    if (['dashboard', 'create', 'manage', 'chat', 'trade', 'users', 'settings', 'create-exit', 'manage-exit', 'manage-invoices', 'warehouse', 'security', 'purchase', 'balances', 'ccti'].includes(defaultTab)) {
        setActiveTabState(defaultTab); 
        safeReplaceState({ tab: defaultTab }, '', `#${defaultTab}`);
    } else { 
        safeReplaceState({ tab: 'dashboard' }, '', '#dashboard'); 
    }

    const handlePopState = (event: PopStateEvent) => {
        const handled = goBack(true);
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

  const handleLogout = async () => { 
      const endpoint = localStorage.getItem('push_endpoint');
      if (endpoint) {
          try {
              await apiCall('/unsubscribe', 'POST', { endpoint });
          } catch(e) {}
      }
      localStorage.removeItem('push_endpoint');
      setCurrentUser(null); 
      isFirstLoad.current = true; 
      if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current); 
  };

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
    if (currentUser && !isNative) {
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

  const addAppNotification = (title: string, message: string, url?: string) => { 
      setNotifications(prev => [{ id: generateUUID(), title, message, timestamp: Date.now(), read: false }, ...prev]); 
      playNotificationSound();
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      setToast({ show: true, title, message });
      toastTimeoutRef.current = setTimeout(() => setToast(null), 3000);
      sendNotification(title, message, url ? { url } : null);
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
        const areOrdersEqual = (arr1: PaymentOrder[], arr2: PaymentOrder[]) => {
            if (arr1.length !== arr2.length) return false;
            for (let i = 0; i < arr1.length; i++) {
                if (arr1[i].id !== arr2[i].id || arr1[i].status !== arr2[i].status || arr1[i].updatedAt !== arr2[i].updatedAt) {
                    return false;
                }
            }
            return true;
        };
        const areChatEqual = (arr1: ChatMessage[], arr2: ChatMessage[]) => {
            if (arr1.length !== arr2.length) return false;
            const checkCount = Math.min(arr1.length, 15);
            for (let i = 0; i < checkCount; i++) {
                const idx1 = arr1.length - 1 - i;
                const idx2 = arr2.length - 1 - i;
                if (arr1[idx1].id !== arr2[idx2].id || arr1[idx1].timestamp !== arr2[idx2].timestamp || arr1[idx1].isEdited !== arr2[idx2].isEdited || arr1[idx1].readBy?.length !== arr2[idx2].readBy?.length) {
                    return false;
                }
            }
            return true;
        };

        setOrders(prev => areOrdersEqual(prev, safeOrders) ? prev : safeOrders);
        setChatMessages(prev => areChatEqual(prev, safeMessages) ? prev : safeMessages); 
        
        const isNotFirstSync = !isFirstLoad.current;
        const lastCheckValue = localStorage.getItem(NOTIFICATION_CHECK_KEY);
        let lastCheck = parseInt(lastCheckValue || '0');
        
        // If it's the very first load or very old check, initialize to now to avoid historic flood
        if (!isNotFirstSync) {
            lastCheck = Date.now();
            localStorage.setItem(NOTIFICATION_CHECK_KEY, lastCheck.toString());
        } else if (!lastCheck || (Date.now() - lastCheck > 24 * 60 * 60 * 1000)) {
            lastCheck = Date.now();
            localStorage.setItem(NOTIFICATION_CHECK_KEY, lastCheck.toString());
        }

        checkForNotifications(safeOrders, safeAnnouncements, currentUser, lastCheck);
        
        if (safeMessages && safeMessages.length > 0) {
            const lastMsg = safeMessages[safeMessages.length - 1];
            
            // Check if message is relevant to me:
            // Don't notify if it's a private message to someone else
            let isRelevantToMe = true;
            if (lastMsg.recipient && lastMsg.recipient !== currentUser.username && lastMsg.recipient !== currentUser.fullName) {
                isRelevantToMe = false;
            }

            const CHAT_NOTIFIED_HISTORY_KEY = 'chat_notified_history';
            const chatHistory = JSON.parse(localStorage.getItem(CHAT_NOTIFIED_HISTORY_KEY) || '[]');
 
            if (isRelevantToMe && lastMsg.senderUsername !== currentUser.username) {
                if (isNotFirstSync && lastChatMsgIdRef.current && lastMsg.id !== lastChatMsgIdRef.current && !chatHistory.includes(lastMsg.id)) {
                    if (activeTab !== 'chat') {
                        let body = 'پیام جدید';
                        if (lastMsg.message && lastMsg.message.trim() !== '') {
                            body = lastMsg.message;
                            if (body.startsWith('CALL_INVITE|')) body = '📞 تماس ورودی...';
                        } else if (lastMsg.attachment) {
                            body = `📎 فایل ضمیمه: ${lastMsg.attachment.fileName || 'بدون نام'}`;
                        } else if (lastMsg.audioUrl) {
                            body = '🎤 پیام صوتی جدید';
                        }
                        addAppNotification(`پیام جدید از ${lastMsg.sender}`, body, 'chat');
                        
                        chatHistory.push(lastMsg.id);
                        if (chatHistory.length > 500) chatHistory.splice(0, chatHistory.length - 500);
                        localStorage.setItem(CHAT_NOTIFIED_HISTORY_KEY, JSON.stringify(chatHistory));
                    }
                } else if (!isNotFirstSync) {
                    // Record existing message in first sync so it is never repeated
                    if (!chatHistory.includes(lastMsg.id)) {
                        chatHistory.push(lastMsg.id);
                        if (chatHistory.length > 500) chatHistory.splice(0, chatHistory.length - 500);
                        localStorage.setItem(CHAT_NOTIFIED_HISTORY_KEY, JSON.stringify(chatHistory));
                    }
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
     if (Array.isArray(newList)) {
         const newEvents = newList.filter(o => o.updatedAt && o.updatedAt > lastCheckTime);
         const NOTIFICATION_HISTORY_KEY = 'notification_history';
         const history = JSON.parse(localStorage.getItem(NOTIFICATION_HISTORY_KEY) || '[]');
         
         let hasNew = false;
         newEvents.forEach(newItem => {
            const status = newItem.status;
            const isAdmin = user.role === UserRole.ADMIN;
            const notificationId = `${newItem.trackingNumber}_${status}_${newItem.updatedAt}`;
            
            if (history.includes(notificationId)) return;
            
            let notified = false;
            if (isAdmin) {
                 const isAdminSelfChange = (status === OrderStatus.PENDING && newItem.requester === user.fullName); 
                 if (!isAdminSelfChange) { addAppNotification(`تغییر وضعیت (${newItem.trackingNumber})`, `وضعیت جدید: ${status}`, 'manage'); notified = true; }
            }
            
            if (!notified) {
                if (status === OrderStatus.PENDING && user.role === UserRole.FINANCIAL) { addAppNotification('درخواست پرداخت جدید', `شماره: ${newItem.trackingNumber} | درخواست کننده: ${newItem.requester}`, 'manage'); }
                else if (status === OrderStatus.APPROVED_FINANCE && user.role === UserRole.MANAGER) { addAppNotification('تایید مالی شد', `درخواست ${newItem.trackingNumber} منتظر تایید مدیریت است.`, 'manage'); }
                else if (status === OrderStatus.APPROVED_MANAGER && user.role === UserRole.CEO) { addAppNotification('تایید مدیریت شد', `درخواست ${newItem.trackingNumber} منتظر تایید نهایی شماست.`, 'manage'); }
                else if (status === OrderStatus.APPROVED_CEO) { 
                    if (user.role === UserRole.FINANCIAL) { addAppNotification('تایید نهایی شد (پرداخت)', `درخواست ${newItem.trackingNumber} تایید شد. لطفا اقدام به پرداخت کنید.`, 'manage'); } 
                    if (newItem.requester === user.fullName) { addAppNotification('درخواست تایید شد', `درخواست شما (${newItem.trackingNumber}) تایید نهایی شد.`, 'manage'); } 
                }
                else if (status === OrderStatus.REJECTED && newItem.requester === user.fullName) { addAppNotification('درخواست رد شد', `درخواست ${newItem.trackingNumber} رد شد. دلیل: ${newItem.rejectionReason || 'نامشخص'}`, 'manage'); }
            }
            
            history.push(notificationId);
            hasNew = true;
         });
         
         if (hasNew) {
            if (history.length > 500) history.splice(0, history.length - 500);
            localStorage.setItem(NOTIFICATION_HISTORY_KEY, JSON.stringify(history));
         }
     }

     if (Array.isArray(announcementsList)) {
         const newAnnouncements = announcementsList.filter(a => a.createdAt > lastCheckTime && (!a.targetUsers || a.targetUsers.length === 0 || a.targetUsers.includes(user.id) || a.targetUsers.includes(user.role)));
         const ANNOUNCEMENT_HISTORY_KEY = 'announcement_notification_history';
         const annHistory = JSON.parse(localStorage.getItem(ANNOUNCEMENT_HISTORY_KEY) || '[]');
         let hasNewAnn = false;

         newAnnouncements.forEach(ann => {
             if (annHistory.includes(ann.id)) return;
             addAppNotification('اعلان جدید داشبورد', ann.message);
             annHistory.push(ann.id);
             hasNewAnn = true;
         });

         if (hasNewAnn) {
             if (annHistory.length > 200) annHistory.splice(0, annHistory.length - 200);
             localStorage.setItem(ANNOUNCEMENT_HISTORY_KEY, JSON.stringify(annHistory));
         }
     }
  };

  useEffect(() => {
      const triggerReload = () => {
          if (currentUser) {
              console.log("Forcing data synchronizer on focus/online/visibilitychange");
              loadData(true);
          }
      };

      const handleAppStateChange = async (state: any) => {
          if (state.isActive) {
              triggerReload();
          }
      };
      
      let listener: any;
      
      if (Capacitor.isNativePlatform()) {
          CapacitorApp.addListener('appStateChange', handleAppStateChange).then(l => { listener = l; });
      }
      
      window.addEventListener('focus', triggerReload);
      window.addEventListener('online', triggerReload);
      
      const handleVisibilityChange = () => {
          if (document.visibilityState === 'visible') {
              triggerReload();
          }
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);

      return () => { 
        if (listener) listener.remove(); 
        window.removeEventListener('focus', triggerReload);
        window.removeEventListener('online', triggerReload);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
  }, [currentUser]);

  useEffect(() => { 
      if (currentUser) { 
          loadData(false); 
          // Android app has much higher responsiveness (4s) compared to web (8s)
          const intervalDuration = isNative ? 4000 : 8000;
          const intervalId = setInterval(() => loadData(true), intervalDuration); 
          
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
      if (currentUser) {
          const permissions = getRolePermissions(currentUser.role, settings || null);
          if (currentUser.role === UserRole.FINANCIAL || permissions.canApproveFinancial) filter = 'cartable_financial';
          else if (currentUser.role === UserRole.MANAGER || permissions.canApproveManager) filter = 'cartable_manager';
          else if (currentUser.role === UserRole.CEO || permissions.canApproveCeo) filter = 'cartable_ceo';
      }
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
            
            <NotificationController 
                currentUser={currentUser} 
                onNotificationClick={(data) => {
                    if (data && data.tab) {
                        setActiveTab(data.tab);
                    }
                }}
            />

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
                <div className={activeTab === 'dashboard' ? 'block h-full page-transition' : 'hidden'}>
                    <Dashboard orders={orders} settings={settings} currentUser={currentUser} onViewArchive={handleViewArchive} onFilterByStatus={handleDashboardFilter} onGoToPaymentApprovals={handleGoToPaymentApprovals} onGoToExitApprovals={handleGoToExitApprovals} onGoToBijakApprovals={handleGoToWarehouseApprovals} onGoToPurchaseApprovals={handleGoToPurchaseApprovals} financialYear={financialYear} />
                </div>
                {activeTab === 'create' && <div className="page-transition flex flex-col flex-1 min-h-0"><CreateOrder onSuccess={handleOrderCreated} currentUser={currentUser} /></div>}
                {activeTab === 'manage' && <div className="page-transition flex flex-col flex-1 min-h-0"><ManageOrders orders={orders} refreshData={() => loadData(true)} currentUser={currentUser} initialTab={manageOrdersInitialTab} settings={settings} statusFilter={dashboardStatusFilter} financialYear={financialYear} /></div>}
                {activeTab === 'create-exit' && <div className="page-transition flex flex-col flex-1 min-h-0"><CreateExitPermit onSuccess={() => setActiveTab('manage-exit')} currentUser={currentUser} /></div>}
                {activeTab === 'manage-invoices' && <div className="page-transition flex flex-col flex-1 min-h-0"><ManageExitPermits currentUser={currentUser} settings={settings} statusFilter={exitPermitStatusFilter} financialYear={financialYear} mode="INVOICE" /></div>}
                {activeTab === 'manage-exit' && <div className="page-transition flex flex-col flex-1 min-h-0"><ManageExitPermits currentUser={currentUser} settings={settings} statusFilter={exitPermitStatusFilter} financialYear={financialYear} mode="EXIT" /></div>}
                {activeTab === 'warehouse' && <div className="page-transition flex flex-col flex-1 min-h-0"><WarehouseModule currentUser={currentUser} settings={settings} initialTab={warehouseInitialTab} financialYear={financialYear} /></div>}
                {activeTab === 'trade' && <div className="page-transition flex flex-col flex-1 min-h-0"><TradeModule currentUser={currentUser} /></div>}
                {activeTab === 'balances' && <div className="page-transition flex flex-col flex-1 min-h-0"><CustomerBalanceModule currentUser={currentUser} /></div>}
                {activeTab === 'sales' && <div className="page-transition flex flex-col flex-1 min-h-0"><SalesCRMModule /></div>}
                {activeTab === 'products' && <div className="page-transition flex flex-col flex-1 min-h-0"><ProductsModule /></div>}
                {activeTab === 'tickets' && <div className="page-transition flex flex-col flex-1 min-h-0"><Tickets /></div>}
                {activeTab === 'ccti' && <div className="page-transition flex flex-col flex-1 min-h-0"><CctiConverter /></div>}
                {activeTab === 'users' && <div className="page-transition flex flex-col flex-1 min-h-0"><ManageUsers /></div>}
                {activeTab === 'settings' && <div className="page-transition flex flex-col flex-1 min-h-0"><Settings financialYear={financialYear} settings={settings} onUpdateSettings={setSettings} /></div>}
                {(activeTab === 'knowledge' || activeTab === 'notes') && <div className="page-transition flex flex-col flex-1 min-h-0"><KnowledgeBaseModule currentUser={currentUser} settings={settings} onUpdateSettings={setSettings} /></div>}
                {activeTab === 'security' && <div className="page-transition flex flex-col flex-1 min-h-0"><SecurityModule currentUser={currentUser} financialYear={financialYear} /></div>}
                {activeTab === 'meetings' && <div className="page-transition flex flex-col flex-1 min-h-0"><MeetingModule currentUser={currentUser} /></div>}
                {activeTab === 'purchase' && <div className="page-transition flex flex-col flex-1 min-h-0"><PurchaseModule currentUser={currentUser} settings={settings || undefined} initialTab={purchaseInitialTab} /></div>}
                
                <div className={activeTab === 'chat' ? 'flex-1 flex flex-col w-full min-h-0 page-transition' : 'fixed inset-0 pointer-events-none opacity-0 invisible overflow-hidden h-0'}>
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
