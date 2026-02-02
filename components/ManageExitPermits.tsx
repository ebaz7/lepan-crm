
import React, { useState, useEffect } from 'react';
import { ExitPermit, ExitPermitStatus, User, UserRole, SystemSettings } from '../types';
import { getExitPermits, updateExitPermitStatus, deleteExitPermit, editExitPermit } from '../services/storageService';
import { getUsers } from '../services/authService';
import { apiCall } from '../services/apiService';
import { formatDate } from '../constants';
import { Eye, Trash2, Search, CheckCircle, Truck, XCircle, Edit, Loader2, Package, Archive, RefreshCw, UserCheck, ShieldCheck, Warehouse, User as UserIcon, Building2 } from 'lucide-react';
import PrintExitPermit from './PrintExitPermit';
import WarehouseFinalizeModal from './WarehouseFinalizeModal'; 

const ManageExitPermits: React.FC<{ currentUser: User, settings?: SystemSettings, statusFilter?: any }> = ({ currentUser, settings }) => {
    const [permits, setPermits] = useState<ExitPermit[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'ACTIVE' | 'ARCHIVE'>('ACTIVE');
    const [searchTerm, setSearchTerm] = useState('');
    const [viewPermit, setViewPermit] = useState<ExitPermit | null>(null);
    const [warehouseFinalize, setWarehouseFinalize] = useState<ExitPermit | null>(null);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [autoSendPermit, setAutoSendPermit] = useState<ExitPermit | null>(null);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await getExitPermits();
            setPermits((Array.isArray(data) ? data : []).sort((a, b) => b.createdAt - a.createdAt));
        } catch (e) { setPermits([]); } finally { setLoading(false); }
    };

    // --- WORKFLOW HELPERS ---
    const getStepStatus = (permit: ExitPermit, step: 'CEO' | 'FACTORY' | 'WAREHOUSE' | 'SECURITY') => {
        const s = permit.status;
        if (s === ExitPermitStatus.REJECTED) return 'rejected';
        
        if (step === 'CEO') {
            return (s !== ExitPermitStatus.PENDING_CEO) ? 'done' : 'current';
        }
        if (step === 'FACTORY') {
            if (s === ExitPermitStatus.PENDING_CEO) return 'pending';
            if (s === ExitPermitStatus.PENDING_FACTORY) return 'current';
            return 'done';
        }
        if (step === 'WAREHOUSE') {
            if ([ExitPermitStatus.PENDING_CEO, ExitPermitStatus.PENDING_FACTORY].includes(s)) return 'pending';
            if (s === ExitPermitStatus.PENDING_WAREHOUSE) return 'current';
            return 'done';
        }
        if (step === 'SECURITY') {
            if (s === ExitPermitStatus.EXITED) return 'done';
            if (s === ExitPermitStatus.PENDING_SECURITY) return 'current';
            return 'pending';
        }
        return 'pending';
    };

    const canIAct = (permit: ExitPermit) => {
        if (permit.status === ExitPermitStatus.REJECTED || permit.status === ExitPermitStatus.EXITED) return false;
        
        // CEO Step
        if (permit.status === ExitPermitStatus.PENDING_CEO && (currentUser.role === UserRole.CEO || currentUser.role === UserRole.ADMIN)) return true;
        // Factory Step
        if (permit.status === ExitPermitStatus.PENDING_FACTORY && (currentUser.role === UserRole.FACTORY_MANAGER || currentUser.role === UserRole.ADMIN)) return true;
        // Warehouse Step
        if (permit.status === ExitPermitStatus.PENDING_WAREHOUSE && (currentUser.role === UserRole.WAREHOUSE_KEEPER || currentUser.role === UserRole.ADMIN)) return true;
        // Security Step
        if (permit.status === ExitPermitStatus.PENDING_SECURITY && (currentUser.role === UserRole.SECURITY_HEAD || currentUser.role === UserRole.SECURITY_GUARD || currentUser.role === UserRole.ADMIN)) return true;
        
        return false;
    };

    const getActionLabel = (status: ExitPermitStatus) => {
        switch(status) {
            case ExitPermitStatus.PENDING_CEO: return 'تایید مدیرعامل';
            case ExitPermitStatus.PENDING_FACTORY: return 'تایید کارخانه';
            case ExitPermitStatus.PENDING_WAREHOUSE: return 'توزین انبار';
            case ExitPermitStatus.PENDING_SECURITY: return 'ثبت خروج نهایی';
            default: return '';
        }
    };

    // --- ACTIONS ---
    const handleApprove = async (p: ExitPermit) => {
        if ((p.status as ExitPermitStatus) === ExitPermitStatus.PENDING_WAREHOUSE) { setWarehouseFinalize(p); return; }
        
        let exitTimeStr = '';
        if (p.status === ExitPermitStatus.PENDING_SECURITY) {
            const t = prompt('ساعت خروج (مثال 14:30):', new Date().toLocaleTimeString('fa-IR', {hour:'2-digit', minute:'2-digit'}));
            if (!t) return;
            exitTimeStr = t;
        } else {
            if (!confirm(`آیا مرحله "${getActionLabel(p.status)}" را تایید می‌کنید؟`)) return;
        }

        setProcessingId(p.id);
        
        try {
            // Determine Next Status
            let nextStatus = ExitPermitStatus.PENDING_FACTORY;
            if (p.status === ExitPermitStatus.PENDING_FACTORY) nextStatus = ExitPermitStatus.PENDING_WAREHOUSE;
            else if (p.status === ExitPermitStatus.PENDING_WAREHOUSE) nextStatus = ExitPermitStatus.PENDING_SECURITY;
            else if (p.status === ExitPermitStatus.PENDING_SECURITY) nextStatus = ExitPermitStatus.EXITED;

            const updatedPermit = { ...p, status: nextStatus, exitTime: exitTimeStr || undefined };
            if (p.status === ExitPermitStatus.PENDING_CEO) updatedPermit.approverCeo = currentUser.fullName;
            else if (p.status === ExitPermitStatus.PENDING_FACTORY) updatedPermit.approverFactory = currentUser.fullName;
            else if (p.status === ExitPermitStatus.PENDING_SECURITY) updatedPermit.approverSecurity = currentUser.fullName;

            await updateExitPermitStatus(p.id, nextStatus, currentUser, { exitTime: exitTimeStr });
            
            // Trigger Notification (Visual Render)
            setAutoSendPermit(updatedPermit);
            
            setTimeout(async () => {
                await sendNotification(updatedPermit, p.status, exitTimeStr); // Helper function below
                setProcessingId(null);
                setAutoSendPermit(null);
                loadData();
            }, 2500);

        } catch (e) {
            alert('خطا در عملیات');
            setProcessingId(null);
        }
    };

    const handleWarehouseSubmit = async (finalItems: any[]) => {
        if (!warehouseFinalize) return;
        setProcessingId(warehouseFinalize.id);
        try {
            const updated = { 
                ...warehouseFinalize, 
                items: finalItems, 
                approverWarehouse: currentUser.fullName, 
                status: ExitPermitStatus.PENDING_SECURITY,
                weight: finalItems.reduce((a,b)=>a+(Number(b.weight)||0),0),
                cartonCount: finalItems.reduce((a,b)=>a+(Number(b.cartonCount)||0),0)
            };
            
            await editExitPermit(updated); // Saves items & updates status logic if properly implemented or call updateStatus separately
            // Since editExitPermit acts as a full update, we rely on it. Or explicit status update:
            // await updateExitPermitStatus(...)
            
            setAutoSendPermit(updated);
            setTimeout(async () => {
                await sendNotification(updated, ExitPermitStatus.PENDING_WAREHOUSE);
                setProcessingId(null);
                setWarehouseFinalize(null);
                setAutoSendPermit(null);
                loadData();
            }, 2500);
        } catch(e) { alert('خطا'); setProcessingId(null); }
    };

    const sendNotification = async (permit: ExitPermit, prevStatus: ExitPermitStatus, extraInfo?: string) => {
        const element = document.getElementById(`print-permit-autosend-${permit.id}`);
        if (!element) return;
        
        try {
            // @ts-ignore
            const canvas = await window.html2canvas(element, { scale: 2, backgroundColor: '#ffffff' });
            const base64 = canvas.toDataURL('image/png').split(',')[1];
            
            const targets = [];
            const group1 = settings?.exitPermitNotificationGroup;
            const group2 = settings?.exitPermitSecondGroupConfig?.groupId;

            let captionTitle = '';
            if (prevStatus === ExitPermitStatus.PENDING_CEO) {
                captionTitle = '✅ تایید مدیرعامل - ارجاع به کارخانه';
                targets.push({ role: UserRole.FACTORY_MANAGER });
                if (group1) targets.push({ group: group1 });
            } else if (prevStatus === ExitPermitStatus.PENDING_FACTORY) {
                captionTitle = '✅ تایید مدیر کارخانه - ارجاع به انبار';
                targets.push({ role: UserRole.WAREHOUSE_KEEPER });
                if (group2) targets.push({ group: group2 });
            } else if (prevStatus === ExitPermitStatus.PENDING_WAREHOUSE) {
                captionTitle = '⚖️ تایید و توزین انبار - ارجاع به انتظامات';
                targets.push({ role: UserRole.SECURITY_HEAD });
                if (group1) targets.push({ group: group1 });
                if (group2) targets.push({ group: group2 });
            } else if (prevStatus === ExitPermitStatus.PENDING_SECURITY) {
                captionTitle = '👋 خروج نهایی از کارخانه';
                if (group1) targets.push({ group: group1 });
                if (group2) targets.push({ group: group2 });
            }

            let caption = `🚛 *حواله خروج بار*\n${captionTitle}\n\n🔢 شماره: ${permit.permitNumber}\n👤 گیرنده: ${permit.recipientName}\n`;
            if (permit.exitTime) caption += `🕒 ساعت خروج: ${permit.exitTime}\n`;
            if (prevStatus === ExitPermitStatus.PENDING_WAREHOUSE) caption += `📦 وزن نهایی: ${permit.weight} KG\n`;
            caption += `\nتایید کننده: ${currentUser.fullName}`;

            const allUsers = await getUsers();
            for (const t of targets) {
                if (t.role) {
                    const u = allUsers.find(x => x.role === t.role);
                    if (u?.phoneNumber) await apiCall('/send-whatsapp', 'POST', { number: u.phoneNumber, message: caption, mediaData: { data: base64, mimeType: 'image/png', filename: `Permit_${permit.permitNumber}.png` } });
                }
                if (t.group) {
                    await apiCall('/send-whatsapp', 'POST', { number: t.group, message: caption, mediaData: { data: base64, mimeType: 'image/png', filename: `Permit_${permit.permitNumber}.png` } });
                }
            }
        } catch (e) { console.error("Notif Error", e); }
    };

    const handleDelete = async (id: string) => {
        if(!confirm('حذف شود؟')) return;
        await deleteExitPermit(id);
        loadData();
    };

    // Filter
    const displayPermits = permits.filter(p => {
        const matchesSearch = String(p.permitNumber).includes(searchTerm) || p.recipientName?.includes(searchTerm);
        if (activeTab === 'ARCHIVE') return matchesSearch && (p.status === ExitPermitStatus.EXITED || p.status === ExitPermitStatus.REJECTED);
        return matchesSearch && p.status !== ExitPermitStatus.EXITED && p.status !== ExitPermitStatus.REJECTED;
    });

    const TimelineStep = ({ status, label, icon: Icon }: any) => {
        let colorClass = 'bg-gray-200 text-gray-400'; // Pending
        if (status === 'current') colorClass = 'bg-blue-100 text-blue-600 border-2 border-blue-500 animate-pulse';
        if (status === 'done') colorClass = 'bg-green-500 text-white';
        if (status === 'rejected') colorClass = 'bg-red-500 text-white';

        return (
            <div className={`flex flex-col items-center gap-1 z-10`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${colorClass} transition-all duration-300`}>
                    <Icon size={16} />
                </div>
                <span className={`text-[9px] font-bold ${status === 'current' ? 'text-blue-600' : 'text-gray-500'}`}>{label}</span>
            </div>
        );
    };

    return (
        <div className="space-y-6 pb-20 animate-fade-in">
             {/* Hidden Auto-Send Render */}
             {autoSendPermit && (
                <div className="hidden-print-export" style={{ position: 'absolute', top: '-9999px', left: '-9999px', width: '800px', zIndex: -1 }}>
                    <div id={`print-permit-autosend-${autoSendPermit.id}`}>
                        <PrintExitPermit permit={autoSendPermit} onClose={()=>{}} embed />
                    </div>
                </div>
            )}

            <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-200">
                <h1 className="text-xl font-black text-gray-800 flex items-center gap-2"><Truck className="text-teal-600"/> کارتابل حواله خروج</h1>
                <div className="flex gap-2">
                    <button onClick={() => setActiveTab('ACTIVE')} className={`px-4 py-2 rounded-xl text-xs font-bold ${activeTab==='ACTIVE'?'bg-teal-600 text-white shadow-lg':'text-gray-600 hover:bg-gray-100'}`}>جریان فعال</button>
                    <button onClick={() => setActiveTab('ARCHIVE')} className={`px-4 py-2 rounded-xl text-xs font-bold ${activeTab==='ARCHIVE'?'bg-gray-800 text-white shadow-lg':'text-gray-600 hover:bg-gray-100'}`}>بایگانی</button>
                </div>
            </div>

            <div className="relative">
                <input className="w-full bg-white border border-gray-200 rounded-xl p-3 pr-10 text-sm focus:ring-2 focus:ring-teal-100 outline-none" placeholder="جستجو شماره، گیرنده..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                <Search className="absolute right-3 top-3.5 text-gray-400" size={18}/>
            </div>

            <div className="space-y-4">
                {loading ? <div className="text-center py-10 text-gray-400"><Loader2 className="animate-spin inline-block ml-2"/> در حال بارگذاری...</div> : 
                 displayPermits.length === 0 ? <div className="text-center py-10 text-gray-400 bg-white rounded-2xl border border-dashed">موردی یافت نشد.</div> :
                 displayPermits.map(permit => {
                     const isMyTurn = canIAct(permit);
                     return (
                         <div key={permit.id} className={`bg-white rounded-2xl border transition-all relative overflow-hidden ${isMyTurn ? 'border-teal-500 shadow-md transform scale-[1.01]' : 'border-gray-200 shadow-sm opacity-90'}`}>
                             {isMyTurn && <div className="absolute top-0 right-0 bg-teal-500 text-white text-[10px] px-3 py-1 rounded-bl-xl font-bold z-10">نوبت شماست</div>}
                             
                             <div className="p-5">
                                 <div className="flex justify-between items-start mb-4 pl-4">
                                     <div className="flex gap-3 items-center">
                                         <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center font-black text-xl text-gray-700 border border-gray-200 shadow-inner">
                                             {permit.permitNumber}
                                         </div>
                                         <div>
                                             <h3 className="font-bold text-gray-800 text-lg">{permit.recipientName}</h3>
                                             <p className="text-xs text-gray-500">{permit.goodsName} | {formatDate(permit.date)}</p>
                                         </div>
                                     </div>
                                     
                                     {/* Action Buttons */}
                                     <div className="flex gap-2">
                                         {isMyTurn && !processingId && (
                                             <button onClick={() => handleApprove(permit)} className="bg-teal-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-teal-700 shadow-lg shadow-teal-200 flex items-center gap-2">
                                                 <CheckCircle size={16}/> {getActionLabel(permit.status)}
                                             </button>
                                         )}
                                         <button onClick={() => setViewPermit(permit)} className="bg-gray-100 text-gray-700 p-2 rounded-xl hover:bg-gray-200"><Eye size={18}/></button>
                                         {(currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.CEO) && (
                                             <button onClick={(e) => handleDelete(permit.id)} className="bg-red-50 text-red-500 p-2 rounded-xl hover:bg-red-100"><Trash2 size={18}/></button>
                                         )}
                                     </div>
                                 </div>

                                 {/* Timeline Visual */}
                                 <div className="relative mt-6 px-4 pb-2">
                                     <div className="absolute top-4 left-0 right-0 h-0.5 bg-gray-100 -z-0"></div>
                                     <div className="flex justify-between relative z-10">
                                         <TimelineStep status="done" label="ثبت" icon={UserIcon} />
                                         <TimelineStep status={getStepStatus(permit, 'CEO')} label="مدیرعامل" icon={UserCheck} />
                                         <TimelineStep status={getStepStatus(permit, 'FACTORY')} label="کارخانه" icon={Building2} />
                                         <TimelineStep status={getStepStatus(permit, 'WAREHOUSE')} label="انبار" icon={Warehouse} />
                                         <TimelineStep status={getStepStatus(permit, 'SECURITY')} label="انتظامات" icon={ShieldCheck} />
                                     </div>
                                 </div>
                             </div>
                             
                             {processingId === permit.id && (
                                 <div className="absolute inset-0 bg-white/80 backdrop-blur-[1px] flex flex-col items-center justify-center z-20">
                                     <Loader2 className="animate-spin text-teal-600 mb-2" size={32}/>
                                     <span className="text-xs font-bold text-teal-700 animate-pulse">در حال ثبت و ارسال پیام...</span>
                                 </div>
                             )}
                         </div>
                     );
                 })
                }
            </div>

            {/* Modals */}
            {viewPermit && (
                <PrintExitPermit 
                    permit={viewPermit} 
                    onClose={() => setViewPermit(null)} 
                    settings={settings}
                    onApprove={canIAct(viewPermit) ? () => handleApprove(viewPermit) : undefined}
                    onReject={canIAct(viewPermit) ? async () => {
                         const reason = prompt('دلیل رد:'); 
                         if(reason) { 
                             await updateExitPermitStatus(viewPermit.id, ExitPermitStatus.REJECTED, currentUser, { rejectionReason: reason }); 
                             loadData(); setViewPermit(null); 
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
