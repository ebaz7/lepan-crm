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
import SecurityFinalizeModal from './SecurityFinalizeModal';
import EditExitPermitModal from './EditExitPermitModal';
import useIsMobile from '../hooks/useIsMobile';
import html2canvas from 'html2canvas';

import { isInFinancialYear } from '../utils/dateUtils';

const ManageExitPermits: React.FC<{ currentUser: User, settings?: SystemSettings, statusFilter?: any, financialYear?: string }> = ({ currentUser, settings, statusFilter, financialYear }) => {
    const isMobile = useIsMobile();
    const [permits, setPermits] = useState<ExitPermit[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'CARTABLE' | 'FLOW' | 'ARCHIVE'>('CARTABLE');
    const [searchTerm, setSearchTerm] = useState('');
    const [viewPermit, setViewPermit] = useState<ExitPermit | null>(null);
    const [editPermit, setEditPermit] = useState<ExitPermit | null>(null);
    const [warehouseFinalize, setWarehouseFinalize] = useState<ExitPermit | null>(null);
    const [securityFinalize, setSecurityFinalize] = useState<ExitPermit | null>(null);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [activeAutoSends, setActiveAutoSends] = useState<ExitPermit[]>([]);

    useEffect(() => { loadData(); }, [financialYear]);
    
    useEffect(() => {
        if (statusFilter) {
            // Logic to switch tab based on external filter requests
        }
    }, [statusFilter]);

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await getExitPermits();
            let safeData = Array.isArray(data) ? data : [];
            if (financialYear && financialYear !== 'all') {
                safeData = safeData.filter(p => isInFinancialYear(p.date, financialYear));
            }
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
            case UserRole.FACTORY_MANAGER: return p.status === ExitPermitStatus.PENDING_FACTORY || p.status === ExitPermitStatus.PENDING_FACTORY_FINAL;
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
            case ExitPermitStatus.PENDING_SECURITY: return 'ثبت مشخصات راننده';
            case ExitPermitStatus.PENDING_FACTORY_FINAL: return 'تایید نهایی خروج و ارسال گروه';
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
            p.permitNumber.toString().includes(searchTerm) || 
            p.recipientName?.includes(searchTerm) || 
            p.goodsName?.includes(searchTerm)
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
        
        if (p.status === ExitPermitStatus.PENDING_SECURITY) {
            setSecurityFinalize(p);
            return;
        }

        const actionLabel = getActionLabel(p.status);
        if (!confirm(`آیا از ${actionLabel} اطمینان دارید؟`)) return;

        setProcessingId(p.id);
        
        try {
            let nextStatus = ExitPermitStatus.PENDING_FACTORY;
            if (p.status === ExitPermitStatus.PENDING_CEO) nextStatus = ExitPermitStatus.PENDING_FACTORY;
            else if (p.status === ExitPermitStatus.PENDING_FACTORY) nextStatus = ExitPermitStatus.PENDING_WAREHOUSE;
            else if (p.status === ExitPermitStatus.PENDING_FACTORY_FINAL) nextStatus = ExitPermitStatus.EXITED;
            else nextStatus = p.status; // Fallback

            const updatedPermit = { ...p, status: nextStatus };
            let extraUpdateData: any = {};

            if (p.status === ExitPermitStatus.PENDING_CEO) updatedPermit.approverCeo = currentUser.fullName;
            else if (p.status === ExitPermitStatus.PENDING_FACTORY) updatedPermit.approverFactory = currentUser.fullName;
            else if (p.status === ExitPermitStatus.PENDING_FACTORY_FINAL) {
                updatedPermit.approverFactoryFinal = currentUser.fullName;
                updatedPermit.exitTime = new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
                extraUpdateData.exitTime = updatedPermit.exitTime;
            }

            await updateExitPermitStatus(p.id, nextStatus, currentUser, extraUpdateData);
            
            // Notification queue
            setActiveAutoSends(prev => [...prev, updatedPermit]);
            
            setTimeout(async () => {
                await sendNotification(updatedPermit, p.status);
                setProcessingId(null);
                setActiveAutoSends(prev => prev.filter(x => x.id !== updatedPermit.id));
                loadData();
            }, 2500);

        } catch (e) {
            alert('خطا در عملیات تایید');
            setProcessingId(null);
        }
    };

    const handleSecuritySubmit = async (data: { driverName: string; driverPhone: string; plateNumber: string; exitTime: string }) => {
        if (!securityFinalize) return;
        setProcessingId(securityFinalize.id);
        try {
            const nextStatus = ExitPermitStatus.PENDING_FACTORY_FINAL;
            const updatedPermit = { 
                ...securityFinalize, 
                status: nextStatus,
                driverName: data.driverName,
                driverPhone: data.driverPhone,
                plateNumber: data.plateNumber,
                approverSecurity: currentUser.fullName,
                updatedAt: Date.now()
            };

            await editExitPermit(updatedPermit); 
            
            setActiveAutoSends(prev => [...prev, updatedPermit]);
            
            setTimeout(async () => {
                await sendNotification(updatedPermit, ExitPermitStatus.PENDING_SECURITY);
                setProcessingId(null);
                setSecurityFinalize(null);
                setActiveAutoSends(prev => prev.filter(x => x.id !== updatedPermit.id));
                loadData();
            }, 2500);
        } catch (e) {
            alert('خطا در ثبت مشخصات انتظامات');
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
            
            setActiveAutoSends(prev => [...prev, updated]);
            setTimeout(async () => {
                await sendNotification(updated, ExitPermitStatus.PENDING_WAREHOUSE);
                setProcessingId(null);
                setWarehouseFinalize(null);
                setActiveAutoSends(prev => prev.filter(x => x.id !== updated.id));
                loadData();
            }, 2500);
        } catch(e) { alert('خطا در ثبت انبار'); setProcessingId(null); }
    };

    const sendNotification = async (permit: ExitPermit, prevStatus: ExitPermitStatus, extraInfo?: string) => {
        const elementNoPrice = document.getElementById(`print-permit-autosend-noprice-${permit.id}`);
        const elementWithPrice = document.getElementById(`print-permit-autosend-price-${permit.id}`);
        if (!elementNoPrice || !elementWithPrice) return;
        try {
            const canvasNoPrice = await html2canvas(elementNoPrice, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
            const base64NoPrice = canvasNoPrice.toDataURL('image/png').split(',')[1];
            
            const canvasWithPrice = await html2canvas(elementWithPrice, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
            const base64WithPrice = canvasWithPrice.toDataURL('image/png').split(',')[1];
            
            const targets = [];
            const companyConfig = settings?.companyNotifications?.[permit.company];
            
            // Group 1 IDs
            let g1WA = companyConfig?.warehouseGroup || settings?.exitPermitNotificationGroup || settings?.defaultWarehouseGroup;
            let g1Bale = companyConfig?.baleChannelId || settings?.exitPermitNotificationBaleId;
            let g1Tg = companyConfig?.telegramChannelId || settings?.exitPermitNotificationTelegramId;

            // Group 2 IDs
            const g2Config = settings?.exitPermitSecondGroupConfig;
            let g2WA = g2Config?.groupId;
            let g2Bale = g2Config?.baleId;
            let g2Tg = g2Config?.telegramId;

            // Check config arrays directly
            const nextStatus = permit.status;
            const configOptionStr1 = prevStatus + '->' + nextStatus;
            const fallbackOptionStr = prevStatus; // For older formats
            
            const g1StatusArray = settings?.exitPermitFirstGroupConfig?.activeStatuses || [];
            const isG1Active = g1StatusArray.includes(configOptionStr1) || g1StatusArray.includes(fallbackOptionStr);
            
            const g2StatusArray = settings?.exitPermitSecondGroupConfig?.activeStatuses || [];
            const isG2Active = g2StatusArray.includes(configOptionStr1) || g2StatusArray.includes(fallbackOptionStr);
            
            if (isG1Active) {
                if (g1WA) targets.push({ group: g1WA });
                if (g1Bale) targets.push({ platform: 'bale', id: g1Bale });
                if (g1Tg) targets.push({ platform: 'telegram', id: g1Tg });
            }
            if (isG2Active) {
                if (g2WA) targets.push({ group: g2WA });
                if (g2Bale) targets.push({ platform: 'bale', id: g2Bale });
                if (g2Tg) targets.push({ platform: 'telegram', id: g2Tg });
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
                captionTitle = '🚨 ثبت اطلاعات خودرو - در انتظار تایید نهایی خروج';
                targets.push({ role: UserRole.FACTORY_MANAGER }); // Factory manager needs to see this
            } else if (prevStatus === ExitPermitStatus.PENDING_FACTORY_FINAL) {
                captionTitle = '👋 خروج نهایی بار از کارخانه';
            }

            let caption = `🚛 *حواله خروج بار*\n${captionTitle}\n\n`;
            caption += `🔢 شماره: ${permit.permitNumber}\n`;
            caption += `👤 گیرنده: ${permit.recipientName}\n`;
            caption += `📦 کالا: ${permit.goodsName}\n`;
            
            // NOTE: price is omitted here as per user request to hide it in bot/groups.
            
            if (permit.plateNumber) {
                // Format: 11A11111 -> 11 A 111 11
                const p = permit.plateNumber;
                const formattedPlate = p.length >= 8 ? `${p.slice(0,2)} ${p.slice(2,3)} ${p.slice(3,6)} | ${p.slice(6,8)}` : p;
                caption += `🆔 پلاک: ${formattedPlate}\n`;
            }
            if (permit.driverName) caption += `👨‍✈️ راننده: ${permit.driverName}\n`;
            if (permit.driverPhone) caption += `📞 تماس: ${permit.driverPhone}\n`;
            
            if (permit.exitTime) caption += `🕒 ساعت خروج: ${permit.exitTime}\n`;
            if (prevStatus === ExitPermitStatus.PENDING_WAREHOUSE) caption += `⚖️ وزن نهایی: ${permit.weight} KG\n`;
            
            caption += `\n👤 تایید کننده: ${currentUser.fullName}`;

            const allUsers = await getUsers();
            
            for (const t of targets) {
                if (t.role) {
                    const u = allUsers.find(x => x.role === t.role);
                    if (u?.phoneNumber) await apiCall('/send-whatsapp', 'POST', { number: u.phoneNumber, message: caption, mediaData: { data: base64NoPrice, mimeType: 'image/png', filename: `Permit_${permit.permitNumber}.png` } });
                }
                if (t.group) {
                    await apiCall('/send-whatsapp', 'POST', { number: t.group, message: caption, mediaData: { data: base64NoPrice, mimeType: 'image/png', filename: `Permit_${permit.permitNumber}.png` } });
                }
                if (t.platform) {
                    await apiCall('/send-bot-message', 'POST', { platform: t.platform, chatId: t.id, caption: caption, mediaData: { data: base64NoPrice, filename: `Permit_${permit.permitNumber}.png` } });
                }
            }
            
            // Explicitly send WITH PRICE to CEO, SALES_MANAGER, ADMIN
            const managers = allUsers.filter(u => u.role === UserRole.CEO || u.role === UserRole.SALES_MANAGER || u.role === UserRole.ADMIN);
            const managerCaption = caption + `\n💰 مبلغ: ${permit.price}`;
            for (const m of managers) {
                const tgId = (m as any).telegramId || (m as any).telegramChatId;
                const blId = (m as any).baleId || (m as any).baleChatId;
                if (m.phoneNumber) {
                    await apiCall('/send-whatsapp', 'POST', { number: m.phoneNumber, message: managerCaption, mediaData: { data: base64WithPrice, mimeType: 'image/png', filename: `Permit_${permit.permitNumber}.png` } });
                }
                if (tgId) await apiCall('/send-bot-message', 'POST', { platform: 'telegram', chatId: tgId, caption: managerCaption, mediaData: { data: base64WithPrice, filename: `Permit_${permit.permitNumber}.png` } });
                if (blId) await apiCall('/send-bot-message', 'POST', { platform: 'bale', chatId: blId, caption: managerCaption, mediaData: { data: base64WithPrice, filename: `Permit_${permit.permitNumber}.png` } });
            }
        } catch (e) { console.error("Notif Error", e); }
    };

    const handleDelete = async (id: string) => {
        if(!confirm('حذف شود؟')) return;
        await deleteExitPermit(id);
        loadData();
    };

    const TimelineStep = ({ status, label, icon: Icon }: any) => {
        let colorClass = 'bg-gray-100 dark:bg-gray-800/40 text-gray-800 dark:text-gray-200 text-gray-400 border-gray-200/50 dark:border-white/10';
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
        <div className={`glass-panel rounded-xl border p-4 mb-3 shadow-sm relative overflow-hidden ${canAct ? 'border-blue-400 ring-1 ring-blue-100' : 'border-gray-200'}`}>
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
            <div key={p.id} className={`glass-panel rounded-2xl border transition-all relative overflow-hidden ${canAct ? 'border-blue-400 shadow-lg scale-[1.01]' : 'border-gray-200 shadow-sm opacity-90'}`}>
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
             {activeAutoSends.map(p => (
                <div key={p.id} className="hidden-print-export" style={{ position: 'absolute', top: '-9999px', left: '-9999px', width: '800px', zIndex: -1 }}>
                    <div id={`print-permit-autosend-noprice-${p.id}`}>
                        <PrintExitPermit permit={p} onClose={()=>{}} embed showPrice={false} />
                    </div>
                    <div id={`print-permit-autosend-price-${p.id}`}>
                        <PrintExitPermit permit={p} onClose={()=>{}} embed showPrice={true} />
                    </div>
                </div>
            ))}

            {/* Header / Tabs */}
            <div className="flex flex-col gap-4">
                <div className="flex justify-between items-center glass-panel p-4 rounded-2xl shadow-sm border border-gray-200">
                    <h1 className="text-xl font-black text-gray-800 flex items-center gap-2"><Truck className="text-teal-600"/> کارتابل خروج</h1>
                    <button onClick={loadData} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200"><RefreshCw size={18} className={loading ? 'animate-spin' : ''}/></button>
                </div>
                
                <div className="flex p-1 bg-gray-200 rounded-xl overflow-x-auto no-scrollbar">
                    <button 
                        onClick={() => setActiveTab('CARTABLE')} 
                        className={`flex-1 py-3 px-4 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 whitespace-nowrap ${activeTab === 'CARTABLE' ? 'glass-panel text-blue-700 shadow-md' : 'text-gray-500'}`}
                    >
                        <Bell size={16} className={myCartablePermits.length > 0 ? "animate-pulse text-red-500" : ""}/>
                        کارتابل من ({myCartablePermits.length})
                    </button>
                    <button 
                        onClick={() => setActiveTab('FLOW')} 
                        className={`flex-1 py-3 px-4 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'FLOW' ? 'glass-panel text-gray-800 shadow-md' : 'text-gray-500'}`}
                    >
                        جریان فعال
                    </button>
                    <button 
                        onClick={() => setActiveTab('ARCHIVE')} 
                        className={`flex-1 py-3 px-4 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'ARCHIVE' ? 'glass-panel text-gray-800 shadow-md' : 'text-gray-500'}`}
                    >
                        بایگانی
                    </button>
                </div>

                <div className="relative">
                    <input className="w-full glass-panel border border-gray-200 rounded-xl p-3 pr-10 text-sm outline-none focus:ring-2 focus:ring-blue-100" placeholder="جستجو در لیست..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
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
                    <div className="text-center py-20 glass-panel rounded-2xl border border-dashed border-gray-300">
                        <div className="text-gray-400 font-bold">موردی یافت نشد.</div>
                        {activeTab === 'CARTABLE' && <div className="text-xs text-gray-300 mt-2">خوشبختانه کارتابل شما خالی است! 🎉</div>}
                    </div>
                ) : (
                    displayPermits.map(p => renderPermitCard(p))
                )}
            </div>

            {/* Modals */}
            {viewPermit && (
                <div className={isMobile ? "fixed inset-0 z-[100] glass-panel overflow-y-auto" : ""}>
                    <PrintExitPermit 
                        permit={viewPermit} 
                        onClose={() => setViewPermit(null)} 
                        settings={settings}
                        showPrice={currentUser.role === UserRole.CEO || currentUser.role === UserRole.SALES_MANAGER || currentUser.role === UserRole.ADMIN}
                        onApprove={
                            (isMyTurn(viewPermit) || currentUser.role === UserRole.ADMIN) 
                            ? () => handleApprove(viewPermit) 
                            : undefined
                        }
                        onReject={
                            (isMyTurn(viewPermit) || currentUser.role === UserRole.ADMIN) 
                            ? async () => {
                                const reason = prompt('دلیل رد:'); 
                                if(reason) { 
                                    await updateExitPermitStatus(viewPermit.id, ExitPermitStatus.REJECTED, currentUser, { rejectionReason: reason }); 
                                    loadData(); setViewPermit(null); 
                                } 
                            } : undefined
                        }
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

            {securityFinalize && (
                <SecurityFinalizeModal
                    permit={securityFinalize}
                    onClose={() => setSecurityFinalize(null)}
                    onConfirm={handleSecuritySubmit}
                />
            )}
        </div>
    );
};

export default ManageExitPermits;