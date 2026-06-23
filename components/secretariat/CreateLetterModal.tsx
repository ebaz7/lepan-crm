import React, { useState } from 'react';
import { OfficialLetter, SystemSettings, User, LetterStatus, UserRole } from '../../types';
import { formatDate, generateUUID } from '../../constants';
import { X, Save, Plus, Trash2 } from 'lucide-react';
import { saveLetter } from '../../services/storageService';

interface Props {
    currentUser: User;
    settings: SystemSettings | null;
    allUsers: User[];
    onClose: () => void;
    onSuccess: () => void;
}

const CreateLetterModal: React.FC<Props> = ({ currentUser, settings, allUsers, onClose, onSuccess }) => {
    const defaultCompany = settings?.companies?.[0]?.name || 'شرکت پیش فرض';
    const [formData, setFormData] = useState({
        company: defaultCompany,
        branch: 'FACTORY' as 'FACTORY' | 'CENTRAL',
        date: new Date().toLocaleDateString('fa-IR'),
        recipient: '',
        subject: '',
        body: '',
    });

    const [signatures, setSignatures] = useState<{userId: string, userName: string, roleLabel: string}[]>([
        { userId: currentUser.id, userName: currentUser.fullName, roleLabel: 'تهیه کننده' }
    ]);

    const [isSaving, setIsSaving] = useState(false);

    const handleAddSignature = () => {
        setSignatures([...signatures, { userId: '', userName: '', roleLabel: '' }]);
    };

    const handleUpdateSignature = (index: number, field: string, value: string) => {
        const newSigs = [...signatures];
        if (field === 'userId') {
            const user = allUsers.find(u => u.id === value);
            if (user) {
                newSigs[index] = { ...newSigs[index], userId: user.id, userName: user.fullName };
            }
        } else {
            newSigs[index] = { ...newSigs[index], [field]: value } as any;
        }
        setSignatures(newSigs);
    };

    const handleRemoveSignature = (index: number) => {
        if (signatures.length > 1) {
            setSignatures(signatures.filter((_, i) => i !== index));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.recipient || !formData.subject || !formData.body) {
            return alert('لطفا تمام فیلدهای اصلی را پر کنید.');
        }

        // Validate signatures
        const validSigs = signatures.filter(s => s.userId && s.roleLabel);
        if (validSigs.length === 0) return alert('حداقل یک امضاکننده باید تعیین شود.');

        setIsSaving(true);
        const letterNum = Math.floor(1000 + Math.random() * 9000).toString(); // Simple auto number

        const newLetter: OfficialLetter = {
            id: generateUUID(),
            letterNumber: `${formData.branch === 'FACTORY' ? 'F' : 'C'}-${new Date().getFullYear()}-${letterNum}`,
            company: formData.company,
            branch: formData.branch,
            date: formData.date,
            subject: formData.subject,
            recipient: formData.recipient,
            body: formData.body,
            status: LetterStatus.PENDING_SIGNATURE,
            signatures: validSigs.map(s => ({
                id: generateUUID(),
                userId: s.userId,
                userName: s.userName,
                roleLabel: s.roleLabel
            })),
            comments: [],
            createdAt: Date.now(),
            creator: currentUser.id
        };

        // If creator is the only signer, he can auto-sign or we just leave it for him to sign in inbox.
        // Actually, we'll let them sign it in the inbox to use their signature.

        await saveLetter(newLetter);
        setIsSaving(false);
        onSuccess();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-fade-in">
                <div className="p-6 border-b flex justify-between items-center bg-gray-50/50">
                    <div>
                        <h2 className="text-xl font-black text-gray-800">ایجاد نامه جدید (دبیرخانه)</h2>
                    </div>
                    <button onClick={onClose} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors text-gray-500">
                        <X size={20} />
                    </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    <form id="create-letter-form" onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-700">شرکت صادرکننده</label>
                                <select 
                                    className="w-full border rounded-xl px-4 py-2 bg-gray-50 text-gray-800 font-bold" 
                                    value={formData.company} 
                                    onChange={e => setFormData({...formData, company: e.target.value})}
                                >
                                    {settings?.companies?.map(c => <option key={c.id} value={c.name}>{c.name}</option>) || <option value={defaultCompany}>{defaultCompany}</option>}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-700">بخش / شعبه</label>
                                <select 
                                    className="w-full border rounded-xl px-4 py-2 bg-gray-50 text-gray-800 font-bold" 
                                    value={formData.branch} 
                                    onChange={e => setFormData({...formData, branch: e.target.value as 'FACTORY'|'CENTRAL'})}
                                >
                                    <option value="FACTORY">کارخانه</option>
                                    <option value="CENTRAL">دفتر مرکزی</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-700">تاریخ نامه</label>
                                <input type="text" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full border rounded-xl px-4 py-2 bg-gray-50 font-mono" dir="ltr" />
                            </div>
                            
                            <div className="space-y-2 lg:col-span-1 md:col-span-2">
                                <label className="text-sm font-bold text-gray-700">گیرنده</label>
                                <input type="text" value={formData.recipient} onChange={e => setFormData({...formData, recipient: e.target.value})} className="w-full border rounded-xl px-4 py-2 bg-gray-50" placeholder="نام شخص یا سازمان گیرنده..." required />
                            </div>
                            <div className="space-y-2 lg:col-span-2 md:col-span-2">
                                <label className="text-sm font-bold text-gray-700">موضوع نامه</label>
                                <input type="text" value={formData.subject} onChange={e => setFormData({...formData, subject: e.target.value})} className="w-full border rounded-xl px-4 py-2 bg-gray-50" placeholder="موضوع..." required />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-bold text-gray-700">متن نامه</label>
                            <textarea 
                                value={formData.body} 
                                onChange={e => setFormData({...formData, body: e.target.value})} 
                                className="w-full border rounded-xl px-4 py-3 bg-gray-50 min-h-[200px] leading-loose text-justify text-sm shadow-inner" 
                                placeholder="متن اصلی دست‌نویس..." 
                                required
                            />
                        </div>

                        <div className="border-t pt-6 space-y-4">
                            <h3 className="font-black text-gray-800 flex items-center gap-2">تایید کنندگان و امضاها</h3>
                            <div className="bg-gray-50 rounded-2xl p-4 border space-y-3">
                                {signatures.map((sig, idx) => (
                                    <div key={idx} className="flex gap-3 items-end">
                                        <div className="flex-1 space-y-1">
                                            <label className="text-xs text-gray-500">عنوان نقش/سمت (مثلا: مدیرعامل)</label>
                                            <input type="text" value={sig.roleLabel} onChange={e => handleUpdateSignature(idx, 'roleLabel', e.target.value)} className="w-full border rounded-lg px-3 py-1.5 text-sm" placeholder="مثال: مدیرعامل" />
                                        </div>
                                        <div className="flex-2 w-1/2 space-y-1">
                                            <label className="text-xs text-gray-500">شخص امضاکننده</label>
                                            <select value={sig.userId} onChange={e => handleUpdateSignature(idx, 'userId', e.target.value)} className="w-full border rounded-lg px-3 py-1.5 text-sm">
                                                <option value="">انتخاب شخص...</option>
                                                {allUsers.map(u => <option key={u.id} value={u.id}>{u.fullName} {u.role === UserRole.CEO ? '(مدیرعامل)' : ''}</option>)}
                                            </select>
                                        </div>
                                        <button type="button" onClick={() => handleRemoveSignature(idx)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg shrink-0 mb-0.5"><Trash2 size={18}/></button>
                                    </div>
                                ))}
                                <button type="button" onClick={handleAddSignature} className="text-blue-600 text-xs font-bold flex items-center gap-1 hover:bg-blue-50 px-2 py-1 rounded"><Plus size={14}/> افزودن شخص دیگر</button>
                            </div>
                        </div>
                    </form>
                </div>

                <div className="p-6 border-t bg-gray-50/50 flex justify-end gap-3">
                    <button type="button" onClick={onClose} className="px-6 py-2.5 rounded-xl text-gray-600 font-bold hover:bg-gray-200 transition-colors">انصراف</button>
                    <button type="submit" form="create-letter-form" disabled={isSaving} className="px-8 py-2.5 bg-blue-600 text-white font-black rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all flex hidden items-center gap-2">
                        {isSaving ? 'در حال ثبت...' : <><Save size={18} /> ایجاد و ارسال به کارتابل</>}
                    </button>
                    <button type="submit" form="create-letter-form" disabled={isSaving} className="px-8 py-2.5 bg-blue-600 text-white font-black rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all flex items-center gap-2">
                        {isSaving ? 'در حال ثبت...' : <><Save size={18} /> ایجاد و ارسال به مدیران</>}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CreateLetterModal;
