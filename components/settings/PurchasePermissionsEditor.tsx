
import React, { useState } from 'react';
import { SystemSettings, UserRole, PurchaseRolePermissions, CustomRole } from '../../types';
import { ShoppingCart, CheckSquare, ShieldCheck, ChevronDown, ChevronUp, Lock, Info } from 'lucide-react';

interface Props {
    settings: SystemSettings;
    onUpdateSettings: (newSettings: SystemSettings) => void;
}

const PURCHASE_PERMISSIONS = [
    { id: 'canView', label: 'مشاهده ماژول درخواست خرید (کارتابل)' },
    { id: 'canCreate', label: 'ثبت درخواست خرید جدید' },
    { id: 'canApproveTechnical', label: 'بررسی و تایید فنی (واحد فنی/تولید)' },
    { id: 'canApproveFactory', label: 'تایید مدیر کارخانه' },
    { id: 'canApproveCEO', label: 'تایید مدیرعامل / مدیر واحد' },
    { id: 'canManageProformas', label: 'ثبت پیش‌فاکتورها و استعلام (بازرگانی)' },
    { id: 'canSelectProforma', label: 'انتخاب بهترین گزینه خرید' },
    { id: 'canRegisterEntry', label: 'ثبت ورود فیزیکی کالا (انتظامات)' },
    { id: 'canCheckQC', label: 'تایید کنترل کیفیت (QC)' },
    { id: 'canApproveFactoryFinal', label: 'تایید نهایی مدیر کارخانه (بعد از ورود)' },
    { id: 'canWarehouseFinalize', label: 'صدور رسید انبار نهایی' },
    { id: 'canCommercialFinalize', label: 'تایید نهایی و بایگانی بازرگانی' },
];

const DEFAULT_ROLES = [
    { id: UserRole.USER, label: 'کاربر عادی' },
    { id: UserRole.FINANCIAL, label: 'مدیر مالی' },
    { id: UserRole.MANAGER, label: 'مدیر داخلی' },
    { id: UserRole.CEO, label: 'مدیر عامل' },
    { id: UserRole.SALES_MANAGER, label: 'مدیر فروش' },
    { id: UserRole.FACTORY_MANAGER, label: 'مدیر کارخانه' },
    { id: UserRole.WAREHOUSE_KEEPER, label: 'انبار واردات' },
    { id: UserRole.SECURITY_HEAD, label: 'سرپرست انتظامات' },
    { id: UserRole.SECURITY_GUARD, label: 'نگهبان' },
    { id: UserRole.COMMERCIAL, label: 'واحد بازرگانی' },
    { id: UserRole.QC, label: 'کنترل کیفی (QC)' },
    { id: UserRole.ADMIN, label: 'مدیر سیستم' },
];

const PurchasePermissionsEditor: React.FC<Props> = ({ settings, onUpdateSettings }) => {
    const [expandedRole, setExpandedRole] = useState<string | null>(null);
    const allRoles = [...DEFAULT_ROLES, ...(settings.customRoles || [])];

    const toggleExpand = (roleId: string) => {
        setExpandedRole(prev => prev === roleId ? null : roleId);
    };

    const handlePermissionChange = (roleId: string, permKey: string, value: boolean) => {
        const currentBatch = settings.purchaseRolePermissions || {};
        const rolePerms = currentBatch[roleId] || {};
        
        const updatedRolePerms = {
            ...rolePerms,
            [permKey]: value
        };

        const newSettings = {
            ...settings,
            purchaseRolePermissions: {
                ...currentBatch,
                [roleId]: updatedRolePerms
            }
        };

        onUpdateSettings(newSettings);
    };

    const toggleAll = (roleId: string, isChecked: boolean) => {
        const currentBatch = settings.purchaseRolePermissions || {};
        const updatedRolePerms: any = {};
        
        PURCHASE_PERMISSIONS.forEach(px => {
            updatedRolePerms[px.id] = isChecked;
        });

        const newSettings = {
            ...settings,
            purchaseRolePermissions: {
                ...currentBatch,
                [roleId]: updatedRolePerms
            }
        };
        onUpdateSettings(newSettings);
    };

    return (
        <div className="space-y-6">
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start gap-3">
                <Info className="text-amber-600 shrink-0 mt-1" size={20}/>
                <div className="text-sm text-amber-800">
                    <p className="font-bold mb-1">تنظیمات وظایف در فرآیند خرید:</p>
                    <p>در این بخش می‌توانید مشخص کنید هر نقش کاربری در فرآیند 12 مرحله‌ای خرید چه وظایفی بر عهده دارد. تیک زدن هر گزینه دسترسی مربوط به آن وضعیت را برای کاربر باز می‌کند.</p>
                </div>
            </div>

            <div className="space-y-3">
                {allRoles.map(role => (
                    <div key={role.id} className="glass-panel border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all">
                        <div 
                            className={`p-4 flex justify-between items-center cursor-pointer select-none transition-colors ${expandedRole === role.id ? 'bg-amber-50' : 'bg-gray-50 dark:bg-gray-900/40 text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:bg-gray-800/40 text-gray-800 dark:text-gray-200'}`}
                            onClick={() => toggleExpand(role.id)}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${role.id === UserRole.ADMIN ? 'bg-red-100 text-red-600' : 'glass-panel border text-gray-600'}`}>
                                    <ShieldCheck size={20}/>
                                </div>
                                <div>
                                    <span className="font-bold text-gray-800 block">{role.label}</span>
                                    <span className="text-[10px] text-gray-500 font-mono">{role.id}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {expandedRole === role.id ? <ChevronUp size={20} className="text-amber-600"/> : <ChevronDown size={20} className="text-gray-400"/>}
                            </div>
                        </div>
                        
                        {expandedRole === role.id && (
                            <div className="p-4 glass-panel border-t border-gray-100 animate-fade-in">
                                {role.id === UserRole.ADMIN ? (
                                    <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm font-bold text-center border border-red-100 flex items-center justify-center gap-2">
                                        <Lock size={16}/>
                                        مدیر سیستم دسترسی کامل به تمامی مراحل را دارد.
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="flex justify-end">
                                            <button 
                                                type="button"
                                                onClick={() => toggleAll(role.id, true)}
                                                className="text-[10px] text-blue-600 font-bold ml-2 underline"
                                            >انتخاب همه</button>
                                            <button 
                                                type="button"
                                                onClick={() => toggleAll(role.id, false)}
                                                className="text-[10px] text-red-600 font-bold underline"
                                            >لغو همه</button>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                            {PURCHASE_PERMISSIONS.map(perm => {
                                                const rolePerms = settings.purchaseRolePermissions?.[role.id] || {};
                                                const isChecked = !!(rolePerms as any)[perm.id];
                                                
                                                return (
                                                    <div 
                                                        key={perm.id} 
                                                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${isChecked ? 'bg-green-50 border-green-200' : 'bg-gray-50/50 border-gray-100 hover:border-gray-200'}`}
                                                        onClick={() => handlePermissionChange(role.id, perm.id, !isChecked)}
                                                    >
                                                        <div className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${isChecked ? 'bg-green-500 border-green-500' : 'bg-white border-gray-300'}`}>
                                                            {isChecked && <CheckSquare size={14} className="text-white"/>}
                                                        </div>
                                                        <span className={`text-xs font-bold leading-tight ${isChecked ? 'text-green-800' : 'text-gray-600'}`}>{perm.label}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default PurchasePermissionsEditor;
