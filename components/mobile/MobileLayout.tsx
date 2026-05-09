
import React from 'react';
import { Home, PlusCircle, ListChecks, User as UserIcon, Menu, Sun, Moon } from 'lucide-react';
import { User } from '../../types';
import { motion, AnimatePresence } from 'motion/react';

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
      <nav className="fixed bottom-6 left-6 right-6 glass-panel border border-white/50 dark:border-white/10 flex justify-around items-center py-2 rounded-[2.5rem] z-50 shadow-2xl backdrop-blur-3xl px-2">
        {(['dashboard', 'create', 'manage', 'settings'] as const).map((id) => {
          const isActive = activeTab === id;
          const config = {
            dashboard: { icon: Home, label: 'خانه' },
            create: { icon: PlusCircle, label: 'ثبت جدید' },
            manage: { icon: ListChecks, label: 'کارتابل' },
            settings: { icon: Menu, label: 'منو' }
          }[id];
          const Icon = config.icon;

          return (
            <button 
              key={id}
              onClick={() => setActiveTab(id)} 
              className={`flex flex-col items-center gap-1 p-2 transition-all duration-300 flex-1 relative`}
            >
              <div className="relative z-10 flex flex-col items-center">
                <Icon size={22} strokeWidth={isActive ? 2.5 : 2} className={isActive ? 'text-blue-600' : 'text-gray-400'} />
                <span className={`text-[9px] font-bold ${isActive ? 'text-blue-600' : 'text-gray-400'}`}>{config.label}</span>
                {isActive && unreadCount > 0 && id === 'manage' && (
                   <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border border-white"></span>
                )}
              </div>
              
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 bg-blue-50/50 dark:bg-blue-900/30 rounded-2xl -z-0"
                  transition={{ type: "spring", bounce: 0.35, duration: 0.6 }}
                />
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
};

export default MobileLayout;
