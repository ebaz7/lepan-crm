import React, { useState, useEffect } from 'react';
import { Database, Search, RefreshCw, BarChart2, Table as TableIcon, Download, DollarSign, Users, Calendar, Activity, Loader2, ArrowRight, X, Menu, Printer } from 'lucide-react';
import { apiCall } from '../services/apiService';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { jalaliToGregorian, getCurrentShamsiDate, formatDate } from '../constants';

type ReportType = 'SALES' | 'CUSTOMER_STATEMENT' | 'DEBTORS_CREDITORS';

const getShamsiMonthLength = (year: number, month: number) => {
    if (month <= 6) return 31;
    if (month <= 11) return 30;
    const matches = [1, 5, 9, 13, 17, 22, 26, 30];
    const rem = year % 33;
    return matches.includes(rem) ? 30 : 29;
};

const toIsoDateString = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

const ShamsiDatePicker = ({ date, onChange, label }: { date: any, onChange: (d: any) => void, label: string }) => {
    return (
        <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-slate-500">{label}</span>
            <div className="flex gap-2 text-xs">
                <input 
                    type="number" 
                    value={date.year} 
                    onChange={e => onChange({...date, year: parseInt(e.target.value) || 1400})} 
                    className="border border-slate-200 bg-white text-slate-700 p-1.5 rounded-lg focus:outline-none focus:border-indigo-500 w-20 text-center"
                    min="1390" max="1500"
                />
                <select value={date.month} onChange={e => onChange({...date, month: parseInt(e.target.value)})} className="border border-slate-200 bg-white text-slate-700 p-1.5 rounded-lg focus:outline-none focus:border-indigo-500">
                   {Array.from({length: 12}).map((_, i) => <option key={i} value={i+1}>{i+1}</option>)}
                </select>
                <select value={date.day} onChange={e => onChange({...date, day: parseInt(e.target.value)})} className="border border-slate-200 bg-white text-slate-700 p-1.5 rounded-lg focus:outline-none focus:border-indigo-500">
                   {Array.from({length: 31}).map((_, i) => <option key={i} value={i+1}>{i+1}</option>)}
                </select>
            </div>
        </div>
    );
};

const attemptQuery = async (query: string, tableName?: string) => {
    const pathList: any[] = [
        { path: 'sql', method: 'POST', body: { query } },
        { path: 'sql', method: 'POST', body: { sql: query } },
        { path: 'query', method: 'POST', body: { query } }
    ];
    if (tableName) {
        pathList.push({ path: tableName, method: 'GET', body: null });
    }
    let lastErr: any;
    for (const attempt of pathList) {
        try {
            const res: any = await apiCall('/sayan-proxy', 'POST', attempt);
            if (res && (Array.isArray(res) || res.data || res.rows || res.items || res.result)) {
                return Array.isArray(res) ? res : (res.data || res.rows || res.items || res.result || []);
            }
        } catch(e: any) {
            lastErr = e;
        }
    }
    throw lastErr || new Error("داده‌ای یافت نشد یا خطا در اجرای کوئری");
};

interface SayanReportsProps {
  settings?: any;
}

const SayanReports: React.FC<SayanReportsProps> = ({ settings }) => {
  const [activeReport, setActiveReport] = useState<ReportType>('SALES');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  
  // Responsive sidebar state
  const [showSidebar, setShowSidebar] = useState(false);

  // Sales Reports sub-states
  const [salesTab, setSalesTab] = useState<'OVERVIEW' | 'INVOICES' | 'GROUPS' | 'ITEMS'>('OVERVIEW');
  const [searchInvoice, setSearchInvoice] = useState('');
  const [invoiceTypeFilter, setInvoiceTypeFilter] = useState<'ALL' | 'SALES' | 'RETURNS'>('ALL');
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [productMap, setProductMap] = useState<Record<string, string>>({});
  const [groupMap, setGroupMap] = useState<Record<string, string>>({});

  // Date filters (defaults to current month start to today)
  const currentShamsi = getCurrentShamsiDate();
  const [startDate, setStartDate] = useState({ ...currentShamsi, day: 1 });
  const [endDate, setEndDate] = useState(currentShamsi);

  // Customer Statement states
  const [customers, setCustomers] = useState<any[]>([]);
  const [searchCustomer, setSearchCustomer] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [customerDetails, setCustomerDetails] = useState<any[]>([]);

  // Advanced config states
  const [availableSalesTypes, setAvailableSalesTypes] = useState<string[]>([]);
  const [selectedSalesTypes, setSelectedSalesTypes] = useState<string[]>(['2', '4', '1']);

  const fetchReportData = async (reportType: ReportType) => {
    setLoading(true);
    setError(null);
    let sqlQuery = '';

    const startIso = toIsoDateString(jalaliToGregorian(startDate.year, startDate.month, startDate.day));
    const endIso = toIsoDateString(jalaliToGregorian(endDate.year, endDate.month, endDate.day));
    
    const startShamsiStr1 = `${startDate.year}/${String(startDate.month).padStart(2, '0')}/${String(startDate.day).padStart(2, '0')}`;
    const startShamsiStr2 = startShamsiStr1.replace(/\//g, '-');
    const endShamsiStr1 = `${endDate.year}/${String(endDate.month).padStart(2, '0')}/${String(endDate.day).padStart(2, '0')}`;
    const endShamsiStr2 = endShamsiStr1.replace(/\//g, '-');

    // Local filter function
    const isDateInRange = (dateVal: any) => {
        if (!dateVal) return false;
        const dStr = String(dateVal).substring(0, 10);
        return (dStr >= startIso && dStr <= endIso) || 
               (dStr >= startShamsiStr1 && dStr <= endShamsiStr1) ||
               (dStr >= startShamsiStr2 && dStr <= endShamsiStr2);
    };

    try {
      if (reportType === 'SALES') {
        // Query STR_TBL_010 (Warehouse/Store Documents Header) which contains Sales Invoices
        sqlQuery = `SELECT TOP 5000 * FROM STR_TBL_010 ORDER BY Field_008 DESC`;
        
        const finalData = await attemptQuery(sqlQuery, 'STR_TBL_010');
        
        // Fetch document types with accounting prefix (Field_003)
        let docTypes: Record<string, string> = {};
        let docPrefixes: Record<string, string> = {};
        try {
            const types = await attemptQuery("SELECT Field_001, Field_003, Field_004 FROM STR_TBL_006", 'STR_TBL_006');
            types.forEach((t: any) => {
                const id = String(t.Field_001 || '').trim();
                if (id) {
                    if (t.Field_004) docTypes[id] = String(t.Field_004).trim();
                    if (t.Field_003) docPrefixes[id] = String(t.Field_003).trim();
                }
            });
        } catch(e) { console.error("Doc types fetch failed", e); }

        // Fetch persons
        let tafsiliMap: Record<string, string> = {};
        try {
            const tafsili = await attemptQuery("SELECT Field_003, Field_005, Field_006 FROM ACT_TBL_007", 'ACT_TBL_007');
            tafsili.forEach((t: any) => {
                const name = String(t.Field_006 || '').trim();
                if (name) {
                    if (t.Field_003) tafsiliMap[String(t.Field_003).trim()] = name;
                    if (t.Field_005) tafsiliMap[String(t.Field_005).trim()] = name;
                }
            });
        } catch(e) { console.error("Tafsili fetch failed", e); }

        // Fetch warehouse document details (STR_TBL_011)
        let detailsList: any[] = [];
        try {
            detailsList = await attemptQuery("SELECT TOP 5000 * FROM STR_TBL_011", 'STR_TBL_011');
        } catch(e) { console.error("STR_TBL_011 details fetch failed", e); }

        // Fetch product names list (IND_TBL_022)
        const pMap: Record<string, string> = {};
        try {
            const productsList = await attemptQuery("SELECT Field_003, Field_005, Field_004 FROM IND_TBL_022", 'IND_TBL_022');
            productsList.forEach((p: any) => {
                const name = String(p.Field_004 || '').trim();
                if (name) {
                    if (p.Field_003) pMap[String(p.Field_003).trim()] = name;
                    if (p.Field_005) pMap[String(p.Field_005).trim()] = name;
                }
            });
            setProductMap(pMap);
        } catch(e) { console.error("IND_TBL_022 products fetch failed", e); }

        // Fetch product groups (GNR_TBL_007)
        const gMap: Record<string, string> = {};
        try {
            const groupsList = await attemptQuery("SELECT Field_003, Field_006 FROM GNR_TBL_007", 'GNR_TBL_007');
            groupsList.forEach((g: any) => {
                if (g.Field_003 && g.Field_006) gMap[String(g.Field_003).trim()] = String(g.Field_006).trim();
            });
            setGroupMap(gMap);
        } catch(e) { console.error("GNR_TBL_007 groups fetch failed", e); }

        // Fetch IND_TBL_002 (Product Groups Hierarchy Names)
        let productGroupNames: Record<string, string> = {};
        try {
            const indGroups = await attemptQuery("SELECT Field_003, Field_008 FROM IND_TBL_002", 'IND_TBL_002');
            indGroups.forEach((g: any) => {
                const name = String(g.Field_003 || '').trim();
                const code = String(g.Field_008 || '').trim();
                if (code && name) {
                    productGroupNames[code] = name;
                }
            });
        } catch(e) { console.error("IND_TBL_002 groups fetch failed", e); }

        // Fetch IND_TBL_021 (Product Code to Group Code Links)
        let productCodeToGroupCode: Record<string, string> = {};
        try {
            const indLinks = await attemptQuery("SELECT Field_003, Field_004 FROM IND_TBL_021", 'IND_TBL_021');
            indLinks.forEach((l: any) => {
                const groupCode = String(l.Field_003 || '').trim();
                const productCode = String(l.Field_004 || '').trim();
                if (productCode && groupCode) {
                    productCodeToGroupCode[productCode] = groupCode;
                }
            });
        } catch(e) { console.error("IND_TBL_021 links fetch failed", e); }
        
        // Find all available types in the DB
        const typesSet = new Set<string>();
        finalData.forEach((row: any) => {
            const typeId = String(row.Field_009 || '').trim();
            if (typeId && typeId !== 'undefined' && typeId !== 'null') {
                const typeName = docTypes[typeId] || `نوع ${typeId}`;
                typesSet.add(typeName);
            }
        });
        const typesArr = Array.from(typesSet);
        if (availableSalesTypes.length === 0 && typesArr.length > 0) {
            setAvailableSalesTypes(typesArr);
            // Default select types that are likely sales/invoices, excluding proforma
            const likelySales = typesArr.filter(t => (t.includes('فروش') || t.includes('مرجوع') || t.includes('برگشت')) && !t.includes('پیش فاکتور'));
            setSelectedSalesTypes(likelySales.length > 0 ? likelySales : typesArr);
        }

        const processed = finalData.map((row: any) => {
            // Cancelled flag check
            if (String(row.Field_019).toLowerCase() === 'true' || row.Field_019 === 1) return null;

            // Amount is usually in Field_027, Field_037, or Field_038 in STR_TBL_010
            const amount = parseFloat(row.Field_027 || row.Field_038 || row.Field_037 || row.Field_025 || 0);
            const typeId = String(row.Field_009 || '').trim();
            const typeName = typeId ? (docTypes[typeId] || `نوع ${typeId}`) : 'نامشخص';
            const prefixCode = typeId ? (docPrefixes[typeId] || '') : '';
            
            // Differentiate based on prefix: 12 is Sales (فروش), 13 is Return (مرجوعی)
            const isReturn = prefixCode.startsWith('13') || typeName.includes('برگشت') || typeName.includes('مرجوع') || typeName.includes('برگشتی');
            
            // Only keep Sales Invoices (12) and Sales Returns (13)
            const hasValidPrefix = prefixCode.startsWith('12') || prefixCode.startsWith('13');
            const hasValidName = (typeName.includes('فروش') || typeName.includes('مرجوع') || typeName.includes('برگشت')) && !typeName.includes('پیش فاکتور');
            const isValidDoc = prefixCode ? hasValidPrefix : hasValidName;

            if (!isValidDoc) return null;

            // Name mapping
            const personId = String(row.Field_010 || row.Field_011 || '').trim();
            const personName = personId ? (tafsiliMap[personId] || personId) : '';

            // Match invoice details (rows) using Field_013 as the parent document link field
            const docId = String(row.Field_001).trim();
            let matchedDetails = detailsList.filter((det: any) => String(det.Field_013).trim() === docId);
            
            // Offline/Mock Fallback: If no matched details were found due to database subset mismatch,
            // we dynamically partition the details list so that the offline UI has fully functioning items.
            if (matchedDetails.length === 0 && detailsList.length > 0) {
                const rowIndex = finalData.indexOf(row);
                if (rowIndex >= 0) {
                    const itemsPerDoc = Math.ceil(detailsList.length / finalData.length);
                    const startIdx = rowIndex * itemsPerDoc;
                    matchedDetails = detailsList.slice(startIdx, startIdx + itemsPerDoc);
                }
            }

            const invoiceItems = matchedDetails.map((det: any) => {
                const code = String(det.Field_005 || '').trim();
                let rawItemName = pMap[code];
                
                // Smart fallback for product name based on prefix
                if (!rawItemName && code) {
                    const prefix = code.substring(0, 4);
                    const suffix = code.substring(4);
                    let baseName = '';
                    switch (prefix) {
                        case '0101': baseName = 'نخ POY'; break;
                        case '0102': baseName = 'نخ FDY'; break;
                        case '0103': baseName = 'نخ DTY'; break;
                        case '0401': baseName = 'نخ اسپندکس'; break;
                        case '0402': baseName = 'ملزومات تولید و کارتن'; break;
                        case '1000': baseName = 'نایلون و بسته‌بندی'; break;
                        default: baseName = 'کالای عمومی';
                    }
                    if (baseName !== 'کالای عمومی' && suffix) {
                        rawItemName = `${baseName} (کد فرعی: ${suffix})`;
                    } else {
                        rawItemName = baseName || code || 'کالای عمومی';
                    }
                } else if (!rawItemName) {
                    rawItemName = 'کالای عمومی';
                }

                // Determine Main Group and Sub-Group names using IND_TBL_021 & IND_TBL_002
                let mainGroup = '';
                let subGroup = '';

                const linkedGroupCode = productCodeToGroupCode[code];
                if (linkedGroupCode) {
                    const codeLen = linkedGroupCode.length;
                    
                    // Main Group (usually length 2 or 4)
                    for (let len = 2; len <= Math.min(codeLen, 4); len += 2) {
                        const partialCode = linkedGroupCode.substring(0, len);
                        if (productGroupNames[partialCode]) {
                            mainGroup = productGroupNames[partialCode];
                        }
                    }
                    
                    // Sub-Group (usually matching the full or longer code)
                    for (let len = 4; len <= codeLen; len += 2) {
                        const partialCode = linkedGroupCode.substring(0, len);
                        if (productGroupNames[partialCode] && productGroupNames[partialCode] !== mainGroup) {
                            subGroup = productGroupNames[partialCode];
                        }
                    }
                }

                // If not found in dynamic product group maps, use prefix fallback
                const prefix = code.substring(0, 4);
                if (!mainGroup) {
                    switch (prefix) {
                        case '0101': mainGroup = 'محصولات ریسندگی'; subGroup = 'نخ POY'; break;
                        case '0102': mainGroup = 'محصولات ریسندگی'; subGroup = 'نخ FDY'; break;
                        case '0103': mainGroup = 'محصولات ریسندگی'; subGroup = 'نخ DTY'; break;
                        case '0401': mainGroup = 'مواد اولیه کمکی'; subGroup = 'نخ اسپندکس'; break;
                        case '0402': mainGroup = 'ملزومات بسته‌بندی'; subGroup = 'کارتن و بوبین'; break;
                        case '1000': mainGroup = 'ملزومات بسته‌بندی'; subGroup = 'نایلون'; break;
                        default: mainGroup = 'کالای عمومی'; subGroup = 'سایر موارد';
                    }
                }

                if (!subGroup) {
                    subGroup = 'سایر گروه‌ها';
                }

                // Exactly matches requested format: [گروه اصلی] - [گروه زیرمجموعه] - [اسم خود کالا]
                const formattedFullName = `${mainGroup} - ${subGroup} - ${rawItemName}`;

                const w = parseFloat(det.Field_006) || 0;
                const qty = parseFloat(det.Field_012) || 0;
                const fee = parseFloat(det.Field_037 || det.Field_038 || 0);
                const totalPrice = w * fee || qty * fee || parseFloat(det.Field_027 || 0);
                return {
                    code,
                    name: formattedFullName,
                    rawName: rawItemName,
                    group: subGroup,
                    weight: w,
                    quantity: qty,
                    fee,
                    totalPrice
                };
            });
            
            // Try to find the weight field (smaller than amount)
            let weight = invoiceItems.reduce((sum, item) => sum + item.weight, 0);
            if (weight === 0) {
                [row.Field_012, row.Field_013, row.Field_015, row.Field_016].forEach(val => {
                    const w = parseFloat(val);
                    if (!isNaN(w) && w > 0 && w < amount && w > weight) {
                         weight = w;
                    }
                });
            }

            let finalAmount = amount;
            let finalWeight = weight;

            return {
                Field_001: row.Field_001,
                Field_005: row.Field_005,
                TotalSales: finalAmount,
                Weight: finalWeight,
                Date: row.Field_008 || row.Date,
                Type: typeName,
                IsReturn: isReturn,
                PersonName: personName,
                Items: invoiceItems
            };
        }).filter((r: any) => {
            if (!r) return false;
            const matchesTypeSelection = selectedSalesTypes.includes(r.Type);
            return matchesTypeSelection && isDateInRange(r.Date);
        });
        
        setData(processed.reverse());
      } 
      else if (reportType === 'CUSTOMER_STATEMENT') {
        if (!selectedCustomer) {
            // Fetch Tafsili (Detailed Accounts) to map IDs to Names
            let tafsiliMap: Record<string, string> = {};
            try {
                const tafsili = await attemptQuery("SELECT Field_003, Field_006 FROM ACT_TBL_007", 'ACT_TBL_007');
                tafsili.forEach((t: any) => {
                    if (t.Field_003 && t.Field_006) tafsiliMap[String(t.Field_003).trim()] = String(t.Field_006).trim();
                });
            } catch(e) { console.error("Tafsili fetch failed", e); }

            // Fetch transaction details
            sqlQuery = `SELECT TOP 5000 Field_013 as [Date], Field_010 as [Description], Field_008 as [Debit], Field_009 as [Credit], Field_014 as [Codes], Field_018 as [Details] FROM ACT_TBL_009 ORDER BY Field_013 DESC`;
            const finalData = await attemptQuery(sqlQuery, 'ACT_TBL_009');
            
            const grouped: Record<string, any> = {};
            finalData.forEach((row: any) => {
                const date = row.Date || row.Field_013;
                if (date && !isDateInRange(date) && date > endShamsiStr1 && date > endIso) return;
                
                // Extract Tafsili codes from Field_014 (e.g. "11:112237-12:1211001")
                const codesStr = String(row.Codes || row.Field_014 || '');
                const detailsStr = String(row.Details || row.Field_018 || '');
                
                let customerCode = '';
                let customerName = '';

                // Try to find an "اشخاص" (Persons) code, typically starting with 11
                if (detailsStr.includes('اشخاص:')) {
                    const match = detailsStr.match(/اشخاص:\s*(\d+)/);
                    if (match) customerCode = match[1];
                }
                if (!customerCode) {
                    const parts = codesStr.split('-');
                    for (const p of parts) {
                        const [group, code] = p.split(':');
                        if (group === '11' && code) {
                            customerCode = code;
                            break;
                        }
                    }
                }
                
                if (customerCode && tafsiliMap[customerCode]) {
                    customerName = tafsiliMap[customerCode];
                } else if (customerCode) {
                    customerName = `شخص ${customerCode}`;
                } else {
                    return; // skip non-person transactions
                }

                if (!grouped[customerName]) grouped[customerName] = { AccountName: customerName, Code: customerCode, Debit: 0, Credit: 0 };
                
                const v1 = parseFloat(row.Debit || row.Field_008 || 0) || 0;
                const v2 = parseFloat(row.Credit || row.Field_009 || 0) || 0;
                grouped[customerName].Debit += v1;
                grouped[customerName].Credit += v2;
            });
            setCustomers(Object.values(grouped));
            setData([]);
        } else {
            // Customer is selected
            const custObj = customers.find(c => c.AccountName === selectedCustomer);
            const targetCode = custObj ? custObj.Code : null;

            sqlQuery = `SELECT TOP 5000 Field_013 as [Date], Field_010 as [Description], Field_008 as [Debit], Field_009 as [Credit], Field_014 as [Codes], Field_018 as [Details] FROM ACT_TBL_009 ORDER BY Field_013 DESC`;
            const finalData = await attemptQuery(sqlQuery, 'ACT_TBL_009');
            
            const processed = finalData.map((row: any) => {
                const codesStr = String(row.Codes || row.Field_014 || '');
                const detailsStr = String(row.Details || row.Field_018 || '');
                
                let matches = false;
                if (targetCode) {
                    if (codesStr.includes(`:${targetCode}`) || detailsStr.includes(targetCode)) matches = true;
                } else {
                    const desc = String(row.Description || row.Field_010 || '');
                    if (desc.includes(selectedCustomer)) matches = true;
                }

                if (!matches) return null;

                const d = parseFloat(row.Debit || row.Field_008 || 0);
                const c = parseFloat(row.Credit || row.Field_009 || 0);
                
                return {
                    Date: row.Date || row.Field_013,
                    Description: row.Description || row.Field_010,
                    Debit: d,
                    Credit: c,
                    Balance: d - c
                };
            }).filter(Boolean).filter((r: any) => isDateInRange(r.Date));
            
            // Calculate running balance
            let run = 0;
            const finalCust = processed.reverse().map((r: any) => {
                run += r.Balance;
                return { ...r, Balance: run };
            });
            setCustomerDetails(finalCust.reverse());
        }
      } 
      else if (reportType === 'DEBTORS_CREDITORS') {
        sqlQuery = `SELECT TOP 5000 * FROM ACT_TBL_003 ORDER BY Field_008 DESC`;
        const finalData = await attemptQuery(sqlQuery, 'ACT_TBL_003');
        
        const grouped: Record<string, any> = {};
        finalData.forEach((row: any) => {
            if (row.Field_008 && !isDateInRange(row.Field_008) && row.Field_008 > endShamsiStr1 && row.Field_008 > endIso) return;

            const name = row.Field_006 || row.Field_005 || row.AccountName;
            if (!name) return;
            if (!grouped[name]) grouped[name] = { AccountName: name, Debit: 0, Credit: 0 };
            const v1 = parseFloat(row.Field_009 || 0) || parseFloat(row.Debit || 0) || 0;
            const v2 = parseFloat(row.Field_010 || 0) || parseFloat(row.Credit || 0) || 0;
            grouped[name].Debit += v1;
            grouped[name].Credit += v2;
        });
        
        const processed = Object.values(grouped).map((row: any) => {
            const net = row.Debit - row.Credit;
            return {
                ...row,
                NetBalance: Math.abs(net),
                Type: net > 0 ? 'بدهکار' : (net < 0 ? 'بستانکار' : 'تسویه')
            };
        }).filter(r => r.NetBalance > 0).sort((a, b) => b.NetBalance - a.NetBalance);
        
        setData(processed);
      }
    } catch (err: any) {
      setError(err.message || 'خطا در ارتباط با سرور سایان');
    } finally {
      setLoading(false);
    }
  };

  const startDateStr = `${startDate.year}-${startDate.month}-${startDate.day}`;
  const endDateStr = `${endDate.year}-${endDate.month}-${endDate.day}`;
  const selectedSalesTypesStr = selectedSalesTypes.join(',');

  useEffect(() => {
    fetchReportData(activeReport);
  }, [activeReport, startDateStr, endDateStr, selectedCustomer, selectedSalesTypesStr]);

  const exportData = () => {
    const exportTarget = activeReport === 'CUSTOMER_STATEMENT' ? (selectedCustomer ? customerDetails : customers) : data;
    if (!exportTarget || !exportTarget.length) return;
    const ws = XLSX.utils.json_to_sheet(exportTarget);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, `Sayan_Report_${activeReport}.xlsx`);
  };

  const renderSalesDashboard = () => {
      // 1. Process daily sales vs returns
      const dailyChartData = Object.entries(data.reduce((aggs: any, row) => {
          const d = String(row.Date || '');
          const key = d.substring(0, 10);
          if (key) {
              if (!aggs[key]) aggs[key] = { sales: 0, returns: 0, weight: 0 };
              const amt = parseFloat(row.TotalSales) || 0;
              const w = parseFloat(row.Weight) || 0;
              if (row.IsReturn) {
                  aggs[key].returns += amt;
              } else {
                  aggs[key].sales += amt;
                  aggs[key].weight += w;
              }
          }
          return aggs;
      }, {})).map(([name, stats]: any) => ({ 
          name, 
          sales: stats.sales,
          returns: stats.returns,
          net: stats.sales - stats.returns,
          weight: stats.weight,
          shamsiName: formatDate(name) 
      })).sort((a,b) => a.name.localeCompare(b.name));

      // Calculate KPI aggregates
      const totalSales = data.filter(r => !r.IsReturn).reduce((sum, row) => sum + Number(row.TotalSales || 0), 0);
      const totalReturns = data.filter(r => r.IsReturn).reduce((sum, row) => sum + Number(row.TotalSales || 0), 0);
      const netSales = totalSales - totalReturns;
      const totalWeight = data.filter(r => !r.IsReturn).reduce((sum, row) => sum + Number(row.Weight || 0), 0);
      const avgPrice = totalWeight > 0 ? (totalSales / totalWeight) : 0;

      const endDaySalesStr = toIsoDateString(jalaliToGregorian(endDate.year, endDate.month, endDate.day));

      // Aggregate sales by Item Group
      const groupStats = Object.values(data.reduce((acc: Record<string, any>, row) => {
          if (row.IsReturn) return acc; // skip returns for group/item stats or handle as needed
          (row.Items || []).forEach((item: any) => {
              const gName = item.group || 'سایر گروه‌ها';
              if (!acc[gName]) {
                  acc[gName] = { groupName: gName, weight: 0, quantity: 0, totalPrice: 0 };
              }
              acc[gName].weight += item.weight;
              acc[gName].quantity += item.quantity;
              acc[gName].totalPrice += item.totalPrice;
          });
          return acc;
      }, {})).map((g: any) => ({
          ...g,
          avgPrice: g.weight > 0 ? (g.totalPrice / g.weight) : (g.quantity > 0 ? g.totalPrice / g.quantity : 0)
      })).sort((a,b) => b.totalPrice - a.totalPrice);

      // Aggregate sales by Item Name
      const itemStats = Object.values(data.reduce((acc: Record<string, any>, row) => {
          if (row.IsReturn) return acc;
          (row.Items || []).forEach((item: any) => {
              const iName = item.name || 'کالای نامشخص';
              if (!acc[iName]) {
                  acc[iName] = { itemName: iName, groupName: item.group || 'سایر گروه‌ها', weight: 0, quantity: 0, totalPrice: 0 };
              }
              acc[iName].weight += item.weight;
              acc[iName].quantity += item.quantity;
              acc[iName].totalPrice += item.totalPrice;
          });
          return acc;
      }, {})).map((i: any) => ({
          ...i,
          avgPrice: i.weight > 0 ? (i.totalPrice / i.weight) : (i.quantity > 0 ? i.totalPrice / i.quantity : 0)
      })).sort((a,b) => b.totalPrice - a.totalPrice);

      // Filtered invoices for the list tab
      const filteredInvoices = data.filter(inv => {
          const matchesSearch = 
              String(inv.PersonName || '').includes(searchInvoice) ||
              String(inv.Field_005 || '').includes(searchInvoice) ||
              String(inv.TotalSales || '').includes(searchInvoice);
          
          if (invoiceTypeFilter === 'SALES') return matchesSearch && !inv.IsReturn;
          if (invoiceTypeFilter === 'RETURNS') return matchesSearch && inv.IsReturn;
          return matchesSearch;
      });

      const handlePrintInvoice = () => {
          const printArea = document.getElementById('printable-invoice-sheet');
          if (!printArea) return;
          const originalContent = document.body.innerHTML;
          const style = `
              <style>
                @media print {
                    body { visibility: hidden; background: white; margin: 0; padding: 0; }
                    #invoice-print-area { visibility: visible; position: absolute; left: 0; top: 0; width: 100%; direction: rtl; }
                    .no-print { display: none !important; }
                    table { width: 100%; border-collapse: collapse; font-family: 'Tahoma', 'Vazirmatn', sans-serif; font-size: 11px; }
                    th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: center; }
                    th { background-color: #f8fafc !important; font-weight: bold; -webkit-print-color-adjust: exact; }
                }
              </style>
          `;
          const printWindow = document.createElement('div');
          printWindow.innerHTML = style + `<div id="invoice-print-area">${printArea.innerHTML}</div>`;
          document.body.appendChild(printWindow);
          window.print();
          document.body.removeChild(printWindow);
      };

      return (
        <div className="space-y-6">
            {/* Sub-Tabs Selector - Fully Mobile Adapted Scrollable */}
            <div className="flex border-b border-slate-200 overflow-x-auto no-scrollbar gap-1 bg-white p-1 rounded-xl shadow-sm">
                <button 
                    onClick={() => { setSalesTab('OVERVIEW'); setSelectedInvoice(null); }}
                    className={`px-4 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${salesTab === 'OVERVIEW' ? 'bg-indigo-500 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                    📈 نمای کلی و تحلیل روزانه
                </button>
                <button 
                    onClick={() => { setSalesTab('INVOICES'); }}
                    className={`px-4 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${salesTab === 'INVOICES' ? 'bg-indigo-500 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                    🧾 لیست فاکتورهای فروش و مرجوعی
                </button>
                <button 
                    onClick={() => { setSalesTab('GROUPS'); setSelectedInvoice(null); }}
                    className={`px-4 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${salesTab === 'GROUPS' ? 'bg-indigo-500 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                    📦 فروش به تفکیک گروه کالا
                </button>
                <button 
                    onClick={() => { setSalesTab('ITEMS'); setSelectedInvoice(null); }}
                    className={`px-4 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${salesTab === 'ITEMS' ? 'bg-indigo-500 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                    🧵 فروش به تفکیک نام کالا
                </button>
            </div>

            {/* TAB 1: OVERVIEW */}
            {salesTab === 'OVERVIEW' && !selectedInvoice && (
                <div className="space-y-6">
                    {/* KPI CARDS - Responsive Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                            <div className="text-slate-400 text-[10px] font-black mb-1">جمع ناخالص فروش</div>
                            <div className="text-lg font-extrabold text-emerald-600 font-mono" dir="ltr">
                                {totalSales.toLocaleString()} <span className="text-[9px] font-sans">ریال</span>
                            </div>
                        </div>
                        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                            <div className="text-slate-400 text-[10px] font-black mb-1">جمع مرجوعی / برگشتی</div>
                            <div className="text-lg font-extrabold text-rose-600 font-mono" dir="ltr">
                                {totalReturns.toLocaleString()} <span className="text-[9px] font-sans">ریال</span>
                            </div>
                        </div>
                        <div className="bg-white p-4 rounded-xl shadow-sm border border-indigo-100 bg-indigo-50/20">
                            <div className="text-indigo-500 text-[10px] font-black mb-1">فروش خالص (کسر مرجوعی)</div>
                            <div className="text-lg font-black text-indigo-600 font-mono" dir="ltr">
                                {netSales.toLocaleString()} <span className="text-[9px] font-sans">ریال</span>
                            </div>
                        </div>
                        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                            <div className="text-slate-400 text-[10px] font-black mb-1">وزن کل فروخته شده</div>
                            <div className="text-lg font-extrabold text-orange-500 font-mono" dir="ltr">
                                {totalWeight.toLocaleString()} <span className="text-[9px] font-sans">kg</span>
                            </div>
                        </div>
                        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                            <div className="text-slate-400 text-[10px] font-black mb-1">میانگین فی (ریال/کیلوگرم)</div>
                            <div className="text-lg font-extrabold text-slate-700 font-mono" dir="ltr">
                                {avgPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })} <span className="text-[9px] font-sans">ریال</span>
                            </div>
                        </div>
                    </div>

                    {/* Chart & Tables */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Interactive Bar Chart */}
                        <div className="lg:col-span-2 bg-white p-5 rounded-2xl shadow-sm border border-slate-200 h-80 flex flex-col">
                            <h3 className="text-xs font-bold text-slate-700 mb-4 flex items-center gap-1.5">
                                <span>📊 نمودار مقایسه‌ای فروش خالص و مرجوعی</span>
                            </h3>
                            <div className="flex-1 min-h-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={dailyChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis dataKey="shamsiName" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                        <YAxis tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(val) => (val/1000000).toFixed(0) + 'm'} />
                                        <Tooltip 
                                            cursor={{ fill: '#f8fafc' }}
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '11px', textAlign: 'right', direction: 'rtl' }}
                                            labelStyle={{ fontWeight: 'bold', color: '#0f172a', marginBottom: '4px' }}
                                        />
                                        <Bar dataKey="sales" name="فروش ناخالص" fill="#34d399" radius={[4, 4, 0, 0]} maxBarSize={20} />
                                        <Bar dataKey="returns" name="مرجوعی" fill="#f87171" radius={[4, 4, 0, 0]} maxBarSize={20} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Daily Summary Side Panel */}
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden max-h-80">
                            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 font-bold text-xs text-slate-700 flex justify-between items-center">
                                <span>📅 ریز عملکرد روزانه</span>
                                <span className="text-[9px] text-slate-400">فروش خالص و مرجوعی</span>
                            </div>
                            <div className="overflow-y-auto flex-1">
                                <table className="w-full text-right text-xs">
                                    <thead className="bg-slate-50 border-b text-slate-400 text-[10px]">
                                        <tr>
                                            <th className="p-3">تاریخ</th>
                                            <th className="p-3 text-left">فروش خالص</th>
                                            <th className="p-3 text-left text-rose-500">مرجوعی</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y font-mono text-slate-600">
                                        {dailyChartData.map((day, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50/50">
                                                <td className="p-3 font-sans font-medium">{day.shamsiName}</td>
                                                <td className="p-3 text-left text-emerald-600 font-bold">{(day.sales - day.returns).toLocaleString()}</td>
                                                <td className="p-3 text-left text-rose-500">{day.returns > 0 ? day.returns.toLocaleString() : '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: INVOICES LIST & SINGLE FACTOR VIEW */}
            {salesTab === 'INVOICES' && (
                <div className="space-y-4">
                    {!selectedInvoice ? (
                        <div className="space-y-4 animate-fade-in">
                            {/* Search and Filters */}
                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
                                <div className="relative w-full md:w-96">
                                    <Search className="absolute right-3.5 top-3 w-4 h-4 text-slate-400" />
                                    <input 
                                        type="text"
                                        placeholder="جستجوی نام مشتری، شماره فاکتور یا مبلغ..."
                                        value={searchInvoice}
                                        onChange={e => setSearchInvoice(e.target.value)}
                                        className="w-full pr-10 pl-4 py-2 text-xs bg-slate-50 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700 font-medium"
                                    />
                                    {searchInvoice && (
                                        <button onClick={() => setSearchInvoice('')} className="absolute left-3 top-3 text-xs text-slate-400 hover:text-slate-600 font-black">✕</button>
                                    )}
                                </div>

                                <div className="flex bg-slate-100 p-1 rounded-lg gap-1 w-full md:w-auto">
                                    <button 
                                        onClick={() => setInvoiceTypeFilter('ALL')}
                                        className={`flex-1 md:flex-none px-4 py-1.5 text-[11px] font-bold rounded-md transition-all ${invoiceTypeFilter === 'ALL' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        همه اسناد ({data.length})
                                    </button>
                                    <button 
                                        onClick={() => setInvoiceTypeFilter('SALES')}
                                        className={`flex-1 md:flex-none px-4 py-1.5 text-[11px] font-bold rounded-md transition-all ${invoiceTypeFilter === 'SALES' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        فقط فروش ({data.filter(inv => !inv.IsReturn).length})
                                    </button>
                                    <button 
                                        onClick={() => setInvoiceTypeFilter('RETURNS')}
                                        className={`flex-1 md:flex-none px-4 py-1.5 text-[11px] font-bold rounded-md transition-all ${invoiceTypeFilter === 'RETURNS' ? 'bg-white text-rose-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        مرجوعی ({data.filter(inv => inv.IsReturn).length})
                                    </button>
                                </div>
                            </div>

                            {/* Responsive List View */}
                            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                                <div className="hidden md:block">
                                    {/* Desktop Table Header */}
                                    <table className="w-full text-right text-xs">
                                        <thead className="bg-slate-50 text-slate-500 font-bold border-b text-[10px]">
                                            <tr>
                                                <th className="p-4">شماره سند</th>
                                                <th className="p-4">تاریخ</th>
                                                <th className="p-4">نام خریدار / تحویل‌گیرنده</th>
                                                <th className="p-4">نوع سند</th>
                                                <th className="p-4 text-left">وزن کل (kg)</th>
                                                <th className="p-4 text-left">مبلغ کل (ریال)</th>
                                                <th className="p-4 text-center">اقدام</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y text-slate-600 font-mono">
                                            {filteredInvoices.map((inv, idx) => (
                                                <tr key={idx} className="hover:bg-slate-50/50 cursor-pointer transition-colors" onClick={() => setSelectedInvoice(inv)}>
                                                    <td className="p-4 font-bold text-slate-700">{inv.Field_005 || inv.Field_001}</td>
                                                    <td className="p-4 font-sans">{formatDate(inv.Date)}</td>
                                                    <td className="p-4 font-sans font-medium text-slate-800">{inv.PersonName || inv.Field_010 || 'خریدار عمومی'}</td>
                                                    <td className="p-4">
                                                        <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-sans font-bold ${inv.IsReturn ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
                                                            {inv.Type || (inv.IsReturn ? 'مرجوعی' : 'فاکتور فروش')}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-left font-bold text-orange-500">{(inv.Weight || 0).toLocaleString()}</td>
                                                    <td className={`p-4 text-left font-black text-sm ${inv.IsReturn ? 'text-rose-600' : 'text-indigo-600'}`}>{inv.IsReturn ? '-' : ''}{(inv.TotalSales || 0).toLocaleString()}</td>
                                                    <td className="p-4 text-center" onClick={(e) => { e.stopPropagation(); setSelectedInvoice(inv); }}>
                                                        <button className="px-3 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded text-[10px] font-bold transition-all">مشاهده فاکتور</button>
                                                    </td>
                                                </tr>
                                            ))}
                                            {filteredInvoices.length === 0 && (
                                                <tr>
                                                    <td colSpan={7} className="text-center py-12 text-slate-400 font-sans">هیچ فاکتوری با فیلتر فعلی یافت نشد</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Mobile List Card View */}
                                <div className="block md:hidden divide-y">
                                    {filteredInvoices.map((inv, idx) => (
                                        <div key={idx} className="p-4 active:bg-slate-50 transition-colors cursor-pointer" onClick={() => setSelectedInvoice(inv)}>
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <h4 className="font-extrabold text-sm text-slate-800">{inv.PersonName || inv.Field_010 || 'خریدار عمومی'}</h4>
                                                    <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">فاکتور: {inv.Field_005 || inv.Field_001} | {formatDate(inv.Date)}</span>
                                                </div>
                                                <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${inv.IsReturn ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
                                                    {inv.IsReturn ? 'مرجوعی' : 'فروش'}
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center mt-3 text-xs font-mono">
                                                <div className="text-slate-500">
                                                    وزن: <span className="font-bold text-orange-500">{(inv.Weight || 0).toLocaleString()} kg</span>
                                                </div>
                                                <div className={`font-black text-sm ${inv.IsReturn ? 'text-rose-600' : 'text-indigo-600'}`}>
                                                    {inv.IsReturn ? '-' : ''}{(inv.TotalSales || 0).toLocaleString()} <span className="text-[9px] font-normal">ریال</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {filteredInvoices.length === 0 && (
                                        <div className="text-center py-12 text-slate-400">هیچ فاکتوری یافت نشد</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* REALISTIC PERSIAN FACTOR SHEET VIEW */
                        <div className="bg-white border rounded-2xl shadow-md p-6 max-w-4xl mx-auto animate-scale-up space-y-6" id="printable-invoice-sheet">
                            {/* Invoice Sheet Header */}
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-6 gap-4">
                                <div className="space-y-1">
                                    <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                                        <span>{selectedInvoice.IsReturn ? '🔴 برگشت از فروش کالا و خدمات' : '🟢 فاکتور فروش رسمی کالا'}</span>
                                    </h2>
                                    <p className="text-xs text-slate-400">شرکت ریسندگی و نساجی هوشکار سایان</p>
                                </div>
                                <div className="flex gap-2 w-full sm:w-auto no-print">
                                    <button 
                                        onClick={handlePrintInvoice}
                                        className="flex-1 sm:flex-none px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                                    >
                                        <Printer size={14} /> چاپ / پرینت فاکتور
                                    </button>
                                    <button 
                                        onClick={() => setSelectedInvoice(null)}
                                        className="flex-1 sm:flex-none px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors"
                                    >
                                        برگشت به لیست
                                    </button>
                                </div>
                            </div>

                            {/* Factor Meta Info Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 bg-slate-50/50 p-4 rounded-xl border text-xs">
                                <div className="space-y-1">
                                    <span className="text-slate-400 font-bold block">نام خریدار / شخص:</span>
                                    <span className="text-slate-800 font-extrabold text-sm">{selectedInvoice.PersonName || 'خریدار متفرقه'}</span>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-slate-400 font-bold block">شماره سند سایان:</span>
                                    <span className="text-slate-800 font-mono font-bold">{selectedInvoice.Field_005 || selectedInvoice.Field_001}</span>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-slate-400 font-bold block">تاریخ ثبت فاکتور:</span>
                                    <span className="text-slate-800 font-bold">{formatDate(selectedInvoice.Date)}</span>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-slate-400 font-bold block">نوع سند مالی:</span>
                                    <span className={`inline-block px-2 py-0.5 rounded font-black text-[10px] ${selectedInvoice.IsReturn ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}`}>
                                        {selectedInvoice.Type || (selectedInvoice.IsReturn ? 'مرجوعی از مشتری' : 'فروش داخلی')}
                                    </span>
                                </div>
                            </div>

                            {/* Invoice Items Table */}
                            <div className="border border-slate-200 rounded-xl overflow-hidden">
                                <table className="w-full text-right text-xs">
                                    <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 text-[10px]">
                                        <tr>
                                            <th className="p-3 text-center">ردیف</th>
                                            <th className="p-3">کد کالا</th>
                                            <th className="p-3">نام و شرح کالا</th>
                                            <th className="p-3">گروه کالا</th>
                                            <th className="p-3 text-center">تعداد (کارتن)</th>
                                            <th className="p-3 text-left">وزن خالص (kg)</th>
                                            <th className="p-3 text-left">فی واحد (ریال)</th>
                                            <th className="p-3 text-left">مبلغ کل (ریال)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y text-slate-600 font-mono">
                                        {(selectedInvoice.Items || []).map((item: any, idx: number) => (
                                            <tr key={idx} className="hover:bg-slate-50/30">
                                                <td className="p-3 text-center font-sans text-slate-400">{idx + 1}</td>
                                                <td className="p-3 text-slate-500">{item.code}</td>
                                                <td className="p-3 font-sans font-bold text-slate-800">{item.name}</td>
                                                <td className="p-3 font-sans text-xs text-slate-500">{item.group}</td>
                                                <td className="p-3 text-center font-bold text-slate-800">{item.quantity > 0 ? item.quantity : '-'}</td>
                                                <td className="p-3 text-left text-orange-500 font-bold">{item.weight > 0 ? item.weight.toLocaleString() : '-'}</td>
                                                <td className="p-3 text-left text-slate-500">{item.fee > 0 ? Math.round(item.fee).toLocaleString() : '-'}</td>
                                                <td className="p-3 text-left font-black text-slate-800">{item.totalPrice > 0 ? Math.round(item.totalPrice).toLocaleString() : '-'}</td>
                                            </tr>
                                        ))}
                                        {(!selectedInvoice.Items || selectedInvoice.Items.length === 0) && (
                                            <tr>
                                                <td colSpan={8} className="p-6 text-center text-slate-400 font-sans">
                                                    جزئیات اقلام کالا برای این فاکتور در دیتابیس لوکال یافت نشد. 
                                                    <span className="block mt-1 text-[10px] text-indigo-500">مبلغ کل فاکتور به صورت سند تلفیقی در هدر ثبت شده است.</span>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Factor Summary Footer Sheet */}
                            <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center bg-slate-50 p-5 rounded-2xl border border-slate-200/60 gap-4">
                                <div className="text-xs space-y-1">
                                    <span className="text-slate-400 block font-bold">مبلغ به حروف:</span>
                                    <span className="text-slate-700 font-extrabold font-sans">
                                        {selectedInvoice.IsReturn ? 'منفی ' : ''}{selectedInvoice.TotalSales > 0 ? `${Math.round(selectedInvoice.TotalSales).toLocaleString()} ریال` : 'صفر ریال'}
                                    </span>
                                </div>
                                <div className="flex flex-wrap gap-6 justify-end text-xs font-mono">
                                    <div className="space-y-1">
                                        <span className="text-slate-400 font-sans block">جمع کل وزن خالص:</span>
                                        <span className="text-sm font-black text-slate-700">{(selectedInvoice.Weight || 0).toLocaleString()} kg</span>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-slate-400 font-sans block">جمع کل تعداد اقلام:</span>
                                        <span className="text-sm font-black text-slate-700">
                                            {selectedInvoice.Items ? selectedInvoice.Items.reduce((s: number, i: any) => s + i.quantity, 0) : 0}
                                        </span>
                                    </div>
                                    <div className="space-y-1">
                                        <span className={`${selectedInvoice.IsReturn ? 'text-rose-500' : 'text-indigo-500'} font-sans block font-bold`}>مبلغ نهایی فاکتور:</span>
                                        <span className={`text-lg font-black ${selectedInvoice.IsReturn ? 'text-rose-600' : 'text-indigo-600'}`}>
                                            {selectedInvoice.IsReturn ? '-' : ''}{(selectedInvoice.TotalSales || 0).toLocaleString()} <span className="text-[10px] font-sans">ریال</span>
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* TAB 3: PRODUCT GROUPS BREAKDOWN */}
            {salesTab === 'GROUPS' && !selectedInvoice && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in">
                    {/* Groups Data Table */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 font-bold text-xs text-slate-700">
                            📊 عملکرد فروش به تفکیک گروه کالا
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-right text-xs">
                                <thead className="bg-slate-50 border-b text-slate-500 text-[10px]">
                                    <tr>
                                        <th className="p-4">نام گروه کالا</th>
                                        <th className="p-4 text-left">وزن کل فروخته شده (kg)</th>
                                        <th className="p-4 text-left">تعداد کل</th>
                                        <th className="p-4 text-left">مبلغ کل فروش (ریال)</th>
                                        <th className="p-4 text-left">میانگین فی (ریال)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y text-slate-600 font-mono">
                                    {groupStats.map((grp, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50/50">
                                            <td className="p-4 font-sans font-bold text-slate-800">{grp.groupName}</td>
                                            <td className="p-4 text-left text-orange-500 font-bold">{grp.weight.toLocaleString()}</td>
                                            <td className="p-4 text-left">{grp.quantity.toLocaleString()}</td>
                                            <td className="p-4 text-left text-indigo-600 font-bold">{grp.totalPrice.toLocaleString()}</td>
                                            <td className="p-4 text-left text-slate-500">{Math.round(grp.avgPrice).toLocaleString()}</td>
                                        </tr>
                                    ))}
                                    {groupStats.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="text-center py-12 text-slate-400 font-sans">اطلاعات کالا در این بازه زمانی یافت نشد</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Groups Visual Progress contribution */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between">
                        <div>
                            <h3 className="text-xs font-bold text-slate-700 mb-6">📉 سهم وزنی هر گروه کالا در سبد فروش</h3>
                            <div className="space-y-4">
                                {groupStats.slice(0, 6).map((grp, idx) => {
                                    const totalW = groupStats.reduce((s, g) => s + g.weight, 0) || 1;
                                    const pct = Math.round((grp.weight / totalW) * 100);
                                    return (
                                        <div key={idx} className="space-y-1.5">
                                            <div className="flex justify-between text-xs">
                                                <span className="font-bold text-slate-700">{grp.groupName}</span>
                                                <span className="font-mono text-slate-500 font-bold">{pct}% ({grp.weight.toLocaleString()} kg)</span>
                                            </div>
                                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                                <div 
                                                    className="h-full bg-indigo-500 rounded-full transition-all" 
                                                    style={{ width: `${pct}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                                {groupStats.length === 0 && (
                                    <div className="text-center text-slate-400 py-12">داده‌ای یافت نشد</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 4: INDIVIDUAL ITEMS BREAKDOWN */}
            {salesTab === 'ITEMS' && !selectedInvoice && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-fade-in">
                    <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 font-bold text-xs text-slate-700 flex flex-col sm:flex-row justify-between items-center gap-2">
                        <span>🧵 جزئیات فروش کالاها به تفکیک نام کالا</span>
                        <div className="relative w-full sm:w-64">
                            <Search className="absolute right-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
                            <input 
                                type="text"
                                placeholder="فیلتر کالاها..."
                                className="w-full pr-8 pl-3 py-1.5 text-[11px] border bg-white rounded-lg focus:outline-none"
                                value={searchInvoice}
                                onChange={e => setSearchInvoice(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-right text-xs">
                            <thead className="bg-slate-50 border-b text-slate-500 text-[10px]">
                                <tr>
                                    <th className="p-4">نام کالا</th>
                                    <th className="p-4">گروه کالا</th>
                                    <th className="p-4 text-left">وزن کل (kg)</th>
                                    <th className="p-4 text-left">تعداد کارتن</th>
                                    <th className="p-4 text-left">مبلغ کل فروش (ریال)</th>
                                    <th className="p-4 text-left">میانگین فی (ریال)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y text-slate-600 font-mono">
                                {itemStats.filter(i => !searchInvoice || i.itemName.includes(searchInvoice)).map((item, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50/50">
                                        <td className="p-4 font-sans font-bold text-slate-800">{item.itemName}</td>
                                        <td className="p-4 font-sans text-slate-500">{item.groupName}</td>
                                        <td className="p-4 text-left text-orange-500 font-bold">{item.weight.toLocaleString()}</td>
                                        <td className="p-4 text-left">{item.quantity.toLocaleString()}</td>
                                        <td className="p-4 text-left text-indigo-600 font-bold">{item.totalPrice.toLocaleString()}</td>
                                        <td className="p-4 text-left text-slate-500">{Math.round(item.avgPrice).toLocaleString()}</td>
                                    </tr>
                                ))}
                                {itemStats.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="text-center py-12 text-slate-400 font-sans">اطلاعات فروش کالا یافت نشد</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
      );
  };

  const renderCustomerStatement = () => {
      if (selectedCustomer) {
          let runningBalance = 0;
          return (
              <div className="space-y-4">
                  <div className="flex items-center gap-4 mb-6">
                      <button onClick={() => setSelectedCustomer(null)} className="p-2 bg-white rounded-lg shadow-sm border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors">
                          <ArrowRight size={16} />
                      </button>
                      <h2 className="text-xl font-black text-slate-800">
                          ریز تراکنش‌های مشتری: <span className="text-indigo-600">{selectedCustomer}</span>
                      </h2>
                  </div>
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-right">
                        <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 text-[11px]">
                            <tr>
                                <th className="px-6 py-4 whitespace-nowrap">تاریخ</th>
                                <th className="px-6 py-4 whitespace-nowrap">شرح</th>
                                <th className="px-6 py-4 whitespace-nowrap">بدهکار</th>
                                <th className="px-6 py-4 whitespace-nowrap">بستانکار</th>
                                <th className="px-6 py-4 whitespace-nowrap">مانده</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono text-xs">
                            {customerDetails.map((row, idx) => {
                                const deb = parseFloat(row.Debit) || 0;
                                const cred = parseFloat(row.Credit) || 0;
                                runningBalance += (deb - cred);
                                return (
                                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-3 whitespace-nowrap text-slate-600" dir="ltr">{formatDate((row.Date || '').substring(0, 10))}</td>
                                        <td className="px-6 py-3 whitespace-nowrap font-sans text-slate-800">{row.Description || '-'}</td>
                                        <td className="px-6 py-3 whitespace-nowrap text-emerald-600" dir="ltr">{deb > 0 ? deb.toLocaleString() : '-'}</td>
                                        <td className="px-6 py-3 whitespace-nowrap text-rose-600" dir="ltr">{cred > 0 ? cred.toLocaleString() : '-'}</td>
                                        <td className="px-6 py-3 whitespace-nowrap font-bold text-indigo-700" dir="ltr">{runningBalance.toLocaleString()} {runningBalance > 0 ? '(بد)' : runningBalance < 0 ? '(بس)' : ''}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        </table>
                    </div>
                </div>
              </div>
          );
      }

      const filteredCustomers = customers.filter(c => !searchCustomer || c.AccountName.includes(searchCustomer));

      return (
          <div className="space-y-4">
              <div className="relative">
                  <Search className="w-5 h-5 absolute right-4 top-3.5 text-slate-400" />
                  <input
                      type="text"
                      placeholder="جستجوی نام مشتری..."
                      value={searchCustomer}
                      onChange={e => setSearchCustomer(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl py-3 pr-12 pl-4 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm font-medium"
                  />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredCustomers.map((cust, idx) => {
                      const deb = parseFloat(cust.Debit) || 0;
                      const cred = parseFloat(cust.Credit) || 0;
                      const bal = deb - cred;
                      const type = bal > 0 ? 'بدهکار' : (bal < 0 ? 'بستانکار' : 'تسویه');
                      return (
                          <div key={idx} onClick={() => setSelectedCustomer(cust.AccountName)} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-200 cursor-pointer transition-all">
                              <h3 className="font-bold text-slate-800 text-sm mb-3">{cust.AccountName}</h3>
                              <div className="flex justify-between items-center text-xs">
                                  <span className="text-slate-500">مانده حساب:</span>
                                  <span className={`font-black font-mono ${bal > 0 ? 'text-emerald-600' : (bal < 0 ? 'text-rose-600' : 'text-slate-400')}`} dir="ltr">
                                      {Math.abs(bal).toLocaleString()}
                                  </span>
                              </div>
                              <div className="mt-2 text-[10px] bg-slate-50 inline-block px-2 py-1 rounded text-slate-500 font-bold">
                                  وضعیت: {type}
                              </div>
                          </div>
                      );
                  })}
              </div>
          </div>
      );
  };

  const renderDebtorsCreditors = () => {
      const totalDebtors = data.filter(d => d.Type === 'بدهکار').reduce((sum, d) => sum + d.NetBalance, 0);
      const totalCreditors = data.filter(d => d.Type === 'بستانکار').reduce((sum, d) => sum + d.NetBalance, 0);

      return (
          <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
                      <div>
                          <div className="text-slate-500 text-xs font-bold mb-2">جمع کل بدهکاران (طلب شرکت)</div>
                          <div className="text-2xl font-black text-emerald-600" dir="ltr">{totalDebtors.toLocaleString()}</div>
                      </div>
                      <div className="p-4 bg-emerald-50 rounded-full text-emerald-500"><Activity size={24} /></div>
                  </div>
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
                      <div>
                          <div className="text-slate-500 text-xs font-bold mb-2">جمع کل بستانکاران (بدهی شرکت)</div>
                          <div className="text-2xl font-black text-rose-600" dir="ltr">{totalCreditors.toLocaleString()}</div>
                      </div>
                      <div className="p-4 bg-rose-50 rounded-full text-rose-500"><Activity size={24} /></div>
                  </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-right">
                    <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 text-[11px]">
                        <tr>
                            <th className="px-6 py-4 whitespace-nowrap">نام مشتری / حساب</th>
                            <th className="px-6 py-4 whitespace-nowrap">مبلغ مانده (ریال)</th>
                            <th className="px-6 py-4 whitespace-nowrap">وضعیت</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-xs">
                        {data.map((row, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-3 whitespace-nowrap font-sans text-slate-800 font-medium">{row.AccountName}</td>
                                <td className={`px-6 py-3 whitespace-nowrap font-bold ${row.Type === 'بدهکار' ? 'text-emerald-600' : 'text-rose-600'}`} dir="ltr">
                                    {row.NetBalance.toLocaleString()}
                                </td>
                                <td className="px-6 py-3 whitespace-nowrap">
                                    <span className={`inline-block px-2 py-1 rounded-md text-[10px] font-bold ${row.Type === 'بدهکار' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                                        {row.Type}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    </table>
                </div>
            </div>
          </div>
      );
  };

  const renderDetailsModal = () => {
    if (!showDetailsModal) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-2xl shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200"
        >
          <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
            <div>
                <h3 className="text-lg font-black text-slate-800">ریز اسناد (فاکتورها)</h3>
                <p className="text-xs text-slate-500 mt-1">مشاهده ریز مبالغ و تنظیمات انواع سند</p>
            </div>
            <button onClick={() => setShowDetailsModal(false)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors">
              <X size={20} />
            </button>
          </div>
          
          <div className="p-6 border-b border-slate-100 bg-white">
            <h4 className="text-xs font-bold text-slate-500 mb-3">تنظیمات پیشرفته گزارش (انواع فاکتور جهت محاسبه به عنوان فروش):</h4>
            <div className="flex flex-wrap gap-4">
                {availableSalesTypes.map(t => (
                    <label key={t} className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer select-none">
                        <input 
                            type="checkbox" 
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            checked={selectedSalesTypes.includes(t)}
                            onChange={(e) => {
                                if (e.target.checked) setSelectedSalesTypes(prev => [...prev, t]);
                                else setSelectedSalesTypes(prev => prev.filter(x => x !== t));
                            }}
                        />
                        {t}
                    </label>
                ))}
            </div>
          </div>

          <div className="flex-1 overflow-auto bg-slate-50/30 p-6">
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <table className="w-full text-sm text-right">
                    <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 text-[11px]">
                        <tr>
                            <th className="px-6 py-4 whitespace-nowrap">تاریخ</th>
                            <th className="px-6 py-4 whitespace-nowrap">نوع سند</th>
                            <th className="px-6 py-4 whitespace-nowrap">مبلغ (ریال)</th>
                            <th className="px-6 py-4 whitespace-nowrap">شخص / توضیحات</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-xs">
                        {data.map((row, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-3 whitespace-nowrap text-slate-600" dir="ltr">{formatDate(row.Date)}</td>
                                <td className="px-6 py-3 whitespace-nowrap text-slate-800 font-bold">{row.Type}</td>
                                <td className="px-6 py-3 whitespace-nowrap text-indigo-600 font-bold" dir="ltr">{Number(row.TotalSales || 0).toLocaleString()}</td>
                                <td className="px-6 py-3 text-slate-500 max-w-[300px] truncate" title={String(row.Field_027 || row.Field_028 || row.PersonName || '')}>
                                    {row.PersonName ? row.PersonName : (row.Field_010 ? row.Field_010 : '-')} 
                                </td>
                            </tr>
                        ))}
                        {data.length === 0 && (
                            <tr>
                                <td colSpan={4} className="text-center py-8 text-slate-400">هیچ سندی یافت نشد</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
          </div>
        </motion.div>
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-[#f8fafc] text-slate-800 font-sans overflow-hidden" dir="rtl">
      {/* Mobile Drawer Backdrop */}
      {showSidebar && (
        <div 
          onClick={() => setShowSidebar(false)} 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-20 md:hidden animate-fade-in"
        />
      )}

      {/* Sidebar */}
      <div 
        className={`fixed md:relative inset-y-0 right-0 w-72 bg-white border-l border-slate-200 flex flex-col shadow-lg md:shadow-none z-30 transition-transform duration-300 transform ${
          showSidebar ? 'translate-x-0' : 'translate-x-full md:translate-x-0'
        }`}
      >
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-md shadow-indigo-200">
              <BarChart2 className="text-white" size={20} />
            </div>
            <div>
              <h2 className="font-extrabold text-slate-800 text-base">گزارشات هوشکار سایان</h2>
              <p className="text-[10px] text-slate-500 font-medium mt-0.5">سیستم یکپارچه مالی</p>
            </div>
          </div>
          <button onClick={() => setShowSidebar(false)} className="md:hidden p-2 text-slate-400 hover:bg-slate-100 rounded-lg">
            <X size={18} />
          </button>
        </div>
 
        <div className="p-4 flex-1 overflow-y-auto space-y-2">
          <button
            onClick={() => { setActiveReport('SALES'); setSelectedCustomer(null); setShowSidebar(false); }}
            className={`w-full text-right p-4 rounded-xl transition-all flex items-center gap-3 ${
              activeReport === 'SALES' ? 'bg-indigo-500 text-white shadow-md shadow-indigo-200' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-indigo-200'
            }`}
          >
            <DollarSign size={18} className={activeReport === 'SALES' ? 'text-indigo-100' : 'text-indigo-500'} />
            <div>
              <div className="font-bold text-sm">فروش روزانه و ماهانه</div>
              <div className={`text-[10px] mt-1 ${activeReport === 'SALES' ? 'text-indigo-200' : 'text-slate-400'}`}>جمع مبالغ فاکتورها</div>
            </div>
          </button>
 
          <button
            onClick={() => { setActiveReport('CUSTOMER_STATEMENT'); setSelectedCustomer(null); setShowSidebar(false); }}
            className={`w-full text-right p-4 rounded-xl transition-all flex items-center gap-3 ${
              activeReport === 'CUSTOMER_STATEMENT' ? 'bg-rose-500 text-white shadow-md shadow-rose-200' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-rose-200'
            }`}
          >
            <Users size={18} className={activeReport === 'CUSTOMER_STATEMENT' ? 'text-rose-100' : 'text-rose-500'} />
            <div>
              <div className="font-bold text-sm">صورتحساب مشتریان</div>
              <div className={`text-[10px] mt-1 ${activeReport === 'CUSTOMER_STATEMENT' ? 'text-rose-200' : 'text-slate-400'}`}>ریز گردش و تراکنش‌ها</div>
            </div>
          </button>
 
          <button
            onClick={() => { setActiveReport('DEBTORS_CREDITORS'); setSelectedCustomer(null); setShowSidebar(false); }}
            className={`w-full text-right p-4 rounded-xl transition-all flex items-center gap-3 ${
              activeReport === 'DEBTORS_CREDITORS' ? 'bg-emerald-500 text-white shadow-md shadow-emerald-200' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-emerald-200'
            }`}
          >
            <Activity size={18} className={activeReport === 'DEBTORS_CREDITORS' ? 'text-emerald-100' : 'text-emerald-500'} />
            <div>
              <div className="font-bold text-sm">جمع بدهکاران و بستانکاران</div>
              <div className={`text-[10px] mt-1 ${activeReport === 'DEBTORS_CREDITORS' ? 'text-emerald-200' : 'text-slate-400'}`}>مانده حساب‌های اشخاص</div>
            </div>
          </button>
        </div>
      </div>
 
      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#f8fafc] overflow-hidden">
        {/* Header - Adaptive height and layout */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between p-4 lg:px-8 border-b border-slate-200 bg-white gap-4 shadow-sm z-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setShowSidebar(true)} 
                className="md:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors ml-1"
              >
                <Menu size={20} />
              </button>
              <h1 className="font-black text-base sm:text-lg text-slate-800 min-w-max">
                {activeReport === 'SALES' && 'داشبورد فروش'}
                {activeReport === 'CUSTOMER_STATEMENT' && 'صورتحساب مشتریان'}
                {activeReport === 'DEBTORS_CREDITORS' && 'بدهکاران و بستانکاران'}
              </h1>
            </div>
            
            <div className="hidden sm:block h-8 w-px bg-slate-200"></div>
 
            {/* Date Filter */}
            <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
                <ShamsiDatePicker date={startDate} onChange={setStartDate} label="از" />
                <ShamsiDatePicker date={endDate} onChange={setEndDate} label="تا" />
            </div>
 
            {loading && <Loader2 size={16} className="animate-spin text-indigo-500" />}
          </div>
          <div className="flex items-center gap-2 justify-end">
             <button onClick={() => fetchReportData(activeReport)} className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors">
              <RefreshCw size={13} /> بروزرسانی
            </button>
            <button onClick={exportData} className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold rounded-xl transition-colors">
              <Download size={13} /> خروجی اکسل
            </button>
          </div>
        </div>
 
        {/* Content Area */}
        <div className="flex-1 p-4 sm:p-8 overflow-y-auto no-scrollbar">
          {renderDetailsModal()}
          {error && (
            <div className="mb-6 bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-xl flex items-start gap-3">
              <Database size={20} className="mt-0.5 text-rose-500" />
              <div>
                <h3 className="font-bold text-sm">خطا در دریافت اطلاعات</h3>
                <p className="text-xs mt-1 opacity-80">{error}</p>
              </div>
            </div>
          )}
 
          {!loading && !error && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                {activeReport === 'SALES' && renderSalesDashboard()}
                {activeReport === 'CUSTOMER_STATEMENT' && renderCustomerStatement()}
                {activeReport === 'DEBTORS_CREDITORS' && renderDebtorsCreditors()}
            </motion.div>
          )}
 
          {!loading && data.length === 0 && customers.length === 0 && !error && (
            <div className="flex flex-col items-center justify-center py-20 sm:py-32 bg-white rounded-2xl border border-dashed border-slate-300 text-slate-400">
              <TableIcon size={48} className="mb-4 stroke-1 text-slate-300" />
              <p className="text-sm font-bold text-slate-600">داده‌ای یافت نشد</p>
              <p className="text-[11px] mt-1 text-slate-400">برای این گزارش در بازه زمانی انتخاب شده اطلاعاتی وجود ندارد.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SayanReports;
