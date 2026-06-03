import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileText, Download, CheckCircle, AlertTriangle, Settings2, Users, Search, Trash2, Edit2, Check, X } from 'lucide-react';
import * as XLSX from 'xlsx';

const CctiConverter: React.FC = () => {
    const [file, setFile] = useState<File | null>(null);
    const [excelData, setExcelData] = useState<any[]>([]);
    const [columns, setColumns] = useState<string[]>([]);
    
    // Mapping state
    const [idCol, setIdCol] = useState<string>(''); // Used for referencing saved info
    const [accountCol, setAccountCol] = useState<string>(''); // Optional now
    const [amountCol, setAmountCol] = useState<string>('');
    const [nameCol, setNameCol] = useState<string>('');
    
    // Config state
    const [delimiter, setDelimiter] = useState<string>(',');
    
    const [activeTab, setActiveTab] = useState<'convert' | 'manage'>('convert');
    const [savedPersons, setSavedPersons] = useState<Record<string, { account: string, name: string }>>({});
    
    const [searchTerm, setSearchTerm] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editAccount, setEditAccount] = useState('');
    const [editName, setEditName] = useState('');
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const data = localStorage.getItem('ccti_persons');
        if (data) {
            try {
                setSavedPersons(JSON.parse(data));
            } catch (e) {}
        }
    }, []);

    const updateSavedPersons = (newData: Record<string, { account: string, name: string }>) => {
        setSavedPersons(newData);
        localStorage.setItem('ccti_persons', JSON.stringify(newData));
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const uploadedFile = e.target.files?.[0];
        if (!uploadedFile) return;
        setFile(uploadedFile);
        
        const reader = new FileReader();
        reader.onload = (evt) => {
            const bstr = evt.target?.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
            
            if (data.length > 0) {
                const headers = (data[0] as unknown[]).map(String);
                setColumns(headers);
                
                const rowData = data.slice(1).filter(r => Array.isArray(r) && r.length > 0);
                
                const formattedData = rowData.map((row: any) => {
                    const obj: any = {};
                    headers.forEach((header, index) => {
                        obj[header] = row[index];
                    });
                    return obj;
                });
                
                setExcelData(formattedData);
                
                const accountMatch = headers.find(h => h && h.includes('حساب'));
                const amountMatch = headers.find(h => h && h.includes('مبلغ'));
                const nameMatch = headers.find(h => h && (h.includes('نام') || h.includes('شرح')));
                const codeMatch = headers.find(h => h && h.includes('پرسنل'));
                
                if (accountMatch) setAccountCol(accountMatch);
                if (amountMatch) setAmountCol(amountMatch);
                if (nameMatch) {
                    setNameCol(nameMatch);
                    setIdCol(codeMatch || nameMatch);
                } else if (codeMatch) {
                    setIdCol(codeMatch);
                }
            }
        };
        reader.readAsBinaryString(uploadedFile);
    };

    const handleGenerate = () => {
        if (!amountCol || !idCol) {
            alert('انتخاب ستون‌های شناسه (کد/نام) و مبلغ الزامی است.');
            return;
        }

        let output = '';
        let missingCount = 0;
        let generatedCount = 0;
        
        const newSaved = { ...savedPersons };

        excelData.forEach(row => {
            const id = row[idCol] ? String(row[idCol]).trim() : '';
            if (!id) return;
            
            let amount = row[amountCol] || '';
            if (typeof amount === 'string') amount = amount.replace(/,/g, '');
            
            let account = accountCol ? String(row[accountCol] || '').trim() : '';
            let name = nameCol ? String(row[nameCol] || '').trim() : '';
            
            // Update saved data if account is provided in this excel
            if (account) {
                newSaved[id] = { account, name: name || newSaved[id]?.name || id };
            } else {
                // Otherwise read from saved data
                account = newSaved[id]?.account || '';
                name = name || newSaved[id]?.name || id;
                if (name && !newSaved[id]?.name) {
                     newSaved[id] = { ...newSaved[id], name };
                }
            }
            
            if (account) {
                let line = `${account}${delimiter}${amount}`;
                if (name) line += `${delimiter}${name}`;
                output += line + '\r\n';
                generatedCount++;
            } else {
                missingCount++;
            }
        });

        updateSavedPersons(newSaved);

        if (missingCount > 0) {
            const proceed = window.confirm(`${missingCount} ردیف به دلیل نداشتن شماره حساب در فایل نهایی قرار نگرفتند.\nآیا مایل به دریافت فایل هستید؟ (می توانید در بخش مدیریت، شماره حساب آنها را تکمیل کنید)`);
            if (!proceed) return;
        }

        if (generatedCount === 0) {
            alert('هیچ ردیف معتبری برای تولید فایل پیدا نشد.');
            return;
        }

        const blob = new Blob([output], { type: 'text/plain;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `salary_${new Date().getTime()}.ccti`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleDeletePerson = (id: string) => {
        if(window.confirm('آیا از حذف این شخص مطمئن هستید؟')) {
            const newData = {...savedPersons};
            delete newData[id];
            updateSavedPersons(newData);
        }
    };
    
    const handleStartEdit = (id: string) => {
        setEditingId(id);
        setEditAccount(savedPersons[id].account);
        setEditName(savedPersons[id].name);
    }
    
    const handleSaveEdit = () => {
        if (editingId) {
            const newData = {...savedPersons};
            newData[editingId] = { account: editAccount, name: editName };
            updateSavedPersons(newData);
            setEditingId(null);
        }
    }

    return (
        <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6 pt-24 md:pt-8 animate-fade-in pb-32 h-full flex flex-col">
            <div className="flex items-center gap-3 mb-2 shrink-0">
                <div className="bg-gradient-to-tr from-blue-500 to-indigo-600 p-3 rounded-2xl text-white shadow-lg">
                    <FileText size={24} />
                </div>
                <div>
                    <h2 className="text-xl md:text-2xl font-black text-gray-800 dark:text-gray-100 flex items-center gap-2">
                        مبدل فایل حقوق (CCTI)
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-bold line-clamp-1">
                        تبدیل هوشمند اکسل حقوق به فرمت بانک
                    </p>
                </div>
            </div>
            
            <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-2xl shrink-0">
                <button 
                    onClick={() => setActiveTab('convert')}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'convert' ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                >
                    <div className="flex items-center justify-center gap-2"><Upload size={18}/> صدور فایل CCTI</div>
                </button>
                <button 
                    onClick={() => setActiveTab('manage')}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'manage' ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                >
                    <div className="flex items-center justify-center gap-2"><Users size={18}/> حافظه پرسنل</div>
                </button>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 bg-white/80 dark:bg-gray-900/60 p-6 rounded-3xl border border-white/50 shadow-xl custom-scrollbar">
                {activeTab === 'convert' && (
                    <div className="space-y-8 animate-fade-in">
                        {/* Step 1: Upload */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 mb-4">
                                <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 flex items-center justify-center font-black">۱</div>
                                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">آپلود فایل اکسل این ماه</h3>
                            </div>
                            
                            <div 
                                className={`border-2 border-dashed rounded-3xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all ${file ? 'border-green-400 bg-green-50/50 dark:bg-green-900/10' : 'border-blue-200 bg-blue-50 dark:border-blue-900/30 dark:bg-gray-800/50 hover:border-blue-400 hover:bg-blue-100/50 dark:hover:bg-gray-800/80'}`}
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} />
                                {file ? (
                                    <div className="flex flex-col items-center text-green-600 dark:text-green-400">
                                        <CheckCircle size={48} className="mb-2" />
                                        <span className="font-bold">{file.name}</span>
                                        <span className="text-xs mt-2 opacity-80">{excelData.length} ردیف یافت شد</span>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center text-blue-500 dark:text-blue-400 text-center">
                                        <Upload size={48} className="mb-2 opacity-80" />
                                        <span className="font-bold">برای انتخاب فایل اکسل کلیک کنید</span>
                                        <span className="text-xs mt-2 opacity-70">همان فایل حقوق که در آن ستون مبلغ وجود دارد (<span dir="ltr">.xlsx, .xls</span>)</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Step 2: Mapping */}
                        {file && columns.length > 0 && (
                            <div className="space-y-4 animate-fade-in">
                                <div className="flex items-center justify-between border-t border-gray-100 dark:border-gray-800 pt-4">
                                    <div className="flex items-center gap-2 mb-4">
                                        <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 flex items-center justify-center font-black">۲</div>
                                        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">تبدیل هوشمند</h3>
                                    </div>
                                </div>
                                
                                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700/50 rounded-2xl p-4 text-sm text-yellow-800 dark:text-yellow-300 mb-4 font-bold leading-relaxed">
                                    سیستم به طور خودکار بر اساس <span className="text-yellow-900 dark:text-yellow-100 bg-yellow-200 dark:bg-yellow-700/50 px-1 rounded mx-1">کد/نام</span> شماره شبای پرسنل را از پایگاه داده می‌خواند. فقط کافیست ستون مبلغ این ماه را تنظیم کنید.
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 dark:bg-gray-800/50 p-6 rounded-2xl border border-gray-100 dark:border-gray-700">
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-gray-700 dark:text-gray-300">ستون شناسه (کد پرسنلی یا نام) <span className="text-red-500">*</span></label>
                                        <select 
                                            className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                            value={idCol}
                                            onChange={(e) => setIdCol(e.target.value)}
                                        >
                                            <option value="">-- انتخاب کنید --</option>
                                            {columns.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                    
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-gray-700 dark:text-gray-300">ستون مبلغ حقوق این ماه <span className="text-red-500">*</span></label>
                                        <select 
                                            className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                            value={amountCol}
                                            onChange={(e) => setAmountCol(e.target.value)}
                                        >
                                            <option value="">-- انتخاب کنید --</option>
                                            {columns.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                    
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-gray-700 dark:text-gray-300 text-blue-600 dark:text-blue-400">ستون شماره حساب / شبا (اختیاری)</label>
                                        <select 
                                            className="w-full bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-900/30 rounded-xl p-3 text-sm outline-none"
                                            value={accountCol}
                                            onChange={(e) => setAccountCol(e.target.value)}
                                        >
                                            <option value="">ندارد (خواندن از حافظه سیستم)</option>
                                            {columns.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                        <p className="text-[10px] text-gray-500 font-bold pr-1">اگر انتخاب شود، حافظه سیستم بروزرسانی می‌شود.</p>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-gray-700 dark:text-gray-300 text-blue-600 dark:text-blue-400">ستون نام (برای خروجی بهتر)</label>
                                        <select 
                                            className="w-full bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-900/30 rounded-xl p-3 text-sm outline-none"
                                            value={nameCol}
                                            onChange={(e) => setNameCol(e.target.value)}
                                        >
                                            <option value="">ندارد</option>
                                            {columns.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                    
                                    <div className="space-y-2 md:col-span-2">
                                        <label className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1"><Settings2 size={16}/> جداکننده (Delimiter)</label>
                                        <select 
                                            className="w-full md:w-1/2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                            value={delimiter}
                                            onChange={(e) => setDelimiter(e.target.value)}
                                        >
                                            <option value=",">کاما ( , ) - رایج‌ترین</option>
                                            <option value=";">نقطه ویرگول ( ; )</option>
                                            <option value="\t">تب ( Tab )</option>
                                            <option value="|">خط عمودی ( | )</option>
                                        </select>
                                    </div>
                                </div>

                                {idCol && amountCol && (
                                    <div className="pt-6">
                                        <button 
                                            onClick={handleGenerate}
                                            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white px-8 py-5 rounded-2xl font-black text-lg hover:shadow-lg hover:shadow-green-500/30 transition-all active:scale-95"
                                        >
                                            <Download size={24} />
                                            <span>صدور فایل حقوق این ماه (تنظیم خودکار مبالغ و حذف غایبین)</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'manage' && (
                    <div className="space-y-4 animate-fade-in h-full flex flex-col">
                        <div className="bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-2xl p-4 flex gap-3 text-sm text-blue-800 dark:text-blue-300 font-bold mb-4">
                            سیستم به طور خودکار شماره شبای هر فرد را هنگام آپلود فایل های حاوی شماره حساب، در اینجا ذخیره می‌کند تا در ماه‌های آینده نیازی به وارد کردن مجدد آنها نباشد.
                        </div>
                        
                        <div className="relative mb-4">
                            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                type="text"
                                placeholder="جستجو در مشخصات یا شماره حساب..."
                                className="w-full pl-4 pr-10 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-gray-100"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-2 min-h-[300px] border border-gray-100 dark:border-gray-800 rounded-2xl p-2 bg-gray-50/50 dark:bg-black/20 custom-scrollbar">
                            {Object.keys(savedPersons).length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-gray-400 font-bold py-12">
                                    <Users size={48} className="mb-4 opacity-50" />
                                    هنوز اطلاعاتی ذخیره نشده است
                                </div>
                            ) : (
                                Object.entries(savedPersons)
                                    .filter(([id, data]) => 
                                        id.includes(searchTerm) || 
                                        data.name.includes(searchTerm) || 
                                        data.account.includes(searchTerm)
                                    )
                                    .map(([id, data]) => (
                                    <div key={id} className="bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-100 dark:border-gray-700 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm hover:shadow transition-all group">
                                        {editingId === id ? (
                                            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                                                <input 
                                                    value={editName} 
                                                    onChange={e => setEditName(e.target.value)} 
                                                    className="border border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-gray-900 rounded-lg p-2 text-sm outline-none" 
                                                    placeholder="نام"
                                                />
                                                <input 
                                                    value={editAccount} 
                                                    onChange={e => setEditAccount(e.target.value)} 
                                                    className="border border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-gray-900 rounded-lg p-2 text-sm outline-none" 
                                                    placeholder="شماره حساب/شبا"
                                                />
                                            </div>
                                        ) : (
                                            <div>
                                                <div className="font-bold text-gray-800 dark:text-gray-200">
                                                    {data.name || 'بدون نام'}
                                                </div>
                                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-2">
                                                    <span className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded text-[10px]">شناسه/کد: {id}</span>
                                                    <span dir="ltr" className="font-mono">{data.account}</span>
                                                </div>
                                            </div>
                                        )}
                                        
                                        <div className="flex items-center gap-1 self-end md:self-auto opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                            {editingId === id ? (
                                                <>
                                                    <button onClick={handleSaveEdit} className="p-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200">
                                                        <Check size={16} />
                                                    </button>
                                                    <button onClick={() => setEditingId(null)} className="p-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
                                                        <X size={16} />
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <button onClick={() => handleStartEdit(id)} className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg">
                                                        <Edit2 size={16} />
                                                    </button>
                                                    <button onClick={() => handleDeletePerson(id)} className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg">
                                                        <Trash2 size={16} />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CctiConverter;

