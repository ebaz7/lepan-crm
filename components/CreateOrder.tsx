
import React, { useState, useEffect } from 'react';
import { PaymentMethod, OrderStatus, PaymentOrder, PaymentDetail, SystemSettings, UserRole, CompanyBank } from '../types';
import { saveOrder, getNextTrackingNumber, uploadFile, getSettings, saveSettings } from '../services/storageService';
import { enhanceDescription } from '../services/geminiService';
import { apiCall } from '../services/apiService';
import { jalaliToGregorian, getCurrentShamsiDate, formatCurrency, generateUUID, normalizeInputNumber, formatNumberString, deformatNumberString, formatDate } from '../constants';
import { Wand2, Save, Loader2, Plus, Trash2, Paperclip, X, Hash, UploadCloud, Building2, BrainCircuit, AlertTriangle, Calendar, Landmark, CreditCard, Edit, ArrowRightLeft, MapPin, RefreshCcw } from 'lucide-react';

interface CreateOrderProps {
  onSuccess: () => void;
  currentUser: any;
}

const MONTHS = [ 'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند' ];

const CreateOrder: React.FC<CreateOrderProps> = ({ onSuccess, currentUser }) => {
  const currentShamsi = getCurrentShamsiDate();
  const [shamsiDate, setShamsiDate] = useState({ year: currentShamsi.year, month: currentShamsi.month, day: currentShamsi.day });
  const [formData, setFormData] = useState({ payee: '', description: '', });
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
  const [uploading, setUploading] = useState(false);
  
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [showAddBankModal, setShowAddBankModal] = useState(false);
  const [newBankName, setNewBankName] = useState('');
  const [newBankAccount, setNewBankAccount] = useState('');

  // Function to fetch next number - EXPLICITLY PER COMPANY
  const fetchNextNumber = (company?: string) => {
    if (!company) return;
    setLoadingNum(true);
    // Fetch from API to get the absolute next number
    apiCall<{ nextTrackingNumber: number }>(`/next-tracking-number?company=${encodeURIComponent(company)}&t=${Date.now()}`)
        .then(res => {
            if (res && res.nextTrackingNumber) {
                setTrackingNumber(res.nextTrackingNumber.toString());
            }
        })
        .catch((e) => {
            console.error("Fetch Number Error", e);
        })
        .finally(() => setLoadingNum(false));
  };

  useEffect(() => {
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
      // AUTO LOAD NUMBER
      fetchNextNumber(newVal);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => { 
      if (e.key === 'Enter' && !e.shiftKey) { 
          e.preventDefault(); 
          const form = e.currentTarget.form; 
          if (!form) return; 
          const index = Array.prototype.indexOf.call(form, e.currentTarget); 
          const nextElement = form.elements[index + 1] as HTMLElement; 
          if (nextElement) nextElement.focus(); 
      } 
  };
  
  const getIsoDate = () => { 
      try { 
          const date = jalaliToGregorian(shamsiDate.year, shamsiDate.month, shamsiDate.day); 
          if (isNaN(date.getTime())) throw new Error("Invalid Date");
          const y = date.getFullYear(); 
          const m = String(date.getMonth() + 1).padStart(2, '0'); 
          const d = String(date.getDate()).padStart(2, '0'); 
          return `${y}-${m}-${d}`; 
      } catch (e) { 
          const now = new Date(); 
          return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`; 
      } 
  };
  
  const addPaymentLine = () => { 
      const amt = deformatNumberString(newLine.amount); 
      if (!amt) return; 
      
      const detail: PaymentDetail = { 
          id: editingLineId || generateUUID(), 
          method: newLine.method, 
          amount: amt, 
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
      
      if (editingLineId) {
          setPaymentLines(paymentLines.map(p => p.id === editingLineId ? detail : p));
          setEditingLineId(null);
      } else {
          setPaymentLines([...paymentLines, detail]); 
          if(newLine.description) {
              setFormData(p => ({
                  ...p, 
                  description: p.description ? `${p.description} - ${newLine.description}` : newLine.description
              }));
          }
      }
      
      setNewLine({ 
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
  };

  const handleEditLine = (line: PaymentDetail) => {
      let cDate = { year: currentShamsi.year, month: currentShamsi.month, day: currentShamsi.day };
      if (line.chequeDate) {
          const parts = line.chequeDate.split('/');
          if (parts.length === 3) {
              cDate = { year: parseInt(parts[0]), month: parseInt(parts[1]), day: parseInt(parts[2]) };
          }
      }

      setNewLine({
          method: line.method,
          amount: formatNumberString(line.amount),
          chequeNumber: line.chequeNumber || '',
          bankName: line.bankName || '',
          description: line.description || '',
          chequeDate: cDate as any,
          sheba: line.sheba || '',
          recipientBank: line.recipientBank || '',
          paymentId: line.paymentId || '',
          destinationAccount: line.destinationAccount || '',
          destinationOwner: line.destinationOwner || '',
          destinationBranch: line.destinationBranch || ''
      });
      setEditingLineId(line.id);
  };

  const removePaymentLine = (id: string) => { setPaymentLines(paymentLines.filter(p => p.id !== id)); if(editingLineId === id) setEditingLineId(null); };
  const sumPaymentLines = paymentLines.reduce((acc, curr) => acc + curr.amount, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (paymentLines.length === 0) { alert("لطفا حداقل یک روش پرداخت اضافه کنید."); return; }
    if (!payingCompany) { alert("انتخاب شرکت الزامی است."); return; }
    if (!trackingNumber) { alert("شماره دستور پرداخت یافت نشد."); return; }
    
    setIsSubmitting(true);
    try { 
        const newOrder: PaymentOrder = { 
            id: generateUUID(), 
            trackingNumber: parseInt(trackingNumber) || 0, 
            date: getIsoDate(), 
            payee: formData.payee, 
            totalAmount: sumPaymentLines, 
            description: formData.description, 
            status: OrderStatus.PENDING, 
            requester: currentUser.fullName, 
            createdAt: Date.now(), 
            paymentDetails: paymentLines, 
            attachments: attachments, 
            payingCompany: payingCompany,
        };
        await saveOrder(newOrder); 
        
        const event = new CustomEvent('QUEUE_WHATSAPP_JOB', { 
            detail: { order: newOrder, type: 'create' } 
        });
        window.dispatchEvent(event);

        onSuccess(); 

    } catch (error) { 
        alert("خطا در ثبت دستور پرداخت."); 
        setIsSubmitting(false);
    }
  };

  const years = Array.from({ length: 11 }, (_, i) => 1400 + i);
  const days = Array.from({ length: 31 }, (_, i) => i + 1);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden animate-fade-in relative">
        <div className="p-6 border-b border-gray-100 flex items-center gap-3">
          <div className="bg-green-50 p-2 rounded-lg text-green-600"><Plus size={24} /></div>
          <h2 className="text-xl font-bold text-gray-800">ثبت دستور پرداخت جدید</h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-2"><Building2 size={16}/> شرکت پرداخت کننده</label>
                  <select required className="w-full border border-gray-300 rounded-xl px-4 py-3 bg-white" value={payingCompany} onChange={handleCompanyChange} onKeyDown={handleKeyDown}>
                    <option value="">-- انتخاب کنید --</option>
                    {availableCompanies.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 flex items-center gap-2"><Hash size={16}/> شماره دستور پرداخت</label>
                    <div className="relative">
                        <input 
                            required 
                            type="number" 
                            className="w-full border border-gray-300 rounded-xl px-4 py-3 bg-gray-50 font-mono font-bold text-blue-600 dir-ltr text-left" 
                            value={trackingNumber} 
                            onChange={e => setTrackingNumber(e.target.value)} 
                            onKeyDown={handleKeyDown}
                            placeholder={loadingNum ? "در حال دریافت..." : "منتظر انتخاب شرکت..."}
                        />
                        {loadingNum && <div className="absolute left-3 top-1/2 -translate-y-1/2"><Loader2 size={16} className="animate-spin text-blue-500"/></div>}
                        <button 
                            type="button"
                            onClick={() => fetchNextNumber(payingCompany)} 
                            disabled={loadingNum || !payingCompany}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-white rounded-full text-blue-500 hover:bg-blue-50 transition-colors shadow-sm"
                        >
                            <RefreshCcw size={16} className={loadingNum ? 'animate-spin' : ''}/>
                        </button>
                    </div>
                </div>
                <div className="space-y-2"><label className="text-sm font-medium text-gray-700">گیرنده وجه (ذینفع)</label><input required type="text" className="w-full border border-gray-300 rounded-xl px-4 py-3" placeholder="نام شخص یا شرکت..." value={formData.payee} onChange={e => setFormData({ ...formData, payee: e.target.value })} onKeyDown={handleKeyDown} /></div>
                <div className="space-y-2"><label className="text-sm font-medium text-gray-700 flex items-center gap-2"><Calendar size={16} />تاریخ پرداخت (شمسی)</label><div className="grid grid-cols-3 gap-2"><select className="border border-gray-300 rounded-xl px-2 py-3 bg-white" value={shamsiDate.day} onChange={e => setShamsiDate({...shamsiDate, day: Number(e.target.value)})}>{days.map(d => <option key={d} value={d}>{d}</option>)}</select><select className="border border-gray-300 rounded-xl px-2 py-3 bg-white" value={shamsiDate.month} onChange={e => setShamsiDate({...shamsiDate, month: Number(e.target.value)})}>{MONTHS.map((m, idx) => <option key={idx} value={idx + 1}>{m}</option>)}</select><select className="border border-gray-300 rounded-xl px-2 py-3 bg-white" value={shamsiDate.year} onChange={e => setShamsiDate({...shamsiDate, year: Number(e.target.value)})}>{years.map(y => <option key={y} value={y}>{y}</option>)}</select></div></div>
            </div>
            
            <div className="space-y-2"><label className="text-sm font-bold text-gray-700">شرح پرداخت</label><textarea required rows={4} className="w-full border border-gray-300 rounded-xl px-4 py-3 resize-none" placeholder="توضیحات کامل دستور پرداخت..." value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} onKeyDown={handleKeyDown} /></div>

            <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-gray-700">روش‌های پرداخت</h3>
                    <div className="text-sm text-gray-500 bg-white px-3 py-1 rounded-lg border">جمع کل: <span className="font-bold text-blue-600 font-mono">{formatCurrency(sumPaymentLines)}</span></div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end mb-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                    <div className="md:col-span-2 space-y-1">
                        <label className="text-xs text-gray-500">نوع</label>
                        <select className="w-full border rounded-lg p-2 text-sm bg-white" value={newLine.method} onChange={e => setNewLine({ ...newLine, method: e.target.value as PaymentMethod })}>
                            <option value={PaymentMethod.TRANSFER}>{PaymentMethod.TRANSFER}</option>
                            <option value={PaymentMethod.CHEQUE}>{PaymentMethod.CHEQUE}</option>
                            <option value={PaymentMethod.SHEBA}>{PaymentMethod.SHEBA}</option> 
                            <option value={PaymentMethod.INTERNAL_TRANSFER}>{PaymentMethod.INTERNAL_TRANSFER}</option>
                            <option value={PaymentMethod.CASH}>{PaymentMethod.CASH}</option>
                        </select>
                    </div>
                    <div className="md:col-span-3 space-y-1"><label className="text-xs text-gray-500">مبلغ (ریال)</label><input type="text" inputMode="numeric" className="w-full border rounded-lg p-2 text-sm dir-ltr text-left font-mono font-bold" placeholder="0" value={formatNumberString(newLine.amount)} onChange={e => setNewLine({ ...newLine, amount: normalizeInputNumber(e.target.value).replace(/[^0-9]/g, '') })} onKeyDown={handleKeyDown}/></div>
                    
                    <div className="md:col-span-2 space-y-1">
                        <label className="text-xs text-gray-500">نام بانک مبدا</label>
                        <select className="w-full border rounded-lg p-2 text-sm bg-white" value={newLine.bankName} onChange={e => setNewLine({ ...newLine, bankName: e.target.value })}><option value="">-- انتخاب --</option>{availableBanks.map(b => <option key={b} value={b}>{b}</option>)}</select>
                    </div>

                    <div className="md:col-span-4 space-y-1"><label className="text-xs text-gray-500">شرح (اختیاری)</label><input type="text" className="w-full border rounded-lg p-2 text-sm" placeholder="..." value={newLine.description} onChange={e => setNewLine({ ...newLine, description: e.target.value })} onKeyDown={handleKeyDown}/></div>
                    
                    <div className="md:col-span-1">
                        <button type="button" onClick={addPaymentLine} disabled={!newLine.amount} className="w-full text-white p-2 rounded-lg bg-blue-600 hover:bg-blue-700 shadow-lg disabled:opacity-50 flex items-center justify-center">
                            <Plus size={20} />
                        </button>
                    </div>
                </div>
                
                <div className="space-y-2">
                    {paymentLines.map((line) => (
                        <div key={line.id} className="flex items-center justify-between bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                            <div className="flex gap-4 text-sm items-center">
                                <span className="font-bold text-gray-800 bg-gray-100 px-2 py-1 rounded">{line.method}</span>
                                <span className="text-blue-600 font-bold font-mono text-lg">{formatCurrency(line.amount)}</span>
                                {line.bankName && <span className="text-gray-600 text-xs">{line.bankName}</span>}
                            </div>
                            <button type="button" onClick={() => removePaymentLine(line.id)} className="text-red-400 hover:text-red-600 p-2 rounded-lg transition-colors"><Trash2 size={18} /></button>
                        </div>
                    ))}
                </div>
            </div>
            
            <div className="pt-4"><button type="submit" disabled={isSubmitting || !trackingNumber} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-bold shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 transition-all disabled:opacity-70">{isSubmitting ? <Loader2 size={24} className="animate-spin" /> : <Save size={24} />}ثبت نهایی دستور پرداخت</button></div>
        </form>
    </div>
  );
};
export default CreateOrder;
