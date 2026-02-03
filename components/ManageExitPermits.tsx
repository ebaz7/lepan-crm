import React, { useState, useEffect } from 'react';
import { ExitPermit, ExitPermitStatus, User, UserRole, SystemSettings } from '../types';
import { getExitPermits, updateExitPermitStatus, deleteExitPermit, editExitPermit } from '../services/storageService';
import { getUsers } from '../services/authService';
import { apiCall } from '../services/apiService';
import { formatDate } from '../constants';
import { Eye, Trash2, Search, CheckCircle, Truck, Edit, Loader2, Archive, RefreshCw } from 'lucide-react';
import PrintExitPermit from './PrintExitPermit';
import WarehouseFinalizeModal from './WarehouseFinalizeModal'; 
import EditExitPermitModal from './EditExitPermitModal';

const ManageExitPermits: React.FC<{ currentUser: User, settings?: SystemSettings, statusFilter?: any }> = ({ currentUser, settings, statusFilter }) => {
    const [permits, setPermits] = useState<ExitPermit[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'CURRENT' | 'ARCHIVE'>('CURRENT');
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
            console.error("Load Error", e);
            setPermits([]);
        } finally {
            setLoading(false);
        }
    };

    // --- LOGIC ---
    const isMyTurn = (p: ExitPermit) => {
        if (p.status === ExitPermitStatus.REJECTED || p.status === ExitPermitStatus.EXITED) return false;
        
        // Admin Override
        if (currentUser.role === UserRole.ADMIN) return true;

        if (p.status === ExitPermitStatus.PENDING_CEO && currentUser.role === UserRole.CEO) return true;
        if (p.status === ExitPermitStatus.PENDING_FACTORY && currentUser.role === UserRole.FACTORY_MANAGER) return true;
        if (p.status === ExitPermitStatus.PENDING_WAREHOUSE && currentUser.role === UserRole.WAREHOUSE_KEEPER) return true;
        if (p.status === ExitPermitStatus.PENDING_SECURITY && (currentUser.role === UserRole.SECURITY_HEAD || currentUser.role === UserRole.SECURITY_GUARD)) return true;
        
        return false;
    };

    const getActionLabel = (status: ExitPermitStatus) => {
        switch(status) {
            case ExitPermitStatus.PENDING_CEO: return 'تایید مدیرعامل';
            case ExitPermitStatus.PENDING_FACTORY: return 'تایید مدیر کارخانه';
            case ExitPermitStatus.PENDING_WAREHOUSE: return 'تایید و توزین انبار';
            case ExitPermitStatus.PENDING_SECURITY: return 'تایید خروج (انتظامات)';
            default: return '';
        }
    };

    // --- ACTIONS ---
    const handleApprove = async (p: ExitPermit) => {
        if (!p || !p.id) {
            alert("خطا: شناسه حواله نامعتبر است.");
            return;
        }

        if (p.status === ExitPermitStatus.PENDING_WAREHOUSE) { 
            setWarehouseFinalize(p); 
            return; 
        }
        
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
            if (p.status === ExitPermitStatus.PENDING_CEO) nextStatus = ExitPermitStatus.PENDING_FACTORY;
            else if (p.status === ExitPermitStatus.PENDING_FACTORY) nextStatus = ExitPermitStatus.PENDING_WAREHOUSE;
            // PENDING_WAREHOUSE case is handled via setWarehouseFinalize above
            else if (p.status === ExitPermitStatus.PENDING_SECURITY) nextStatus = ExitPermitStatus.EXITED;

            const updatedPermit = { ...p, status: nextStatus };
            if (p.status === ExitPermitStatus.PENDING_CEO) updatedPermit.approverCeo = currentUser.fullName;
            else if (p.status === ExitPermitStatus.PENDING_FACTORY) updatedPermit.approverFactory = currentUser.fullName;
            else if (p.status === ExitPermitStatus.PENDING_SECURITY) {
                updatedPermit.approverSecurity = currentUser.fullName;
                updatedPermit.exitTime = exitTimeStr;
            }

            // CRITICAL CALL
            await updateExitPermitStatus(p.id, nextStatus, currentUser, { exitTime: exitTimeStr });
            
            // Notification logic
            setAutoSendPermit(updatedPermit);
            setTimeout(async () => {
                await sendNotification(updatedPermit, p.status, exitTimeStr);
                setProcessingId(null);
                setAutoSendPermit(null);
                loadData();
            }, 2000);

        } catch (e: any) {
            console.error("Approve Error:", e);
            alert(`خطا در عملیات: ${e.message || 'Server Error'}`);
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
            }, 2000);
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
            
            const allUsers = await getUsers();
            for (const t of targets) {
                let num = '';
                if (t.role) {
                    const u = allUsers.find(x => x.role === t.role);
                    if (u) num = u.phoneNumber || '';
                } else if (t.group) {
                    num = t.group;
                }
                
                if (num) {
                    await apiCall('/send-whatsapp', 'POST', { number: num, message: caption, mediaData: { data: base64, mimeType: 'image/png', filename: `Permit_${permit.permitNumber}.png` } });
                }
            }
        } catch (e) { console.error("Notif Error", e); }
    };

    const handleDelete = async (id: string) => {
        if(!confirm('حذف شود؟')) return;
        await deleteExitPermit(id);
        loadData();
    };

    const filteredPermits = permits.filter(p => {
        const matches = String(p.permitNumber).includes(searchTerm) || p.recipientName?.includes(searchTerm);
        if (activeTab === 'ARCHIVE') return matches && (p.status === ExitPermitStatus.EXITED || p.status === ExitPermitStatus.REJECTED);
        return matches && p.status !== ExitPermitStatus.EXITED && p.status !== ExitPermitStatus.REJECTED;
    });

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

            <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                <h1 className="text-lg font-black text-gray-800 flex items-center gap-2"><Truck className="text-teal-600"/> کارتابل مجوز خروج</h1>
                <button onClick={loadData} className="p-2 bg-gray-100 rounded-full"><RefreshCw size={16}/></button>
            </div>

            <div className="flex bg-gray-200 p-1 rounded-lg">
                <button onClick={() => setActiveTab('CURRENT')} className={`flex-1 py-2 text-sm font-bold rounded-md ${activeTab==='CURRENT' ? 'bg-white shadow text-blue-600' : 'text-gray-600'}`}>جاری</button>
                <button onClick={() => setActiveTab('ARCHIVE')} className={`flex-1 py-2 text-sm font-bold rounded-md ${activeTab==='ARCHIVE' ? 'bg-white shadow text-gray-800' : 'text-gray-600'}`}>بایگانی</button>
            </div>

            <div className="relative">
                <input className="w-full bg-white border border-gray-200 rounded-xl p-3 pr-10 text-sm outline-none" placeholder="جستجو شماره یا گیرنده..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                <Search className="absolute right-3 top-3.5 text-gray-400" size={18}/>
            </div>

            <div className="space-y-3">
                {loading ? <div className="text-center py-10 text-gray-400"><Loader2 className="animate-spin inline-block"/></div> : 
                 filteredPermits.length === 0 ? <div className="text-center py-10 text-gray-400">موردی یافت نشد.</div> :
                 filteredPermits.map(permit => {
                     const canAct = isMyTurn(permit);
                     return (
                         <div key={permit.id} className={`bg-white rounded-xl border p-4 relative ${canAct ? 'border-blue-400 shadow-md' : 'border-gray-200'}`}>
                             {canAct && <div className="absolute top-0 right-0 bg-blue-500 text-white text-[10px] px-2 py-0.5 rounded-bl-lg font-bold">نوبت شماست</div>}
                             
                             <div className="flex justify-between items-start mb-2">
                                 <div>
                                     <div className="font-black text-lg text-gray-800">#{permit.permitNumber}</div>
                                     <div className="text-sm font-bold text-gray-600">{permit.recipientName}</div>
                                     <div className="text-xs text-gray-500 mt-1">{permit.goodsName} | {formatDate(permit.date)}</div>
                                 </div>
                                 <div className={`text-[10px] px-2 py-1 rounded border ${permit.status === ExitPermitStatus.REJECTED ? 'bg-red-50 text-red-600 border-red-200' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                                     {permit.status}
                                 </div>
                             </div>
                             
                             <div className="flex gap-2 mt-4 pt-3 border-t border-gray-100">
                                 {canAct && !processingId && (
                                     <button onClick={() => handleApprove(permit)} className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-xs font-bold hover:bg-blue-700 flex items-center justify-center gap-1">
                                         <CheckCircle size={14}/> {getActionLabel(permit.status)}
                                     </button>
                                 )}
                                 <button onClick={() => setViewPermit(permit)} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-xs font-bold hover:bg-gray-200 flex items-center justify-center gap-1">
                                     <Eye size={14}/> نمایش
                                 </button>
                                 {(currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.CEO || (currentUser.role === UserRole.SALES_MANAGER && permit.status === ExitPermitStatus.PENDING_CEO)) && (
                                     <>
                                        <button onClick={() => setEditPermit(permit)} className="bg-amber-50 text-amber-600 px-3 rounded-lg hover:bg-amber-100"><Edit size={16}/></button>
                                        <button onClick={() => handleDelete(permit.id)} className="bg-red-50 text-red-500 px-3 rounded-lg hover:bg-red-100"><Trash2 size={16}/></button>
                                     </>
                                 )}
                             </div>

                             {processingId === permit.id && (
                                 <div className="absolute inset-0 bg-white/80 flex items-center justify-center rounded-xl z-10">
                                     <Loader2 className="animate-spin text-blue-600"/>
                                 </div>
                             )}
                         </div>
                     );
                 })
                }
            </div>

            {viewPermit && (
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