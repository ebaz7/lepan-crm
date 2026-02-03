
import React, { useState, useEffect, useRef } from 'react';
import { ExitPermit, ExitPermitStatus, SystemSettings } from '../types';
import { formatDate } from '../constants';
import { X, Printer, Package, Truck, MapPin, CheckCircle, Share2, FileDown, Loader2 } from 'lucide-react';

interface Props {
  permit: ExitPermit;
  onClose: () => void;
  settings?: SystemSettings;
  embed?: boolean; 
  watermark?: 'DELETED' | 'EDITED' | null; 
}

export default function PrintExitPermit({ permit, onClose, settings, embed, watermark }: Props) {
  const containerWrapperRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const handleResize = () => {
        if (embed) return;
        const wrapper = containerWrapperRef.current;
        if (wrapper) {
            const wrapperWidth = wrapper.clientWidth;
            const targetWidth = 794; 
            if (wrapperWidth < targetWidth + 40) setScale((wrapperWidth - 32) / targetWidth);
            else setScale(1);
        }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [embed]);

  const Stamp = ({ title, name, isFinal }: { title: string, name: string, isFinal?: boolean }) => (
      <div className={`border-2 ${isFinal ? 'border-black' : 'border-blue-800 text-blue-800'} rounded-xl p-2 rotate-[-5deg] opacity-90 inline-block bg-white/80 shadow-sm min-w-[100px]`}>
          <div className="text-[9px] font-bold border-b border-current mb-1 pb-1 text-center">{title}</div>
          <div className="text-xs font-black text-center px-1">{name}</div>
      </div>
  );

  const content = (
      <div className="printable-content bg-white mx-auto shadow-2xl relative text-slate-900 flex flex-col" 
        style={{ 
            direction: 'rtl', 
            width: '210mm', 
            height: '296mm', 
            padding: '15mm', 
            boxSizing: 'border-box',
            overflow: 'hidden'
        }}>
            {watermark === 'DELETED' && (
                <div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none overflow-hidden">
                    <div className="border-[15px] border-red-500 text-red-500 font-black text-8xl opacity-30 rotate-[-45deg] p-10 rounded-full whitespace-nowrap">حذف شده / باطل</div>
                </div>
            )}
            {watermark === 'EDITED' && (
                <div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none overflow-hidden">
                    <div className="border-[15px] border-orange-500 text-orange-500 font-black text-8xl opacity-30 rotate-[-45deg] p-10 rounded-full whitespace-nowrap">اصلاحیه جدید</div>
                </div>
            )}

            <div className="flex justify-between items-center border-b-4 border-slate-900 pb-6 mb-8">
                <div className="flex flex-col">
                    <h1 className="text-4xl font-black mb-1">مجوز خروج کالا</h1>
                    <p className="text-sm font-bold text-slate-500 tracking-widest">INDUSTRIAL PRODUCTION GROUP</p>
                </div>
                <div className="text-left space-y-2">
                    <div className="text-2xl font-black bg-slate-900 text-white px-6 py-2 rounded-2xl">NO: {permit.permitNumber}</div>
                    <div className="text-sm font-bold text-slate-600">تاریخ: {formatDate(permit.date)}</div>
                </div>
            </div>

            <div className="flex-1 space-y-8">
                <div className="space-y-3">
                    <h3 className="font-black text-lg flex items-center gap-2 border-r-4 border-blue-600 pr-3">
                        <Package size={22} className="text-blue-600"/> لیست اقلام و کالاها
                    </h3>
                    <table className="w-full text-sm border-collapse border-2 border-slate-900 text-center rounded-xl overflow-hidden">
                        <thead className="bg-slate-100 text-base">
                            <tr>
                                <th className="border-2 border-slate-900 p-3 w-12">#</th>
                                <th className="border-2 border-slate-900 p-3 text-right pr-6">شرح کالا / محصول</th>
                                <th className="border-2 border-slate-900 p-3 w-32">تعداد</th>
                                <th className="border-2 border-slate-900 p-3 w-32">وزن (KG)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(permit.items || []).map((item, idx) => (
                                <tr key={idx} className="text-base font-medium">
                                    <td className="border-2 border-slate-900 p-3">{idx + 1}</td>
                                    <td className="border-2 border-slate-900 p-3 text-right pr-6 font-bold">{item.goodsName}</td>
                                    <td className="border-2 border-slate-900 p-3 font-mono font-black">{item.deliveredCartonCount ?? item.cartonCount}</td>
                                    <td className="border-2 border-slate-900 p-3 font-mono font-black">{item.deliveredWeight ?? item.weight}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-3">
                        <h3 className="font-black text-lg flex items-center gap-2 border-r-4 border-green-600 pr-3">
                            <MapPin size={22} className="text-green-600"/> مشخصات گیرنده
                        </h3>
                        <div className="border-2 border-slate-200 rounded-3xl p-5 bg-slate-50 text-sm space-y-3 shadow-inner">
                            <div><span className="font-bold text-slate-400 ml-2">نام گیرنده:</span> <span className="font-black text-lg">{permit.recipientName}</span></div>
                            <div className="border-t border-slate-200 pt-2"><span className="font-bold text-slate-400 ml-2">آدرس مقصد:</span> <span className="font-bold leading-relaxed">{permit.destinations?.[0]?.address || permit.destinationAddress}</span></div>
                        </div>
                    </div>
                    <div className="space-y-3">
                        <h3 className="font-black text-lg flex items-center gap-2 border-r-4 border-indigo-600 pr-3">
                            <Truck size={22} className="text-indigo-600"/> مشخصات حمل
                        </h3>
                        <div className="border-2 border-slate-200 rounded-3xl p-5 bg-slate-50 text-sm space-y-3 shadow-inner">
                            <div><span className="font-bold text-slate-400 ml-2">نام راننده:</span> <span className="font-black text-lg">{permit.driverName || '---'}</span></div>
                            <div className="border-t border-slate-200 pt-2"><span className="font-bold text-slate-400 ml-2">شماره پلاک:</span> <span className="font-black text-lg dir-ltr font-mono">{permit.plateNumber || '---'}</span></div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-12 pt-8 border-t-4 border-slate-900 grid grid-cols-4 gap-4 text-center items-end">
                <div className="flex flex-col items-center gap-4">
                    <Stamp title="مدیر فروش (درخواست)" name={permit.requester} />
                    <div className="w-full border-t border-slate-200 pt-2 text-[10px] font-bold text-slate-400">تایید درخواست</div>
                </div>
                <div className="flex flex-col items-center gap-4">
                    {permit.approverCeo ? <Stamp title="مدیریت عامل" name={permit.approverCeo} /> : <div className="h-14 w-full bg-slate-50 rounded-xl border border-dashed border-slate-200"></div>}
                    <div className="w-full border-t border-slate-200 pt-2 text-[10px] font-bold text-slate-400">تایید مدیریت</div>
                </div>
                <div className="flex flex-col items-center gap-4">
                    {permit.approverWarehouse ? <Stamp title="تایید انبار / وزن" name={permit.approverWarehouse} /> : <div className="h-14 w-full bg-slate-50 rounded-xl border border-dashed border-slate-200"></div>}
                    <div className="w-full border-t border-slate-200 pt-2 text-[10px] font-bold text-slate-400">تایید و تحویل انبار</div>
                </div>
                <div className="flex flex-col items-center gap-4">
                    {permit.status === ExitPermitStatus.EXITED ? (
                        <div className="border-4 border-slate-900 rounded-3xl p-3 bg-slate-900 text-white shadow-xl">
                            <div className="text-[10px] font-black border-b border-white/20 mb-1 pb-1">ساعت خروج نهایی</div>
                            <div className="text-3xl font-black font-mono">{permit.exitTime}</div>
                        </div>
                    ) : <div className="h-20 w-full bg-slate-50 rounded-3xl border-4 border-dashed border-slate-200 flex items-center justify-center text-[10px] font-black text-slate-300">در انتظار خروج</div>}
                    <div className="w-full border-t border-slate-900 pt-2 text-[10px] font-black text-slate-900 uppercase">تایید نهایی انتظامات</div>
                </div>
            </div>
            
            <div className="mt-8 text-center text-[9px] font-bold text-slate-300">
                این سند در سیستم مدیریت هوشمند خروج کالا تولید شده و نسخه دیجیتال آن معتبر می‌باشد.
            </div>
      </div>
  );

  if (embed) return content;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex flex-col items-center justify-start p-4 overflow-y-auto animate-fade-in no-print">
        <div className="bg-white p-4 rounded-3xl shadow-2xl flex justify-between items-center w-full max-w-4xl mb-6 sticky top-0 z-[110]">
            <div className="flex items-center gap-3">
                <div className="bg-blue-600 p-2 rounded-2xl text-white shadow-lg shadow-blue-200"><Printer size={20}/></div>
                <span className="font-black text-slate-800">پیش‌نمایش سند خروج</span>
            </div>
            <div className="flex gap-2">
                <button onClick={() => window.print()} className="bg-blue-600 text-white px-5 py-2.5 rounded-2xl text-xs font-black shadow-lg shadow-blue-100 flex items-center gap-2 hover:bg-blue-700 transition-all"><Printer size={16}/> چاپ فیزیکی</button>
                <button onClick={onClose} className="bg-slate-100 text-slate-400 p-2.5 rounded-2xl hover:bg-red-50 hover:text-red-500 transition-all"><X size={20}/></button>
            </div>
        </div>
        
        <div className="w-full flex justify-center pb-20" style={{ transform: `scale(${scale})`, transformOrigin: 'top center' }}>
            {content}
        </div>
    </div>
  );
}
