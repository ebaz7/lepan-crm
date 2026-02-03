
import React, { useState, useEffect, useRef } from 'react';
import { PaymentOrder, OrderStatus, PaymentMethod, SystemSettings } from '../types';
import { formatCurrency, formatDate, getStatusLabel, numberToPersianWords, formatNumberString, getShamsiDateFromIso } from '../constants';
import { X, Printer, FileDown, Loader2, CheckCircle, XCircle, Pencil, Share2, Users, Search, RotateCcw, AlertTriangle, FileText, LayoutTemplate, EyeOff, Eye, Settings2, ChevronLeft, ChevronRight, Calendar, MapPin, Layers } from 'lucide-react';
import { apiCall } from '../services/apiService';
import { generatePdf } from '../utils/pdfGenerator'; 

interface PrintVoucherProps {
  order: PaymentOrder;
  onClose?: () => void;
  settings?: SystemSettings;
  onApprove?: () => void;
  onReject?: () => void;
  onEdit?: () => void;
  onRevoke?: () => void; 
  embed?: boolean; 
}

const PrintVoucher: React.FC<PrintVoucherProps> = ({ order, onClose, settings, onApprove, onReject, onEdit, onRevoke, embed }) => {
  const [processing, setProcessing] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [showContactSelect, setShowContactSelect] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  const [printMode, setPrintMode] = useState<'receipt' | 'bank_form'>('receipt');
  const [showFormBackground, setShowFormBackground] = useState(false);
  const [scale, setScale] = useState(1);
  const containerWrapperRef = useRef<HTMLDivElement>(null);

  const company = settings?.companies?.find(c => c.name === order.payingCompany);

  useEffect(() => {
    const handleResize = () => {
        if (embed) return;
        const wrapper = containerWrapperRef.current;
        if (wrapper) {
            const wrapperWidth = wrapper.clientWidth;
            const targetWidth = 794; 
            if (wrapperWidth < targetWidth + 40) { setScale((wrapperWidth - 32) / targetWidth); } 
            else { setScale(1); }
        }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [embed, printMode]);

  const Stamp = ({ name, title }: { name: string; title: string }) => (
    <div className="border-[2px] border-blue-800 text-blue-800 rounded-lg py-1 px-3 rotate-[-5deg] opacity-90 mix-blend-multiply bg-white/80 print:bg-transparent shadow-sm inline-block">
      <div className="text-[9px] font-bold border-b border-blue-800 mb-0.5 text-center pb-0.5">{title}</div>
      <div className="text-[10px] text-center font-bold whitespace-nowrap">{name}</div>
    </div>
  );

  // Fixed: Completed missing logic from truncated file
  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    setProcessing(true);
    await generatePdf({
      elementId: `print-voucher-${order.id}`,
      filename: `Voucher_${order.trackingNumber}.pdf`,
      format: 'A4',
      orientation: 'portrait',
      onComplete: () => setProcessing(false),
      onError: () => {
        alert('خطا در تولید PDF');
        setProcessing(false);
      }
    });
  };

  const content = (
    <div 
      id={`print-voucher-${order.id}`}
      className="bg-white mx-auto shadow-xl relative text-slate-900" 
      style={{ 
        width: '210mm', 
        minHeight: '296mm', 
        padding: '15mm', 
        boxSizing: 'border-box',
        direction: 'rtl'
      }}
    >
      <div className="border-b-4 border-slate-900 pb-4 mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black">{order.payingCompany}</h1>
          <p className="text-sm font-bold text-slate-500">دستور پرداخت وجه</p>
        </div>
        <div className="text-left">
          <div className="text-xl font-bold bg-slate-100 px-4 py-1 rounded">No: {order.trackingNumber}</div>
          <div className="text-xs text-slate-500 mt-1">تاریخ: {formatDate(order.date)}</div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4 text-sm bg-slate-50 p-4 rounded-xl border">
          <div><span className="font-bold text-slate-500">در وجه:</span> <span className="font-black text-lg">{order.payee}</span></div>
          <div className="text-left"><span className="font-bold text-slate-500">مبلغ کل:</span> <span className="font-black text-lg text-blue-700 dir-ltr">{formatCurrency(order.totalAmount)}</span></div>
          <div className="col-span-2 mt-2"><span className="font-bold text-slate-500">بابت:</span> <span className="font-bold">{order.description}</span></div>
        </div>

        <table className="w-full border-collapse border-2 border-slate-900 text-sm text-center">
          <thead className="bg-slate-100">
            <tr>
              <th className="border-2 border-slate-900 p-2">روش پرداخت</th>
              <th className="border-2 border-slate-900 p-2">بانک مبدا / مشخصات</th>
              <th className="border-2 border-slate-900 p-2">مبلغ (ریال)</th>
            </tr>
          </thead>
          <tbody>
            {order.paymentDetails.map((detail, idx) => (
              <tr key={idx}>
                <td className="border-2 border-slate-900 p-2">{detail.method}</td>
                <td className="border-2 border-slate-900 p-2">{detail.bankName || detail.chequeNumber || '-'}</td>
                <td className="border-2 border-slate-900 p-2 font-bold font-mono">{formatCurrency(detail.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="grid grid-cols-3 gap-4 text-center mt-12 pt-8 border-t-2 border-slate-200">
          <div className="flex flex-col items-center gap-2">
            <Stamp title="درخواست کننده" name={order.requester} />
            <span className="text-[10px] font-bold text-slate-400">تایید درخواست</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            {order.approverFinancial ? <Stamp title="مدیریت مالی" name={order.approverFinancial} /> : <div className="h-12 w-24 border border-dashed rounded opacity-30"></div>}
            <span className="text-[10px] font-bold text-slate-400">تایید مالی</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            {order.approverCeo ? <Stamp title="مدیریت عامل" name={order.approverCeo} /> : <div className="h-12 w-24 border border-dashed rounded opacity-30"></div>}
            <span className="text-[10px] font-bold text-slate-400">تایید نهایی</span>
          </div>
        </div>
      </div>
    </div>
  );

  if (embed) return content;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex flex-col items-center justify-start p-4 overflow-y-auto animate-fade-in no-print">
      <div className="bg-white p-4 rounded-2xl shadow-2xl flex justify-between items-center w-full max-w-4xl mb-6 sticky top-0 z-[110]">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-xl text-white"><Printer size={20}/></div>
          <span className="font-bold text-slate-800">پیش‌نمایش دستور پرداخت</span>
        </div>
        <div className="flex gap-2">
          {onApprove && <button onClick={onApprove} className="bg-green-600 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1 shadow-lg shadow-green-100 hover:bg-green-700 transition-all"><CheckCircle size={16}/> تایید نهایی</button>}
          {onReject && <button onClick={onReject} className="bg-red-600 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1 shadow-lg shadow-red-100 hover:bg-red-700 transition-all"><XCircle size={16}/> رد</button>}
          <button onClick={handlePrint} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1 shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all"><Printer size={16}/> چاپ</button>
          <button onClick={handleDownloadPDF} disabled={processing} className="bg-slate-100 text-slate-700 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1 hover:bg-slate-200 transition-all">
            {processing ? <Loader2 size={16} className="animate-spin"/> : <FileDown size={16}/>} PDF
          </button>
          <button onClick={onClose} className="bg-slate-100 text-slate-400 p-2 rounded-xl hover:bg-red-50 hover:text-red-500 transition-all"><X size={20}/></button>
        </div>
      </div>
      
      <div className="w-full flex justify-center pb-20" ref={containerWrapperRef} style={{ transform: `scale(${scale})`, transformOrigin: 'top center' }}>
        {content}
      </div>
    </div>
  );
};

// Fixed: Added missing default export
export default PrintVoucher;
