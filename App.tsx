
import React, { useState, useEffect } from 'react';
import { User, PaymentOrder, SystemSettings, OrderStatus, UserRole } from './types';
import { getCurrentUser, getRolePermissions, hasPermission } from './services/authService';
import { getOrders, getSettings } from './services/storageService';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import CreateOrder from './components/CreateOrder';
import ManageOrders from './components/ManageOrders';
import TradeModule from './components/TradeModule';
import BrokerageWarehouse from './components/BrokerageWarehouse';
import Login from './components/Login';
import ManageUsers from './components/ManageUsers';
import SettingsComponent from './components/Settings';
import ChatRoom from './components/ChatRoom';
import SecurityModule from './components/SecurityModule';
import NotificationController from './components/NotificationController';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(getCurrentUser());
  const [activeTab, setActiveTab] = useState('dashboard');
  const [orders, setOrders] = useState<PaymentOrder[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [dashboardStatusFilter, setDashboardStatusFilter] = useState<any>(null);
  const [manageOrdersInitialTab, setManageOrdersInitialTab] = useState<'current' | 'archive'>('current');
  const [loading, setLoading] = useState(true);

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [ordersData, settingsData] = await Promise.all([
        getOrders(),
        getSettings()
      ]);
      setOrders(ordersData);
      setSettings(settingsData);
    } catch (error) {
      console.error("Data loading error", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      loadData();
    }
  }, [currentUser]);

  if (!currentUser) {
    return <Login onLogin={setCurrentUser} />;
  }

  return (
    <Layout 
      currentUser={currentUser} 
      activeTab={activeTab} 
      setActiveTab={(tab) => {
        setActiveTab(tab);
        setDashboardStatusFilter(null);
      }}
      onLogout={() => {
        setCurrentUser(null);
        window.location.reload();
      }}
    >
      <NotificationController currentUser={currentUser} />
      <div className="container mx-auto p-4 md:p-6">
        {activeTab === 'dashboard' && (
          <Dashboard 
            orders={orders} 
            settings={settings || undefined} 
            currentUser={currentUser} 
            onGoToPaymentApprovals={() => {
                setDashboardStatusFilter('cartable_financial'); 
                setActiveTab('manage');
            }} 
            onGoToExitApprovals={() => {}} 
            onGoToBijakApprovals={() => {}} 
            onFilterByStatus={(status) => {
                setDashboardStatusFilter(status);
                setActiveTab('manage');
            }}
          />
        )}
        
        {activeTab === 'create' && (
          <CreateOrder 
            onSuccess={() => setActiveTab('manage')} 
            currentUser={currentUser} 
          />
        )}
        
        {activeTab === 'manage' && (
          <ManageOrders 
            orders={orders} 
            refreshData={() => loadData(true)} 
            currentUser={currentUser} 
            initialTab={manageOrdersInitialTab} 
            settings={settings || undefined} 
            statusFilter={dashboardStatusFilter} 
          />
        )}
        
        {activeTab === 'brokerage_warehouse' && (
          <BrokerageWarehouse currentUser={currentUser} settings={settings || undefined} />
        )}

        {activeTab === 'trade' && (
          <TradeModule currentUser={currentUser} />
        )}

        {activeTab === 'users' && <ManageUsers />}
        {activeTab === 'settings' && <SettingsComponent />}
        {activeTab === 'security' && <SecurityModule currentUser={currentUser} />}
        {activeTab === 'chat' && (
          <ChatRoom 
            currentUser={currentUser} 
            preloadedMessages={[]} 
            onRefresh={() => loadData(true)} 
          />
        )}
      </div>
    </Layout>
  );
};

// Fix: index.tsx expected a default export
export default App;
