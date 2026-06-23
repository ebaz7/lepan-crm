const fs = require('fs');
let content = fs.readFileSync('components/ManageExitPermits.tsx', 'utf8');

// Import Send
const importTarget = `User as UserIcon, Building2, Bell, AlertTriangle, MoreVertical, Edit3, FileText`;
const importRep = `User as UserIcon, Building2, Bell, AlertTriangle, MoreVertical, Edit3, FileText, Send`;
content = content.replace(importTarget, importRep);

// Mobile Button
const mobileButtonTarget = `                 <button onClick={() => { setViewMode(p.status === ExitPermitStatus.EXITED ? 'EXIT' : 'PROFORMA'); handleApprove(p); }} className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-xs font-bold shadow-sm">
                         {getActionLabel(p.status)}
                     </button>
                )}`;
const mobileButtonRep = `                 <button onClick={() => { setViewMode(p.status === ExitPermitStatus.EXITED ? 'EXIT' : 'PROFORMA'); handleApprove(p); }} className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-xs font-bold shadow-sm">
                         {getActionLabel(p.status)}
                     </button>
                )}
                {(currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.FACTORY_MANAGER || currentUser.role === UserRole.WAREHOUSE_KEEPER) && p.status !== ExitPermitStatus.EXITED && p.status !== ExitPermitStatus.REJECTED && p.status !== ExitPermitStatus.CANCELED && !processingId && (
                     <button onClick={() => handleManualResend(p)} className="bg-sky-50 text-sky-600 px-3 py-2 rounded-lg hover:bg-sky-100" title="ارسال مجدد پیام ربات به گروه‌ها">
                         <Send size={16}/>
                     </button>
                )}`;
content = content.replace(mobileButtonTarget.replace(/\r\n/g, '\\n'), mobileButtonRep);
content = content.replace(mobileButtonTarget, mobileButtonRep);

// Web Button
const webButtonTarget = `                             <button onClick={() => { setViewMode(p.status === ExitPermitStatus.EXITED ? 'EXIT' : 'PROFORMA'); setViewPermit(p); }} className="bg-gray-100 text-gray-700 p-2 rounded-xl hover:bg-gray-200"><Eye size={18}/></button>
                            {(currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.CEO || (currentUser.role === UserRole.SALES_MANAGER && p.status === ExitPermitStatus.PENDING_CEO)) && (
                                <>
                                    <button onClick={() => setEditPermit(p)} className="bg-amber-50 text-amber-600 p-2 rounded-xl hover:bg-amber-100"><Edit size={18}/></button>
                                    <button onClick={() => handleDelete(p.id)} className="bg-red-50 text-red-500 p-2 rounded-xl hover:bg-red-100"><Trash2 size={18}/></button>
                                </>
                            )}`;

const webButtonRep = `                             <button onClick={() => { setViewMode(p.status === ExitPermitStatus.EXITED ? 'EXIT' : 'PROFORMA'); setViewPermit(p); }} className="bg-gray-100 text-gray-700 p-2 rounded-xl hover:bg-gray-200"><Eye size={18}/></button>
                            {(currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.FACTORY_MANAGER || currentUser.role === UserRole.WAREHOUSE_KEEPER) && p.status !== ExitPermitStatus.EXITED && p.status !== ExitPermitStatus.REJECTED && p.status !== ExitPermitStatus.CANCELED && !processingId && (
                                <button onClick={() => handleManualResend(p)} className="bg-sky-50 text-sky-600 p-2 rounded-xl hover:bg-sky-100 tooltip tooltip-top" title="ارسال مجدد پیام ربات">
                                    <Send size={18}/>
                                </button>
                            )}
                            {(currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.CEO || (currentUser.role === UserRole.SALES_MANAGER && p.status === ExitPermitStatus.PENDING_CEO)) && (
                                <>
                                    <button onClick={() => setEditPermit(p)} className="bg-amber-50 text-amber-600 p-2 rounded-xl hover:bg-amber-100"><Edit size={18}/></button>
                                    <button onClick={() => handleDelete(p.id)} className="bg-red-50 text-red-500 p-2 rounded-xl hover:bg-red-100"><Trash2 size={18}/></button>
                                </>
                            )}`;
content = content.replace(webButtonTarget.replace(/\r\n/g, '\\n'), webButtonRep);
content = content.replace(webButtonTarget, webButtonRep);

fs.writeFileSync('components/ManageExitPermits.tsx', content);
