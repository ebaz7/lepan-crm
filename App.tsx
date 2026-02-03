import React, { useState, useEffect, useRef } from 'react';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import CreateOrder from './components/CreateOrder';
import ManageOrders from './components/ManageOrders';
import Login from './components/Login';
import ManageUsers from './components/ManageUsers';
import Settings from './components/Settings';
import ChatRoom from './components/ChatRoom';
import TradeModule from './components/TradeModule';
import SecurityModule from './components/SecurityModule'; 
import PrintVoucher from './components/PrintVoucher'; 
import NotificationController from './components/NotificationController'; 
import { getOrders, getSettings, getMessages } from './services/storageService'; 
import { getCurrentUser, getUsers } from './services/authService';
import { PaymentOrder, User, OrderStatus, UserRole, AppNotification, SystemSettings, PaymentMethod, ChatMessage } from './types';
import { Loader2, Bell, X } from 'lucide-react';
import { generateUUID, parsePersianDate, formatCurrency } from './constants';
import { apiCall, getLocalData, LS_KEYS } from './services/apiService'; 
import { Capacitor } from '@capacitor/core';

function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTabState] = useState('dashboard');
  const [orders, setOrders] = useState<PaymentOrder[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]); 
  const [settings, setSettings] = useState<SystemSettings | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [manageOrdersInitialTab, setManageOrdersInitialTab] = useState<'current' | 'archive'>('current');
  const [dashboardStatusFilter, setDashboardStatusFilter] = useState<any>(null); 
  const [toast, setToast] = useState<{show: boolean, title: string, message: string} | null>(null);
  const [backgroundJobs, setBackgroundJobs] = useState<{order: PaymentOrder, type: 'create' | 'approve'}[]>([]);
  const processingJobRef = useRef(false);

  const setActiveTab = (tab: string) => { setActiveTabState(tab); if (!Capacitor.isNativePlatform()) window.history.pushState({ tab }, '', `#${tab}`); };

  useEffect(() => {
      const handleJob = (e: CustomEvent) => { setBackgroundJobs(prev => [...prev, e.detail]); };
      window.addEventListener('QUEUE_WHATSAPP_JOB' as any, handleJob);
      return () => window.removeEventListener('QUEUE_WHATSAPP_JOB' as any, handleJob);
  }, []);

  useEffect(() => { if (backgroundJobs.length > 0 && !processingJobRef.current) processNextJob(); }, [backgroundJobs]);

  const processNextJob = async () => {
      processingJobRef.current = true;
      const job = backgroundJobs[0];
      const { order, type } = job;
      await new Promise(resolve => setTimeout(resolve, 2000));
      const element = document.getElementById(`bg-print-voucher-${order.id}`);
      if (element) {
          try {
              // @ts-ignore
              const canvas = await window.html2canvas(element, { scale: 2, backgroundColor: '#ffffff' });
              const base64 = canvas.toDataURL('image/png').split(',')[1];
              const usersList = await getUsers();
              let targetUser: User | undefined;
              let caption = '';
              if (type === 'create') {
                  targetUser = usersList.find(u => u.role === UserRole.FINANCIAL && u.phoneNumber);
                  caption = `📢 *درخواست پرداخت جدید*\nشماره: ${order.trackingNumber}\nمبلغ: ${formatCurrency(order.totalAmount)}`;
              }
              if (targetUser && targetUser.phoneNumber) {
                  await apiCall('/send-whatsapp', 'POST', { number: targetUser.phoneNumber, message: caption, mediaData: { data: base64, mimeType: 'image/png' } });
              }
          } catch (e) {}
      }
      setBackgroundJobs(prev => prev.slice(1));
      processingJobRef.current = false;
  };

  useEffect(() => { const user = getCurrentUser(); if (user) setCurrentUser(user); }, []);

  const loadData = async (silent = false) => {
    if (!currentUser) return;
    if (!silent && orders.length === 0) setLoading(true);
    try {
        const [ordersData, settingsData, messagesData] = await Promise.all([getOrders(), getSettings(), getMessages()]);
        setSettings(settingsData);
        setOrders(Array.isArray(ordersData) ? ordersData : []);
        setChatMessages(Array.isArray(messagesData) ? messagesData : []); 
    } catch (error) {} finally { if (!silent) setLoading(false); }
  };

  useEffect(() => { if (currentUser) { loadData(false); const interval = setInterval(() => loadData(true), 10000); return () => clearInterval(interval); } }, [currentUser]);

  const handleLogin = (user: User) => { setCurrentUser(user); setActiveTab('dashboard'); };

  return (
    <>
        {!currentUser ? (
            <Login onLogin={handleLogin} />
        ) : (
            <Layout 
            activeTab={activeTab} 
            setActiveTab={setActiveTab} 
            currentUser={currentUser} 
            onLogout={() => setCurrentUser(null)} 
            notifications={notifications} 
            clearNotifications={() => setNotifications([])}
            onAddNotification={(t, m) => setNotifications(prev => [{ id: generateUUID(), title: t, message: m, timestamp: Date.now(), read: false }, ...prev])}
            onRemoveNotification={(id) => setNotifications(prev => prev.filter(n => n.id !== id))}
            >
            <NotificationController currentUser={currentUser} />
            {backgroundJobs.length > 0 && (
                <div className="hidden-print-export" style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}>
                    <div id={`bg-print-voucher-${backgroundJobs[0].order.id}`}>
                        <PrintVoucher order={backgroundJobs[0].order} embed settings={settings} />
                    </div>
                </div>
            )}
            {loading ? ( <div className="flex h-[50vh] items-center justify-center"><Loader2 size={48} className="animate-spin text-blue-600" /></div> ) : (
                <>
                    {activeTab === 'dashboard' && <Dashboard orders={orders} settings={settings} currentUser={currentUser} onGoToPaymentApprovals={() => {setDashboardStatusFilter('cartable_financial'); setActiveTab('manage');}} onGoToExitApprovals={()=>{}} onGoToBijakApprovals={()=>{}} />}
                    {activeTab === 'create' && <CreateOrder onSuccess={() => setActiveTab('manage')} currentUser={currentUser} />}
                    {activeTab === 'manage' && <ManageOrders orders={orders} refreshData={() => loadData(true)} currentUser={currentUser} initialTab={manageOrdersInitialTab} settings={settings} statusFilter={dashboardStatusFilter} />}
                    {activeTab === 'trade' && <TradeModule currentUser={currentUser} />}
                    {activeTab === 'users' && <ManageUsers />}
                    {activeTab === 'settings' && <Settings />}
                    {activeTab === 'security' && <SecurityModule currentUser={currentUser} />}
                    {activeTab === 'chat' && <ChatRoom currentUser={currentUser} preloadedMessages={chatMessages} onRefresh={() => loadData(true)} />} 
                </>
            )}
            </Layout>
        )}
    </>
  );
}
export default App;
