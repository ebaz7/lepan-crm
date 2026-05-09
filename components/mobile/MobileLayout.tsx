
import React from 'react';
import { Home, PlusCircle, ListChecks, User as UserIcon, Menu, Sun, Moon } from 'lucide-react';
import { User } from '../../types';

interface MobileLayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  currentUser: User;
  onLogout: () => void;
  unreadCount: number;
  theme?: 'light' | 'dark';
  toggleTheme?: () => void;
}

const MobileLayout: React.FC<MobileLayoutProps> = ({ 
  children, 
  activeTab, 
  setActiveTab, 
  currentUser,
  unreadCount,
  theme,
  toggleTheme
}) => {
  return (
    <div className="flex flex-col min-h-screen bg-transparent text-gray-800 dark:text-gray-200 pb-20">
      {/* Mobile Header */}
      <header className="glass-panel p-4 sticky top-0 z-50 flex justify-between items-center safe-pt rounded-b-3xl mx-0 shadow-lg">
        <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-2xl flex items-center justify-center font-bold shadow-lg transform rotate-3">
                {currentUser.fullName.charAt(0)}
            </div>
            <div>
              <h1 className="font-black text-sm text-gray-800 dark:text-gray-100">سیستم مدیریت</h1>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold">{currentUser.fullName}</p>
            </div>
        </div>
        
        <div className="flex items-center gap-2">
            {toggleTheme && (
                <button 
                  onClick={toggleTheme}
                  className="w-10 h-10 flex items-center justify-center rounded-2xl bg-white/20 dark:bg-black/20 backdrop-blur-md border border-white/30 dark:border-white/10 text-gray-700 dark:text-gray-300 shadow-sm"
                >
                    {theme === 'light' ? <Moon size={20} /> : <Sun size={20} className="text-yellow-400" />}
                </button>
            )}
        </div>
      </header>

      {/* Content Area */}
      <main className="flex-1 p-4 overflow-y-auto">
        {children}
      </main>

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-4 left-4 right-4 glass-panel border border-white/30 dark:border-white/10 flex justify-around items-center py-3 rounded-3xl z-50 shadow-2xl backdrop-blur-2xl">
        <button 
          onClick={() => setActiveTab('dashboard')} 
          className={`flex flex-col items-center gap-1 transition-all duration-300 ${activeTab === 'dashboard' ? 'text-blue-600 scale-110' : 'text-gray-400'}`}
        >
          <Home size={22} strokeWidth={activeTab === 'dashboard' ? 2.5 : 2} />
          <span className="text-[10px] font-bold">خانه</span>
        </button>

        <button 
          onClick={() => setActiveTab('create')} 
          className={`flex flex-col items-center gap-1 ${activeTab === 'create' ? 'text-blue-600' : 'text-gray-400'}`}
        >
          <PlusCircle size={24} strokeWidth={activeTab === 'create' ? 2.5 : 2} />
          <span className="text-[10px] font-bold">ثبت جدید</span>
        </button>

        <button 
          onClick={() => setActiveTab('manage')} 
          className={`flex flex-col items-center gap-1 ${activeTab === 'manage' ? 'text-blue-600' : 'text-gray-400'} relative`}
        >
          <div className="relative">
            <ListChecks size={24} strokeWidth={activeTab === 'manage' ? 2.5 : 2} />
            {unreadCount > 0 && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border border-white"></span>}
          </div>
          <span className="text-[10px] font-bold">کارتابل</span>
        </button>

        <button 
          onClick={() => setActiveTab('settings')} 
          className={`flex flex-col items-center gap-1 ${activeTab === 'settings' ? 'text-blue-600' : 'text-gray-400'}`}
        >
          <Menu size={24} strokeWidth={activeTab === 'settings' ? 2.5 : 2} />
          <span className="text-[10px] font-bold">منو</span>
        </button>
      </nav>
    </div>
  );
};

export default MobileLayout;
