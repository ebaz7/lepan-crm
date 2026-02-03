
import React, { useState, useEffect } from 'react';
import { ExitPermit, ExitPermitStatus, User, UserRole, SystemSettings } from '../types';
import { getExitPermits, updateExitPermitStatus, deleteExitPermit, editExitPermit } from '../services/storageService';
import { getUsers } from '../services/authService';
import { apiCall } from '../services/apiService';
import { formatDate } from '../constants';
import { 
    Eye, Trash2, Search, CheckCircle, Truck, Edit, Loader2, 
    Archive, ShieldCheck, Warehouse, User as UserIcon, Building2, Bell, X, Send
} from 'lucide-react';
import PrintExitPermit from './PrintExitPermit';
import WarehouseFinalizeModal from './WarehouseFinalizeModal'; 
import EditExitPermitModal from './EditExitPermitModal';

const ManageExitPermits: React.FC<{ currentUser: User, settings?: SystemSettings, statusFilter?: any }> = ({ currentUser, settings, statusFilter }) => {
    const [permits, setPermits] = useState<ExitPermit[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'MY_CARTABLE' | 'ALL_ACTIVE' | 'ARCHIVE'>('MY_CARTABLE');
    const [searchTerm, setSearchTerm] = useState('');
    
    const [viewPermit, setViewPermit] = useState<ExitPermit | null>(null);
    const [editPermit, setEditPermit] = useState<ExitPermit | null>(null);
    const [warehouseFinalize, setWarehouseFinalize] = useState<ExitPermit | null>(null);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [autoSendPermit, setAutoSendPermit] = useState<ExitPermit | null>(null);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await getExitPermits();
            setPermits(Array.isArray(data) ? data.sort((a, b) => b.createdAt - a.createdAt) : []);
        } catch (e) {
            console.error(e);
            setPermits([]);
        } finally {
            setLoading(false);
        }
    };

    const isMyTurn = (p: ExitPermit) => {
        if (p.status === ExitPermitStatus.REJECTED || p.status === ExitPermitStatus.EXITED) return false;
        if (currentUser.role === UserRole.ADMIN) return true;

        switch (p.status) {
            case ExitPermitStatus.PENDING_CEO: return currentUser.role === UserRole.CEO;
            case ExitPermitStatus.PENDING_FACTORY: return currentUser.role === UserRole.FACTORY_MANAGER;
            case ExitPermitStatus.PENDING_WAREHOUSE: return currentUser.role === UserRole.WAREHOUSE_KEEPER;
            case ExitPermitStatus.PENDING_SECURITY: return currentUser.role === UserRole.SECURITY_HEAD || currentUser.role === UserRole.SECURITY_GUARD;
            default: return false;
        }
    };

    const broadcastStep = async (permit: ExitPermit, prevStatus: ExitPermitStatus | 'CREATED' | 'DELETED' | 'EDITED') => {
        const elementId = `print-permit-capture-${permit.id}`;
        const element = document.getElementById(elementId);
        if (!element) return;

        try {
            // @ts-ignore
            const canvas = await window.html2canvas(element, { scale: 2, backgroundColor: '#ffffff' });
            const base64 = canvas.toDataURL('image/png').split(',')[1];
            const allUsers = await getUsers();
            const targets: {type: string, id: string}[] = [];

            // Group mappings from settings
            const group1 = settings?.exitPermitGroup1Id;
            const group2 = settings?.exitPermitGroup2Id;

            const addRole = (role: string) => {
                const u = allUsers.find(x => x.role === role);
                if (u?.phoneNumber) targets.push({ type: 'whatsapp', id: u.phoneNumber });
                if (u?.telegramChatId) targets.push({ type: 'telegram', id: u.telegramChatId });
                if (u?.baleChatId) targets.push({ type: 'bale', id: u.baleChatId });
            };

            const addGroup = (groupId?: string) => {
                if (!groupId) return;
                targets.push({ type: 'whatsapp', id: groupId });
                // If there are Bale/Telegram equivalents for groups, they'd go here
            };

            let captionTitle = '';
            if (prevStatus === 'CREATED') {
                captionTitle = '🆕 درخواست جدید خروج بار';
                addRole(UserRole.CEO);
            } else if (prevStatus === ExitPermitStatus.PENDING_CEO) {
                captionTitle = '✅ تایید مدیرعامل -> ارجاع به کارخانه';
                addGroup(group1);
                addRole(UserRole.FACTORY_MANAGER);
            } else if (prevStatus === ExitPermitStatus.PENDING_FACTORY) {
                captionTitle = '✅ تایید مدیر کارخانه -> ارجاع به انبار';
                addGroup(group2);
                addRole(UserRole.WAREHOUSE_KEEPER);
            } else if (prevStatus === ExitPermitStatus.PENDING_WAREHOUSE) {
                captionTitle = '⚖️ تایید و توزین انبار -> ارجاع به انتظامات';
                addGroup(group1);
                addGroup(group2);
                addRole(UserRole.SECURITY_HEAD);
            } else if (prevStatus === ExitPermitStatus.PENDING_SECURITY) {
                captionTitle = '🚚 خروج نهایی از کارخانه (بایگانی)';
                addGroup(group1);
                addGroup(group2);
            } else if (prevStatus === 'DELETED') {
                captionTitle = '❌❌ لغو و حذف مجوز خروج ❌❌';
                addGroup(group1);
                addGroup(group2);
            } else if (prevStatus === 'EDITED') {
                captionTitle = '📝 اصلاحیه مجوز خروج بار';
                addRole(UserRole.CEO);
            }

            const caption = `🚛 *${captionTitle}*\n🔢 شماره: ${permit.permitNumber}\n👤 گیرنده: ${permit.recipientName}\n📦 کالا: ${permit.goodsName}\n🕒 زمان: ${new Date().toLocaleTimeString('fa-IR')}`;

            await apiCall('/send-multichannel', 'POST', { targets, message: caption, mediaData: { data: base64, mimeType: 'image/png', filename: `Permit_${permit.permitNumber}.png` } });
        } catch (e) {
            console.error("Broadcast failed", e);
        }
    };

    const handleApprove = async (p: ExitPermit) => {
        if (p.status === ExitPermitStatus.PENDING_WAREHOUSE) {
            setWarehouseFinalize(p);
            return;
        }

        let exitTime = '';
        if (p.status === ExitPermitStatus.PENDING_SECURITY) {
            const time = prompt('ساعت خروج را وارد کنید:', new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }));
            if (!time) return;
            exitTime = time;
        } else {
            if (!confirm('آیا تایید می‌کنید؟')) return;
        }

        setProcessingId(p.id);
        try {
            let nextStatus = ExitPermitStatus.PENDING_FACTORY;
            if (p.status === ExitPermitStatus.PENDING_CEO) nextStatus = ExitPermitStatus.PENDING_FACTORY;
            else if (p.status === ExitPermitStatus.PENDING_FACTORY) nextStatus = ExitPermitStatus.PENDING_WAREHOUSE;
            else if (p.status === ExitPermitStatus.PENDING_SECURITY) nextStatus = ExitPermitStatus.EXITED;

            const updates: any = { status: nextStatus };
            if (p.status === ExitPermitStatus.PENDING_CEO) updates.approverCeo = currentUser.fullName;
            if (p.status === ExitPermitStatus.PENDING_FACTORY) updates.approverFactory = currentUser.fullName;
            if (p.status === ExitPermitStatus.PENDING_SECURITY) {
                updates.approverSecurity = currentUser.fullName;
                updates.exitTime = exitTime;
            }

            const updated = { ...p, ...updates };
            await updateExitPermitStatus(p.id, nextStatus, currentUser, { exitTime });
            
            setAutoSendPermit(updated);
            setTimeout(async () => {
                await broadcastStep(updated, p.status);
                setAutoSendPermit(null);
                setProcessingId(null);
                loadData();
            }, 1500);
        } catch (e) {
            alert('خطا در تایید');
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
                status: ExitPermitStatus.PENDING_SECURITY, 
                approverWarehouse: currentUser.fullName,
                goodsName: finalItems.map(i => `${i.goodsName} (${i.deliveredCartonCount} کارتن)`).join('، ')
            };
            await editExitPermit(updated);
            
            setAutoSendPermit(updated);
            setTimeout(async () => {
                await broadcastStep(updated, ExitPermitStatus.PENDING_WAREHOUSE);
                setAutoSendPermit(null);
                setWarehouseFinalize(null);
                setProcessingId(null);
                loadData();
            }, 1500);
        } catch (e) {
            alert('خطا');
            setProcessingId(null);
        }
    };

    const handleDelete = async (p: ExitPermit) => {
        if (currentUser.role !== UserRole.CEO && currentUser.role !== UserRole.ADMIN) {
            alert('حذف فقط با تایید مدیرعامل امکان‌پذیر است.');
            return;
        }
        if (!confirm('آیا از حذف کامل این مجوز و اطلاع‌رسانی به گروه‌ها اطمینان دارید؟')) return;
        
        setProcessingId(p.id);
        setAutoSendPermit(p); // For capturing with DELETED watermark
        setTimeout(async () => {
            await broadcastStep(p, 'DELETED');
            await deleteExitPermit(p.id);
            setAutoSendPermit(null);
            setProcessingId(null);
            loadData();
        }, 1500);
    };

    const filtered = permits.filter(p => {
        const match = p.permitNumber.toString().includes(searchTerm) || p.recipientName?.includes(searchTerm);
        if (activeTab === 'MY_CARTABLE') return match && isMyTurn(p);
        if (activeTab === 'ARCHIVE') return match && (p.status === ExitPermitStatus.EXITED || p.status === ExitPermitStatus.REJECTED);
        return match && p.status !== ExitPermitStatus.EXITED && p.status !== ExitPermitStatus.REJECTED;
    });

    return (
        <div className="space-y-6 pb-24 animate-fade-in bg-gray-50 min-h-screen">
            {/* Hidden capture zone */}
            {autoSendPermit && (
                <div className="fixed -left-[2000px] top-0">
                    <div id={`print-permit-capture-${autoSendPermit.id}`}>
                        <PrintExitPermit 
                            permit={autoSendPermit} 
                            onClose={() => {}} 
                            embed 
                            watermark={processingId ? (autoSendPermit.status === ExitPermitStatus.EXITED ? null : 'DELETED' as any) : null}
                        />
                    </div>
                </div>
            )}

            <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 flex flex-col gap-4">
                <div className="flex justify-between items-center">
                    <h1 className="text-xl font-black text-slate-800 flex items-center gap-2"><Truck className="text-blue-600"/> مدیریت خروج کالا</h1>
                    <div className="text-xs font-bold text-slate-400 bg-slate-50 px-3 py-1 rounded-full">{permits.length} کل حواله‌ها</div>
                </div>
                
                <div className="flex p-1 bg-slate-100 rounded-2xl">
                    <button onClick={() => setActiveTab('MY_CARTABLE')} className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${activeTab === 'MY_CARTABLE' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>کارتابل من</button>
                    <button onClick={() => setActiveTab('ALL_ACTIVE')} className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${activeTab === 'ALL_ACTIVE' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>جریان فعال</button>
                    <button onClick={() => setActiveTab('ARCHIVE')} className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${activeTab === 'ARCHIVE' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>بایگانی</button>
                </div>

                <div className="relative">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
                    <input className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 pr-10 pl-4 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 transition-all" placeholder="جستجو شماره یا گیرنده..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 px-1">
                {loading ? (
                    <div className="flex flex-col items-center py-20 text-slate-400 gap-3"><Loader2 className="animate-spin" size={32}/><span className="text-sm font-bold">بارگذاری...</span></div>
                ) : filtered.length === 0 ? (
                    <div className="bg-white p-20 rounded-3xl border border-dashed border-slate-200 text-center text-slate-400 flex flex-col items-center gap-2"><Archive size={48} className="opacity-20"/><span className="text-sm font-bold">موردی یافت نشد</span></div>
                ) : (
                    filtered.map(p => {
                        const canAct = isMyTurn(p);
                        return (
                            <div key={p.id} className={`bg-white rounded-3xl p-5 border-2 transition-all relative overflow-hidden ${canAct ? 'border-blue-400 shadow-lg' : 'border-white shadow-sm'}`}>
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center font-black text-slate-700 text-lg border border-slate-200">{p.permitNumber}</div>
                                        <div>
                                            <h3 className="font-bold text-slate-800">{p.recipientName}</h3>
                                            <p className="text-[10px] text-slate-400 font-bold">{formatDate(p.date)} | {p.requester}</p>
                                        </div>
                                    </div>
                                    <div className={`px-3 py-1 rounded-full text-[10px] font-black ${p.status === ExitPermitStatus.EXITED ? 'bg-green-100 text-green-700' : 'bg-blue-50 text-blue-600'}`}>
                                        {p.status}
                                    </div>
                                </div>

                                <div className="text-xs text-slate-500 mb-4 bg-slate-50 p-3 rounded-2xl border border-slate-100 italic">
                                    {p.goodsName}
                                </div>

                                <div className="flex gap-2">
                                    {canAct && !processingId && (
                                        <button onClick={() => handleApprove(p)} className="flex-1 bg-blue-600 text-white py-3 rounded-2xl text-xs font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-2">
                                            <CheckCircle size={16}/> تایید و ارجاع بعدی
                                        </button>
                                    )}
                                    <button onClick={() => setViewPermit(p)} className="bg-slate-100 text-slate-600 px-4 py-3 rounded-2xl text-xs font-bold hover:bg-slate-200 transition-all flex items-center justify-center gap-1">
                                        <Eye size={16}/> نمایش
                                    </button>
                                    {(currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.CEO) && (
                                        <>
                                            <button onClick={() => setEditPermit(p)} className="bg-amber-50 text-amber-600 p-3 rounded-2xl hover:bg-amber-100"><Edit size={18}/></button>
                                            <button onClick={() => handleDelete(p)} className="bg-red-50 text-red-500 p-3 rounded-2xl hover:bg-red-100"><Trash2 size={18}/></button>
                                        </>
                                    )}
                                </div>

                                {processingId === p.id && (
                                    <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center z-10">
                                        <Loader2 className="animate-spin text-blue-600 mb-2" size={32}/>
                                        <span className="text-[10px] font-black text-blue-800 animate-pulse">در حال ارسال پیام به واتساپ، تلگرام و بله...</span>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {viewPermit && (
                <PrintExitPermit 
                    permit={viewPermit} 
                    onClose={() => setViewPermit(null)} 
                    settings={settings}
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
