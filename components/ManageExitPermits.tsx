
import React, { useState, useEffect } from 'react';
import { ExitPermit, ExitPermitStatus, User, UserRole, SystemSettings, ExitPermitItem } from '../types';
import { getExitPermits, updateExitPermitStatus, deleteExitPermit, editExitPermit } from '../services/storageService';
import { getUsers } from '../services/authService';
import { apiCall } from '../services/apiService';
import { formatDate } from '../constants';
import { 
    Eye, Trash2, Search, CheckCircle, Truck, XCircle, Edit, Loader2, 
    Package, Archive, Filter, RefreshCw
} from 'lucide-react';
import PrintExitPermit from './PrintExitPermit';
import WarehouseFinalizeModal from './WarehouseFinalizeModal'; 

const ManageExitPermits: React.FC<{ currentUser: User, settings?: SystemSettings, statusFilter?: any }> = ({ currentUser, settings }) => {
    const [permits, setPermits] = useState<ExitPermit[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'MY_TURN' | 'ALL_ACTIVE' | 'ARCHIVE'>('MY_TURN');
    const [searchTerm, setSearchTerm] = useState('');
    const [viewPermit, setViewPermit] = useState<ExitPermit | null>(null);
    const [warehouseFinalize, setWarehouseFinalize] = useState<ExitPermit | null>(null);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [autoSendPermit, setAutoSendPermit] = useState<ExitPermit | null>(null); // For hidden rendering

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await getExitPermits();
            const safeData = Array.isArray(data) ? data : [];
            setPermits(safeData.sort((a, b) => b.createdAt - a.createdAt));
        } catch (e) {
            console.error("Failed to load permits", e);
            setPermits([]);
        } finally {
            setLoading(false);
        }
    };

    // --- WORKFLOW ENGINE ---
    
    // 1. Identify Next Step & Targets
    const getWorkflowStep = (status: ExitPermitStatus) => {
        switch (status) {
            case ExitPermitStatus.PENDING_CEO: return { role: UserRole.CEO, label: 'تایید مدیرعامل', next: ExitPermitStatus.PENDING_FACTORY };
            case ExitPermitStatus.PENDING_FACTORY: return { role: UserRole.FACTORY_MANAGER, label: 'تایید مدیر کارخانه', next: ExitPermitStatus.PENDING_WAREHOUSE };
            case ExitPermitStatus.PENDING_WAREHOUSE: return { role: UserRole.WAREHOUSE_KEEPER, label: 'توزین انبار', next: ExitPermitStatus.PENDING_SECURITY };
            case ExitPermitStatus.PENDING_SECURITY: return { role: UserRole.SECURITY_HEAD, label: 'خروج نهایی', next: ExitPermitStatus.EXITED };
            default: return null;
        }
    };

    const getActionRequired = (p: ExitPermit): string | null => {
        const step = getWorkflowStep(p.status);
        if (!step) return null;
        if (currentUser.role === UserRole.ADMIN) return step.label; // Admin sees everything
        if (currentUser.role === step.role) return step.label;
        if (p.status === ExitPermitStatus.PENDING_SECURITY && currentUser.role === UserRole.SECURITY_GUARD) return step.label;
        return null;
    };

    // 2. BROADCAST SYSTEM
    const broadcastMessage = async (targets: {role?: string, group?: string}[], caption: string, imageBase64: string, filename: string) => {
        const allUsers = await getUsers();
        
        for (const target of targets) {
            // Find specific users by role
            if (target.role) {
                const users = allUsers.filter(u => u.role === target.role);
                for (const u of users) {
                    if (u.phoneNumber) await apiCall('/send-whatsapp', 'POST', { number: u.phoneNumber, message: caption, mediaData: { data: imageBase64, mimeType: 'image/png', filename } });
                    if (u.telegramChatId) await apiCall('/send-telegram', 'POST', { chatId: u.telegramChatId, message: caption, mediaData: { data: imageBase64, mimeType: 'image/png', filename } });
                    if (u.baleChatId) await apiCall('/send-bale', 'POST', { chatId: u.baleChatId, message: caption, mediaData: { data: imageBase64, mimeType: 'image/png', filename } });
                }
            }
            // Find groups (Whatsapp IDs mostly)
            if (target.group) {
                await apiCall('/send-whatsapp', 'POST', { number: target.group, message: caption, mediaData: { data: imageBase64, mimeType: 'image/png', filename } });
            }
        }
    };

    const handleApprove = async (p: ExitPermit) => {
        // Warehouse step needs special modal
        if (p.status === ExitPermitStatus.PENDING_WAREHOUSE) {
            setWarehouseFinalize(p);
            return;
        }

        // Security step needs Time Input
        let exitTimeStr = '';
        if (p.status === ExitPermitStatus.PENDING_SECURITY) {
            const time = prompt('ساعت خروج را وارد کنید (مثال: 14:30):', new Date().toLocaleTimeString('fa-IR', {hour:'2-digit', minute:'2-digit'}));
            if (!time) return;
            exitTimeStr = time;
        } else {
            if (!confirm(`آیا از تایید مرحله "${getActionRequired(p)}" اطمینان دارید؟`)) return;
        }

        setProcessingId(p.id);
        
        try {
            const step = getWorkflowStep(p.status);
            if (!step) return;

            const nextStatus = step.next;
            let extra: any = {};
            if (nextStatus === ExitPermitStatus.EXITED) extra.exitTime = exitTimeStr;

            // 1. Update DB
            const updatedPermit = { ...p, status: nextStatus, ...extra };
            
            // Assign approver name based on current status
            if (p.status === ExitPermitStatus.PENDING_CEO) updatedPermit.approverCeo = currentUser.fullName;
            else if (p.status === ExitPermitStatus.PENDING_FACTORY) updatedPermit.approverFactory = currentUser.fullName;
            else if (p.status === ExitPermitStatus.PENDING_SECURITY) updatedPermit.approverSecurity = currentUser.fullName;

            await updateExitPermitStatus(p.id, nextStatus, currentUser, extra);
            
            // 2. Prepare for Auto-Send (Visual)
            // We set this state to render the hidden component with the UPDATED data
            setAutoSendPermit(updatedPermit);

            // 3. Wait for Render & Send
            setTimeout(async () => {
                const elementId = `print-permit-autosend-${updatedPermit.id}`;
                const element = document.getElementById(elementId);
                
                if (element) {
                    try {
                        // @ts-ignore
                        const canvas = await window.html2canvas(element, { scale: 2, backgroundColor: '#ffffff' });
                        const base64 = canvas.toDataURL('image/png').split(',')[1];
                        
                        // --- DEFINE TARGETS BASED ON WORKFLOW ---
                        const targets: any[] = [];
                        const group1 = settings?.exitPermitNotificationGroup;
                        const group2 = settings?.exitPermitSecondGroupConfig?.groupId;

                        let statusText = '';

                        // Logic:
                        // CEO Approved -> Send to Factory Manager + Group 1
                        if (p.status === ExitPermitStatus.PENDING_CEO) {
                            statusText = 'تایید مدیرعامل';
                            targets.push({ role: UserRole.FACTORY_MANAGER });
                            if (group1) targets.push({ group: group1 });
                        }
                        // Factory Approved -> Send to Warehouse + Group 2
                        else if (p.status === ExitPermitStatus.PENDING_FACTORY) {
                            statusText = 'تایید مدیر کارخانه';
                            targets.push({ role: UserRole.WAREHOUSE_KEEPER });
                            if (group2) targets.push({ group: group2 });
                        }
                        // Warehouse Approved (Handled in modal function below) -> Send to Security + All Groups
                        
                        // Security Approved -> Send to Archive (All Groups)
                        else if (p.status === ExitPermitStatus.PENDING_SECURITY) {
                            statusText = 'خروج نهایی (انتظامات)';
                            if (group1) targets.push({ group: group1 });
                            if (group2) targets.push({ group: group2 });
                        }

                        let caption = `🚛 *مجوز خروج کالا*\n`;
                        caption += `✅ *مرحله: ${statusText}*\n`;
                        caption += `🔢 شماره: ${updatedPermit.permitNumber}\n`;
                        caption += `👤 گیرنده: ${updatedPermit.recipientName}\n`;
                        if (extra.exitTime) caption += `🕒 ساعت خروج: ${extra.exitTime}\n`;
                        caption += `----------------\n`;
                        caption += `تایید کننده: ${currentUser.fullName}`;

                        await broadcastMessage(targets, caption, base64, `Permit_${updatedPermit.permitNumber}.png`);
                        alert('تایید و اطلاع‌رسانی شد.');

                    } catch (e) { console.error("Notification Error", e); }
                }
                
                setAutoSendPermit(null);
                setProcessingId(null);
                await loadData();
                setViewPermit(null);

            }, 2500); // Wait for render

        } catch (e) {
            alert('خطا در عملیات');
            setProcessingId(null);
        }
    };

    const handleWarehouseSubmit = async (finalItems: ExitPermitItem[]) => {
        if (!warehouseFinalize) return;
        setProcessingId(warehouseFinalize.id);
        
        try {
            const totalWeight = finalItems.reduce((acc, i) => acc + (Number(i.weight) || 0), 0);
            const totalCartons = finalItems.reduce((acc, i) => acc + (Number(i.cartonCount) || 0), 0);
            
            const updatedPermit = { 
                ...warehouseFinalize, 
                items: finalItems, 
                weight: totalWeight, 
                cartonCount: totalCartons,
                approverWarehouse: currentUser.fullName,
                status: ExitPermitStatus.PENDING_SECURITY,
                updatedAt: Date.now()
            };

            await editExitPermit(updatedPermit); // Save items
            // Update Status implicitly via edit or explicit call? 
            // Better to use editExitPermit for the data, then update status logic if separated.
            // But editExitPermit saves status too if included.
            
            // Auto-Send Logic
            setAutoSendPermit(updatedPermit);

            setTimeout(async () => {
                const elementId = `print-permit-autosend-${updatedPermit.id}`;
                const element = document.getElementById(elementId);
                if (element) {
                    try {
                        // @ts-ignore
                        const canvas = await window.html2canvas(element, { scale: 2, backgroundColor: '#ffffff' });
                        const base64 = canvas.toDataURL('image/png').split(',')[1];

                        const targets: any[] = [];
                        const group1 = settings?.exitPermitNotificationGroup;
                        const group2 = settings?.exitPermitSecondGroupConfig?.groupId;

                        // Warehouse Approved -> Send to Security + All Groups
                        targets.push({ role: UserRole.SECURITY_HEAD });
                        if (group1) targets.push({ group: group1 });
                        if (group2) targets.push({ group: group2 });

                        let caption = `🚛 *مجوز خروج کالا*\n`;
                        caption += `⚖️ *تایید و توزین انبار*\n`;
                        caption += `🔢 شماره: ${updatedPermit.permitNumber}\n`;
                        caption += `📦 وزن نهایی: ${totalWeight} kg\n`;
                        caption += `📦 تعداد نهایی: ${totalCartons} کارتن\n`;
                        caption += `----------------\n`;
                        caption += `تایید کننده: ${currentUser.fullName}`;

                        await broadcastMessage(targets, caption, base64, `Permit_${updatedPermit.permitNumber}_WH.png`);
                        alert('تایید انبار ثبت و ارسال شد.');

                    } catch (e) { console.error("Notif Error", e); }
                }
                
                setAutoSendPermit(null);
                setWarehouseFinalize(null);
                setProcessingId(null);
                await loadData();
            }, 2500);

        } catch (e) {
            alert('خطا در ثبت اطلاعات انبار');
            setProcessingId(null);
        }
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        // Only CEO/Admin can delete and notify
        if (currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.CEO) {
            alert('فقط مدیرعامل یا ادمین امکان حذف دارند.');
            return;
        }
        if (!confirm('آیا مطمئن هستید؟ پیام حذف به گروه‌ها ارسال خواهد شد.')) return;

        const permit = permits.find(p => p.id === id);
        if (!permit) return;

        setProcessingId(id);
        
        // 1. Render Deleted Version (Watermarked)
        // We use a trick: set a special state to render a "DELETED" watermark version
        const deletedMock = { ...permit, status: ExitPermitStatus.REJECTED }; // Mock status for render
        setAutoSendPermit(deletedMock); 

        setTimeout(async () => {
             const elementId = `print-permit-autosend-${deletedMock.id}`; // Will use watermarked render
             const element = document.getElementById(elementId); // Need to ensure PrintExitPermit supports watermark prop
             
             if (element) {
                 try {
                     // @ts-ignore
                     const canvas = await window.html2canvas(element, { scale: 2, backgroundColor: '#ffffff' });
                     const base64 = canvas.toDataURL('image/png').split(',')[1];

                     const targets: any[] = [];
                     const group1 = settings?.exitPermitNotificationGroup;
                     const group2 = settings?.exitPermitSecondGroupConfig?.groupId;
                     if (group1) targets.push({ group: group1 });
                     if (group2) targets.push({ group: group2 });

                     let caption = `❌ *مجوز خروج حذف شد*\n`;
                     caption += `⛔ *این مجوز فاقد اعتبار است*\n`;
                     caption += `🔢 شماره: ${permit.permitNumber}\n`;
                     caption += `حذف توسط: ${currentUser.fullName}`;

                     await broadcastMessage(targets, caption, base64, `Permit_DELETED_${permit.permitNumber}.png`);
                 } catch(e) {}
             }

             await deleteExitPermit(id);
             setAutoSendPermit(null);
             setProcessingId(null);
             loadData();
             alert('حذف شد.');
        }, 2500);
    };

    const safePermits = Array.isArray(permits) ? permits : [];
    const filteredPermits = safePermits.filter(p => {
        const searchStr = `${p.permitNumber} ${p.recipientName} ${p.goodsName}`.toLowerCase();
        if (searchTerm && !searchStr.includes(searchTerm.toLowerCase())) return false;
        const isArchived = p.status === ExitPermitStatus.EXITED || p.status === ExitPermitStatus.REJECTED;
        if (activeTab === 'ARCHIVE') return isArchived;
        if (activeTab === 'MY_TURN') return !isArchived && getActionRequired(p) !== null;
        if (activeTab === 'ALL_ACTIVE') return !isArchived;
        return true;
    });

    const getStatusConfig = (status: ExitPermitStatus) => {
        switch(status) {
            case ExitPermitStatus.PENDING_CEO: return { color: 'text-purple-600', bg: 'bg-purple-50', label: 'مدیرعامل' };
            case ExitPermitStatus.PENDING_FACTORY: return { color: 'text-orange-600', bg: 'bg-orange-50', label: 'کارخانه' };
            case ExitPermitStatus.PENDING_WAREHOUSE: return { color: 'text-blue-600', bg: 'bg-blue-50', label: 'انبار' };
            case ExitPermitStatus.PENDING_SECURITY: return { color: 'text-pink-600', bg: 'bg-pink-50', label: 'انتظامات' };
            case ExitPermitStatus.EXITED: return { color: 'text-green-600', bg: 'bg-green-50', label: 'خارج شده' };
            case ExitPermitStatus.REJECTED: return { color: 'text-red-600', bg: 'bg-red-50', label: 'رد شده' };
            default: return { color: 'text-gray-600', bg: 'bg-gray-50', label: status };
        }
    };

    return (
        <div className="space-y-4 pb-20 md:pb-0 animate-fade-in">
            {/* Hidden Renderer for Auto-Send */}
            {autoSendPermit && (
                <div className="hidden-print-export" style={{ position: 'absolute', top: '-9999px', left: '-9999px', width: '800px', zIndex: -1 }}>
                    <div id={`print-permit-autosend-${autoSendPermit.id}`}>
                        {/* Pass watermark if it's a delete operation */}
                        <PrintExitPermit 
                            permit={autoSendPermit} 
                            onClose={()=>{}} 
                            embed 
                            watermark={autoSendPermit.status === ExitPermitStatus.REJECTED ? 'DELETED' : null} 
                        />
                    </div>
                </div>
            )}

            {/* Sticky Header */}
            <div className="sticky top-0 bg-gray-50/95 backdrop-blur-sm pt-2 pb-2 z-30 space-y-3">
                <div className="flex justify-between items-center px-1">
                    <h2 className="text-xl font-black text-gray-800 flex items-center gap-2">
                        <div className="bg-white p-2 rounded-xl shadow-sm"><Truck size={20} className="text-orange-600"/></div>
                        مدیریت خروج
                    </h2>
                    <button onClick={loadData} className="p-2 bg-white rounded-full shadow-sm text-gray-500 hover:text-blue-600">
                        <RefreshCw size={18} className={loading ? "animate-spin" : ""}/>
                    </button>
                </div>

                <div className="flex gap-2 overflow-x-auto pb-1 px-1 no-scrollbar">
                    <button onClick={() => setActiveTab('MY_TURN')} className={`whitespace-nowrap px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm ${activeTab === 'MY_TURN' ? 'bg-blue-600 text-white shadow-blue-200' : 'bg-white text-gray-600 border border-gray-100'}`}>
                        نوبت من ({safePermits.filter(p => !['خارج شده (بایگانی)', 'رد شده'].includes(p.status) && getActionRequired(p)).length})
                    </button>
                    <button onClick={() => setActiveTab('ALL_ACTIVE')} className={`whitespace-nowrap px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm ${activeTab === 'ALL_ACTIVE' ? 'bg-orange-600 text-white shadow-orange-200' : 'bg-white text-gray-600 border border-gray-100'}`}>
                        جریان فعال
                    </button>
                    <button onClick={() => setActiveTab('ARCHIVE')} className={`whitespace-nowrap px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm ${activeTab === 'ARCHIVE' ? 'bg-green-600 text-white shadow-green-200' : 'bg-white text-gray-600 border border-gray-100'}`}>
                        بایگانی
                    </button>
                </div>

                <div className="relative mx-1">
                    <input 
                        className="w-full pl-10 pr-4 py-3 bg-white border-none rounded-2xl text-sm shadow-sm focus:ring-2 focus:ring-blue-500 transition-all placeholder-gray-400" 
                        placeholder="جستجو شماره، گیرنده، کالا..." 
                        value={searchTerm} 
                        onChange={e => setSearchTerm(e.target.value)} 
                    />
                    <Search className="absolute left-3 top-3.5 text-gray-400" size={18} />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 px-1">
                {loading && filteredPermits.length === 0 ? (
                    <div className="col-span-full py-10 flex flex-col items-center gap-3 text-gray-400">
                        <Loader2 className="animate-spin text-blue-500" size={32} />
                        <span className="text-xs font-medium">در حال دریافت اطلاعات...</span>
                    </div>
                ) : filteredPermits.length === 0 ? (
                    <div className="col-span-full py-16 flex flex-col items-center gap-4 text-gray-400 bg-white/50 rounded-3xl border-2 border-dashed border-gray-200 m-2">
                        <Filter size={48} className="opacity-20" />
                        <span className="font-bold text-sm">موردی یافت نشد</span>
                    </div>
                ) : (
                    filteredPermits.map(p => {
                        const action = getActionRequired(p);
                        const statusConfig = getStatusConfig(p.status);
                        
                        return (
                            <div key={p.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 relative overflow-hidden transition-transform active:scale-[0.99]">
                                {/* Status Strip */}
                                <div className={`absolute top-0 left-0 bottom-0 w-1.5 ${statusConfig.bg.replace('bg-', 'bg-').replace('50', '500')}`}></div>
                                
                                <div className="pl-3">
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-black text-gray-500 font-mono bg-gray-100 px-2 py-0.5 rounded-lg">#{p.permitNumber}</span>
                                            <span className="text-[10px] text-gray-400">{formatDate(p.date)}</span>
                                        </div>
                                        <div className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${statusConfig.bg} ${statusConfig.color}`}>
                                            {statusConfig.label}
                                        </div>
                                    </div>

                                    <div className="mb-3">
                                        <h3 className="font-bold text-gray-800 text-base line-clamp-1 mb-1">{p.recipientName}</h3>
                                        <div className="text-xs text-gray-500 flex items-center gap-1">
                                            <Package size={12} className="text-blue-500"/>
                                            <span className="truncate max-w-[200px]">{p.goodsName}</span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 mb-4 bg-gray-50 rounded-xl p-2.5">
                                        <div className="flex flex-col">
                                            <span className="text-[9px] text-gray-400">تعداد کل</span>
                                            <span className="text-xs font-bold text-gray-700">{p.cartonCount || 0} <span className="text-[9px] font-normal">کارتن</span></span>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[9px] text-gray-400">وزن کل</span>
                                            <span className="text-xs font-bold text-gray-700">{p.weight || 0} <span className="text-[9px] font-normal">KG</span></span>
                                        </div>
                                    </div>

                                    <div className="flex gap-2 items-center">
                                        <button onClick={() => setViewPermit(p)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-colors">
                                            <Eye size={14} /> مشاهده
                                        </button>
                                        
                                        {action && !processingId && (
                                            <button onClick={() => handleApprove(p)} className="flex-[1.5] bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl text-xs font-bold shadow-md shadow-blue-200 flex items-center justify-center gap-1 transition-colors animate-pulse">
                                                <CheckCircle size={14} /> {action.replace('تایید', '').replace('خروج نهایی', 'تایید خروج')}
                                            </button>
                                        )}

                                        {(currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.CEO) && (
                                            <button onClick={(e) => handleDelete(p.id, e)} className="p-2.5 bg-gray-100 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors">
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {processingId === p.id && (
                                    <div className="absolute inset-0 bg-white/80 backdrop-blur-[2px] flex items-center justify-center z-20 flex-col gap-2">
                                        <Loader2 className="animate-spin text-blue-600" size={32} />
                                        <span className="text-xs font-bold text-blue-600 animate-pulse">در حال پردازش و ارسال پیام...</span>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {/* Modals */}
            {viewPermit && (
                <PrintExitPermit 
                    permit={viewPermit} 
                    onClose={() => setViewPermit(null)} 
                    settings={settings}
                    onApprove={getActionRequired(viewPermit) ? () => handleApprove(viewPermit) : undefined}
                    onReject={getActionRequired(viewPermit) ? async () => {
                        const reason = prompt('علت رد سند خروج:');
                        if (reason) {
                            await updateExitPermitStatus(viewPermit.id, ExitPermitStatus.REJECTED, currentUser, { rejectionReason: reason });
                            loadData();
                            setViewPermit(null);
                        }
                    } : undefined}
                />
            )}

            {warehouseFinalize && (
                <WarehouseFinalizeModal 
                    permit={warehouseFinalize} 
                    onClose={() => setWarehouseFinalize(null)} 
                    onConfirm={handleWarehouseSubmit} 
                />
            )}
        </div>
    );
};

export default ManageExitPermits;
