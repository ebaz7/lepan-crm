import React, { useRef } from 'react';
import { PurchaseRequest } from '../types';
import { formatDate } from '../constants';

interface Props {
    request: PurchaseRequest;
}

const PrintPurchaseRequest: React.FC<Props> = ({ request }) => {
    return (
        <div className="bg-white p-8 w-full max-w-[800px] mx-auto text-black print-only-section" dir="rtl" style={{ direction: 'rtl' }}>
            <div className="border-2 border-black p-4 mb-4 flex justify-between items-center text-center">
                <div className="w-1/3 text-right">
                    <p className="text-sm font-bold">شماره درخواست: {request.requestNumber}</p>
                    <p className="text-sm font-bold">تاریخ درخواست: {formatDate(request.date)}</p>
                </div>
                <div className="w-1/3">
                    <h2 className="text-lg font-black underline">فرم درخواست خرید کالا</h2>
                </div>
                <div className="w-1/3 text-left">
                    <p className="text-sm font-bold">درخواست کننده: {request.requester}</p>
                </div>
            </div>

            <table className="w-full border-collapse border border-black mb-4">
                <thead>
                    <tr className="bg-gray-200">
                        <th className="border border-black p-2 font-bold text-sm">ردیف</th>
                        <th className="border border-black p-2 font-bold text-sm">شرح کالا</th>
                        <th className="border border-black p-2 font-bold text-sm">گروه/زیرگروه</th>
                        <th className="border border-black p-2 font-bold text-sm">مشخصات فنی</th>
                        <th className="border border-black p-2 font-bold text-sm">مقدار</th>
                        <th className="border border-black p-2 font-bold text-sm">واحد</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td className="border border-black p-2 text-center text-sm">۱</td>
                        <td className="border border-black p-2 text-center text-sm font-bold">{request.itemName}</td>
                        <td className="border border-black p-2 text-center text-sm">{request.category}{request.subCategory ? ` / ${request.subCategory}` : ''}</td>
                        <td className="border border-black p-2 text-center text-sm max-w-[200px] whitespace-pre-wrap">{request.specifications || '-'}</td>
                        <td className="border border-black p-2 text-center text-sm">{request.quantity}</td>
                        <td className="border border-black p-2 text-center text-sm">{request.unit}</td>
                    </tr>
                </tbody>
            </table>

            {request.entryQuantity && (
                <div className="border border-black p-4 mb-4">
                    <h3 className="font-bold underline mb-2">رسید ورود کالا (انتظامات / انبار)</h3>
                    <div className="flex justify-between">
                        <span className="text-sm font-bold">مقدار ورودی: {request.entryQuantity} {request.unit}</span>
                        <span className="text-sm font-bold">وزن ورودی: {request.entryWeight ? `${request.entryWeight} کیلوگرم` : '-'}</span>
                        <span className="text-sm font-bold">زمان ورود: {request.entryTime || '-'}</span>
                    </div>
                </div>
            )}

            <div className="border border-black p-4 mb-4 grid grid-cols-4 gap-4 text-center">
                <div>
                    <h4 className="text-sm font-bold mb-8">درخواست کننده</h4>
                    <p className="text-xs">{request.requester}</p>
                </div>
                <div>
                    <h4 className="text-sm font-bold mb-8">تایید فنی</h4>
                    <p className="text-xs">{request.approverTechnical || '-'}</p>
                </div>
                <div>
                    <h4 className="text-sm font-bold mb-8">تایید مدیر کارخانه</h4>
                    <p className="text-xs">{request.approverFactory || '-'}</p>
                </div>
                <div>
                    <h4 className="text-sm font-bold mb-8">تایید مدیرعامل</h4>
                    <p className="text-xs">{request.approverCeo || '-'}</p>
                </div>
            </div>
            
            <style dangerouslySetInnerHTML={{__html: `
                @media print {
                    @page { size: A5 landscape; margin: 0; }
                    html, body { height: 100%; overflow: hidden !important; }
                    body * { visibility: hidden !important; }
                    .print-only-section, .print-only-section * { visibility: visible !important; }
                    .print-only-section { 
                        position: absolute !important; 
                        left: 0 !important; 
                        top: 0 !important; 
                        right: 0 !important; 
                        bottom: 0 !important; 
                        padding: 10mm !important; 
                        margin: 0 !important; 
                        width: 210mm !important; 
                        height: 148mm !important;
                        background: white !important;
                        z-index: 99999 !important;
                    }
                }
            `}} />
        </div>
    );
}

export default PrintPurchaseRequest;
