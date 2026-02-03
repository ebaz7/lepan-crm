
import React, { useRef, useState, useEffect } from 'react';
import { X, Printer, FileDown, Loader2 } from 'lucide-react';
import { generatePdf } from '../../utils/pdfGenerator';
import { formatDate } from '../../constants';

interface Props {
  data: any[]; // Array of { company: string, items: any[] }
  onClose: () => void;
}

const PrintStockReport: React.FC<Props> = ({ data, onClose }) => {
  const [processing, setProcessing] = useState(false);
  const [scale, setScale] = useState(1);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Auto-Scale Logic
  useEffect(() => {
    const handleResize = () => {
        const wrapper = wrapperRef.current;
        if (wrapper) {
            const wrapperWidth = wrapper.clientWidth;
            const targetWidth = 794; // A4 Portrait width in px
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
          elementId: 'stock-report-portrait',
          filename: `Stock_Summary_${new Date().toISOString().slice(0,10)}.pdf`,
          format: 'A4',
          orientation: 'portrait',
          onComplete: () => setProcessing(false),
          onError: () => { alert('خطا'); setProcessing(false); }
      });
  };

  const COMPANY_COLORS = [
      'bg-indigo-600', 'bg-emerald-600', 'bg-amber-600', 
      'bg-rose-600', 'bg-slate-700', 'bg-cyan-600'
  ];

  const content = (
      <div id="stock-report-portrait" className="printable-content bg-white text-black p-8 font-sans" 
        style={{ width: '210mm', minHeight: '296mm', direction: 'rtl', boxSizing: 'border-box' }}>
        
        {/* Header */}
        <div className="border-b-4 border-black pb-4 mb-6 flex justify-between items-end">
            <div>
                <h1 className="text-3xl font-black mb-1">گزارش تجمیعی موجودی انبارها</h1>
                <p className="text-sm font-bold text-gray-500">سیستم هوشمند مدیریت بنگاه</p>
            </div>
            <div className="text-left text-sm font-bold space-y-1">
                <div>تاریخ: {formatDate(new Date().toISOString())}</div>
                <div>زمان: {new Date().toLocaleTimeString('fa-IR')}</div>
            </div>
        </div>

        {/* Inventory Grids */}
        <div className="space-y-10">
            {data.map((companyGroup, idx) => (
                <div key={companyGroup.company} className="break-inside-avoid">
                    <div className={`text-white px-4 py-2 rounded-t-lg font-black text-lg ${COMPANY_COLORS[idx % COMPANY_COLORS.length]}`}>
                        📦 انبار: {companyGroup.company}
                    </div>
                    <table className="w-full text-sm border-collapse border-2 border-black">
                        <thead className="bg-gray-100 font-bold">
                            <tr>
                                <th className="border border-black p-2 w-10">#</th>
                                <th className="border border-black p-2 text-right">شرح کالا</th>
                                <th className="border border-black p-2 w-24">موجودی (تعداد)</th>
                                <th className="border border-black p-2 w-24">موجودی (وزن)</th>
                                <th className="border border-black p-2 w-20">واحد</th>
                            </tr>
                        </thead>
                        <tbody>
                            {companyGroup.items.filter(i => i.count !== 0).map((item: any, i: number) => (
                                <tr key={item.id} className="hover:bg-gray-50">
                                    <td className="border border-black p-2 text-center">{i + 1}</td>
                                    <td className="border border-black p-2 font-bold">{item.name}</td>
                                    <td className="border border-black p-2 text-center font-mono font-black text-blue-700">{item.count}</td>
                                    <td className="border border-black p-2 text-center font-mono font-black text-emerald-700">{item.weight}</td>
                                    <td className="border border-black p-2 text-center text-xs">{item.unit}</td>
                                </tr>
                            ))}
                            {companyGroup.items.length === 0 && (
                                <tr><td colSpan={5} className="p-4 text-center text-gray-400">کالایی یافت نشد.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            ))}
        </div>

        {/* Footer */}
        <div className="mt-auto pt-10 border-t border-gray-200 flex justify-between text-xs text-gray-400 italic">
            <span>گزارش تولید شده توسط سیستم - غیرقابل استناد فیزیکی بدون امضاء</span>
            <span>صفحه ۱ از ۱</span>
        </div>
      </div>
  );

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex flex-col items-center justify-start p-4 overflow-y-auto">
        <div className="w-full max-w-4xl flex justify-between items-center bg-white p-3 rounded-xl mb-4 shadow-lg z-[210]">
            <span className="font-bold text-gray-800">پیش‌نمایش چاپ موجودی</span>
            <div className="flex gap-2">
                <button onClick={handleDownloadPDF} disabled={processing} className="bg-red-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-xs font-bold">
                    {processing ? <Loader2 className="animate-spin" size={16}/> : <FileDown size={16}/>} دریافت PDF
                </button>
                <button onClick={() => window.print()} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-xs font-bold">
                    <Printer size={16}/> چاپ
                </button>
                <button onClick={onClose} className="p-2 text-gray-400 hover:text-red-500"><X/></button>
            </div>
        </div>

        <div className="flex-1 w-full flex justify-center pb-10" ref={wrapperRef}>
            <div style={{ 
              transform: `scale(${scale})`, 
              transformOrigin: 'top center',
              width: '210mm',
              backgroundColor: 'white',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
              marginBottom: `${(1 - scale) * -100}px` 
            }}>
                {content}
            </div>
        </div>
    </div>
  );
};

export default PrintStockReport;
