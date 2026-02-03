
import React, { useState, useEffect } from 'react';
import { ExitPermit, ExitPermitStatus, User, UserRole, SystemSettings, ExitPermitItem } from '../types';
import { getExitPermits, updateExitPermitStatus, deleteExitPermit, editExitPermit, getSettings } from '../services/storageService';
import { getUsers } from '../services/authService';
import { apiCall } from '../services/apiService';
import { formatDate } from '../constants';
import { Eye, Trash2, Search, CheckCircle, Truck, Edit, Loader2, Archive, ShieldCheck, Warehouse, User as UserIcon, Building2, Bell, X, Send, AlertTriangle } from 'lucide-react';
import PrintExitPermit from './PrintExitPermit';
import WarehouseFinalizeModal from './WarehouseFinalizeModal'; 
import EditExitPermitModal from './EditExitPermitModal';

const ManageExitPermits: React.FC<{ currentUser: User, statusFilter?: any }> = ({ currentUser, statusFilter }) => {
    const [permits, setPermits] = useState<ExitPermit[]>([]);
    const [settings, setSettings] = useState<SystemSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'MY_CARTABLE' | 'ACTIVE_FLOW' | 'ARCHIVE'>('MY_CARTABLE');
    const [searchTerm, setSearchTerm] = useState('');
    
    const [viewPermit, setViewPermit] = useState<ExitPermit | null>(null);
    const [editPermit, setEditPermit] = useState<ExitPermit | null>(null);
    const [warehouseFinalize, setWarehouseFinalize] = useState<ExitPermit | null>(null);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [capturePermit, setCapturePermit] = useState<ExitPermit | null>(null);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [data, s] = await Promise.all([getExitPermits(), getSettings()]);
            setPermits(Array.isArray(data) ? data.sort((a, b) => b.createdAt - a.createdAt) : []);
            setSettings(s);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const isMyTurn = (p: ExitPermit) => {
        if (p.status === ExitPermitStatus.REJECTED || p.status === ExitPermitStatus.EXITED) return false;
        const role = currentUser.role;
        if (role === UserRole.ADMIN) return true;
        if (p.status === ExitPermitStatus.PENDING_CEO && role === UserRole.CEO) return true;
        if (p.status === ExitPermitStatus.PENDING_FACTORY && role === UserRole.FACTORY_MANAGER) return true;
        if (p.status === ExitPermitStatus.PENDING_WAREHOUSE && role === UserRole.WAREHOUSE_KEEPER) return true;
        if (p.status === ExitPermitStatus.PENDING_SECURITY && (role === UserRole.SECURITY_HEAD || role === UserRole.SECURITY_GUARD)) return true;
        return false;
    };

    const broadcastStep = async (permit: ExitPermit, eventType: 'CREATED' | 'CEO_OK' | 'FACTORY_OK' | 'WAREHOUSE_OK' | 'SECURITY_OK' | 'DELETED' | 'EDITED') => {
        const elementId = `capture-permit-${permit.id}`;
        const element = document.getElementById(elementId);
        if (!element) return;

        try {
            // @ts-ignore
            const canvas = await window.html2canvas(element, { scale: 2, backgroundColor: '#ffffff' });
            const base64 = canvas.toDataURL('image/png').split(',')[1];
            const allUsers = await getUsers();
            const targets: {type: string, id: string}[] = [];

            const addByRole = (role: string) => {
                const u = allUsers.find(x => x.role === role && x.phoneNumber);
                if (u) {
                    targets.push({ type: 'whatsapp', id: u.phoneNumber });
                    if (u.telegramChatId) targets.push({ type: 'telegram', id: u.telegramChatId });
                    if (u.baleChatId) targets.push({ type: 'bale', id: u.baleChatId });
                }
            };

            const addGroup = (groupId?: string) => {
                if (!groupId) return;
                targets.push({ type: 'whatsapp', id: groupId });
                // Note: System settings should ideally have Bale/Telegram group IDs too
            };

            let title = '';
            const g1 = settings?.exitPermitGroup1Id;
            const g2 = settings?.exitPermitGroup2Id;

            switch(eventType) {
                case 'CREATED':
                    title = '🆕 درخواست جدید خروج کالا';
                    addByRole(UserRole.CEO);
                    break;
                case 'CEO_OK':
                    title = '✅ تایید مدیرعامل - ارجاع به کارخانه';
                    addGroup(g1);
                    addByRole(UserRole.FACTORY_MANAGER);
                    break;
                case 'FACTORY_OK':
                    title = '✅ تایید مدیر کارخانه - ارجاع به انبار';
                    addGroup(g2);
                    addByRole(UserRole.WAREHOUSE_KEEPER);
                    break;
                case 'WAREHOUSE_OK':
                    title = '⚖️ تایید و توزین انبار - ارجاع به انتظامات';
                    addGroup(g2);
                    addByRole(UserRole.SECURITY_HEAD);
                    break;
                case 'SECURITY_OK':
                    title = '🚚 خروج نهایی از کارخانه (بایگانی)';
                    addGroup(g1);
                    addGroup(g2);
                    break;
                case 'DELETED':
                    title = '❌❌ مجوز خروج ابطال و حذف شد ❌❌';
                    addGroup(g1);
                    addGroup(g2);
                    break;
                case 'EDITED':
                    title = '📝 اصلاحیه مجوز خروج (نیاز به تایید مجدد)';
                    addByRole(UserRole.CEO);
                    break;
            }

            const caption = `🚛 *${title}*\n🔢 شماره: ${permit.permitNumber}\n👤 گیرنده: ${permit.recipientName}\n📦 کالا: ${permit.goodsName}\n🕒 زمان: ${new Date().toLocaleTimeString('fa-IR')}`;

            await apiCall('/send-multichannel', 'POST', {
                targets: targets.filter((v,i,a)=>a.findIndex(t=>(t.id===v.id))===i),
                message: caption,
                mediaData: { data: base64, mimeType: 'image/png', filename: `Permit_${permit.permitNumber}.png` }
            });
        } catch (e) { console.error("Broadcast failed", e); }
    };

    const handleApprove = async (p: ExitPermit) => {
        if (p.status === ExitPermitStatus.PENDING_WAREHOUSE) {
            setWarehouseFinalize(p);
            return;
        }

        let exitTime = '';
        if (p.status === ExitPermitStatus.PENDING_SECURITY) {
            exitTime = prompt('ساعت خروج را تایید یا وارد کنید:', new Date().toLocaleTimeString('fa-IR', {hour:'2-digit', minute:'2-digit'})) || '';
            if (!exitTime) return;
        } else {
            if (!confirm('آیا این مرحله را تایید می‌کنید؟')) return;
        }

        setProcessingId(p.id);
        try {
            let nextStatus = ExitPermitStatus.PENDING_FACTORY;
            let event: any = 'CEO_OK';

            if (p.status === ExitPermitStatus.PENDING_CEO) nextStatus = ExitPermitStatus.PENDING_FACTORY;
            else if (p.status === ExitPermitStatus.PENDING_FACTORY) { nextStatus = ExitPermitStatus.PENDING_WAREHOUSE; event = 'FACTORY_OK'; }
            else if (p.status === ExitPermitStatus.PENDING_SECURITY) { nextStatus = ExitPermitStatus.EXITED; event = 'SECURITY_OK'; }

            const updates: any = { status: nextStatus };
            if (p.status === ExitPermitStatus.PENDING_CEO) updates.approverCeo = currentUser.fullName;
            if (p.status === ExitPermitStatus.PENDING_FACTORY) updates.approverFactory = currentUser.fullName;
            if (p.status === ExitPermitStatus.PENDING_SECURITY) {
                updates.approverSecurity = currentUser.fullName;
                updates.exitTime = exitTime;
            }

            const updated = { ...p, ...updates };
            await apiCall(`/exit-permits/${p.id}`, 'PUT', updates);
            
            setCapturePermit(updated);
            setTimeout(async () => {
                await broadcastStep(updated, event);
                setCapturePermit(null);
                setProcessingId(null);
                loadData();
            }, 1500);
        } catch (e) { alert('خطا در تایید'); setProcessingId(null); }
    };

    const handleWarehouseSubmit = async (finalItems: ExitPermitItem[]) => {
        if (!warehouseFinalize) return;
        setProcessingId(warehouseFinalize.id);
        try {
            const updated = { 
                ...warehouseFinalize, 
                items: finalItems, 
                status: ExitPermitStatus.PENDING_SECURITY, 
                approverWarehouse: currentUser.fullName,
                cartonCount: finalItems.reduce((a,b)=>a+b.cartonCount, 0),
                weight: finalItems.reduce((a,b)=>a+b.weight, 0)
            };
            await apiCall(`/exit-permits/${updated.id}`, 'PUT', updated);
            
            setCapturePermit(updated);
            setTimeout(async () => {
                await broadcastStep(updated, 'WAREHOUSE_OK');
                setCapturePermit(null);
                setWarehouseFinalize(null);
                setProcessingId(null);
                loadData();
            }, 1500);
        } catch (e) { alert('خطا در ثبت انبار'); setProcessingId(null); }
    };

    const handleDelete = async (p: ExitPermit) => {
        if (currentUser.role !== UserRole.CEO && currentUser.role !== UserRole.ADMIN) return alert('فقط مدیرعامل مجاز به حذف است.');
        if (!confirm('⚠️ هشدار: با حذف این مجوز، تمام گروه‌ها مطلع خواهند شد. آیا اطمینان دارید؟')) return;

        setProcessingId(p.id);
        setCapturePermit({ ...p, status: 'REJECTED' as any }); // Show as rejected/deleted in image
        setTimeout(async () => {
            await broadcastStep(p, 'DELETED');
            await apiCall(`/exit-permits/${p.id}`, 'DELETE');
            setCapturePermit(null);
            setProcessingId(null);
            loadData();
        }, 1500);
    };

    const filtered = permits.filter(p => {
        const match = p.permitNumber.toString().includes(searchTerm) || p.recipientName?.includes(searchTerm);
        if (activeTab === 'MY_CARTABLE') return match && isMyTurn(p);
        if (activeTab === 'ARCHIVE') return match && (p.status === ExitPermitStatus.EXITED || p.status === ExitPermitStatus.REJECTED);
        return match && p.status !== ExitPermitStatus.EXITED && p.status !== ExitPermitStatus.REJECTED && !isMyTurn(p);
    });

    return (
        <div className="space-y-6 pb-24 animate-fade-in bg-gray-50 min-h-screen">
            {/* Hidden Snapshot Zone */}
            {capturePermit && (
                <div className="fixed -left-[3000px] top-0">
                    <div id={`capture-permit-${capturePermit.id}`}>
                        <PrintExitPermit permit={capturePermit} onClose={()=>{}} embed watermark={processingId ? 'DELETED' : null} />
                    </div>
                </div>
            )}

            <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 sticky top-0 z-20 flex flex-col gap-4">
                <div className="flex justify-between items-center">
                    <h1 className="text-xl font-black text-slate-800 flex items-center gap-2"><Truck className="text-blue-600"/> کارتابل خروج کالا</h1>
                    <div className="text-[10px] font-bold text-slate-400 bg-slate-50 px-3 py-1 rounded-full border">{permits.length} کل اسناد</div>
                </div>
                <div className="flex p-1 bg-slate-100 rounded-2xl">
                    <button onClick={() => setActiveTab('MY_CARTABLE')} className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'MY_CARTABLE' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>
                        <Bell size={14} className={filtered.length > 0 && activeTab === 'MY_CARTABLE' ? "animate-bounce" : ""}/> کارتابل من
                    </button>
                    <button onClick={() => setActiveTab('ACTIVE_FLOW')} className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${activeTab === 'ACTIVE_FLOW' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>جریان فعال</button>
                    <button onClick={() => setActiveTab('ARCHIVE')} className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${activeTab === 'ARCHIVE' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>بایگانی</button>
                </div>
                <div className="relative">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
                    <input className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 pr-10 pl-4 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/10 transition-all" placeholder="جستجو شماره یا گیرنده..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 px-2">
                {loading ? (
                    <div className="flex flex-col items-center py-20 text-slate-400 gap-3"><Loader2 className="animate-spin" size={32}/><span className="text-sm font-bold">بارگذاری...</span></div>
                ) : filtered.length === 0 ? (
                    <div className="bg-white p-20 rounded-3xl border border-dashed border-slate-200 text-center text-slate-400 flex flex-col items-center gap-2"><Archive size={48} className="opacity-20"/><span className="text-sm font-bold">موردی یافت نشد</span></div>
                ) : (
                    filtered.map(p => {
                        const canAct = isMyTurn(p);
                        return (
                            <div key={p.id} className={`bg-white rounded-3xl p-5 border-2 transition-all relative overflow-hidden ${canAct ? 'border-blue-400 shadow-lg scale-[1.01]' : 'border-white shadow-sm'}`}>
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center font-black text-slate-700 text-lg border border-slate-200 shadow-inner">{p.permitNumber}</div>
                                        <div>
                                            <h3 className="font-bold text-slate-800 text-base">{p.recipientName}</h3>
                                            <p className="text-[10px] text-slate-400 font-bold">{formatDate(p.date)} | {p.requester}</p>
                                        </div>
                                    </div>
                                    <div className={`px-3 py-1 rounded-full text-[9px] font-black ${p.status === ExitPermitStatus.EXITED ? 'bg-green-100 text-green-700' : 'bg-blue-50 text-blue-600'}`}>
                                        {p.status}
                                    </div>
                                </div>

                                <div className="flex gap-2 mb-4">
                                    {canAct && !processingId && (
                                        <button onClick={() => handleApprove(p)} className="flex-1 bg-blue-600 text-white py-3 rounded-2xl text-xs font-black shadow-lg shadow-blue-200 hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-2">
                                            <CheckCircle size={18}/> تایید و ارجاع
                                        </button>
                                    )}
                                    <button onClick={() => setViewPermit(p)} className="bg-slate-100 text-slate-600 px-5 py-3 rounded-2xl text-xs font-bold hover:bg-slate-200 transition-all flex items-center justify-center gap-1">
                                        <Eye size={18}/> مشاهده
                                    </button>
                                    {(currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.CEO || currentUser.role === UserRole.SALES_MANAGER) && (
                                        <button onClick={() => setEditPermit(p)} className="bg-amber-50 text-amber-600 p-3 rounded-2xl hover:bg-amber-100"><Edit size={18}/></button>
                                    )}
                                    {(currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.CEO) && (
                                        <button onClick={() => handleDelete(p)} className="bg-red-50 text-red-500 p-3 rounded-2xl hover:bg-red-100"><Trash2 size={18}/></button>
                                    )}
                                </div>

                                {processingId === p.id && (
                                    <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center z-10">
                                        <Loader2 className="animate-spin text-blue-600 mb-2" size={32}/>
                                        <span className="text-[10px] font-black text-blue-800 animate-pulse text-center">ارسال تصویر و کپشن به<br/>واتساپ، تلگرام و بله...</span>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {viewPermit && <PrintExitPermit permit={viewPermit} onClose={() => setViewPermit(null)} settings={settings || undefined} />}
            {editPermit && <EditExitPermitModal permit={editPermit} onClose={() => setEditPermit(null)} onSave={() => { loadData(); }} />}
            {warehouseFinalize && <WarehouseFinalizeModal permit={warehouseFinalize} onClose={() => setWarehouseFinalize(null)} onConfirm={handleWarehouseSubmit} />}
        </div>
    );
};

export default ManageExitPermits;
