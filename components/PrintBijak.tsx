
import React, { useState, useEffect, useRef } from 'react';
import { WarehouseTransaction, SystemSettings, Contact } from '../types';
import { formatCurrency, formatDate } from '../constants';
import { X, Printer, Loader2, Share2, Search, Users, Smartphone, FileDown, CheckCircle, XCircle, AlertTriangle, Trash2 } from 'lucide-react';
import { apiCall } from '../services/apiService';
import { getUsers } from '../services/authService';
import { generatePdf } from '../utils/pdfGenerator'; 
import html2canvas from 'html2canvas';

interface PrintBijakProps {
  tx: WarehouseTransaction;
  onClose: () => void;
  settings?: SystemSettings;
  embed?: boolean;
  forceHidePrices?: boolean;
  onApprove?: () => void;
  onReject?: () => void;
  transactions?: WarehouseTransaction[];
}

const PrintBijak: React.FC<PrintBijakProps> = ({ tx, onClose, settings, embed, forceHidePrices, onApprove, onReject, transactions }) => {
  const [processing, setProcessing] = useState(false);
  const [hidePrices, setHidePrices] = useState(forceHidePrices || false);
  const [sharePlatform, setSharePlatform] = useState<'whatsapp' | 'telegram' | 'bale' | null>(null);
  const [allContacts, setAllContacts] = useState<Contact[]>([]);
  const [contactSearch, setContactSearch] = useState('');
  const [contactsLoading, setContactsLoading] = useState(false);

  const stockInfo = React.useMemo(() => {
     if (!transactions || !tx.items) return [];
     return tx.items.map(item => {
         let qty = 0; let weight = 0;
         transactions.filter(t => t.company === tx.company && t.status !== 'REJECTED').forEach(t => {
             if (Array.isArray(t.items)) {
                 t.items.forEach(ti => {
                     if (ti.itemId === item.itemId || ti.itemName === item.itemName) {
                         if (t.type === 'IN') { qty += (Number(ti.quantity) || 0); weight += (Number(ti.weight) || 0); }
                         else { qty -= (Number(ti.quantity) || 0); weight -= (Number(ti.weight) || 0); }
                     }
                 });
             }
         });
         return { name: item.itemName, qty, weight };
     });
  }, [transactions, tx]);

  // Scaling State
  const [scale, setScale] = useState(1);
  const containerWrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
      const style = document.getElementById('page-size-style');
      if (style && !embed) { 
          style.innerHTML = '@page { size: A5 portrait; margin: 0; }';
      }
  }, [embed]);

  // Auto-Scale Logic
  useEffect(() => {
    const handleResize = () => {
        if (embed) return;
        const wrapper = containerWrapperRef.current;
        if (wrapper) {
            const wrapperWidth = wrapper.clientWidth;
            const targetWidth = 560; // A5 Width in px (approx)
            
            if (wrapperWidth < targetWidth + 40) {
                const newScale = (wrapperWidth - 32) / targetWidth;
                setScale(newScale);
            } else {
                setScale(1);
            }
        }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [embed]);

  const containerId = embed 
    ? `print-bijak-${tx.id}${forceHidePrices ? '-noprice' : '-price'}` 
    : "print-area";

  useEffect(() => {
      if (typeof forceHidePrices === 'boolean') setHidePrices(forceHidePrices);
  }, [forceHidePrices]);

  useEffect(() => {
      const loadContacts = async () => {
          setContactsLoading(true);
          const saved = settings?.savedContacts || [];
          try {
            const users = await getUsers();
            const userContacts = users
                .map(u => ({ 
                    id: u.id, 
                    name: u.fullName, 
                    number: u.phoneNumber || '',
                    telegramId: u.telegramChatId || (u as any).telegramId,
                    baleId: u.baleChatId || (u as any).baleId,
                    isGroup: false 
                })).filter(u => u.number || u.telegramId || u.baleId);
            setAllContacts([...saved, ...userContacts]);
          } catch (e) {
            setAllContacts(saved);
          } finally {
            setContactsLoading(false);
          }
      };
      if (sharePlatform) loadContacts();
  }, [settings, sharePlatform]);
  
  const companyConfig = settings?.companyNotifications?.[tx.company];
  const warehouseTarget = companyConfig?.warehouseGroup || settings?.defaultWarehouseGroup;
  const managerTarget = companyConfig?.salesManager || settings?.defaultSalesManager;

  const handlePrint = () => {
      const style = document.getElementById('page-size-style');
      if (style) style.innerHTML = '@page { size: A5 portrait; margin: 0; }';
      window.print();
  };

  const handleDownloadPDF = async () => {
      setProcessing(true);
      await generatePdf({
          elementId: containerId,
          filename: `Bijak_${tx.number}.pdf`,
          format: 'A5',
          orientation: 'portrait',
          onComplete: () => setProcessing(false),
          onError: () => { alert('خطا در دانلود PDF'); setProcessing(false); }
      });
  };

  const generateAndSend = async (target: string, shouldHidePrice: boolean, captionPrefix: string, platform?: 'whatsapp' | 'telegram' | 'bale') => {
      if (!target) { alert("شماره مخاطب/مدیر برای این شرکت تنظیم نشده است. لطفا در تنظیمات انبار بررسی کنید."); return; }
      setProcessing(true);
      const originalState = hidePrices;
      setHidePrices(shouldHidePrice);

      setTimeout(async () => {
          try {
              const element = document.getElementById(containerId);
              if (!element) throw new Error("Element not found");

              const canvas = await html2canvas(element, { scale: 2, backgroundColor: '#ffffff', useCORS: true, windowWidth: 1000 });
              const base64 = canvas.toDataURL('image/png').split(',')[1];

              let caption = `${captionPrefix}\nشماره: ${tx.number}\nگیرنده: ${tx.recipientName}\nتعداد: ${tx.items.length} قلم`;

              const p = platform || 'whatsapp';
              if (p === 'whatsapp') {
                  await apiCall('/send-whatsapp', 'POST', {
                      number: target,
                      message: caption,
                      mediaData: { data: base64, mimeType: 'image/png', filename: `Bijak_${tx.number}.png` }
                  });
              } else {
                  await apiCall('/send-bot-message', 'POST', {
                      platform: p,
                      chatId: target,
                      caption: caption,
                      mediaData: { data: base64, filename: `Bijak_${tx.number}.png` }
                  });
              }
              if (!embed) alert('ارسال شد ✅');
          } catch (e) { console.error(e); if (!embed) alert('خطا در ارسال ❌'); } 
          finally { 
              setHidePrices(originalState); 
              setProcessing(false); 
              setSharePlatform(null);
          }
      }, 1500); 
  };

  const filteredContacts = allContacts.filter(c => c.name.toLowerCase().includes(contactSearch.toLowerCase()) || c.number.includes(contactSearch));

  const Stamp = ({ title, name, color = 'blue' }: { title: string, name: string, color?: 'blue' | 'green' | 'gray' }) => {
      const colorClass = color === 'blue' ? 'border-blue-800 text-blue-800' : color === 'green' ? 'border-green-800 text-green-800' : 'border-gray-500 text-gray-500';
      return (
          <div className={`border-2 ${colorClass} rounded-lg p-1 rotate-[-5deg] opacity-90 inline-block glass-panel/80 print:bg-transparent shadow-sm min-w-[80px]`}>
              <div className="text-[9px] font-bold border-b border-current mb-0.5 pb-0.5 text-center">{title}</div>
              <div className="text-xs font-black text-center px-1">{name}</div>
          </div>
      );
  };

  const content = (
      <div id={containerId} className={`printable-content glass-panel w-full mx-auto p-6 shadow-2xl rounded-sm relative text-gray-900 flex flex-col print:shadow-none`} 
        style={{ 
            direction: 'rtl',
            width: '148mm',
            height: '209mm',
            margin: '0 auto',
            padding: '8mm', 
            boxSizing: 'border-box',
            maxHeight: '209mm',
            overflow: 'hidden'
        }}>
            {tx.status === 'REJECTED' && (<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 border-8 border-red-600/30 text-red-600/30 font-black text-6xl rotate-[-25deg] p-4 rounded-3xl select-none z-0 pointer-events-none whitespace-nowrap">REJECTED</div>)}
            {(tx.status as any) === 'DELETED' && (<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 border-8 border-red-600/30 text-red-600/30 font-black text-6xl rotate-[-25deg] p-4 rounded-3xl select-none z-0 pointer-events-none whitespace-nowrap">حذف شده / باطل</div>)}

            <div className="border-b-2 border-black pb-4 mb-4 flex justify-between items-start relative z-10">
                <div className="flex flex-col">
                    <h1 className="text-xl font-black">{tx.company}</h1>
                    <p className="text-sm font-bold text-gray-600">حواله خروج کالا (بیجک)</p>
                </div>
                <div className="text-left space-y-1"><div className="text-lg font-black border-2 border-black px-3 py-1 rounded">NO: {tx.number}</div><div className="text-sm font-bold">تاریخ: {formatDate(tx.date)}</div></div>
            </div>
            <div className="border rounded-lg p-3 mb-4 bg-gray-50 dark:bg-gray-900/40 text-gray-800 dark:text-gray-200 text-sm print:glass-panel print:border-black relative z-10"><div className="grid grid-cols-2 gap-4"><div><span className="text-gray-500 ml-2">تحویل گیرنده:</span> <span className="font-bold">{tx.recipientName}</span></div><div><span className="text-gray-500 ml-2">مقصد:</span> <span className="font-bold">{tx.destination || '-'}</span></div><div><span className="text-gray-500 ml-2">راننده:</span> <span className="font-bold">{tx.driverName || '-'}</span></div><div><span className="text-gray-500 ml-2">پلاک:</span> <span className="font-bold font-mono dir-ltr">{tx.plateNumber || '-'}</span></div></div></div>
            <div className="flex-1 relative z-10"><table className="w-full text-sm border-collapse border border-black"><thead className="bg-gray-200 print:bg-gray-100 dark:bg-gray-800/40 text-gray-800 dark:text-gray-200"><tr><th className="border border-black p-2 w-10 text-center">#</th><th className="border border-black p-2">شرح کالا</th><th className="border border-black p-2 w-20 text-center">تعداد</th><th className="border border-black p-2 w-24 text-center">وزن (KG)</th>{!hidePrices && <th className="border border-black p-2 w-28 text-center">فی (ریال)</th>}</tr></thead><tbody>{tx.items.map((item, idx) => (<tr key={idx}><td className="border border-black p-2 text-center">{idx + 1}</td><td className="border border-black p-2 font-bold">{item.itemName}</td><td className="border border-black p-2 text-center">{item.quantity}</td><td className="border border-black p-2 text-center">{Number(Number(item.weight).toFixed(2))}</td>{!hidePrices && <td className="border border-black p-2 text-center font-mono">{item.unitPrice ? formatCurrency(item.unitPrice).replace('ریال', '') : '-'}</td>}</tr>))}<tr className="bg-gray-100 font-bold print:glass-panel"><td colSpan={2} className="border border-black p-2 text-left pl-4">جمع کل:</td><td className="border border-black p-2 text-center">{tx.items.reduce((a,b)=>a+(Number(b.quantity)||0),0)}</td><td className="border border-black p-2 text-center">{Number(tx.items.reduce((a,b)=>a+(Number(b.weight)||0),0).toFixed(2))}</td>{!hidePrices && <td className="border border-black p-2 bg-gray-200"></td>}</tr></tbody></table>{tx.description && <div className="mt-4 border p-2 rounded text-sm"><span className="font-bold block mb-1">توضیحات:</span>{tx.description}</div>}</div>
            
            {stockInfo.length > 0 && (
                <div className="mt-4 border border-black p-2 rounded text-[10px] relative z-10">
                    <span className="font-bold block mb-1">موجودی اقلام بیجک:</span>
                    <div className="flex flex-wrap gap-4">
                        {stockInfo.map((s, idx) => (
                            <div key={idx} className="flex gap-1 border-r border-black/20 pr-4 first:border-0 first:pr-0">
                                <span className="font-bold bg-gray-100 px-1 rounded">{s.name}:</span>
                                <div>تعداد: {s.qty} / وزن: {Number(s.weight.toFixed(2))} Kg</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="mt-8 pt-4 border-t-2 border-black grid grid-cols-3 gap-4 text-center relative z-10 h-24">
                <div className="flex flex-col items-center justify-between"><div className="mb-1 flex items-center justify-center h-full"><Stamp title="انباردار (ثبت)" name={tx.createdBy || 'کاربر انبار'} color="blue" /></div><div className="w-full border-t border-gray-400 pt-1 text-[9px] font-bold text-gray-600">امضا انباردار</div></div>
                <div className="flex flex-col items-center justify-between"><div className="mb-1 flex items-center justify-center h-full">{tx.approvedBy ? <Stamp title="تایید مدیریت" name={tx.approvedBy} color="green" /> : <span className="text-gray-300 text-[10px]">منتظر تایید</span>}</div><div className="w-full border-t border-gray-400 pt-1 text-[9px] font-bold text-gray-600">امضا مدیریت</div></div>
                <div className="flex flex-col items-center justify-between"><div className="mb-1 flex items-center justify-center h-full"><div className="h-10 w-24"></div></div><div className="w-full border-t border-gray-400 pt-1 text-[9px] font-bold text-gray-600">امضا تحویل گیرنده</div></div>
            </div>
      </div>
  );

  if (embed) return content;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[9999] flex flex-col items-center justify-start md:justify-center p-4 overflow-y-auto animate-fade-in no-print safe-pb">
        <div className="glass-panel p-4 rounded-2xl shadow-2xl z-[10000] flex flex-col gap-3 w-full max-w-[148mm] md:w-64 md:fixed md:top-8 md:left-8 mb-6 md:mb-0 relative order-1 sticky top-0 mt-2 md:mt-0 border border-white/20">
            <div className="flex justify-between items-center border-b pb-2"><span className="font-bold text-sm text-gray-800">پنل عملیات چاپ</span><button onClick={onClose} className="p-2 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500 transition-colors"><X size={20}/></button></div>
            {((tx.status as any) === 'DELETED' || tx.status === 'REJECTED') && (<div className="bg-red-50 p-2 rounded-lg border border-red-200 flex items-start gap-2 text-xs text-red-800"><AlertTriangle size={16} className="shrink-0 mt-0.5"/><div><span className="font-bold block">این بیجک {(tx.status as any) === 'DELETED' ? 'حذف' : 'رد'} شده است.</span>{tx.rejectionReason}</div></div>)}
            {(onApprove || onReject) && (<div className="flex gap-2 mb-1">{onApprove && (<button onClick={onApprove} className="flex-1 bg-green-600 text-white py-2 rounded-lg flex items-center justify-center gap-1 text-xs font-bold hover:bg-green-700 transition-colors shadow-sm"><CheckCircle size={14}/> تایید</button>)}{onReject && (<button onClick={onReject} className="flex-1 bg-red-600 text-white py-2 rounded-lg flex items-center justify-center gap-1 text-xs font-bold hover:bg-red-700 transition-colors shadow-sm"><XCircle size={14}/> رد</button>)}</div>)}
            <div className="flex items-center gap-2 text-xs text-gray-600 bg-gray-50 p-2 rounded"><input type="checkbox" checked={hidePrices} onChange={e => setHidePrices(e.target.checked)} id="hidePrice"/><label htmlFor="hidePrice" className="cursor-pointer">مخفی کردن قیمت‌ها</label></div>
            <div className="grid grid-cols-2 md:grid-cols-1 gap-2">
                <button onClick={handleDownloadPDF} disabled={processing} className="bg-gray-800 text-white p-3 rounded-xl text-xs font-bold hover:bg-black transition-colors flex items-center justify-center gap-2 shadow-lg">{processing ? <Loader2 size={16} className="animate-spin"/> : <FileDown size={18}/>} دانلود PDF</button>
                <button onClick={handlePrint} disabled={processing} className="bg-blue-600 text-white p-3 rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20">{processing ? <Loader2 size={16} className="animate-spin"/> : <Printer size={18}/>} چاپ بیجک</button>
            </div>
            <div className="border-t pt-2 mt-1 space-y-2">
                <button onClick={() => { if(warehouseTarget) generateAndSend(warehouseTarget, true, "📦 *حواله خروج (نسخه انبار)*"); else alert(`شماره گروه انبار برای شرکت ${tx.company} تنظیم نشده است.`); }} disabled={processing} className="w-full bg-orange-100 text-orange-700 p-2.5 rounded-xl text-xs font-bold hover:bg-orange-200 flex items-center justify-center gap-2 border border-orange-200">{processing ? <Loader2 size={14} className="animate-spin"/> : 'ارسال به انبار (بدون فی)'}</button>
                <button onClick={() => { if(managerTarget) generateAndSend(managerTarget, false, "📑 *حواله خروج (نسخه مدیریت)*"); else alert(`شماره مدیر فروش برای شرکت ${tx.company} تنظیم نشده است.`); }} disabled={processing} className="w-full bg-green-100 text-green-700 p-2.5 rounded-xl text-xs font-bold hover:bg-green-200 flex items-center justify-center gap-2 border border-green-200">{processing ? <Loader2 size={14} className="animate-spin"/> : 'ارسال به مدیر (با فی)'}</button>
                
                <div className="border-t mt-2 pt-2 flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-gray-400 mb-1">اشتراک گذاری در پلتفرم‌ها</span>
                    <div className="grid grid-cols-3 gap-1">
                        <button onClick={() => setSharePlatform(sharePlatform === 'whatsapp' ? null : 'whatsapp')} className={`border py-2 rounded-lg text-[10px] font-bold flex flex-col items-center gap-1 transition-all ${sharePlatform === 'whatsapp' ? 'bg-green-500 text-white border-green-600' : 'glass-panel border-gray-200/50 dark:border-white/10 text-green-600 hover:bg-green-50'}`}><Smartphone size={14}/> واتساپ</button>
                        <button onClick={() => setSharePlatform(sharePlatform === 'bale' ? null : 'bale')} className={`border py-2 rounded-lg text-[10px] font-bold flex flex-col items-center gap-1 transition-all ${sharePlatform === 'bale' ? 'bg-green-500 text-white border-green-600' : 'glass-panel border-gray-200 text-green-600 hover:bg-green-50'}`}><Smartphone size={14}/> بله</button>
                        <button onClick={() => setSharePlatform(sharePlatform === 'telegram' ? null : 'telegram')} className={`border py-2 rounded-lg text-[10px] font-bold flex flex-col items-center gap-1 transition-all ${sharePlatform === 'telegram' ? 'bg-blue-500 text-white border-blue-600' : 'glass-panel border-gray-200 text-blue-600 hover:bg-blue-50'}`}><Smartphone size={14}/> تلگرام</button>
                    </div>
                </div>
            </div>
        </div>
        {sharePlatform && (<div className="fixed inset-0 z-[110] bg-black/50 flex items-center justify-center p-4"><div className="glass-panel rounded-xl shadow-2xl w-full max-w-sm flex flex-col h-[70vh] animate-fade-in"><div className="p-3 border-b bg-gray-50 flex items-center justify-between"><span className="font-bold text-gray-800">انتخاب مخاطب {sharePlatform === 'whatsapp' ? 'واتساپ' : sharePlatform === 'bale' ? 'بله' : 'تلگرام'}</span><button onClick={() => setSharePlatform(null)} className="bg-red-100 text-red-600 rounded-lg p-1.5 hover:bg-red-200"><X size={18}/></button></div><div className="p-3 border-b"><div className="bg-gray-100 rounded-lg flex items-center px-3 py-2"><Search size={18} className="text-gray-400 ml-2"/><input className="bg-transparent w-full outline-none text-sm" placeholder="جستجو نام یا شماره..." autoFocus value={contactSearch} onChange={e => setContactSearch(e.target.value)}/></div></div><div className="flex-1 overflow-y-auto p-2 space-y-1">{contactsLoading ? (<div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2"><Loader2 size={32} className="animate-spin"/> <span>در حال دریافت لیست...</span></div>) : filteredContacts.length === 0 ? (<div className="text-center text-gray-400 mt-10">مخاطبی یافت نشد</div>) : (filteredContacts.map(c => {
                                let targetId = c.number;
                                if (sharePlatform === 'telegram') targetId = c.telegramId || c.number;
                                if (sharePlatform === 'bale') targetId = c.baleId || c.number;
                                return (<button key={c.id} onClick={() => {
                                    if (!targetId) { alert("آیدی این پلتفرم برای کاربر مورد نظر ثبت نشده است."); return; }
                                    generateAndSend(targetId, hidePrices, "📄 *بیجک ارسالی*", sharePlatform)
                            }} className="w-full text-right p-3 hover:bg-blue-50 rounded-xl border border-transparent hover:border-blue-100 flex items-center gap-3 transition-colors group"><div className={`p-2 rounded-full ${c.isGroup ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>{c.isGroup ? <Users size={18}/> : <Smartphone size={18}/>}</div><div className="flex-1"><div className="font-bold text-gray-800 text-sm group-hover:text-blue-700">{c.name}</div><div className="text-xs text-gray-500 font-mono mt-0.5">{targetId || c.number}</div></div><div className="bg-gray-100 px-3 py-1 rounded-lg text-xs font-bold text-gray-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">ارسال</div></button>);
                            }))}</div><div className="p-3 border-t bg-gray-50"><button onClick={() => { const num = prompt("شماره یا شناسه را وارد کنید:"); if(num) generateAndSend(num, hidePrices, "📄 *بیجک ارسالی*", sharePlatform); }} className="w-full glass-panel border border-gray-300 text-gray-700 py-2.5 rounded-xl text-sm font-bold hover:bg-gray-100 transition-colors">ورود دستی</button></div></div></div>)}
        <div className="order-2 w-full flex justify-center pb-10" ref={containerWrapperRef}>
            <div style={{ 
              width: '148mm', 
              height: '209mm',
              backgroundColor: 'white', 
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
              transform: `scale(${scale})`,
              transformOrigin: 'top center',
              marginBottom: `${(1 - scale) * -100}px` 
            }}>
                {content}
            </div>
        </div>
    </div>
  );
};
export default PrintBijak;
