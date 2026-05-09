
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
    <div className="flex flex-col min-h-screen bg-transparent text-gray-800 dark:text-gray-200 pb-20 relative overflow-hidden">
      {/* Background Blobs for fluid depth */}
      <div className="bg-blobs">
          <div className="blob blob-1"></div>
          <div className="blob blob-2"></div>
      </div>

      {/* Mobile Header */}
      <header className="glass-header p-4 sticky top-0 z-50 flex justify-between items-center safe-pt rounded-b-[2.5rem] shadow-2xl border-none">
        <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-2xl flex items-center justify-center font-bold shadow-xl border-2 border-white/40 rotate-2">
                {currentUser.fullName.charAt(0)}
            </div>
            <div>
              <h1 className="font-black text-xs text-gray-900 dark:text-gray-100 uppercase tracking-widest leading-none mb-1">سیستم مدیریت</h1>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold">{currentUser.fullName}</p>
            </div>
        </div>
        
        <div className="flex items-center gap-2">
            {toggleTheme && (
                <button 
                  onClick={toggleTheme}
                  className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/20 dark:bg-white/10 backdrop-blur-3xl border border-white/40 dark:border-white/10 text-gray-700 dark:text-gray-300 shadow-lg transition-transform active:scale-95"
                >
                    {theme === 'light' ? <Moon size={20} /> : <Sun size={20} className="text-yellow-400" />}
                </button>
            )}
        </div>
      </header>

      {/* Content Area */}
      <main className="flex-1 p-4 overflow-y-auto relative z-10">
        {children}
      </main>

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-6 left-6 right-6 glass-panel border border-white/50 dark:border-white/10 flex justify-around items-center py-3 rounded-[2.5rem] z-50 shadow-2xl backdrop-blur-3xl">
        <button 
          onClick={() => setActiveTab('dashboard')} 
          className={`flex flex-col items-center gap-1 transition-all duration-300 ${activeTab === 'dashboard' ? 'text-blue-600 scale-110 font-bold' : 'text-gray-400'}`}
        >
          <Home size={22} strokeWidth={activeTab === 'dashboard' ? 2.5 : 2} />
          <span className="text-[9px] font-bold">خانه</span>
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
