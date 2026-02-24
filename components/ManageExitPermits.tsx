import React, { useState, useEffect } from 'react';
import { ExitPermit, ExitPermitStatus, User, UserRole, SystemSettings } from '../types';
import { getExitPermits, updateExitPermitStatus, deleteExitPermit, editExitPermit } from '../services/storageService';
import { getUsers } from '../services/authService';
import { apiCall } from '../services/apiService';
import { formatDate } from '../constants';
import { 
    Eye, Trash2, Search, CheckCircle, Truck, XCircle, Edit, Loader2, 
    Package, Archive, RefreshCw, UserCheck, ShieldCheck, Warehouse, 
    User as UserIcon, Building2, Bell, AlertTriangle, MoreVertical
} from 'lucide-react';
import PrintExitPermit from './PrintExitPermit';
import WarehouseFinalizeModal from './WarehouseFinalizeModal'; 
import EditExitPermitModal from './EditExitPermitModal';
import useIsMobile from '../hooks/useIsMobile';

const ManageExitPermits: React.FC<{ currentUser: User, settings?: SystemSettings, statusFilter?: any }> = ({ currentUser, settings, statusFilter }) => {
    const isMobile = useIsMobile();
    const [permits, setPermits] = useState<ExitPermit[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'CARTABLE' | 'FLOW' | 'ARCHIVE'>('CARTABLE');
    const [searchTerm, setSearchTerm] = useState('');
    const [viewPermit, setViewPermit] = useState<ExitPermit | null>(null);
    const [editPermit, setEditPermit] = useState<ExitPermit | null>(null);
    const [warehouseFinalize, setWarehouseFinalize] = useState<ExitPermit | null>(null);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [autoSendPermit, setAutoSendPermit] = useState<ExitPermit | null>(null);

    useEffect(() => { loadData(); }, []);
    
    useEffect(() => {
        if (statusFilter) {
            // Logic to switch tab based on external filter requests
        }
    }, [statusFilter]);

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

    // ... (isMyTurn, getActionLabel, filtering logic remains same)
    const isMyTurn = (p: ExitPermit) => {
        if (p.status === ExitPermitStatus.REJECTED || p.status === ExitPermitStatus.EXITED) return false;
        switch (currentUser.role) {
            case UserRole.CEO: return p.status === ExitPermitStatus.PENDING_CEO;
            case UserRole.FACTORY_MANAGER: return p.status === ExitPermitStatus.PENDING_FACTORY;
            case UserRole.WAREHOUSE_KEEPER: return p.status === ExitPermitStatus.PENDING_WAREHOUSE;
            case UserRole.SECURITY_HEAD:
            case UserRole.SECURITY_GUARD: return p.status === ExitPermitStatus.PENDING_SECURITY;
            case UserRole.ADMIN: return true; 
            default: return false;
        }
    };

    const getActionLabel = (status: ExitPermitStatus) => {
        switch(status) {
            case ExitPermitStatus.PENDING_CEO: return 'تایید مدیرعامل';
            case ExitPermitStatus.PENDING_FACTORY: return 'تایید مدیر کارخانه';
            case ExitPermitStatus.PENDING_WAREHOUSE: return 'توزین و تحویل انبار';
            case ExitPermitStatus.PENDING_SECURITY: return 'تایید و ثبت خروج';
            default: return '';
        }
    };

    const myCartablePermits = permits.filter(p => isMyTurn(p));
    const activeFlowPermits = permits.filter(p => !isMyTurn(p) && p.status !== ExitPermitStatus.EXITED && p.status !== ExitPermitStatus.REJECTED);
    const archivePermits = permits.filter(p => p.status === ExitPermitStatus.EXITED || p.status === ExitPermitStatus.REJECTED);

    const getDisplayPermits = () => {
        let source = [];
        if (activeTab === 'CARTABLE') source = myCartablePermits;
        else if (activeTab === 'FLOW') source = activeFlowPermits;
        else source = archivePermits;

        return source.filter(p => 
            (p.permitNumber && p.permitNumber.toString().includes(searchTerm)) || 
            (p.recipientName && p.recipientName.includes(searchTerm)) || 
            (p.goodsName && p.goodsName.includes(searchTerm))
        );
    };

    const displayPermits = getDisplayPermits();

    const getStepStatus = (p: ExitPermit, step: 'CEO' | 'FACTORY' | 'WAREHOUSE' | 'SECURITY') => {
        if (p.status === ExitPermitStatus.EXITED) return 'done';
        if (p.status === ExitPermitStatus.REJECTED) return 'rejected';

        const statusOrder = [
            ExitPermitStatus.PENDING_CEO,
            ExitPermitStatus.PENDING_FACTORY,
            ExitPermitStatus.PENDING_WAREHOUSE,
            ExitPermitStatus.PENDING_SECURITY
        ];
        
        const currentIdx = statusOrder.indexOf(p.status);
        let stepIdx = -1;
        
        if (step === 'CEO') stepIdx = 0;
        else if (step === 'FACTORY') stepIdx = 1;
        else if (step === 'WAREHOUSE') stepIdx = 2;
        else if (step === 'SECURITY') stepIdx = 3;

        if (currentIdx === -1) return 'pending'; 

        if (currentIdx > stepIdx) return 'done';
        if (currentIdx === stepIdx) return 'current';
        return 'pending';
    };

    const handleApprove = async (p: ExitPermit) => {
        if ((p.status as ExitPermitStatus) === ExitPermitStatus.PENDING_WAREHOUSE) { 
            setWarehouseFinalize(p); 
            return; 
        }
        
        let exitTimeStr = '';
        if (p.status === ExitPermitStatus.PENDING_SECURITY) {
            const t = prompt('ساعت خروج را وارد کنید (مثال 14:30):', new Date().toLocaleTimeString('fa-IR', {hour:'2-digit', minute:'2-digit'}));
            if (!t) return;
            exitTimeStr = t;
        } else {
            if (!confirm(`آیا مطمئن هستید؟ (${getActionLabel(p.status)})`)) return;
        }

        setProcessingId(p.id);
        
        try {
            let nextStatus = ExitPermitStatus.PENDING_FACTORY;
            if (p.status === ExitPermitStatus.PENDING_CEO) nextStatus = ExitPermitStatus.PENDING_FACTORY;
            else if (p.status === ExitPermitStatus.PENDING_FACTORY) nextStatus = ExitPermitStatus.PENDING_WAREHOUSE;
            else if (p.status === ExitPermitStatus.PENDING_WAREHOUSE) nextStatus = ExitPermitStatus.PENDING_SECURITY;
            else if (p.status === ExitPermitStatus.PENDING_SECURITY) nextStatus = ExitPermitStatus.EXITED;

            const updatedPermit = { ...p, status: nextStatus };
            if (p.status === ExitPermitStatus.PENDING_CEO) updatedPermit.approverCeo = currentUser.fullName;
            else if (p.status === ExitPermitStatus.PENDING_FACTORY) updatedPermit.approverFactory = currentUser.fullName;
            else if (p.status === ExitPermitStatus.PENDING_SECURITY) {
                updatedPermit.approverSecurity = currentUser.fullName;
                updatedPermit.exitTime = exitTimeStr;
            }

            await updateExitPermitStatus(p.id, nextStatus, currentUser, { exitTime: exitTimeStr });
            setAutoSendPermit(updatedPermit);
            
            setTimeout(async () => {
                await sendNotification(updatedPermit, p.status, exitTimeStr);
                setProcessingId(null);
                setAutoSendPermit(null);
                loadData();
            }, 2500);

        } catch (e) {
            alert('خطا در عملیات تایید');
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
            
            await editExitPermit(updated); 
            
            setAutoSendPermit(updated);
            setTimeout(async () => {
                await sendNotification(updated, ExitPermitStatus.PENDING_WAREHOUSE);
                setProcessingId(null);
                setWarehouseFinalize(null);
                setAutoSendPermit(null);
                loadData();
            }, 2500);
        } catch(e) { alert('خطا در ثبت انبار'); setProcessingId(null); }
    };

    const sendNotification = async (permit: ExitPermit, prevStatus: ExitPermitStatus, extraInfo?: string) => {
        // ... (Keep existing notification logic)
        const element = document.getElementById(`print-permit-autosend-${permit.id}`);
        if (!element) return;
        try {
             // @ts-ignore
            const canvas = await window.html2canvas(element, { scale: 2, backgroundColor: '#ffffff' });
            const base64 = canvas.toDataURL('image/png').split(',')[1];
            
            // ... (Target logic same as previous) ...
            const targets = [];
            const companyConfig = settings?.companyNotifications?.[permit.company];
            let g1WA = companyConfig?.warehouseGroup;
            let g1Bale = companyConfig?.baleChannelId;
            let g1Tg = companyConfig?.telegramChannelId;
            if (!g1WA) g1WA = settings?.exitPermitNotificationGroup || settings?.defaultWarehouseGroup;
            if (!g1Bale) g1Bale = settings?.exitPermitNotificationBaleId;
            if (!g1Tg) g1Tg = settings?.exitPermitNotificationTelegramId;

            if (g1WA) targets.push({ group: g1WA });
            if (g1Bale) targets.push({ platform: 'bale', id: g1Bale });
            if (g1Tg) targets.push({ platform: 'telegram', id: g1Tg });

            const g2Config = settings?.exitPermitSecondGroupConfig;
            if (g2Config && g2Config.activeStatuses.includes(permit.status)) {
                if (g2Config.groupId) targets.push({ group: g2Config.groupId });
                if (g2Config.baleId) targets.push({ platform: 'bale', id: g2Config.baleId });
                if (g2Config.telegramId) targets.push({ platform: 'telegram', id: g2Config.telegramId });
            }

            let captionTitle = '';
            if (prevStatus === ExitPermitStatus.PENDING_CEO) {
                captionTitle = '✅ تایید مدیرعامل - ارجاع به کارخانه';
                targets.push({ role: UserRole.FACTORY_MANAGER });
            } else if (prevStatus === ExitPermitStatus.PENDING_FACTORY) {
                captionTitle = '✅ تایید مدیر کارخانه - ارجاع به انبار';
                targets.push({ role: UserRole.WAREHOUSE_KEEPER });
            } else if (prevStatus === ExitPermitStatus.PENDING_WAREHOUSE) {
                captionTitle = '⚖️ تایید و توزین انبار - ارجاع به انتظامات';
                targets.push({ role: UserRole.SECURITY_HEAD });
            } else if (prevStatus === ExitPermitStatus.PENDING_SECURITY) {
                captionTitle = '👋 خروج نهایی از کارخانه';
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
                if (t.platform) {
                    await apiCall('/send-bot-message', 'POST', { platform: t.platform, chatId: t.id, caption: caption, mediaData: { data: base64, filename: `Permit_${permit.permitNumber}.png` } });
                }
            }
        } catch (e) { console.error("Notif Error", e); }
    };

    const handleDelete = async (id: string) => {
        if(!confirm('حذف شود؟')) return;
        await deleteExitPermit(id);
        loadData();
    };

    const TimelineStep = ({ status, label, icon: Icon }: any) => {
        let colorClass = 'bg-gray-100 text-gray-400 border-gray-200';
        if (status === 'current') colorClass = 'bg-blue-100 text-blue-600 border-blue-500 animate-pulse ring-2 ring-blue-200';
        if (status === 'done') colorClass = 'bg-green-500 text-white border-green-600 shadow-md';
        if (status === 'rejected') colorClass = 'bg-red-500 text-white border-red-600';

        // Simplify for mobile
        if (isMobile) {
            return (
                <div className={`w-2 h-2 rounded-full ${colorClass.includes('bg-green') ? 'bg-green-500' : colorClass.includes('bg-blue') ? 'bg-blue-500 animate-pulse' : colorClass.includes('bg-red') ? 'bg-red-500' : 'bg-gray-300'}`}></div>
            );
        }

        return (
            <div className="flex flex-col items-center gap-1 z-10 w-14">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${colorClass}`}>
                    <Icon size={14} />
                </div>
                <span className={`text-[9px] font-bold text-center leading-tight ${status === 'current' ? 'text-blue-700' : 'text-gray-500'}`}>{label}</span>
            </div>
        );
    };

    // Mobile Card Renderer
    const MobilePermitCard = ({ p, canAct }: { p: ExitPermit, canAct: boolean }) => (
        <div className={`bg-white rounded-xl border p-4 mb-3 shadow-sm relative overflow-hidden ${canAct ? 'border-blue-400 ring-1 ring-blue-100' : 'border-gray-200'}`}>
            <div className="flex justify-between items-start mb-2">
                <div>
                    <span className="text-xs font-mono text-gray-400">#{p.permitNumber}</span>
                    <h3 className="font-bold text-gray-800 text-base">{p.recipientName}</h3>
                </div>
                {p.status === ExitPermitStatus.EXITED ? (
                    <span className="bg-green-100 text-green-700 text-[10px] px-2 py-1 rounded-lg font-bold">خارج شده</span>
                ) : (
                     <div className="flex gap-1">
                         <TimelineStep status="done" label="" icon={UserIcon} />
                         <TimelineStep status={getStepStatus(p, 'CEO')} label="" icon={UserCheck} />
                         <TimelineStep status={getStepStatus(p, 'FACTORY')} label="" icon={Building2} />
                         <TimelineStep status={getStepStatus(p, 'WAREHOUSE')} label="" icon={Warehouse} />
                         <TimelineStep status={getStepStatus(p, 'SECURITY')} label="" icon={ShieldCheck} />
                     </div>
                )}
            </div>
            
            <div className="text-xs text-gray-500 mb-3 flex flex-wrap gap-3">
                <span>📦 {p.goodsName}</span>
                <span>📅 {formatDate(p.date)}</span>
            </div>

            <div className="flex gap-2 mt-2">
                {canAct && !processingId && (
                     <button onClick={() => handleApprove(p)} className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-xs font-bold shadow-sm">
                         {getActionLabel(p.status)}
                     </button>
                )}
                <button onClick={() => setViewPermit(p)} className="bg-gray-100 text-gray-700 px-3 py-2 rounded-lg"><Eye size={16}/></button>
                {(currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.CEO) && (
                    <button onClick={() => handleDelete(p.id)} className="bg-red-50 text-red-500 px-3 py-2 rounded-lg"><Trash2 size={16}/></button>
                )}
            </div>
            
            {processingId === p.id && (
                <div className="absolute inset-0 bg-white/80 backdrop-blur-[1px] flex items-center justify-center z-20">
                    <Loader2 className="animate-spin text-blue-600" size={24}/>
                </div>
            )}
        </div>
    );

    const renderPermitCard = (p: ExitPermit) => {
        const canAct = isMyTurn(p);
        
        if (isMobile) {
            return (
                <React.Fragment key={p.id}>
                    <MobilePermitCard p={p} canAct={canAct} />
                </React.Fragment>
            );
        }

        return (
            <div key={p.id} className={`bg-white rounded-2xl border transition-all relative overflow-hidden ${canAct ? 'border-blue-400 shadow-lg scale-[1.01]' : 'border-gray-200 shadow-sm opacity-90'}`}>
                {canAct && <div className="absolute top-0 right-0 left-0 bg-blue-500 h-1.5 animate-pulse"></div>}
                {p.status === ExitPermitStatus.REJECTED && <div className="absolute top-0 right-0 left-0 h-1.5 bg-red-500"></div>}
                
                <div className="p-5">
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex gap-3 items-center">
                            <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center font-black text-xl text-gray-700 border border-gray-200 shadow-inner">
                                {p.permitNumber}
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-800 text-lg">{p.recipientName}</h3>
                                <p className="text-xs text-gray-500">{p.goodsName} | {formatDate(p.date)}</p>
                            </div>
                        </div>
                        
                        <div className="flex gap-2">
                            {canAct && !processingId && (
                                <button onClick={() => handleApprove(p)} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 flex items-center gap-2 transition-transform active:scale-95">
                                    <CheckCircle size={16}/> {getActionLabel(p.status)}
                                </button>
                            )}
                            <button onClick={() => setViewPermit(p)} className="bg-gray-100 text-gray-700 p-2 rounded-xl hover:bg-gray-200"><Eye size={18}/></button>
                            {(currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.CEO || (currentUser.role === UserRole.SALES_MANAGER && p.status === ExitPermitStatus.PENDING_CEO)) && (
                                <>
                                    <button onClick={() => setEditPermit(p)} className="bg-amber-50 text-amber-600 p-2 rounded-xl hover:bg-amber-100"><Edit size={18}/></button>
                                    <button onClick={() => handleDelete(p.id)} className="bg-red-50 text-red-500 p-2 rounded-xl hover:bg-red-100"><Trash2 size={18}/></button>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Timeline */}
                    <div className="relative mt-6 px-2 pb-2">
                        <div className="absolute top-4 left-4 right-4 h-0.5 bg-gray-100 -z-0"></div>
                        <div className="flex justify-between relative z-10">
                            <TimelineStep status="done" label="ثبت" icon={UserIcon} />
                            <TimelineStep status={getStepStatus(p, 'CEO')} label="مدیرعامل" icon={UserCheck} />
                            <TimelineStep status={getStepStatus(p, 'FACTORY')} label="کارخانه" icon={Building2} />
                            <TimelineStep status={getStepStatus(p, 'WAREHOUSE')} label="انبار" icon={Warehouse} />
                            <TimelineStep status={getStepStatus(p, 'SECURITY')} label="انتظامات" icon={ShieldCheck} />
                        </div>
                    </div>
                </div>

                {processingId === p.id && (
                    <div className="absolute inset-0 bg-white/80 backdrop-blur-[1px] flex flex-col items-center justify-center z-20">
                        <Loader2 className="animate-spin text-blue-600 mb-2" size={32}/>
                        <span className="text-xs font-bold text-blue-700 animate-pulse">در حال ثبت و ارسال پیام...</span>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="space-y-6 pb-20 animate-fade-in">
             {/* Hidden Render */}
             {autoSendPermit && (
                <div className="hidden-print-export" style={{ position: 'absolute', top: '-9999px', left: '-9999px', width: '800px', zIndex: -1 }}>
                    <div id={`print-permit-autosend-${autoSendPermit.id}`}>
                        <PrintExitPermit permit={autoSendPermit} onClose={()=>{}} embed />
                    </div>
                </div>
            )}

            {/* Header / Tabs */}
            <div className="flex flex-col gap-4">
                <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-200">
                    <h1 className="text-xl font-black text-gray-800 flex items-center gap-2"><Truck className="text-teal-600"/> کارتابل خروج</h1>
                    <button onClick={loadData} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200"><RefreshCw size={18} className={loading ? 'animate-spin' : ''}/></button>
                </div>
                
                <div className="flex p-1 bg-gray-200 rounded-xl overflow-x-auto no-scrollbar">
                    <button 
                        onClick={() => setActiveTab('CARTABLE')} 
                        className={`flex-1 py-3 px-4 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 whitespace-nowrap ${activeTab === 'CARTABLE' ? 'bg-white text-blue-700 shadow-md' : 'text-gray-500'}`}
                    >
                        <Bell size={16} className={myCartablePermits.length > 0 ? "animate-pulse text-red-500" : ""}/>
                        کارتابل من ({myCartablePermits.length})
                    </button>
                    <button 
                        onClick={() => setActiveTab('FLOW')} 
                        className={`flex-1 py-3 px-4 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'FLOW' ? 'bg-white text-gray-800 shadow-md' : 'text-gray-500'}`}
                    >
                        جریان فعال
                    </button>
                    <button 
                        onClick={() => setActiveTab('ARCHIVE')} 
                        className={`flex-1 py-3 px-4 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'ARCHIVE' ? 'bg-white text-gray-800 shadow-md' : 'text-gray-500'}`}
                    >
                        بایگانی
                    </button>
                </div>

                <div className="relative">
                    <input className="w-full bg-white border border-gray-200 rounded-xl p-3 pr-10 text-sm outline-none focus:ring-2 focus:ring-blue-100" placeholder="جستجو در لیست..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    <Search className="absolute right-3 top-3.5 text-gray-400" size={18}/>
                </div>
            </div>

            {/* List */}
            <div className={`${isMobile ? 'space-y-3' : 'space-y-4'} min-h-[300px]`}>
                {loading ? (
                    <div className="text-center py-20 text-gray-400 flex flex-col items-center gap-2">
                        <Loader2 className="animate-spin text-blue-500"/> در حال بارگذاری...
                    </div>
                ) : displayPermits.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300">
                        <div className="text-gray-400 font-bold">موردی یافت نشد.</div>
                        {activeTab === 'CARTABLE' && <div className="text-xs text-gray-300 mt-2">خوشبختانه کارتابل شما خالی است! 🎉</div>}
                    </div>
                ) : (
                    displayPermits.map(p => renderPermitCard(p))
                )}
            </div>

            {/* Modals */}
            {viewPermit && (
                <div className={isMobile ? "fixed inset-0 z-[100] bg-white overflow-y-auto" : ""}>
                    <PrintExitPermit 
                        permit={viewPermit} 
                        onClose={() => setViewPermit(null)} 
                        settings={settings}
                        onApprove={isMyTurn(viewPermit) ? () => handleApprove(viewPermit) : undefined}
                        onReject={isMyTurn(viewPermit) ? async () => {
                            const reason = prompt('دلیل رد:'); 
                            if(reason) { 
                                await updateExitPermitStatus(viewPermit.id, ExitPermitStatus.REJECTED, currentUser, { rejectionReason: reason }); 
                                loadData(); setViewPermit(null); 
                            } 
                        } : undefined}
                        onEdit={
                            (currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.CEO || (currentUser.role === UserRole.SALES_MANAGER && viewPermit.status === ExitPermitStatus.PENDING_CEO)) 
                            ? () => { setEditPermit(viewPermit); setViewPermit(null); } 
                            : undefined
                        }
                    />
                </div>
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