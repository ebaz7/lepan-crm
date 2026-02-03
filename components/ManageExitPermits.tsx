
import React, { useState, useEffect } from 'react';
import { ExitPermit, ExitPermitStatus, User, UserRole, SystemSettings } from '../types';
import { getExitPermits, updateExitPermitStatus, deleteExitPermit, editExitPermit } from '../services/storageService';
import { getUsers } from '../services/authService';
import { apiCall } from '../services/apiService';
import { formatDate } from '../constants';
import { 
    Eye, Trash2, Search, CheckCircle, Truck, Edit, Loader2, 
    Archive, UserCheck, ShieldCheck, Warehouse, 
    User as UserIcon, Building2, Bell, AlertTriangle, ArrowRight, Filter
} from 'lucide-react';
import PrintExitPermit from './PrintExitPermit';
import WarehouseFinalizeModal from './WarehouseFinalizeModal'; 
import EditExitPermitModal from './EditExitPermitModal';

const ManageExitPermits: React.FC<{ currentUser: User, settings?: SystemSettings, statusFilter?: any }> = ({ currentUser, settings, statusFilter }) => {
    // --- STATE ---
    const [permits, setPermits] = useState<ExitPermit[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Tabs: 
    // MY_CARTABLE: Items waiting for MY action.
    // ACTIVE_FLOW: Items in progress (someone else has them).
    // ARCHIVE: Completed/Rejected.
    const [activeTab, setActiveTab] = useState<'MY_CARTABLE' | 'ACTIVE_FLOW' | 'ARCHIVE'>('MY_CARTABLE');
    const [searchTerm, setSearchTerm] = useState('');
    
    // Modals
    const [viewPermit, setViewPermit] = useState<ExitPermit | null>(null);
    const [editPermit, setEditPermit] = useState<ExitPermit | null>(null);
    const [warehouseFinalize, setWarehouseFinalize] = useState<ExitPermit | null>(null);
    
    // Processing State
    const [processingId, setProcessingId] = useState<string | null>(null);
    
    // Auto-Send Dummy State
    const [autoSendPermit, setAutoSendPermit] = useState<ExitPermit | null>(null);

    // Initial Load
    useEffect(() => {
        loadData();
    }, []);
    
    // Apply External Filter
    useEffect(() => {
        if (statusFilter === 'pending') {
            setActiveTab('MY_CARTABLE');
        }
    }, [statusFilter]);

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await getExitPermits();
            const safeData = Array.isArray(data) ? data : [];
            setPermits(safeData.sort((a, b) => b.createdAt - a.createdAt));
        } catch (e) {
            console.error("Load Error", e);
            setPermits([]);
        } finally {
            setLoading(false);
        }
    };

    // --- LOGIC: IS IT MY TURN? ---
    const isMyTurn = (p: ExitPermit) => {
        if (p.status === ExitPermitStatus.REJECTED || p.status === ExitPermitStatus.EXITED) return false;

        const role = currentUser.role;
        // CEO Step
        if (p.status === ExitPermitStatus.PENDING_CEO && (role === UserRole.CEO || role === UserRole.ADMIN)) return true;
        // Factory Step
        if (p.status === ExitPermitStatus.PENDING_FACTORY && (role === UserRole.FACTORY_MANAGER || role === UserRole.ADMIN)) return true;
        // Warehouse Step
        if (p.status === ExitPermitStatus.PENDING_WAREHOUSE && (role === UserRole.WAREHOUSE_KEEPER || role === UserRole.ADMIN)) return true;
        // Security Step
        if (p.status === ExitPermitStatus.PENDING_SECURITY && (role === UserRole.SECURITY_HEAD || role === UserRole.SECURITY_GUARD || role === UserRole.ADMIN)) return true;

        return false;
    };

    const getNextActionLabel = (status: ExitPermitStatus) => {
        switch(status) {
            case ExitPermitStatus.PENDING_CEO: return 'تایید مدیرعامل';
            case ExitPermitStatus.PENDING_FACTORY: return 'تایید کارخانه';
            case ExitPermitStatus.PENDING_WAREHOUSE: return 'توزین و تحویل انبار';
            case ExitPermitStatus.PENDING_SECURITY: return 'تایید خروج (انتظامات)';
            default: return '';
        }
    };

    // --- FILTERING ---
    const getFilteredPermits = () => {
        let baseList = [];
        
        if (activeTab === 'MY_CARTABLE') {
            baseList = permits.filter(p => isMyTurn(p));
        } else if (activeTab === 'ACTIVE_FLOW') {
            // Not finished, not rejected, and NOT my turn
            baseList = permits.filter(p => 
                p.status !== ExitPermitStatus.EXITED && 
                p.status !== ExitPermitStatus.REJECTED && 
                !isMyTurn(p)
            );
        } else {
            // Archive
            baseList = permits.filter(p => 
                p.status === ExitPermitStatus.EXITED || 
                p.status === ExitPermitStatus.REJECTED
            );
        }

        if (!searchTerm) return baseList;
        
        const lowerSearch = searchTerm.toLowerCase();
        return baseList.filter(p => 
            p.permitNumber.toString().includes(lowerSearch) ||
            p.recipientName?.includes(lowerSearch) ||
            p.goodsName?.includes(lowerSearch) ||
            p.company?.includes(lowerSearch)
        );
    };

    const displayPermits = getFilteredPermits();

    // --- ACTIONS ---

    const handleApprove = async (p: ExitPermit) => {
        // Warehouse needs special modal for weighing
        if (p.status === ExitPermitStatus.PENDING_WAREHOUSE) {
            setWarehouseFinalize(p);
            return;
        }

        let exitTimeStr = '';
        if (p.status === ExitPermitStatus.PENDING_SECURITY) {
            const now = new Date();
            const timeDefault = now.toLocaleTimeString('fa-IR', {hour:'2-digit', minute:'2-digit'});
            const t = prompt('ساعت خروج را وارد کنید:', timeDefault);
            if (!t) return;
            exitTimeStr = t;
        } else {
            if (!confirm(`آیا "${getNextActionLabel(p.status)}" را انجام می‌دهید؟`)) return;
        }

        setProcessingId(p.id);

        try {
            // Calculate Next Status
            let nextStatus = ExitPermitStatus.PENDING_FACTORY; // Default fallback
            if (p.status === ExitPermitStatus.PENDING_CEO) nextStatus = ExitPermitStatus.PENDING_FACTORY;
            else if (p.status === ExitPermitStatus.PENDING_FACTORY) nextStatus = ExitPermitStatus.PENDING_WAREHOUSE;
            // Removed unreachable 'else if (p.status === ExitPermitStatus.PENDING_WAREHOUSE)' as it is handled by the early return above
            else if (p.status === ExitPermitStatus.PENDING_SECURITY) nextStatus = ExitPermitStatus.EXITED;

            const updatedPermit = { ...p, status: nextStatus };
            // Set Approver Name based on current step
            if (p.status === ExitPermitStatus.PENDING_CEO) updatedPermit.approverCeo = currentUser.fullName;
            else if (p.status === ExitPermitStatus.PENDING_FACTORY) updatedPermit.approverFactory = currentUser.fullName;
            else if (p.status === ExitPermitStatus.PENDING_SECURITY) {
                updatedPermit.approverSecurity = currentUser.fullName;
                updatedPermit.exitTime = exitTimeStr;
            }

            await updateExitPermitStatus(p.id, nextStatus, currentUser, { exitTime: exitTimeStr });
            
            // --- NOTIFICATION SEQUENCE ---
            setAutoSendPermit(updatedPermit);
            setTimeout(async () => {
                await sendNotificationFlow(updatedPermit, p.status, exitTimeStr);
                setProcessingId(null);
                setAutoSendPermit(null);
                loadData();
            }, 2000);

        } catch (e) {
            alert('خطا در انجام عملیات');
            setProcessingId(null);
        }
    };

    const handleWarehouseSubmit = async (finalItems: any[]) => {
        if (!warehouseFinalize) return;
        setProcessingId(warehouseFinalize.id);
        
        try {
            // Update items with actual weight/count
            const updated = {
                ...warehouseFinalize,
                items: finalItems,
                approverWarehouse: currentUser.fullName,
                status: ExitPermitStatus.PENDING_SECURITY,
                // Recalculate totals
                weight: finalItems.reduce((a,b)=>a+(Number(b.weight)||0),0),
                cartonCount: finalItems.reduce((a,b)=>a+(Number(b.cartonCount)||0),0)
            };
            
            // We use editExitPermit because items changed
            await editExitPermit(updated);

            setAutoSendPermit(updated);
            setTimeout(async () => {
                await sendNotificationFlow(updated, ExitPermitStatus.PENDING_WAREHOUSE);
                setProcessingId(null);
                setWarehouseFinalize(null);
                setAutoSendPermit(null);
                loadData();
            }, 2000);

        } catch (e) {
            alert('خطا در ثبت انبار');
            setProcessingId(null);
        }
    };

    const handleReject = async (p: ExitPermit) => {
        const reason = prompt('دلیل رد درخواست را بنویسید:');
        if (!reason) return;
        
        setProcessingId(p.id);
        try {
            await updateExitPermitStatus(p.id, ExitPermitStatus.REJECTED, currentUser, { rejectionReason: reason });
            loadData();
        } catch(e) { alert('خطا'); } finally { setProcessingId(null); }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('آیا از حذف این حواله اطمینان دارید؟')) return;
        await deleteExitPermit(id);
        loadData();
    };

    // --- WHATSAPP NOTIFICATION HELPER ---
    const sendNotificationFlow = async (permit: ExitPermit, prevStatus: ExitPermitStatus, extraInfo?: string) => {
        // Find the hidden print element
        const elementId = `print-permit-autosend-${permit.id}`;
        const element = document.getElementById(elementId);
        if (!element) return;

        try {
            // @ts-ignore
            const canvas = await window.html2canvas(element, { scale: 2, backgroundColor: '#ffffff' });
            const base64 = canvas.toDataURL('image/png').split(',')[1];
            
            // Logic to determine who gets the message
            // 1. CEO Approved -> Send to Factory Manager
            // 2. Factory Approved -> Send to Warehouse Keeper
            // 3. Warehouse Approved -> Send to Security
            // 4. Security Approved -> Just Archive (maybe notify Sales?)
            
            const targets: {role?: string, group?: string}[] = [];
            const group1 = settings?.exitPermitNotificationGroup; // Main group
            const group2 = settings?.exitPermitSecondGroupConfig?.groupId; // Secondary group

            let title = '';

            if (prevStatus === ExitPermitStatus.PENDING_CEO) {
                title = '✅ تایید مدیرعامل - ارجاع به کارخانه';
                targets.push({ role: UserRole.FACTORY_MANAGER });
                if (group1) targets.push({ group: group1 });
            } else if (prevStatus === ExitPermitStatus.PENDING_FACTORY) {
                title = '✅ تایید کارخانه - ارجاع به انبار';
                targets.push({ role: UserRole.WAREHOUSE_KEEPER });
                if (group2) targets.push({ group: group2 }); // Usually warehouse group
            } else if (prevStatus === ExitPermitStatus.PENDING_WAREHOUSE) {
                title = '⚖️ تایید و توزین انبار - ارجاع به انتظامات';
                targets.push({ role: UserRole.SECURITY_HEAD });
                if (group1) targets.push({ group: group1 });
                if (group2) targets.push({ group: group2 });
            } else if (prevStatus === ExitPermitStatus.PENDING_SECURITY) {
                title = '👋 خروج نهایی از کارخانه';
                if (group1) targets.push({ group: group1 });
                if (group2) targets.push({ group: group2 });
            }

            let caption = `🚛 *حواله خروج بار*\n${title}\n\n🔢 شماره: ${permit.permitNumber}\n👤 گیرنده: ${permit.recipientName}`;
            if (permit.exitTime) caption += `\n🕒 ساعت خروج: ${permit.exitTime}`;
            
            const allUsers = await getUsers();
            
            for (const t of targets) {
                let number = '';
                if (t.role) {
                    const u = allUsers.find(x => x.role === t.role);
                    if (u) number = u.phoneNumber || '';
                } else if (t.group) {
                    number = t.group;
                }

                if (number) {
                    await apiCall('/send-whatsapp', 'POST', { 
                        number, 
                        message: caption, 
                        mediaData: { data: base64, mimeType: 'image/png', filename: `Permit_${permit.permitNumber}.png` } 
                    });
                }
            }

        } catch (e) {
            console.error("Auto Send Failed", e);
        }
    };

    // --- VISUAL TIMELINE COMPONENT ---
    const WorkflowTimeline = ({ status }: { status: ExitPermitStatus }) => {
        const steps = [
            { id: 'ceo', label: 'مدیرعامل', activeStatuses: [ExitPermitStatus.PENDING_CEO] },
            { id: 'factory', label: 'کارخانه', activeStatuses: [ExitPermitStatus.PENDING_FACTORY] },
            { id: 'warehouse', label: 'انبار', activeStatuses: [ExitPermitStatus.PENDING_WAREHOUSE] },
            { id: 'security', label: 'انتظامات', activeStatuses: [ExitPermitStatus.PENDING_SECURITY] },
            { id: 'done', label: 'خروج', activeStatuses: [ExitPermitStatus.EXITED] }
        ];

        // Find current step index
        let currentIndex = -1;
        if (status === ExitPermitStatus.REJECTED) currentIndex = -2; // Special case
        else if (status === ExitPermitStatus.EXITED) currentIndex = 4;
        else if (status === ExitPermitStatus.PENDING_SECURITY) currentIndex = 3;
        else if (status === ExitPermitStatus.PENDING_WAREHOUSE) currentIndex = 2;
        else if (status === ExitPermitStatus.PENDING_FACTORY) currentIndex = 1;
        else if (status === ExitPermitStatus.PENDING_CEO) currentIndex = 0;

        return (
            <div className="flex items-center w-full mt-4 relative">
                {/* Line */}
                <div className="absolute top-1/2 left-0 right-0 h-1 bg-gray-100 -z-10 rounded"></div>
                {/* Progress Line */}
                <div 
                    className={`absolute top-1/2 right-0 h-1 bg-green-500 -z-10 rounded transition-all duration-500`}
                    style={{ width: currentIndex >= 0 ? `${(currentIndex / 4) * 100}%` : '0%' }}
                ></div>

                <div className="flex justify-between w-full">
                    {steps.map((step, idx) => {
                        let stateClass = 'bg-gray-100 text-gray-400 border-gray-200'; // Pending
                        let icon = <div className="w-2 h-2 rounded-full bg-gray-300"></div>;

                        if (idx < currentIndex) {
                            stateClass = 'bg-green-500 text-white border-green-500'; // Done
                            icon = <div className="w-2 h-2 rounded-full bg-white"></div>;
                        } else if (idx === currentIndex) {
                            stateClass = 'bg-blue-600 text-white border-blue-600 ring-4 ring-blue-100'; // Active
                            icon = <div className="w-2 h-2 rounded-full bg-white animate-pulse"></div>;
                        }

                        if (status === ExitPermitStatus.REJECTED && idx === 0) { // Just show rejected on first node for visual simplicity
                             stateClass = 'bg-red-500 text-white';
                        }

                        return (
                            <div key={step.id} className="flex flex-col items-center gap-1">
                                <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center z-10 transition-all duration-300 ${stateClass}`}>
                                    {idx === 0 ? <UserIcon size={14}/> : 
                                     idx === 1 ? <Building2 size={14}/> : 
                                     idx === 2 ? <Warehouse size={14}/> : 
                                     idx === 3 ? <ShieldCheck size={14}/> : <Truck size={14}/>}
                                </div>
                                <span className={`text-[9px] font-bold ${idx === currentIndex ? 'text-blue-700' : 'text-gray-400'}`}>{step.label}</span>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6 pb-24 animate-fade-in relative min-h-screen bg-gray-50/50">
            
            {/* Hidden Renderer */}
            {autoSendPermit && (
                <div className="hidden-print-export" style={{ position: 'absolute', top: '-9999px', left: '-9999px', width: '800px', zIndex: -1 }}>
                    <div id={`print-permit-autosend-${autoSendPermit.id}`}>
                        <PrintExitPermit permit={autoSendPermit} onClose={()=>{}} embed />
                    </div>
                </div>
            )}

            {/* Header Area */}
            <div className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 sticky top-0 z-20">
                <div className="flex justify-between items-center mb-4">
                    <h1 className="text-xl font-black text-slate-800 flex items-center gap-2"><Truck className="text-blue-600"/> کارتابل خروج کالا</h1>
                    <div className="text-xs text-slate-400 font-bold bg-slate-50 px-3 py-1 rounded-full border">
                        {permits.length} حواله ثبت شده
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex p-1 bg-slate-100 rounded-2xl mb-4 relative overflow-hidden">
                    <button 
                        onClick={() => setActiveTab('MY_CARTABLE')}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all relative z-10 flex items-center justify-center gap-2 ${activeTab === 'MY_CARTABLE' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Bell size={14} className={getFilteredPermits().length > 0 && activeTab === 'MY_CARTABLE' ? "animate-swing" : ""}/>
                        کارتابل من
                        {activeTab !== 'MY_CARTABLE' && getFilteredPermits().length > 0 && <span className="bg-red-500 w-2 h-2 rounded-full absolute top-2 left-1/2 ml-8"></span>}
                    </button>
                    <button 
                        onClick={() => setActiveTab('ACTIVE_FLOW')}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all relative z-10 ${activeTab === 'ACTIVE_FLOW' ? 'bg-white text-slate-800 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        جریان فعال
                    </button>
                    <button 
                        onClick={() => setActiveTab('ARCHIVE')}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all relative z-10 ${activeTab === 'ARCHIVE' ? 'bg-white text-slate-800 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        بایگانی
                    </button>
                </div>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
                    <input 
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pr-10 pl-4 text-sm outline-none focus:bg-white focus:border-blue-400 transition-all"
                        placeholder="جستجو در شماره، گیرنده، کالا..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Content List */}
            <div className="px-1 space-y-4">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
                        <Loader2 className="animate-spin text-blue-500" size={32}/>
                        <span className="text-sm font-bold">در حال بارگذاری اطلاعات...</span>
                    </div>
                ) : displayPermits.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-slate-200 text-slate-400">
                        <Archive size={48} className="mb-2 opacity-20"/>
                        <span className="text-sm font-bold">موردی یافت نشد</span>
                    </div>
                ) : (
                    displayPermits.map(permit => {
                        const canAct = isMyTurn(permit);
                        return (
                            <div key={permit.id} className={`bg-white rounded-3xl p-5 border transition-all relative overflow-hidden group ${canAct ? 'border-blue-400 shadow-lg scale-[1.01]' : 'border-slate-200 shadow-sm hover:border-slate-300'}`}>
                                
                                {canAct && (
                                    <div className="absolute top-0 left-0 right-0 bg-blue-500 h-1.5"></div>
                                )}

                                <div className="flex justify-between items-start mb-4 pl-2">
                                    <div className="flex items-center gap-4">
                                        <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center border border-slate-200 font-mono text-xl font-black text-slate-700 shadow-inner">
                                            {permit.permitNumber}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-slate-800 text-lg mb-1">{permit.recipientName}</h3>
                                            <div className="text-xs text-slate-500 flex items-center gap-2">
                                                <span>{formatDate(permit.date)}</span>
                                                <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                                                <span className="truncate max-w-[150px]">{permit.goodsName}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex flex-col gap-2">
                                        {canAct && !processingId && (
                                            <button 
                                                onClick={() => handleApprove(permit)}
                                                className="bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 active:scale-95 transition-all flex items-center gap-2"
                                            >
                                                <CheckCircle size={16}/> {getNextActionLabel(permit.status)}
                                            </button>
                                        )}
                                        <div className="flex gap-1">
                                            <button onClick={() => setViewPermit(permit)} className="bg-slate-100 text-slate-600 p-2 rounded-lg hover:bg-slate-200"><Eye size={16}/></button>
                                            {/* Edit/Delete for Admin/Owner */}
                                            {(currentUser.role === UserRole.ADMIN || (permit.status === ExitPermitStatus.PENDING_CEO && currentUser.role === UserRole.SALES_MANAGER)) && (
                                                <>
                                                    <button onClick={() => setEditPermit(permit)} className="bg-amber-50 text-amber-600 p-2 rounded-lg hover:bg-amber-100"><Edit size={16}/></button>
                                                    <button onClick={() => handleDelete(permit.id)} className="bg-red-50 text-red-600 p-2 rounded-lg hover:bg-red-100"><Trash2 size={16}/></button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Status Timeline Visual */}
                                <div className="mt-4 pt-4 border-t border-slate-50">
                                    <WorkflowTimeline status={permit.status} />
                                </div>

                                {/* Loading Overlay */}
                                {processingId === permit.id && (
                                    <div className="absolute inset-0 bg-white/80 backdrop-blur-[2px] flex flex-col items-center justify-center z-50">
                                        <Loader2 className="animate-spin text-blue-600 mb-2" size={40}/>
                                        <span className="text-xs font-bold text-blue-800 animate-pulse">در حال پردازش و ارسال پیام...</span>
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
                    onApprove={isMyTurn(viewPermit) ? () => handleApprove(viewPermit) : undefined}
                    onReject={isMyTurn(viewPermit) ? () => handleReject(viewPermit) : undefined}
                />
            )}
            
            {editPermit && (
                <EditExitPermitModal 
                    permit={editPermit} 
                    onClose={() => setEditPermit(null)} 
                    onSave={() => { setEditPermit(null); loadData(); }} 
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
