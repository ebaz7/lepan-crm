import React, { useState, useEffect } from 'react';
import { User, SystemSettings, OfficialLetter, LetterStatus, LetterComment, UserRole } from '../types';
import { getLetters, saveLetter, updateLetter, deleteLetter, getSettings } from '../services/storageService';
import { getUsers } from '../services/authService';
import { generateUUID, formatDate } from '../constants';
import { Mail, CheckCircle, Clock, Archive, Plus, Search, Eye, Filter, Edit, Send } from 'lucide-react';
import PrintLetter from './print/PrintLetter';
import { apiCall } from '../services/apiService';
import CreateLetterModal from './secretariat/CreateLetterModal';
import LetterViewModal from './secretariat/LetterViewModal';

const SecretariatModule: React.FC<{ currentUser: User }> = ({ currentUser }) => {
    const [letters, setLetters] = useState<OfficialLetter[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [settings, setSettings] = useState<SystemSettings | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const [activeTab, setActiveTab] = useState<'INBOX' | 'FACTORY' | 'CENTRAL' | 'ARCHIVE'>('INBOX');
    const [isCreating, setIsCreating] = useState(false);
    const [viewingLetter, setViewingLetter] = useState<OfficialLetter | null>(null);

    useEffect(() => {
        const load = async () => {
            const [lData, uData, sData] = await Promise.all([getLetters(), getUsers(), getSettings()]);
            setLetters(lData);
            setUsers(uData);
            setSettings(sData);
            setIsLoading(false);
        };
        load();
    }, []);

    const myInboxLetters = letters.filter(l => 
        l.status === LetterStatus.PENDING_SIGNATURE && 
        l.signatures.some(s => s.userId === currentUser.id && !s.signedAt)
    );

    const filteredLetters = letters.filter(l => {
        if (activeTab === 'INBOX') return myInboxLetters.includes(l);
        if (activeTab === 'FACTORY') return l.branch === 'FACTORY' && l.status !== LetterStatus.ARCHIVED;
        if (activeTab === 'CENTRAL') return l.branch === 'CENTRAL' && l.status !== LetterStatus.ARCHIVED;
        if (activeTab === 'ARCHIVE') return l.status === LetterStatus.ARCHIVED;
        return true;
    });

    return (
        <div className="space-y-6 animate-fade-in pb-20">
            {isCreating && <CreateLetterModal currentUser={currentUser} settings={settings} allUsers={users} onClose={() => setIsCreating(false)} onSuccess={() => { setIsCreating(false); getLetters().then(setLetters); }} />}
            {viewingLetter && <LetterViewModal letter={viewingLetter} currentUser={currentUser} settings={settings} onClose={() => setViewingLetter(null)} onUpdate={() => getLetters().then(setLetters)} />}
            {/* Header + Tabs */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/70 backdrop-blur pb-4 border-b sticky top-0 z-30">
                <div className="flex items-center gap-2">
                    <Mail className="text-blue-600" size={28} />
                    <h1 className="text-2xl font-black text-gray-800 tracking-tight">دبیرخانه</h1>
                </div>
                
                <div className="flex gap-2 bg-gray-100 p-1.5 rounded-xl overflow-x-auto w-full sm:w-auto overflow-hidden">
                    <button onClick={() => setActiveTab('INBOX')} className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${activeTab === 'INBOX' ? 'bg-white text-blue-600 shadow-md transform scale-105' : 'text-gray-500 hover:text-gray-700'}`}>
                        کارتابل من
                        {myInboxLetters.length > 0 && <span className="ml-2 bg-red-500 text-white px-2 py-0.5 rounded-full text-[10px]">{myInboxLetters.length}</span>}
                    </button>
                    <button onClick={() => setActiveTab('FACTORY')} className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${activeTab === 'FACTORY' ? 'bg-white text-blue-600 shadow-md transform scale-105' : 'text-gray-500 hover:text-gray-700'}`}>کارخانه</button>
                    <button onClick={() => setActiveTab('CENTRAL')} className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${activeTab === 'CENTRAL' ? 'bg-white text-blue-600 shadow-md transform scale-105' : 'text-gray-500 hover:text-gray-700'}`}>دفتر مرکزی</button>
                    <button onClick={() => setActiveTab('ARCHIVE')} className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${activeTab === 'ARCHIVE' ? 'bg-white text-blue-600 shadow-md transform scale-105' : 'text-gray-500 hover:text-gray-700'}`}>بایگانی</button>
                </div>

                {(currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.MANAGER) && (
                    <button onClick={() => setIsCreating(true)} className="bg-blue-600 text-white font-bold px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-blue-700 shadow-lg hover:shadow-xl transition-all">
                        <Plus size={18} /> ایجاد نامه جدید
                    </button>
                )}
            </div>

            {/* List */}
            {isLoading ? (
                <div className="flex items-center justify-center py-20 text-blue-600 animate-pulse">در حال بارگزاری...</div>
            ) : filteredLetters.length === 0 ? (
                <div className="text-center py-20 bg-gray-50 rounded-3xl border border-dashed border-gray-300">
                    <Mail size={48} className="mx-auto text-gray-300 mb-4" />
                    <h3 className="text-lg font-bold text-gray-600">ورودی یافت نشد</h3>
                    <p className="text-sm text-gray-400">نامه‌ای در این بخش وجود ندارد.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredLetters.map(letter => (
                        <div key={letter.id} className="glass-panel p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg transition-all relative">
                            {/* Status Indicator */}
                            {letter.status === LetterStatus.PENDING_SIGNATURE && <div className="absolute top-0 left-0 right-0 h-1 bg-amber-400 animate-pulse"></div>}
                            {letter.status === LetterStatus.SIGNED && <div className="absolute top-0 left-0 right-0 h-1 bg-green-500"></div>}
                            
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="font-bold text-gray-800 text-lg mb-1">{letter.subject}</h3>
                                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">شماره: {letter.letterNumber}</span>
                                </div>
                                <span className={`px-2 py-1 rounded-lg text-xs font-bold ${
                                    letter.status === LetterStatus.PENDING_SIGNATURE ? 'bg-amber-100 text-amber-700' : 
                                    letter.status === LetterStatus.SIGNED ? 'bg-green-100 text-green-700' : 
                                    letter.status === LetterStatus.ARCHIVED ? 'bg-gray-100 text-gray-700' : 'bg-gray-100 text-gray-700'
                                }`}>
                                    {letter.status === LetterStatus.PENDING_SIGNATURE ? 'در انتظار امضا' : 
                                     letter.status === LetterStatus.SIGNED ? 'امضا شده' : 
                                     letter.status === LetterStatus.ARCHIVED ? 'بایگانی' : 'پیشنویس'}
                                </span>
                            </div>

                            <div className="space-y-2 mb-6">
                                <div className="flex flex-col gap-1 text-sm">
                                    <span className="text-gray-500">تاریخ: <span className="text-gray-800 font-medium">{letter.date}</span></span>
                                    <span className="text-gray-500">گیرنده: <span className="text-gray-800 font-medium">{letter.recipient}</span></span>
                                    <span className="text-gray-500">شرکت: <span className="text-gray-800 font-medium">{letter.company}</span></span>
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-gray-100">
                                <button onClick={() => setViewingLetter(letter)} className="bg-blue-50 text-blue-600 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-blue-100">
                                    <Eye size={16} /> مشاهده
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default SecretariatModule;
