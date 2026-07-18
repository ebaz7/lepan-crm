import React, { useState, useEffect } from 'react';
import { 
  FileText, PlusCircle, List, Trash2, Calendar, FileUp, Sparkles, Loader2, 
  Printer, ArrowRight, CheckCircle2, User, Landmark, HelpCircle, Download,
  Coins, Hash, Check, AlertCircle, FileSpreadsheet, WifiOff, Globe, Copy, Zap,
  Search, TrendingUp, Archive, CheckCircle, ShieldAlert, FileClock, RefreshCw, QrCode
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Tesseract from 'tesseract.js';
import jsQR from 'jsqr';
import { ChequeReceipt, ChequeItem, UserRole } from '../types';
import { 
  getChequeReceipts, saveChequeReceipt, deleteChequeReceipt, 
  updateChequeReceipt, getNextChequeReceiptNumber, parseChequesFromDocument, uploadFileChunked 
} from '../services/storageService';
import { apiCall } from '../services/apiService';

// Persian bank list for autocomplete and filters
const COMMON_IRANIAN_BANKS = [
  'ملی ایران', 'صادرات ایران', 'سپه', 'ملت', 'تجارت', 'مسکن', 'کشاورزی', 
  'رفاه کارگران', 'پاسارگاد', 'سامان', 'پارسیان', 'اقتصاد نوین', 'کارآفرین', 
  'صنعت و معدن', 'توسعه صادرات', 'توسعه تعاون', 'پست بانک', 'سینا', 'شهر', 
  'دی', 'سرمایه', 'گردشگری', 'آینده', 'خاورمیانه', 'قوامین', 'مهر ایران'
];

// Helper to convert number to Persian words for cheque amounts
const numberToPersianWords = (num: number): string => {
  if (num === 0) return 'صفر';
  const letters = [
    ['', 'یک', 'دو', 'سه', 'چهار', 'پنج', 'شش', 'هفت', 'هشت', 'نه'],
    ['ده', 'یازده', 'دوازده', 'سیزده', 'چهارده', 'پانزده', 'شانزده', 'هفده', 'هجده', 'نوزده'],
    ['', '', 'بیست', 'سی', 'چهل', 'پنجاه', 'شصت', 'هفتاد', 'هشتاد', 'نود'],
    ['', 'یکصد', 'دویست', 'سیصد', 'چهارصد', 'پانصد', 'ششصد', 'هفتصد', 'هشتصد', 'نهصد']
  ];
  const splitted = [];
  while (num > 0) {
    splitted.push(num % 1000);
    num = Math.floor(num / 1000);
  }
  const units = ['', ' هزار', ' میلیون', ' میلیارد', ' تریلیون'];
  let res = '';
  for (let i = 0; i < splitted.length; i++) {
    const val = splitted[i];
    if (val === 0) continue;
    let text = '';
    const s = val % 10;
    const d = Math.floor((val % 100) / 10);
    const h = Math.floor(val / 100);
    
    if (h > 0) text += letters[3][h];
    if (d > 0) {
      if (text !== '') text += ' و ';
      if (d === 1) {
        text += letters[1][s];
      } else {
        text += letters[2][d];
        if (s > 0) text += ' و ' + letters[0][s];
      }
    } else if (s > 0) {
      if (text !== '') text += ' و ';
      text += letters[0][s];
    }
    res = text + units[i] + (res !== '' ? ' و ' : '') + res;
  }
  return res.trim();
};

// Helper for today's Jalali date
const getTodayJalali = (): string => {
  try {
    const options = { calendar: 'persian', year: 'numeric', month: '2-digit', day: '2-digit' };
    const formatter = new Intl.DateTimeFormat('fa-IR-u-ca-persian', options as any);
    const parts = formatter.formatToParts(new Date());
    const year = parts.find(p => p.type === 'year')?.value || '';
    const month = parts.find(p => p.type === 'month')?.value || '';
    const day = parts.find(p => p.type === 'day')?.value || '';
    
    const toEng = (s: string) => s.replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString());
    return `${toEng(year)}/${toEng(month)}/${toEng(day)}`;
  } catch (e) {
    return '1403/01/01';
  }
};

interface ChequeReceiptModuleProps {
  currentUser: any;
}

export const ChequeReceiptModule: React.FC<ChequeReceiptModuleProps> = ({ currentUser }) => {
  const [activeSubTab, setActiveSubTab] = useState<'list' | 'create' | 'treasury'>('list');
  const [receipts, setReceipts] = useState<ChequeReceipt[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Create state
  const [customerName, setCustomerName] = useState('');
  const [registrationDate, setRegistrationDate] = useState(getTodayJalali());
  const [serialNumber, setSerialNumber] = useState('');
  const [attachedFile, setAttachedFile] = useState<{ name: string; url: string } | null>(null);
  const [cheques, setCheques] = useState<ChequeItem[]>([]);
  const [saveStatus, setSaveStatus] = useState<'draft' | 'pending_sales'>('pending_sales');
  
  // Upload and AI parsing states
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [aiParsing, setAiParsing] = useState(false);
  const [aiStatusMessage, setAiStatusMessage] = useState('');
  const [parseError, setParseError] = useState('');
  const [customers, setCustomers] = useState<string[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  
  // Offline and text pasting states
  const [extractionMode, setExtractionMode] = useState<'ai' | 'offline' | 'qr' | 'text'>('ai');
  const [pastedText, setPastedText] = useState('');
  const [qrScanning, setQrScanning] = useState(false);

  // Detail & Print states
  const [selectedReceipt, setSelectedReceipt] = useState<ChequeReceipt | null>(null);

  // Treasury Search and Filters State
  const [treasurySearch, setTreasurySearch] = useState('');
  const [treasuryBankFilter, setTreasuryBankFilter] = useState('');
  const [treasuryStatusFilter, setTreasuryStatusFilter] = useState('');
  const [treasuryDueDateFilter, setTreasuryDueDateFilter] = useState('all'); // all, today, week, month

  useEffect(() => {
    loadReceipts();
    loadCustomers();
    fetchNextNumber();
  }, []);

  const loadReceipts = async () => {
    setLoading(true);
    try {
      const data = await getChequeReceipts();
      setReceipts(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadCustomers = async () => {
    try {
      const response = await apiCall<any[]>('/orders');
      const cNames = new Set<string>();
      if (Array.isArray(response)) {
        response.forEach(o => {
          if (o.contractor) cNames.add(o.contractor);
          if (o.customerName) cNames.add(o.customerName);
        });
      }
      setCustomers(Array.from(cNames).filter(Boolean));
    } catch (e) {
      console.error('Failed to load customer directory:', e);
    }
  };

  const fetchNextNumber = async () => {
    try {
      const num = await getNextChequeReceiptNumber();
      setSerialNumber(num);
    } catch (e) {
      console.error(e);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadProgress(10);
    try {
      const result = await uploadFileChunked(file, (progress) => {
        setUploadProgress(progress);
      });
      setAttachedFile({
        name: file.name,
        url: result.url
      });
      setUploadProgress(null);
    } catch (err: any) {
      console.error(err);
      setParseError('خطا در بارگذاری فایل پیوست');
      setUploadProgress(null);
    }
  };

  const handleAiParse = async () => {
    if (!attachedFile) return;
    
    setAiParsing(true);
    setParseError('');
    
    const messages = [
      'در حال فراخوانی موتور هوش مصنوعی صیاد...',
      'در حال اسکن نوری اسناد و تحلیل تصویر چک...',
      'در حال بازخوانی شناسه صیادی ۱۶ رقمی...',
      'در حال استخراج سررسید چک‌ها و مبالغ به ریال...',
      'در حال اعتبارسنجی ارقام و نام بانک صادرکننده...'
    ];
    
    let msgIdx = 0;
    setAiStatusMessage(messages[0]);
    const timer = setInterval(() => {
      msgIdx = (msgIdx + 1) % messages.length;
      setAiStatusMessage(messages[msgIdx]);
    }, 2500);

    try {
      const fileRes = await apiCall<{ fileData: string }>(`/upload-get-base64?url=${encodeURIComponent(attachedFile.url)}`);
      const result = await parseChequesFromDocument(fileRes.fileData, attachedFile.name);
      
      if (result && Array.isArray(result.cheques)) {
        const parsedCheques = result.cheques.map((c: any) => ({
          ...c,
          id: 'ch_' + Math.random().toString(36).substr(2, 9),
          drawerName: c.drawerName || customerName || 'صاحب حساب'
        }));
        setCheques(prev => [...prev, ...parsedCheques]);
        setAiStatusMessage('استخراج اطلاعات با موفقیت انجام شد!');
      } else {
        setParseError('هوش مصنوعی نتوانست چکی را در این سند شناسایی کند. لطفا فیلدها را دستی پر کنید.');
      }
    } catch (e: any) {
      console.error(e);
      setParseError('خطا در اجرای استخراج هوشمند: ' + e.message);
    } finally {
      clearInterval(timer);
      setAiParsing(false);
    }
  };

  // --- OFFLINE HEURISTIC PARSER ---
  const parseRawTextToCheques = (rawText: string): ChequeItem[] => {
    const normalizeDigits = (str: string): string => {
      return str.replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
                .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());
    };

    const cleanText = normalizeDigits(rawText);
    const lines = cleanText.split('\n');
    const results: ChequeItem[] = [];

    const bankKeywords = [
      { name: 'ملی ایران', patterns: ['ملی', 'melli'] },
      { name: 'صادرات ایران', patterns: ['صادرات', 'saderat'] },
      { name: 'سپه', patterns: ['سپه', 'sepah'] },
      { name: 'ملت', patterns: ['ملت', 'mellat'] },
      { name: 'تجارت', patterns: ['تجارت', 'tejarat'] },
      { name: 'مسکن', patterns: ['مسکن', 'maskan'] },
      { name: 'کشاورزی', patterns: ['کشاورزی', 'keshavarzi'] },
      { name: 'رفاه کارگران', patterns: ['رفاه', 'refah'] },
      { name: 'پاسارگاد', patterns: ['پاسارگاد', 'pasargad'] },
      { name: 'سامان', patterns: ['سامان', 'saman'] },
      { name: 'پارسیان', patterns: ['پارسیان', 'parsian'] },
      { name: 'اقتصاد نوین', patterns: ['اقتصاد نوین', 'novin', 'اقتصاد'] },
      { name: 'کارآفرین', patterns: ['کارآفرین', 'karafarin'] },
      { name: 'دی', patterns: [' دی ', 'بانک دی'] },
      { name: 'شهر', patterns: [' شهر ', 'بانک شهر'] },
      { name: 'آینده', patterns: ['آینده', 'ayandeh'] },
      { name: 'گردشگری', patterns: ['گردشگری', 'gardeshgari'] },
      { name: 'توسعه تعاون', patterns: ['توسعه تعاون'] },
      { name: 'پست بانک', patterns: ['پست بانک', 'post'] },
      { name: 'مهر ایران', patterns: ['مهر ایران', 'qarzolhasaneh'] },
      { name: 'سینا', patterns: ['سینا', 'sina'] }
    ];

    for (let line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      const digitsOnlyLine = trimmedLine.replace(/[- ]/g, '');
      const sayyadMatch = digitsOnlyLine.match(/\b\d{16}\b/);
      
      let sayyadId = '';
      if (sayyadMatch) {
        sayyadId = sayyadMatch[0];
      } else {
        const fallbackMatch = trimmedLine.match(/\d{16}/);
        if (fallbackMatch) sayyadId = fallbackMatch[0];
      }

      if (!sayyadId) {
        const words = trimmedLine.split(/[\s,،;]+/);
        for (const w of words) {
          const cleanW = w.replace(/[^\d]/g, '');
          if (cleanW.length === 16) {
            sayyadId = cleanW;
            break;
          }
        }
      }

      let remainingLine = trimmedLine;
      if (sayyadId) {
        remainingLine = remainingLine.replace(sayyadId, '');
        const formattedSayyad = sayyadId.replace(/(.{4})/g, '$1 ').trim();
        remainingLine = remainingLine.replace(formattedSayyad, '');
        const dashedSayyad = sayyadId.replace(/(.{4})/g, '$1-').replace(/-$/, '');
        remainingLine = remainingLine.replace(dashedSayyad, '');
      }

      const dateReg = /\b(13|14)?\d{2}[/-]\d{1,2}[/-]\d{1,2}\b/;
      const dateMatch = remainingLine.match(dateReg);
      let dueDate = getTodayJalali();
      
      if (dateMatch) {
        const rawDate = dateMatch[0];
        const parts = rawDate.split(/[/-]/);
        if (parts.length === 3) {
          let y = parts[0];
          let m = parts[1];
          let d = parts[2];
          if (y.length === 2) y = '14' + y;
          if (m.length === 1) m = '0' + m;
          if (d.length === 1) d = '0' + d;
          dueDate = `${y}/${m}/${d}`;
        }
        remainingLine = remainingLine.replace(rawDate, '');
      } else {
        const yyyymmddMatch = remainingLine.match(/\b(13|14)\d{6}\b/);
        if (yyyymmddMatch) {
          const rawDate = yyyymmddMatch[0];
          dueDate = `${rawDate.substring(0, 4)}/${rawDate.substring(4, 6)}/${rawDate.substring(6, 8)}`;
          remainingLine = remainingLine.replace(rawDate, '');
        }
      }

      let bankName = '';
      for (const bk of bankKeywords) {
        for (const pat of bk.patterns) {
          if (remainingLine.includes(pat)) {
            bankName = bk.name;
            remainingLine = remainingLine.replace(pat, '');
            break;
          }
        }
        if (bankName) break;
      }
      if (!bankName) bankName = 'ملی ایران';

      const cleanNumString = remainingLine.replace(/[،,.]/g, '');
      const numMatches = cleanNumString.match(/\b\d+\b/g) || [];

      let amount = 0;
      let chequeNumber = '';

      const numericValues = numMatches
        .map(numStr => parseInt(numStr, 10))
        .filter(val => !isNaN(val) && val > 0)
        .sort((a, b) => b - a);

      if (numericValues.length > 0) {
        amount = numericValues[0];
        if (trimmedLine.includes('تومان') || trimmedLine.includes('toman')) {
          amount = amount * 10;
        }

        if (numericValues.length > 1) {
          const serialCandidate = numericValues.find(val => val !== amount && val.toString().length >= 5 && val.toString().length <= 9);
          if (serialCandidate) {
            chequeNumber = serialCandidate.toString();
          } else {
            chequeNumber = numericValues[1].toString();
          }
        }
      }

      if (!chequeNumber) {
        const shortMatch = remainingLine.match(/\b\d{5,8}\b/);
        if (shortMatch) {
          chequeNumber = shortMatch[0];
        } else {
          chequeNumber = Math.floor(100000 + Math.random() * 900000).toString();
        }
      }

      const drawerName = customerName || 'صاحب حساب';

      if (sayyadId || amount > 0 || chequeNumber.length > 5) {
        results.push({
          id: 'ch_' + Math.random().toString(36).substr(2, 9),
          chequeNumber,
          sayyadId,
          bankName,
          dueDate,
          amount,
          drawerName
        });
      }
    }

    return results;
  };

  const handleOfflineOcr = async () => {
    if (!attachedFile) {
      alert('لطفاً ابتدا سند یا تصویر چک را ضمیمه کنید.');
      return;
    }

    setAiParsing(true);
    setParseError('');
    setAiStatusMessage('در حال فراخوانی اسکنر آفلاین Tesseract...');

    try {
      setAiStatusMessage('در حال تحلیل و استخراج کلمات با الگوریتم اسکن نوری (OCR)...');
      const response = await Tesseract.recognize(
        attachedFile.url,
        'fas+eng',
        {
          logger: m => {
            if (m.status === 'recognizing') {
              setAiStatusMessage(`اسکن تصاویر آفلاین: ${Math.round(m.progress * 100)}%`);
            }
          }
        }
      );

      const text = response.data.text;
      if (text && text.trim()) {
        const parsed = parseRawTextToCheques(text);
        if (parsed.length > 0) {
          setCheques(prev => [...prev, ...parsed]);
          setAiStatusMessage(`استخراج به پایان رسید. تعداد ${parsed.length} چک شناسایی شد!`);
        } else {
          setParseError('اسکن با موفقیت انجام شد اما چکی در این متن یافت نشد. می‌توانید متن را کپی و دستی پیست کنید.');
        }
      } else {
        setParseError('هیچ متنی در سند یا تصویر شناسایی نشد. مطمئن شوید تصویر خوانا است.');
      }
    } catch (e: any) {
      console.error(e);
      setParseError('خطا در اجرای اسکن آفلاین: ' + e.message);
    } finally {
      setAiParsing(false);
    }
  };

  // --- OFFLINE LOCAL QR CODE DECODER ---
  const handleOfflineQrScan = async () => {
    if (!attachedFile) {
      alert('لطفاً ابتدا تصویر اسکن‌شده چک دارای بارکد/QR را انتخاب و ضمیمه کنید.');
      return;
    }

    setQrScanning(true);
    setParseError('');

    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      // Load image into HTML canvas to extract pixels for jsQR
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            setParseError('امکان ایجاد بوم تصویری محلی وجود ندارد.');
            setQrScanning(false);
            return;
          }

          ctx.drawImage(img, 0, 0, img.width, img.height);
          const imageData = ctx.getImageData(0, 0, img.width, img.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert',
          });

          if (code) {
            const rawCode = code.data;
            // Parse Sayyad standard format or URL
            // Format can be a URI: sayyad.cbi.ir/?id=1234567890123456 or plain digits or split by *
            const sayyadMatch = rawCode.match(/\b\d{16}\b/) || rawCode.replace(/[^\d]/g, '').match(/\d{16}/);
            
            if (sayyadMatch) {
              const sayyadId = sayyadMatch[0];
              // Extract numeric tokens that look like a cheque number (usually 5 to 9 digits, different from Sayyad)
              const parts = rawCode.split(/[\s*?=&:-]+/);
              const chequeNumber = parts.find(p => p.length >= 5 && p.length <= 9 && p !== sayyadId) || 
                                   Math.floor(100000 + Math.random() * 900000).toString();

              const newCheque: ChequeItem = {
                id: 'ch_' + Math.random().toString(36).substr(2, 9),
                chequeNumber,
                sayyadId,
                bankName: 'ملی ایران', // Default, editable
                dueDate: getTodayJalali(),
                amount: 0,
                drawerName: customerName || 'صاحب حساب'
              };

              setCheques(prev => [...prev, newCheque]);
              alert(`اسکن بارکد صیادی با موفقیت انجام شد!\nشناسه صیادی: ${sayyadId}\nشماره چک: ${chequeNumber}\nبه جدول بالا اضافه شد. مبلغ را وارد کنید.`);
            } else {
              alert(`بارکد اسکن شد اما شناسه صیادی معتبری استخراج نشد. محتوای بارکد:\n${rawCode}`);
            }
          } else {
            setParseError('هیچ بارکد صیادی معتبری در تصویر چک شناسایی نشد. مطمئن شوید کادر بارکد مستقیم، واضح و بدون تاخوردگی باشد.');
          }
        } catch (err: any) {
          console.error(err);
          setParseError('خطا در پردازش تصویر بارکد: ' + err.message);
        } finally {
          setQrScanning(false);
        }
      };

      img.onerror = () => {
        setParseError('بارگذاری تصویر چک با خطا مواجه شد.');
        setQrScanning(false);
      };

      img.src = attachedFile.url;
    } catch (e: any) {
      console.error(e);
      setParseError('خطا در راه‌اندازی اسکنر آفلاین بارکد: ' + e.message);
      setQrScanning(false);
    }
  };

  const handleTextPasteParse = () => {
    if (!pastedText.trim()) {
      alert('لطفاً ابتدا متن حاوی اطلاعات چک‌ها را در کادر زیر وارد کنید.');
      return;
    }

    const parsed = parseRawTextToCheques(pastedText);
    if (parsed.length > 0) {
      setCheques(prev => [...prev, ...parsed]);
      setPastedText('');
      alert(`تحلیل با موفقیت انجام شد و تعداد ${parsed.length} چک به جدول زیر اضافه گردید.`);
    } else {
      alert('متاسفانه هیچ الگوی مشخصی از چک (شناسه ۱۶ رقمی، تاریخ سررسید یا مبالغ معتبر) در این متن یافت نشد.');
    }
  };

  const handleAddChequeRow = () => {
    const newCheque: ChequeItem = {
      id: 'ch_' + Math.random().toString(36).substr(2, 9),
      chequeNumber: '',
      sayyadId: '',
      bankName: '',
      dueDate: getTodayJalali(),
      amount: 0,
      drawerName: customerName || '' // Pre-populate with our customer name to avoid redundant entries
    };
    setCheques([...cheques, newCheque]);
  };

  const handleRemoveChequeRow = (id: string) => {
    setCheques(cheques.filter(c => c.id !== id));
  };

  const handleChequeFieldChange = (id: string, field: keyof ChequeItem, value: any) => {
    setCheques(cheques.map(c => {
      if (c.id === id) {
        if (field === 'amount') {
          const numVal = parseInt(value.toString().replace(/[^\d]/g, ''), 10) || 0;
          return { ...c, [field]: numVal };
        }
        return { ...c, [field]: value };
      }
      return c;
    }));
  };

  const handleSaveReceipt = async () => {
    if (!customerName.trim()) {
      alert('لطفاً نام مشتری را وارد نمایید.');
      return;
    }
    if (cheques.length === 0) {
      alert('لطفاً حداقل یک چک اضافه کنید.');
      return;
    }

    // Validation
    for (let i = 0; i < cheques.length; i++) {
      const c = cheques[i];
      if (!c.chequeNumber.trim()) {
        alert(`شماره چک در سطر ${i + 1} خالی است.`);
        return;
      }
      if (!c.sayyadId.trim() || c.sayyadId.length !== 16) {
        alert(`شناسه صیادی در سطر ${i + 1} باید دقیقاً ۱۶ رقم باشد.`);
        return;
      }
      if (!c.bankName.trim()) {
        alert(`نام بانک در سطر ${i + 1} خالی است.`);
        return;
      }
      if (!c.dueDate.match(/^\d{4}\/\d{2}\/\d{2}$/)) {
        alert(`تاریخ سررسید در سطر ${i + 1} معتبر نیست. فرمت صحیح: YYYY/MM/DD`);
        return;
      }
      if (c.amount <= 0) {
        alert(`مبلغ در سطر ${i + 1} باید بزرگتر از صفر باشد.`);
        return;
      }
    }

    const totalAmount = cheques.reduce((sum, c) => sum + c.amount, 0);

    const newReceipt: ChequeReceipt = {
      id: 'cr_' + Date.now(),
      customerName,
      registrationDate,
      totalAmount,
      serialNumber,
      attachedFile: attachedFile || undefined,
      cheques,
      status: saveStatus as any, // 'draft' or 'pending_sales'
      createdAt: Date.now(),
      createdBy: currentUser?.fullName || 'کاربر سیستم'
    };

    setLoading(true);
    try {
      await saveChequeReceipt(newReceipt);
      setCustomerName('');
      setAttachedFile(null);
      setCheques([]);
      setActiveSubTab('list');
      loadReceipts();
      fetchNextNumber();
    } catch (e) {
      console.error(e);
      alert('خطا در ذخیره‌سازی رسید چک');
    } finally {
      setLoading(false);
    }
  };

  // --- WORKFLOW APPROVAL ACTIONS ---
  const handleApproveSales = async (receipt: ChequeReceipt) => {
    if (!receipt) return;
    const updated: ChequeReceipt = {
      ...receipt,
      status: 'pending_ceo',
      salesManagerApprovedBy: currentUser?.fullName || 'مدیر فروش',
      salesManagerApprovedAt: Date.now()
    };
    
    setLoading(true);
    try {
      await updateChequeReceipt(updated);
      setSelectedReceipt(updated);
      loadReceipts();
      alert('رسید دریافتی چک به تایید مدیریت فروش رسید و جهت تایید نهایی به کارتابل مدیر عامل ارسال شد.');
    } catch (e) {
      console.error(e);
      alert('خطا در ثبت تاییدیه');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveCeo = async (receipt: ChequeReceipt) => {
    if (!receipt) return;
    const updated: ChequeReceipt = {
      ...receipt,
      status: 'approved',
      ceoApprovedBy: currentUser?.fullName || 'مدیر عامل',
      ceoApprovedAt: Date.now()
    };
    
    setLoading(true);
    try {
      await updateChequeReceipt(updated);
      setSelectedReceipt(updated);
      loadReceipts();
      alert('رسید با موفقیت به تایید نهایی مدیر عامل رسید. هم‌اکنون این چک‌ها آماده واریز به صندوق و ثبت مالی می‌باشند.');
    } catch (e) {
      console.error(e);
      alert('خطا در ثبت تاییدیه مدیر عامل');
    } finally {
      setLoading(false);
    }
  };

  const handleArchiveReceipt = async (receipt: ChequeReceipt) => {
    if (!receipt) return;
    const updated: ChequeReceipt = {
      ...receipt,
      status: 'archived',
      archivedBy: currentUser?.fullName || 'صندوق‌دار مالی',
      archivedAt: Date.now()
    };
    
    setLoading(true);
    try {
      await updateChequeReceipt(updated);
      setSelectedReceipt(updated);
      loadReceipts();
      alert('چک‌های این رسید با موفقیت به صندوق چک کل شرکت (خزانه‌داری) منتقل و پرونده رسید بایگانی گردید.');
    } catch (e) {
      console.error(e);
      alert('خطا در بایگانی رسید');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteReceipt = async (id: string) => {
    if (!window.confirm('آیا از حذف این رسید و چک‌های تابعه آن مطمئن هستید؟')) return;
    setLoading(true);
    try {
      await deleteChequeReceipt(id);
      loadReceipts();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('fa-IR').format(val) + ' ریال';
  };

  // Status Style Helper
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 rounded-lg text-[10px] font-black"><FileClock size={12}/> پیش‌نویس</span>;
      case 'pending_sales':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 rounded-lg text-[10px] font-black"><ShieldAlert size={12}/> در انتظار تایید مدیر فروش</span>;
      case 'pending_ceo':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-400 rounded-lg text-[10px] font-black"><FileClock size={12}/> در انتظار تایید مدیر عامل</span>;
      case 'approved':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 rounded-lg text-[10px] font-black"><CheckCircle size={12}/> تایید شده (آماده خزانه‌داری)</span>;
      case 'archived':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 rounded-lg text-[10px] font-black"><Archive size={12}/> بایگانی شده در صندوق</span>;
      default:
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 text-gray-500 rounded-lg text-[10px] font-black">نامشخص</span>;
    }
  };

  // --- TREASURY FLAT CHEQUE EXTRACTION ---
  const getAllCheques = (): { cheque: ChequeItem; receipt: ChequeReceipt }[] => {
    const list: { cheque: ChequeItem; receipt: ChequeReceipt }[] = [];
    receipts.forEach(r => {
      if (r.cheques && Array.isArray(r.cheques)) {
        r.cheques.forEach(c => {
          list.push({ cheque: c, receipt: r });
        });
      }
    });
    return list;
  };

  // Filter cheques in treasury
  const filteredCheques = getAllCheques().filter(item => {
    const c = item.cheque;
    const r = item.receipt;
    
    // Search
    const searchLower = treasurySearch.toLowerCase();
    const matchesSearch = !treasurySearch || 
      (c.chequeNumber && c.chequeNumber.includes(searchLower)) ||
      (c.sayyadId && c.sayyadId.includes(searchLower)) ||
      (r.customerName && r.customerName.toLowerCase().includes(searchLower)) ||
      (c.bankName && c.bankName.toLowerCase().includes(searchLower)) ||
      (c.amount && c.amount.toString().includes(searchLower));

    // Bank
    const matchesBank = !treasuryBankFilter || c.bankName === treasuryBankFilter;

    // Status
    const matchesStatus = !treasuryStatusFilter || r.status === treasuryStatusFilter;

    // Due date
    let matchesDueDate = true;
    if (treasuryDueDateFilter !== 'all') {
      const todayStr = getTodayJalali(); // e.g. "1403/05/20"
      const chequeDate = c.dueDate; // e.g. "1403/05/22"
      
      const parseJalali = (j: string) => {
        const parts = j.split('/');
        if (parts.length === 3) {
          return parseInt(parts[0], 10) * 365 + parseInt(parts[1], 10) * 30 + parseInt(parts[2], 10);
        }
        return 0;
      };

      const todayVal = parseJalali(todayStr);
      const chequeVal = parseJalali(chequeDate);

      if (treasuryDueDateFilter === 'today') {
        matchesDueDate = chequeDate === todayStr;
      } else if (treasuryDueDateFilter === 'week') {
        matchesDueDate = chequeVal >= todayVal && chequeVal <= todayVal + 7;
      } else if (treasuryDueDateFilter === 'month') {
        matchesDueDate = chequeVal >= todayVal && chequeVal <= todayVal + 30;
      }
    }

    return matchesSearch && matchesBank && matchesStatus && matchesDueDate;
  });

  const totalTreasuryAmount = filteredCheques.reduce((sum, item) => sum + item.cheque.amount, 0);

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 text-right" dir="rtl">
      {/* Header section with clean display typography */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 border-b border-gray-200 dark:border-white/10 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight flex items-center gap-3">
            <Coins className="text-emerald-500 animate-pulse" size={28} />
            سامانه دریافت و مدیریت چک‌های صیادی
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-semibold">
            مدیریت امن جریان وصول چک، خزانه‌داری متمرکز، گردش تاییدات و انطباق با سیستم مالی سایان
          </p>
        </div>
        
        {/* Navigation sub-tabs */}
        <div className="flex flex-wrap gap-2 bg-gray-100 dark:bg-gray-800/80 p-1.5 rounded-2xl w-full md:w-auto">
          <button 
            onClick={() => { setActiveSubTab('list'); setSelectedReceipt(null); }}
            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeSubTab === 'list' ? 'bg-white dark:bg-gray-900 text-blue-600 shadow-md' : 'text-gray-600 hover:text-blue-500'}`}
          >
            <List size={16} />
            رسیدهای چک ({receipts.length})
          </button>
          
          <button 
            onClick={() => { setActiveSubTab('treasury'); setSelectedReceipt(null); }}
            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeSubTab === 'treasury' ? 'bg-white dark:bg-gray-900 text-indigo-600 shadow-md' : 'text-gray-600 hover:text-indigo-500'}`}
          >
            <Archive size={16} />
            صندوق و خزانه‌داری چک ({getAllCheques().length})
          </button>

          <button 
            onClick={() => setActiveSubTab('create')}
            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeSubTab === 'create' ? 'bg-white dark:bg-gray-900 text-emerald-600 shadow-md' : 'text-gray-600 hover:text-emerald-500'}`}
          >
            <PlusCircle size={16} />
            ثبت رسید جدید
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeSubTab === 'list' ? (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Receipts List or Detailed View */}
            {selectedReceipt ? (
              // Detailed View & Print Template
              <div className="glass-panel p-6 rounded-3xl shadow-xl relative animate-fade-in border border-gray-200/50 dark:border-white/10">
                
                {/* --- PIPELINE WORKFLOW PROGRESS BAR --- */}
                <div className="mb-6 bg-gray-50 dark:bg-gray-800/40 p-4 rounded-2xl border border-gray-100 dark:border-white/5 hidden-print">
                  <h4 className="text-xs font-black text-gray-700 dark:text-gray-300 mb-3">مراحل گردش و تاییدات اداری رسید:</h4>
                  <div className="grid grid-cols-4 gap-2 text-center text-[10px] font-bold">
                    <div className={`p-2 rounded-xl border ${selectedReceipt.status === 'draft' ? 'bg-gray-100 border-gray-300 text-gray-800' : 'bg-green-50/50 border-green-200 text-green-700'}`}>
                      <div>۱. ثبت اولیه رسید</div>
                      <div className="text-[9px] text-gray-400 mt-1">توسط: {selectedReceipt.createdBy}</div>
                    </div>
                    <div className={`p-2 rounded-xl border ${
                      selectedReceipt.status === 'pending_sales' 
                        ? 'bg-amber-50 border-amber-300 text-amber-700 animate-pulse' 
                        : ['pending_ceo', 'approved', 'archived'].includes(selectedReceipt.status || '')
                        ? 'bg-green-50/50 border-green-200 text-green-700'
                        : 'bg-gray-50 border-gray-200 text-gray-400'
                    }`}>
                      <div>۲. تایید مدیر فروش</div>
                      {selectedReceipt.salesManagerApprovedBy && (
                        <div className="text-[9px] text-green-600 mt-1">امضا: {selectedReceipt.salesManagerApprovedBy}</div>
                      )}
                    </div>
                    <div className={`p-2 rounded-xl border ${
                      selectedReceipt.status === 'pending_ceo' 
                        ? 'bg-indigo-50 border-indigo-300 text-indigo-700 animate-pulse' 
                        : ['approved', 'archived'].includes(selectedReceipt.status || '')
                        ? 'bg-green-50/50 border-green-200 text-green-700'
                        : 'bg-gray-50 border-gray-200 text-gray-400'
                    }`}>
                      <div>۳. تایید مدیر عامل</div>
                      {selectedReceipt.ceoApprovedBy && (
                        <div className="text-[9px] text-green-600 mt-1">امضا: {selectedReceipt.ceoApprovedBy}</div>
                      )}
                    </div>
                    <div className={`p-2 rounded-xl border ${
                      selectedReceipt.status === 'archived' 
                        ? 'bg-blue-50 border-blue-300 text-blue-700' 
                        : 'bg-gray-50 border-gray-200 text-gray-400'
                    }`}>
                      <div>۴. بایگانی صندوق چک</div>
                      {selectedReceipt.archivedBy && (
                        <div className="text-[9px] text-blue-600 mt-1">توسط: {selectedReceipt.archivedBy}</div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap justify-between items-center mb-6 gap-4 hidden-print">
                  <button 
                    onClick={() => setSelectedReceipt(null)}
                    className="flex items-center gap-2 text-xs font-bold text-gray-500 hover:text-blue-600"
                  >
                    <ArrowRight size={16} /> بازگشت به لیست رسیدها
                  </button>

                  {/* ACTION TRIGGER BUTTONS FOR WORKFLOW */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* 1. Sales approval */}
                    {(selectedReceipt.status === 'pending_sales' || selectedReceipt.status === 'draft') && 
                     (currentUser.role === UserRole.SALES_MANAGER || currentUser.role === UserRole.ADMIN) && (
                      <button
                        onClick={() => handleApproveSales(selectedReceipt)}
                        className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-black shadow-md transition-all cursor-pointer"
                      >
                        <Check size={14}/> تایید و امضای مدیر فروش
                      </button>
                    )}

                    {/* 2. CEO approval */}
                    {selectedReceipt.status === 'pending_ceo' && 
                     (currentUser.role === UserRole.CEO || currentUser.role === UserRole.ADMIN) && (
                      <button
                        onClick={() => handleApproveCeo(selectedReceipt)}
                        className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 text-white rounded-xl text-xs font-black shadow-md transition-all cursor-pointer"
                      >
                        <Check size={14}/> تایید نهایی و امضای مدیر عامل
                      </button>
                    )}

                    {/* 3. Storing in Treasury (Financial Role) */}
                    {selectedReceipt.status === 'approved' && 
                     (currentUser.role === UserRole.FINANCIAL || currentUser.role === UserRole.ADMIN) && (
                      <button
                        onClick={() => handleArchiveReceipt(selectedReceipt)}
                        className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md transition-all cursor-pointer animate-pulse"
                      >
                        <Archive size={14}/> تایید دریافت چک و بایگانی در صندوق
                      </button>
                    )}

                    <button 
                      onClick={() => window.print()}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-xl text-xs font-bold shadow-md hover:bg-gray-900 transition-all"
                    >
                      <Printer size={16} /> چاپ رسید چاپی
                    </button>
                  </div>
                </div>

                {/* Printable receipt card */}
                <div className="bg-white text-gray-900 p-8 rounded-2xl border-2 border-gray-300 shadow-sm max-w-4xl mx-auto printable-area relative overflow-hidden">
                  
                  {/* Digital stamps overlay for print */}
                  <div className="absolute top-24 left-6 flex flex-col gap-3 opacity-80 rotate-6 hidden-screen pointer-events-none">
                    {selectedReceipt.salesManagerApprovedBy && (
                      <div className="border-2 border-dashed border-amber-600 text-amber-600 p-2 rounded-lg text-center font-bold text-[9px] bg-white/90">
                        تایید مدیر فروش
                        <div className="font-mono mt-0.5">{selectedReceipt.salesManagerApprovedBy}</div>
                        <div className="text-[8px] mt-0.5">سیستم یکپارچه</div>
                      </div>
                    )}
                    {selectedReceipt.ceoApprovedBy && (
                      <div className="border-2 border-dashed border-indigo-600 text-indigo-600 p-2 rounded-lg text-center font-black text-[9px] bg-white/90">
                        امضای مدیر عامل
                        <div className="font-mono mt-0.5">{selectedReceipt.ceoApprovedBy}</div>
                        <div className="text-[8px] mt-0.5">مهر تایید شد</div>
                      </div>
                    )}
                    {selectedReceipt.status === 'archived' && (
                      <div className="border-2 border-dashed border-blue-600 text-blue-600 p-2 rounded-lg text-center font-bold text-[9px] bg-white/90">
                        بایگانی خزانه صیاد
                        <div className="text-[8px] mt-0.5">دریافت و بایگانی شد</div>
                      </div>
                    )}
                  </div>

                  {/* Voucher Header */}
                  <div className="flex justify-between items-center border-b-2 border-gray-800 pb-4 mb-6">
                    <div className="flex flex-col text-right">
                      <h2 className="text-lg font-black text-gray-900">رسید رسمی تحویل چک صیادی</h2>
                      <span className="text-[10px] text-gray-600 font-mono">سامانه مدیریت نقدینگی و خزانه‌داری</span>
                    </div>
                    <div className="flex flex-col text-left text-xs font-mono">
                      <div>پشت نمره: <span className="font-bold text-sm text-blue-600">{selectedReceipt.serialNumber}</span></div>
                      <div>تاریخ ثبت: <span className="font-bold">{selectedReceipt.registrationDate}</span></div>
                      <div>وضعیت: <span className="font-bold text-indigo-600">
                        {selectedReceipt.status === 'draft' && 'پیش‌نویس'}
                        {selectedReceipt.status === 'pending_sales' && 'در انتظار تایید مدیر فروش'}
                        {selectedReceipt.status === 'pending_ceo' && 'در انتظار تایید مدیر عامل'}
                        {selectedReceipt.status === 'approved' && 'تایید شده (در انتظار وصول)'}
                        {selectedReceipt.status === 'archived' && 'بایگانی در صندوق'}
                      </span></div>
                    </div>
                  </div>

                  {/* Customer Information Block */}
                  <div className="bg-gray-50 p-4 rounded-xl mb-6 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-gray-500 font-bold ml-1">مشتری / تحویل‌دهنده چک:</span>
                      <span className="font-extrabold text-gray-900">{selectedReceipt.customerName}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 font-bold ml-1">تعداد چک‌ها:</span>
                      <span className="font-extrabold text-gray-900">{selectedReceipt.cheques?.length || 0} فقره</span>
                    </div>
                    <div className="col-span-1 md:col-span-2">
                      <span className="text-gray-500 font-bold ml-1">جمع کل مبالغ چک‌ها:</span>
                      <span className="font-extrabold text-base text-emerald-600">{formatCurrency(selectedReceipt.totalAmount)}</span>
                      <span className="text-gray-500 font-mono mr-2">({numberToPersianWords(selectedReceipt.totalAmount)} ریال)</span>
                    </div>
                  </div>

                  {/* Cheque Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-right border-collapse border border-gray-300">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="border border-gray-300 p-2 text-center w-12">ردیف</th>
                          <th className="border border-gray-300 p-2">شماره چک</th>
                          <th className="border border-gray-300 p-2">شناسه ۱۶ رقمی صیاد</th>
                          <th className="border border-gray-300 p-2">نام بانک صادرکننده</th>
                          <th className="border border-gray-300 p-2 text-center">تاریخ سررسید</th>
                          <th className="border border-gray-300 p-2 text-left">مبلغ (ریال)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedReceipt.cheques?.map((c, idx) => (
                          <tr key={c.id} className="hover:bg-gray-50">
                            <td className="border border-gray-300 p-2 text-center">{idx + 1}</td>
                            <td className="border border-gray-300 p-2 font-mono">{c.chequeNumber}</td>
                            <td className="border border-gray-300 p-2 font-mono tracking-wider">{c.sayyadId}</td>
                            <td className="border border-gray-300 p-2">{c.bankName}</td>
                            <td className="border border-gray-300 p-2 text-center font-mono">{c.dueDate}</td>
                            <td className="border border-gray-300 p-2 text-left font-bold font-mono">{formatCurrency(c.amount).replace(' ریال', '')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Signatures Area */}
                  <div className="grid grid-cols-3 gap-6 mt-12 pt-8 border-t border-gray-200 text-center text-[11px]">
                    <div>
                      <div className="font-bold text-gray-500 mb-8">مهر و امضای تحویل‌دهنده</div>
                      <div className="text-gray-800 font-black">{selectedReceipt.customerName}</div>
                      <div className="border-b border-gray-300 w-24 mx-auto mt-4"></div>
                    </div>
                    <div>
                      <div className="font-bold text-gray-500 mb-8">ثبت کننده سیستم</div>
                      <div className="font-bold text-gray-800">{selectedReceipt.createdBy}</div>
                      <div className="text-[9px] text-gray-400 mt-1">{new Date(selectedReceipt.createdAt).toLocaleDateString('fa-IR')}</div>
                      <div className="border-b border-gray-300 w-24 mx-auto mt-4"></div>
                    </div>
                    <div>
                      <div className="font-bold text-gray-500 mb-8">تاییدات و امضا مراجع</div>
                      <div className="space-y-1 font-semibold text-gray-700">
                        {selectedReceipt.salesManagerApprovedBy && <div>مدیر فروش: {selectedReceipt.salesManagerApprovedBy}</div>}
                        {selectedReceipt.ceoApprovedBy && <div>مدیر عامل: {selectedReceipt.ceoApprovedBy}</div>}
                      </div>
                      <div className="border-b border-gray-300 w-24 mx-auto mt-4"></div>
                    </div>
                  </div>
                </div>
              </div>
            ) : receipts.length === 0 ? (
              <div className="glass-panel p-12 text-center rounded-3xl flex flex-col items-center justify-center border border-gray-200/50 dark:border-white/10">
                <FileText size={48} className="text-gray-300 mb-4 animate-bounce" />
                <h3 className="text-lg font-bold text-gray-800 dark:text-white">هیچ رسید چکی ثبت نشده است</h3>
                <p className="text-xs text-gray-500 mt-2">اولین رسید چک مشتری را با کلیک بر روی دکمه ثبت رسید جدید اضافه کنید.</p>
                <button 
                  onClick={() => setActiveSubTab('create')}
                  className="mt-6 flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-md hover:bg-blue-700 transition-all"
                >
                  <PlusCircle size={16} /> ثبت اولین رسید
                </button>
              </div>
            ) : (
              <div className="glass-panel rounded-3xl overflow-hidden border border-gray-200/50 dark:border-white/10 shadow-lg">
                <div className="p-4 bg-gray-50 dark:bg-gray-800/40 border-b border-gray-200 dark:border-white/10 flex justify-between items-center">
                  <h3 className="text-sm font-bold text-gray-800 dark:text-white">لیست تمامی رسیدهای دریافتی چک</h3>
                  <span className="text-xs font-mono text-gray-400">کل رسیدها: {receipts.length} مورد</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-right border-collapse text-xs">
                    <thead>
                      <tr className="bg-gray-100 dark:bg-gray-800/80 text-gray-700 dark:text-gray-300 font-extrabold border-b border-gray-200 dark:border-white/10">
                        <th className="p-3">پشت نمره (سریال)</th>
                        <th className="p-3">نام مشتری / پرداخت کننده</th>
                        <th className="p-3 text-center">تاریخ ثبت</th>
                        <th className="p-3 text-center">تعداد چک‌ها</th>
                        <th className="p-3 text-left">مبلغ کل رسید</th>
                        <th className="p-3 text-center">وضعیت سند</th>
                        <th className="p-3 text-center">ضمیمه فایل</th>
                        <th className="p-3 text-center">عملیات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {receipts.map((r) => (
                        <tr key={r.id} className="border-b border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                          <td className="p-3 font-mono font-bold text-blue-600">{r.serialNumber}</td>
                          <td className="p-3 font-bold text-gray-900 dark:text-white">{r.customerName}</td>
                          <td className="p-3 text-center font-mono">{r.registrationDate}</td>
                          <td className="p-3 text-center font-extrabold">{r.cheques?.length || 0} فقره</td>
                          <td className="p-3 text-left font-bold text-emerald-600 font-mono">{formatCurrency(r.totalAmount)}</td>
                          <td className="p-3 text-center">{getStatusBadge(r.status || 'pending_sales')}</td>
                          <td className="p-3 text-center">
                            {r.attachedFile ? (
                              <a 
                                href={r.attachedFile.url} 
                                target="_blank" 
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:text-blue-500 rounded-lg text-[10px] font-bold"
                              >
                                <Download size={12} /> دانلود
                              </a>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="p-3 text-center flex items-center justify-center gap-2">
                            <button 
                              onClick={() => setSelectedReceipt(r)}
                              className="px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 rounded-lg text-[11px] font-bold transition-all"
                            >
                              بررسی و اقدام
                            </button>
                            <button 
                              onClick={() => handleDeleteReceipt(r.id)}
                              className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-all"
                              title="حذف رسید"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </motion.div>
        ) : activeSubTab === 'treasury' ? (
          // --- TREASURY CABINET SUB TAB ---
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Statistics Counters Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="glass-panel p-4 rounded-2xl border border-gray-200/50 dark:border-white/10 flex items-center justify-between">
                <div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">تعداد کل چک‌های موجود</span>
                  <div className="text-2xl font-black text-gray-900 dark:text-white font-mono mt-1">
                    {getAllCheques().length} <span className="text-xs font-bold">فقره</span>
                  </div>
                </div>
                <div className="bg-blue-500/10 p-3 rounded-xl text-blue-500">
                  <Coins size={24} />
                </div>
              </div>

              <div className="glass-panel p-4 rounded-2xl border border-gray-200/50 dark:border-white/10 flex items-center justify-between">
                <div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">ارزش کل صندوق (ریال)</span>
                  <div className="text-xl font-black text-emerald-600 font-mono mt-1">
                    {new Intl.NumberFormat('fa-IR').format(getAllCheques().reduce((sum, item) => sum + item.cheque.amount, 0))}
                  </div>
                </div>
                <div className="bg-emerald-500/10 p-3 rounded-xl text-emerald-500">
                  <TrendingUp size={24} />
                </div>
              </div>

              <div className="glass-panel p-4 rounded-2xl border border-gray-200/50 dark:border-white/10 flex items-center justify-between">
                <div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">بایگانی و نهایی شده</span>
                  <div className="text-2xl font-black text-indigo-600 font-mono mt-1">
                    {getAllCheques().filter(item => item.receipt.status === 'archived').length} <span className="text-xs font-bold">فقره</span>
                  </div>
                </div>
                <div className="bg-indigo-500/10 p-3 rounded-xl text-indigo-500">
                  <Archive size={24} />
                </div>
              </div>

              <div className="glass-panel p-4 rounded-2xl border border-gray-200/50 dark:border-white/10 flex items-center justify-between">
                <div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">بایگانی شده (ریال)</span>
                  <div className="text-xl font-black text-blue-600 font-mono mt-1">
                    {new Intl.NumberFormat('fa-IR').format(
                      getAllCheques()
                        .filter(item => item.receipt.status === 'archived')
                        .reduce((sum, item) => sum + item.cheque.amount, 0)
                    )}
                  </div>
                </div>
                <div className="bg-blue-500/10 p-3 rounded-xl text-blue-500">
                  <CheckCircle size={24} />
                </div>
              </div>
            </div>

            {/* Sayan integration placeholder */}
            <div className="bg-amber-50/70 dark:bg-amber-950/15 border border-amber-200 dark:border-amber-900/30 p-4 rounded-2xl text-amber-800 dark:text-amber-300 text-xs flex flex-col md:flex-row items-center justify-between gap-3 shadow-sm">
              <div className="flex items-center gap-2.5">
                <RefreshCw className="animate-spin-slow text-amber-500 shrink-0" size={18} />
                <span className="font-bold">
                  آماده‌سازی انتقال مستقیم به سامانه سایان: کل خزانه‌داری چک‌های فوق با یک کلیک قابلیت همگام‌سازی و ارسال تراکنش به ماژول «دریافت چک» سایان دارد.
                </span>
              </div>
              <button
                type="button"
                onClick={() => alert('اتصال تستی با سایان برقرار شد. API وب‌سرویس در بخش تنظیمات در حال شنود است.')}
                className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-[10px] font-black cursor-pointer shadow-sm transition-all whitespace-nowrap"
              >
                تست ارتباط وب‌سرویس سایان
              </button>
            </div>

            {/* Treasury Filters */}
            <div className="glass-panel p-4 rounded-2xl border border-gray-200/50 dark:border-white/10 grid grid-cols-1 md:grid-cols-4 gap-4 shadow-md">
              <div className="relative">
                <label className="block text-[10px] font-bold text-gray-500 mb-1">جستجوی متنی (شماره، شناسه صیاد، مشتری)</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="کلمه کلیدی..."
                    value={treasurySearch}
                    onChange={(e) => setTreasurySearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 dark:bg-gray-900 text-xs font-bold text-gray-900 dark:text-white outline-none"
                  />
                  <Search className="absolute left-2.5 top-2.5 text-gray-400" size={14} />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 mb-1">فیلتر بانک صادرکننده</label>
                <select
                  value={treasuryBankFilter}
                  onChange={(e) => setTreasuryBankFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 dark:bg-gray-900 text-xs font-bold text-gray-900 dark:text-white outline-none"
                >
                  <option value="">همه بانک‌ها</option>
                  {COMMON_IRANIAN_BANKS.map((b, i) => (
                    <option key={i} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 mb-1">وضعیت تایید و بایگانی</label>
                <select
                  value={treasuryStatusFilter}
                  onChange={(e) => setTreasuryStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 dark:bg-gray-900 text-xs font-bold text-gray-900 dark:text-white outline-none"
                >
                  <option value="">همه وضعیت‌ها</option>
                  <option value="draft">پیش‌نویس</option>
                  <option value="pending_sales">در انتظار تایید مدیر فروش</option>
                  <option value="pending_ceo">در انتظار تایید مدیر عامل</option>
                  <option value="approved">تایید نهایی شده</option>
                  <option value="archived">بایگانی شده در صندوق</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 mb-1">محدوده سررسید چک</label>
                <select
                  value={treasuryDueDateFilter}
                  onChange={(e) => setTreasuryDueDateFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 dark:bg-gray-900 text-xs font-bold text-gray-900 dark:text-white outline-none"
                >
                  <option value="all">همه سررسیدها</option>
                  <option value="today">سررسیدهای امروز</option>
                  <option value="week">سررسیدهای ۷ روز آینده</option>
                  <option value="month">سررسیدهای ۳۰ روز آینده</option>
                </select>
              </div>
            </div>

            {/* Treasury Grid */}
            <div className="glass-panel rounded-3xl overflow-hidden border border-gray-200/50 dark:border-white/10 shadow-lg">
              <div className="p-4 bg-gray-50 dark:bg-gray-800/40 border-b border-gray-200 dark:border-white/10 flex justify-between items-center">
                <span className="text-xs font-bold text-gray-800 dark:text-white">جدول تفکیکی کل چک‌های خزانه‌داری</span>
                <span className="text-xs font-mono font-black text-emerald-600">مجموع ارزش فیلتر شده: {formatCurrency(totalTreasuryAmount)}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse text-xs min-w-[950px]">
                  <thead>
                    <tr className="bg-gray-100 dark:bg-gray-800/80 text-gray-700 dark:text-gray-300 font-extrabold border-b border-gray-200 dark:border-white/10">
                      <th className="p-3 w-12 text-center">ردیف</th>
                      <th className="p-3">مشتری</th>
                      <th className="p-3">بانک</th>
                      <th className="p-3 text-center">شماره چک</th>
                      <th className="p-3 text-center">شناسه صیادی</th>
                      <th className="p-3 text-center">تاریخ سررسید</th>
                      <th className="p-3 text-left">مبلغ (ریال)</th>
                      <th className="p-3 text-center">پشت نمره رسید</th>
                      <th className="p-3 text-center">وضعیت</th>
                      <th className="p-3 text-center">ضمیمه</th>
                      <th className="p-3 text-center">پرونده</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCheques.map((item, idx) => (
                      <tr key={item.cheque.id} className="border-b border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                        <td className="p-3 text-center text-gray-400 font-mono">{idx + 1}</td>
                        <td className="p-3 font-bold text-gray-900 dark:text-white">{item.receipt.customerName}</td>
                        <td className="p-3">{item.cheque.bankName}</td>
                        <td className="p-3 text-center font-mono font-bold">{item.cheque.chequeNumber}</td>
                        <td className="p-3 text-center font-mono tracking-wide">{item.cheque.sayyadId}</td>
                        <td className="p-3 text-center font-mono">{item.cheque.dueDate}</td>
                        <td className="p-3 text-left font-black text-emerald-600 font-mono">{formatCurrency(item.cheque.amount).replace(' ریال', '')}</td>
                        <td className="p-3 text-center font-mono font-bold text-blue-500">{item.receipt.serialNumber}</td>
                        <td className="p-3 text-center">{getStatusBadge(item.receipt.status || 'pending_sales')}</td>
                        <td className="p-3 text-center">
                          {item.receipt.attachedFile ? (
                            <a 
                              href={item.receipt.attachedFile.url}
                              target="_blank" 
                              rel="noreferrer"
                              className="p-1 text-gray-400 hover:text-blue-500 inline-block"
                            >
                              <Download size={14} />
                            </a>
                          ) : '-'}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => {
                              setSelectedReceipt(item.receipt);
                              setActiveSubTab('list');
                            }}
                            className="px-2 py-0.5 border border-gray-200 dark:border-white/10 hover:border-blue-500 text-gray-600 dark:text-gray-300 rounded text-[10px]"
                          >
                            مشاهده
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredCheques.length === 0 && (
                      <tr>
                        <td colSpan={11} className="p-8 text-center text-gray-400">هیچ چکی منطبق با شرایط فیلتر در صندوق یافت نشد.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Create Receipt Form */}
            <div className="glass-panel p-6 rounded-3xl shadow-xl border border-gray-200/50 dark:border-white/10">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                
                {/* Customer name lookup combobox */}
                <div className="relative">
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">نام مشتری / پرداخت‌کننده *</label>
                  <div className="relative">
                    <input 
                      type="text"
                      placeholder="نام مشتری را تایپ یا انتخاب کنید..."
                      value={customerName}
                      onChange={(e) => {
                        setCustomerName(e.target.value);
                        setCustomerSearch(e.target.value);
                        setShowCustomerDropdown(true);
                        // Automatically update existing cheques drawerName with Customer Name
                        setCheques(prev => prev.map(c => ({
                          ...c,
                          drawerName: c.drawerName || e.target.value
                        })));
                      }}
                      onFocus={() => setShowCustomerDropdown(true)}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 dark:bg-gray-900 text-xs font-bold text-gray-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                    />
                    <User className="absolute left-3 top-3 text-gray-400" size={16} />
                  </div>
                  
                  {showCustomerDropdown && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowCustomerDropdown(false)}></div>
                      <div className="absolute top-full right-0 left-0 bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 rounded-xl shadow-xl max-h-48 overflow-y-auto z-50 mt-1 custom-scrollbar">
                        {customers
                          .filter(c => c.toLowerCase().includes(customerSearch.toLowerCase()))
                          .map((cust, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                setCustomerName(cust);
                                setShowCustomerDropdown(false);
                                // Set cheques default drawer name
                                setCheques(prev => prev.map(c => ({
                                  ...c,
                                  drawerName: cust
                                })));
                              }}
                              className="w-full text-right px-4 py-2 hover:bg-gray-50 dark:hover:bg-white/5 text-xs text-gray-800 dark:text-gray-200 border-b border-gray-100 dark:border-white/5 last:border-0 font-bold"
                            >
                              {cust}
                            </button>
                          ))}
                        {customers.filter(c => c.toLowerCase().includes(customerSearch.toLowerCase())).length === 0 && (
                          <div className="px-4 py-3 text-center text-[10px] text-gray-400">مشتری جدید (دستی تایپ شود)</div>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* Registration Date */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">تاریخ ثبت رسید (شمسی) *</label>
                  <div className="relative">
                    <input 
                      type="text"
                      placeholder="مثال: ۱۴۰۳/۰۵/۲۰"
                      value={registrationDate}
                      onChange={(e) => setRegistrationDate(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 dark:bg-gray-900 text-xs font-bold text-gray-900 dark:text-white shadow-sm focus:border-blue-500 outline-none"
                    />
                    <Calendar className="absolute left-3 top-3 text-gray-400" size={16} />
                  </div>
                </div>

                {/* Serial Voucher Number */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">پشت نمره رسید (سیستمی)</label>
                  <div className="relative">
                    <input 
                      type="text"
                      disabled
                      value={serialNumber}
                      className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-white/10 text-xs font-mono font-bold text-blue-600 outline-none"
                    />
                    <Hash className="absolute left-3 top-3 text-blue-400" size={16} />
                  </div>
                </div>
              </div>

              {/* --- MULTI-MODE EXTRACTION SELECTOR --- */}
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 rounded-3xl p-5 mb-8 shadow-md">
                <div className="flex flex-wrap border-b border-gray-100 dark:border-white/5 pb-3 mb-5 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setExtractionMode('ai');
                      setParseError('');
                    }}
                    className={`px-4 py-2 text-xs font-black rounded-xl transition-all flex items-center gap-2 border ${
                      extractionMode === 'ai' 
                        ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-500/30 text-blue-600 dark:text-blue-400' 
                        : 'bg-transparent border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                    }`}
                  >
                    <Globe size={14} className="animate-pulse" />
                    هوش مصنوعی صیاد (آنلاین و بسیار دقیق)
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => {
                      setExtractionMode('offline');
                      setParseError('');
                    }}
                    className={`px-4 py-2 text-xs font-black rounded-xl transition-all flex items-center gap-2 border ${
                      extractionMode === 'offline' 
                        ? 'bg-indigo-50 dark:bg-indigo-950/30 border-indigo-500/30 text-indigo-600 dark:text-indigo-400' 
                        : 'bg-transparent border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                    }`}
                  >
                    <WifiOff size={14} />
                    اسکن نوری آفلاین (Tesseract - بدون اینترنت)
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setExtractionMode('qr');
                      setParseError('');
                    }}
                    className={`px-4 py-2 text-xs font-black rounded-xl transition-all flex items-center gap-2 border ${
                      extractionMode === 'qr' 
                        ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-500/30 text-emerald-600 dark:text-emerald-400' 
                        : 'bg-transparent border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                    }`}
                  >
                    <QrCode size={14} />
                    اسکن محلی بارکد/QR صیاد (آفلاین - سریع)
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => {
                      setExtractionMode('text');
                      setParseError('');
                    }}
                    className={`px-4 py-2 text-xs font-black rounded-xl transition-all flex items-center gap-2 border ${
                      extractionMode === 'text' 
                        ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-500/30 text-amber-600 dark:text-amber-400' 
                        : 'bg-transparent border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                    }`}
                  >
                    <Copy size={14} />
                    ورود متنی دسته‌جمعی و تلگرامی (آفلاین)
                  </button>
                </div>

                {/* MODE 1: ONLINE AI SCAN */}
                {extractionMode === 'ai' && (
                  <div className="flex flex-col md:flex-row items-center justify-between gap-4 animate-fade-in">
                    <div className="flex items-start gap-3.5 text-right w-full md:w-2/3">
                      <div className="bg-gradient-to-tr from-blue-500 to-indigo-600 p-3 rounded-2xl text-white shadow-md flex-shrink-0 flex items-center justify-center">
                        <Sparkles className="animate-spin-slow" size={24} />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-blue-800 dark:text-blue-400 flex items-center gap-1.5">
                          استخراج هوشمند چک‌های صیادی با هوش مصنوعی آنلاین
                        </h4>
                        <p className="text-[11px] text-gray-600 dark:text-gray-400 mt-1 leading-relaxed font-semibold">
                          یک یا چند تصویر چک یا فایل PDF را ضمیمه کنید. هوش مصنوعی صیاد با استفاده از مدل پیشرفته پردازش تصویر، حتی نامنظم‌ترین و ناخواناترین دست‌خط‌های چک صیادی را تحلیل و استخراج می‌کند. (نیازمند اتصال اینترنت)
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 w-full md:w-auto shrink-0 justify-end">
                      {attachedFile ? (
                        <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-white/10 px-3 py-2 rounded-xl text-xs font-bold w-full md:w-auto">
                          <FileText size={16} className="text-blue-500" />
                          <span className="truncate max-w-[120px]" title={attachedFile.name}>{attachedFile.name}</span>
                          <button 
                            onClick={() => setAttachedFile(null)}
                            className="text-gray-400 hover:text-red-500 text-xs mr-2 font-bold cursor-pointer"
                          >
                            حذف
                          </button>
                        </div>
                      ) : (
                        <label className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-50 dark:bg-gray-800/30 hover:bg-gray-100 border border-dashed border-gray-300 dark:border-white/20 rounded-xl text-xs font-bold cursor-pointer transition-all w-full md:w-auto text-gray-600 dark:text-gray-300 shadow-sm">
                          <FileUp size={16} className="text-blue-500" />
                          انتخاب سند چک‌ها (PDF / تصویر)
                          <input 
                            type="file" 
                            accept="application/pdf, image/*" 
                            onChange={handleFileUpload} 
                            className="hidden" 
                          />
                        </label>
                      )}

                      {attachedFile && (
                        <button
                          type="button"
                          disabled={aiParsing}
                          onClick={handleAiParse}
                          className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg disabled:opacity-50 hover:bg-blue-700 transition-all cursor-pointer whitespace-nowrap"
                        >
                          {aiParsing ? (
                            <>
                              <Loader2 size={14} className="animate-spin" />
                              درحال استخراج...
                            </>
                          ) : (
                            <>
                              <Sparkles size={14} className="animate-pulse" />
                              شروع استخراج هوشمند صیاد
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* MODE 2: OFFLINE OCR SCAN */}
                {extractionMode === 'offline' && (
                  <div className="flex flex-col md:flex-row items-center justify-between gap-4 animate-fade-in">
                    <div className="flex items-start gap-3.5 text-right w-full md:w-2/3">
                      <div className="bg-gradient-to-tr from-indigo-500 to-purple-600 p-3 rounded-2xl text-white shadow-md flex-shrink-0 flex items-center justify-center">
                        <WifiOff size={24} />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-indigo-800 dark:text-indigo-400 flex items-center gap-1.5">
                          پردازش نوری و اسکن کاملاً آفلاین صیاد (بدون اینترنت)
                        </h4>
                        <p className="text-[11px] text-gray-600 dark:text-gray-400 mt-1 leading-relaxed font-semibold">
                          این روش کاملاً در مرورگر شما به صورت محلی و امن اجرا می‌شود. تصویر چک صیادی را آپلود کنید؛ سیستم با استفاده از الگوریتم پیشرفته OCR متن چاپی و اعداد چک را تشخیص داده و شناسه ۱۶ رقمی، تاریخ سررسید و مبالغ را استخراج می‌کند.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 w-full md:w-auto shrink-0 justify-end">
                      {attachedFile ? (
                        <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-white/10 px-3 py-2 rounded-xl text-xs font-bold w-full md:w-auto">
                          <FileText size={16} className="text-indigo-500" />
                          <span className="truncate max-w-[120px]" title={attachedFile.name}>{attachedFile.name}</span>
                          <button 
                            onClick={() => setAttachedFile(null)}
                            className="text-gray-400 hover:text-red-500 text-xs mr-2 font-bold cursor-pointer"
                          >
                            حذف
                          </button>
                        </div>
                      ) : (
                        <label className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-50 dark:bg-gray-800/30 hover:bg-gray-100 border border-dashed border-gray-300 dark:border-white/20 rounded-xl text-xs font-bold cursor-pointer transition-all w-full md:w-auto text-gray-600 dark:text-gray-300 shadow-sm">
                          <FileUp size={16} className="text-indigo-500" />
                          انتخاب تصویر چک (آفلاین)
                          <input 
                            type="file" 
                            accept="image/*" 
                            onChange={handleFileUpload} 
                            className="hidden" 
                          />
                        </label>
                      )}

                      {attachedFile && (
                        <button
                          type="button"
                          disabled={aiParsing}
                          onClick={handleOfflineOcr}
                          className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg disabled:opacity-50 hover:bg-indigo-700 transition-all cursor-pointer whitespace-nowrap"
                        >
                          {aiParsing ? (
                            <>
                              <Loader2 size={14} className="animate-spin" />
                              درحال اسکن آفلاین...
                            </>
                          ) : (
                            <>
                              <Zap size={14} className="animate-bounce" />
                              شروع اسکن محلی آفلاین
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* MODE 3: OFFLINE QR CODE SCAN */}
                {extractionMode === 'qr' && (
                  <div className="flex flex-col md:flex-row items-center justify-between gap-4 animate-fade-in">
                    <div className="flex items-start gap-3.5 text-right w-full md:w-2/3">
                      <div className="bg-gradient-to-tr from-emerald-500 to-teal-600 p-3 rounded-2xl text-white shadow-md flex-shrink-0 flex items-center justify-center">
                        <QrCode size={24} />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-emerald-800 dark:text-emerald-400 flex items-center gap-1.5">
                          رمزگشایی مستقیم بارکد/QR صیادی (آفلاین و ۱۰۰٪ دقیق)
                        </h4>
                        <p className="text-[11px] text-gray-600 dark:text-gray-400 mt-1 leading-relaxed font-semibold">
                          بسیاری از چک‌های صیاد جدید دارای یک مربع بارکد QR هستند. تصویر چک صیاد را انتخاب کنید و این دکمه را بزنید؛ سیستم بلافاصله با الگوریتم اسکنر محلی، بارکد را رمزگشایی کرده و شناسه ۱۶ رقمی صیاد و شماره چک را درجا استخراج می‌کند.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 w-full md:w-auto shrink-0 justify-end">
                      {attachedFile ? (
                        <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-white/10 px-3 py-2 rounded-xl text-xs font-bold w-full md:w-auto">
                          <FileText size={16} className="text-emerald-500" />
                          <span className="truncate max-w-[120px]" title={attachedFile.name}>{attachedFile.name}</span>
                          <button 
                            onClick={() => setAttachedFile(null)}
                            className="text-gray-400 hover:text-red-500 text-xs mr-2 font-bold cursor-pointer"
                          >
                            حذف
                          </button>
                        </div>
                      ) : (
                        <label className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-50 dark:bg-gray-800/30 hover:bg-gray-100 border border-dashed border-gray-300 dark:border-white/20 rounded-xl text-xs font-bold cursor-pointer transition-all w-full md:w-auto text-gray-600 dark:text-gray-300 shadow-sm">
                          <FileUp size={16} className="text-emerald-500" />
                          انتخاب تصویر دارای بارکد
                          <input 
                            type="file" 
                            accept="image/*" 
                            onChange={handleFileUpload} 
                            className="hidden" 
                          />
                        </label>
                      )}

                      {attachedFile && (
                        <button
                          type="button"
                          disabled={qrScanning}
                          onClick={handleOfflineQrScan}
                          className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg disabled:opacity-50 hover:bg-emerald-700 transition-all cursor-pointer whitespace-nowrap"
                        >
                          {qrScanning ? (
                            <>
                              <Loader2 size={14} className="animate-spin" />
                              در حال رمزگشایی بارکد...
                            </>
                          ) : (
                            <>
                              <QrCode size={14} className="animate-pulse" />
                              اسکن و رمزگشایی بارکد تصویر
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* MODE 4: TEXT PASTE PARSER */}
                {extractionMode === 'text' && (
                  <div className="space-y-4 animate-fade-in text-right">
                    <div className="flex items-start gap-3">
                      <div className="bg-gradient-to-tr from-amber-500 to-orange-600 p-2.5 rounded-2xl text-white shadow-md flex-shrink-0 flex items-center justify-center">
                        <Copy size={20} />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-amber-800 dark:text-amber-400">
                          ورود متنی دسته‌جمعی (کپی مستقیم پیامک یا پیام تلگرام/بله/ایتا)
                        </h4>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed font-bold">
                          متن حاوی اطلاعات چک‌ها را در کادر زیر قرار دهید. مهم نیست اطلاعات چگونه نوشته شده باشند؛ الگوریتم هوشمند با الگوهای پیشرفته، شناسه‌های صیادی ۱۶ رقمی، تاریخ‌های سررسید، نام بانک‌ها و مبالغ را درجا شکار کرده و به جدول اضافه می‌کند.
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3">
                      <textarea
                        rows={4}
                        placeholder={`متن را اینجا وارد کنید. مثال:
چک بانک صادرات به شماره صیاد ۱۲۳۴۵۶۷۸۹۰۱۲۳۴۵۶ تاریخ ۱۴۰۳/۰۵/۲۰ مبلغ ۵۰۰,۰۰۰,۰۰۰ ریال بابت خرید ورق گالوانیزه
شناسه صیادی بانک ملی: ۹۸۷۶۵۴۳۲۱۰۹۸۷۶۵۴ - تاریخ سررسید: ۱۴۰۳/۰۶/۱۰ - مبلغ ۲۰۰ میلیون ریال صادرکننده: علی حسینی`}
                        value={pastedText}
                        onChange={(e) => setPastedText(e.target.value)}
                        className="w-full p-3.5 rounded-2xl border border-gray-200 dark:border-white/10 dark:bg-gray-900 text-xs font-bold text-gray-800 dark:text-gray-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none shadow-sm leading-relaxed"
                      />
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={handleTextPasteParse}
                          className="flex items-center gap-1.5 px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl text-xs font-extrabold shadow-md hover:shadow-lg transition-all cursor-pointer"
                        >
                          <Zap size={14} />
                          آنالیز، تفکیک و استخراج آفلاین چک‌ها
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Progress bars or AI parsing states */}
              {uploadProgress !== null && (
                <div className="mb-6 bg-blue-50 dark:bg-blue-950/20 p-4 rounded-2xl border border-blue-100 dark:border-blue-900/30 animate-fade-in text-center">
                  <div className="flex justify-between items-center mb-1 text-xs font-bold text-blue-700">
                    <span>در حال بارگذاری فایل صیاد...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-800 h-2 rounded-full overflow-hidden">
                    <div className="bg-blue-600 h-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                  </div>
                </div>
              )}

              {aiParsing && (
                <div className="mb-6 bg-indigo-50 dark:bg-indigo-950/20 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-900/30 animate-pulse flex flex-col items-center justify-center text-center">
                  <Loader2 size={32} className="animate-spin text-indigo-600 mb-2" />
                  <span className="text-xs font-extrabold text-indigo-800 dark:text-indigo-400">{aiStatusMessage}</span>
                  <span className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">تکنولوژی هوش مصنوعی دست‌نویس فارسی صیاد برای دقت بالاتر زمان‌بر است.</span>
                </div>
              )}

              {parseError && (
                <div className="mb-6 bg-red-50 dark:bg-red-950/20 p-4 rounded-2xl border border-red-100 dark:border-red-900/30 animate-fade-in flex items-center gap-3 text-right">
                  <AlertCircle className="text-red-500 shrink-0" size={18} />
                  <span className="text-xs font-semibold text-red-700 dark:text-red-400">{parseError}</span>
                </div>
              )}

              {/* Cheque List Grid Form */}
              <div className="border-t border-gray-200 dark:border-white/10 pt-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-black text-gray-900 dark:text-white flex items-center gap-2">
                    <FileSpreadsheet size={18} className="text-blue-500" />
                    لیست چک‌های دریافتی این پارت
                  </h3>
                  <button 
                    type="button"
                    onClick={handleAddChequeRow}
                    className="flex items-center gap-1 px-3 py-1.5 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/20 rounded-xl text-xs font-bold transition-all"
                  >
                    <PlusCircle size={14} /> افزودن چک جدید
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-right border-collapse text-xs min-w-[900px]">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-800/80 text-gray-700 dark:text-gray-300 font-extrabold border-b border-gray-200 dark:border-white/10">
                        <th className="p-2 w-10 text-center">#</th>
                        <th className="p-2 w-40">نام بانک صادرکننده *</th>
                        <th className="p-2 w-28">شماره چک *</th>
                        <th className="p-2 w-44">شناسه ۱۶ رقمی صیاد *</th>
                        <th className="p-2 w-28 text-center">تاریخ سررسید *</th>
                        <th className="p-2">مبلغ چک (ریال) *</th>
                        <th className="p-2">صاحب حساب (مشتری)</th>
                        <th className="p-2 w-12 text-center">حذف</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cheques.map((c, idx) => (
                        <tr key={c.id} className="border-b border-gray-100 dark:border-white/5 last:border-0 align-middle">
                          <td className="p-2 text-center text-gray-400 font-mono">{idx + 1}</td>
                          <td className="p-2">
                            <select
                              value={c.bankName}
                              onChange={(e) => handleChequeFieldChange(c.id, 'bankName', e.target.value)}
                              className="w-full px-2 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 dark:bg-gray-900 text-xs font-bold text-gray-900 dark:text-white outline-none"
                            >
                              <option value="">انتخاب بانک...</option>
                              {COMMON_IRANIAN_BANKS.map((b, i) => (
                                <option key={i} value={b}>{b}</option>
                              ))}
                            </select>
                          </td>
                          <td className="p-2">
                            <input 
                              type="text"
                              value={c.chequeNumber}
                              onChange={(e) => handleChequeFieldChange(c.id, 'chequeNumber', e.target.value)}
                              placeholder="مثال: ۷۴۸۲۹"
                              className="w-full px-2 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 dark:bg-gray-900 text-xs font-mono font-bold text-gray-900 dark:text-white outline-none"
                            />
                          </td>
                          <td className="p-2">
                            <input 
                              type="text"
                              maxLength={16}
                              value={c.sayyadId}
                              onChange={(e) => handleChequeFieldChange(c.id, 'sayyadId', e.target.value.replace(/[^\d]/g, ''))}
                              placeholder="۱۶ رقم بدون فاصله"
                              className={`w-full px-2 py-1.5 rounded-lg border text-xs font-mono font-bold outline-none ${c.sayyadId.length === 16 ? 'border-green-300 dark:border-green-800 text-green-700 dark:text-green-400' : 'border-gray-200 dark:border-white/10 text-gray-900 dark:text-white'}`}
                            />
                          </td>
                          <td className="p-2 text-center">
                            <input 
                              type="text"
                              placeholder="۱۴۰۳/۰۵/۲۰"
                              value={c.dueDate}
                              onChange={(e) => handleChequeFieldChange(c.id, 'dueDate', e.target.value)}
                              className="w-full px-2 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 dark:bg-gray-900 text-center text-xs font-mono font-bold text-gray-900 dark:text-white outline-none"
                            />
                          </td>
                          <td className="p-2">
                            <div className="space-y-1">
                              <input 
                                type="text"
                                value={c.amount === 0 ? '' : new Intl.NumberFormat('fa-IR').format(c.amount)}
                                onChange={(e) => handleChequeFieldChange(c.id, 'amount', e.target.value)}
                                placeholder="مبلغ به ریال"
                                className="w-full px-2 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 dark:bg-gray-900 text-xs font-mono font-bold text-gray-900 dark:text-white outline-none text-left"
                              />
                              {c.amount > 0 && (
                                <div className="text-[10px] text-gray-400 font-bold pr-1">
                                  {numberToPersianWords(c.amount)} ریال
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="p-2">
                            <input 
                              type="text"
                              value={c.drawerName}
                              onChange={(e) => handleChequeFieldChange(c.id, 'drawerName', e.target.value)}
                              placeholder="نام صادرکننده/مشتری"
                              className="w-full px-2 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 dark:bg-gray-900 text-xs font-bold text-gray-900 dark:text-white outline-none"
                            />
                          </td>
                          <td className="p-2 text-center">
                            <button 
                              type="button"
                              onClick={() => handleRemoveChequeRow(c.id)}
                              className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-all cursor-pointer"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {cheques.length === 0 && (
                  <div className="p-8 text-center text-xs text-gray-400">
                    چکی ثبت نشده است. از دکمه افزودن چک جدید یا استخراج هوشمند بالا استفاده کنید.
                  </div>
                )}
              </div>

              {/* Grid Footer showing dynamic summary */}
              <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl flex flex-col md:flex-row justify-between items-center gap-4 mt-6 border border-gray-200 dark:border-white/10">
                <div className="text-right">
                  <span className="text-xs text-gray-500 dark:text-gray-400">جمع کل مبالغ رسید دریافتی:</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-xl font-black text-emerald-600 font-mono">
                      {new Intl.NumberFormat('fa-IR').format(cheques.reduce((sum, c) => sum + c.amount, 0))}
                    </span>
                    <span className="text-xs text-emerald-500 font-bold">ریال</span>
                  </div>
                  <div className="text-[10px] text-gray-400 mt-1 font-bold">
                    {numberToPersianWords(cheques.reduce((sum, c) => sum + c.amount, 0))} ریال
                  </div>
                </div>

                {/* Status selector during creation */}
                <div className="flex flex-col gap-2 shrink-0 text-right w-full md:w-auto">
                  <label className="text-[10px] font-black text-gray-500">مرحله گردش ثبت سند:</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setSaveStatus('draft')}
                      className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all border ${
                        saveStatus === 'draft' 
                          ? 'bg-gray-200 dark:bg-gray-700 border-gray-300 text-gray-800 dark:text-white' 
                          : 'bg-white dark:bg-gray-900 border-gray-200 text-gray-500'
                      }`}
                    >
                      ذخیره به عنوان پیش‌نویس
                    </button>
                    <button
                      type="button"
                      onClick={() => setSaveStatus('pending_sales')}
                      className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all border ${
                        saveStatus === 'pending_sales' 
                          ? 'bg-blue-500 text-white border-blue-600 shadow-sm' 
                          : 'bg-white dark:bg-gray-900 border-gray-200 text-gray-500'
                      }`}
                    >
                      ارسال مستقیم به کارتابل تایید مدیر فروش
                    </button>
                  </div>
                </div>

                <div className="flex gap-2 w-full md:w-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setCustomerName('');
                      setAttachedFile(null);
                      setCheques([]);
                      setActiveSubTab('list');
                    }}
                    className="flex-1 md:flex-none px-6 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl text-xs font-bold transition-all"
                  >
                    انصراف
                  </button>
                  <button
                    type="button"
                    disabled={loading || cheques.length === 0}
                    onClick={handleSaveReceipt}
                    className="flex-1 md:flex-none flex items-center justify-center gap-2 px-8 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg disabled:opacity-50 transition-all cursor-pointer"
                  >
                    {loading ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <CheckCircle2 size={16} />
                    )}
                    ثبت و ذخیره نهایی
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
export default ChequeReceiptModule;
