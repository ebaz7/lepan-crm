
import React from 'react';
import { PartMasterData } from '../types';
import { formatDate } from '../constants';

const PrintPartDataSheet: React.FC<{ part: PartMasterData }> = ({ part }) => {
    return (
        <div className="p-8 bg-white text-black font-sans dir-rtl text-right print-p-0">
            {/* Header */}
            <div className="border-4 border-black p-4 mb-6 flex justify-between items-center bg-gray-50">
                <div className="flex-1">
                    <h1 className="text-2xl font-black mb-1">شناسنامه کالا / قطعه (Data Sheet)</h1>
                    <p className="text-xs font-bold text-gray-600 tracking-widest uppercase">M.S.G Industrial Group - Technical Specification</p>
                </div>
                <div className="w-24 h-24 border-2 border-black flex items-center justify-center bg-white p-1">
                    {part.image ? (
                        <img src={part.image} className="max-w-full max-h-full object-contain" alt="part" referrerPolicy="no-referrer" />
                    ) : (
                        <span className="text-[10px] font-bold text-gray-300">NO IMAGE</span>
                    )}
                </div>
            </div>

            {/* Main Info Table */}
            <div className="grid grid-cols-2 border-2 border-black">
                <div className="border-b border-l border-black p-3 bg-gray-100 font-bold text-sm">نام کالا / قطعه</div>
                <div className="border-b border-black p-3 text-sm font-black">{part.name}</div>
                
                <div className="border-b border-l border-black p-3 bg-gray-100 font-bold text-sm">نوع / دسته‌بندی</div>
                <div className="border-b border-black p-3 text-sm">{part.type} / {part.category}</div>
                
                <div className="border-b border-l border-black p-3 bg-gray-100 font-bold text-sm">زیر گروه</div>
                <div className="border-b border-black p-3 text-sm">{part.subCategory || '-'}</div>
                
                <div className="border-b border-l border-black p-3 bg-gray-100 font-bold text-sm">مشخصات ابعادی / فنی</div>
                <div className="border-b border-black p-3 text-sm font-mono">{part.dimensions || '-'}</div>
                
                <div className="border-b border-l border-black p-3 bg-gray-100 font-bold text-sm">واحد اندازه‌گیری</div>
                <div className="border-b border-black p-3 text-sm">{part.unit}</div>
                
                <div className="border-l border-black p-3 bg-gray-100 font-bold text-sm">حداقل موجودی (نقطه سفارش)</div>
                <div className="p-3 text-sm font-black text-red-600">{part.minStock} {part.unit}</div>
            </div>

            {/* Visuals & QR Section */}
            <div className="mt-6 flex gap-6 h-64">
                <div className="flex-1 border-2 border-black p-2 flex items-center justify-center bg-gray-50 relative overflow-hidden">
                     {part.image ? (
                        <img src={part.image} className="max-w-full max-h-full object-contain" alt="part" referrerPolicy="no-referrer" />
                    ) : (
                        <div className="text-gray-300 text-sm font-bold italic">تصویر فنی بارگذاری نشده است</div>
                    )}
                    <div className="absolute top-0 right-0 p-2 bg-black text-white text-[10px] font-black uppercase">Product Visual</div>
                </div>
            </div>

            {/* Footer / QC Area */}
            <div className="mt-8 grid grid-cols-3 gap-4">
                <div className="border-2 border-dashed border-black p-10 flex flex-col items-center justify-between text-[10px]">
                    <span className="font-bold">تاییدیه واحد فنی</span>
                </div>
                <div className="border-2 border-dashed border-black p-10 flex flex-col items-center justify-between text-[10px]">
                    <span className="font-bold">تاییدیه انبارداری</span>
                </div>
                <div className="border-2 border-dashed border-black p-10 flex flex-col items-center justify-between text-[10px]">
                    <span className="font-bold">تاییدیه کنترل کیفیت</span>
                </div>
            </div>

            <div className="mt-4 text-[9px] text-gray-400 flex justify-between font-mono">
                <span>SYSTEM ID: {part.id}</span>
                <span>PRINT DATE: {new Date().toLocaleString('fa-IR')}</span>
            </div>

            <style dangerouslySetInnerHTML={{__html: `
                @media print {
                    @page { size: A4 portrait; margin: 15mm; }
                    body { visibility: hidden; background: white !important; }
                    .printable-datasheet, .printable-datasheet * { visibility: visible; }
                    .printable-datasheet { 
                        position: absolute; 
                        left: 0; 
                        top: 0; 
                        width: 210mm;
                        padding: 0;
                        margin: 0;
                        background: white !important;
                        z-index: 99999;
                    }
                }
            `}} />
        </div>
    );
};

export default PrintPartDataSheet;
