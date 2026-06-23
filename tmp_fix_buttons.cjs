const fs = require('fs');
let content = fs.readFileSync('components/ManageExitPermits.tsx', 'utf8');

// fix mobile duplication: delete one block
const mobileDup = `                 {(currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.FACTORY_MANAGER || currentUser.role === UserRole.WAREHOUSE_KEEPER) && p.status !== ExitPermitStatus.EXITED && p.status !== ExitPermitStatus.REJECTED && p.status !== ExitPermitStatus.CANCELED && !processingId && (
                      <button onClick={() => handleManualResend(p)} className="bg-sky-50 text-sky-600 px-3 py-2 rounded-lg hover:bg-sky-100" title="ارسال مجدد پیام ربات به گروه‌ها">
                          <Send size={16}/>
                      </button>
                 )}`;
content = content.replace(mobileDup + '\\n' + mobileDup, mobileDup);

// web button
const webTgt = `                             <button onClick={() => { setViewMode(p.status === ExitPermitStatus.EXITED ? 'EXIT' : 'PROFORMA'); setViewPermit(p); }} className="bg-gray-100 text-gray-700 p-2 rounded-xl hover:bg-gray-200"><Eye size={18}/></button>
                            {(currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.CEO || (currentUser.role === UserRole.SALES_MANAGER && p.status === ExitPermitStatus.PENDING_CEO)) && (`;

const webRep = `                             <button onClick={() => { setViewMode(p.status === ExitPermitStatus.EXITED ? 'EXIT' : 'PROFORMA'); setViewPermit(p); }} className="bg-gray-100 text-gray-700 p-2 rounded-xl hover:bg-gray-200"><Eye size={18}/></button>
                            {(currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.FACTORY_MANAGER || currentUser.role === UserRole.WAREHOUSE_KEEPER) && p.status !== ExitPermitStatus.EXITED && p.status !== ExitPermitStatus.REJECTED && p.status !== ExitPermitStatus.CANCELED && !processingId && (
                                <button onClick={() => handleManualResend(p)} className="bg-sky-50 text-sky-600 p-2 rounded-xl hover:bg-sky-100" title="ارسال مجدد پیام ربات">
                                    <Send size={18}/>
                                </button>
                            )}
                            {(currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.CEO || (currentUser.role === UserRole.SALES_MANAGER && p.status === ExitPermitStatus.PENDING_CEO)) && (`;

if (content.includes(webTgt)) {
    content = content.replace(webTgt, webRep);
} else {
    content = content.replace(webTgt.replace(/\r\n/g, '\\n'), webRep);
}

fs.writeFileSync('components/ManageExitPermits.tsx', content);
