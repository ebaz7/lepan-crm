
import React from 'react';
import { LayoutDashboard, PlusCircle, ListChecks, FileText, Users, LogOut, Settings, MessageSquare, Container, Shield, Warehouse, Landmark } from 'lucide-react';
import { User, UserRole, SystemSettings } from '../types';
import { hasPermission, getRolePermissions } from '../services/authService';
import { FiscalYearSwitcher } from './FiscalModule';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  currentUser: User;
  onLogout: () => void;
  settings?: SystemSettings | null;
}

const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab, currentUser, onLogout, settings }) => {
  const perms = getRolePermissions(currentUser.role, settings || null, currentUser);
  
  const canCreatePayment = perms.canCreatePaymentOrder;
  const canViewPayment = perms.canViewPaymentOrders;
  const canSeeSecurity = perms.canViewSecurity;
  const canSeeTrade = perms.canManageTrade;
  const canSeeSettings = perms.canManageSettings;

  const navItems = [
    { id: 'dashboard', label: 'داشبورد', icon: LayoutDashboard },
  ];
  
  if (canCreatePayment) navItems.push({ id: 'create', label: 'ثبت پرداخت', icon: PlusCircle });
  if (canViewPayment) navItems.push({ id: 'manage', label: 'سوابق پرداخت', icon: ListChecks });
  if (canSeeSecurity) navItems.push({ id: 'security', label: 'انتظامات', icon: Shield });
  
  // NEW NAV ITEM
  navItems.push({ id: 'brokerage_warehouse', label: 'انبار بنگاه', icon: Warehouse });

  navItems.push({ id: 'chat', label: 'گفتگو', icon: MessageSquare });
  if (canSeeTrade) navItems.push({ id: 'trade', label: 'بازرگانی', icon: Container });
  if (hasPermission(currentUser, 'manage_users')) navItems.push({ id: 'users', label: 'کاربران', icon: Users });
  if (canSeeSettings) navItems.push({ id: 'settings', label: 'تنظیمات', icon: Settings });

  return (
    <div className="min-h-screen bg-gray-50 font-sans" dir="rtl">
      {/* Sidebar for Desktop */}
      <aside className="fixed inset-y-0 right-0 w-64 bg-white border-l border-gray-200 hidden lg:flex flex-col z-50 shadow-sm">
        <div className="p-6 flex items-center gap-3 border-b border-gray-100">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
            {/* Added Landmark icon to fix build error */}
            <Landmark size={24} />
          </div>
          <span className="font-black text-xl text-gray-800">سیستم مالی</span>
        </div>
        
        <div className="p-4 flex-1 overflow-y-auto">
          <nav className="space-y-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                  activeTab === item.id 
                    ? 'bg-blue-50 text-blue-700 shadow-sm' 
                    : 'text-gray-50 hover:bg-gray-50 hover:text-gray-700'
                }`}
              >
                <item.icon size={20} />
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-4 border-t border-gray-100 space-y-2">
          <FiscalYearSwitcher />
          <div className="flex items-center gap-3 px-4 py-3 mb-2 bg-gray-50 rounded-xl border border-gray-200">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold overflow-hidden border-2 border-white shadow-sm">
               {currentUser.avatar ? <img src={currentUser.avatar} className="w-full h-full object-cover" alt="avatar" /> : currentUser.fullName.charAt(0)}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-black text-gray-800 truncate max-w-[120px]">{currentUser.fullName}</span>
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">{currentUser.role}</span>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-red-600 hover:bg-red-50 transition-all"
          >
            <LogOut size={20} />
            خروج از حساب
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="lg:pr-64 min-h-screen">
        {/* Mobile Header */}
        <header className="lg:hidden bg-white border-b border-gray-200 p-4 sticky top-0 z-40 flex justify-between items-center shadow-sm">
          <h1 className="font-black text-lg text-gray-800">سیستم مالی</h1>
          <button onClick={onLogout} className="p-2 text-red-500 bg-red-50 rounded-lg"><LogOut size={20} /></button>
        </header>

        {/* Content Wrapper */}
        <div className="max-w-7xl mx-auto p-4 md:p-8">
            {children}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-2 py-2 flex justify-around items-center z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] pb-safe">
        {navItems.slice(0, 5).map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${
              activeTab === item.id ? 'text-blue-600 scale-110' : 'text-gray-400'
            }`}
          >
            <item.icon size={24} strokeWidth={activeTab === item.id ? 2.5 : 2} />
            <span className="text-[9px] font-black">{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};

export default Layout;
