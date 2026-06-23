import React, { useEffect, useRef, useState } from 'react';
import { OfficialLetter, SystemSettings, User } from '../../types';
import { formatDate } from '../../constants';

interface Props {
    letter: OfficialLetter;
    settings: SystemSettings | null;
    onClose: () => void;
    showPrintButton?: boolean;
}

const PrintLetter: React.FC<Props> = ({ letter, settings, onClose, showPrintButton = true }) => {
    const printRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);

    useEffect(() => {
        const handleResize = () => {
            const container = document.getElementById('letter-print-wrapper');
            if (container && printRef.current) {
                const containerWidth = container.offsetWidth;
                const printWidth = printRef.current.offsetWidth;
                if (containerWidth < printWidth) {
                    setScale(containerWidth / printWidth);
                } else {
                    setScale(1);
                }
            }
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const companyConfig = settings?.companies?.find(c => c.name === letter.company) || settings?.companies?.[0];

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="fixed inset-0 z-50 bg-gray-900/90 backdrop-blur-sm overflow-y-auto print:bg-white print:overflow-visible">
            <div className="min-h-screen py-10 print:py-0" id="letter-print-wrapper">
                <div className="max-w-4xl mx-auto flex justify-between items-center mb-6 print:hidden px-4">
                    <button onClick={onClose} className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl transition-colors font-medium">بستن</button>
                    {showPrintButton && (
                        <button onClick={handlePrint} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-xl font-bold tracking-wide shadow-lg transition-transform active:scale-95">پرینت / PDF</button>
                    )}
                </div>

                <div 
                    ref={printRef}
                    className="bg-white mx-auto shadow-2xl relative text-gray-900 flex flex-col print:shadow-none print:m-0" 
                    style={{ 
                        direction: 'rtl', 
                        width: '210mm', 
                        minHeight: '297mm', 
                        transform: `scale(${scale})`, 
                        transformOrigin: 'top center',
                        padding: '20mm'
                    }}
                >
                    {/* Header: Letterhead */}
                    <div className="flex justify-between items-start border-b-2 border-gray-800 pb-6 mb-8">
                        <div className="flex items-center gap-4">
                            {companyConfig?.logo && <img src={companyConfig.logo} alt="Logo" className="w-20 h-20 object-contain" />}
                            <div>
                                <h1 className="text-2xl font-black">{letter.company}</h1>
                                <p className="text-sm font-bold text-gray-600">{letter.branch === 'FACTORY' ? 'کارخانه' : 'دفتر مرکزی'}</p>
                            </div>
                        </div>
                        <div className="text-left font-mono text-sm space-y-1">
                            <p><span className="font-bold font-sans">شماره نامه:</span> {letter.letterNumber}</p>
                            <p><span className="font-bold font-sans">تاریخ:</span> {letter.date}</p>
                            <p><span className="font-bold font-sans">پیوست:</span> {letter.attachments?.length ? 'دارد' : 'ندارد'}</p>
                        </div>
                    </div>

                    {/* Metadata */}
                    <div className="mb-10 space-y-2 text-lg">
                        <div className="flex gap-2">
                            <span className="font-bold">به: </span>
                            <span className="font-medium">{letter.recipient}</span>
                        </div>
                        <div className="flex gap-2">
                            <span className="font-bold">موضوع: </span>
                            <span className="font-black text-xl">{letter.subject}</span>
                        </div>
                    </div>

                    {/* Body */}
                    <div className="flex-1 whitespace-pre-wrap text-justify leading-loose text-lg mb-12">
                        {letter.body}
                    </div>

                    {/* Signatures */}
                    <div className="mt-auto pt-8 border-t border-gray-200">
                        <div className="flex justify-end gap-12">
                            {letter.signatures.map((sig, idx) => (
                                <div key={idx} className="flex flex-col items-center justify-between min-h-[120px] w-48 relative">
                                    {sig.signatureBase64 ? (
                                        <img src={sig.signatureBase64} alt={sig.userName} className="h-20 object-contain mix-blend-multiply" />
                                    ) : (
                                        sig.signedAt ? <span className="font-bold text-gray-800 mt-8">{sig.userName}</span> : <span className="text-gray-300 italic mt-8 text-sm">امضا نشده</span>
                                    )}
                                    <div className="mt-4 border-t border-gray-400 pt-2 text-center w-full">
                                        <div className="font-black text-sm">{sig.roleLabel}</div>
                                        {!sig.signatureBase64 && sig.userName && <div className="text-xs text-gray-500 mt-1">{sig.userName}</div>}
                                        {sig.signedAt && <div className="text-[10px] text-gray-400 mt-1">{formatDate(sig.signedAt)}</div>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Footer / Address */}
                    <div className="mt-8 pt-4 border-t-2 border-gray-800 text-center text-[10px] text-gray-600">
                         {settings?.reportSettings?.footerText || `آدرس: ${letter.company} | تلفن: ...`}
                    </div>

                    <style>{`
                        @page { size: A4 portrait; margin: 0; }
                        @media print {
                           body * { visibility: hidden; }
                           #letter-print-wrapper, #letter-print-wrapper * { visibility: visible; }
                           #letter-print-wrapper { position: absolute; left: 0; top: 0; transform: none !important; margin: 0 !important; width: 100% !important; background: white; }
                           button { display: none !important; }
                           .print\:hidden { display: none !important; }
                        }
                    `}</style>
                </div>
            </div>
        </div>
    );
}

export default PrintLetter;
