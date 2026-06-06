import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileText, Download, CheckCircle, AlertTriangle, Settings2, Users, Search, Trash2, Edit2, Check, X, Archive, Eye } from 'lucide-react';
import * as XLSX from 'xlsx';

interface CctiArchiveDetail {
    id: string;
    name: string;
    account: string;
    amount: number;
}

interface CctiArchive {
    id: string;
    date: number;
    monthName: string;
    personCount: number;
    totalAmount: number;
    fileContent: string;
    details: CctiArchiveDetail[];
}

interface Props {
    financialYear?: string;
}

const CctiConverter: React.FC<Props> = ({ financialYear }) => {
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
    const [archiveMonthName, setArchiveMonthName] = useState<string>('');
    
    const [activeTab, setActiveTab] = useState<'convert' | 'manage' | 'archive'>('convert');
    const [savedPersons, setSavedPersons] = useState<Record<string, { account: string, name: string }>>({});
    const [archives, setArchives] = useState<CctiArchive[]>([]);
    
    const [searchTerm, setSearchTerm] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editAccount, setEditAccount] = useState('');
    const [editName, setEditName] = useState('');
    
    const [manualRows, setManualRows] = useState<{id: string, name: string, account: string, amount: string}[]>([]);
    const [selectedArchiveView, setSelectedArchiveView] = useState<CctiArchive | null>(null);
    const [manualAmount, setManualAmount] = useState('');
    
    // For manage tab manual entry
    const [newPersonId, setNewPersonId] = useState('');
    const [newPersonName, setNewPersonName] = useState('');
    const [newPersonAccount, setNewPersonAccount] = useState('');
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Helper for Persian months
    const PERSIAN_MONTHS = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];

    useEffect(() => {
        // Safe get of Shamsi date since we can't easily import conditionally without modifying more files
        try {
            const options: Intl.DateTimeFormatOptions = { calendar: 'persian', year: 'numeric', month: 'numeric' };
            const parts = new Intl.DateTimeFormat('en-US-u-ca-persian', options).formatToParts(new Date());
            const m = parseInt(parts.find(p => p.type === 'month')?.value || '1');
            const y = parseInt(parts.find(p => p.type === 'year')?.value || '1403');
            setArchiveMonthName(`حقوق ماه ${m} سال ${financialYear || y}`);
        } catch(e) {
            setArchiveMonthName(`حقوق ماه جاری`);
        }

        const data = localStorage.getItem('ccti_persons');
        if (data) {
            try {
                setSavedPersons(JSON.parse(data));
            } catch (e) {}
        }
        
        const archiveData = localStorage.getItem('ccti_archives');
        if(archiveData) {
            try {
                setArchives(JSON.parse(archiveData));
            } catch(e){}
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
                // Smart header detection: find row with expected keywords
                let headerRowIndex = 0;
                for (let i = 0; i < Math.min(data.length, 20); i++) {
                    const rowParams = (data[i] as any[]) || [];
                    const rowStr = rowParams.join(' ').replace(/\s+/g, ' ');
                    if (rowStr.includes('مبلغ') || rowStr.includes('نام') || rowStr.includes('حساب') || rowStr.includes('شبا') || rowStr.includes('خالص') || rowStr.includes('کد پرسنلی') || rowStr.includes('کد ملی')) {
                        headerRowIndex = i;
                        break;
                    }
                }

                const rawHeaders = (data[headerRowIndex] as unknown[] || []);
                const expectedLength = Math.max(...data.slice(headerRowIndex).map((r: any) => r.length));
                // Fill undefined headers
                const headers = Array.from({ length: expectedLength }).map((_, idx) => {
                    const col = rawHeaders[idx];
                    return col ? String(col).trim() : `ستون_${idx + 1}`;
                });

                setColumns(headers);
                
                const rowData = data.slice(headerRowIndex + 1).filter((r: unknown) => Array.isArray(r) && r.length > 0);
                
                const formattedData = rowData.map((row: any) => {
                    const obj: any = {};
                    headers.forEach((header, index) => {
                        obj[header] = row[index];
                    });
                    return obj;
                });
                
                setExcelData(formattedData);
                
                const accountMatch = headers.find(h => h && (h.includes('حساب') || h.includes('شبا')));
                const amountMatch = headers.find(h => h && (h.includes('مبلغ') || h.includes('پرداخت') || h.includes('خالص')));
                const nameMatch = headers.find(h => h && (h.includes('نام')));
                const codeMatch = headers.find(h => h && (h.includes('پرسنل') || h.includes('کد')));
                
                if (accountMatch) setAccountCol(accountMatch);
                if (amountMatch) setAmountCol(amountMatch);
                if (codeMatch) {
                    setIdCol(codeMatch);
                    if (nameMatch) setNameCol(nameMatch);
                } else if (nameMatch) {
                    setIdCol(nameMatch);
                    setNameCol(nameMatch);
                }
            }
        };
        reader.readAsBinaryString(uploadedFile);
    };

    const handleGenerate = () => {
        if (excelData.length > 0 && (!amountCol || !idCol)) {
            alert('انتخاب ستون‌های شناسه (کد/نام) و مبلغ الزامی است.');
            return;
        }

        let missingCount = 0;
        let generatedCount = 0;
        let totalAmount = 0;
        const detailsArchive: CctiArchiveDetail[] = [];
        
        const newSaved = { ...savedPersons };
        const xmlTxLines: string[] = [];

        // Helper for XML Date
        let shamsiDateStr = '1403-01-01';
        let shamsiDateTimeStr = '1403-01-01T12:00:00';
        try {
            const options: Intl.DateTimeFormatOptions = { calendar: 'persian', year: 'numeric', month: '2-digit', day: '2-digit' };
            const parts = new Intl.DateTimeFormat('en-US-u-ca-persian', options).formatToParts(new Date());
            const y = parts.find(p => p.type === 'year')?.value || '1403';
            const m = parts.find(p => p.type === 'month')?.value || '01';
            const d = parts.find(p => p.type === 'day')?.value || '01';
            const h = new Date().getHours().toString().padStart(2, '0');
            const min = new Date().getMinutes().toString().padStart(2, '0');
            const sec = new Date().getSeconds().toString().padStart(2, '0');
            shamsiDateStr = `${y}-${m}-${d}`;
            shamsiDateTimeStr = `${y}-${m}-${d}T${h}:${min}:${sec}`;
        } catch(e) {}

        const processRow = (id: string, amount: string, accountOrig: string, nameOrig: string) => {
            if (!id) return;
            let account = accountOrig;
            let name = nameOrig;

            if (account) {
                newSaved[id] = { account, name: name || newSaved[id]?.name || id };
            } else {
                account = newSaved[id]?.account || '';
                name = name || newSaved[id]?.name || id;
                if (name && !newSaved[id]?.name) {
                     newSaved[id] = { ...newSaved[id], name };
                }
            }

            if (!account) {
                missingCount++;
                account = 'EMPTY';
            }

            let iban = account.toUpperCase();
            if (iban !== 'EMPTY' && !iban.startsWith('IR')) {
                iban = 'IR' + account;
            }

            generatedCount++;
            const nAmount = Number(amount) || 0;
            totalAmount += nAmount;
            detailsArchive.push({ id, name, account, amount: nAmount });

            xmlTxLines.push(`      <CdtTrfTxInf>
        <PmtId>
          <InstrId>EMPTY</InstrId>
          <EndToEndId>EMPTY</EndToEndId>
        </PmtId>
        <Amt>
          <InstdAmt Ccy="IRR">${nAmount}</InstdAmt>
        </Amt>
        <Cdtr>
          <Nm>${name}</Nm>
          <Id>
            <PrvtId>
              <Othr>
                <Id>EMPTY</Id>
              </Othr>
            </PrvtId>
          </Id>
        </Cdtr>
        <CdtrAcct>
          <Id>
            <IBAN>${iban}</IBAN>
          </Id>
        </CdtrAcct>
      </CdtTrfTxInf>`);
        };

        excelData.forEach(row => {
            const id = row[idCol] ? String(row[idCol]).trim() : '';
            let amount = row[amountCol] || '';
            if (typeof amount === 'string') amount = amount.replace(/,/g, '');
            let account = accountCol ? String(row[accountCol] || '').trim() : '';
            let name = nameCol ? String(row[nameCol] || '').trim() : '';
            processRow(id, amount, account, name);
        });
        
        manualRows.forEach(row => {
            const id = row.id.trim();
            let amount = String(row.amount).replace(/,/g, '');
            let account = row.account.trim();
            let name = row.name.trim();
            processRow(id, amount, account, name);
        });

        updateSavedPersons(newSaved);

        if (generatedCount === 0) {
            alert('هیچ ردیف معتبری برای تولید فایل پیدا نشد. لطفاً از صحت ستون‌ها مطمئن شوید.');
            return;
        }

        if (missingCount > 0) {
            const proceed = window.confirm(`${missingCount} ردیف مجاز به دلیل نداشتن شماره شبا به صورت EMPTY ایجاد شدند.\nآیا مایل به دریافت فایل هستید؟`);
            if (!proceed) return;
        }

        const msgId = `IR790110000000200043622006${Date.now().toString().slice(-9)}`;
        const groupIban = 'IR790110000000200043622006'; 
        const companyName = 'شرکت تولیدی لپان بافت';

        const xmlContent = `<?xml version="1.0" encoding="utf-8" standalone="yes"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.002.001.03">
  <CstmrCdtTrfInitn>
    <GrpHdr>
      <MsgId>${msgId}</MsgId>
      <CreDtTm>${shamsiDateTimeStr}</CreDtTm>
      <NbOfTxs>${generatedCount}</NbOfTxs>
      <CtrlSum>${totalAmount}</CtrlSum>
      <InitgPty>
        <Nm>${companyName}</Nm>
      </InitgPty>
    </GrpHdr>
    <PmtInf>
      <PmtInfId>1</PmtInfId>
      <PmtMtd Ccy="IRR">TRF</PmtMtd>
      <NbOfTxs>${generatedCount}</NbOfTxs>
      <CtrlSum>${totalAmount}</CtrlSum>
      <ReqdExctnDt>${shamsiDateStr}</ReqdExctnDt>
      <Dbtr>
        <Nm>${companyName}</Nm>
      </Dbtr>
      <DbtrAcct>
        <Id>
          <IBAN>${groupIban}</IBAN>
        </Id>
      </DbtrAcct>
      <DbtrAgt>
        <FinInstnId>
          <BIC>BMJIIRTHXXX</BIC>
        </FinInstnId>
      </DbtrAgt>
${xmlTxLines.join('\\n')}
    </PmtInf>
  </CstmrCdtTrfInitn>
</Document>`;

        const fileName = `salary_${archiveMonthName || new Date().getTime()}.xml`;

        // Save archive
        const newArchive: CctiArchive = {
            id: String(new Date().getTime()),
            date: new Date().getTime(),
            monthName: archiveMonthName || 'بدون نام مستعار',
            totalAmount,
            personCount: generatedCount,
            fileContent: xmlContent,
            details: detailsArchive
        };
        const newArchivesList = [newArchive, ...archives];
        setArchives(newArchivesList);
        localStorage.setItem('ccti_archives', JSON.stringify(newArchivesList));
        setArchiveMonthName('');

        const blob = new Blob([xmlContent], { type: 'text/xml;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", fileName);
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
    
    const handleAddPerson = () => {
        if (!newPersonId || !newPersonAccount) return alert('شناسه و شماره حساب الزامی است');
        const newData = {...savedPersons};
        newData[newPersonId] = { account: newPersonAccount, name: newPersonName };
        updateSavedPersons(newData);
        setNewPersonId(''); setNewPersonName(''); setNewPersonAccount('');
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
                <button 
                    onClick={() => setActiveTab('archive')}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'archive' ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                >
                    <div className="flex items-center justify-center gap-2"><Archive size={18}/> بایگانی ماه‌ها</div>
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

                                {(idCol && amountCol) || excelData.length === 0 ? (
                                    <div className="pt-6 space-y-6">
                                        <div className="bg-blue-50/50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-2xl p-6">
                                            <h4 className="font-bold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2"><Settings2 size={18}/> افزودن دستی پرداخت (اختیاری)</h4>
                                            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
                                                <input placeholder="شناسه/کد پرسنلی" className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-2.5 text-sm" value={newPersonId} onChange={e => setNewPersonId(e.target.value)} />
                                                <input placeholder="نام (اختیاری)" className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-2.5 text-sm" value={newPersonName} onChange={e => setNewPersonName(e.target.value)} />
                                                <input placeholder="شماره حساب/شبا (اختیاری)" className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-2.5 text-sm" value={newPersonAccount} onChange={e => setNewPersonAccount(e.target.value)} />
                                                <input placeholder="مبلغ حقوق" className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-2.5 text-sm" value={manualAmount} onChange={e => setManualAmount(e.target.value)} />
                                            </div>
                                            <button 
                                                onClick={() => {
                                                    if(!newPersonId || !manualAmount) return alert('شناسه و مبلغ الزامی است');
                                                    setManualRows([...manualRows, {id: newPersonId, name: newPersonName, account: newPersonAccount, amount: manualAmount}]);
                                                    setNewPersonId(''); setNewPersonName(''); setNewPersonAccount(''); setManualAmount('');
                                                }}
                                                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                                            >
                                                افزودن به لیست خروجی
                                            </button>
                                            
                                            {manualRows.length > 0 && (
                                                <div className="mt-4 space-y-2">
                                                    {manualRows.map((r, i) => (
                                                        <div key={i} className="flex items-center justify-between bg-white dark:bg-gray-800 p-2 rounded-lg text-sm border border-gray-100 dark:border-gray-700">
                                                            <div>
                                                                <span className="font-bold">{r.id}</span> - {r.name || 'بدون نام'} | {r.amount}
                                                            </div>
                                                            <button onClick={() => setManualRows(manualRows.filter((_, idx) => idx !== i))} className="text-red-500 hover:text-red-700 p-1">
                                                                <X size={16} />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        
                                        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-6">
                                            <label className="text-sm font-bold text-gray-700 dark:text-gray-300 block mb-2">نام این ماه جهت ذخیره در بایگانی (مثلا حقوق مهر 1403) <span className="text-red-500">*</span></label>
                                            <input 
                                                placeholder="مثال: حقوق اردیبهشت 1403" 
                                                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                                                value={archiveMonthName} 
                                                onChange={e => setArchiveMonthName(e.target.value)} 
                                            />
                                        </div>

                                        <button 
                                            onClick={() => {
                                                if(!archiveMonthName) return alert('لطفا نام/بازه زمانی فایل را جهت بایگانی مشخص کنید');
                                                handleGenerate();
                                            }}
                                            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white px-8 py-5 rounded-2xl font-black text-lg hover:shadow-lg hover:shadow-green-500/30 transition-all active:scale-95"
                                        >
                                            <Download size={24} />
                                            <span>صدور فایل حقوق نهایی ({excelData.length + manualRows.length} ردیف بررسی خواهد شد)</span>
                                        </button>
                                    </div>
                                ) : null}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'manage' && (
                    <div className="space-y-4 animate-fade-in h-full flex flex-col">
                        <div className="bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-2xl p-4 flex gap-3 text-sm text-blue-800 dark:text-blue-300 font-bold mb-4">
                            سیستم به طور خودکار شماره شبای هر فرد را هنگام آپلود فایل های حاوی شماره حساب، در اینجا ذخیره می‌کند تا در ماه‌های آینده نیازی به وارد کردن مجدد آنها نباشد.
                        </div>

                        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-4 shadow-sm">
                            <h4 className="font-bold text-gray-800 dark:text-gray-200 mb-3 text-sm">ثبت دستی پرسنل در حافظه</h4>
                            <div className="flex flex-col md:flex-row gap-2">
                                <input placeholder="کد پرسنلی / شناسه" className="flex-1 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-2.5 text-sm" value={newPersonId} onChange={e => setNewPersonId(e.target.value)} />
                                <input placeholder="نام و نام خانوادگی" className="flex-1 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-2.5 text-sm" value={newPersonName} onChange={e => setNewPersonName(e.target.value)} />
                                <input placeholder="شماره حساب / شبا" className="flex-1 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-2.5 text-sm" value={newPersonAccount} onChange={e => setNewPersonAccount(e.target.value)} />
                                <button onClick={handleAddPerson} className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-4 py-2.5 font-bold text-sm shrink-0">ثبت در حافظه</button>
                            </div>
                        </div>
                        
                        <div className="relative mb-2 mt-4">
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
                
                {activeTab === 'archive' && (
                    <div className="space-y-4 animate-fade-in h-full flex flex-col">
                        {!selectedArchiveView ? (
                            <>
                                <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-4 shadow-sm mb-4 bg-gradient-to-l from-transparent to-blue-50 dark:to-blue-900/20">
                                    <h3 className="font-black text-gray-800 dark:text-gray-200 text-lg flex items-center gap-2"><Archive className="text-blue-500" /> بایگانی پرداخت‌های حقوق</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">لیست فایل‌های صادر شده قبلی در اینجا قابل مشاهده و بازبینی هستند.</p>
                                </div>
                                <div className="flex-1 overflow-y-auto space-y-3 min-h-[300px] border border-gray-100 dark:border-gray-800 rounded-2xl p-4 bg-gray-50/50 dark:bg-black/20 custom-scrollbar">
                                    {archives.length === 0 ? (
                                        <div className="h-full flex flex-col items-center justify-center text-gray-400 font-bold py-12">
                                            <Archive size={48} className="mb-4 opacity-50" />
                                            بایگانی خالی است
                                        </div>
                                    ) : (
                                        archives.map(arch => (
                                            <div key={arch.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                                                <div>
                                                    <h4 className="font-bold text-gray-800 dark:text-gray-200 text-lg">{arch.monthName}</h4>
                                                    <div className="flex items-center gap-4 text-xs text-gray-500 mt-2">
                                                        <span>{new Date(arch.date).toLocaleDateString('fa-IR')}</span>
                                                        <span>{arch.personCount} پرسنل</span>
                                                        <span>جمع کل: {arch.totalAmount.toLocaleString()} ریال</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button 
                                                        onClick={() => setSelectedArchiveView(arch)}
                                                        className="flex items-center gap-2 bg-blue-50 text-blue-600 hover:bg-blue-100 px-4 py-2 rounded-lg text-sm font-bold transition-colors"
                                                    >
                                                        <Eye size={16} /> نمایش جزئیات
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="flex flex-col h-full animate-fade-in">
                                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-sm mb-4 flex items-center justify-between">
                                    <div>
                                        <h3 className="font-black text-gray-800 dark:text-gray-200 text-lg">{selectedArchiveView.monthName}</h3>
                                        <div className="text-sm text-gray-500 mt-1">
                                            {selectedArchiveView.personCount} نفر | جمع مبالغ: <span className="font-bold text-gray-700 dark:text-gray-300">{selectedArchiveView.totalAmount.toLocaleString()} ریال</span>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => setSelectedArchiveView(null)}
                                        className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 px-4 py-2 rounded-lg text-sm font-bold transition-colors"
                                    >
                                        بازگشت
                                    </button>
                                </div>
                                <div className="flex-1 overflow-y-auto space-y-2 border border-blue-100 dark:border-blue-900/30 rounded-2xl p-4 bg-gray-50/50 dark:bg-black/20 custom-scrollbar">
                                    {selectedArchiveView.details && selectedArchiveView.details.map((detail, idx) => (
                                        <div key={idx} className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center justify-between text-sm shadow-sm transition-all hover:border-blue-200 dark:hover:border-blue-800">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-gray-800 dark:text-gray-200">{detail.name || detail.id}</span>
                                                <span className="text-gray-500 font-mono text-xs">{detail.account}</span>
                                            </div>
                                            <div className="font-bold text-green-600 dark:text-green-400 border border-green-200 dark:border-green-900/50 bg-green-50 dark:bg-green-900/10 px-3 py-1 rounded-md">
                                                {detail.amount.toLocaleString()} 
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <button 
                                    onClick={() => {
                                        const blob = new Blob([selectedArchiveView.fileContent], { type: 'text/plain;charset=utf-8;' });
                                        const link = document.createElement("a");
                                        const url = URL.createObjectURL(blob);
                                        link.setAttribute("href", url);
                                        link.setAttribute("download", `salary_${selectedArchiveView.monthName}.ccti`);
                                        link.style.visibility = 'hidden';
                                        document.body.appendChild(link);
                                        link.click();
                                        document.body.removeChild(link);
                                    }}
                                    className="mt-4 w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-4 rounded-xl font-bold hover:shadow-lg hover:shadow-blue-500/30 transition-all active:scale-95"
                                >
                                    <Download size={20} />
                                    دانلود مجدد فایل CCTI صادر شده
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CctiConverter;

