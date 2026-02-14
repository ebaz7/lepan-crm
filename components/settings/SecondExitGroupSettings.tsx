
import React from 'react';
import { SystemSettings, Contact, ExitPermitStatus } from '../../types';
import { Users, CheckSquare, Square, MessageCircle, Send } from 'lucide-react';

interface Props {
    settings: SystemSettings;
    setSettings: (s: SystemSettings) => void;
    contacts: Contact[];
}

const SecondExitGroupSettings: React.FC<Props> = ({ settings, setSettings, contacts }) => {
    
    const config = settings.exitPermitSecondGroupConfig || { groupId: '', activeStatuses: [] };

    const updateConfig = (key: string, value: any) => {
        const newConfig = { ...config, [key]: value };
        setSettings({ ...settings, exitPermitSecondGroupConfig: newConfig });
    };

    const toggleStatus = (status: string) => {
        let newStatuses = [...config.activeStatuses];
        if (newStatuses.includes(status)) {
            newStatuses = newStatuses.filter(s => s !== status);
        } else {
            newStatuses.push(status);
        }
        updateConfig('activeStatuses', newStatuses);
    };

    const statusOptions = [
        { value: ExitPermitStatus.PENDING_FACTORY, label: 'پس از تایید مدیرعامل (ارسال به کارخانه)' },
        { value: ExitPermitStatus.PENDING_WAREHOUSE, label: 'پس از تایید مدیر کارخانه (ارسال به انبار)' },
        { value: ExitPermitStatus.PENDING_SECURITY, label: 'پس از تایید انبار (ارسال به انتظامات)' },
        { value: ExitPermitStatus.EXITED, label: 'خروج نهایی (تایید انتظامات)' },
    ];

    return (
        <div className="mt-4 border-t-2 border-orange-200 pt-4 bg-orange-100/50 p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-3 text-orange-900 font-bold text-sm">
                <Users size={18}/>
                تنظیمات گروه دوم (ارسال سفارشی)
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                {/* WhatsApp */}
                <div className="bg-white p-2 rounded border border-orange-200">
                    <div className="flex items-center gap-1 mb-1 text-green-700 font-bold text-[10px]">
                        <MessageCircle size={12}/> واتساپ
                    </div>
                    <select 
                        className="w-full border rounded p-1.5 text-xs bg-white" 
                        value={config.groupId} 
                        onChange={e => updateConfig('groupId', e.target.value)}
                    >
                        <option value="">-- انتخاب --</option>
                        {contacts.map(c => (
                            <option key={`sec_group_${c.number}`} value={c.number}>
                                {c.name} {c.isGroup ? '(گروه)' : ''}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Bale */}
                <div className="bg-white p-2 rounded border border-orange-200">
                    <div className="flex items-center gap-1 mb-1 text-cyan-700 font-bold text-[10px]">
                        <Send size={12}/> بله (شناسه)
                    </div>
                    <input 
                        className="w-full border rounded p-1.5 text-xs dir-ltr" 
                        placeholder="ID..." 
                        value={config.baleId || ''}
                        onChange={e => updateConfig('baleId', e.target.value)}
                    />
                </div>

                {/* Telegram */}
                <div className="bg-white p-2 rounded border border-orange-200">
                    <div className="flex items-center gap-1 mb-1 text-blue-700 font-bold text-[10px]">
                        <Send size={12}/> تلگرام (Chat ID)
                    </div>
                    <input 
                        className="w-full border rounded p-1.5 text-xs dir-ltr" 
                        placeholder="-100..." 
                        value={config.telegramId || ''}
                        onChange={e => updateConfig('telegramId', e.target.value)}
                    />
                </div>
            </div>

            {(config.groupId || config.baleId || config.telegramId) && (
                <div>
                    <label className="text-xs font-bold text-gray-700 block mb-2">در چه مراحلی پیام ارسال شود؟</label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {statusOptions.map(opt => {
                            const isChecked = config.activeStatuses.includes(opt.value);
                            return (
                                <div 
                                    key={opt.value} 
                                    onClick={() => toggleStatus(opt.value)}
                                    className={`flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors ${isChecked ? 'bg-orange-200 border-orange-400' : 'bg-white border-gray-300'}`}
                                >
                                    {isChecked ? <CheckSquare size={16} className="text-orange-700"/> : <Square size={16} className="text-gray-400"/>}
                                    <span className="text-xs text-gray-800">{opt.label}</span>
                                </div>
                            );
                        })}
                    </div>
                    <p className="text-[10px] text-gray-500 mt-2">
                        * پیام فقط در مراحل انتخاب شده برای این گروه ارسال خواهد شد.
                    </p>
                </div>
            )}
        </div>
    );
};

export default SecondExitGroupSettings;
