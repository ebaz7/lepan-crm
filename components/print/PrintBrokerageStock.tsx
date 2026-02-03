
import React from 'react';
import { formatDate } from '../../constants';
import { X, Printer, FileDown } from 'lucide-react';

const PrintBrokerageStock: React.FC<{ data: any, onClose: () => void }> = ({ data, onClose }) => {
    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[200] flex flex-col items-center p-4 overflow-y-auto animate-fade-in">
            <div className="bg-white p-4 rounded-2xl shadow-xl mb-4 flex gap-4 no-print w-full max-w-4xl justify-between">
                <div className="font-bold text-gray-800">پیش‌نمایش گزارش موجودی (A4 عمودی)</div>
                <div className="flex gap-2">
                    <button onClick={() => window.print()} className="bg-blue-600 text-white px-6 py-2 rounded-xl flex items-center gap-2 font-bold shadow-lg shadow-blue-200"><Printer size={18}/> چاپ</button>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-red-500"><X/></button>
                </div>
            </div>

            <div id="print-stock-brokerage" className="printable-content bg-white w-[210mm] min-h-[297mm] p-[15mm] text-black font-sans shadow-2xl relative">
                <div className="flex justify-between items-end border-b-4 border-black pb-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-black mb-1">گزارش تجمیعی موجودی انبار بنگاه</h1>
                        <p className="text-sm font-bold text-gray-500">سیستم هوشمند مدیریت بازرگانی و انبار</p>
                    </div>
                    <div className="text-left text-xs font-bold space-y-1">
                        <div>تاریخ: {formatDate(new Date().toISOString())}</div>
                        <div>ساعت: {new Date().toLocaleTimeString('fa-IR')}</div>
                    </div>
                </div>

                <div className="space-y-10">
                    {Object.entries(data).map(([company, items]: [string, any], idx) => (
                        <div key={company} className="break-inside-avoid">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-1.5 h-8 bg-indigo-600 rounded-full"></div>
                                <h2 className="text-xl font-black text-gray-900">موجودی انبار: {company}</h2>
                            </div>
                            <table className="w-full border-collapse border-2 border-black text-center text-sm">
                                <thead className="bg-gray-100">
                                    <tr>
                                        <th className="border border-black p-3 w-12">#</th>
                                        <th className="border border-black p-3 text-right">شرح کالا و محصول</th>
                                        <th className="border border-black p-3 w-32">رنگ</th>
                                        <th className="border border-black p-3 w-28">تعداد</th>
                                        <th className="border border-black p-3 w-28">وزن (KG)</th>
                                        <th className="border border-black p-3 w-20">واحد</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map((item: any, i: number) => (
                                        <tr key={item.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                            <td className="border border-black p-2 font-bold">{i + 1}</td>
                                            <td className="border border-black p-2 text-right font-black">{item.name}</td>
                                            <td className="border border-black p-2 font-bold">{item.color || '---'}</td>
                                            <td className="border border-black p-2 font-mono font-black text-blue-700 text-lg">{item.currentQty}</td>
                                            <td className="border border-black p-2 font-mono font-bold text-emerald-700">{item.currentWeight}</td>
                                            <td className="border border-black p-2 text-xs">{item.unit}</td>
                                        </tr>
                                    ))}
                                    <tr className="bg-gray-200 font-black">
                                        <td colSpan={3} className="border border-black p-3 text-left pl-6 text-base">جمع کل {company}:</td>
                                        <td className="border border-black p-3 font-mono text-xl">{items.reduce((s:any,i:any)=>s+i.currentQty, 0)}</td>
                                        <td className="border border-black p-3 font-mono">{items.reduce((s:any,i:any)=>s+i.currentWeight, 0)}</td>
                                        <td className="border border-black"></td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    ))}
                </div>

                <div className="mt-12 pt-8 border-t border-gray-200 text-center text-[10px] text-gray-400 italic">
                    گزارش سیستمی غیرقابل استناد فیزیکی بدون امضا و مهر - صفحه ۱ از ۱
                </div>
            </div>
        </div>
    );
};

export default PrintBrokerageStock;
