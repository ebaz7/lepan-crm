import React, { useState } from 'react';
import { OfficialLetter, SystemSettings, User, LetterStatus } from '../../types';
import { formatDate } from '../../constants';
import { X, CheckCircle, Edit, MessageSquare, Save, Send } from 'lucide-react';
import PrintLetter from '../print/PrintLetter';
import { updateLetter } from '../../services/storageService';

interface Props {
    letter: OfficialLetter;
    currentUser: User;
    settings: SystemSettings | null;
    onClose: () => void;
    onUpdate: () => void;
}

const LetterViewModal: React.FC<Props> = ({ letter, currentUser, settings, onClose, onUpdate }) => {
    const [showPrint, setShowPrint] = useState(false);
    const [commentText, setCommentText] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const isPendingMySignature = letter.status === LetterStatus.PENDING_SIGNATURE && 
        letter.signatures.some(s => s.userId === currentUser.id && !s.signedAt);

    const handleSign = async () => {
        if (!currentUser.signatureBase64 && !confirm('شما امضای دیجیتال ثبت نکرده‌اید. آیا مایلید فقط با درج نام خود تایید کنید؟')) return;
        
        setIsSaving(true);
        const updatedSignatures = letter.signatures.map(s => {
            if (s.userId === currentUser.id) {
                return { 
                    ...s, 
                    signedAt: Date.now(),
                    signatureBase64: currentUser.signatureBase64
                };
            }
            return s;
        });

        const allSigned = updatedSignatures.every(s => s.signedAt);
        const updatedLetter: OfficialLetter = {
            ...letter,
            signatures: updatedSignatures,
            status: allSigned ? LetterStatus.SIGNED : letter.status
        };

        await updateLetter(updatedLetter);
        setIsSaving(false);
        onUpdate();
        onClose();
    };

    const handleAddComment = async () => {
        if (!commentText.trim()) return;
        setIsSaving(true);
        const newComment = {
            id: Date.now().toString(),
            text: commentText,
            author: currentUser.fullName,
            timestamp: Date.now()
        };
        const updatedLetter: OfficialLetter = {
            ...letter,
            comments: [...(letter.comments || []), newComment]
        };
        await updateLetter(updatedLetter);
        setCommentText('');
        setIsSaving(false);
        onUpdate();
        // keep modal open
        letter.comments = updatedLetter.comments;
    };

    if (showPrint) {
        return <PrintLetter letter={letter} settings={settings} onClose={() => setShowPrint(false)} />;
    }

    return (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm">
            <div className="w-full md:w-[600px] bg-gray-50 h-full shadow-2xl flex flex-col border-l">
                 <div className="p-4 border-b bg-white flex justify-between items-center shrink-0">
                     <div>
                         <h2 className="font-black text-gray-800 tracking-tight text-lg">مشاهده نامه</h2>
                         <p className="text-xs text-gray-500 font-mono mt-1">شماره: {letter.letterNumber}</p>
                     </div>
                     <div className="flex gap-2">
                         <button onClick={() => setShowPrint(true)} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2">
                             چاپ / PDF
                         </button>
                         <button onClick={onClose} className="bg-red-50 text-red-500 p-2 rounded-xl hover:bg-red-100">
                             <X size={20} />
                         </button>
                     </div>
                 </div>

                 <div className="flex-1 overflow-y-auto p-6 space-y-6">
                     <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                         <div className="text-xs text-gray-500 mb-4 flex justify-between">
                             <span>تاریخ: {letter.date}</span>
                             <span>شرکت: {letter.company} ({letter.branch === 'FACTORY' ? 'کارخانه' : 'مرکزی'})</span>
                         </div>
                         <h3 className="font-black text-xl mb-6 text-gray-900 border-b pb-4">موضوع: {letter.subject}</h3>
                         <div className="whitespace-pre-wrap leading-loose text-justify text-gray-700">
                             {letter.body}
                         </div>
                     </div>

                     <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                         <h4 className="font-black text-sm text-gray-800 border-b pb-2 flex items-center gap-2"><Edit size={16}/> وضعیت امضاها</h4>
                         <div className="grid gap-3">
                             {letter.signatures.map(s => (
                                 <div key={s.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                                     <div>
                                         <p className="font-bold text-gray-800 text-sm">{s.roleLabel}</p>
                                         <p className="text-xs text-gray-500">{s.userName}</p>
                                     </div>
                                     <div>
                                         {s.signedAt ? (
                                             <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-lg flex items-center gap-1">
                                                 <CheckCircle size={14}/> تایید شده در {formatDate(s.signedAt)}
                                             </span>
                                         ) : (
                                             <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-lg">
                                                 در انتظار تایید
                                             </span>
                                         )}
                                     </div>
                                 </div>
                             ))}
                         </div>
                     </div>

                     <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                         <h4 className="font-black text-sm text-gray-800 border-b pb-2 flex items-center gap-2"><MessageSquare size={16}/> نظرات و هامش‌ها</h4>
                         <div className="space-y-3">
                             {(!letter.comments || letter.comments.length === 0) && (
                                 <p className="text-sm text-gray-400 italic text-center py-4">بدون نظر</p>
                             )}
                             {letter.comments?.map(c => (
                                 <div key={c.id} className="bg-blue-50/50 p-3 rounded-xl border border-blue-100/50">
                                     <div className="flex justify-between items-center mb-2">
                                         <span className="font-bold text-blue-800 text-xs">{c.author}</span>
                                         <span className="text-[10px] text-gray-400">{formatDate(c.timestamp)}</span>
                                     </div>
                                     <p className="text-sm text-gray-700 whitespace-pre-wrap">{c.text}</p>
                                 </div>
                             ))}
                         </div>
                         <div className="pt-4 border-t mt-4">
                             <div className="flex gap-2">
                                 <input 
                                    type="text" 
                                    value={commentText} 
                                    onChange={e => setCommentText(e.target.value)} 
                                    placeholder="افزودن هامش یا نظر..." 
                                    className="flex-1 border rounded-xl px-3 py-2 text-sm bg-gray-50 focus:bg-white"
                                    onKeyDown={e => { if(e.key === 'Enter') handleAddComment(); }}
                                 />
                                 <button onClick={handleAddComment} disabled={isSaving || !commentText.trim()} className="bg-blue-600 text-white p-2 rounded-xl hover:bg-blue-700 disabled:opacity-50">
                                     <Send size={18}/>
                                 </button>
                             </div>
                         </div>
                     </div>
                 </div>

                 {isPendingMySignature && (
                     <div className="p-4 bg-white border-t shrink-0">
                         <button onClick={handleSign} disabled={isSaving} className="w-full bg-green-600 text-white py-3 rounded-xl font-black text-sm hover:bg-green-700 shadow-lg shadow-green-200 transition-all flex justify-center items-center gap-2">
                             <CheckCircle size={20} /> تایید و امضای نامه
                         </button>
                     </div>
                 )}
            </div>
        </div>
    );
};

export default LetterViewModal;
