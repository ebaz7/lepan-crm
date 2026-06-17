import React from 'react';
import { PurchaseRequest } from '../types';
import { formatDate } from '../constants';

interface Props {
    request: PurchaseRequest;
}

const PrintPurchaseRequest: React.FC<Props> = ({ request }) => {
    return (
        <div className="bg-white p-6 w-full h-full text-black print-only-section font-serif" dir="rtl" style={{ direction: 'rtl' }}>
            <div className="border-4 border-double border-black p-4 mb-4 flex justify-between items-center text-center bg-gray-50/50">
                <div className="w-1/3 text-right">
                    <p className="text-[12px] font-bold">شماره: {request.requestNumber}</p>
                    <p className="text-[12px] font-bold">تاریخ: {formatDate(request.date)}</p>
                </div>
                <div className="w-1/3">
                    <h2 className="text-xl font-black border-b-2 border-black inline-block pb-1">فرم درخواست خرید قطعه / کالا</h2>
                    <p className="text-[10px] font-bold mt-1">واحد تدارکات و پشتیبانی</p>
                </div>
                <div className="w-1/3 text-left">
                     <div className="border-2 border-black p-2 font-black text-sm inline-block">
                        A5 LANDSCAPE
                    </div>
                </div>
            </div>

            <table className="w-full border-collapse border-2 border-black mb-6">
                <thead>
                    <tr className="bg-gray-200">
                        <th className="border border-black p-2 font-bold text-[12px]">ردیف</th>
                        <th className="border border-black p-2 font-bold text-[12px]">نام قطعه / شرح کالا</th>
                        <th className="border border-black p-2 font-bold text-[12px]">گروه کالا</th>
                        <th className="border border-black p-2 font-bold text-[12px]">تعداد</th>
                        <th className="border border-black p-2 font-bold text-[12px]">واحد</th>
                    </tr>
                </thead>
                <tbody>
                    <tr className="h-16">
                        <td className="border border-black p-2 text-center text-sm">۱</td>
                        <td className="border border-black p-2 text-right px-4 text-sm font-black">{request.itemName}</td>
                        <td className="border border-black p-2 text-center text-sm">{request.category}{request.subCategory ? ` / ${request.subCategory}` : ''}</td>
                        <td className="border border-black p-2 text-center text-[16px] font-black">{request.quantity}</td>
                        <td className="border border-black p-2 text-center text-sm">{request.unit}</td>
                    </tr>
                </tbody>
            </table>

            <div className="border border-black p-3 mb-6 bg-gray-50/30">
                <h3 className="text-[11px] font-black underline mb-2">مشخصات فنی و ملاحظات درخواستی:</h3>
                <p className="text-[12px] leading-relaxed py-2 min-h-[40px]">{request.specifications || '---'}</p>
            </div>

            <div className="grid grid-cols-4 gap-2 text-center mt-auto">
                <div className="border border-black p-2">
                    <h4 className="text-[11px] font-black mb-10">درخواست کننده (انبار)</h4>
                    <p className="text-[10px] font-bold border-t border-black/10 pt-1">{request.requester}</p>
                </div>
                <div className="border border-black p-2">
                    <h4 className="text-[11px] font-black mb-10">تایید فنی</h4>
                    <p className="text-[10px] font-bold border-t border-black/10 pt-1">{request.approverTechnical || '-'}</p>
                </div>
                <div className="border border-black p-2">
                    <h4 className="text-[11px] font-black mb-10">مدیر کارخانه</h4>
                    <p className="text-[10px] font-bold border-t border-black/10 pt-1">{request.approverFactory || '-'}</p>
                </div>
                <div className="border border-black p-2">
                    <h4 className="text-[11px] font-black mb-10">مدیر بازرگانی</h4>
                    <p className="text-[10px] font-bold border-t border-black/10 pt-1">{request.approverCommercial || '-'}</p>
                </div>
            </div>
            
            <style dangerouslySetInnerHTML={{__html: `
                @media print {
                    @page { size: A5 landscape; margin: 0; }
                    body {
                        visibility: hidden !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }
                    .print-only-section {
                        visibility: visible !important;
                        position: absolute !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 100% !important;
                        height: 100% !important;
                        margin: 0 !important;
                        padding: 10mm !important;
                        background: white !important;
                    }
                }
            `}} />
        </div>
    );
};

export default PrintPurchaseRequest;
