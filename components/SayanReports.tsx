import React, { useState, useEffect } from 'react';
import { Database, Search, RefreshCw, BarChart2, Table as TableIcon, Download, DollarSign, Users, Calendar, Activity, Loader2, ArrowRight, X, Menu, Printer } from 'lucide-react';
import { apiCall } from '../services/apiService';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { jalaliToGregorian, getCurrentShamsiDate, formatDate } from '../constants';

type ReportType = 'SALES' | 'CUSTOMER_STATEMENT' | 'DEBTORS_CREDITORS' | 'SALES_BY_GROUP' | 'SALES_COMPARISON';

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

const normalizePersian = (str: string) => {
    if (!str) return '';
    return str
        .replace(/ي/g, 'ی')
        .replace(/ك/g, 'ک')
        .replace(/\u064a/g, '\u06cc')
        .replace(/\u0643/g, '\u06a9')
        .trim();
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
  const [compareStartDate, setCompareStartDate] = useState({ year: currentShamsi.year - 1, month: 1, day: 1 });
  const [compareEndDate, setCompareEndDate] = useState({ year: currentShamsi.year - 1, month: 12, day: 29 });

  // Customer Statement states
  const [customers, setCustomers] = useState<any[]>([]);
  const [searchCustomer, setSearchCustomer] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [customerDetails, setCustomerDetails] = useState<any[]>([]);

  // Advanced config states
  const [availableSalesTypes, setAvailableSalesTypes] = useState<string[]>([]);
  const [selectedSalesTypes, setSelectedSalesTypes] = useState<string[]>([]);
  const [availableStores, setAvailableStores] = useState<string[]>([]);
  const [selectedStores, setSelectedStores] = useState<string[]>([]);

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

    const compStartIso = toIsoDateString(jalaliToGregorian(compareStartDate.year, compareStartDate.month, compareStartDate.day));
    const compEndIso = toIsoDateString(jalaliToGregorian(compareEndDate.year, compareEndDate.month, compareEndDate.day));
    const compStartShamsiStr1 = `${compareStartDate.year}/${String(compareStartDate.month).padStart(2, '0')}/${String(compareStartDate.day).padStart(2, '0')}`;
    const compEndShamsiStr1 = `${compareEndDate.year}/${String(compareEndDate.month).padStart(2, '0')}/${String(compareEndDate.day).padStart(2, '0')}`;
    const compStartShamsiStr2 = compStartShamsiStr1.replace(/\//g, '-');
    const compEndShamsiStr2 = compEndShamsiStr1.replace(/\//g, '-');

    const isDateInCompareRange = (dateVal: any) => {
        if (!dateVal) return false;
        const dStr = String(dateVal).substring(0, 10);
        return (dStr >= compStartIso && dStr <= compEndIso) || 
               (dStr >= compStartShamsiStr1 && dStr <= compEndShamsiStr1) ||
               (dStr >= compStartShamsiStr2 && dStr <= compEndShamsiStr2);
    };

    try {
      if (reportType === 'SALES' || reportType === 'SALES_BY_GROUP' || reportType === 'SALES_COMPARISON') {
        let dateSql = '';
        if (startDate) {
            const startIsoStr = toIsoDateString(jalaliToGregorian(startDate.year, startDate.month, startDate.day));
            dateSql += ` AND CONVERT(VARCHAR(10), Field_008, 120) >= '${startIsoStr}'`;
        }
        if (endDate) {
            const endIsoStr = toIsoDateString(jalaliToGregorian(endDate.year, endDate.month, endDate.day));
            dateSql += ` AND CONVERT(VARCHAR(10), Field_008, 120) <= '${endIsoStr}'`;
        }

        // Add comparison date ranges for SALES_COMPARISON
        if (reportType === 'SALES_COMPARISON') {
            let compSql = '';
            if (compareStartDate && compareEndDate) {
                const cStartIso = toIsoDateString(jalaliToGregorian(compareStartDate.year, compareStartDate.month, compareStartDate.day));
                const cEndIso = toIsoDateString(jalaliToGregorian(compareEndDate.year, compareEndDate.month, compareEndDate.day));
                compSql = ` OR (CONVERT(VARCHAR(10), Field_008, 120) >= '${cStartIso}' AND CONVERT(VARCHAR(10), Field_008, 120) <= '${cEndIso}')`;
            }
            if (dateSql && compSql) {
                dateSql = ` AND ((${dateSql.substring(4)})${compSql})`;
            }
        }

        // Query STR_TBL_010 (Warehouse/Store Documents Header) which contains Sales Invoices
        sqlQuery = `SELECT * FROM STR_TBL_010 WHERE 1=1 ${dateSql} ORDER BY Field_008 DESC`;
        
        const finalData = await attemptQuery(sqlQuery, 'STR_TBL_010');
        
        // Fetch document types with accounting prefix (Field_003)
        let docTypes: Record<string, string> = {};
        let docPrefixes: Record<string, string> = {};
        try {
            const types = await attemptQuery("SELECT TOP 20000 Field_001, Field_003, Field_004 FROM STR_TBL_006", 'STR_TBL_006');
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
            const tafsili = await attemptQuery("SELECT TOP 50000 Field_003, Field_005, Field_006 FROM ACT_TBL_007", 'ACT_TBL_007');
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
        const docIds = finalData.map((r: any) => r.Field_001).filter(Boolean);
        if (docIds.length > 0) {
            for (let i = 0; i < docIds.length; i += 200) {
                try {
                    const chunk = docIds.slice(i, i + 200).map(id => `'${id}'`).join(',');
                    const chunkData = await attemptQuery(`SELECT * FROM STR_TBL_011 WHERE Field_004 IN (${chunk})`, 'STR_TBL_011');
                    if (Array.isArray(chunkData)) {
                        detailsList = detailsList.concat(chunkData);
                    }
                } catch(e) { console.error("STR_TBL_011 chunk fetch failed", e); }
            }
        }

        
        // --- SMART PRODUCT MAP BUILDER ---
        const pMap: Record<string, string> = {};
        const fetchProductTable = async (tableName: string, codeCols: string[], nameCols: string[]) => {
            try {
                const cols = [...new Set([...codeCols, ...nameCols])];
                const list = await attemptQuery(`SELECT TOP 20000 ${cols.join(', ')} FROM ${tableName}`, tableName);
                list.forEach((p: any) => {
                    let name = '';
                    for (const col of nameCols) {
                        if (p[col] && String(p[col]).trim().length > 1) {
                            name = String(p[col]).trim();
                            break;
                        }
                    }
                    if (!name) return;
                    for (const col of codeCols) {
                        if (p[col] && String(p[col]).trim()) {
                            pMap[String(p[col]).trim()] = name;
                        }
                    }
                });
            } catch(e) { /* ignore silently */ }
        };

        
        // Try standard Sayan product tables
        await fetchProductTable('IND_TBL_022', ['Field_001', 'Field_003', 'Field_005'], ['Field_004', 'Field_006']);
        await fetchProductTable('COM_TBL_008', ['Field_001', 'Field_003'], ['Field_004', 'Field_003']);
        await fetchProductTable('STR_TBL_008', ['Field_001', 'Field_003', 'Field_004'], ['Field_006', 'Field_004']);
        await fetchProductTable('GNR_TBL_019', ['Field_001', 'Field_003', 'Field_004'], ['Field_005', 'Field_006']);
        await fetchProductTable('GNR_TBL_003', ['Field_001', 'Field_003', 'Field_004'], ['Field_006', 'Field_007']);
        await fetchProductTable('GNR_TBL_015', ['Field_001', 'Field_003'], ['Field_004']);
        await fetchProductTable('IND_TBL_002', ['Field_001', 'Field_003', 'Field_004', 'Field_005'], ['Field_006', 'Field_007', 'Field_008', 'Field_004']);


        setProductMap(pMap);

        // --- SMART GROUP MAP BUILDER ---
        const gMap: Record<string, string> = {};
        const fetchGroupTable = async (tableName: string, codeCols: string[], nameCols: string[]) => {
            try {
                const cols = [...new Set([...codeCols, ...nameCols])];
                const list = await attemptQuery(`SELECT TOP 10000 ${cols.join(', ')} FROM ${tableName}`, tableName);
                list.forEach((g: any) => {
                    let name = '';
                    for (const col of nameCols) {
                        if (g[col] && String(g[col]).trim().length > 1) {
                            name = String(g[col]).trim();
                            break;
                        }
                    }
                    if (!name) return;
                    for (const col of codeCols) {
                        if (g[col] && String(g[col]).trim()) {
                            gMap[String(g[col]).trim()] = name;
                        }
                    }
                });
            } catch(e) { /* ignore */ }
        };

        await fetchGroupTable('GNR_TBL_007', ['Field_001', 'Field_003'], ['Field_006', 'Field_004']);
        await fetchGroupTable('IND_TBL_021', ['Field_001', 'Field_003'], ['Field_004']);
        await fetchGroupTable('IND_TBL_002', ['Field_001', 'Field_003'], ['Field_004', 'Field_006']);
        await fetchGroupTable('GNR_TBL_002', ['Field_001', 'Field_003'], ['Field_004']);
        await fetchGroupTable('STR_TBL_001', ['Field_001', 'Field_003'], ['Field_004', 'Field_006']);

        setGroupMap(gMap);


        // Fetch IND_TBL_002 (Product Groups Hierarchy Names)
        let productGroupNames: Record<string, string> = {};
        try {
            const indGroups = await attemptQuery("SELECT TOP 20000 Field_003, Field_008 FROM IND_TBL_002", 'IND_TBL_002');
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
            const indLinks = await attemptQuery("SELECT TOP 50000 Field_003, Field_004 FROM IND_TBL_021", 'IND_TBL_021');
            indLinks.forEach((l: any) => {
                const groupCode = String(l.Field_003 || '').trim();
                const productCode = String(l.Field_004 || '').trim();
                if (productCode && groupCode) {
                    productCodeToGroupCode[productCode] = groupCode;
                }
            });
        } catch(e) { console.error("IND_TBL_021 links fetch failed", e); }
        
        // Fetch stores (Warehouses) from STR_TBL_015
        const storeMap: Record<string, string> = {};
        try {
            const storesList = await attemptQuery("SELECT TOP 1000 Field_001, Field_004 FROM STR_TBL_015", 'STR_TBL_015');
            storesList.forEach((s: any) => {
                if (s.Field_001 && s.Field_004) storeMap[String(s.Field_001).trim()] = String(s.Field_004).trim();
            });
        } catch(e) { console.error("STR_TBL_015 stores fetch failed", e); }

        // Find all available types in the DB
        const typesSet = new Set<string>();
        const storesSet = new Set<string>();
        finalData.forEach((row: any) => {
            const typeId = String(row.Field_004 || '').trim();
            if (typeId && typeId !== 'undefined' && typeId !== 'null') {
                const typeName = docTypes[typeId] || `نوع ${typeId}`;
                typesSet.add(typeName);
            }
            const storeId = String(row.Field_005 || row.Field_006 || '').trim();
            if (storeId) {
                const storeName = storeMap[storeId] || `انبار ${storeId}`;
                storesSet.add(storeName);
            }
        });
        const typesArr = Array.from(typesSet);
        if (availableSalesTypes.length === 0 && typesArr.length > 0) {
            setAvailableSalesTypes(typesArr);
            // Default select types that are likely sales/invoices, excluding proforma
            const likelySales = typesArr.filter(t => (t.includes('فروش') || t.includes('مرجوع') || t.includes('برگشت') || t.includes('فاکتور')) && !t.includes('پیش فاکتور'));
            setSelectedSalesTypes(likelySales.length > 0 ? likelySales : typesArr);
        }
        
        const storesArr = Array.from(storesSet);
        if (availableStores.length === 0 && storesArr.length > 0) {
            setAvailableStores(storesArr);
            setSelectedStores(storesArr);
        }

        const processed = finalData.map((row: any) => {
            // Cancelled flag check
            if (String(row.Field_019).toLowerCase() === 'true' || row.Field_019 === 1) return null;

            // Amount is usually in Field_027, Field_037, or Field_038 in STR_TBL_010
            const amount = Math.abs(parseFloat(row.Field_027 || row.Field_038 || row.Field_037 || row.Field_025 || 0));
            const typeId = String(row.Field_004 || '').trim();
            const typeName = typeId ? (docTypes[typeId] || `نوع ${typeId}`) : 'نامشخص';
            const prefixCode = typeId ? (docPrefixes[typeId] || '') : '';
            const invoiceItemsRaw = (detailsList || []).filter((d: any) => String(d.Field_004).trim() === String(row.Field_001).trim());
            
            // Check transaction type (Field_003: 1=Receipt, 2=Issue)
            // Sales are Issues (حواله) which is 2. Returns are Receipts (رسید) which is 1.
            let isReturn = false;
            
            if (typeName.includes('برگشت') || typeName.includes('مرجوع') || typeName.includes('برگشتی')) {
                 isReturn = true;
            } else {
                 isReturn = false; // Default to sales
            }

            // Name mapping
            const personId = String(row.Field_010 || row.Field_011 || '').trim();
            const personName = personId ? (tafsiliMap[personId] || personId) : '';
            
            // Get Store Name
            const storeId = String(row.Field_005 || row.Field_006 || '').trim();
            const storeName = storeId ? (storeMap[storeId] || `انبار ${storeId}`) : 'انبار نامشخص';

            // Match invoice details (rows) using Field_004 as the parent document link field
            const docId = String(row.Field_001).trim();
            let matchedDetails = invoiceItemsRaw;
            
            if (matchedDetails.length === 0) {
                return null;
            }
            const invoiceItems = matchedDetails.map((det: any) => {
                let code = '';
                let rawItemName = '';
                const possibleCodeFields = [det.Field_005, det.Field_007, det.Field_008, det.Field_009, det.Field_010, det.Field_011, det.Field_004, det.Field_003];
                
                for (const f of possibleCodeFields) {
                    const c = String(f || '').trim();
                    if (c && pMap[c] && c !== String(docId).trim()) {
                        code = c;
                        rawItemName = pMap[c];
                        break;
                    }
                }
                
                // Smart fallback for product name based on prefix

                if (!rawItemName && code) {
                    // Start by looking up the productCodeToGroupCode link
                    const linkedGroupCode = productCodeToGroupCode[code];
                    if (linkedGroupCode) {
                         // Find the deepest available group name
                         let bestName = '';
                         for (let len = linkedGroupCode.length; len >= 2; len -= 2) {
                             const partialCode = linkedGroupCode.substring(0, len);
                             if (productGroupNames[partialCode]) {
                                 bestName = productGroupNames[partialCode];
                                 break;
                             }
                         }
                         if (bestName) rawItemName = bestName;
                    }
                    if (!rawItemName) rawItemName = `کالا ${code}`;
                } else if (!rawItemName) {
                    rawItemName = 'کالای نامشخص';
                }

                // Determine Main Group and Sub-Group names directly from Sayan's Database Tables (IND_TBL_002 and IND_TBL_021)
                let mainGroup = 'نامشخص';
                let subGroup = 'سایر گروه‌ها';

                const linkedGroupCode = productCodeToGroupCode[code];
                if (linkedGroupCode) {
                    // Main Group (گروه اصلی) is usually Level 1 (Length 2) in Sayan
                    if (linkedGroupCode.length >= 2) {
                        const level1Code = linkedGroupCode.substring(0, 2);
                        if (productGroupNames[level1Code]) {
                            mainGroup = productGroupNames[level1Code];
                        }
                    }
                    
                    // Sub Group (گروه فرعی) is the deepest level available before the product itself
                    let bestSubGroup = '';
                    const codeLen = linkedGroupCode.length;
                    for (let len = 4; len <= codeLen; len += 2) {
                        const partialCode = linkedGroupCode.substring(0, len);
                        if (productGroupNames[partialCode] && productGroupNames[partialCode] !== rawItemName) {
                            bestSubGroup = productGroupNames[partialCode];
                        }
                    }
                    
                    if (bestSubGroup) {
                        subGroup = bestSubGroup;
                    } else if (mainGroup !== 'نامشخص') {
                        subGroup = mainGroup;
                    }
                }

                // Only fallback to Store Name if absolutely no group is found in DB
                if (mainGroup === 'نامشخص' && storeName) {
                    mainGroup = storeName;
                }

                const formattedFullName = subGroup !== 'سایر گروه‌ها' ? `${subGroup} - ${rawItemName}` : rawItemName;
                let qty1 = Math.abs(parseFloat(det.Field_006) || 0);
                let qty2 = Math.abs(parseFloat(det.Field_012 || det.Field_008 || det.Field_010) || 0);
                
                // Field_006 is consistently the primary quantity (Weight) in Sayan STR_TBL_011
                // Field_012/008 is the secondary quantity (Count/Cartons)
                let w = qty1;
                let qty = qty2;
                
                // If one of them is 0, weight gets the non-zero one if it makes sense.
                if (w === 0 && qty > 0) {
                     w = qty;
                     qty = 1;
                }
                if (qty === 0) qty = 1;


                // Parse Field_031 for metadata like gross weight, cartons, bobbins, grade, etc.
                let detailsStr = String(det.Field_031 || det.Field_032 || det.Field_033 || det.Field_034 || '');
                let grossWeight = 0;
                let bobbinCount = 0;
                let isYarn = detailsStr.includes('وزن') || detailsStr.includes('بوبین');
                let cartonCount = isYarn ? qty : 0;
                let grade = '';
                let twist = '';
                
                if (detailsStr) {
                    const parts = detailsStr.split('|').map(p => p.trim());
                    parts.forEach(p => {
                        if (p.includes('وزن ناخالص:')) grossWeight = Math.abs(parseFloat(p.split(':')[1]) || 0);
                        if (p.includes('تعداد بوبین:')) bobbinCount = Math.abs(parseFloat(p.split(':')[1]) || 0);
                        if (p.includes('تعداد کارتن:')) cartonCount = Math.abs(parseFloat(p.split(':')[1]) || cartonCount);
                        if (p.includes('گرید:')) grade = String(p.split(':')[1] || '').trim();
                        if (p.includes('جهت تاب:')) twist = String(p.split(':')[1] || '').trim();
                    });
                }

                let fee = Math.abs(parseFloat(det.Field_015 || det.Field_013 || det.Field_025 || det.Field_037 || det.Field_023 || 0)); 
                let totalPrice = Math.abs(parseFloat(det.Field_016 || det.Field_014 || det.Field_027 || det.Field_026 || det.Field_035 || det.Field_036 || 0));
                
                if (fee === 0 || totalPrice <= 12) {
                    const allVals = [
                        det.Field_013, det.Field_014, det.Field_015, det.Field_016,
                        det.Field_023, det.Field_024, det.Field_025, det.Field_026, det.Field_027,
                        det.Field_035, det.Field_036, det.Field_037, det.Field_038
                    ].map(v => Math.abs(parseFloat(v)) || 0).filter(v => v > 0);
                    
                    if (allVals.length >= 2) {
                        allVals.sort((a,b) => b - a);
                        totalPrice = allVals[0];
                        fee = allVals[1];
                        for (let t of allVals) {
                            for (let f of allVals) {
                                if (t !== f && Math.abs(f * qty1 - t) < 10) { fee = f; totalPrice = t; }
                                else if (t !== f && Math.abs(f * qty2 - t) < 10) { fee = f; totalPrice = t; }
                            }
                        }
                    } else if (allVals.length === 1) {
                        totalPrice = allVals[0];
                    }
                }

                if (totalPrice > 0 && (fee === 0 || fee === 1 || fee === totalPrice)) {
                    fee = totalPrice / (qty1 > 0 ? qty1 : 1);
                } else if (fee > 0 && (totalPrice === 0 || totalPrice === 1 || totalPrice === fee)) {
                    totalPrice = fee * (qty1 > 0 ? qty1 : 1);
                }

                return {
                    code,
                    name: formattedFullName,
                    rawName: rawItemName,
                    mainGroup: mainGroup,
                    group: subGroup,
                    weight: w,
                    grossWeight,
                    cartonCount,
                    bobbinCount,
                    grade,
                    twist,
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
            if (finalAmount === 0 || isNaN(finalAmount)) {
                finalAmount = invoiceItems.reduce((sum, item) => sum + item.totalPrice, 0);
            }
            let finalWeight = weight;

            return {
                ...row,
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
            const docTypeId = String(r.Field_004 || '').trim();
            const matchesTypeSelection = selectedSalesTypes.includes(r.Type) || selectedSalesTypes.includes(docTypeId);
            if (!matchesTypeSelection) return false;

            if (reportType === 'SALES_COMPARISON') {
                return isDateInRange(r.Date) || isDateInCompareRange(r.Date);
            }
            return isDateInRange(r.Date);
        });
        
        setData(processed.reverse());
      }
      else if (reportType === 'CUSTOMER_STATEMENT') {
        const moeinGroups = await attemptQuery("SELECT Field_001, Field_003, Field_004 FROM ACT_TBL_004", 'ACT_TBL_004').catch(() => []);
        const validPersonGroupIds = new Set<string>();
        moeinGroups.forEach((g: any) => {
             const gName = String(g.Field_004 || g.Field_003 || '').trim();
             if (gName.includes('اشخاص') || gName.includes('بدهی') || gName.includes('مشتری') || gName.includes('حسابهای دریافتنی')) {
                  if (g.Field_001) validPersonGroupIds.add(String(g.Field_001).trim());
                  if (g.Field_003) validPersonGroupIds.add(String(g.Field_003).trim());
             }
        });
        if (validPersonGroupIds.size === 0) {
             validPersonGroupIds.add('11');
        }

        const accountsData = await attemptQuery("SELECT Field_003, Field_004, Field_005, Field_006 FROM ACT_TBL_007", 'ACT_TBL_007').catch(() => []);
        const accountMap: Record<string, string> = {};
        const personAccountsSet = new Set<string>();
        
        accountsData.forEach((a: any) => {
            const name = String(a.Field_006 || '').trim();
            const moeinGroup = String(a.Field_004 || '').trim();
            if (name) {
                if (a.Field_003) {
                    accountMap[String(a.Field_003).trim()] = name;
                    if (validPersonGroupIds.has(moeinGroup)) {
                         personAccountsSet.add(String(a.Field_003).trim());
                    }
                }
                if (a.Field_005) {
                    accountMap[String(a.Field_005).trim()] = name;
                    if (validPersonGroupIds.has(moeinGroup)) {
                         personAccountsSet.add(String(a.Field_005).trim());
                    }
                }
            }
        });

        const invoices = await attemptQuery("SELECT Field_010, Field_011 FROM STR_TBL_010", 'STR_TBL_010').catch(() => []);
        const customerCodesSet = new Set<string>();
               if (!selectedCustomer) {
            sqlQuery = `
                SELECT 
                    t2.Field_015 as [Codes],
                    t2.Field_018 as [Details],
                    SUM(CASE WHEN CONVERT(VARCHAR(10), t1.Field_008, 120) < '${startIso}' THEN CAST(t2.Field_009 AS DECIMAL(18,2)) ELSE 0 END) as [OpeningDebit],
                    SUM(CASE WHEN CONVERT(VARCHAR(10), t1.Field_008, 120) < '${startIso}' THEN CAST(t2.Field_010 AS DECIMAL(18,2)) ELSE 0 END) as [OpeningCredit],
                    SUM(CASE WHEN CONVERT(VARCHAR(10), t1.Field_008, 120) >= '${startIso}' AND CONVERT(VARCHAR(10), t1.Field_008, 120) <= '${endIso}' THEN CAST(t2.Field_009 AS DECIMAL(18,2)) ELSE 0 END) as [PeriodDebit],
                    SUM(CASE WHEN CONVERT(VARCHAR(10), t1.Field_008, 120) >= '${startIso}' AND CONVERT(VARCHAR(10), t1.Field_008, 120) <= '${endIso}' THEN CAST(t2.Field_010 AS DECIMAL(18,2)) ELSE 0 END) as [PeriodCredit]
                FROM ACT_TBL_009 t2
                LEFT JOIN ACT_TBL_008 t1 ON t2.Field_004 = t1.Field_005 AND t2.Field_003 = t1.Field_004
                WHERE 1=1
                GROUP BY t2.Field_015, t2.Field_018
            `;
            const finalData = await attemptQuery(sqlQuery, 'ACT_TBL_009');
            
            const grouped: Record<string, any> = {};
            
            customerCodesSet.forEach(code => {
                const name = accountMap[code] || `شخص ${code}`;
                grouped[name] = { AccountName: name, Code: code, OpeningDebit: 0, OpeningCredit: 0, PeriodDebit: 0, PeriodCredit: 0 };
            });

            finalData.forEach((row: any) => {
                const codesStr = String(row.Codes || row.Details || '');
                let customerCode = null;
                const parts = codesStr.split(/[^0-9a-zA-Z]+/);
                for (const p of parts) {
                    const trimmed = p.trim();
                    if (customerCodesSet.has(trimmed)) {
                        customerCode = trimmed;
                        break;
                    }
                }
                
                if (!customerCode) return;
                
                const customerName = accountMap[customerCode] || `شخص ${customerCode}`;
                
                if (!grouped[customerName]) {
                     grouped[customerName] = { AccountName: customerName, Code: customerCode, OpeningDebit: 0, OpeningCredit: 0, PeriodDebit: 0, PeriodCredit: 0 };
                }
                
                grouped[customerName].OpeningDebit += parseFloat(row.OpeningDebit || 0) || 0;
                grouped[customerName].OpeningCredit += parseFloat(row.OpeningCredit || 0) || 0;
                grouped[customerName].PeriodDebit += parseFloat(row.PeriodDebit || 0) || 0;
                grouped[customerName].PeriodCredit += parseFloat(row.PeriodCredit || 0) || 0;
            });

            const customersList = Object.values(grouped).map((cust: any) => {
                const opening = cust.OpeningDebit - cust.OpeningCredit;
                const netDebit = cust.PeriodDebit + (opening > 0 ? opening : 0);
                const netCredit = cust.PeriodCredit + (opening < 0 ? Math.abs(opening) : 0);
                return {
                    AccountName: cust.AccountName,
                    Code: cust.Code,
                    Debit: netDebit,
                    Credit: netCredit
                };
            }).filter((cust: any) => cust.Debit > 0 || cust.Credit > 0);

            setCustomers(customersList);
            setData([]);
        } else {
            // Robust targetCode lookup
            let targetCode: string | null = null;
            const custObj = customers.find(c => c.AccountName === selectedCustomer);
            if (custObj && custObj.Code) {
                targetCode = custObj.Code;
            } else {
                for (const key in accountMap) {
                    if (accountMap[key] === selectedCustomer) {
                        targetCode = key;
                        break;
                    }
                }
            }
            
            let targetCodes: string[] = [];
            const normSel = normalizePersian(selectedCustomer);
            for (const key in accountMap) {
                if (normalizePersian(accountMap[key]).includes(normSel)) {
                    targetCodes.push(key);
                }
            }

            let customerFilterSql = '';
            if (targetCodes.length > 0) {
                const conditions = targetCodes.map(tc => `t2.Field_015 LIKE '%${tc}%' OR t2.Field_018 LIKE '%${tc}%'`);
                customerFilterSql = `AND (${conditions.join(' OR ')})`;
            } else if (targetCode) {
                customerFilterSql = `AND (t2.Field_015 LIKE '%${targetCode}%' OR t2.Field_018 LIKE '%${targetCode}%')`;
            } else {
                // Normalize selectedCustomer to handle both Arabic and Persian keyboard inputs
                const normCust = selectedCustomer.replace(/ی/g, 'ي').replace(/ک/g, 'ك');
                const normCust2 = selectedCustomer.replace(/ي/g, 'ی').replace(/ك/g, 'ک');
                customerFilterSql = `AND (t2.Field_011 LIKE N'%${selectedCustomer}%' OR t2.Field_011 LIKE N'%${normCust}%' OR t2.Field_011 LIKE N'%${normCust2}%' OR t2.Field_018 LIKE N'%${selectedCustomer}%')`;
            }

            sqlQuery = `SELECT 
                t1.Field_008 as [Date], 
                t2.Field_011 as [Description], 
                t2.Field_009 as [Debit], 
                t2.Field_010 as [Credit], 
                t2.Field_015 as [Codes], 
                t2.Field_013 as [SanadNumber], 
                t2.Field_018 as [Details], 
                t2.Field_005, t2.Field_006, t2.Field_007 
            FROM ACT_TBL_009 t2 
            LEFT JOIN ACT_TBL_008 t1 ON t2.Field_004 = t1.Field_005 AND t2.Field_003 = t1.Field_004 
            WHERE 1=1 ${customerFilterSql}
            ORDER BY t1.Field_008 ASC`;
            const finalData = await attemptQuery(sqlQuery, 'ACT_TBL_009');
            
            let openingBalance = 0;
            const periodRows: any[] = [];
            
            finalData.forEach((row: any) => {
                // We trust the SQL query (customerFilterSql) which already filtered by targetCode
                // So all rows returned belong to the customer.

                const d = parseFloat(row.Debit || row.Field_009 || 0) || 0;
                const c = parseFloat(row.Credit || row.Field_010 || 0) || 0;
                const date = row.Date;
                
                if (date) {
                    const dStr = String(date).substring(0, 10);
                    if (startIso && dStr < startIso) {
                         openingBalance += (d - c);
                    } else if ((!startIso || dStr >= startIso) && (!endIso || dStr <= endIso)) {
                         periodRows.push({
                            Date: date,
                            Description: row.Description || row.Field_011,
                            SanadNumber: row.SanadNumber || row.Field_013,
                            Debit: d,
                            Credit: c,
                            Balance: d - c
                         });
                    }
                } else {
                    periodRows.push({
                        Date: date,
                        Description: row.Description || row.Field_011,
                        SanadNumber: row.SanadNumber || row.Field_013,
                        Debit: d,
                        Credit: c,
                        Balance: d - c
                     });
                }
            });
            
            let run = openingBalance;
            const finalCust = periodRows.map((r: any) => {
                run += r.Balance;
                return { ...r, Balance: run };
            });
            
            if (openingBalance !== 0 || finalCust.length === 0) {
                 finalCust.unshift({
                     Date: '',
                     Description: 'مانده از قبل',
                     SanadNumber: '-',
                     Debit: openingBalance > 0 ? openingBalance : 0,
                     Credit: openingBalance < 0 ? Math.abs(openingBalance) : 0,
                     Balance: openingBalance,
                     isOpening: true
                 });
            }
            
            setCustomerDetails(finalCust);
        }
      }
      else if (reportType === 'DEBTORS_CREDITORS') {
        const moeinGroups = await attemptQuery("SELECT Field_001, Field_003, Field_004 FROM ACT_TBL_004", 'ACT_TBL_004').catch(() => []);
        const validPersonGroupIds = new Set<string>();
        moeinGroups.forEach((g: any) => {
             const gName = String(g.Field_004 || g.Field_003 || '').trim();
             if (gName.includes('اشخاص') || gName.includes('بدهی') || gName.includes('مشتری') || gName.includes('حسابهای دریافتنی')) {
                  if (g.Field_001) validPersonGroupIds.add(String(g.Field_001).trim());
                  if (g.Field_003) validPersonGroupIds.add(String(g.Field_003).trim());
             }
        });
        if (validPersonGroupIds.size === 0) {
             validPersonGroupIds.add('11');
        }

        const accountsData = await attemptQuery("SELECT Field_003, Field_004, Field_005, Field_006 FROM ACT_TBL_007", 'ACT_TBL_007').catch(() => []);
        const accountMap: Record<string, string> = {};
        const personAccountsSet = new Set<string>();
        
        accountsData.forEach((a: any) => {
            const name = String(a.Field_006 || '').trim();
            const moeinGroup = String(a.Field_004 || '').trim();
            if (name) {
                if (a.Field_003) {
                    accountMap[String(a.Field_003).trim()] = name;
                    if (validPersonGroupIds.has(moeinGroup)) {
                         personAccountsSet.add(String(a.Field_003).trim());
                    }
                }
                if (a.Field_005) {
                    accountMap[String(a.Field_005).trim()] = name;
                    if (validPersonGroupIds.has(moeinGroup)) {
                         personAccountsSet.add(String(a.Field_005).trim());
                    }
                }
            }
        });

        const invoices = await attemptQuery("SELECT Field_010, Field_011 FROM STR_TBL_010", 'STR_TBL_010').catch(() => []);
        const customerCodesSet = new Set<string>();
        invoices.forEach((r: any) => {
           if (r.Field_010) customerCodesSet.add(String(r.Field_010).trim());
           if (r.Field_011) customerCodesSet.add(String(r.Field_011).trim());
        });
        personAccountsSet.forEach(code => customerCodesSet.add(code));

        sqlQuery = `
            SELECT 
                t2.Field_015 as [Codes],
                t2.Field_018 as [Details],
                SUM(CASE WHEN CONVERT(VARCHAR(10), t1.Field_008, 120) < '${startIso}' THEN CAST(t2.Field_009 AS DECIMAL(18,2)) ELSE 0 END) as [OpeningDebit],
                SUM(CASE WHEN CONVERT(VARCHAR(10), t1.Field_008, 120) < '${startIso}' THEN CAST(t2.Field_010 AS DECIMAL(18,2)) ELSE 0 END) as [OpeningCredit],
                SUM(CASE WHEN CONVERT(VARCHAR(10), t1.Field_008, 120) >= '${startIso}' AND CONVERT(VARCHAR(10), t1.Field_008, 120) <= '${endIso}' THEN CAST(t2.Field_009 AS DECIMAL(18,2)) ELSE 0 END) as [PeriodDebit],
                SUM(CASE WHEN CONVERT(VARCHAR(10), t1.Field_008, 120) >= '${startIso}' AND CONVERT(VARCHAR(10), t1.Field_008, 120) <= '${endIso}' THEN CAST(t2.Field_010 AS DECIMAL(18,2)) ELSE 0 END) as [PeriodCredit]
            FROM ACT_TBL_009 t2
            LEFT JOIN ACT_TBL_008 t1 ON t2.Field_004 = t1.Field_005 AND t2.Field_003 = t1.Field_004
            WHERE 1=1
            GROUP BY t2.Field_015, t2.Field_018
        `;
        const finalData = await attemptQuery(sqlQuery, 'ACT_TBL_009');
        
        const grouped: Record<string, any> = {};
        finalData.forEach((row: any) => {
            const codesStr = String(row.Codes || row.Details || '');
            let customerCode = null;
            const parts = codesStr.split(/[:\-]/);
            for (const p of parts) {
                const trimmed = p.trim();
                if (customerCodesSet.has(trimmed)) {
                    customerCode = trimmed;
                    break;
                }
            }
            if (!customerCode) return;
            
            const name = accountMap[customerCode] || `شخص ${customerCode}`;
            
            if (!grouped[name]) {
                grouped[name] = { AccountName: name, OpeningDebit: 0, OpeningCredit: 0, PeriodDebit: 0, PeriodCredit: 0, Code: customerCode };
            }
            
            grouped[name].OpeningDebit += parseFloat(row.OpeningDebit || 0) || 0;
            grouped[name].OpeningCredit += parseFloat(row.OpeningCredit || 0) || 0;
            grouped[name].PeriodDebit += parseFloat(row.PeriodDebit || 0) || 0;
            grouped[name].PeriodCredit += parseFloat(row.PeriodCredit || 0) || 0;
        });
        
        const processed = Object.values(grouped).map((row: any) => {
            const openingBalance = row.OpeningDebit - row.OpeningCredit;
            const periodNet = row.PeriodDebit - row.PeriodCredit;
            const net = openingBalance + periodNet;
            return {
                ...row,
                Debit: row.PeriodDebit,
                Credit: row.PeriodCredit,
                OpeningBalance: openingBalance,
                NetBalance: Math.abs(net),
                Type: net > 0 ? 'بدهکار' : net < 0 ? 'بستانکار' : 'تسویه',
                RawBalance: net
            };
        }).filter((row: any) => row.NetBalance > 0 || row.Debit > 0 || row.Credit > 0).sort((a, b) => b.NetBalance - a.NetBalance);
        
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
  const compStartDateStr = `${compareStartDate.year}-${compareStartDate.month}-${compareStartDate.day}`;
  const compEndDateStr = `${compareEndDate.year}-${compareEndDate.month}-${compareEndDate.day}`;
  const selectedSalesTypesStr = selectedSalesTypes.join(',');

  useEffect(() => {
    fetchReportData(activeReport);
  }, [activeReport, startDateStr, endDateStr, compStartDateStr, compEndDateStr, selectedCustomer, selectedSalesTypesStr]);

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
          (row.Items || []).forEach((item: any) => {
              const gName = item.group || 'سایر گروه‌ها';
              if (!acc[gName]) {
                  acc[gName] = { groupName: gName, weight: 0, quantity: 0, totalPrice: 0 };
              }
              if (row.IsReturn) {
                  // if you want to subtract returns from group stats:
                  // acc[gName].weight -= item.weight;
                  // acc[gName].quantity -= item.quantity;
                  // acc[gName].totalPrice -= item.totalPrice;
              } else {
                  acc[gName].weight += item.weight;
                  acc[gName].quantity += item.quantity;
                  acc[gName].totalPrice += item.totalPrice;
              }
          });
          return acc;
      }, {})).map((g: any) => ({
          ...g,
          avgPrice: g.weight > 0 ? (g.totalPrice / g.weight) : (g.quantity > 0 ? g.totalPrice / g.quantity : 0)
      })).filter((g: any) => g.totalPrice > 0).sort((a: any, b: any) => b.totalPrice - a.totalPrice);

      // Aggregate sales by Item Name
      const itemStats = Object.values(data.reduce((acc: Record<string, any>, row) => {
          (row.Items || []).forEach((item: any) => {
              const iName = item.name || 'کالای نامشخص';
              if (!acc[iName]) {
                  acc[iName] = { itemName: iName, groupName: item.group || 'سایر گروه‌ها', weight: 0, quantity: 0, totalPrice: 0 };
              }
              if (row.IsReturn) {
                  // acc[iName].weight -= item.weight;
                  // acc[iName].quantity -= item.quantity;
                  // acc[iName].totalPrice -= item.totalPrice;
              } else {
                  acc[iName].weight += item.weight;
                  acc[iName].quantity += item.quantity;
                  acc[iName].totalPrice += item.totalPrice;
              }
          });
          return acc;
      }, {})).map((i: any) => ({
          ...i,
          avgPrice: i.weight > 0 ? (i.totalPrice / i.weight) : (i.quantity > 0 ? i.totalPrice / i.quantity : 0)
      })).filter((i: any) => i.totalPrice > 0).sort((a: any, b: any) => b.totalPrice - a.totalPrice);


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
                        <div className="bg-white border print:border-none print:shadow-none rounded-2xl shadow-md p-6 print:p-0 max-w-4xl mx-auto animate-scale-up space-y-6" id="printable-invoice-sheet">
                            {/* Invoice Sheet Header */}
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-6 print:pb-4 gap-4">
                                <div className="space-y-1">
                                    <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                                        <span>{selectedInvoice.IsReturn ? '🔴 برگشت از فروش کالا و خدمات' : '🟢 صورتحساب فروش کالا و خدمات'}</span>
                                    </h2>
                                    <p className="text-sm font-bold text-slate-600 mt-2">فروشنده: شرکت لپان بافت</p>
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
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 print:gap-4 bg-slate-50/50 print:bg-transparent p-4 print:p-0 rounded-xl border print:border-none text-xs">
                                <div className="space-y-1 print:col-span-2 print:border-b print:pb-2">
                                    <span className="text-slate-400 print:text-slate-600 font-bold block">خریدار:</span>
                                    <span className="text-slate-800 font-extrabold text-sm">{selectedInvoice.PersonName || 'خریدار متفرقه'}</span>
                                </div>
                                <div className="space-y-1 print:border-b print:pb-2">
                                    <span className="text-slate-400 print:text-slate-600 font-bold block">شماره فاکتور:</span>
                                    <span className="text-slate-800 font-mono font-bold">{selectedInvoice.Field_005 || selectedInvoice.Field_001}</span>
                                </div>
                                <div className="space-y-1 print:border-b print:pb-2">
                                    <span className="text-slate-400 print:text-slate-600 font-bold block">تاریخ ثبت فاکتور:</span>
                                    <span className="text-slate-800 font-bold">{formatDate(selectedInvoice.Date)}</span>
                                </div>
                            </div>

                            {/* Invoice Items Table */}
                            <div className="border border-slate-200 rounded-xl overflow-hidden">
                                <table className="w-full text-right text-xs">
                                    <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 text-[10px]">
                                        <tr>
                                            <th className="p-3 text-center">ردیف</th>
                                            <th className="p-3">نام و شرح کالا</th>
                                            <th className="p-3 text-left">مقدار (kg)</th>
                                            <th className="p-3 text-left">وزن ناخالص</th>
                                            <th className="p-3 text-center">کارتن</th>
                                            <th className="p-3 text-center">بوبین</th>
                                            <th className="p-3 text-left">فی واحد (ریال)</th>
                                            <th className="p-3 text-left">مبلغ کل (ریال)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y text-slate-600 font-mono">
                                        {(selectedInvoice.Items || []).map((item: any, idx: number) => (
                                            <tr key={idx} className="hover:bg-slate-50/30">
                                                <td className="p-3 text-center font-sans text-slate-400">{idx + 1}</td>
                                                <td className="p-3 font-sans font-bold text-slate-800 text-[11px] leading-relaxed">
                                                    {item.name}
                                                    <div className="text-[10px] text-slate-400 mt-1 font-mono">{item.code}</div>
                                                </td>
                                                <td className="p-3 text-left text-orange-500 font-bold">{item.weight > 0 ? item.weight.toLocaleString() : '-'}</td>
                                                <td className="p-3 text-left text-slate-500">{item.grossWeight > 0 ? item.grossWeight.toLocaleString() : '-'}</td>
                                                <td className="p-3 text-center font-bold text-slate-800">{item.cartonCount > 0 ? item.cartonCount : '-'}</td>
                                                <td className="p-3 text-center text-slate-600">{item.bobbinCount > 0 ? item.bobbinCount : '-'}</td>
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

  const [groupBy, setGroupBy] = useState<'DAY' | 'MONTH'>('DAY');

  const renderSalesByGroup = () => {
      // Group by mainGroup (Store) and then by group (Product Group)
      const groupStats: Record<string, Record<string, any>> = {};
      
      data.forEach(row => {
          if (!row.Items) return;
          
          row.Items.forEach((item: any) => {
              const mg = item.mainGroup || 'نامشخص';
              const grp = item.group || 'نامشخص';
              
              if (!groupStats[mg]) {
                  groupStats[mg] = {};
              }
              if (!groupStats[mg][grp]) {
                  groupStats[mg][grp] = { 
                      mainGroup: mg, 
                      groupName: grp, 
                      weight: 0, 
                      amount: 0, 
                      returnsWeight: 0, 
                      returnsAmount: 0 
                  };
              }
              
              const w = item.weight || 0;
              const a = item.totalPrice || 0;
              
              if (row.IsReturn) {
                  groupStats[mg][grp].returnsWeight += w;
                  groupStats[mg][grp].returnsAmount += a;
              } else {
                  groupStats[mg][grp].weight += w;
                  groupStats[mg][grp].amount += a;
              }
          });
      });

      const itemsArray: any[] = [];
      let totalSalesW = 0, totalSalesA = 0, totalRetW = 0, totalRetA = 0, totalNetW = 0, totalNetA = 0;

      Object.keys(groupStats).sort().forEach(mg => {
          const grps = Object.values(groupStats[mg]).sort((a: any, b: any) => b.amount - a.amount);
          
          let mgSalesW = 0, mgSalesA = 0, mgRetW = 0, mgRetA = 0, mgNetW = 0, mgNetA = 0;

          grps.forEach((g: any, idx) => {
              const netW = g.weight - g.returnsWeight;
              const netA = g.amount - g.returnsAmount;
              
              mgSalesW += g.weight;
              mgSalesA += g.amount;
              mgRetW += g.returnsWeight;
              mgRetA += g.returnsAmount;
              mgNetW += netW;
              mgNetA += netA;

              totalSalesW += g.weight;
              totalSalesA += g.amount;
              totalRetW += g.returnsWeight;
              totalRetA += g.returnsAmount;
              totalNetW += netW;
              totalNetA += netA;

              itemsArray.push({
                  ...g,
                  netWeight: netW,
                  netAmount: netA,
                  isFirstOfMain: idx === 0,
                  mainRowSpan: grps.length + 1 // +1 for the subtotal row
              });
          });
          
          // Subtotal row for the Main Group
          itemsArray.push({
              isSubtotal: true,
              mainGroup: mg,
              groupName: `جمع ${mg}`,
              weight: mgSalesW,
              amount: mgSalesA,
              returnsWeight: mgRetW,
              returnsAmount: mgRetA,
              netWeight: mgNetW,
              netAmount: mgNetA,
              isFirstOfMain: false
          });
      });

      const printReport = () => {
          const style = document.createElement('style');
          style.innerHTML = `@media print { body * { visibility: hidden; } #printable-sales-group, #printable-sales-group * { visibility: visible; } #printable-sales-group { position: absolute; left: 0; top: 0; width: 100%; padding: 0 !important; } .no-print { display: none !important; } table { width: 100%; border-collapse: collapse; } th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: center; } th { background-color: #f8fafc !important; -webkit-print-color-adjust: exact; } }`;
          document.head.appendChild(style);
          window.print();
          document.head.removeChild(style);
      };

      return (
          <div className="space-y-6 animate-scale-up" id="printable-sales-group">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-200 print:border-none print:shadow-none print:p-0 gap-4">
                  <div>
                      <h2 className="text-xl font-black text-slate-800">گزارش وضعیت فروش و برگشت از فروش به تفکیک گروه بندی کالا</h2>
                      <p className="text-sm font-bold text-slate-500 mt-2">از تاریخ {formatDate(startDateStr)} الی {formatDate(endDateStr)}</p>
                  </div>
                  <div className="flex items-center gap-3 no-print">
                      <button onClick={printReport} className="flex items-center gap-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-sm font-bold transition-colors">
                          <Printer size={16} /> چاپ گزارش
                      </button>
                  </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden print:border-none print:shadow-none">
                  <div className="overflow-x-auto">
                      <table className="w-full text-center text-xs">
                          <thead className="bg-slate-50 border-b text-slate-800 text-[11px] font-black">
                              <tr>
                                  <th className="p-3 border-l" rowSpan={2}>گروه اصلی</th>
                                  <th className="p-3 border-l" rowSpan={2}>گروه فرعی</th>
                                  <th className="p-2 border-l border-b" colSpan={2}>فروش</th>
                                  <th className="p-2 border-l border-b" colSpan={2}>برگشت از فروش</th>
                                  <th className="p-2 border-b" colSpan={2}>فروش خالص</th>
                              </tr>
                              <tr>
                                  <th className="p-2 border-l">جمع تعداد</th>
                                  <th className="p-2 border-l">جمع مبلغ</th>
                                  <th className="p-2 border-l">جمع تعداد</th>
                                  <th className="p-2 border-l">جمع مبلغ</th>
                                  <th className="p-2 border-l">تعداد</th>
                                  <th className="p-2">مبلغ</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y text-slate-700 font-mono text-[11px]">
                              {itemsArray.map((item: any, idx: number) => (
                                  <tr key={idx} className={item.isSubtotal ? "bg-indigo-50/50 border-t border-indigo-100" : "hover:bg-slate-50/50"}>
                                      {item.isFirstOfMain && (
                                          <td className="p-3 border-l font-sans font-black bg-slate-50/30 align-top" rowSpan={item.mainRowSpan}>
                                              {item.mainGroup}
                                          </td>
                                      )}
                                      <td className={`p-3 border-l font-sans text-right ${item.isSubtotal ? 'font-black text-indigo-800' : 'font-bold text-slate-800'}`}>{item.groupName}</td>
                                      <td className={`p-3 border-l ${item.isSubtotal ? 'text-indigo-700 font-bold' : 'text-emerald-700'}`}>{item.weight !== 0 ? item.weight.toLocaleString() : '-'}</td>
                                      <td className={`p-3 border-l font-bold ${item.isSubtotal ? 'text-indigo-700' : 'text-emerald-700'}`}>{item.amount !== 0 ? item.amount.toLocaleString() : '-'}</td>
                                      <td className={`p-3 border-l ${item.isSubtotal ? 'text-indigo-700 font-bold' : 'text-rose-500'}`}>{item.returnsWeight !== 0 ? item.returnsWeight.toLocaleString() : '-'}</td>
                                      <td className={`p-3 border-l font-bold ${item.isSubtotal ? 'text-indigo-700' : 'text-rose-500'}`}>{item.returnsAmount !== 0 ? item.returnsAmount.toLocaleString() : '-'}</td>
                                      <td className={`p-3 border-l ${item.isSubtotal ? 'text-indigo-900 font-black' : 'text-slate-800'}`}>{item.netWeight !== 0 ? item.netWeight.toLocaleString() : '-'}</td>
                                      <td className={`p-3 font-black ${item.isSubtotal ? 'text-indigo-900' : 'text-slate-800'}`}>{item.netAmount !== 0 ? item.netAmount.toLocaleString() : '-'}</td>
                                  </tr>
                              ))}
                              {itemsArray.length > 0 && (
                                  <tr className="bg-slate-100 font-black text-slate-800 border-t-2 border-slate-400">
                                      <td className="p-4 border-l font-sans text-left" colSpan={2}>جمع کل</td>
                                      <td className="p-4 border-l text-emerald-700">{totalSalesW > 0 ? totalSalesW.toLocaleString() : '-'}</td>
                                      <td className="p-4 border-l text-emerald-700">{totalSalesA > 0 ? totalSalesA.toLocaleString() : '-'}</td>
                                      <td className="p-4 border-l text-rose-600">{totalRetW > 0 ? totalRetW.toLocaleString() : '-'}</td>
                                      <td className="p-4 border-l text-rose-600">{totalRetA > 0 ? totalRetA.toLocaleString() : '-'}</td>
                                      <td className="p-4 border-l">{totalNetW.toLocaleString()}</td>
                                      <td className="p-4 text-indigo-700">{totalNetA.toLocaleString()}</td>
                                  </tr>
                              )}
                              {itemsArray.length === 0 && (
                                  <tr>
                                      <td colSpan={8} className="text-center py-12 text-slate-400 font-sans">داده‌ای یافت نشد</td>
                                  </tr>
                              )}
                          </tbody>
                      </table>
                  </div>
              </div>
          </div>
      );
  };

  const compStartShamsiStr = `${compareStartDate.year}/${String(compareStartDate.month).padStart(2, '0')}/${String(compareStartDate.day).padStart(2, '0')}`;
  const compEndShamsiStr = `${compareEndDate.year}/${String(compareEndDate.month).padStart(2, '0')}/${String(compareEndDate.day).padStart(2, '0')}`;

  const renderSalesComparison = () => {
      const compGroups: Record<string, { p1: { w: number, a: number, rw: number, ra: number }, p2: { w: number, a: number, rw: number, ra: number } }> = {};
      
      let p1TotalW = 0, p1TotalA = 0, p2TotalW = 0, p2TotalA = 0;

      const startIso = toIsoDateString(jalaliToGregorian(startDate.year, startDate.month, startDate.day));
      const endIso = toIsoDateString(jalaliToGregorian(endDate.year, endDate.month, endDate.day));
      const startShamsiStr1 = `${startDate.year}/${String(startDate.month).padStart(2, '0')}/${String(startDate.day).padStart(2, '0')}`;
      const startShamsiStr2 = startShamsiStr1.replace(/\//g, '-');
      const endShamsiStr1 = `${endDate.year}/${String(endDate.month).padStart(2, '0')}/${String(endDate.day).padStart(2, '0')}`;
      const endShamsiStr2 = endShamsiStr1.replace(/\//g, '-');

      const compStartIso = toIsoDateString(jalaliToGregorian(compareStartDate.year, compareStartDate.month, compareStartDate.day));
      const compEndIso = toIsoDateString(jalaliToGregorian(compareEndDate.year, compareEndDate.month, compareEndDate.day));
      const compStartShamsiStr1 = `${compareStartDate.year}/${String(compareStartDate.month).padStart(2, '0')}/${String(compareStartDate.day).padStart(2, '0')}`;
      const compEndShamsiStr1 = `${compareEndDate.year}/${String(compareEndDate.month).padStart(2, '0')}/${String(compareEndDate.day).padStart(2, '0')}`;
      const compStartShamsiStr2 = compStartShamsiStr1.replace(/\//g, '-');
      const compEndShamsiStr2 = compEndShamsiStr1.replace(/\//g, '-');

      const checkP1 = (dateVal: any) => {
          if (!dateVal) return false;
          const dStr = String(dateVal).substring(0, 10);
          return (dStr >= startIso && dStr <= endIso) || 
                 (dStr >= startShamsiStr1 && dStr <= endShamsiStr1) ||
                 (dStr >= startShamsiStr2 && dStr <= endShamsiStr2);
      };

      const checkP2 = (dateVal: any) => {
          if (!dateVal) return false;
          const dStr = String(dateVal).substring(0, 10);
          return (dStr >= compStartIso && dStr <= compEndIso) || 
                 (dStr >= compStartShamsiStr1 && dStr <= compEndShamsiStr1) ||
                 (dStr >= compStartShamsiStr2 && dStr <= compEndShamsiStr2);
      };

      data.forEach(row => {
          const isP1 = checkP1(row.Date);
          const isP2 = checkP2(row.Date);
          if (!isP1 && !isP2) return;

          if (row.Items) {
              row.Items.forEach((item: any) => {
                  const grp = item.group || 'نامشخص';
                  if (!compGroups[grp]) {
                      compGroups[grp] = { p1: { w: 0, a: 0, rw: 0, ra: 0 }, p2: { w: 0, a: 0, rw: 0, ra: 0 } };
                  }
                  
                  const w = item.weight || 0;
                  const a = item.totalPrice || 0;
                  
                  if (isP1) {
                      if (row.IsReturn) { compGroups[grp].p1.rw += w; compGroups[grp].p1.ra += a; }
                      else { compGroups[grp].p1.w += w; compGroups[grp].p1.a += a; }
                  }
                  if (isP2) {
                      if (row.IsReturn) { compGroups[grp].p2.rw += w; compGroups[grp].p2.ra += a; }
                      else { compGroups[grp].p2.w += w; compGroups[grp].p2.a += a; }
                  }
              });
          }
      });

      const groupArray = Object.keys(compGroups).map(grp => {
          const g = compGroups[grp];
          const netW1 = g.p1.w - g.p1.rw;
          const netA1 = g.p1.a - g.p1.ra;
          const netW2 = g.p2.w - g.p2.rw;
          const netA2 = g.p2.a - g.p2.ra;

          p1TotalW += netW1;
          p1TotalA += netA1;
          p2TotalW += netW2;
          p2TotalA += netA2;

          return { group: grp, netW1, netA1, netW2, netA2 };
      }).sort((a, b) => b.netA1 - a.netA1); // sort by period 1 amount DESC

      const diffTotalA = p1TotalA - p2TotalA;
      const diffTotalW = p1TotalW - p2TotalW;
      const pctTotalA = p2TotalA === 0 ? (p1TotalA > 0 ? 100 : 0) : (diffTotalA / p2TotalA) * 100;
      const pctTotalW = p2TotalW === 0 ? (p1TotalW > 0 ? 100 : 0) : (diffTotalW / p2TotalW) * 100;

      const printReport = () => {
          const style = document.createElement('style');
          style.innerHTML = `@media print { body * { visibility: hidden; } #printable-comparison, #printable-comparison * { visibility: visible; } #printable-comparison { position: absolute; left: 0; top: 0; width: 100%; padding: 0 !important; } .no-print { display: none !important; } table { width: 100%; border-collapse: collapse; } th, td { border: 1px solid #cbd5e1; padding: 12px; text-align: center; } th { background-color: #f8fafc !important; -webkit-print-color-adjust: exact; } }`;
          document.head.appendChild(style);
          window.print();
          document.head.removeChild(style);
      };

      return (
          <div className="space-y-6 animate-scale-up" id="printable-comparison">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-200 print:border-none print:shadow-none print:p-0 gap-4">
                  <div>
                      <h2 className="text-xl font-black text-slate-800">گزارش مقایسه‌ای فروش (به تفکیک گروه)</h2>
                      <p className="text-sm font-bold text-slate-500 mt-2">مقایسه دو بازه زمانی</p>
                  </div>
                  <button onClick={printReport} className="no-print flex items-center gap-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-sm font-bold transition-colors">
                      <Printer size={16} /> چاپ گزارش
                  </button>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden print:border-none print:shadow-none">
                  <div className="overflow-x-auto">
                      <table className="w-full text-center text-sm">
                          <thead className="bg-slate-50 border-b text-slate-500 text-xs">
                              <tr>
                                  <th className="p-4 border-l" rowSpan={2}>گروه کالا</th>
                                  <th className="p-2 border-l border-b" colSpan={2}>بازه اول: {formatDate(startDateStr)} تا {formatDate(endDateStr)}</th>
                                  <th className="p-2 border-l border-b" colSpan={2}>بازه دوم: {formatDate(compStartShamsiStr)} تا {formatDate(compEndShamsiStr)}</th>
                                  <th className="p-2 border-b" colSpan={2}>تغییرات (نسبت به بازه دوم)</th>
                              </tr>
                              <tr>
                                  <th className="p-2 border-l">وزن خالص (kg)</th>
                                  <th className="p-2 border-l">مبلغ خالص (ریال)</th>
                                  <th className="p-2 border-l">وزن خالص (kg)</th>
                                  <th className="p-2 border-l">مبلغ خالص (ریال)</th>
                                  <th className="p-2 border-l">رشد وزن</th>
                                  <th className="p-2">رشد مبلغ</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y text-slate-700 font-mono">
                              {groupArray.map((g, idx) => {
                                  const dW = g.netW1 - g.netW2;
                                  const dA = g.netA1 - g.netA2;
                                  const pW = g.netW2 === 0 ? (g.netW1 > 0 ? 100 : 0) : (dW / g.netW2) * 100;
                                  const pA = g.netA2 === 0 ? (g.netA1 > 0 ? 100 : 0) : (dA / g.netA2) * 100;

                                  return (
                                      <tr key={idx} className="hover:bg-slate-50/50">
                                          <td className="p-4 border-l font-sans font-bold text-slate-800">{g.group}</td>
                                          <td className="p-4 border-l text-emerald-600">{g.netW1.toLocaleString()}</td>
                                          <td className="p-4 border-l font-bold text-indigo-600">{g.netA1.toLocaleString()}</td>
                                          <td className="p-4 border-l text-emerald-600">{g.netW2.toLocaleString()}</td>
                                          <td className="p-4 border-l font-bold text-slate-600">{g.netA2.toLocaleString()}</td>
                                          <td className={`p-4 border-l font-bold ${dW > 0 ? 'text-emerald-600' : (dW < 0 ? 'text-rose-500' : 'text-slate-400')} text-xs`} dir="ltr">
                                              {dW > 0 ? '▲' : (dW < 0 ? '▼' : '-')} {dW !== 0 ? `${Math.abs(pW).toFixed(1)}%` : ''}
                                          </td>
                                          <td className={`p-4 font-bold ${dA > 0 ? 'text-emerald-600' : (dA < 0 ? 'text-rose-500' : 'text-slate-400')} text-xs`} dir="ltr">
                                              {dA > 0 ? '▲' : (dA < 0 ? '▼' : '-')} {dA !== 0 ? `${Math.abs(pA).toFixed(1)}%` : ''}
                                          </td>
                                      </tr>
                                  );
                              })}
                              
                              {groupArray.length > 0 && (
                                  <tr className="bg-slate-50 font-black text-slate-800 border-t-2 border-slate-300">
                                      <td className="p-4 border-l font-sans">جمع کل</td>
                                      <td className="p-4 border-l text-emerald-700">{p1TotalW.toLocaleString()}</td>
                                      <td className="p-4 border-l text-indigo-700">{p1TotalA.toLocaleString()}</td>
                                      <td className="p-4 border-l text-emerald-700">{p2TotalW.toLocaleString()}</td>
                                      <td className="p-4 border-l text-slate-700">{p2TotalA.toLocaleString()}</td>
                                      <td className={`p-4 border-l ${diffTotalW > 0 ? 'text-emerald-600' : (diffTotalW < 0 ? 'text-rose-500' : 'text-slate-400')} text-xs`} dir="ltr">
                                          {diffTotalW > 0 ? '▲' : (diffTotalW < 0 ? '▼' : '-')} {diffTotalW !== 0 ? `${Math.abs(pctTotalW).toFixed(1)}%` : ''}
                                      </td>
                                      <td className={`p-4 ${diffTotalA > 0 ? 'text-emerald-600' : (diffTotalA < 0 ? 'text-rose-500' : 'text-slate-400')} text-xs`} dir="ltr">
                                          {diffTotalA > 0 ? '▲' : (diffTotalA < 0 ? '▼' : '-')} {diffTotalA !== 0 ? `${Math.abs(pctTotalA).toFixed(1)}%` : ''}
                                      </td>
                                  </tr>
                              )}
                              {groupArray.length === 0 && (
                                  <tr>
                                      <td colSpan={7} className="text-center py-12 text-slate-400 font-sans">داده‌ای برای مقایسه یافت نشد</td>
                                  </tr>
                              )}
                          </tbody>
                      </table>
                  </div>
              </div>
          </div>
      );
  };

  const renderCustomerStatement = () => {
      if (selectedCustomer) {
          
          
          
          const printStatement = () => {
              let html = `
              <html>
              <head>
                  <title>صورتحساب مشتری - ${selectedCustomer}</title>
                  <style>
                      body { font-family: Tahoma, Arial; direction: rtl; padding: 20px; }
                      h2 { text-align: center; }
                      table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                      th, td { border: 1px solid #000; padding: 8px; text-align: right; }
                      th { background-color: #f2f2f2; }
                  </style>
              </head>
              <body>
                  <h2>صورتحساب مشتری: ${selectedCustomer}</h2>
                  <table>
                      <thead>
                          <tr>
                              <th>ردیف</th>
                              <th>تاریخ</th>
                              <th>شرح</th>
                              <th>بدهکار</th>
                              <th>بستانکار</th>
                              <th>مانده</th>
                          </tr>
                      </thead>
                      <tbody>
                          ${customerDetails.map((row, idx) => {
                              const deb = parseFloat(row.Debit) || 0;
                              const cred = parseFloat(row.Credit) || 0;
                              const bal = parseFloat(row.Balance) || 0;
                              return `
                              <tr>
                                  <td>${idx + 1}</td>
                                  <td dir="ltr" style="text-align: left;">${formatDate((row.Date || '').substring(0, 10))}</td>
                                  <td>${row.Description || '-'}</td>
                                  <td dir="ltr" style="text-align: left;">${deb > 0 ? deb.toLocaleString() : '-'}</td>
                                  <td dir="ltr" style="text-align: left;">${cred > 0 ? cred.toLocaleString() : '-'}</td>
                                  <td dir="ltr" style="text-align: left; font-weight: bold;">${Math.abs(bal).toLocaleString()} ${bal > 0 ? '(بد)' : bal < 0 ? '(بس)' : ''}</td>
                              </tr>
                              `;
                          }).join('')}
                      </tbody>
                  </table>
              </body>
              </html>
              `;
              
              const printWindow = window.open('', '_blank');
              if (printWindow) {
                  printWindow.document.write(html);
                  printWindow.document.close();
                  printWindow.focus();
                  setTimeout(() => {
                      printWindow.print();
                      printWindow.close();
                  }, 250);
              }
          };

          return (
              <div className="space-y-4">
                  <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-4">
                          <button onClick={() => setSelectedCustomer(null)} className="p-2 bg-white rounded-lg shadow-sm border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors">
                              <ArrowRight size={16} />
                          </button>
                          <h2 className="text-xl font-black text-slate-800">
                              ریز تراکنش‌های مشتری: <span className="text-indigo-600">{selectedCustomer}</span>
                          </h2>
                      </div>
                      <button onClick={printStatement} className="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-indigo-100 transition-colors">
                          <Printer size={16} /> چاپ صورتحساب
                      </button>
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
                                return (
                                    <tr key={idx} className={`hover:bg-slate-50 transition-colors ${row.isOpening ? 'bg-slate-100 font-bold' : ''}`}>
                                        <td className="px-6 py-3 whitespace-nowrap text-slate-600" dir="ltr">{formatDate((row.Date || '').substring(0, 10))}</td>
                                        <td className="px-6 py-3 whitespace-nowrap font-sans text-slate-800">{row.Description || '-'}</td>
                                        <td className="px-6 py-3 whitespace-nowrap text-emerald-600" dir="ltr">{deb > 0 ? deb.toLocaleString() : '-'}</td>
                                        <td className="px-6 py-3 whitespace-nowrap text-rose-600" dir="ltr">{cred > 0 ? cred.toLocaleString() : '-'}</td>
                                        <td className="px-6 py-3 whitespace-nowrap font-bold text-indigo-700" dir="ltr">{Math.abs(row.Balance).toLocaleString()} {row.Balance > 0 ? '(بد)' : row.Balance < 0 ? '(بس)' : ''}</td>
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
      const debtors = data.filter(d => d.Type === 'بدهکار');
      const creditors = data.filter(d => d.Type === 'بستانکار');
      
      const totalDebtors = debtors.reduce((sum, d) => sum + d.NetBalance, 0);
      const totalCreditors = creditors.reduce((sum, d) => sum + d.NetBalance, 0);

      const printList = (listType: 'بدهکار' | 'بستانکار') => {
          const list = listType === 'بدهکار' ? debtors : creditors;
          const total = listType === 'بدهکار' ? totalDebtors : totalCreditors;
          
          let html = `
          <html>
          <head>
              <title>لیست ${listType}ان</title>
              <style>
                  body { font-family: Tahoma, Arial; direction: rtl; padding: 20px; }
                  h2 { text-align: center; }
                  table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                  th, td { border: 1px solid #000; padding: 8px; text-align: right; }
                  th { background-color: #f2f2f2; }
                  .total { font-weight: bold; background-color: #e6e6e6; }
              </style>
          </head>
          <body>
              <h2>لیست ${listType}ان</h2>
              <table>
                  <thead>
                      <tr>
                          <th>ردیف</th>
                          <th>نام مشتری / حساب</th>
                          <th>مانده قبلی</th>
                          <th>گردش بدهکار</th>
                          <th>گردش بستانکار</th>
                          <th>مانده نهایی (ریال)</th>
                          <th>تشخیص</th>
                      </tr>
                  </thead>
                  <tbody>
                      ${list.map((row, idx) => `
                      <tr>
                          <td>${idx + 1}</td>
                          <td>${row.AccountName}</td>
                          <td dir="ltr" style="text-align: left;">${row.OpeningBalance.toLocaleString()}</td>
                          <td dir="ltr" style="text-align: left;">${row.Debit.toLocaleString()}</td>
                          <td dir="ltr" style="text-align: left;">${row.Credit.toLocaleString()}</td>
                          <td dir="ltr" style="text-align: left;">${row.NetBalance.toLocaleString()}</td>
                          <td>${row.Type}</td>
                      </tr>
                      `).join('')}
                      <tr class="total">
                          <td colspan="2" style="text-align: left;">جمع کل:</td>
                          <td dir="ltr" style="text-align: left;">${total.toLocaleString()}</td>
                      </tr>
                  </tbody>
              </table>
          </body>
          </html>
          `;
          
          const printWindow = window.open('', '_blank');
          if (printWindow) {
              printWindow.document.write(html);
              printWindow.document.close();
              printWindow.focus();
              // Small timeout to allow styles to load
              setTimeout(() => {
                  printWindow.print();
                  printWindow.close();
              }, 250);
          }
      };

      return (
          <div className="space-y-6">
              <div className="flex justify-end gap-3 mb-4">
                  <button onClick={() => printList('بدهکار')} className="bg-emerald-50 text-emerald-600 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-emerald-100 transition-colors">
                      <Printer size={16} /> چاپ بدهکاران
                  </button>
                  <button onClick={() => printList('بستانکار')} className="bg-rose-50 text-rose-600 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-rose-100 transition-colors">
                      <Printer size={16} /> چاپ بستانکاران
                  </button>
              </div>
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
                            <th className="px-6 py-4 whitespace-nowrap">مانده قبلی</th>
                            <th className="px-6 py-4 whitespace-nowrap">بدهکار (طی دوره)</th>
                            <th className="px-6 py-4 whitespace-nowrap">بستانکار (طی دوره)</th>
                            <th className="px-6 py-4 whitespace-nowrap">مانده نهایی (ریال)</th>
                            <th className="px-6 py-4 whitespace-nowrap">تشخیص</th>
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
            <h4 className="text-xs font-bold text-slate-500 mb-3">تنظیمات پیشرفته گزارش:</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <h5 className="text-[11px] font-bold text-slate-700 mb-2">انواع اسناد فروش و مرجوعی:</h5>
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
                <div>
                    <h5 className="text-[11px] font-bold text-slate-700 mb-2">انبارهای مجاز جهت گزارش گیری:</h5>
                    <div className="flex flex-wrap gap-4">
                        {availableStores.map(s => (
                            <label key={s} className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer select-none">
                                <input 
                                    type="checkbox" 
                                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                    checked={selectedStores.includes(s)}
                                    onChange={(e) => {
                                        if (e.target.checked) setSelectedStores(prev => [...prev, s]);
                                        else setSelectedStores(prev => prev.filter(x => x !== s));
                                    }}
                                />
                                {s}
                            </label>
                        ))}
                    </div>
                </div>
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
            onClick={() => { setActiveReport('SALES_BY_GROUP'); setSelectedCustomer(null); setShowSidebar(false); }}
            className={`w-full text-right p-4 rounded-xl transition-all flex items-center gap-3 ${
              activeReport === 'SALES_BY_GROUP' ? 'bg-indigo-500 text-white shadow-md shadow-indigo-200' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-indigo-200'
            }`}
          >
            <BarChart2 size={18} className={activeReport === 'SALES_BY_GROUP' ? 'text-indigo-100' : 'text-indigo-500'} />
            <div>
              <div className="font-bold text-sm">فروش به تفکیک گروه</div>
              <div className={`text-[10px] mt-1 ${activeReport === 'SALES_BY_GROUP' ? 'text-indigo-200' : 'text-slate-400'}`}>گزارش وزنی و مبلغی کالاها</div>
            </div>
          </button>

          <button
            onClick={() => { setActiveReport('SALES_COMPARISON'); setSelectedCustomer(null); setShowSidebar(false); }}
            className={`w-full text-right p-4 rounded-xl transition-all flex items-center gap-3 ${
              activeReport === 'SALES_COMPARISON' ? 'bg-indigo-500 text-white shadow-md shadow-indigo-200' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-indigo-200'
            }`}
          >
            <Activity size={18} className={activeReport === 'SALES_COMPARISON' ? 'text-indigo-100' : 'text-indigo-500'} />
            <div>
              <div className="font-bold text-sm">مقایسه فروش دوره‌ای</div>
              <div className={`text-[10px] mt-1 ${activeReport === 'SALES_COMPARISON' ? 'text-indigo-200' : 'text-slate-400'}`}>مقایسه دو بازه زمانی</div>
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
                {activeReport === 'SALES_BY_GROUP' && 'فروش به تفکیک گروه'}
                {activeReport === 'SALES_COMPARISON' && 'مقایسه فروش دوره‌ای'}
                {activeReport === 'CUSTOMER_STATEMENT' && 'صورتحساب مشتریان'}
                {activeReport === 'DEBTORS_CREDITORS' && 'بدهکاران و بستانکاران'}
              </h1>
            </div>
            
            <div className="hidden sm:block h-8 w-px bg-slate-200"></div>
 
            {/* Date Filter */}
            <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
                <ShamsiDatePicker date={startDate} onChange={setStartDate} label={activeReport === 'SALES_COMPARISON' ? "از (بازه اول)" : "از"} />
                <ShamsiDatePicker date={endDate} onChange={setEndDate} label={activeReport === 'SALES_COMPARISON' ? "تا (بازه اول)" : "تا"} />
                
                {activeReport === 'SALES_COMPARISON' && (
                  <>
                    <div className="hidden sm:block h-6 w-px bg-slate-200 mx-2"></div>
                    <ShamsiDatePicker date={compareStartDate} onChange={setCompareStartDate} label="از (بازه دوم)" />
                    <ShamsiDatePicker date={compareEndDate} onChange={setCompareEndDate} label="تا (بازه دوم)" />
                  </>
                )}
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
                {activeReport === 'SALES_BY_GROUP' && renderSalesByGroup()}
                {activeReport === 'SALES_COMPARISON' && renderSalesComparison()}
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
