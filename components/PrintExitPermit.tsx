
import React, { useState, useEffect, useRef } from 'react';
import { ExitPermit, ExitPermitStatus, SystemSettings, UserRole } from '../types';
import { formatDate, formatCurrency } from '../constants';
import { X, Printer, Clock, MapPin, Package, Truck, CheckCircle, Share2, Edit, Loader2, Users, Search, FileDown } from 'lucide-react';
import { apiCall } from '../services/apiService';
import { getUsers } from '../services/authService';
import { generatePdf } from '../utils/pdfGenerator'; 

interface Props {
  permit: ExitPermit;
  onClose: () => void;
  onApprove?: () => void;
  onReject?: () => void;
  onEdit?: () => void;
  settings?: SystemSettings;
  embed?: boolean; 
  watermark?: 'DELETED' | 'EDITED' | null; 
}

export default function PrintExitPermit({ permit, onClose, onApprove, onReject, onEdit, settings, embed, watermark }: Props) {
  const [sharePlatform, setSharePlatform] = useState<'whatsapp' | 'telegram' | 'bale' | null>(null);
  const [processing, setProcessing] = useState(false);
  const [contactSearch, setContactSearch] = useState('');

  // Scaling State
  const [scale, setScale] = useState(1);
  const containerWrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
      const style = document.getElementById('page-size-style');
      if (style && !embed) { 
          style.innerHTML = '@page { size: A4 portrait; margin: 0; }';
      }
  }, [embed]);

  // Auto-Scale Logic
  useEffect(() => {
    const handleResize = () => {
        if (embed) return;
        const wrapper = containerWrapperRef.current;
        if (wrapper) {
            const wrapperWidth = wrapper.clientWidth;
            const targetWidth = 794; 
            
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

  const Stamp = ({ title, name, date, time, isSecurity }: { title: string, name: string, date?: string, time?: string, isSecurity?: boolean }) => (
      <div className={`border-2 ${isSecurity ? 'border-black text-black' : 'border-blue-800 text-blue-800'} rounded-xl p-2 rotate-[-5deg] opacity-90 inline-block bg-white/80 print:bg-transparent shadow-sm min-w-[90px]`}>
          <div className="text-[10px] font-bold border-b border-current mb-1 pb-1 text-center">{title}</div>
          <div className="text-sm font-black text-center px-2">{name}</div>
          {date && <div className="text-[10px] text-center mt-1">{date}</div>}
          {time && (
              <div className="mt-2 border-t border-dashed border-gray-400 pt-1">
                  <div className="text-[9px] font-bold text-center">ساعت خروج:</div>
                  <div className="text-2xl font-black text-center font-mono">{time}</div>
              </div>
          )}
      </div>
  );

  const containerId = embed ? `print-permit-${permit.id}` : "print-area-exit";

  const handleDownloadPDF = async () => {
      setProcessing(true);
      await generatePdf({
          elementId: containerId,
          filename: `Permit_${permit.permitNumber}.pdf`,
          format: 'A4',
          orientation: 'portrait',
          onComplete: () => setProcessing(false),
          onError: () => { alert('خطا در ایجاد PDF'); setProcessing(false); }
      });
  };

  const handleShare = async (targetId: string) => {
      if (!targetId || !sharePlatform) return;
      
      const element = document.getElementById(containerId);
      if (!element) { 
          alert("خطا: المان چاپ پیدا نشد."); 
          return; 
      }
      
      try {
          setProcessing(true);
          // @ts-ignore
          const canvas = await window.html2canvas(element, { 
              scale: 2, 
              backgroundColor: '#ffffff', 
              useCORS: true,
              windowWidth: 1200 
          });
          
          const base64 = canvas.toDataURL('image/png').split(',')[1];
          
          // CAPTION GENERATION MATCHING MANAGEEXITPERMITS LOGIC
          let caption = `🚛 *مجوز خروج کالا*\n🔢 شماره: ${permit.permitNumber}\n📅 تاریخ: ${formatDate(permit.date)}\n👤 گیرنده: ${permit.recipientName}`;
          if(permit.exitTime) caption += `\n🕒 ساعت خروج: ${permit.exitTime}`;
          
          // Items Detail
          caption += `\n📦 *اقلام:*`;
          if(permit.items && permit.items.length > 0) {
              permit.items.forEach((item, idx) => {
                  const qty = item.cartonCount || 0;
                  const w = item.weight || 0;
                  caption += `\n${idx+1}. ${item.goodsName}\n   ▫️ تعداد: ${qty} کارتن | وزن: ${w} kg`;
              });
          } else {
              caption += `\n${permit.goodsName}`;
          }
          
          // Totals
          caption += `\n----------------\n`;
          caption += `📊 *جمع کل:*\n`;
          caption += `تعداد: ${permit.cartonCount || 0} کارتن\n`;
          caption += `وزن: ${permit.weight || 0} کیلوگرم`;

          if (sharePlatform === 'whatsapp') {
             await apiCall('/send-whatsapp', 'POST', {
                 number: targetId,
                 message: caption,
                 mediaData: { data: base64, mimeType: 'image/png', filename: `Permit_${permit.permitNumber}.png` }
             });
          } else {
             await apiCall('/send-bot-message', 'POST', {
                 platform: sharePlatform,
                 chatId: targetId,
                 caption: caption,
                 mediaData: { data: base64, filename: `Permit_${permit.permitNumber}.png` }
             });
          }
          
          if (!embed) alert('ارسال شد.');
          setSharePlatform(null);
          
      } catch(e: any) { 
          console.error("Share Error:", e);
          alert('خطا در ارسال: ' + (e.message || 'Unknown error')); 
      } finally { 
          setProcessing(false); 
      }
  };

  // Combine Settings Contacts AND Groups into filterable list
  const filteredContacts = settings?.savedContacts?.filter(c => 
    c.name.toLowerCase().includes(contactSearch.toLowerCase()) || 
    c.number.includes(contactSearch)
  ) || [];

  const displayItems = permit.items && permit.items.length > 0 ? permit.items : [{ id: 'legacy', goodsName: permit.goodsName || '', cartonCount: permit.cartonCount || 0, weight: permit.weight || 0, deliveredCartonCount: permit.cartonCount || 0, deliveredWeight: permit.weight || 0 }];
  const displayDestinations = permit.destinations && permit.destinations.length > 0 ? permit.destinations : [{ id: 'legacy', recipientName: permit.recipientName || '', address: permit.destinationAddress || '', phone: '' }];
  
  const totalCartonsReq = displayItems.reduce((acc, i) => acc + (Number(i.cartonCount) || 0), 0);
  const totalWeightReq = displayItems.reduce((acc, i) => acc + (Number(i.weight) || 0), 0);
  const totalCartonsDel = displayItems.reduce((acc, i) => acc + (Number(i.deliveredCartonCount ?? i.cartonCount) || 0), 0);
  const totalWeightDel = displayItems.reduce((acc, i) => acc + (Number(i.deliveredWeight ?? i.weight) || 0), 0);
  const showDeliveryColumns = displayItems.some(i => i.deliveredCartonCount !== undefined);

  const content = (
      <div id={containerId} 
        className="printable-content bg-white mx-auto shadow-2xl relative text-gray-900 flex flex-col" 
        style={{ 
            direction: 'rtl', 
            width: '210mm', 
            height: '296mm', 
            padding: '10mm', 
            boxSizing: 'border-box',
            margin: '0 auto',
            maxHeight: '296mm',
            overflow: 'hidden'
        }}>
            {watermark === 'DELETED' && (<div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none overflow-hidden"><div className="border-[12px] border-red-500 text-red-500 font-black text-9xl opacity-40 rotate-[-45deg] p-10 rounded-3xl whitespace-nowrap bg-white/50 backdrop-blur-[2px]">حذف شد</div></div>)}
            {watermark === 'EDITED' && (<div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none overflow-hidden"><div className="border-[12px] border-orange-500 text-orange-500 font-black text-9xl opacity-40 rotate-[-45deg] p-10 rounded-3xl whitespace-nowrap bg-white/50 backdrop-blur-[2px]">اصلاحیه</div></div>)}

            <div className="flex justify-between items-center border-b-4 border-black pb-4 mb-4">
                <div className="flex flex-col"><h1 className="text-3xl font-black mb-1">مجوز خروج کالا از کارخانه</h1><p className="text-sm font-bold text-gray-600">سیستم مکانیزه مدیریت بار و خروج</p></div>
                <div className="text-left space-y-2"><div className="text-xl font-black bg-gray-100 px-4 py-2 border-2 border-black rounded-lg">شماره: {permit.permitNumber}</div><div className="text-sm font-bold">تاریخ: {formatDate(permit.date)}</div></div>
            </div>
            <div className="flex-1 space-y-6">
                <div className="space-y-1"><h3 className="font-black text-lg flex items-center gap-2"><Package size={20}/> لیست اقلام و کالاها</h3>
                    <table className="w-full text-sm border-collapse border-2 border-black text-center">
                        <thead>
                            <tr className="bg-gray-100 text-base">
                                <th className="border-2 border-black p-2 w-10" rowSpan={2}>#</th>
                                <th className="border-2 border-black p-2 text-center" rowSpan={2}>شرح کالا / محصول</th>
                                <th className="border-2 border-black p-1" colSpan={showDeliveryColumns ? 2 : 1}>تعداد (کارتن)</th>
                                <th className="border-2 border-black p-1" colSpan={showDeliveryColumns ? 2 : 1}>وزن (KG)</th>
                            </tr>
                            {showDeliveryColumns && (
                                <tr className="bg-gray-50 text-xs">
                                    <th className="border-2 border-black p-1 text-gray-500 w-20">درخواستی</th>
                                    <th className="border-2 border-black p-1 w-20 bg-green-50 text-green-800">خروجی</th>
                                    <th className="border-2 border-black p-1 text-gray-500 w-20">درخواستی</th>
                                    <th className="border-2 border-black p-1 w-20 bg-green-50 text-green-800">خروجی</th>
                                </tr>
                            )}
                        </thead>
                        <tbody>
                            {displayItems.map((item, idx) => (
                                <tr key={idx} className="text-base">
                                    <td className="border-2 border-black p-2">{idx + 1}</td>
                                    <td className="border-2 border-black p-2 font-bold text-center align-middle">{item.goodsName}</td>
                                    {showDeliveryColumns ? (
                                        <>
                                            <td className="border-2 border-black p-2 font-mono text-gray-400 bg-gray-50/50">{item.cartonCount}</td>
                                            <td className="border-2 border-black p-2 font-mono font-bold bg-green-50/30">{item.deliveredCartonCount ?? item.cartonCount}</td>
                                            <td className="border-2 border-black p-2 font-mono text-gray-400 bg-gray-50/50">{item.weight}</td>
                                            <td className="border-2 border-black p-2 font-mono font-bold bg-green-50/30">{item.deliveredWeight ?? item.weight}</td>
                                        </>
                                    ) : (
                                        <>
                                            <td className="border-2 border-black p-2 font-mono font-bold">{item.cartonCount}</td>
                                            <td className="border-2 border-black p-2 font-mono font-bold">{item.weight}</td>
                                        </>
                                    )}
                                </tr>
                            ))}
                            <tr className="bg-gray-100 text-base font-black">
                                <td colSpan={2} className="border-2 border-black p-2 text-left pl-6">جمع کل:</td>
                                {showDeliveryColumns ? (
                                    <>
                                        <td className="border-2 border-black p-2 font-mono text-gray-500">{totalCartonsReq}</td>
                                        <td className="border-2 border-black p-2 font-mono text-black">{totalCartonsDel}</td>
                                        <td className="border-2 border-black p-2 font-mono text-gray-500">{totalWeightReq}</td>
                                        <td className="border-2 border-black p-2 font-mono text-black">{totalWeightDel}</td>
                                    </>
                                ) : (
                                    <>
                                        <td className="border-2 border-black p-2 font-mono">{totalCartonsReq}</td>
                                        <td className="border-2 border-black p-2 font-mono">{totalWeightReq}</td>
                                    </>
                                )}
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div className="space-y-1"><h3 className="font-black text-lg flex items-center gap-2"><MapPin size={20}/> مشخصات گیرنده</h3>
                    <div className="border-2 border-black rounded-xl p-3 bg-gray-50 text-sm space-y-2">
                        {displayDestinations.map((dest, idx) => (
                            <div key={idx} className="border-b-2 border-gray-200 pb-2 last:border-0 last:pb-0">
                                <div className="grid grid-cols-2 gap-4">
                                    <div><span className="font-bold text-gray-500 ml-2">تحویل گیرنده:</span> <span className="font-bold text-lg">{dest.recipientName}</span></div>
                                    <div><span className="font-bold text-gray-500 ml-2">شماره تماس:</span> <span className="font-mono dir-ltr">{dest.phone || '-'}</span></div>
                                </div>
                                <div className="mt-1"><span className="font-bold text-gray-500 ml-2">آدرس مقصد:</span> <span className="font-medium">{dest.address}</span></div>
                            </div>
                        ))}
                    </div>
                </div>

                {(permit.driverName || permit.plateNumber) && (
                    <div className="space-y-1"><h3 className="font-black text-lg flex items-center gap-2"><Truck size={20}/> مشخصات حمل</h3><div className="border-2 border-black rounded-xl p-3 bg-gray-50 text-sm flex gap-8"><div><span className="font-bold text-gray-500 ml-2">نام راننده:</span> <span className="font-bold text-lg">{permit.driverName}</span></div><div><span className="font-bold text-gray-500 ml-2">شماره پلاک:</span> <span className="font-mono font-bold text-lg dir-ltr">{permit.plateNumber}</span></div></div></div>
                )}
                
                {permit.description && (<div className="space-y-1"><h3 className="font-black text-lg">توضیحات</h3><div className="border-2 border-black rounded-xl p-3 bg-white text-sm min-h-[40px]">{permit.description}</div></div>)}
            </div>

            <div className="mt-auto pt-4 border-t-4 border-black grid grid-cols-5 gap-2 text-center items-end">
                <div className="flex flex-col items-center justify-between min-h-[80px]"><div className="mb-2 flex items-center justify-center h-full"><Stamp title="مدیر فروش" name={permit.requester} /></div><div className="w-full border-t-2 border-gray-400 pt-1 text-[10px] font-bold text-gray-600">درخواست کننده</div></div>
                
                <div className="flex flex-col items-center justify-between min-h-[80px]"><div className="mb-2 flex items-center justify-center h-full">{permit.approverCeo ? <Stamp title="مدیریت" name={permit.approverCeo} /> : <span className="text-gray-300 text-xs">---</span>}</div><div className="w-full border-t-2 border-gray-400 pt-1 text-[10px] font-bold text-gray-600">مدیرعامل</div></div>
                
                <div className="flex flex-col items-center justify-between min-h-[80px]"><div className="mb-2 flex items-center justify-center h-full">{permit.approverFactory ? <Stamp title="مدیر کارخانه" name={permit.approverFactory} /> : <span className="text-gray-300 text-xs">---</span>}</div><div className="w-full border-t-2 border-gray-400 pt-1 text-[10px] font-bold text-gray-600">مدیر کارخانه</div></div>
                
                <div className="flex flex-col items-center justify-between min-h-[80px]"><div className="mb-2 flex items-center justify-center h-full">{permit.approverWarehouse ? <Stamp title="تحویل انبار" name={permit.approverWarehouse} /> : <span className="text-gray-300 text-xs">---</span>}</div><div className="w-full border-t-2 border-gray-400 pt-1 text-[10px] font-bold text-gray-600">سرپرست انبار</div></div>
                
                {/* SECURITY / EXIT TIME - CRITICAL FIX - ALWAYS RENDER BOX */}
                <div className="flex flex-col items-center justify-between min-h-[80px]">
                    <div className="mb-2 flex items-center justify-center h-full">
                        {/* Always render Stamp structure if exited, or placeholder if pending, but BOX is always there */}
                        {permit.status === ExitPermitStatus.EXITED ? 
                            <Stamp 
                                title="انتظامات / خروج" 
                                name={permit.approverSecurity || 'نگهبان'} 
                                time={permit.exitTime} 
                                isSecurity={true}
                            /> 
                            : <div className="border-2 border-dashed border-gray-300 rounded-xl p-2 h-16 w-20 flex items-center justify-center text-gray-300 text-[9px]">امضاء انتظامات</div>
                        }
                    </div>
                    <div className="w-full border-t-2 border-black pt-1 text-[10px] font-black text-black">تایید خروج (انتظامات)</div>
                </div>
            </div>
            
            <div className="mt-2 border-t border-gray-300 text-[9px] text-gray-500 text-center">
                نسخه چاپی سیستم
            </div>
      </div>
  );

  if (embed) return content;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex flex-col items-center justify-start md:justify-center p-4 overflow-y-auto animate-fade-in safe-pb">
        <div className="relative md:absolute md:top-4 md:left-4 z-50 flex flex-col gap-2 no-print w-full md:w-auto mb-4 md:mb-0 order-1">
            <div className="bg-white p-3 rounded-xl shadow-lg flex flex-col gap-2 w-full max-w-sm">
                <div className="flex justify-between items-center border-b pb-2"><span className="font-bold text-sm">پنل عملیات</span><button onClick={onClose}><X size={20} className="text-gray-400 hover:text-red-500"/></button></div>
                {(onApprove || onReject) && (<div className="flex gap-2 mb-1">{onApprove && <button onClick={onApprove} className="flex-1 bg-green-600 text-white py-2 rounded-lg flex items-center justify-center gap-1 text-xs font-bold hover:bg-green-700 transition-colors shadow-sm">تایید</button>}{onReject && <button onClick={onReject} className="flex-1 bg-red-600 text-white py-2 rounded-lg flex items-center justify-center gap-1 text-xs font-bold hover:bg-red-700 transition-colors shadow-sm">رد</button>}</div>)}
                {onEdit && <button onClick={onEdit} className="w-full bg-amber-500 text-white py-2 rounded-lg text-xs font-bold hover:bg-amber-600 flex items-center justify-center gap-1 mb-1"><Edit size={14}/> اصلاح مجوز</button>}
                <div className="flex gap-2"><button onClick={handleDownloadPDF} disabled={processing} className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg text-xs hover:bg-gray-200 flex items-center justify-center gap-1">{processing ? <Loader2 size={14} className="animate-spin"/> : <FileDown size={14}/>} دانلود PDF</button><button onClick={() => window.print()} className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-xs hover:bg-blue-700 flex items-center justify-center gap-1"><Printer size={14}/> چاپ</button></div>
                <div className="border-t mt-2 pt-2 flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-gray-400 mb-1">اشتراک گذاری</span>
                    <button onClick={() => setSharePlatform(sharePlatform === 'whatsapp' ? null : 'whatsapp')} className={`w-full border py-2 rounded-lg text-xs flex items-center justify-center gap-1 ${sharePlatform === 'whatsapp' ? 'bg-green-500 text-white border-green-600' : 'bg-white border-gray-300 text-green-600 hover:bg-green-50'}`}><Share2 size={14}/> واتساپ</button>
                    <button onClick={() => setSharePlatform(sharePlatform === 'bale' ? null : 'bale')} className={`w-full border py-2 rounded-lg text-xs flex items-center justify-center gap-1 ${sharePlatform === 'bale' ? 'bg-green-500 text-white border-green-600' : 'bg-white border-gray-300 text-green-600 hover:bg-green-50'}`}><Share2 size={14}/> پیام‌رسان بله</button>
                    <button onClick={() => setSharePlatform(sharePlatform === 'telegram' ? null : 'telegram')} className={`w-full border py-2 rounded-lg text-xs flex items-center justify-center gap-1 ${sharePlatform === 'telegram' ? 'bg-blue-500 text-white border-blue-600' : 'bg-white border-gray-300 text-blue-600 hover:bg-blue-50'}`}><Share2 size={14}/> تلگرام</button>
                </div>
                {sharePlatform && (
                     <div className="mt-2 bg-white rounded-xl shadow-inner border border-gray-200 z-[60] overflow-hidden animate-scale-in">
                         <div className="p-2 border-b bg-gray-50 flex justify-between items-center"><span className="text-xs font-bold text-gray-600">انتخاب مخاطب {sharePlatform === 'whatsapp' ? 'واتساپ' : sharePlatform === 'bale' ? 'بله' : 'تلگرام'}</span><button onClick={() => setSharePlatform(null)}><X size={14}/></button></div>
                         <div className="p-2 border-b"><input className="w-full text-xs p-1.5 border rounded outline-none" placeholder="جستجو در مخاطبین..." value={contactSearch} onChange={e=>setContactSearch(e.target.value)} autoFocus/></div>
                         <div className="max-h-40 overflow-y-auto">{filteredContacts.map(c => (<button key={c.id} onClick={() => handleShare(c.number)} className="w-full text-right p-2 hover:bg-blue-50 text-xs flex justify-between items-center border-b border-gray-50 last:border-0"><span className="truncate max-w-[120px] font-bold">{c.name}</span><button onClick={(e) => { e.stopPropagation(); handleShare(c.number); }} className="bg-green-600 text-white px-3 py-1 rounded-md text-[10px] font-bold hover:bg-green-700 shadow-sm whitespace-nowrap">ارسال</button></button>))}</div>
                         <div className="p-2 border-t bg-gray-50"><button onClick={() => { const n = prompt('شناسه یا شماره:'); if(n) handleShare(n); }} className="w-full text-center py-2 text-[10px] text-blue-600 font-black hover:bg-white rounded border border-blue-100 transition-colors">شماره/شناسه دستی</button></div>
                     </div>
                )}
            </div>
        </div>
        
        {/* Responsive Wrapper */}
        <div className="order-2 w-full flex justify-center pb-10" ref={containerWrapperRef}>
            <div style={{ 
              width: '210mm', 
              height: '296mm',
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
