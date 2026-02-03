
import React, { useState, useEffect } from 'react';
import { PaymentMethod, OrderStatus, PaymentOrder, PaymentDetail, SystemSettings, UserRole, CompanyBank } from '../types';
import { saveOrder, getNextTrackingNumber, uploadFile, getSettings, saveSettings } from '../services/storageService';
import { enhanceDescription } from '../services/geminiService';
import { apiCall } from '../services/apiService';
import { jalaliToGregorian, getCurrentShamsiDate, formatCurrency, generateUUID, normalizeInputNumber, formatNumberString, deformatNumberString, formatDate } from '../constants';
import { Wand2, Save, Loader2, Plus, Trash2, Paperclip, X, Hash, UploadCloud, Building2, BrainCircuit, AlertTriangle, Calendar, Landmark, CreditCard, Edit, ArrowRightLeft, MapPin, RefreshCcw } from 'lucide-react';
import { getUsers } from '../services/authService';

interface CreateOrderProps {
  onSuccess: () => void;
  currentUser: any;
}

const MONTHS = [ 'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند' ];

const CreateOrder: React.FC<CreateOrderProps> = ({ onSuccess, currentUser }) => {
  const currentShamsi = getCurrentShamsiDate();
  const [shamsiDate, setShamsiDate] = useState({ year: currentShamsi.year, month: currentShamsi.month, day: currentShamsi.day });
  const [formData, setFormData] = useState({ payee: '', description: '', paymentPlace: '' });
  const [trackingNumber, setTrackingNumber] = useState<string>('');
  const [loadingNum, setLoadingNum] = useState(false); 
  const [payingCompany, setPayingCompany] = useState('');
  
  const [availableCompanies, setAvailableCompanies] = useState<string[]>([]);
  const [availableBanks, setAvailableBanks] = useState<string[]>([]); 
  const [paymentLines, setPaymentLines] = useState<PaymentDetail[]>([]);
  
  const [editingLineId, setEditingLineId] = useState<string | null>(null);

  const [newLine, setNewLine] = useState<{ 
      method: PaymentMethod; 
      amount: string; 
      chequeNumber: string; 
      bankName: string; 
      description: string; 
      chequeDate: {y:number, m:number, d:number};
      sheba: string;
      recipientBank: string;
      paymentId: string;
      destinationAccount: string;
      destinationOwner: string;
      destinationBranch: string; 
  }>({ 
      method: PaymentMethod.TRANSFER, 
      amount: '', 
      chequeNumber: '', 
      bankName: '', 
      description: '',
      chequeDate: { year: currentShamsi.year, month: currentShamsi.month, day: currentShamsi.day } as any,
      sheba: '',
      recipientBank: '',
      paymentId: '',
      destinationAccount: '',
      destinationOwner: '',
      destinationBranch: ''
  });
  const [attachments, setAttachments] = useState<{ fileName: string, data: string }[]>([]);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<{score: number, recommendation: string, reasons: string[]} | null>(null);
  const [uploading, setUploading] = useState(false);
  
  const [settings, setSettings] = useState<SystemSettings | null>(null);

  const [showAddBankModal, setShowAddBankModal] = useState(false);
  const [newBankName, setNewBankName] = useState('');
  const [newBankAccount, setNewBankAccount] = useState('');

  const fetchNextNumber = (company?: string) => {
    setLoadingNum(true);
    getNextTrackingNumber(company)
        .then(num => {
            const validNum = (num && num > 0) ? num : 1001;
            setTrackingNumber(validNum.toString());
        })
        .catch(() => {
            setTrackingNumber('1001');
        })
        .finally(() => setLoadingNum(false));
  };

  useEffect(() => {
      fetchNextNumber();
      getSettings().then((s) => {
          setSettings(s);
          const names = s.companies?.map(c => c.name) || s.companyNames || [];
          setAvailableCompanies(names);
          const defCompany = s.defaultCompany || '';
          if (defCompany) {
              setPayingCompany(defCompany);
              updateBanksForCompany(defCompany, s);
              fetchNextNumber(defCompany);
          }
      });
  }, []);

  const updateBanksForCompany = (companyName: string, currentSettings: SystemSettings) => {
      const company = currentSettings.companies?.find(c => c.name === companyName);
      if (company && company.banks && company.banks.length > 0) {
          setAvailableBanks(company.banks.map(b => `${b.bankName}${b.accountNumber ? ` - ${b.accountNumber}` : ''}`));
      } else {
          setAvailableBanks([]); 
      }
  };

  const handleCompanyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newVal = e.target.value;
      setPayingCompany(newVal);
      if (settings) updateBanksForCompany(newVal, settings);
      setNewLine(prev => ({ ...prev, bankName: '' })); 
      fetchNextNumber(newVal);
  };

  const openAddBankModal = () => {
      if (!payingCompany) return alert('لطفا ابتدا شرکت پرداخت کننده را انتخاب کنید.');
      setShowAddBankModal(true);
  };

  const handleSaveNewBank = async () => {
      if (!newBankName.trim()) return alert('نام بانک الزامی است.');
      if (!settings) return;
      const newBankObj: CompanyBank = { id: generateUUID(), bankName: newBankName.trim(), accountNumber: newBankAccount.trim() };
      const comboName = `${newBankObj.bankName}${newBankObj.accountNumber ? ` - ${newBankObj.accountNumber}` : ''}`;
      const updatedCompanies = (settings.companies || []).map(c => {
          if (c.name === payingCompany) { return { ...c, banks: [...(c.banks || []), newBankObj] }; }
          return c;
      });
      const newSettings = { ...settings, companies: updatedCompanies };
      try {
          await saveSettings(newSettings);
          setSettings(newSettings);
          setAvailableBanks(prev => [...prev, comboName]);
          setNewLine(prev => ({ ...prev, bankName: comboName }));
          setShowAddBankModal(false);
      } catch (e) { alert('خطا در ذخیره بانک جدید'); }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => { 
      if (e.key === 'Enter' && !e.shiftKey) { 
          e.preventDefault(); 
      } 
  };
  
  const getIsoDate = () => { 
      try { 
          const date = jalaliToGregorian(shamsiDate.year, shamsiDate.month, shamsiDate.day); 
          return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; 
      } catch (e) { return new Date().toISOString().split('T')[0]; } 
  };
  
  const handleEnhance = async () => { if (!formData.description) return; setIsEnhancing(true); const improved = await enhanceDescription(formData.description); setFormData(p => ({ ...p, description: improved })); setIsEnhancing(false); };
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (!file) return; setUploading(true); const reader = new FileReader(); reader.onload = async (ev) => { try { const result = await uploadFile(file.name, ev.target?.result as string); setAttachments([...attachments, { fileName: result.fileName, data: result.url }]); } catch (e) { alert('خطا در آپلود (404/500)'); } finally { setUploading(false); } }; reader.readAsDataURL(file); e.target.value = ''; };
  const removeAttachment = (index: number) => { setAttachments(attachments.filter((_, i) => i !== index)); };
  
  const addPaymentLine = () => { 
      const amt = deformatNumberString(newLine.amount); 
      if (!amt) return; 
      const detail: PaymentDetail = { 
          id: editingLineId || generateUUID(), method: newLine.method, amount: amt, 
          chequeNumber: newLine.method === PaymentMethod.CHEQUE ? normalizeInputNumber(newLine.chequeNumber) : undefined, 
          bankName: (newLine.method === PaymentMethod.TRANSFER || newLine.method === PaymentMethod.CHEQUE || newLine.method === PaymentMethod.SHEBA || newLine.method === PaymentMethod.SATNA || newLine.method === PaymentMethod.INTERNAL_TRANSFER) ? newLine.bankName : undefined, 
          description: newLine.description, 
          chequeDate: newLine.method === PaymentMethod.CHEQUE ? `${newLine.chequeDate.y}/${newLine.chequeDate.m}/${newLine.chequeDate.d}` : undefined,
          sheba: (newLine.method === PaymentMethod.SHEBA || newLine.method === PaymentMethod.SATNA || newLine.method === PaymentMethod.PAYA) ? normalizeInputNumber(newLine.sheba).replace(/[^0-9]/g, '') : undefined,
          recipientBank: (newLine.method === PaymentMethod.SHEBA || newLine.method === PaymentMethod.SATNA || newLine.method === PaymentMethod.PAYA) ? newLine.recipientBank : undefined,
          paymentId: (newLine.method === PaymentMethod.SHEBA || newLine.method === PaymentMethod.SATNA || newLine.method === PaymentMethod.PAYA) ? newLine.paymentId : undefined,
          destinationOwner: (newLine.method === PaymentMethod.INTERNAL_TRANSFER || newLine.method === PaymentMethod.SHEBA || newLine.method === PaymentMethod.SATNA || newLine.method === PaymentMethod.PAYA) ? newLine.destinationOwner : undefined,
          destinationAccount: newLine.method === PaymentMethod.INTERNAL_TRANSFER ? normalizeInputNumber(newLine.destinationAccount) : undefined,
          destinationBranch: newLine.method === PaymentMethod.INTERNAL_TRANSFER ? newLine.destinationBranch : undefined,
      }; 
      if (editingLineId) { setPaymentLines(paymentLines.map(p => p.id === editingLineId ? detail : p)); setEditingLineId(null); } 
      else { setPaymentLines([...paymentLines, detail]); }
      setNewLine({ method: PaymentMethod.TRANSFER, amount: '', chequeNumber: '', bankName: '', description: '', chequeDate: { year: currentShamsi.year, month: currentShamsi.month, day: currentShamsi.day } as any, sheba: '', recipientBank: '', paymentId: '', destinationAccount: '', destinationOwner: '', destinationBranch: '' }); 
  };

  const handleAnalyzePayment = async () => { setAnalyzing(true); try { const result = await apiCall<any>('/analyze-payment', 'POST', { amount: paymentLines.reduce((a,b)=>a+b.amount,0), date: getIsoDate(), company: payingCompany, description: formData.description }); setAnalysisResult(result); } catch (e) { alert("خطا"); } finally { setAnalyzing(false); } };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (paymentLines.length === 0) { alert("لطفا حداقل یک روش پرداخت اضافه کنید."); return; }
    setIsSubmitting(true);
    try { 
        const newOrder: PaymentOrder = { 
            id: generateUUID(), trackingNumber: Number(trackingNumber), date: getIsoDate(), payee: formData.payee, totalAmount: paymentLines.reduce((a,b)=>a+b.amount,0), description: formData.description, status: OrderStatus.PENDING, requester: currentUser.fullName, createdAt: Date.now(), paymentDetails: paymentLines, attachments: attachments, payingCompany: payingCompany, paymentPlace: formData.paymentPlace
        };
        await saveOrder(newOrder); 
        onSuccess(); 
    } catch (error) { alert("خطا در ثبت دستور پرداخت. 404 (سرویس یافت نشد)"); setIsSubmitting(false); }
  };

  const years = Array.from({ length: 11 }, (_, i) => 1400 + i);
  const days = Array.from({ length: 31 }, (_, i) => i + 1);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden animate-fade-in relative">
        {showAddBankModal && (
            <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5 animate-scale-in">
                    <div className="flex justify-between items-center mb-4 border-b pb-2"><h3 className="font-bold text-gray-800 flex items-center gap-2"><Landmark size={18}/> افزودن بانک</h3><button onClick={() => setShowAddBankModal(false)}><X size={20}/></button></div>
                    <div className="space-y-3">
                        <input className="w-full border rounded-lg p-2 text-sm" placeholder="نام بانک" value={newBankName} onChange={e => setNewBankName(e.target.value)} />
                        <input className="w-full border rounded-lg p-2 text-sm dir-ltr" placeholder="شماره حساب" value={newBankAccount} onChange={e => setNewBankAccount(e.target.value)} />
                        <button onClick={handleSaveNewBank} className="w-full py-2 rounded-lg bg-blue-600 text-white font-bold">ذخیره</button>
                    </div>
                </div>
            </div>
        )}

        <div className="p-6 border-b border-gray-100 flex items-center gap-3"><div className="bg-green-50 p-2 rounded-lg text-green-600"><Plus size={24} /></div><h2 className="text-xl font-bold text-gray-800">ثبت دستور پرداخت جدید</h2></div>
        <form onSubmit={handleSubmit} className="p-6 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="space-y-2"><label className="text-sm font-medium text-gray-700 flex items-center gap-2"><Building2 size={16}/> شرکت پرداخت کننده</label><select className="w-full border border-gray-300 rounded-xl px-4 py-3 bg-white" value={payingCompany} onChange={handleCompanyChange} required><option value="">-- انتخاب --</option>{availableCompanies.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                <div className="space-y-2"><label className="text-sm font-medium text-gray-700 flex items-center gap-2"><Hash size={16}/> شماره دستور پرداخت</label><div className="relative"><input required type="number" className="w-full border border-gray-300 rounded-xl px-4 py-3 bg-gray-50 font-mono font-bold text-blue-600 dir-ltr text-left" value={trackingNumber} onChange={e => setTrackingNumber(e.target.value)} /><button type="button" onClick={() => fetchNextNumber(payingCompany)} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-blue-500"><RefreshCcw size={16} className={loadingNum ? 'animate-spin' : ''}/></button></div></div>
                <div className="space-y-2"><label className="text-sm font-medium text-gray-700 flex items-center gap-2"><MapPin size={16}/> محل پرداخت (شهر/شعبه)</label><input type="text" className="w-full border border-gray-300 rounded-xl px-4 py-3" placeholder="مثال: تهران - شعبه مرکزی" value={formData.paymentPlace} onChange={e => setFormData({ ...formData, paymentPlace: e.target.value })} /></div>
                <div className="space-y-2 md:col-span-2 lg:col-span-1"><label className="text-sm font-medium text-gray-700">گیرنده وجه (ذینفع)</label><input required type="text" className="w-full border border-gray-300 rounded-xl px-4 py-3" placeholder="نام شخص یا شرکت..." value={formData.payee} onChange={e => setFormData({ ...formData, payee: e.target.value })} /></div>
                <div className="space-y-2 md:col-span-2"><label className="text-sm font-medium text-gray-700 flex items-center gap-2"><Calendar size={16} />تاریخ پرداخت (شمسی)</label><div className="grid grid-cols-3 gap-2"><select className="border border-gray-300 rounded-xl px-2 py-3 bg-white" value={shamsiDate.day} onChange={e => setShamsiDate({...shamsiDate, day: Number(e.target.value)})}>{days.map(d => <option key={d} value={d}>{d}</option>)}</select><select className="border border-gray-300 rounded-xl px-2 py-3 bg-white" value={shamsiDate.month} onChange={e => setShamsiDate({...shamsiDate, month: Number(e.target.value)})}>{MONTHS.map((m, idx) => <option key={idx} value={idx + 1}>{m}</option>)}</select><select className="border border-gray-300 rounded-xl px-2 py-3 bg-white" value={shamsiDate.year} onChange={e => setShamsiDate({...shamsiDate, year: Number(e.target.value)})}>{years.map(y => <option key={y} value={y}>{y}</option>)}</select></div></div>
            </div>
            
            <div className="space-y-2"><div className="flex justify-between items-center"><label className="text-sm font-bold text-gray-700">شرح پرداخت</label><button type="button" onClick={handleEnhance} disabled={isEnhancing || !formData.description} className="text-xs flex items-center gap-1.5 text-purple-600 bg-purple-50 px-3 py-1.5 rounded-lg">{isEnhancing ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}بهبود متن</button></div><textarea required rows={4} className="w-full border border-gray-300 rounded-xl px-4 py-3 resize-none" placeholder="توضیحات..." value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} /></div>

            <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200">
                <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-gray-700">روش‌های پرداخت</h3><div className="text-sm text-gray-500 bg-white px-3 py-1 rounded-lg border">جمع کل: <span className="font-bold text-blue-600 font-mono">{formatCurrency(paymentLines.reduce((acc,curr)=>acc+curr.amount,0))}</span></div></div>
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end mb-4 bg-white p-4 rounded-xl border">
                    <div className="md:col-span-2 space-y-1"><label className="text-xs text-gray-500">نوع</label><select className="w-full border rounded-lg p-2 text-sm bg-white" value={newLine.method} onChange={e => setNewLine({ ...newLine, method: e.target.value as PaymentMethod })}><option value={PaymentMethod.TRANSFER}>{PaymentMethod.TRANSFER}</option><option value={PaymentMethod.CHEQUE}>{PaymentMethod.CHEQUE}</option><option value={PaymentMethod.SHEBA}>{PaymentMethod.SHEBA}</option><option value={PaymentMethod.INTERNAL_TRANSFER}>{PaymentMethod.INTERNAL_TRANSFER}</option></select></div>
                    <div className="md:col-span-4 space-y-1"><label className="text-xs text-gray-500">مبلغ (ریال)</label><input type="text" className="w-full border rounded-lg p-2 text-sm dir-ltr font-bold" value={formatNumberString(newLine.amount)} onChange={e => setNewLine({ ...newLine, amount: normalizeInputNumber(e.target.value).replace(/[^0-9]/g, '') })} /></div>
                    <div className="md:col-span-5 space-y-1"><label className="text-xs text-gray-500">بانک مبدا / مشخصات</label><div className="flex gap-1"><select className="w-full border rounded-lg p-2 text-sm bg-white" value={newLine.bankName} onChange={e => setNewLine({ ...newLine, bankName: e.target.value })}><option value="">-- انتخاب --</option>{availableBanks.map(b => <option key={b} value={b}>{b}</option>)}</select><button type="button" onClick={openAddBankModal} className="bg-blue-100 text-blue-600 rounded-lg px-2"><Plus size={16}/></button></div></div>
                    <div className="md:col-span-1"><button type="button" onClick={addPaymentLine} className="w-full bg-blue-600 text-white p-2 rounded-lg"><Plus size={20}/></button></div>
                </div>
                <div className="space-y-2">{paymentLines.map((line) => (<div key={line.id} className="flex items-center justify-between bg-white p-4 rounded-xl border"><div><span className="font-bold ml-4">{line.method}</span><span className="text-blue-600 font-bold font-mono">{formatCurrency(line.amount)}</span></div><button type="button" onClick={() => setPaymentLines(paymentLines.filter(p=>p.id!==line.id))} className="text-red-400"><Trash2 size={18}/></button></div>))}</div>
            </div>

            <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200">
                <label className="text-sm font-bold text-gray-700 mb-3 block flex items-center gap-2"><Paperclip size={18} />ضمیمه‌ها</label>
                <input type="file" id="attachment" className="hidden" accept="image/*,application/pdf" onChange={handleFileChange} disabled={uploading}/>
                <label htmlFor="attachment" className="bg-white border-2 border-dashed border-gray-300 text-gray-600 px-6 py-3 rounded-xl cursor-pointer hover:border-blue-500 flex items-center gap-2 text-sm font-medium">{uploading ? <Loader2 size={18} className="animate-spin"/> : <UploadCloud size={18}/>} انتخاب فایل</label>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">{attachments.map((file, idx) => (<div key={idx} className="flex items-center justify-between bg-white p-3 rounded-xl border text-sm"><span>{file.fileName}</span><button type="button" onClick={() => removeAttachment(idx)}><X size={16} /></button></div>))}</div>
            </div>
            
            <button type="submit" disabled={isSubmitting || uploading} className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2">{isSubmitting ? <Loader2 size={24} className="animate-spin" /> : <Save size={24} />}ثبت نهایی دستور پرداخت</button>
        </form>
    </div>
  );
};
export default CreateOrder;
