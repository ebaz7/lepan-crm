
import React, { useState, useEffect, useRef } from 'react';
import { BrokerageTransaction, SystemSettings } from '../../types';
import { formatDate, formatCurrency } from '../../constants';
import { X, Printer, Loader2, Share2, FileDown, CheckCircle, XCircle, FileText } from 'lucide-react';
import { generatePdf } from '../../utils/pdfGenerator';

interface Props {
    tx: BrokerageTransaction;
    onClose: () => void;
    settings?: SystemSettings;
    onApprove?: () => void;
    onReject?: () => void;
    embed?: boolean;
}

const PrintBrokerageBijak: React.FC<Props> = ({ tx, onClose, settings, onApprove, onReject, embed }) => {
    const [processing, setProcessing] = useState(false);
    const [scale, setScale] = useState(1);
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleResize = () => {
            const wrapper = wrapperRef.current;
            if (wrapper) {
                const wrapperWidth = wrapper.clientWidth;
                const targetWidth = 794; // A4 Portrait Width
                if (wrapperWidth < targetWidth + 40) setScale((wrapperWidth - 32) / targetWidth);
                else setScale(1);
            }
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const handleDownloadPDF = async () => {
        setProcessing(true);
        await generatePdf({
            elementId: `bijak-print-${tx.id}`,
            filename: `Bijak_${tx.serialNumber}_${tx.companyName}.pdf`,
            format: 'A4',
            orientation: 'portrait',
            onComplete: () => setProcessing(false),
            onError: () => { alert('خطا در ایجاد PDF'); setProcessing(false); }
        });
    };

    const content = (
        <div id={`bijak-print-${tx.id}`} className="printable-content bg-white text-black p-10 font-sans shadow-2xl mx-auto" 
             style={{ width: '210mm', minHeight: '297mm', direction: 'rtl', boxSizing: 'border-box' }}>
            
            {/* Header */}
            <div className="border-b-4 border-black pb-4 mb-6 flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-black mb-1">{tx.companyName}</h1>
                    <p className="text-base font-bold text-gray-600">بیجک خروج کالا از انبار بنگاه</p>
                </div>
                <div className="text-left space-y-2">
                    <div className="text-2xl font-black border-4 border-black px-6 py-2 rounded-xl">NO: {tx.serialNumber}</div>
                    <div className="text-sm font-bold">تاریخ: {formatDate(tx.date)}</div>
                </div>
            </div>

            {/* Info Section */}
            <div className="grid grid-cols-2 gap-4 border-2 border-black rounded-2xl p-6 bg-gray-50 mb-8 text-sm">
                <div><span className="font-bold text-gray-500 ml-2">تحویل‌گیرنده / مشتری:</span> <span className="font-black text-lg">{tx.recipientName}</span></div>
                <div><span className="font-bold text-gray-500 ml-2">مقصد تخلیه:</span> <span className="font-bold">{tx.destination || '---'}</span></div>
                <div><span className="font-bold text-gray-500 ml-2">نام راننده:</span> <span className="font-bold text-lg">{tx.driverName || '---'}</span></div>
                <div><span className="font-bold text-gray-500 ml-2">شماره پلاک:</span> <span className="font-black font-mono text-lg dir-ltr">{tx.plateNumber || '---'}</span></div>
            </div>

            {/* Table */}
            <div className="flex-1">
                <table className="w-full border-collapse border-2 border-black text-center text-sm">
                    <thead className="bg-gray-200">
                        <tr className="font-black border-b-2 border-black">
                            <th className="border-l-2 border-black p-3 w-12">#</th>
                            <th className="border-l-2 border-black p-3 text-right">شرح کالا</th>
                            <th className="border-l-2 border-black p-3 w-32">رنگ</th>
                            <th className="border-l-2 border-black p-3 w-32">تعداد</th>
                            <th className="p-3 w-32">وزن (KG)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {tx.items.map((it, idx) => (
                            <tr key={idx} className="border-b border-black">
                                <td className="border-l-2 border-black p-3 font-bold">{idx + 1}</td>
                                <td className="border-l-2 border-black p-3 text-right font-black text-lg">{it.itemName}</td>
                                <td className="border-l-2 border-black p-3 font-bold">{it.color || '---'}</td>
                                <td className="border-l-2 border-black p-3 font-mono font-black text-xl">{it.quantity}</td>
                                <td className="p-3 font-mono font-bold text-xl">{it.weight || '---'}</td>
                            </tr>
                        ))}
                        <tr className="bg-gray-100 font-black text-xl">
                            <td colSpan={3} className="border-l-2 border-black p-4 text-left pl-8">جمع کل:</td>
                            <td className="border-l-2 border-black p-4 font-mono">{tx.items.reduce((s, i) => s + (i.quantity || 0), 0)}</td>
                            <td className="p-4 font-mono">{tx.items.reduce((s, i) => s + (i.weight || 0), 0)}</td>
                        </tr>
                    </tbody>
                </table>
                
                {tx.description && (
                    <div className="mt-6 p-4 border-2 border-dashed border-gray-300 rounded-xl">
                        <span className="text-xs font-black text-gray-400 block mb-1 uppercase tracking-widest">توضیحات:</span>
                        <p className="text-sm font-medium leading-relaxed">{tx.description}</p>
                    </div>
                )}
            </div>

            {/* Footer / Signatures */}
            <div className="mt-auto pt-10 grid grid-cols-3 gap-6 text-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="text-xs font-black text-gray-500 border-b border-gray-300 w-full pb-1 mb-1">امضاء انباردار (ثبت کننده)</div>
                    <div className="font-bold text-indigo-700 rotate-[-5deg] border-2 border-indigo-700 px-4 py-1 rounded-lg opacity-80">{tx.createdBy}</div>
                </div>
                <div className="flex flex-col items-center gap-4">
                    <div className="text-xs font-black text-gray-500 border-b border-gray-300 w-full pb-1 mb-1">تایید مدیریت عامل</div>
                    {tx.approvedBy ? (
                        <div className="font-bold text-emerald-700 rotate-[3deg] border-2 border-emerald-700 px-4 py-1 rounded-lg opacity-80">تایید شد: {tx.approvedBy}</div>
                    ) : (
                        <div className="text-gray-300 text-sm mt-4 font-bold tracking-widest">در انتظار تایید...</div>
                    )}
                </div>
                <div className="flex flex-col items-center gap-4">
                    <div className="text-xs font-black text-gray-500 border-b border-gray-300 w-full pb-1 mb-1">امضاء تحویل‌گیرنده / راننده</div>
                    <div className="h-16 w-32 border-b-2 border-dotted border-gray-200"></div>
                </div>
            </div>

            <div className="mt-12 pt-4 border-t border-gray-100 text-[10px] text-gray-400 italic flex justify-between">
                <span>سند الکترونیک سیستم مدیریت بنگاه</span>
                <span>تاریخ چاپ: {new Date().toLocaleString('fa-IR')}</span>
            </div>
        </div>
    );

    if (embed) return content;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[250] flex flex-col items-center p-4 overflow-y-auto animate-fade-in">
            <div className="bg-white p-4 rounded-3xl shadow-2xl mb-6 flex gap-4 no-print w-full max-w-4xl justify-between items-center border border-white/20">
                <div className="flex items-center gap-3">
                    <div className="bg-indigo-100 p-2 rounded-xl text-indigo-600"><FileText size={20}/></div>
                    <span className="font-black text-gray-800">پیش‌نمایش بیجک خروج</span>
                </div>
                <div className="flex gap-2">
                    {onApprove && <button onClick={onApprove} className="bg-emerald-600 text-white px-6 py-2.5 rounded-2xl flex items-center gap-2 font-black shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all"><CheckCircle size={18}/> تایید و ارسال به گروه</button>}
                    {onReject && <button onClick={onReject} className="bg-rose-100 text-rose-600 px-6 py-2.5 rounded-2xl flex items-center gap-2 font-black hover:bg-rose-200 transition-all"><XCircle size={18}/> رد بیجک</button>}
                    <button onClick={handleDownloadPDF} disabled={processing} className="bg-gray-100 text-gray-700 px-6 py-2.5 rounded-2xl flex items-center gap-2 font-black hover:bg-gray-200 transition-all">
                        {processing ? <Loader2 className="animate-spin" size={18}/> : <FileDown size={18}/>} دریافت PDF
                    </button>
                    <button onClick={() => window.print()} className="bg-indigo-600 text-white px-6 py-2.5 rounded-2xl flex items-center gap-2 font-black shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all"><Printer size={18}/> چاپ</button>
                    <button onClick={onClose} className="p-3 text-gray-400 hover:text-rose-500 bg-gray-50 rounded-2xl"><X/></button>
                </div>
            </div>

            <div className="w-full flex justify-center pb-20" ref={wrapperRef}>
                <div style={{ transform: `scale(${scale})`, transformOrigin: 'top center' }}>
                    {content}
                </div>
            </div>
        </div>
    );
};

export default PrintBrokerageBijak;
