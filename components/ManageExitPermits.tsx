
import React, { useState, useEffect } from 'react';
import { ExitPermit, ExitPermitStatus, User, UserRole, SystemSettings } from '../types';
import { getExitPermits, updateExitPermitStatus, deleteExitPermit, editExitPermit } from '../services/storageService';
import { getUsers } from '../services/authService';
import { apiCall } from '../services/apiService';
import { formatDate } from '../constants';
import { 
    Eye, Trash2, Search, CheckCircle, Truck, Edit, Loader2, 
    Archive, UserCheck, ShieldCheck, Warehouse, 
    User as UserIcon, Building2, Bell, AlertTriangle, ArrowRight, Filter, X
} from 'lucide-react';
import PrintExitPermit from './PrintExitPermit';
import WarehouseFinalizeModal from './WarehouseFinalizeModal'; 
import EditExitPermitModal from './EditExitPermitModal';

const ManageExitPermits: React.FC<{ currentUser: User, settings?: SystemSettings, statusFilter?: any }> = ({ currentUser, settings, statusFilter }) => {
    // --- STATE ---
    const [permits, setPermits] = useState<ExitPermit[]>([]);
    const [loading, setLoading] = useState(true);
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
            case ExitPermitStatus.PENDING_FACTORY: return 'تایید مدیر کارخانه';
            case ExitPermitStatus.PENDING_WAREHOUSE: return 'توزین و تایید انبار';
            case ExitPermitStatus.PENDING_SECURITY: return 'ثبت خروج (انتظامات)';
            default: return '';
        }
    };

    // --- NOTIFICATION ENGINE ---
    const broadcastStep = async (permit: ExitPermit, prevStatus: ExitPermitStatus, extraInfo?: string) => {
        const elementId = `print-permit-autosend-${permit.id}`;
        const element = document.getElementById(elementId);
        if (!element || !settings) {
            console.error("Print element not found or settings missing");
            return;
        }

        try {
            // @ts-ignore
            const canvas = await window.html2canvas(element, { scale: 2, backgroundColor: '#ffffff' });
            const base64 = canvas.toDataURL('image/png').split(',')[1];
            
            const targets: {type: string, id: string}[] = [];
            const allUsers = await getUsers();

            // Settings Groups
            const group1 = settings.exitPermitGroup1Id; // Group 1 (Management/Sales)
            const group2 = settings.exitPermitGroup2Id; // Group 2 (Operations/Warehouse)

            // Helper
            const addRole = (role: string) => {
                const u = allUsers.find(x => x.role === role && x.phoneNumber);
                if (u) {
                    targets.push({ type: 'whatsapp', id: u.phoneNumber });
                    if(u.telegramChatId) targets.push({ type: 'telegram', id: u.telegramChatId });
                    if(u.baleChatId) targets.push({ type: 'bale', id: u.baleChatId });
                }
            };
            const addGroup = (gid?: string) => {
                if(gid) targets.push({ type: 'whatsapp', id: gid });
            };

            let captionTitle = '';

            // 1. CEO Approved -> Send to Group 1 + Factory Manager
            if (prevStatus === ExitPermitStatus.PENDING_CEO) {
                captionTitle = '✅ تایید مدیرعامل - ارجاع به کارخانه';
                addGroup(group1);
                addRole(UserRole.FACTORY_MANAGER);
            } 
            // 2. Factory Approved -> Send to Group 2 + Warehouse Keeper
            // Note: User asked for "Send to Group 2 and Warehouse" specifically
            else if (prevStatus === ExitPermitStatus.PENDING_FACTORY) {
                captionTitle = '✅ تایید مدیر کارخانه - ارجاع به انبار';
                addGroup(group2); // Group 2
                addRole(UserRole.WAREHOUSE_KEEPER);
            }
            // 3. Warehouse Approved (Weights Entered) -> Send to Group 2 + Everywhere + Security
            // "Everywhere" implies Group 1 as well? User said "Everywhere and Group 2 and Security".
            else if (prevStatus === ExitPermitStatus.PENDING_WAREHOUSE) {
                captionTitle = '⚖️ تایید و توزین انبار - ارجاع به انتظامات';
                addGroup(group1); // Everywhere (G1)
                addGroup(group2); // Group 2
                addRole(UserRole.SECURITY_HEAD);
            }
            // 4. Security Approved (Exit) -> Send to Both Groups + Everywhere
            else if (prevStatus === ExitPermitStatus.PENDING_SECURITY) {
                captionTitle = '👋 خروج نهایی از کارخانه';
                addGroup(group1);
                addGroup(group2);
            }

            let caption = `🚛 *حواله خروج بار*\n${captionTitle}\n\n🔢 شماره: ${permit.permitNumber}\n👤 گیرنده: ${permit.recipientName}\n`;
            
            // Add Item Details if Warehouse Step Just Finished
            if (permit.items.length > 0) {
                 caption += `📦 اقلام: ${permit.items.map(i => `${i.cartonCount} کارتن ${i.goodsName} (${i.weight} kg)`).join('، ')}\n`;
            }
            
            if (permit.exitTime) caption += `🕒 ساعت خروج: ${permit.exitTime}\n`;
            
            // Add approver name
            if (prevStatus === ExitPermitStatus.PENDING_CEO) caption += `\nتایید کننده: ${permit.approverCeo}`;
            else if (prevStatus === ExitPermitStatus.PENDING_FACTORY) caption += `\nتایید کننده: ${permit.approverFactory}`;
            else if (prevStatus === ExitPermitStatus.PENDING_WAREHOUSE) caption += `\nانباردار: ${permit.approverWarehouse}`;
            else if (prevStatus === ExitPermitStatus.PENDING_SECURITY) caption += `\nانتظامات: ${permit.approverSecurity}`;

            const uniqueTargets = targets.filter((v,i,a)=>a.findIndex(t=>(t.id===v.id && t.type===v.type))===i);
            
            if (uniqueTargets.length > 0) {
                await apiCall('/send-multichannel', 'POST', { 
                    targets: uniqueTargets, 
                    message: caption, 
                    mediaData: { data: base64, mimeType: 'image/png', filename: `Permit_${permit.permitNumber}.png` } 
                });
            }

        } catch (e) {
            console.error("Auto Send Failed", e);
        }
    };

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
            let nextStatus = ExitPermitStatus.PENDING_FACTORY; 
            if (p.status === ExitPermitStatus.PENDING_CEO) nextStatus = ExitPermitStatus.PENDING_FACTORY;
            else if (p.status === ExitPermitStatus.PENDING_FACTORY) nextStatus = ExitPermitStatus.PENDING_WAREHOUSE;
            else if (p.status === ExitPermitStatus.PENDING_SECURITY) nextStatus = ExitPermitStatus.EXITED;

            const updatedPermit = { ...p, status: nextStatus };
            // Set Approver Name based on current step
            if (p.status === ExitPermitStatus.PENDING_CEO) updatedPermit.approverCeo = currentUser.fullName;
            else if (p.status === ExitPermitStatus.PENDING_FACTORY) updatedPermit.approverFactory = currentUser.fullName;
            else if (p.status === ExitPermitStatus.PENDING_SECURITY) {
                updatedPermit.approverSecurity = currentUser.fullName;
                updatedPermit.exitTime = exitTimeStr;
            }

            // Corrected: use PUT for status update
            await updateExitPermitStatus(p.id, nextStatus, currentUser, { exitTime: exitTimeStr });
            
            // Notification
            setAutoSendPermit(updatedPermit);
            setTimeout(async () => {
                await broadcastStep(updatedPermit, p.status, exitTimeStr);
                setProcessingId(null);
                setAutoSendPermit(null);
                loadData();
            }, 2000);

        } catch (e: any) {
            alert(`خطا در انجام عملیات: ${e.message}`);
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
            
            // Use editExitPermit because items changed
            await editExitPermit(updated);

            setAutoSendPermit(updated);
            setTimeout(async () => {
                await broadcastStep(updated, ExitPermitStatus.PENDING_WAREHOUSE);
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

    // --- DELETE LOGIC: CEO/Admin Only -> Notify Groups ---
    const handleDelete = async (p: ExitPermit) => {
        if (currentUser.role !== UserRole.CEO && currentUser.role !== UserRole.ADMIN) {
             alert("حذف فقط توسط مدیرعامل امکان‌پذیر است.");
             return;
        }

        if (!confirm('⚠️ هشدار: آیا از حذف کامل این حواله اطمینان دارید؟\nاین عملیات غیرقابل بازگشت است و به تمام گروه‌ها اطلاع‌رسانی می‌شود.')) return;
        
        setProcessingId(p.id);

        // Prepare Mock Deleted Permit for Screenshot
        const deletedPermit = { ...p, status: 'REJECTED' as any }; // Use rejected status just to render the watermark
        setAutoSendPermit(deletedPermit);

        setTimeout(async () => {
            const element = document.getElementById(`print-permit-autosend-${deletedPermit.id}`);
            if (element) {
                try {
                    // @ts-ignore
                    const canvas = await window.html2canvas(element, { scale: 2, backgroundColor: '#ffffff' });
                    const base64 = canvas.toDataURL('image/png').split(',')[1];
                    
                    const caption = `❌❌ *مجوز خروج حذف شد* ❌❌\n\n⛔ شماره: ${p.permitNumber}\n👤 گیرنده: ${p.recipientName}\n\n⚠️ این مجوز توسط مدیریت حذف و باطل گردید.`;
                    
                    // Notify Group 1 and Group 2
                    const targets = [];
                    if (settings?.exitPermitGroup1Id) targets.push({ type: 'whatsapp', id: settings.exitPermitGroup1Id });
                    if (settings?.exitPermitGroup2Id) targets.push({ type: 'whatsapp', id: settings.exitPermitGroup2Id });
                    
                    await apiCall('/send-multichannel', 'POST', { 
                        targets, 
                        message: caption, 
                        mediaData: { data: base64, mimeType: 'image/png', filename: `Permit_DELETED_${p.permitNumber}.png` } 
                    });

                } catch(e) { console.error("Delete notification failed", e); }
            }
            
            await deleteExitPermit(p.id);
            setProcessingId(null);
            setAutoSendPermit(null);
            loadData();
            alert("حذف شد و اطلاع‌رسانی گردید.");
        }, 2000);
    };

    // --- FILTERING ---
    const getFilteredPermits = () => {
        let baseList = [];
        
        if (activeTab === 'MY_CARTABLE') {
            baseList = permits.filter(p => isMyTurn(p));
        } else if (activeTab === 'ACTIVE_FLOW') {
            baseList = permits.filter(p => 
                p.status !== ExitPermitStatus.EXITED && 
                p.status !== ExitPermitStatus.REJECTED && 
                !isMyTurn(p)
            );
        } else {
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
            p.goodsName?.includes(lowerSearch)
        );
    };

    const displayPermits = getFilteredPermits();

    const WorkflowTimeline = ({ status }: { status: ExitPermitStatus }) => {
        const steps = [
            { id: 'ceo', label: 'مدیرعامل', activeStatuses: [ExitPermitStatus.PENDING_CEO] },
            { id: 'factory', label: 'کارخانه', activeStatuses: [ExitPermitStatus.PENDING_FACTORY] },
            { id: 'warehouse', label: 'انبار', activeStatuses: [ExitPermitStatus.PENDING_WAREHOUSE] },
            { id: 'security', label: 'انتظامات', activeStatuses: [ExitPermitStatus.PENDING_SECURITY] },
            { id: 'done', label: 'خروج', activeStatuses: [ExitPermitStatus.EXITED] }
        ];

        let currentIndex = -1;
        if (status === ExitPermitStatus.REJECTED) currentIndex = -2;
        else if (status === ExitPermitStatus.EXITED) currentIndex = 4;
        else if (status === ExitPermitStatus.PENDING_SECURITY) currentIndex = 3;
        else if (status === ExitPermitStatus.PENDING_WAREHOUSE) currentIndex = 2;
        else if (status === ExitPermitStatus.PENDING_FACTORY) currentIndex = 1;
        else if (status === ExitPermitStatus.PENDING_CEO) currentIndex = 0;

        return (
            <div className="flex items-center w-full mt-4 relative">
                <div className="absolute top-1/2 left-0 right-0 h-1 bg-gray-100 -z-10 rounded"></div>
                <div className={`absolute top-1/2 right-0 h-1 bg-green-500 -z-10 rounded transition-all duration-500`} style={{ width: currentIndex >= 0 ? `${(currentIndex / 4) * 100}%` : '0%' }}></div>
                <div className="flex justify-between w-full">
                    {steps.map((step, idx) => {
                        let stateClass = 'bg-gray-100 text-gray-400 border-gray-200';
                        if (idx < currentIndex) stateClass = 'bg-green-500 text-white border-green-500';
                        else if (idx === currentIndex) stateClass = 'bg-blue-600 text-white border-blue-600 ring-4 ring-blue-100';
                        if (status === ExitPermitStatus.REJECTED && idx === 0) stateClass = 'bg-red-500 text-white';

                        return (
                            <div key={step.id} className="flex flex-col items-center gap-1">
                                <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center z-10 transition-all duration-300 ${stateClass}`}>
                                    {idx === 0 ? <UserIcon size={14}/> : idx === 1 ? <Building2 size={14}/> : idx === 2 ? <Warehouse size={14}/> : idx === 3 ? <ShieldCheck size={14}/> : <Truck size={14}/>}
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
                        {/* We use DELETED watermark if mocking rejection for deletion */}
                        <PrintExitPermit permit={autoSendPermit} onClose={()=>{}} embed watermark={autoSendPermit.status === 'REJECTED' as any ? 'DELETED' : null} />
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 sticky top-0 z-20">
                <div className="flex justify-between items-center mb-4">
                    <h1 className="text-xl font-black text-slate-800 flex items-center gap-2"><Truck className="text-blue-600"/> کارتابل خروج کالا</h1>
                    <div className="text-xs text-slate-400 font-bold bg-slate-50 px-3 py-1 rounded-full border">{permits.length} حواله</div>
                </div>
                <div className="flex p-1 bg-slate-100 rounded-2xl mb-4 relative overflow-hidden">
                    <button onClick={() => setActiveTab('MY_CARTABLE')} className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all relative z-10 flex items-center justify-center gap-2 ${activeTab === 'MY_CARTABLE' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}>
                        <Bell size={14} className={getFilteredPermits().length > 0 && activeTab === 'MY_CARTABLE' ? "animate-swing" : ""}/> کارتابل من
                    </button>
                    <button onClick={() => setActiveTab('ACTIVE_FLOW')} className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all relative z-10 ${activeTab === 'ACTIVE_FLOW' ? 'bg-white text-slate-800 shadow-md' : 'text-slate-500'}`}>جریان فعال</button>
                    <button onClick={() => setActiveTab('ARCHIVE')} className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all relative z-10 ${activeTab === 'ARCHIVE' ? 'bg-white text-slate-800 shadow-md' : 'text-slate-500'}`}>بایگانی</button>
                </div>
                <div className="relative">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
                    <input className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pr-10 pl-4 text-sm outline-none focus:bg-white focus:border-blue-400 transition-all" placeholder="جستجو..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
            </div>

            {/* List */}
            <div className="px-1 space-y-4">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3"><Loader2 className="animate-spin text-blue-500" size={32}/><span className="text-sm font-bold">در حال بارگذاری...</span></div>
                ) : displayPermits.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-slate-200 text-slate-400"><Archive size={48} className="mb-2 opacity-20"/><span className="text-sm font-bold">موردی یافت نشد</span></div>
                ) : (
                    displayPermits.map(permit => {
                        const canAct = isMyTurn(permit);
                        return (
                            <div key={permit.id} className={`bg-white rounded-3xl p-5 border transition-all relative overflow-hidden group ${canAct ? 'border-blue-400 shadow-lg scale-[1.01]' : 'border-slate-200 shadow-sm hover:border-slate-300'}`}>
                                {canAct && <div className="absolute top-0 left-0 right-0 bg-blue-500 h-1.5"></div>}
                                <div className="flex justify-between items-start mb-4 pl-2">
                                    <div className="flex items-center gap-4">
                                        <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center border border-slate-200 font-mono text-xl font-black text-slate-700 shadow-inner">{permit.permitNumber}</div>
                                        <div><h3 className="font-bold text-slate-800 text-lg mb-1">{permit.recipientName}</h3><div className="text-xs text-slate-500 flex items-center gap-2"><span>{formatDate(permit.date)}</span><span className="w-1 h-1 bg-slate-300 rounded-full"></span><span className="truncate max-w-[150px]">{permit.goodsName}</span></div></div>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        {canAct && !processingId && <button onClick={() => handleApprove(permit)} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-lg hover:bg-blue-700 active:scale-95 transition-all flex items-center gap-2"><CheckCircle size={16}/> {getNextActionLabel(permit.status)}</button>}
                                        <div className="flex gap-1">
                                            <button onClick={() => setViewPermit(permit)} className="bg-slate-100 text-slate-600 p-2 rounded-lg hover:bg-slate-200"><Eye size={16}/></button>
                                            {/* Edit/Delete: CEO & Admin Only */}
                                            {(currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.CEO) && (
                                                <>
                                                    <button onClick={() => setEditPermit(permit)} className="bg-amber-50 text-amber-600 p-2 rounded-lg hover:bg-amber-100"><Edit size={16}/></button>
                                                    <button onClick={() => handleDelete(permit)} className="bg-red-50 text-red-600 p-2 rounded-lg hover:bg-red-100"><Trash2 size={16}/></button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-4 pt-4 border-t border-slate-50"><WorkflowTimeline status={permit.status} /></div>
                                {processingId === permit.id && <div className="absolute inset-0 bg-white/80 backdrop-blur-[2px] flex flex-col items-center justify-center z-50"><Loader2 className="animate-spin text-blue-600 mb-2" size={40}/><span className="text-xs font-bold text-blue-800 animate-pulse">در حال پردازش و ارسال پیام...</span></div>}
                            </div>
                        );
                    })
                )}
            </div>

            {/* Modals */}
            {viewPermit && <PrintExitPermit permit={viewPermit} onClose={() => setViewPermit(null)} settings={settings} onApprove={isMyTurn(viewPermit) ? () => handleApprove(viewPermit) : undefined} onReject={isMyTurn(viewPermit) ? () => handleReject(viewPermit) : undefined} />}
            {editPermit && <EditExitPermitModal permit={editPermit} onClose={() => setEditPermit(null)} onSave={() => { setEditPermit(null); loadData(); }} />}
            {warehouseFinalize && <WarehouseFinalizeModal permit={warehouseFinalize} onClose={() => setWarehouseFinalize(null)} onConfirm={handleWarehouseSubmit} />}

        </div>
    );
};

export default ManageExitPermits;
