import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { 
    Search, 
    Loader2, 
    Printer, 
    Calendar, 
    TrendingUp, 
    Coins, 
    TrendingDown, 
    CheckSquare, 
    Layers, 
    Activity, 
    FileText, 
    ArrowUpDown, 
    Download,
    Percent,
    X,
    RefreshCw,
    Save,
    Send,
    ArrowLeft,
    ChevronDown,
    ChevronUp,
    Archive,
    Trash2,
    Sparkles,
    Award
} from 'lucide-react';
import * as jalaali from 'jalaali-js';
import { 
    BarChart, 
    Bar, 
    XAxis, 
    YAxis, 
    CartesianGrid, 
    Tooltip, 
    Legend, 
    ResponsiveContainer,
    LineChart,
    Line
} from 'recharts';
import { getRolePermissions } from '../services/authService';
import { UserRole } from '../types';

export function getMainFamily(groupName: string = '', itemName: string = ''): string {
    const g = (groupName || '').toLowerCase().trim();
    const i = (itemName || '').toLowerCase().trim();
    const text = `${g} ${i}`;

    if (text.includes('اسپاندکس کاور') || text.includes('spandex cover') || (text.includes('اسپاندکس') && text.includes('کاور'))) {
        return 'اسپاندکس (کاور)';
    }
    if (text.includes('اسپاندکس پوشش') || text.includes('ساپورت') || (text.includes('اسپاندکس') && (text.includes('پوشش') || text.includes('covering')))) {
        return 'اسپاندکس پوشش (ساپورت)';
    }
    if (text.includes('نخ ۱۸۰') || text.includes('180') || text.includes('اسپان')) {
        return 'نخ ۱۸۰ پلی استر اسپان';
    }
    if (text.includes('نخ ۱۲۰') || text.includes('120')) {
        return 'نخ ۱۲۰ پلی استر';
    }
    if (text.includes('شواتیز') || text.includes('dty') || text.includes('پلی استر شواتیز')) {
        return 'پلی استر شواتیز';
    }
    if (text.includes('poy') || text.includes('پی او وای')) {
        return 'POY';
    }
    if (text.includes('fdy') || text.includes('اف دی وای')) {
        return 'FDY';
    }
    if (text.includes('نایلون') || text.includes('nylon')) {
        return 'نایلون';
    }
    if (text.includes('نخ ملت') || text.includes('ملت') || text.includes('melt')) {
        return 'نخ ملت';
    }
    if (text.includes('لایکرا') || text.includes('lycra')) {
        return 'لایکرا';
    }
    if (text.includes('لاکرا')) {
        return 'لاکرا';
    }
    if (text.includes('چیپس') || text.includes('chips')) {
        return 'چیپس';
    }
    if (text.includes('لاستیک') || text.includes('rubber')) {
        return 'لاستیک';
    }
    if (text.includes('مستربچ') || text.includes('masterbatch')) {
        return 'مستربچ';
    }
    if (text.includes('کش') || text.includes('elastic')) {
        return 'کش';
    }
    if (groupName && groupName.trim()) {
        return groupName.trim();
    }
    return 'سایر گروه‌های کالا';
}

export default function AccountingReports({ currentUser, settings }: { currentUser?: any, settings?: any }) {
    // Determine Sayan permissions
    const perms = currentUser ? getRolePermissions(currentUser.role, settings || null, currentUser) : {
        canViewSayan: true, canViewSayanTraz: true, canViewSayanSales: true, canViewSayanProduction: true, canViewSayanCheques: true
    };

    const isTrazAllowed = currentUser?.role === UserRole.ADMIN || perms.canViewSayan === true || perms.canViewSayanTraz === true;
    const isSalesAllowed = currentUser?.role === UserRole.ADMIN || perms.canViewSayan === true || perms.canViewSayanSales === true;
    const isProductionAllowed = currentUser?.role === UserRole.ADMIN || perms.canViewSayan === true || perms.canViewSayanProduction === true;
    const isChequesAllowed = currentUser?.role === UserRole.ADMIN || perms.canViewSayan === true || perms.canViewSayanCheques === true;

    // Default to the first allowed tab
    const [activeTab, setActiveTab] = useState(() => {
        if (currentUser?.role === UserRole.ADMIN || perms.canViewSayan === true || perms.canViewSayanTraz === true) return 'traz';
        if (perms.canViewSayanSales === true) return 'sales';
        if (perms.canViewSayanProduction === true) return 'production';
        if (perms.canViewSayanCheques === true) return 'cheques';
        return 'traz';
    });
    const [isLoading, setIsLoading] = useState(false);
    
    // Default Date Range (Direct Shamsi format "YYYY/MM/DD")
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    // --- TAB 1: TRAZ STATE ---
    const [trazData, setTrazData] = useState<any[]>([]);
    const [trazSearch, setTrazSearch] = useState('');
    const [trazCategory, setTrazCategory] = useState('all'); // all, customers, suppliers, personnel, shareholders
    const [trazSortOrder, setTrazSortOrder] = useState<'desc' | 'asc'>('desc');

    // --- TAB 2: STATEMENT STATE ---
    const [tafsilis, setTafsilis] = useState<any[]>([]);
    const [selectedTafsili, setSelectedTafsili] = useState('');
    const [tafsiliSearch, setTafsiliSearch] = useState('');
    const [statementSearch, setStatementSearch] = useState('');
    const [statementData, setStatementData] = useState<any[]>([]);
    const [guaranteeCheques, setGuaranteeCheques] = useState<any[]>([]);

    // --- STATEMENT MODAL STATE ---
    const [isStatementModalOpen, setIsStatementModalOpen] = useState(false);
    const [modalTafsiliCode, setModalTafsiliCode] = useState('');
    const [modalTafsiliName, setModalTafsiliName] = useState('');

    // --- TAB 3: SALES STATE ---
    const [salesData, setSalesData] = useState<any[]>([]);
    const [salesViewMode, setSalesViewMode] = useState<'today' | 'range'>('today');
    const [compareMode, setCompareMode] = useState(false);
    const [compareGroupBy, setCompareGroupBy] = useState<'group' | 'item'>('group');
    const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);
    // Period B for sales comparison
    const [salesDateFromB, setSalesDateFromB] = useState('');
    const [salesDateToB, setSalesDateToB] = useState('');
    const [compareSalesDataA, setCompareSalesDataA] = useState<any[]>([]);
    const [compareSalesDataB, setCompareSalesDataB] = useState<any[]>([]);
    const [isSendingSalesBot, setIsSendingSalesBot] = useState(false);
    const [expandedGroupFamilies, setExpandedGroupFamilies] = useState<Set<string>>(new Set());
    const [salesSubTab, setSalesSubTab] = useState<'families' | 'items' | 'invoices' | 'comparative' | 'charts'>('families');
    const [salesSearchQuery, setSalesSearchQuery] = useState<string>('');
    const [selectedFamilyFilter, setSelectedFamilyFilter] = useState<string>('all');
    const [salesPeriodPreset, setSalesPeriodPreset] = useState<string>('custom');

    // --- TAB 4: PRODUCTION STATE ---
    const [prodLiveItems, setProdLiveItems] = useState<any[]>([]);
    const [prodLiveTotals, setProdLiveTotals] = useState<any>({ qty_61: 0, qty_67: 0, qty_79: 0, qty_73: 0, grandTotal: 0 });
    const [prodWaste, setProdWaste] = useState<any>({ waste_61: 0, waste_67: 0, waste_79: 0, waste_73: 0, totalWaste: 0, pct_61: 0, pct_67: 0, pct_79: 0, pct_73: 0, totalPct: 0, details: '' });
    const [isSavingWaste, setIsSavingWaste] = useState(false);
    const [prodArchive, setProdArchive] = useState<any[]>([]);
    const [isFetchingArchive, setIsFetchingArchive] = useState(false);
    const [archiveSearch, setArchiveSearch] = useState('');
    const [isSendingBot, setIsSendingBot] = useState(false);
    const [productionData, setProductionData] = useState<any[]>([]);
    const [prodGrouping, setProdGrouping] = useState<'group' | 'item' | 'date'>('group');
    const [prodSearch, setProdSearch] = useState('');

    // --- TAB 5: CHEQUES STATE ---
    const [chequesData, setChequesData] = useState<any[]>([]);
    const [chequeStatusFilter, setChequeStatusFilter] = useState('all'); // all, in_hand, at_bank, returned, spent
    const [chequeSearch, setChequeSearch] = useState('');

    // ==========================================
    // DATE INITIALIZATION & CONVERSIONS
    // ==========================================
    const jalaliToGregorianStr = (jalaliStr: string) => {
        if (!jalaliStr) return '';
        try {
            // Convert Persian/Arabic digits to English digits
            let clean = jalaliStr.trim()
                .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
                .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());
            const parts = clean.split('/');
            if (parts.length !== 3) return jalaliStr;
            const jy = parseInt(parts[0], 10);
            const jm = parseInt(parts[1], 10);
            const jd = parseInt(parts[2], 10);
            if (isNaN(jy) || isNaN(jm) || isNaN(jd)) return jalaliStr;
            const g = jalaali.toGregorian(jy, jm, jd);
            return `${g.gy}-${String(g.gm).padStart(2, '0')}-${String(g.gd).padStart(2, '0')}`;
        } catch {
            return jalaliStr;
        }
    };

    const parseTafsiliRaw = (raw: string) => {
        if (!raw) return { moein: '', code: '' };
        const parts = raw.split('-');
        for (const part of parts) {
            const match = part.match(/^(11\d*|31\d*):(\d+)/);
            if (match) {
                return {
                    moein: match[1],
                    code: match[2]
                };
            }
        }
        const match = raw.match(/(11\d*|31\d*):(\d+)/);
        if (match) {
            return {
                moein: match[1],
                code: match[2]
            };
        }
        return { moein: '', code: '' };
    };

    useEffect(() => {
        // Initialize Date range directly in Shamsi
        const today = new Date();
        const jToday = jalaali.toJalaali(today.getFullYear(), today.getMonth() + 1, today.getDate());
        
        // Since active year is 1404, we default to 1404/01/01 as start date and today as end date
        const activeYear = jToday.jy === 1405 ? 1404 : jToday.jy;
        
        const savedFrom = localStorage.getItem('sayan_default_date_from');
        const savedTo = localStorage.getItem('sayan_default_date_to');
        
        const initialFrom = savedFrom || `${activeYear}/01/01`;
        const initialTo = savedTo || `${jToday.jy}/${String(jToday.jm).padStart(2, '0')}/${String(jToday.jd).padStart(2, '0')}`;
        
        setDateFrom(initialFrom);
        setDateTo(initialTo);

        // Previous year default for comparisons
        const startPrev = `${activeYear - 1}/01/01`;
        const endPrev = `${jToday.jy - 1}/${String(jToday.jm).padStart(2, '0')}/${String(jToday.jd).padStart(2, '0')}`;
        setSalesDateFromB(startPrev);
        setSalesDateToB(endPrev);

        fetchTafsilis();
    }, []);

    const applyQuickDate = (mode: 'today' | 'yesterday' | 'month' | 'quarter' | 'default') => {
        const today = new Date();
        const jToday = jalaali.toJalaali(today.getFullYear(), today.getMonth() + 1, today.getDate());
        
        if (mode === 'today') {
            const dateStr = `${jToday.jy}/${String(jToday.jm).padStart(2, '0')}/${String(jToday.jd).padStart(2, '0')}`;
            setDateFrom(dateStr);
            setDateTo(dateStr);
            toast.success(`بازه زمانی به امروز (${dateStr}) تغییر یافت.`);
        } else if (mode === 'yesterday') {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const jYest = jalaali.toJalaali(yesterday.getFullYear(), yesterday.getMonth() + 1, yesterday.getDate());
            const dateStr = `${jYest.jy}/${String(jYest.jm).padStart(2, '0')}/${String(jYest.jd).padStart(2, '0')}`;
            setDateFrom(dateStr);
            setDateTo(dateStr);
            toast.success(`بازه زمانی به دیروز (${dateStr}) تغییر یافت.`);
        } else if (mode === 'month') {
            const startStr = `${jToday.jy}/${String(jToday.jm).padStart(2, '0')}/01`;
            let endDay = '30';
            if (jToday.jm >= 1 && jToday.jm <= 6) {
                endDay = '31';
            } else if (jToday.jm === 12) {
                endDay = jalaali.isLeapJalaaliYear(jToday.jy) ? '30' : '29';
            }
            const endStr = `${jToday.jy}/${String(jToday.jm).padStart(2, '0')}/${endDay}`;
            setDateFrom(startStr);
            setDateTo(endStr);
            toast.success(`بازه زمانی به ماه جاری (${startStr} تا ${endStr}) تغییر یافت.`);
        } else if (mode === 'quarter') {
            let startMonth = 1;
            let endMonth = 3;
            let endDay = '31';
            let quarterName = 'بهار';
            
            if (jToday.jm >= 1 && jToday.jm <= 3) {
                startMonth = 1; endMonth = 3; endDay = '31'; quarterName = 'بهار';
            } else if (jToday.jm >= 4 && jToday.jm <= 6) {
                startMonth = 4; endMonth = 6; endDay = '31'; quarterName = 'تابستان';
            } else if (jToday.jm >= 7 && jToday.jm <= 9) {
                startMonth = 7; endMonth = 9; endDay = '30'; quarterName = 'پاییز';
            } else if (jToday.jm >= 10 && jToday.jm <= 12) {
                startMonth = 10; endMonth = 12; endDay = jalaali.isLeapJalaaliYear(jToday.jy) ? '30' : '29'; quarterName = 'زمستان';
            }
            
            const startStr = `${jToday.jy}/${String(startMonth).padStart(2, '0')}/01`;
            const endStr = `${jToday.jy}/${String(endMonth).padStart(2, '0')}/${endDay}`;
            setDateFrom(startStr);
            setDateTo(endStr);
            toast.success(`بازه زمانی به فصل جاری (${quarterName}: ${startStr} تا ${endStr}) تغییر یافت.`);
        } else if (mode === 'default') {
            const activeYear = jToday.jy === 1405 ? 1404 : jToday.jy;
            const savedFrom = localStorage.getItem('sayan_default_date_from');
            const savedTo = localStorage.getItem('sayan_default_date_to');
            const initialFrom = savedFrom || `${activeYear}/01/01`;
            const initialTo = savedTo || `${jToday.jy}/${String(jToday.jm).padStart(2, '0')}/${String(jToday.jd).padStart(2, '0')}`;
            setDateFrom(initialFrom);
            setDateTo(initialTo);
            toast.success(`بازه زمانی به حالت پیش‌فرض بازنشانی شد.`);
        }
    };

    const saveCurrentAsDefaultDate = () => {
        if (!dateFrom || !dateTo) {
            toast.error('بازه معتبری برای ذخیره پیش‌فرض وجود ندارد.');
            return;
        }
        localStorage.setItem('sayan_default_date_from', dateFrom);
        localStorage.setItem('sayan_default_date_to', dateTo);
        toast.success(`بازه ${dateFrom} تا ${dateTo} با موفقیت به عنوان پیش‌فرض ثبت گردید.`);
    };

    const formatMoney = (val: number) => new Intl.NumberFormat('fa-IR').format(Math.round(Math.abs(val)));
    
    const formatDateToJalali = (dateStr: string) => {
        if (!dateStr) return '';
        if (dateStr.includes('/')) return dateStr; // Already Shamsi!
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return dateStr;
            // Shift to Iran Standard Time (UTC+3:30)
            const iranTime = new Date(d.getTime() + (3.5 * 60 * 60 * 1000));
            const y = iranTime.getUTCFullYear();
            const m = iranTime.getUTCMonth() + 1;
            const day = iranTime.getUTCDate();
            const j = jalaali.toJalaali(y, m, day);
            return `${j.jy}/${String(j.jm).padStart(2, '0')}/${String(j.jd).padStart(2, '0')}`;
        } catch {
            return dateStr;
        }
    };

    // Helper to extract net weight from row details
    const parseNetWeight = (row: any) => {
        const notes = row.ItemNotes || '';
        const match = notes.match(/وزن خالص\s*[:：\-]?\s*([\d.]+)/);
        if (match) return parseFloat(match[1]);
        
        const seriesMatch = notes.match(/سری ساخت\s*[:：\-]?\s*[A-Za-z0-9-]+\-([\d.]+)/);
        if (seriesMatch) return parseFloat(seriesMatch[1]);

        return parseFloat(row.Quantity || 0);
    };

    // Helper to extract gross weight from row details
    const parseGrossWeight = (row: any) => {
        const notes = row.ItemNotes || '';
        const match = notes.match(/وزن ناخالص\s*[:：\-]?\s*([\d.]+)/);
        return match ? parseFloat(match[1]) : 0;
    };

    // Helper to parse or calculate fee / unit price from row details
    const parseFee = (row: any, netWeight: number) => {
        const notes = (row.ItemNotes || '') + ' ' + (row.Notes || '');
        const match = notes.match(/(?:فی|قیمت واحد|نرخ|قیمت)\s*[:：\-]?\s*([\d,.]+)/);
        if (match) {
            return parseFloat(match[1].replace(/,/g, ''));
        }
        const amt = parseFloat(row.Amount || 0);
        return netWeight > 0 ? (amt / netWeight) : 0;
    };

    // ==========================================
    // BACKEND DATABASE COMMUNICATORS (Sayan Proxy)
    // ==========================================
    const runSayanQuery = async (queryStr: string) => {
        const res = await fetch('/api/sayan-proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                path: '/query',
                method: 'POST',
                body: { query: queryStr }
            })
        });
        if (!res.ok) {
            const errDetails = await res.json().catch(() => ({}));
            throw new Error(errDetails.error || 'خطای سرور سایان');
        }
        const data = await res.json();
        return data.data || [];
    };

    const fetchTafsilis = async () => {
        try {
            const sql = `
                SELECT DISTINCT 
                    Field_003 as Code, 
                    Field_006 as Name, 
                    Field_005 as TafsiliCode,
                    Field_004 as MoeinGroup
                FROM ACT_TBL_007 
                WHERE Field_004 LIKE '11%' OR Field_004 LIKE '31%' OR Field_003 LIKE '11%' OR Field_003 LIKE '31%'
                ORDER BY Field_006 ASC
            `;
            const data = await runSayanQuery(sql);
            setTafsilis(data);
        } catch (err) {
            console.error('Error fetching Sayan Tafsilis', err);
        }
    };

    // ==========================================
    // TAB 1: TRAZ (DEBTORS / CREDITORS)
    // ==========================================
    const fetchTraz = async () => {
        setIsLoading(true);
        try {
            let sql = '';
            // If date filter is defined, query transactional tables with Sanad headers
            if (dateFrom && dateTo) {
                const gregFrom = jalaliToGregorianStr(dateFrom);
                const gregTo = jalaliToGregorianStr(dateTo);
                sql = `
                    SELECT 
                        t9.Field_015 as TafsiliRaw,
                        SUM(CAST(t9.Field_009 AS FLOAT)) as TotalBed,
                        SUM(CAST(t9.Field_010 AS FLOAT)) as TotalBes
                                        FROM ACT_TBL_009 t9
                    LEFT JOIN ACT_TBL_008 t8 ON t8.Field_004 = t9.Field_003 AND t8.Field_005 = t9.Field_004
                    WHERE (t9.Field_015 LIKE '11%' OR t9.Field_015 LIKE '%-11%' OR t9.Field_015 LIKE '31%' OR t9.Field_015 LIKE '%-31%') 
                      AND t9.Field_015 NOT LIKE '%-12%'
                      AND t9.Field_015 NOT LIKE '%-13%'
                      AND t9.Field_007 NOT IN ('102', '103', '107', '109', '114', '116', '117') 
                      AND t9.Field_005 <> '9'
                      AND t8.Field_008 >= '${gregFrom}T00:00:00.000Z' 
                      AND t8.Field_008 <= '${gregTo}T23:59:59.000Z'
                    GROUP BY t9.Field_015
                `;
            } else {
                // aggregate speeds
                sql = `
                    SELECT 
                        t24.Field_010 as TafsiliRaw,
                        SUM(CAST(t24.Field_006 AS FLOAT)) as TotalBed,
                        SUM(CAST(t24.Field_007 AS FLOAT)) as TotalBes
                    FROM ACT_TBL_024 t24
                    WHERE (t24.Field_010 LIKE '11%' OR t24.Field_010 LIKE '%-11%' OR t24.Field_010 LIKE '31%' OR t24.Field_010 LIKE '%-31%') 
                      AND t24.Field_010 NOT LIKE '%-12%'
                      AND t24.Field_010 NOT LIKE '%-13%'
                      AND t24.Field_005 NOT IN ('102', '103', '107', '109', '114', '116', '117')
                      AND t24.Field_003 <> '9'
                    GROUP BY t24.Field_010
                `;
            }
            
            const rawData = await runSayanQuery(sql);
            
            // Map Sayan codes to names and group them by unique customer code to prevent any duplicates
            const groupedMap = new Map<string, any>();
            rawData.forEach((row: any) => {
                const parsed = parseTafsiliRaw(row.TafsiliRaw);
                const code = parsed.code;
                if (!code) return;
                
                const tafsili = tafsilis.find(t => t.Code === code || t.TafsiliCode === code);
                const name = tafsili ? tafsili.Name : `کد اشخاص ${code}`;
                const bed = parseFloat(row.TotalBed || 0);
                const bes = parseFloat(row.TotalBes || 0);
                
                if (groupedMap.has(code)) {
                    const existing = groupedMap.get(code);
                    existing.bed += bed;
                    existing.bes += bes;
                    existing.balance = existing.bed - existing.bes;
                } else {
                    groupedMap.set(code, {
                        code,
                        name,
                        bed,
                        bes,
                        balance: bed - bes
                    });
                }
            });
            
            const mapped = Array.from(groupedMap.values()).filter((r: any) => r.balance !== 0);

            setTrazData(mapped);
        } catch (err: any) {
            toast.error(`خطا در دریافت تراز سایان: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    // Filter and categorise Traz data
    const getFilteredTraz = () => {
        let items = trazData.filter(item => {
            const matchesSearch = item.name.toLowerCase().includes(trazSearch.toLowerCase()) || 
                                  item.code.includes(trazSearch);
            
            if (!matchesSearch) return false;

            // Categories split logic
            if (trazCategory === 'customers') {
                return item.name.includes('مشتری') || item.name.includes('خریدار');
            } else if (trazCategory === 'suppliers') {
                return item.name.includes('تامین') || item.name.includes('فروشنده') || item.name.includes('شرکت');
            } else if (trazCategory === 'personnel') {
                return item.name.includes('پرسنل') || item.name.includes('همکار') || item.name.includes('آقای') || item.name.includes('خانم');
            } else if (trazCategory === 'shareholders') {
                return item.name.includes('سهام') || item.name.includes('هیئت');
            } else if (trazCategory === 'debtors') {
                return item.balance > 0;
            } else if (trazCategory === 'creditors') {
                return item.balance < 0;
            }
            return true;
        });

        // Sorting by absolute balance
        items.sort((a, b) => {
            const valA = Math.abs(a.balance);
            const valB = Math.abs(b.balance);
            return trazSortOrder === 'desc' ? valB - valA : valA - valB;
        });

        return items;
    };

    // Print/PDF debtors & creditors separately
    const handlePrintTrazReport = (type: 'bed' | 'bes') => {
        const fullList = getFilteredTraz();
        const sortedList = fullList
            .filter(t => type === 'bed' ? t.balance > 0 : t.balance < 0)
            .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance));

        const title = type === 'bed' ? 'گزارش مانده بدهکاران (صعودی به نزولی)' : 'گزارش مانده بستانکاران (صعودی به نزولی)';
        const docHtml = `
            <html dir="rtl" lang="fa">
            <head>
                <meta charset="utf-8">
                <title>${title}</title>
                <style>
                    body { font-family: 'Tahoma', 'Segoe UI', sans-serif; padding: 25px; background: #fff; color: #333; }
                    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 15px; margin-bottom: 25px; }
                    .header h1 { margin: 0; font-size: 20px; color: #0f172a; }
                    .header p { margin: 4px 0 0; font-size: 13px; color: #475569; }
                    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                    th, td { border: 1px solid #cbd5e1; padding: 10px 12px; text-align: right; font-size: 12px; }
                    th { background-color: #f8fafc; font-weight: bold; color: #0f172a; }
                    tr:nth-child(even) { background-color: #f1f5f9; }
                    .total { font-weight: bold; background: #e2e8f0 !important; }
                    .footer { text-align: center; margin-top: 40px; font-size: 11px; color: #64748b; border-top: 1px dashed #cbd5e1; padding-top: 15px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <div>
                        <h1>${title}</h1>
                        <p>دوره مالی: از ${formatDateToJalali(dateFrom)} تا ${formatDateToJalali(dateTo)}</p>
                    </div>
                    <div style="text-align: left;">
                        <p>تاریخ چاپ: ${formatDateToJalali(new Date().toISOString())}</p>
                        <p>تعداد ردیف: ${sortedList.length}</p>
                    </div>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th style="width: 60px; text-align: center;">ردیف</th>
                            <th style="width: 120px;">کد حسابداری</th>
                            <th>نام شخص</th>
                            <th style="text-align: left; width: 200px;">مبلغ مانده (ریال)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${sortedList.map((row, idx) => `
                            <tr>
                                <td style="text-align: center;">${idx + 1}</td>
                                <td>${row.code}</td>
                                <td>${row.name}</td>
                                <td style="text-align: left; font-weight: 500;">${formatMoney(row.balance)}</td>
                            </tr>
                        `).join('')}
                        <tr class="total">
                            <td colspan="3" style="text-align: left;">جمع کل مانده‌ها:</td>
                            <td style="text-align: left;">${formatMoney(sortedList.reduce((sum, r) => sum + r.balance, 0))}</td>
                        </tr>
                    </tbody>
                </table>
                <div class="footer">
                    <p>سیستم گزارشات حسابداری یکپارچه سایان ERP</p>
                </div>
            </body>
            </html>
        `;

        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(docHtml);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => {
                printWindow.print();
                printWindow.close();
            }, 500);
        }
    };

    // ==========================================
    // TAB 2: DETAILED STATEMENT (صورتحساب ریز تراکنش‌ها)
    // ==========================================
    const fetchStatement = async (tafsiliCodeOverride?: string) => {
        const codeToUse = tafsiliCodeOverride || selectedTafsili;
        if (!codeToUse) {
            toast.error('لطفاً ابتدا شخص مورد نظر را انتخاب کنید');
            return;
        }
        setIsLoading(true);
        try {
            const gregFrom = jalaliToGregorianStr(dateFrom);
            const gregTo = jalaliToGregorianStr(dateTo);
            
            const selectedInfo = tafsilis.find(t => t.Code === codeToUse);
            const shortTafsiliCode = selectedInfo ? selectedInfo.TafsiliCode : '';
            
            let tafsiliFilter = `(
                t9.Field_015 LIKE '%:${codeToUse}%' OR 
                t9.Field_014 LIKE '%:${codeToUse}%' OR
                t9.Field_015 LIKE '%:${codeToUse}' OR 
                t9.Field_014 LIKE '%:${codeToUse}'
            )`;
            
            if (shortTafsiliCode) {
                const code31 = '31' + shortTafsiliCode;
                tafsiliFilter = `(
                    t9.Field_015 LIKE '%:${codeToUse}%' OR 
                    t9.Field_014 LIKE '%:${codeToUse}%' OR
                    t9.Field_015 LIKE '%:${codeToUse}' OR 
                    t9.Field_014 LIKE '%:${codeToUse}' OR
                    t9.Field_015 LIKE '%:${shortTafsiliCode}%' OR 
                    t9.Field_014 LIKE '%:${shortTafsiliCode}%' OR
                    t9.Field_015 LIKE '%:${shortTafsiliCode}' OR 
                    t9.Field_014 LIKE '%:${shortTafsiliCode}' OR
                    t9.Field_015 LIKE '%:${code31}%' OR 
                    t9.Field_014 LIKE '%:${code31}%' OR
                    t9.Field_015 LIKE '%:${code31}' OR 
                    t9.Field_014 LIKE '%:${code31}'
                )`;
            }

            const sql = `
                SELECT 
                    t9.Field_004 as SanadNo,
                    t9.Field_009 as Bed,
                    t9.Field_010 as Bes,
                    t9.Field_011 as Description,
                    t8.Field_008 as Date,
                    t9.Field_005 as MoeinGroup,
                    t9.Field_006 as MoeinParent,
                    t9.Field_007 as MoeinCode,
                    m3.Field_006 as MoeinName
                FROM ACT_TBL_009 t9
                LEFT JOIN ACT_TBL_008 t8 ON t8.Field_004 = t9.Field_003 AND t8.Field_005 = t9.Field_004
                LEFT JOIN ACT_TBL_003 m3 ON t9.Field_005 = m3.Field_003 AND t9.Field_006 = m3.Field_004 AND t9.Field_007 = m3.Field_005
                WHERE ${tafsiliFilter} 
                  AND (t9.Field_015 LIKE '11%' OR t9.Field_015 LIKE '%-11%' OR t9.Field_015 LIKE '31%' OR t9.Field_015 LIKE '%-31%')
                  AND t9.Field_015 NOT LIKE '%-12%'
                  AND t9.Field_015 NOT LIKE '%-13%'
                  AND t9.Field_007 NOT IN ('102', '103', '107', '109', '114', '116', '117')
                  AND t9.Field_005 <> '9'
                  AND t8.Field_008 >= '${gregFrom}T00:00:00.000Z'
                  AND t8.Field_008 <= '${gregTo}T23:59:59.000Z'
                ORDER BY t8.Field_008 ASC, CAST(t9.Field_001 AS INT) ASC
            `;
            const data = await runSayanQuery(sql);
            
            let balanceAccumulator = 0;
            const processed = data.map((row: any) => {
                const bed = parseFloat(row.Bed || 0);
                const bes = parseFloat(row.Bes || 0);
                balanceAccumulator += (bed - bes);
                return {
                    ...row,
                    bed,
                    bes,
                    balance: balanceAccumulator
                };
            });
            setStatementData(processed);

            // Fetch guarantee and post-dated cheques associated with this person
            let chequeFilter = `(
                t9.Field_015 LIKE '%:${codeToUse}%' OR 
                t9.Field_014 LIKE '%:${codeToUse}%' OR
                t9.Field_015 LIKE '%:${codeToUse}' OR 
                t9.Field_014 LIKE '%:${codeToUse}'
            ) AND (t9.Field_015 LIKE '%-12%' OR t9.Field_015 LIKE '%-13%' OR t9.Field_005 = '9' OR t9.Field_007 IN ('102', '103'))`;

            if (shortTafsiliCode) {
                const code31 = '31' + shortTafsiliCode;
                chequeFilter = `(
                    t9.Field_015 LIKE '%:${codeToUse}%' OR 
                    t9.Field_014 LIKE '%:${codeToUse}%' OR
                    t9.Field_015 LIKE '%:${codeToUse}' OR 
                    t9.Field_014 LIKE '%:${codeToUse}' OR
                    t9.Field_015 LIKE '%:${shortTafsiliCode}%' OR 
                    t9.Field_014 LIKE '%:${shortTafsiliCode}%' OR
                    t9.Field_015 LIKE '%:${shortTafsiliCode}' OR 
                    t9.Field_014 LIKE '%:${shortTafsiliCode}' OR
                    t9.Field_015 LIKE '%:${code31}%' OR 
                    t9.Field_014 LIKE '%:${code31}%' OR
                    t9.Field_015 LIKE '%:${code31}' OR 
                    t9.Field_014 LIKE '%:${code31}'
                ) AND (t9.Field_015 LIKE '%-12%' OR t9.Field_015 LIKE '%-13%' OR t9.Field_005 = '9' OR t9.Field_007 IN ('102', '103'))`;
            }

            const chequeSql = `
                SELECT 
                    t9.Field_004 as SanadNo,
                    t9.Field_009 as Bed,
                    t9.Field_010 as Bes,
                    t9.Field_011 as Description,
                    t8.Field_008 as Date,
                    t9.Field_005 as MoeinGroup,
                    t9.Field_006 as MoeinParent,
                    t9.Field_007 as MoeinCode,
                    m3.Field_006 as MoeinName
                FROM ACT_TBL_009 t9
                LEFT JOIN ACT_TBL_008 t8 ON t8.Field_004 = t9.Field_003 AND t8.Field_005 = t9.Field_004
                LEFT JOIN ACT_TBL_003 m3 ON t9.Field_005 = m3.Field_003 AND t9.Field_006 = m3.Field_004 AND t9.Field_007 = m3.Field_005
                WHERE ${chequeFilter}
                  AND t8.Field_008 >= '${gregFrom}T00:00:00.000Z'
                  AND t8.Field_008 <= '${gregTo}T23:59:59.000Z'
                ORDER BY t8.Field_008 ASC, CAST(t9.Field_001 AS INT) ASC
            `;
            const rawChequeData = await runSayanQuery(chequeSql);
            const processedCheques = rawChequeData.map((row: any) => ({
                ...row,
                bed: parseFloat(row.Bed || 0),
                bes: parseFloat(row.Bes || 0)
            }));
            setGuaranteeCheques(processedCheques);
        } catch (err: any) {
            toast.error(`خطا در واکشی صورتحساب: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const filteredStatementData = statementData.filter(row => !statementSearch || (row.Description || '').includes(statementSearch) || String(row.SanadNo).includes(statementSearch));

    const handlePrintStatement = () => {
        if (filteredStatementData.length === 0) return;

        const tafsiliInfo = tafsilis.find(t => t.Code === selectedTafsili);
        const name = tafsiliInfo ? tafsiliInfo.Name : selectedTafsili;
        
        const hasCheques = guaranteeCheques.length > 0;
        const chequesSectionHtml = hasCheques ? `
            <div style="margin-top: 40px; border-top: 2px dashed #cbd5e1; padding-top: 20px;">
                <h2 style="font-size: 13px; margin-bottom: 12px; color: #1e293b; font-family: 'Tahoma', sans-serif;">لیست چک‌های تضمینی و تعهدات مرتبط</h2>
                <table>
                    <thead>
                        <tr>
                            <th style="background-color: #fef3c7; color: #92400e;">ردیف</th>
                            <th style="background-color: #fef3c7; color: #92400e;">تاریخ</th>
                            <th style="background-color: #fef3c7; color: #92400e;">شماره سند</th>
                            <th style="background-color: #fef3c7; color: #92400e;">سرفصل معین</th>
                            <th style="background-color: #fef3c7; color: #92400e;">شرح آرتیکل</th>
                            <th style="background-color: #fef3c7; color: #92400e;">مبلغ تضمین (ریال)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${guaranteeCheques.map((row, idx) => `
                            <tr>
                                <td>${idx + 1}</td>
                                <td>${formatDateToJalali(row.Date)}</td>
                                <td>${row.SanadNo}</td>
                                <td>${row.MoeinGroup && row.MoeinParent && row.MoeinCode ? `${row.MoeinGroup}${row.MoeinParent}${row.MoeinCode} - ${row.MoeinName || 'سایر'}` : '-'}</td>
                                <td>${row.Description || ''}</td>
                                <td>${formatMoney(row.bed > 0 ? row.bed : row.bes)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        ` : '';

        const docHtml = `
            <html dir="rtl" lang="fa">
            <head>
                <meta charset="utf-8">
                <title>ریز صورتحساب - ${name}</title>
                <style>
                    body { font-family: 'Tahoma', sans-serif; padding: 25px; background: #fff; }
                    .header { border-bottom: 2px solid #334155; padding-bottom: 10px; margin-bottom: 20px; }
                    .header h1 { font-size: 18px; margin: 0; }
                    table { width: 100%; border-collapse: collapse; }
                    th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: right; font-size: 11px; }
                    th { background-color: #f1f5f9; }
                    .total { font-weight: bold; background: #f8fafc; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>ریز صورتحساب تراکنش‌ها</h1>
                    <p>شخص: <strong>${name} (کد: ${selectedTafsili})</strong></p>
                    <p>بازه گزارش: از ${formatDateToJalali(dateFrom)} تا ${formatDateToJalali(dateTo)}</p>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>ردیف</th>
                            <th>تاریخ</th>
                            <th>شماره سند</th>
                            <th>سرفصل معین</th>
                            <th>شرح تراکنش</th>
                            <th>بدهکار (ریال)</th>
                            <th>بستانکار (ریال)</th>
                            <th>مانده (ریال)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filteredStatementData.map((row, idx) => `
                            <tr>
                                <td>${idx + 1}</td>
                                <td>${formatDateToJalali(row.Date)}</td>
                                <td>${row.SanadNo}</td>
                                <td>${row.MoeinGroup && row.MoeinParent && row.MoeinCode ? `${row.MoeinGroup}${row.MoeinParent}${row.MoeinCode} - ${row.MoeinName || 'سایر'}` : '-'}</td>
                                <td>${row.Description || ''}</td>
                                <td>${row.bed > 0 ? formatMoney(row.bed) : '۰'}</td>
                                <td>${row.bes > 0 ? formatMoney(row.bes) : '۰'}</td>
                                <td>${formatMoney(row.balance)} (${row.balance > 0 ? 'بدهکار' : row.balance < 0 ? 'بستانکار' : 'بی‌حساب'})</td>
                            </tr>
                        `).join('')}
                        <tr class="total">
                            <td colspan="5" style="text-align: left;">جمع کل:</td>
                            <td>${formatMoney(filteredStatementData.reduce((sum, r) => sum + r.bed, 0))}</td>
                            <td>${formatMoney(filteredStatementData.reduce((sum, r) => sum + r.bes, 0))}</td>
                            <td>${formatMoney(filteredStatementData[filteredStatementData.length - 1]?.balance || 0)}</td>
                        </tr>
                    </tbody>
                </table>
                ${chequesSectionHtml}
            </body>
            </html>
        `;

        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(docHtml);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => {
                printWindow.print();
                printWindow.close();
            }, 500);
        }
    };

    // ==========================================
    // TAB 3: SALES & COMPARISONS (گزارش فروش و مقایسه فصلی)
    // ==========================================
    const fetchSalesData = async () => {
        setIsLoading(true);
        try {
            const gregFrom = jalaliToGregorianStr(dateFrom);
            const gregTo = jalaliToGregorianStr(dateTo);
            
            const dateFilter = gregFrom && gregTo 
                ? `AND t10.Field_008 >= '${gregFrom}T00:00:00.000Z' AND t10.Field_008 <= '${gregTo}T23:59:59.000Z'` 
                : '';

            // Fetch Period A
            const sqlA = `
                SELECT 
                    t10.Field_001 as DocId,
                    t10.Field_006 as InvoiceNum,
                    t10.Field_008 as Date,
                    t10.Field_029 as Notes,
                    t10.Field_009 as OpCode,
                    t11.Field_005 as ItemCode,
                    t22.Field_004 as ItemName,
                    t11.Field_006 as Quantity,
                    t11.Field_031 as ItemNotes,
                    t11.Field_007 as Amount,
                    t_group.GroupName,
                    t07.Field_006 as CustomerName
                FROM STR_TBL_010 t10
                INNER JOIN STR_TBL_011 t11 ON t11.Field_004 = t10.Field_005 
                                          AND t11.Field_003 = t10.Field_004
                LEFT JOIN IND_TBL_022 t22 ON RTRIM(LTRIM(t22.Field_005)) = RTRIM(LTRIM(t11.Field_005))
                LEFT JOIN (
                    SELECT t21_sub.Field_004 as ItemCode, MIN(COALESCE(t02_grandparent.Field_003, t02_parent.Field_003, t02_sub.Field_003)) as GroupName
                    FROM IND_TBL_021 t21_sub
                    LEFT JOIN IND_TBL_002 t02_sub ON RTRIM(LTRIM(t21_sub.Field_003)) = RTRIM(LTRIM(t02_sub.Field_008))
                    LEFT JOIN IND_TBL_002 t02_parent ON RTRIM(LTRIM(t02_sub.Field_009)) = RTRIM(LTRIM(t02_parent.Field_008))
                    LEFT JOIN IND_TBL_002 t02_grandparent ON RTRIM(LTRIM(t02_parent.Field_009)) = RTRIM(LTRIM(t02_grandparent.Field_008))
                    GROUP BY t21_sub.Field_004
                ) t_group ON RTRIM(LTRIM(t11.Field_005)) = RTRIM(LTRIM(t_group.ItemCode))
                LEFT JOIN ACT_TBL_007 t07 ON RTRIM(LTRIM(t10.Field_010)) = RTRIM(LTRIM(t07.Field_005)) AND (t07.Field_004 = '11' OR t07.Field_004 = '31')
                WHERE (
                    (t10.Field_009 IN ('3', '12', '23') AND (t11.Field_036 = t10.Field_009 OR t11.Field_036 IS NULL OR t11.Field_036 = '' OR t11.Field_036 = '0') AND t11.Field_007 > 0)
                    OR
                    (t10.Field_009 IN ('13', '14') AND (t11.Field_036 IN ('3', '12', '23', '13', '14') OR t11.Field_036 IS NULL OR t11.Field_036 = '' OR t11.Field_036 = '0'))
                  )
                  ${dateFilter}
                ORDER BY t10.Field_008 DESC
            `;
            const dataA = await runSayanQuery(sqlA);
            const processedA = dataA.map((row: any) => ({
                ...row,
                Amount: row.Amount ? parseFloat(row.Amount).toString() : '0'
            }));
            setSalesData(processedA);
            setCompareSalesDataA(processedA);

            // Fetch Period B for comparison if active
            if (compareMode && salesDateFromB && salesDateToB) {
                const gregFromB = jalaliToGregorianStr(salesDateFromB);
                const gregToB = jalaliToGregorianStr(salesDateToB);
                
                const dateFilterB = gregFromB && gregToB 
                    ? `AND t10.Field_008 >= '${gregFromB}T00:00:00.000Z' AND t10.Field_008 <= '${gregToB}T23:59:59.000Z'` 
                    : '';

                const sqlB = `
                    SELECT 
                        t10.Field_001 as DocId,
                        t10.Field_006 as InvoiceNum,
                        t10.Field_008 as Date,
                        t10.Field_029 as Notes,
                        t10.Field_009 as OpCode,
                        t11.Field_005 as ItemCode,
                        t22.Field_004 as ItemName,
                        t11.Field_006 as Quantity,
                        t11.Field_031 as ItemNotes,
                        t11.Field_007 as Amount,
                        t_group.GroupName,
                        t07.Field_006 as CustomerName
                    FROM STR_TBL_010 t10
                    INNER JOIN STR_TBL_011 t11 ON t11.Field_004 = t10.Field_005 
                                              AND t11.Field_003 = t10.Field_004
                    LEFT JOIN IND_TBL_022 t22 ON RTRIM(LTRIM(t22.Field_005)) = RTRIM(LTRIM(t11.Field_005))
                    LEFT JOIN (
                        SELECT t21_sub.Field_004 as ItemCode, MIN(COALESCE(t02_grandparent.Field_003, t02_parent.Field_003, t02_sub.Field_003)) as GroupName
                        FROM IND_TBL_021 t21_sub
                        LEFT JOIN IND_TBL_002 t02_sub ON RTRIM(LTRIM(t21_sub.Field_003)) = RTRIM(LTRIM(t02_sub.Field_008))
                        LEFT JOIN IND_TBL_002 t02_parent ON RTRIM(LTRIM(t02_sub.Field_009)) = RTRIM(LTRIM(t02_parent.Field_008))
                        LEFT JOIN IND_TBL_002 t02_grandparent ON RTRIM(LTRIM(t02_parent.Field_009)) = RTRIM(LTRIM(t02_grandparent.Field_008))
                        GROUP BY t21_sub.Field_004
                    ) t_group ON RTRIM(LTRIM(t11.Field_005)) = RTRIM(LTRIM(t_group.ItemCode))
                    LEFT JOIN ACT_TBL_007 t07 ON RTRIM(LTRIM(t10.Field_010)) = RTRIM(LTRIM(t07.Field_005)) AND (t07.Field_004 = '11' OR t07.Field_004 = '31')
                    WHERE (
                        (t10.Field_009 IN ('3', '12', '23') AND (t11.Field_036 = t10.Field_009 OR t11.Field_036 IS NULL OR t11.Field_036 = '' OR t11.Field_036 = '0') AND t11.Field_007 > 0)
                        OR
                        (t10.Field_009 IN ('13', '14') AND (t11.Field_036 IN ('3', '12', '23', '13', '14') OR t11.Field_036 IS NULL OR t11.Field_036 = '' OR t11.Field_036 = '0'))
                      )
                      ${dateFilterB}
                    ORDER BY t10.Field_008 DESC
                `;
                const dataB = await runSayanQuery(sqlB);
                const processedB = dataB.map((row: any) => ({
                    ...row,
                    Amount: row.Amount ? parseFloat(row.Amount).toString() : '0'
                }));
                setCompareSalesDataB(processedB);
            }
        } catch (err: any) {
            toast.error(`خطا در واکشی اطلاعات فروش: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    // Calculate sales overviews for Period A (Daily, Monthly, Quarterly, Yearly, and Selected Range)
    const getSalesOverviewStats = () => {
        const stats = {
            todaySalesAmt: 0, todaySalesQty: 0, todayRetAmt: 0, todayRetQty: 0, todayNetAmt: 0, todayNetQty: 0, todayFinalPrice: 0,
            monthSalesAmt: 0, monthSalesQty: 0, monthRetAmt: 0, monthRetQty: 0, monthNetAmt: 0, monthNetQty: 0, monthFinalPrice: 0,
            quarterSalesAmt: 0, quarterSalesQty: 0, quarterRetAmt: 0, quarterRetQty: 0, quarterNetAmt: 0, quarterNetQty: 0, quarterFinalPrice: 0,
            yearSalesAmt: 0, yearSalesQty: 0, yearRetAmt: 0, yearRetQty: 0, yearNetAmt: 0, yearNetQty: 0, yearFinalPrice: 0,
            rangeSalesAmt: 0, rangeSalesQty: 0, rangeRetAmt: 0, rangeRetQty: 0, rangeNetAmt: 0, rangeNetQty: 0, rangeFinalPrice: 0,
            // legacy getters compatibility
            todayAmt: 0, todayQty: 0, rangeAmt: 0, rangeQty: 0, monthAmt: 0, monthQty: 0, quarterAmt: 0, quarterQty: 0, yearAmt: 0, yearQty: 0
        };

        const now = new Date();
        const jNow = jalaali.toJalaali(now.getFullYear(), now.getMonth() + 1, now.getDate());

        salesData.forEach(row => {
            const date = new Date(row.Date);
            const qty = parseFloat(row.Quantity || 0);
            const amt = parseFloat(row.Amount || 0);
            const isReturn = row.OpCode === '13' || row.OpCode === '14';

            if (isReturn) {
                stats.rangeRetAmt += amt;
                stats.rangeRetQty += qty;
            } else {
                stats.rangeSalesAmt += amt;
                stats.rangeSalesQty += qty;
            }
            
            const jRow = jalaali.toJalaali(date.getFullYear(), date.getMonth() + 1, date.getDate());

            // Yearly (Current Persian Year)
            if (jRow.jy === jNow.jy) {
                if (isReturn) {
                    stats.yearRetAmt += amt;
                    stats.yearRetQty += qty;
                } else {
                    stats.yearSalesAmt += amt;
                    stats.yearSalesQty += qty;
                }

                // Monthly (Current Persian Month)
                if (jRow.jm === jNow.jm) {
                    if (isReturn) {
                        stats.monthRetAmt += amt;
                        stats.monthRetQty += qty;
                    } else {
                        stats.monthSalesAmt += amt;
                        stats.monthSalesQty += qty;
                    }

                    // Daily (Current Persian Day)
                    if (jRow.jd === jNow.jd) {
                        if (isReturn) {
                            stats.todayRetAmt += amt;
                            stats.todayRetQty += qty;
                        } else {
                            stats.todaySalesAmt += amt;
                            stats.todaySalesQty += qty;
                        }
                    }
                }

                // Quarterly
                const rowQuarter = Math.ceil(jRow.jm / 3);
                const nowQuarter = Math.ceil(jNow.jm / 3);
                if (rowQuarter === nowQuarter) {
                    if (isReturn) {
                        stats.quarterRetAmt += amt;
                        stats.quarterRetQty += qty;
                    } else {
                        stats.quarterSalesAmt += amt;
                        stats.quarterSalesQty += qty;
                    }
                }
            }
        });

        stats.rangeNetAmt = stats.rangeSalesAmt - stats.rangeRetAmt;
        stats.rangeNetQty = stats.rangeSalesQty - stats.rangeRetQty;
        stats.rangeFinalPrice = stats.rangeNetQty > 0 ? (stats.rangeNetAmt / stats.rangeNetQty) : 0;

        stats.todayNetAmt = stats.todaySalesAmt - stats.todayRetAmt;
        stats.todayNetQty = stats.todaySalesQty - stats.todayRetQty;
        stats.todayFinalPrice = stats.todayNetQty > 0 ? (stats.todayNetAmt / stats.todayNetQty) : 0;

        stats.monthNetAmt = stats.monthSalesAmt - stats.monthRetAmt;
        stats.monthNetQty = stats.monthSalesQty - stats.monthRetQty;
        stats.monthFinalPrice = stats.monthNetQty > 0 ? (stats.monthNetAmt / stats.monthNetQty) : 0;

        stats.quarterNetAmt = stats.quarterSalesAmt - stats.quarterRetAmt;
        stats.quarterNetQty = stats.quarterSalesQty - stats.quarterRetQty;
        stats.quarterFinalPrice = stats.quarterNetQty > 0 ? (stats.quarterNetAmt / stats.quarterNetQty) : 0;

        stats.yearNetAmt = stats.yearSalesAmt - stats.yearRetAmt;
        stats.yearNetQty = stats.yearSalesQty - stats.yearRetQty;
        stats.yearFinalPrice = stats.yearNetQty > 0 ? (stats.yearNetAmt / stats.yearNetQty) : 0;

        // Legacy compatibility shortcuts
        stats.todayAmt = stats.todayNetAmt;
        stats.todayQty = stats.todayNetQty;
        stats.rangeAmt = stats.rangeNetAmt;
        stats.rangeQty = stats.rangeNetQty;
        stats.monthAmt = stats.monthNetAmt;
        stats.monthQty = stats.monthNetQty;
        stats.quarterAmt = stats.quarterNetAmt;
        stats.quarterQty = stats.quarterNetQty;
        stats.yearAmt = stats.yearNetAmt;
        stats.yearQty = stats.yearNetQty;

        return stats;
    };

    const getTodayInvoices = (specificDate?: string) => {
        const todayJalali = (() => {
            const today = new Date();
            const iranToday = new Date(today.getTime() + (3.5 * 60 * 60 * 1000));
            const jToday = jalaali.toJalaali(iranToday.getUTCFullYear(), iranToday.getUTCMonth() + 1, iranToday.getUTCDate());
            return `${jToday.jy}/${String(jToday.jm).padStart(2, '0')}/${String(jToday.jd).padStart(2, '0')}`;
        })();
        const targetDate = specificDate || todayJalali;

        const normalizeJalali = (str: string) => {
            if (!str) return '';
            const c = str.trim()
                .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
                .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());
            const formatted = formatDateToJalali(c);
            const parts = formatted.split('/');
            return parts.length === 3 ? `${parts[0]}/${parts[1].padStart(2, '0')}/${parts[2].padStart(2, '0')}` : formatted;
        };

        const targetNorm = normalizeJalali(targetDate);
        return salesData.filter(row => normalizeJalali(row.Date) === targetNorm);
    };

    const handleSendSalesBotReport = async (targetDate: 'today' | 'yesterday') => {
        const label = targetDate === 'today' ? 'امروز' : 'دیروز';
        if (!confirm(`آیا از ارسال گزارش فروش ${label} به گروه‌های تلگرام / بله اطمینان دارید؟`)) return;
        setIsSendingSalesBot(true);
        try {
            const res = await fetch('/api/sayan/sales-report/send-manual', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targetDate })
            });
            const data = await res.json();
            if (data.success) {
                toast.success(data.message || `گزارش فروش ${label} با موفقیت ارسال شد.`);
            } else {
                toast.error(data.error || 'خطا در ارسال گزارش فروش.');
            }
        } catch (e: any) {
            toast.error("خطا در ارسال گزارش: " + e.message);
        } finally {
            setIsSendingSalesBot(false);
        }
    };

    const handlePrintTodaySales = () => {
        const todayInvs = getTodayInvoices();
        const activeDate = dateTo || formatDateToJalali(new Date().toISOString());
        const title = `گزارش مدیریتی و رسمی فروش روزانه (${activeDate})`;

        // Group todayInvs by GroupName and ItemName with returns & net calculations
        const groupedMap = new Map<string, { 
            itemName: string; 
            groupName: string; 
            grossQty: number; 
            grossAmt: number; 
            retQty: number; 
            retAmt: number;
        }>();

        let totalGrossAmt = 0;
        let totalGrossQty = 0;
        let totalRetAmt = 0;
        let totalRetQty = 0;

        todayInvs.forEach(inv => {
            const key = `${inv.GroupName || ''}_${inv.ItemName || ''}`;
            const qty = parseFloat(inv.Quantity || 0);
            const amt = parseFloat(inv.Amount || 0);
            const isReturn = inv.OpCode === '13' || inv.OpCode === '14';

            if (!groupedMap.has(key)) {
                groupedMap.set(key, {
                    itemName: inv.ItemName || 'کالای بدون نام',
                    groupName: inv.GroupName || 'سایر گروه‌ها',
                    grossQty: 0,
                    grossAmt: 0,
                    retQty: 0,
                    retAmt: 0
                });
            }
            const item = groupedMap.get(key)!;
            if (isReturn) {
                item.retQty += qty;
                item.retAmt += amt;
                totalRetQty += qty;
                totalRetAmt += amt;
            } else {
                item.grossQty += qty;
                item.grossAmt += amt;
                totalGrossQty += qty;
                totalGrossAmt += amt;
            }
        });
        
        const groupedRows = Array.from(groupedMap.values());
        const totalNetAmt = totalGrossAmt - totalRetAmt;
        const totalNetQty = totalGrossQty - totalRetQty;
        const totalNetFee = totalNetQty > 0 ? (totalNetAmt / totalNetQty) : 0;
        const totalUniqueInvs = new Set(todayInvs.map(inv => inv.InvoiceNum || inv.DocId)).size;

        const docHtml = `
            <html dir="rtl" lang="fa">
            <head>
                <meta charset="utf-8">
                <title>${title}</title>
                <style>
                    body { font-family: 'Tahoma', 'Segoe UI', sans-serif; padding: 25px; background: #fff; color: #1e293b; font-size: 11px; }
                    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px; }
                    .header h1 { margin: 0; font-size: 20px; color: #0f172a; font-weight: bold; }
                    .header p { margin: 4px 0 0; font-size: 12px; color: #64748b; }
                    .stats-container { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 20px; }
                    .stat-card { border: 1px solid #cbd5e1; background: #f8fafc; padding: 10px; border-radius: 8px; text-align: center; }
                    .stat-card h3 { margin: 0 0 4px 0; font-size: 10px; color: #64748b; font-weight: bold; }
                    .stat-card p { margin: 0; font-size: 14px; font-weight: 800; color: #0f172a; font-family: monospace; }
                    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                    th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: center; font-size: 11px; line-height: 1.4; }
                    th { background-color: #0f172a; color: white; font-weight: bold; border: 1px solid #334155; }
                    tr:nth-child(even) { background-color: #f8fafc; }
                    .total { font-weight: bold; background: #1e293b !important; color: white !important; }
                    .total td { border-color: #475569; color: white; }
                    .ret { color: #e11d48; font-weight: bold; }
                    .net { color: #15803d; font-weight: bold; }
                    .footer { text-align: center; margin-top: 35px; font-size: 10px; color: #64748b; border-top: 1px dashed #cbd5e1; padding-top: 10px; }
                    .signatures { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-top: 40px; text-align: center; font-size: 11px; font-weight: bold; }
                    .signature-box { height: 60px; border-bottom: 1px dashed #94a3b8; margin-top: 8px; }
                    @media print {
                        body { padding: 0; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <div>
                        <h1>${title}</h1>
                        <p>سیستم یکپارچه گزارشات مدیریتی سایان ERP - تفکیک فروش عادی و مرجوعی</p>
                    </div>
                    <div style="text-align: left;">
                        <p>تاریخ فاکتورها: <strong>${activeDate}</strong></p>
                        <p>تاریخ چاپ: ${formatDateToJalali(new Date().toISOString())}</p>
                    </div>
                </div>

                <div class="stats-container">
                    <div class="stat-card">
                        <h3>فروش ناخالص (ریال)</h3>
                        <p>${formatMoney(totalGrossAmt)}</p>
                    </div>
                    <div class="stat-card">
                        <h3>مرجوعی کد ۱۳ (ریال)</h3>
                        <p class="ret">${formatMoney(totalRetAmt)}</p>
                    </div>
                    <div class="stat-card">
                        <h3>فروش خالص نهایی (ریال)</h3>
                        <p class="net">${formatMoney(totalNetAmt)}</p>
                    </div>
                    <div class="stat-card">
                        <h3>وزن خالص کل (ک‌گ)</h3>
                        <p>${totalNetQty.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</p>
                    </div>
                    <div class="stat-card">
                        <h3>فی خالص نهایی (ریال/ک‌گ)</h3>
                        <p>${formatMoney(Math.round(totalNetFee))}</p>
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th style="width: 35px;">ردیف</th>
                            <th>گروه کالا</th>
                            <th>نام کالا / محصول</th>
                            <th>فروش ناخالص (ک‌گ / ریال)</th>
                            <th>مرجوعی کد ۱۳ (ک‌گ / ریال)</th>
                            <th>فروش خالص نهایی (ک‌گ / ریال)</th>
                            <th>فی خالص نهایی (ریال)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${groupedRows.length > 0 ? groupedRows.map((row, idx) => {
                            const netAmt = row.grossAmt - row.retAmt;
                            const netQty = row.grossQty - row.retQty;
                            const netFee = netQty > 0 ? (netAmt / netQty) : 0;
                            return `
                                <tr>
                                    <td>${idx + 1}</td>
                                    <td style="font-weight: bold; color: #334155;">${row.groupName}</td>
                                    <td style="text-align: right; font-weight: 600;">${row.itemName}</td>
                                    <td>
                                        ${row.grossQty.toFixed(1)} ک‌گ<br/>
                                        <span style="font-family: monospace;">${formatMoney(row.grossAmt)}</span>
                                    </td>
                                    <td className="ret">
                                        ${row.retQty > 0 ? `${row.retQty.toFixed(1)} ک‌گ<br/><span style="font-family: monospace; color: #e11d48;">${formatMoney(row.retAmt)}</span>` : '-'}
                                    </td>
                                    <td className="net">
                                        <strong>${netQty.toFixed(1)} ک‌گ</strong><br/>
                                        <span style="font-family: monospace; font-weight: bold; color: #15803d;">${formatMoney(netAmt)}</span>
                                    </td>
                                    <td style="font-family: monospace; font-weight: bold;">${formatMoney(Math.round(netFee))}</td>
                                </tr>
                            `;
                        }).join('') : `
                            <tr>
                                <td colspan="7" style="text-align: center; padding: 30px; color: #64748b;">هیچ فاکتور فروشی برای این روز ثبت نشده است.</td>
                            </tr>
                        `}
                        ${groupedRows.length > 0 ? `
                        <tr class="total">
                            <td colspan="3" style="text-align: left;">جمع کل فروش روزانه:</td>
                            <td>${totalGrossQty.toFixed(1)} ک‌گ<br/>${formatMoney(totalGrossAmt)}</td>
                            <td>${totalRetQty.toFixed(1)} ک‌گ<br/>${formatMoney(totalRetAmt)}</td>
                            <td>${totalNetQty.toFixed(1)} ک‌گ<br/>${formatMoney(totalNetAmt)}</td>
                            <td>${formatMoney(Math.round(totalNetFee))}</td>
                        </tr>
                        ` : ''}
                    </tbody>
                </table>

                <div class="signatures">
                    <div>
                        <p>امضا تهیه کننده</p>
                        <div class="signature-box"></div>
                    </div>
                    <div>
                        <p>امضا مدیر مالی</p>
                        <div class="signature-box"></div>
                    </div>
                    <div>
                        <p>امضا مدیریت عامل</p>
                        <div class="signature-box"></div>
                    </div>
                </div>

                <div class="footer">
                    <p>گزارش رسمی فروش صادره از درگاه سایان ERP - مجموع فاکتورهای ثبت شده: ${totalUniqueInvs}</p>
                </div>
            </body>
            </html>
        `;

        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(docHtml);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => {
                printWindow.print();
                printWindow.close();
            }, 500);
        }
    };

    const handlePrintPeriodSales = () => {
        const title = `گزارش جامع و مدیریتی فروش دوره‌ای (${dateFrom} تا ${dateTo})`;

        // Group salesData by GroupName and ItemName with returns & net calculations
        const groupedMap = new Map<string, { 
            itemName: string; 
            groupName: string; 
            grossQty: number; 
            grossAmt: number; 
            retQty: number; 
            retAmt: number;
        }>();

        let totalGrossAmt = 0;
        let totalGrossQty = 0;
        let totalRetAmt = 0;
        let totalRetQty = 0;

        salesData.forEach(row => {
            const key = `${row.GroupName || ''}_${row.ItemName || ''}`;
            const qty = parseFloat(row.Quantity || 0);
            const amt = parseFloat(row.Amount || 0);
            const isReturn = row.OpCode === '13' || row.OpCode === '14';

            if (!groupedMap.has(key)) {
                groupedMap.set(key, {
                    itemName: row.ItemName || 'کالای بدون نام',
                    groupName: row.GroupName || 'سایر گروه‌ها',
                    grossQty: 0,
                    grossAmt: 0,
                    retQty: 0,
                    retAmt: 0
                });
            }
            const item = groupedMap.get(key)!;
            if (isReturn) {
                item.retQty += qty;
                item.retAmt += amt;
                totalRetQty += qty;
                totalRetAmt += amt;
            } else {
                item.grossQty += qty;
                item.grossAmt += amt;
                totalGrossQty += qty;
                totalGrossAmt += amt;
            }
        });
        
        const groupedRows = Array.from(groupedMap.values());
        const totalNetAmt = totalGrossAmt - totalRetAmt;
        const totalNetQty = totalGrossQty - totalRetQty;
        const totalNetFee = totalNetQty > 0 ? (totalNetAmt / totalNetQty) : 0;

        const docHtml = `
            <html dir="rtl" lang="fa">
            <head>
                <meta charset="utf-8">
                <title>${title}</title>
                <style>
                    body { font-family: 'Tahoma', 'Segoe UI', sans-serif; padding: 25px; background: #fff; color: #1e293b; font-size: 11px; }
                    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px; }
                    .header h1 { margin: 0; font-size: 20px; color: #0f172a; font-weight: bold; }
                    .header p { margin: 4px 0 0; font-size: 12px; color: #64748b; }
                    .stats-container { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 20px; }
                    .stat-card { border: 1px solid #cbd5e1; background: #f8fafc; padding: 10px; border-radius: 8px; text-align: center; }
                    .stat-card h3 { margin: 0 0 4px 0; font-size: 10px; color: #64748b; font-weight: bold; }
                    .stat-card p { margin: 0; font-size: 14px; font-weight: 800; color: #0f172a; font-family: monospace; }
                    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                    th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: center; font-size: 11px; line-height: 1.4; }
                    th { background-color: #0f172a; color: white; font-weight: bold; border: 1px solid #334155; }
                    tr:nth-child(even) { background-color: #f8fafc; }
                    .total { font-weight: bold; background: #1e293b !important; color: white !important; }
                    .total td { border-color: #475569; color: white; }
                    .ret { color: #e11d48; font-weight: bold; }
                    .net { color: #15803d; font-weight: bold; }
                    .footer { text-align: center; margin-top: 35px; font-size: 10px; color: #64748b; border-top: 1px dashed #cbd5e1; padding-top: 10px; }
                    .signatures { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-top: 40px; text-align: center; font-size: 11px; font-weight: bold; }
                    .signature-box { height: 60px; border-bottom: 1px dashed #94a3b8; margin-top: 8px; }
                    @media print {
                        body { padding: 0; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <div>
                        <h1>${title}</h1>
                        <p>سامانه مدیریت هوشمند و تحلیل فروش سایان ERP</p>
                    </div>
                    <div style="text-align: left;">
                        <p>بازه زمانی: <strong>از ${dateFrom} تا ${dateTo}</strong></p>
                        <p>تاریخ صدور: ${formatDateToJalali(new Date().toISOString())}</p>
                    </div>
                </div>

                <div class="stats-container">
                    <div class="stat-card">
                        <h3>فروش ناخالص (ریال)</h3>
                        <p>${formatMoney(totalGrossAmt)}</p>
                    </div>
                    <div class="stat-card">
                        <h3>مرجوعی کد ۱۳ (ریال)</h3>
                        <p class="ret">${formatMoney(totalRetAmt)}</p>
                    </div>
                    <div class="stat-card">
                        <h3>فروش خالص نهایی (ریال)</h3>
                        <p class="net">${formatMoney(totalNetAmt)}</p>
                    </div>
                    <div class="stat-card">
                        <h3>وزن خالص کل (ک‌گ)</h3>
                        <p>${totalNetQty.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</p>
                    </div>
                    <div class="stat-card">
                        <h3>فی خالص نهایی (ریال/ک‌گ)</h3>
                        <p>${formatMoney(Math.round(totalNetFee))}</p>
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th style="width: 35px;">ردیف</th>
                            <th>گروه کالا</th>
                            <th>نام کالا / محصول</th>
                            <th>فروش ناخالص (ک‌گ / ریال)</th>
                            <th>مرجوعی کد ۱۳ (ک‌گ / ریال)</th>
                            <th>فروش خالص نهایی (ک‌گ / ریال)</th>
                            <th>فی خالص نهایی (ریال)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${groupedRows.slice(0, 1000).map((row, idx) => {
                            const netAmt = row.grossAmt - row.retAmt;
                            const netQty = row.grossQty - row.retQty;
                            const netFee = netQty > 0 ? (netAmt / netQty) : 0;
                            return `
                                <tr>
                                    <td>${idx + 1}</td>
                                    <td style="font-weight: bold; color: #334155;">${row.groupName}</td>
                                    <td style="text-align: right; font-weight: 600;">${row.itemName}</td>
                                    <td>
                                        ${row.grossQty.toFixed(1)} ک‌گ<br/>
                                        <span style="font-family: monospace;">${formatMoney(row.grossAmt)}</span>
                                    </td>
                                    <td>
                                        ${row.retQty > 0 ? `<span class="ret">${row.retQty.toFixed(1)} ک‌گ</span><br/><span style="font-family: monospace; color: #e11d48;">${formatMoney(row.retAmt)}</span>` : '-'}
                                    </td>
                                    <td>
                                        <strong>${netQty.toFixed(1)} ک‌گ</strong><br/>
                                        <span style="font-family: monospace; font-weight: bold; color: #15803d;">${formatMoney(netAmt)}</span>
                                    </td>
                                    <td style="font-family: monospace; font-weight: bold;">${formatMoney(Math.round(netFee))}</td>
                                </tr>
                            `;
                        }).join('')}
                        ${groupedRows.length > 1000 ? `
                            <tr>
                                <td colspan="7" style="text-align: center; color: #475569; font-weight: bold; background-color: #fef08a;">
                                    نمایش ۱۰۰۰ ردیف اول از مجموع ${groupedRows.length} ردیف جهت کارایی چاپ
                                </td>
                            </tr>
                        ` : ''}
                        <tr class="total">
                            <td colspan="3" style="text-align: left;">جمع کل بازه:</td>
                            <td>${totalGrossQty.toFixed(1)} ک‌گ<br/>${formatMoney(totalGrossAmt)}</td>
                            <td>${totalRetQty.toFixed(1)} ک‌گ<br/>${formatMoney(totalRetAmt)}</td>
                            <td>${totalNetQty.toFixed(1)} ک‌گ<br/>${formatMoney(totalNetAmt)}</td>
                            <td>${formatMoney(Math.round(totalNetFee))}</td>
                        </tr>
                    </tbody>
                </table>

                <div class="signatures">
                    <div>
                        <p>امضا تهیه کننده</p>
                        <div class="signature-box"></div>
                    </div>
                    <div>
                        <p>امضا مدیر مالی</p>
                        <div class="signature-box"></div>
                    </div>
                    <div>
                        <p>امضا مدیریت عامل</p>
                        <div class="signature-box"></div>
                    </div>
                </div>

                <div class="footer">
                    <p>گزارش رسمی فروش صادره از درگاه سایان ERP - مجموع اقلام ثبت شده: ${salesData.length}</p>
                </div>
            </body>
            </html>
        `;

        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(docHtml);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => {
                printWindow.print();
                printWindow.close();
            }, 500);
        }
    };

    // Preset generator for quick Period B selection
    const applyQuickComparePreset = (preset: 'prev_year' | 'prev_month' | 'prev_quarter') => {
        if (!dateFrom || !dateTo) return;
        try {
            const partsFrom = dateFrom.split('/');
            const partsTo = dateTo.split('/');
            if (partsFrom.length === 3 && partsTo.length === 3) {
                const yFrom = parseInt(partsFrom[0], 10);
                const mFrom = parseInt(partsFrom[1], 10);
                const dFrom = parseInt(partsFrom[2], 10);
                const yTo = parseInt(partsTo[0], 10);
                const mTo = parseInt(partsTo[1], 10);
                const dTo = parseInt(partsTo[2], 10);

                if (preset === 'prev_year') {
                    const bFrom = `${yFrom - 1}/${String(mFrom).padStart(2, '0')}/${String(dFrom).padStart(2, '0')}`;
                    const bTo = `${yTo - 1}/${String(mTo).padStart(2, '0')}/${String(dTo).padStart(2, '0')}`;
                    setSalesDateFromB(bFrom);
                    setSalesDateToB(bTo);
                    toast.success(`بازه دوم به همسان سال قبل (${bFrom} تا ${bTo}) تغییر یافت.`);
                } else if (preset === 'prev_month') {
                    let prevMFrom = mFrom - 1;
                    let prevYFrom = yFrom;
                    if (prevMFrom < 1) { prevMFrom = 12; prevYFrom--; }
                    
                    let prevMTo = mTo - 1;
                    let prevYTo = yTo;
                    if (prevMTo < 1) { prevMTo = 12; prevYTo--; }

                    const bFrom = `${prevYFrom}/${String(prevMFrom).padStart(2, '0')}/${String(dFrom).padStart(2, '0')}`;
                    const bTo = `${prevYTo}/${String(prevMTo).padStart(2, '0')}/${String(dTo).padStart(2, '0')}`;
                    setSalesDateFromB(bFrom);
                    setSalesDateToB(bTo);
                    toast.success(`بازه دوم به ماه قبل (${bFrom} تا ${bTo}) تغییر یافت.`);
                } else if (preset === 'prev_quarter') {
                    let prevMFrom = mFrom - 3;
                    let prevYFrom = yFrom;
                    if (prevMFrom < 1) { prevMFrom += 12; prevYFrom--; }

                    let prevMTo = mTo - 3;
                    let prevYTo = yTo;
                    if (prevMTo < 1) { prevMTo += 12; prevYTo--; }

                    const bFrom = `${prevYFrom}/${String(prevMFrom).padStart(2, '0')}/${String(dFrom).padStart(2, '0')}`;
                    const bTo = `${prevYTo}/${String(prevMTo).padStart(2, '0')}/${String(dTo).padStart(2, '0')}`;
                    setSalesDateFromB(bFrom);
                    setSalesDateToB(bTo);
                    toast.success(`بازه دوم به فصل قبل (${bFrom} تا ${bTo}) تغییر یافت.`);
                }
            }
        } catch {
            toast.error('امکان محاسبه بازه خودکار وجود ندارد.');
        }
    };

    // Print Comparative Sales PDF
    const handlePrintComparativeSales = () => {
        const title = `گزارش تحلیلی و مقایسه‌ای فروش سایان (${dateFrom} تا ${dateTo} در مقایسه با ${salesDateFromB} تا ${salesDateToB})`;
        const data = getComparisonChartData();

        let sumNetWA = 0, sumNetWB = 0, sumNetAmtA = 0, sumNetAmtB = 0, sumRetWA = 0, sumRetWB = 0;
        data.forEach(r => {
            sumNetWA += r.netWeightA || 0;
            sumNetWB += r.netWeightB || 0;
            sumNetAmtA += r.netAmountA || 0;
            sumNetAmtB += r.netAmountB || 0;
            sumRetWA += r.retWeightA || 0;
            sumRetWB += r.retWeightB || 0;
        });

        const totalWeightDiff = sumNetWB ? ((sumNetWA - sumNetWB) / sumNetWB) * 100 : 0;
        const totalAmountDiff = sumNetAmtB ? ((sumNetAmtA - sumNetAmtB) / sumNetAmtB) * 100 : 0;
        const avgFeeA = sumNetWA ? (sumNetAmtA / sumNetWA) : 0;
        const avgFeeB = sumNetWB ? (sumNetAmtB / sumNetWB) : 0;
        const totalFeeDiff = avgFeeB ? ((avgFeeA - avgFeeB) / avgFeeB) * 100 : 0;

        const docHtml = `
            <html dir="rtl" lang="fa">
            <head>
                <meta charset="utf-8">
                <title>${title}</title>
                <style>
                    body { font-family: Tahoma, 'B Nazanin', Arial, sans-serif; margin: 25px; direction: rtl; color: #1e293b; font-size: 11px; }
                    .header { text-align: center; border-bottom: 2px solid #2563eb; padding-bottom: 15px; margin-bottom: 20px; }
                    .header h1 { margin: 0; font-size: 18px; color: #1e3a8a; }
                    .header p { margin: 5px 0 0 0; color: #64748b; font-size: 12px; }
                    .info-box { display: flex; justify-content: space-between; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 18px; margin-bottom: 20px; }
                    .info-box div { line-height: 1.6; }
                    table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
                    th { background-color: #0f172a; color: white; padding: 10px 6px; text-align: center; border: 1px solid #334155; font-weight: bold; }
                    td { border: 1px solid #cbd5e1; padding: 8px 6px; text-align: center; }
                    tr:nth-child(even) { background-color: #f8fafc; }
                    .total { background-color: #1e293b !important; color: white !important; font-weight: bold; }
                    .total td { border-color: #475569; color: white; }
                    .pos { color: #16a34a; font-weight: bold; }
                    .neg { color: #dc2626; font-weight: bold; }
                    .ret { color: #e11d48; font-size: 9px; }
                    .signatures { display: flex; justify-content: space-between; margin-top: 40px; page-break-inside: avoid; }
                    .signatures div { text-align: center; width: 30%; }
                    .signature-box { height: 60px; border-bottom: 1px dashed #94a3b8; margin-top: 10px; }
                    .footer { text-align: center; margin-top: 30px; font-size: 9px; color: #94a3b8; border-t: 1px solid #e2e8f0; padding-top: 10px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>گزارش رسمـی و تحلیلی مقایسه‌ای فروش (سایان ERP)</h1>
                    <p>پایش مقایسه‌ای وزن، مرجوعی کد ۱۳، مبلغ خالص و تغییرات فی نهایی اقلام</p>
                </div>
                <div class="info-box">
                    <div>
                        <strong>بازه اول (A):</strong> ${dateFrom} تا ${dateTo}<br/>
                        <strong>بازه دوم (B):</strong> ${salesDateFromB} تا ${salesDateToB}
                    </div>
                    <div>
                        <strong>نحوه تفکیک:</strong> ${compareGroupBy === 'group' ? 'گروه کالا' : 'نام دقیق محصول'}<br/>
                        <strong>تاریخ صدور گزارش:</strong> ${formatDateToJalali(new Date().toISOString())}
                    </div>
                    <div>
                        <strong>رشد وزن کل:</strong> <span class="${totalWeightDiff >= 0 ? 'pos' : 'neg'}">${totalWeightDiff >= 0 ? '+' : ''}${totalWeightDiff.toFixed(1)}%</span><br/>
                        <strong>رشد مبلغ کل:</strong> <span class="${totalAmountDiff >= 0 ? 'pos' : 'neg'}">${totalAmountDiff >= 0 ? '+' : ''}${totalAmountDiff.toFixed(1)}%</span>
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th style="width: 30px;">ردیف</th>
                            <th>نام ${compareGroupBy === 'group' ? 'گروه کالا' : 'محصول'}</th>
                            <th>وزن خالص A (ک‌گ)<br/><span style="font-size: 9px; font-weight: normal; color: #cbd5e1;">(مرجوعی)</span></th>
                            <th>مبلغ خالص A (ریال)</th>
                            <th>فی نهایی A (ریال)</th>
                            <th>وزن خالص B (ک‌گ)<br/><span style="font-size: 9px; font-weight: normal; color: #cbd5e1;">(مرجوعی)</span></th>
                            <th>مبلغ خالص B (ریال)</th>
                            <th>فی نهایی B (ریال)</th>
                            <th>تغییر وزن (%)</th>
                            <th>تغییر مبلغ (%)</th>
                            <th>تغییر فی (%)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.map((row, idx) => {
                            const wDiff = row.netWeightB ? ((row.netWeightA - row.netWeightB) / row.netWeightB) * 100 : 0;
                            const aDiff = row.netAmountB ? ((row.netAmountA - row.netAmountB) / row.netAmountB) * 100 : 0;
                            const feeA = row.finalPriceA || (row.netWeightA ? row.netAmountA / row.netWeightA : 0);
                            const feeB = row.finalPriceB || (row.netWeightB ? row.netAmountB / row.netWeightB : 0);
                            const feeDiff = feeB ? ((feeA - feeB) / feeB) * 100 : 0;

                            return `
                                <tr>
                                    <td>${idx + 1}</td>
                                    <td style="text-align: right; font-weight: bold;">${row.name}</td>
                                    <td>
                                        <strong>${row.netWeightA.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</strong>
                                        ${row.retWeightA > 0 ? `<br/><span class="ret">مرجوعی: ${row.retWeightA.toFixed(1)}</span>` : ''}
                                    </td>
                                    <td style="text-align: left; font-family: monospace;">${formatMoney(row.netAmountA)}</td>
                                    <td style="text-align: left; font-family: monospace;">${formatMoney(Math.round(feeA))}</td>
                                    <td>
                                        <strong>${row.netWeightB.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</strong>
                                        ${row.retWeightB > 0 ? `<br/><span class="ret">مرجوعی: ${row.retWeightB.toFixed(1)}</span>` : ''}
                                    </td>
                                    <td style="text-align: left; font-family: monospace;">${formatMoney(row.netAmountB)}</td>
                                    <td style="text-align: left; font-family: monospace;">${formatMoney(Math.round(feeB))}</td>
                                    <td class="${wDiff >= 0 ? 'pos' : 'neg'}">${wDiff >= 0 ? '+' : ''}${wDiff.toFixed(1)}%</td>
                                    <td class="${aDiff >= 0 ? 'pos' : 'neg'}">${aDiff >= 0 ? '+' : ''}${aDiff.toFixed(1)}%</td>
                                    <td class="${feeDiff >= 0 ? 'pos' : 'neg'}">${feeDiff >= 0 ? '+' : ''}${feeDiff.toFixed(1)}%</td>
                                </tr>
                            `;
                        }).join('')}
                        <tr class="total">
                            <td colspan="2" style="text-align: right;">جمع کل عملکرد کارخانه:</td>
                            <td>${sumNetWA.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
                            <td style="text-align: left;">${formatMoney(sumNetAmtA)}</td>
                            <td style="text-align: left;">${formatMoney(Math.round(avgFeeA))}</td>
                            <td>${sumNetWB.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
                            <td style="text-align: left;">${formatMoney(sumNetAmtB)}</td>
                            <td style="text-align: left;">${formatMoney(Math.round(avgFeeB))}</td>
                            <td class="${totalWeightDiff >= 0 ? 'pos' : 'neg'}">${totalWeightDiff >= 0 ? '+' : ''}${totalWeightDiff.toFixed(1)}%</td>
                            <td class="${totalAmountDiff >= 0 ? 'pos' : 'neg'}">${totalAmountDiff >= 0 ? '+' : ''}${totalAmountDiff.toFixed(1)}%</td>
                            <td class="${totalFeeDiff >= 0 ? 'pos' : 'neg'}">${totalFeeDiff >= 0 ? '+' : ''}${totalFeeDiff.toFixed(1)}%</td>
                        </tr>
                    </tbody>
                </table>

                <div class="signatures">
                    <div>
                        <p>امضا تهیه کننده / واحد فروش</p>
                        <div class="signature-box"></div>
                    </div>
                    <div>
                        <p>امضا مدیر مالی</p>
                        <div class="signature-box"></div>
                    </div>
                    <div>
                        <p>امضا مدیریت عامل</p>
                        <div class="signature-box"></div>
                    </div>
                </div>

                <div class="footer">
                    <p>سامانه مدیریت هوشمند و گزارشات مالی کارخانه سایان ERP - نسخه چاپ رسمی پایش مقایسه‌ای</p>
                </div>
            </body>
            </html>
        `;

        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(docHtml);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => {
                printWindow.print();
                printWindow.close();
            }, 500);
        }
    };

    // Prepare chart comparison data grouped by Product Group or Detailed Item Name
    const getComparisonChartData = () => {
        const groups: { [key: string]: { 
            name: string; 
            amountA: number; weightA: number; retAmountA: number; retWeightA: number; netAmountA: number; netWeightA: number; finalPriceA: number;
            amountB: number; weightB: number; retAmountB: number; retWeightB: number; netAmountB: number; netWeightB: number; finalPriceB: number;
        } } = {};

        const initGroup = (key: string, label: string) => {
            if (!groups[key]) {
                groups[key] = { 
                    name: label, 
                    amountA: 0, weightA: 0, retAmountA: 0, retWeightA: 0, netAmountA: 0, netWeightA: 0, finalPriceA: 0,
                    amountB: 0, weightB: 0, retAmountB: 0, retWeightB: 0, netAmountB: 0, netWeightB: 0, finalPriceB: 0
                };
            }
        };

        compareSalesDataA.forEach(row => {
            const key = compareGroupBy === 'item' 
                ? `${row.GroupName || 'سایر'} | ${row.ItemName || 'کالای بدون نام'}` 
                : (row.GroupName || 'سایر گروه‌ها');
            const label = compareGroupBy === 'item' 
                ? `${row.ItemName || 'کالا'} (${row.GroupName || 'سایر'})` 
                : (row.GroupName || 'سایر گروه‌ها');
            initGroup(key, label);

            const amt = parseFloat(row.Amount || 0);
            const qty = parseNetWeight(row);
            if (row.OpCode === '13' || row.OpCode === '14') {
                groups[key].retAmountA += amt;
                groups[key].retWeightA += qty;
                groups[key].netAmountA -= amt;
                groups[key].netWeightA -= qty;
            } else {
                groups[key].amountA += amt;
                groups[key].weightA += qty;
                groups[key].netAmountA += amt;
                groups[key].netWeightA += qty;
            }
        });

        compareSalesDataB.forEach(row => {
            const key = compareGroupBy === 'item' 
                ? `${row.GroupName || 'سایر'} | ${row.ItemName || 'کالای بدون نام'}` 
                : (row.GroupName || 'سایر گروه‌ها');
            const label = compareGroupBy === 'item' 
                ? `${row.ItemName || 'کالا'} (${row.GroupName || 'سایر'})` 
                : (row.GroupName || 'سایر گروه‌ها');
            initGroup(key, label);

            const amt = parseFloat(row.Amount || 0);
            const qty = parseNetWeight(row);
            if (row.OpCode === '13' || row.OpCode === '14') {
                groups[key].retAmountB += amt;
                groups[key].retWeightB += qty;
                groups[key].netAmountB -= amt;
                groups[key].netWeightB -= qty;
            } else {
                groups[key].amountB += amt;
                groups[key].weightB += qty;
                groups[key].netAmountB += amt;
                groups[key].netWeightB += qty;
            }
        });

        return Object.values(groups).map(g => ({
            ...g,
            finalPriceA: g.netWeightA > 0 ? (g.netAmountA / g.netWeightA) : 0,
            finalPriceB: g.netWeightB > 0 ? (g.netAmountB / g.netWeightB) : 0,
        }));
    };

    // ==========================================
    // TAB 4: PRODUCTION (گزارش آمار کل تولید و ضایعات سایان)
    // ==========================================
    const fetchProduction = async () => {
        setIsLoading(true);
        try {
            let items: any[] = [];
            let totals = { qty_61: 0, qty_67: 0, qty_79: 0, qty_73: 0, grandTotal: 0 };
            let wasteData: any = null;

            const normalizeDate = (str: string) => {
                if (!str) return '';
                return String(str).trim()
                    .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
                    .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
                    .replace(/-/g, '/');
            };

            const cleanDateFrom = normalizeDate(dateFrom);
            const cleanDateTo = normalizeDate(dateTo) || cleanDateFrom;

            try {
                const url = `/api/sayan/production-report?dateFrom=${encodeURIComponent(cleanDateFrom)}&dateTo=${encodeURIComponent(cleanDateTo)}`;
                const res = await fetch(url);
                const data = await res.json();
                if (data.success) {
                    items = data.items || [];
                    totals = data.totals || totals;
                    wasteData = data.waste;
                }
            } catch (err) {
                console.warn("Backend production-report endpoint warning, falling back to direct sayan-proxy:", err);
            }

            // Direct sayan-proxy query fallback if backend endpoint returned no items or couldn't reach Sayan
            if (items.length === 0) {
                const gregFrom = jalaliToGregorianStr(cleanDateFrom);
                const gregTo = jalaliToGregorianStr(cleanDateTo);

                const sql = `
                    SELECT 
                        t10.Field_001 as DocId,
                        t10.Field_008 as Date,
                        RTRIM(LTRIM(t10.Field_009)) as DocType,
                        t11.Field_005 as ItemCode,
                        COALESCE(t_name.ItemName, t22.Field_004, t11.Field_005, 'کالای بدون نام') as ItemName,
                        t11.Field_006 as Quantity
                    FROM STR_TBL_010 t10
                    INNER JOIN STR_TBL_011 t11 ON t11.Field_004 = t10.Field_005 AND t11.Field_003 = t10.Field_004
                    LEFT JOIN (
                        SELECT RTRIM(LTRIM(t21_sub.Field_004)) as ItemCode, MIN(t02_sub.Field_003) as ItemName
                        FROM IND_TBL_021 t21_sub
                        LEFT JOIN IND_TBL_002 t02_sub ON t21_sub.Field_003 = t02_sub.Field_008
                        GROUP BY t21_sub.Field_004
                    ) t_name ON t_name.ItemCode = RTRIM(LTRIM(t11.Field_005))
                    LEFT JOIN IND_TBL_022 t22 ON RTRIM(LTRIM(t22.Field_005)) = RTRIM(LTRIM(t11.Field_005))
                    WHERE RTRIM(LTRIM(t10.Field_009)) IN ('61', '67', '79', '73')
                      AND t10.Field_008 >= '${gregFrom}T00:00:00.000Z'
                      AND t10.Field_008 <= '${gregTo}T23:59:59.999Z'
                    ORDER BY COALESCE(t_name.ItemName, t22.Field_004, t11.Field_005, 'کالای بدون نام'), t10.Field_008
                `;
                
                const rawRows = await runSayanQuery(sql);
                const itemsMap = new Map();
                let q61 = 0, q67 = 0, q79 = 0, q73 = 0;

                rawRows.forEach((r: any) => {
                    const itemCode = String(r.ItemCode || '').trim();
                    let rawName = (r.ItemName || itemCode || 'کالای بدون نام').trim();
                    const qty = parseFloat(r.Quantity || 0);
                    const docType = String(r.DocType).trim();

                    // Fallback for intermediate production codes that don't have registered names in master tables
                    if (rawName === itemCode && itemCode) {
                        if (docType === '61') rawName = `نخ POY (${itemCode})`;
                        else if (docType === '67') rawName = `نخ DTY (${itemCode})`;
                        else if (docType === '79') rawName = `نخ کش (${itemCode})`;
                        else if (docType === '73') rawName = `نخ اسپاندکس (${itemCode})`;
                    }

                    if (!itemsMap.has(rawName)) {
                        itemsMap.set(rawName, {
                            name: rawName,
                            unit: 'کیلوگرم',
                            qty_61: 0,
                            qty_67: 0,
                            qty_79: 0,
                            qty_73: 0,
                            total: 0
                        });
                    }

                    const item = itemsMap.get(rawName);
                    if (docType === '61') { item.qty_61 += qty; q61 += qty; }
                    else if (docType === '67') { item.qty_67 += qty; q67 += qty; }
                    else if (docType === '79') { item.qty_79 += qty; q79 += qty; }
                    else if (docType === '73') { item.qty_73 += qty; q73 += qty; }
                    item.total += qty;
                });

                items = Array.from(itemsMap.values());
                totals = {
                    qty_61: q61,
                    qty_67: q67,
                    qty_79: q79,
                    qty_73: q73,
                    grandTotal: q61 + q67 + q79 + q73
                };
            }

            setProdLiveItems(items);
            setProdLiveTotals(totals);
            if (wasteData) {
                setProdWaste(wasteData);
            }
        } catch (e: any) {
            console.error("fetchProduction Error:", e);
            toast.error("خطا در دریافت آمار تولید: " + e.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleWasteChange = (field: string, val: string) => {
        const num = parseFloat(val) || 0;
        setProdWaste((prev: any) => {
            const updated = { ...prev, [field]: num };
            const w61 = field === 'waste_61' ? num : (prev.waste_61 || 0);
            const w67 = field === 'waste_67' ? num : (prev.waste_67 || 0);
            const w79 = field === 'waste_79' ? num : (prev.waste_79 || 0);
            const w73 = field === 'waste_73' ? num : (prev.waste_73 || 0);
            const totalW = w61 + w67 + w79 + w73;

            const t61 = prodLiveTotals.qty_61 || 0;
            const t67 = prodLiveTotals.qty_67 || 0;
            const t79 = prodLiveTotals.qty_79 || 0;
            const t73 = prodLiveTotals.qty_73 || 0;
            const grandT = prodLiveTotals.grandTotal || 0;

            updated.totalWaste = totalW;
            updated.pct_61 = t61 > 0 ? (w61 / t61) * 100 : 0;
            updated.pct_67 = t67 > 0 ? (w67 / t67) * 100 : 0;
            updated.pct_79 = t79 > 0 ? (w79 / t79) * 100 : 0;
            updated.pct_73 = t73 > 0 ? (w73 / t73) * 100 : 0;
            updated.totalPct = grandT > 0 ? (totalW / grandT) * 100 : 0;
            return updated;
        });
    };

    const fetchProdArchive = async () => {
        setIsFetchingArchive(true);
        try {
            const res = await fetch('/api/sayan/production-report/archive');
            const data = await res.json();
            if (data.success) {
                setProdArchive(data.archive || []);
            }
        } catch (e) {
            console.error("Error fetching archive:", e);
        } finally {
            setIsFetchingArchive(false);
        }
    };

    const handleDeleteArchiveEntry = async (id: string) => {
        if (!confirm('آیا از حذف این رکورد بایگانی اطمینان دارید؟')) return;
        try {
            const res = await fetch(`/api/sayan/production-report/archive/${id}`, {
                method: 'DELETE'
            });
            const data = await res.json();
            if (data.success) {
                toast.success('رکورد بایگانی با موفقیت حذف شد.');
                fetchProdArchive();
            } else {
                toast.error(data.error || 'خطا در حذف رکورد بایگانی.');
            }
        } catch (e: any) {
            toast.error('خطا در حذف رکورد: ' + e.message);
        }
    };

    const handleSaveWaste = async () => {
        setIsSavingWaste(true);
        try {
            const res = await fetch('/api/sayan/production-report/save-waste', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    dateFrom,
                    dateTo,
                    waste_61: prodWaste.waste_61,
                    waste_67: prodWaste.waste_67,
                    waste_79: prodWaste.waste_79,
                    waste_73: prodWaste.waste_73,
                    details: prodWaste.details,
                    totals: prodLiveTotals,
                    items: prodLiveItems
                })
            });
            const data = await res.json();
            if (data.success) {
                toast.success(data.message || 'اطلاعات ضایعات و آمار کل تولید با موفقیت در بایگانی ثبت شد.');
                fetchProdArchive();
            } else {
                toast.error(data.error || 'خطا در ثبت ضایعات.');
            }
        } catch (e: any) {
            toast.error("خطا در ذخیره ضایعات: " + e.message);
        } finally {
            setIsSavingWaste(false);
        }
    };

    const getFilteredArchive = () => {
        if (!archiveSearch.trim()) return prodArchive;
        const q = archiveSearch.toLowerCase().trim();
        return prodArchive.filter(entry => {
            const dateMatch = entry.dateFrom.includes(q) || entry.dateTo.includes(q);
            const detailsMatch = entry.details && entry.details.toLowerCase().includes(q);
            
            let itemsMatch = false;
            if (entry.items && Array.isArray(entry.items)) {
                itemsMatch = entry.items.some((item: any) => 
                    item.name && item.name.toLowerCase().includes(q)
                );
            }
            return dateMatch || detailsMatch || itemsMatch;
        });
    };

    const handleLoadArchiveDate = (entry: any) => {
        setDateFrom(entry.dateFrom);
        setDateTo(entry.dateTo);
        toast.success(`بازه زمانی گزارش به ${entry.dateFrom} تا ${entry.dateTo} تغییر یافت. در حال بازخوانی اطلاعات...`);
    };

    const handleSendBotReport = async () => {
        if (!confirm(`آیا از ارسال این گزارش تولید و ضایعات به گروه‌های تعریف‌شده در تلگرام/بله اطمینان دارید؟`)) return;
        setIsSendingBot(true);
        try {
            const res = await fetch('/api/sayan/production-report/send-bot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    dateFrom,
                    dateTo,
                    items: prodLiveItems,
                    totals: prodLiveTotals,
                    waste: prodWaste
                })
            });
            const data = await res.json();
            if (data.success) {
                toast.success(data.message || 'گزارش با موفقیت ارسال شد.');
            } else {
                toast.error(data.error || 'خطا در ارسال گزارش به گروه‌ها.');
            }
        } catch (e: any) {
            toast.error("خطا در ارسال گزارش: " + e.message);
        } finally {
            setIsSendingBot(false);
        }
    };

    const handleExportExcel = () => {
        if (!prodLiveItems || prodLiveItems.length === 0) {
            toast.error("اطلاعاتی برای خروجی اکسل وجود ندارد.");
            return;
        }

        const headers = [
            "کالا",
            "واحد",
            "سند ۶۱ (POY)",
            "سند ۶۷ (DTY)",
            "سند ۷۹ (کش)",
            "سند ۷۳ (اسپاندکس)",
            "جمع کل"
        ];

        const rows = [headers.join(",")];

        prodLiveItems.forEach((item: any) => {
            const row = [
                `"${item.name.replace(/"/g, '""')}"`,
                `"${(item.unit || "کیلوگرم").replace(/"/g, '""')}"`,
                item.qty_61 || 0,
                item.qty_67 || 0,
                item.qty_79 || 0,
                item.qty_73 || 0,
                item.total || 0
            ];
            rows.push(row.join(","));
        });

        // Add blank row
        rows.push("");

        // Add Totals row
        const totalRow = [
            `"جمع کل تولید"`,
            `"کیلوگرم"`,
            prodLiveTotals.qty_61 || 0,
            prodLiveTotals.qty_67 || 0,
            prodLiveTotals.qty_79 || 0,
            prodLiveTotals.qty_73 || 0,
            prodLiveTotals.grandTotal || 0
        ];
        rows.push(totalRow.join(","));

        // Add Waste row
        const wasteRow = [
            `"ضایعات (ورود دستی)"`,
            `"کیلوگرم"`,
            prodWaste.waste_61 || 0,
            prodWaste.waste_67 || 0,
            prodWaste.waste_79 || 0,
            prodWaste.waste_73 || 0,
            prodWaste.totalWaste || 0
        ];
        rows.push(wasteRow.join(","));

        // Add Waste Pct row
        const pctRow = [
            `"درصد ضایعات"`,
            `"درصد"`,
            (prodWaste.pct_61 || 0).toFixed(2) + "%",
            (prodWaste.pct_67 || 0).toFixed(2) + "%",
            (prodWaste.pct_79 || 0).toFixed(2) + "%",
            (prodWaste.pct_73 || 0).toFixed(2) + "%",
            (prodWaste.totalPct || 0).toFixed(2) + "%"
        ];
        rows.push(pctRow.join(","));

        const bom = "\uFEFF"; 
        const blob = new Blob([bom + rows.join("\n")], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `Production_Report_${dateFrom.replace(/[\/\\]/g, '-')}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("فایل اکسل (CSV) با موفقیت دانلود شد.");
    };

    // Aggregate production by selection
    const getGroupedProduction = () => {
        const filtered = productionData.filter(p => 
            p.productName.toLowerCase().includes(prodSearch.toLowerCase()) || 
            p.code.includes(prodSearch) ||
            p.groupName.toLowerCase().includes(prodSearch.toLowerCase())
        );

        if (prodGrouping === 'date') {
            const groups: { [key: string]: any } = {};
            filtered.forEach(p => {
                const day = formatDateToJalali(p.date);
                if (!groups[day]) {
                    groups[day] = { key: day, gross: 0, net: 0, cartons: 0, bobbins: 0, count: 0, details: [] };
                }
                groups[day].gross += p.grossWeight;
                groups[day].net += p.netWeight;
                groups[day].cartons += p.cartonCount;
                groups[day].bobbins += p.bobbinCount;
                groups[day].count += 1;
                groups[day].details.push(p);
            });
            return Object.values(groups);
        } else if (prodGrouping === 'group') {
            const groups: { [key: string]: any } = {};
            filtered.forEach(p => {
                const grp = p.groupName;
                if (!groups[grp]) {
                    groups[grp] = { key: grp, gross: 0, net: 0, cartons: 0, bobbins: 0, count: 0, details: [] };
                }
                groups[grp].gross += p.grossWeight;
                groups[grp].net += p.netWeight;
                groups[grp].cartons += p.cartonCount;
                groups[grp].bobbins += p.bobbinCount;
                groups[grp].count += 1;
                groups[grp].details.push(p);
            });
            return Object.values(groups);
        } else {
            // Group by product item
            const groups: { [key: string]: any } = {};
            filtered.forEach(p => {
                const prod = p.productName;
                if (!groups[prod]) {
                    groups[prod] = { key: prod, code: p.code, gross: 0, net: 0, cartons: 0, bobbins: 0, count: 0, details: [] };
                }
                groups[prod].gross += p.grossWeight;
                groups[prod].net += p.netWeight;
                groups[prod].cartons += p.cartonCount;
                groups[prod].bobbins += p.bobbinCount;
                groups[prod].count += 1;
                groups[prod].details.push(p);
            });
            return Object.values(groups);
        }
    };

    // ==========================================
    // TAB 5: CHEQUES (لیست چک‌های دریافتی و پرداختی)
    // ==========================================
    const fetchCheques = async () => {
        setIsLoading(true);
        try {
            const sql = `
                SELECT 
                    Field_001 as Id,
                    Field_004 as StatusType,
                    Field_005 as ChequeNo,
                    Field_006 as DueDate,
                    Field_009 as BankName,
                    Field_011 as DrawerName,
                    Field_013 as Amount,
                    Field_015 as StatusDesc
                FROM BUR_TBL_012
                ORDER BY Field_006 ASC
            `;
            const data = await runSayanQuery(sql);
            const mapped = data.map((row: any) => {
                const amt = parseFloat(row.Amount || 0);
                const desc = String(row.StatusDesc || '').trim();
                
                // Categorization logic based on status string
                let statusGroup = 'in_hand'; // default نزد صندوق
                if (desc.includes('بانک') || desc.includes('کلر')) {
                    statusGroup = 'at_bank';
                } else if (desc.includes('برگشت') || desc.includes('واخواست')) {
                    statusGroup = 'returned';
                } else if (desc.includes('وصول') || desc.includes('خرج') || desc.includes('پرداخت')) {
                    statusGroup = 'spent';
                }

                return {
                    id: row.Id,
                    chequeNo: row.ChequeNo || 'فاقد شماره',
                    dueDate: row.DueDate,
                    bankName: row.BankName || 'نامشخص',
                    drawerName: row.DrawerName || 'نامشخص',
                    amount: amt,
                    statusDesc: desc || 'نزد صندوق (دریافت شده)',
                    statusGroup
                };
            });
            setChequesData(mapped);
        } catch (err: any) {
            toast.error(`خطا در واکشی اطلاعات چک‌ها: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const getFilteredCheques = () => {
        return chequesData.filter(c => {
            const matchesSearch = c.chequeNo.includes(chequeSearch) || 
                                  c.drawerName.toLowerCase().includes(chequeSearch.toLowerCase()) || 
                                  c.bankName.toLowerCase().includes(chequeSearch.toLowerCase());
            if (!matchesSearch) return false;
            
            if (chequeStatusFilter !== 'all' && c.statusGroup !== chequeStatusFilter) {
                return false;
            }
            return true;
        });
    };

    // ==========================================
    // RE-FETCH ON TAB CHANGE
    // ==========================================
    useEffect(() => {
        if (activeTab === 'traz') {
            fetchTraz();
        } else if (activeTab === 'sales') {
            fetchSalesData();
        } else if (activeTab === 'production') {
            fetchProduction();
            fetchProdArchive();
        } else if (activeTab === 'cheques') {
            fetchCheques();
        }
    }, [activeTab, dateFrom, dateTo, trazCategory, compareMode, salesDateFromB, salesDateToB, prodGrouping]);

    // Sales calculations
    const stats = getSalesOverviewStats();
    const chartData = getComparisonChartData();
    const todayInvoices = getTodayInvoices();
    const displayedInvoices = salesViewMode === 'range' ? salesData : todayInvoices;
    const filteredTraz = getFilteredTraz();
    const groupedProduction = getGroupedProduction();
    const filteredCheques = getFilteredCheques();

    return (
        <div className="p-0 sm:p-4 md:p-8 rtl max-w-7xl mx-auto space-y-4 sm:space-y-6 select-none">
            {/* Main Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between border-b border-gray-200 pb-5 gap-4">
                <div>
                    <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-slate-900 font-sans tracking-tight">گزارشات هوشمند مالی و فروش سایان ERP</h1>
                    <p className="text-xs sm:text-sm text-slate-500 mt-1">اتصال بلادرنگ و پایش لحظه‌ای اسناد و داده‌های مالی کارخانه</p>
                </div>
                
                {/* Global Date Filter */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 bg-white rounded-lg shadow-sm border border-slate-200 p-2 sm:p-2.5 w-full lg:w-auto">
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                        <div className="flex items-center gap-1.5 text-xs text-slate-700 font-bold">
                            <Calendar className="w-4 h-4 text-blue-600" />
                            <span>بازه زمانی گزارش:</span>
                        </div>
                        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 shadow-inner">
                            <input 
                                type="text" 
                                placeholder="۱۴۰۴/۰۱/۰۱"
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                                className="text-xs bg-transparent outline-none focus:ring-0 text-slate-800 font-bold font-mono w-24 text-center"
                            />
                        </div>
                        <span className="text-xs text-slate-400 font-bold">تا</span>
                        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 shadow-inner">
                            <input 
                                type="text" 
                                placeholder="۱۴۰۴/۱۲/۲۹"
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                                className="text-xs bg-transparent outline-none focus:ring-0 text-slate-800 font-bold font-mono w-24 text-center"
                            />
                        </div>
                    </div>

                    {/* Quick Date Buttons */}
                    <div className="flex flex-wrap items-center gap-1 border-t sm:border-t-0 sm:border-r border-slate-200 pt-2 sm:pt-0 sm:pr-3">
                        <button
                            onClick={() => applyQuickDate('today')}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] sm:text-xs px-2 py-1 font-semibold transition-colors cursor-pointer"
                            title="تنظیم بازه روی امروز"
                        >
                            امروز
                        </button>
                        <button
                            onClick={() => applyQuickDate('yesterday')}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] sm:text-xs px-2 py-1 font-semibold transition-colors cursor-pointer"
                            title="تنظیم بازه روی دیروز"
                        >
                            دیروز
                        </button>
                        <button
                            onClick={() => applyQuickDate('month')}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] sm:text-xs px-2 py-1 font-semibold transition-colors cursor-pointer"
                            title="تنظیم بازه روی کل ماه جاری"
                        >
                            ماه جاری
                        </button>
                        <button
                            onClick={() => applyQuickDate('quarter')}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] sm:text-xs px-2 py-1 font-semibold transition-colors cursor-pointer"
                            title="تنظیم بازه روی فصل جاری"
                        >
                            فصل جاری
                        </button>
                        <button
                            onClick={() => applyQuickDate('default')}
                            className="bg-amber-50 hover:bg-amber-100 text-amber-800 rounded text-[10px] sm:text-xs px-2 py-1 font-bold transition-colors cursor-pointer border border-amber-200"
                            title="بازنشانی بازه به پیش‌فرض"
                        >
                            پیش‌فرض
                        </button>
                        <button
                            onClick={saveCurrentAsDefaultDate}
                            className="bg-blue-50 hover:bg-blue-100 text-blue-800 rounded text-[10px] sm:text-xs px-2 py-1 font-bold transition-colors cursor-pointer border border-blue-200 flex items-center gap-0.5"
                            title="ذخیره بازه فعلی به عنوان پیش‌فرض"
                        >
                            <Save className="w-3 h-3" />
                            <span>ثبت دیفالت</span>
                        </button>
                    </div>

                    <button 
                        onClick={() => {
                            if (activeTab === 'traz') fetchTraz();
                            if (activeTab === 'sales') fetchSalesData();
                            if (activeTab === 'production') { fetchProduction(); fetchProdArchive(); }
                            if (activeTab === 'cheques') fetchCheques();
                        }}
                        className="bg-blue-600 hover:bg-blue-700 text-white rounded text-xs px-3 py-1.5 font-semibold flex items-center gap-1 transition-colors cursor-pointer mr-auto lg:mr-0 mt-1 sm:mt-0"
                    >
                        {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'بروزرسانی'}
                    </button>
                </div>
            </div>

            {/* Premium Tab Bar */}
            <div className="grid grid-cols-3 gap-1.5 sm:flex sm:space-x-reverse sm:space-x-2 border-b border-slate-200 bg-slate-50 p-1.5 rounded-lg">
                {isTrazAllowed && (
                    <button 
                        onClick={() => setActiveTab('traz')} 
                        className={`flex items-center justify-center gap-1.5 py-2 px-2.5 sm:py-2.5 sm:px-5 rounded-md text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'traz' ? 'bg-white shadow text-blue-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
                    >
                        <ArrowUpDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                        <span className="truncate">تراز مانده مشتریان</span>
                    </button>
                )}
                {isSalesAllowed && (
                    <button 
                        onClick={() => setActiveTab('sales')} 
                        className={`flex items-center justify-center gap-1.5 py-2 px-2.5 sm:py-2.5 sm:px-5 rounded-md text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'sales' ? 'bg-white shadow text-blue-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
                    >
                        <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                        <span className="truncate">فروش و تحلیل مقایسه‌ای</span>
                    </button>
                )}
                {isProductionAllowed && (
                    <button 
                        onClick={() => setActiveTab('production')} 
                        className={`flex items-center justify-center gap-1.5 py-2 px-2.5 sm:py-2.5 sm:px-5 rounded-md text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'production' ? 'bg-white shadow text-blue-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
                    >
                        <Layers className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                        <span className="truncate">آمار کل تولید و ضایعات</span>
                    </button>
                )}
                {isChequesAllowed && (
                    <button 
                        onClick={() => setActiveTab('cheques')} 
                        className={`flex items-center justify-center gap-1.5 py-2 px-2.5 sm:py-2.5 sm:px-5 rounded-md text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'cheques' ? 'bg-white shadow text-blue-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
                    >
                        <CheckSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                        <span className="truncate">لیست چک‌ها</span>
                    </button>
                )}
            </div>

            {/* TAB CONTENT PANEL */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                
                {/* 1. TRAZ TAB */}
                {activeTab === 'traz' && (
                    <div className="p-3.5 sm:p-6 space-y-4 sm:space-y-6">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                            <div>
                                <h2 className="text-xl font-bold text-slate-800">مانده بدهکاران و بستانکاران</h2>
                                <p className="text-xs text-slate-500 mt-1">تراز اشخاص، سورت شده براساس بیشترین تعهد مالی</p>
                            </div>
                            
                            <div className="flex flex-wrap gap-2">
                                <select 
                                    className="border border-slate-300 rounded-md py-1.5 px-3 text-xs bg-white font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    value={trazCategory}
                                    onChange={(e) => setTrazCategory(e.target.value)}
                                >
                                    <option value="all">همه اشخاص</option>
                                    <option value="customers">مشتریان</option>
                                    <option value="suppliers">تامین کنندگان</option>
                                    <option value="personnel">پرسنل و همکاران</option>
                                    <option value="shareholders">سهام داران</option>
                                    <option value="debtors">بدهکاران (فقط بدهکار)</option>
                                    <option value="creditors">بستانکاران (فقط بستانکار)</option>
                                </select>

                                <button 
                                    onClick={() => setTrazSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                                    className="flex items-center gap-1 border border-slate-300 rounded-md py-1.5 px-3 text-xs bg-white hover:bg-slate-50 font-medium transition-colors"
                                    title="تغییر جهت مرتب‌سازی"
                                >
                                    <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
                                    <span>سورت: {trazSortOrder === 'desc' ? 'نزولی' : 'صعودی'}</span>
                                </button>
                                
                                <div className="relative w-full md:w-56">
                                    <Search className="absolute right-2.5 top-2.5 h-4 w-4 text-slate-400" />
                                    <input 
                                        type="text"
                                        placeholder="جستجوی شخص..." 
                                        className="w-full pl-3 pr-8 py-1.5 border rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        value={trazSearch}
                                        onChange={(e) => setTrazSearch(e.target.value)}
                                    />
                                </div>

                                <button 
                                    onClick={() => handlePrintTrazReport('bed')} 
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-md border border-rose-200 text-xs font-semibold transition-colors"
                                >
                                    <Printer className="w-3.5 h-3.5" /> خروجی بدهکاران
                                </button>
                                <button 
                                    onClick={() => handlePrintTrazReport('bes')} 
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-md border border-emerald-200 text-xs font-semibold transition-colors"
                                >
                                    <Printer className="w-3.5 h-3.5" /> خروجی بستانکاران
                                </button>
                            </div>
                        </div>

                        {/* Traz KPIs */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-rose-50/50 rounded-xl border border-rose-100/80 p-4">
                                <div className="text-rose-700 font-bold text-xs">جمع بدهی بدهکاران</div>
                                <div className="text-2xl font-extrabold text-rose-900 mt-2 font-mono">
                                    {formatMoney(filteredTraz.filter(t => t.balance > 0).reduce((sum, r) => sum + r.balance, 0))} <span className="text-xs font-medium">ریال</span>
                                </div>
                                <div className="text-[10px] text-rose-600 mt-1">شامل {filteredTraz.filter(t => t.balance > 0).length} شخص بدهکار</div>
                            </div>
                            <div className="bg-emerald-50/50 rounded-xl border border-emerald-100/80 p-4">
                                <div className="text-emerald-700 font-bold text-xs">جمع طلب بستانکاران</div>
                                <div className="text-2xl font-extrabold text-emerald-900 mt-2 font-mono">
                                    {formatMoney(filteredTraz.filter(t => t.balance < 0).reduce((sum, r) => sum + Math.abs(r.balance), 0))} <span className="text-xs font-medium">ریال</span>
                                </div>
                                <div className="text-[10px] text-emerald-600 mt-1">شامل {filteredTraz.filter(t => t.balance < 0).length} شخص بستانکار</div>
                            </div>
                            <div className="bg-blue-50/50 rounded-xl border border-blue-100/80 p-4">
                                <div className="text-blue-700 font-bold text-xs">خالص وضعیت تعهدات</div>
                                <div className="text-2xl font-extrabold text-blue-900 mt-2 font-mono">
                                    {formatMoney(filteredTraz.reduce((sum, r) => sum + r.balance, 0))} <span className="text-xs font-medium">ریال</span>
                                </div>
                                <div className="text-[10px] text-blue-600 mt-1">مانده خالص برآیند حساب‌های جاری</div>
                            </div>
                        </div>

                        {/* Traz Data Table */}
                        <div className="rounded-xl border border-slate-200 overflow-hidden max-h-[500px] overflow-y-auto">
                            {/* Desktop View */}
                            <table className="w-full text-right text-xs hidden md:table">
                                <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 z-10">
                                    <tr>
                                        <th className="p-3.5 font-bold text-slate-700 w-16 text-center">ردیف</th>
                                        <th className="p-3.5 font-bold text-slate-700 w-32">کد تفصیلی</th>
                                        <th className="p-3.5 font-bold text-slate-700">نام و نام خانوادگی شخص</th>
                                        <th className="p-3.5 font-bold text-slate-700 text-left">مجموع بدهکار (ریال)</th>
                                        <th className="p-3.5 font-bold text-slate-700 text-left">مجموع بستانکار (ریال)</th>
                                        <th className="p-3.5 font-bold text-slate-700 text-left">مانده حساب (ریال)</th>
                                        <th className="p-3.5 font-bold text-slate-700 w-28 text-center">تشخیص</th>
                                        <th className="p-3.5 font-bold text-slate-700 w-32 text-center">عملیات</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredTraz.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="text-center py-12 text-slate-400 font-medium">
                                                {isLoading ? (
                                                    <div className="flex items-center justify-center gap-2">
                                                        <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                                                        <span>در حال واکشی اطلاعات تراز سایان...</span>
                                                    </div>
                                                ) : 'هیچ رکوردی یافت نشد'}
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredTraz.map((row, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="p-3 text-slate-400 text-center font-medium">{idx + 1}</td>
                                                <td className="p-3 font-mono text-slate-600 font-medium">{row.code}</td>
                                                <td className="p-3 font-bold text-slate-900">{row.name}</td>
                                                <td className="p-3 text-left text-rose-600 font-mono font-medium">{formatMoney(row.bed)}</td>
                                                <td className="p-3 text-left text-emerald-600 font-mono font-medium">{formatMoney(row.bes)}</td>
                                                <td className={`p-3 text-left font-extrabold font-mono ${row.balance > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                                                    {formatMoney(row.balance)}
                                                </td>
                                                <td className="p-3 text-center">
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                                                        row.balance > 0 ? 'bg-rose-50 text-rose-700 border border-rose-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                                    }`}>
                                                        {row.balance > 0 ? 'بدهکار' : 'بستانکار'}
                                                    </span>
                                                </td>
                                                <td className="p-3 text-center">
                                                    <button
                                                        onClick={() => {
                                                            setSelectedTafsili(row.code);
                                                            setModalTafsiliCode(row.code);
                                                            setModalTafsiliName(row.name);
                                                            setIsStatementModalOpen(true);
                                                            fetchStatement(row.code);
                                                        }}
                                                        className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-md border border-blue-200 text-[10px] flex items-center gap-1 mx-auto transition-colors cursor-pointer shadow-sm"
                                                    >
                                                        <FileText className="w-3.5 h-3.5" />
                                                        صورتحساب ریز
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>

                            {/* Mobile View */}
                            <div className="block md:hidden divide-y divide-slate-100 bg-white">
                                {filteredTraz.length === 0 ? (
                                    <div className="text-center py-12 text-slate-400 font-medium">
                                        {isLoading ? 'در حال واکشی اطلاعات تراز سایان...' : 'هیچ رکوردی یافت نشد'}
                                    </div>
                                ) : (
                                    filteredTraz.map((row, idx) => (
                                        <div key={idx} className="p-4 hover:bg-slate-50/50 transition-colors space-y-3">
                                            <div className="flex items-start justify-between gap-2">
                                                <div>
                                                    <span className="text-[10px] text-slate-400 font-medium font-mono">#{idx + 1} | کد: {row.code}</span>
                                                    <h3 className="text-sm font-black text-slate-900 mt-0.5">{row.name}</h3>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* 3. SALES & COMPARISONS TAB (EXECUTIVE ERP DASHBOARD) */}
                {activeTab === 'sales' && (
                    <div className="p-3.5 sm:p-6 space-y-5 sm:space-y-6">
                        {/* Executive Header Bar */}
                        <div className="flex flex-col xl:flex-row xl:items-center justify-between border-b border-slate-200 pb-4 gap-4 bg-slate-900 text-white p-4 sm:p-5 rounded-2xl shadow-lg">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-md shrink-0">
                                    <TrendingUp className="w-6 h-6" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-lg sm:text-xl font-black">داشبورد تصمیم‌یار مدیریتی فروش (ERP Executive Dashboard)</h2>
                                        <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-emerald-500/30">سایان ERP v4</span>
                                    </div>
                                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                                        پایش فروش خالص، مرجوعی کد ۱۳، فی نهایی اقلام، تفکیک سرفصل‌های اصلی کالا و تحلیل مقایسه‌ای دوره‌ای
                                    </p>
                                </div>
                            </div>
                            
                            <div className="flex flex-wrap items-center gap-2">
                                <button 
                                    onClick={() => handleSendSalesBotReport('today')}
                                    disabled={isSendingSalesBot}
                                    className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black py-2 px-3.5 rounded-xl text-xs transition-all cursor-pointer shadow-md active:scale-95 disabled:opacity-50"
                                >
                                    <Send className="w-3.5 h-3.5" />
                                    <span>{isSendingSalesBot ? 'در حال ارسال...' : 'ارسال امروز به ربات (بله/تلگرام)'}</span>
                                </button>

                                <button 
                                    onClick={handlePrintTodaySales}
                                    className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-3.5 rounded-xl text-xs transition-all cursor-pointer shadow-md active:scale-95"
                                >
                                    <Printer className="w-3.5 h-3.5" />
                                    <span>چاپ رسمی (PDF)</span>
                                </button>
                            </div>
                        </div>

                        {/* Top Sub-Tabs Navigation */}
                        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-inner">
                            <div className="flex flex-wrap items-center gap-1">
                                <button
                                    type="button"
                                    onClick={() => { setSalesSubTab('families'); setCompareMode(false); }}
                                    className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${!compareMode && salesSubTab === 'families' ? 'bg-white text-blue-700 shadow-sm border border-slate-200' : 'text-slate-600 hover:text-slate-900'}`}
                                >
                                    <Layers className="w-4 h-4 text-blue-600" />
                                    <span>گزارش سرفصل‌های اصلی کالا (با Drill Down)</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setSalesSubTab('items'); setCompareMode(false); }}
                                    className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${!compareMode && salesSubTab === 'items' ? 'bg-white text-blue-700 shadow-sm border border-slate-200' : 'text-slate-600 hover:text-slate-900'}`}
                                >
                                    <FileText className="w-4 h-4 text-emerald-600" />
                                    <span>گزارش ریز کالاها</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setSalesSubTab('invoices'); setCompareMode(false); }}
                                    className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${!compareMode && salesSubTab === 'invoices' ? 'bg-white text-blue-700 shadow-sm border border-slate-200' : 'text-slate-600 hover:text-slate-900'}`}
                                >
                                    <Activity className="w-4 h-4 text-purple-600" />
                                    <span>لیست فاکتورها ({displayedInvoices.length})</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setSalesSubTab('comparative'); setCompareMode(true); }}
                                    className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${compareMode ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md' : 'bg-blue-50 text-blue-800 hover:bg-blue-100 border border-blue-200'}`}
                                >
                                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                                    <span>⚡ پایش مقایسه‌ای ۲ بازه (Period A vs B)</span>
                                </button>
                            </div>

                            {/* Quick Presets Dropdown */}
                            <div className="flex items-center gap-2 px-2">
                                <span className="text-[11px] text-slate-500 font-bold hidden sm:inline">بازه سریع:</span>
                                <div className="flex gap-1 overflow-x-auto py-1">
                                    {[
                                        { id: 'today', label: 'امروز' },
                                        { id: 'yesterday', label: 'دیروز' },
                                        { id: 'this_month', label: 'این ماه' },
                                        { id: 'last_month', label: 'ماه قبل' },
                                        { id: 'this_quarter', label: 'این فصل' },
                                        { id: 'this_year', label: 'امسال' },
                                        { id: 'last_year', label: 'پارسال' }
                                    ].map(p => (
                                        <button
                                            key={p.id}
                                            onClick={() => {
                                                setSalesPeriodPreset(p.id);
                                                const today = new Date();
                                                const jNow = jalaali.toJalaali(today.getFullYear(), today.getMonth() + 1, today.getDate());
                                                const pad = (n: number) => String(n).padStart(2, '0');
                                                if (p.id === 'today') {
                                                    const d = `${jNow.jy}/${pad(jNow.jm)}/${pad(jNow.jd)}`;
                                                    setDateFrom(d); setDateTo(d); setSalesViewMode('today');
                                                } else if (p.id === 'yesterday') {
                                                    const yest = new Date(today); yest.setDate(yest.getDate() - 1);
                                                    const jYest = jalaali.toJalaali(yest.getFullYear(), yest.getMonth() + 1, yest.getDate());
                                                    const d = `${jYest.jy}/${pad(jYest.jm)}/${pad(jYest.jd)}`;
                                                    setDateFrom(d); setDateTo(d); setSalesViewMode('range');
                                                } else if (p.id === 'this_month') {
                                                    setDateFrom(`${jNow.jy}/${pad(jNow.jm)}/01`);
                                                    setDateTo(`${jNow.jy}/${pad(jNow.jm)}/${pad(jalaali.jalaaliMonthLength(jNow.jy, jNow.jm))}`);
                                                    setSalesViewMode('range');
                                                } else if (p.id === 'last_month') {
                                                    let pm = jNow.jm - 1, py = jNow.jy; if (pm < 1) { pm = 12; py--; }
                                                    setDateFrom(`${py}/${pad(pm)}/01`); setDateTo(`${py}/${pad(pm)}/${pad(jalaali.jalaaliMonthLength(py, pm))}`);
                                                    setSalesViewMode('range');
                                                } else if (p.id === 'this_quarter') {
                                                    const q = Math.ceil(jNow.jm / 3); const sm = (q - 1) * 3 + 1; const em = q * 3;
                                                    setDateFrom(`${jNow.jy}/${pad(sm)}/01`); setDateTo(`${jNow.jy}/${pad(em)}/${pad(jalaali.jalaaliMonthLength(jNow.jy, em))}`);
                                                    setSalesViewMode('range');
                                                } else if (p.id === 'this_year') {
                                                    setDateFrom(`${jNow.jy}/01/01`); setDateTo(`${jNow.jy}/12/29`); setSalesViewMode('range');
                                                } else if (p.id === 'last_year') {
                                                    setDateFrom(`${jNow.jy - 1}/01/01`); setDateTo(`${jNow.jy - 1}/12/29`); setSalesViewMode('range');
                                                }
                                            }}
                                            className={`text-[10px] px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${salesPeriodPreset === p.id ? 'bg-blue-600 text-white shadow-xs' : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'}`}
                                        >
                                            {p.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Comparative Controls Panel */}
                        {compareMode && (
                            <div className="bg-gradient-to-r from-blue-50/90 via-indigo-50/70 to-purple-50/90 p-4 rounded-2xl border border-blue-200 shadow-sm space-y-3 animate-fadeIn">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-blue-200/60 pb-3">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black shadow-sm text-xs">
                                            VS
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-black text-blue-950">پنل تخصصی پایش مقایسه‌ای ۲ بازه (Period A vs Period B)</h3>
                                            <p className="text-[11px] text-blue-700 font-medium">پایش رشد مبلغ، وزن خالص، مرجوعی کد ۱۳ و فی نهایی اقلام</p>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={handlePrintComparativeSales}
                                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                                        >
                                            <Printer className="w-3.5 h-3.5" />
                                            <span>چاپ مقایسه‌ای رسمی (PDF)</span>
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="bg-white/90 p-3 rounded-xl border border-blue-100 shadow-xs">
                                        <div className="text-xs font-bold text-blue-800 mb-1">بازه اول ( Period A ) — از بالای صفحه</div>
                                        <div className="text-xs font-mono font-black text-slate-800 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                                            از {dateFrom || '---'} تا {dateTo || '---'}
                                        </div>
                                    </div>
                                    
                                    <div className="bg-white/90 p-3 rounded-xl border border-indigo-100 shadow-xs">
                                        <div className="text-xs font-bold text-indigo-800 mb-1">بازه دوم مقایسه ( Period B )</div>
                                        <div className="flex items-center gap-2">
                                            <input 
                                                type="text" 
                                                placeholder="۱۴۰۳/۰۱/۰۱"
                                                value={salesDateFromB}
                                                onChange={(e) => setSalesDateFromB(e.target.value)}
                                                className="text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 font-bold font-mono text-center w-full"
                                            />
                                            <span className="text-xs text-slate-400 font-bold">تا</span>
                                            <input 
                                                type="text" 
                                                placeholder="۱۴۰۳/۱۲/۲۹"
                                                value={salesDateToB}
                                                onChange={(e) => setSalesDateToB(e.target.value)}
                                                className="text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 font-bold font-mono text-center w-full"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-blue-100">
                                    <span className="text-[11px] font-bold text-slate-600">میانبر بازه دوم:</span>
                                    {['prev_year', 'prev_month', 'prev_quarter'].map(key => (
                                        <button
                                            key={key}
                                            type="button"
                                            onClick={() => applyQuickComparePreset(key as 'prev_year' | 'prev_month' | 'prev_quarter')}
                                            className="bg-white hover:bg-blue-50 text-blue-800 border border-blue-200 rounded-lg text-[11px] px-2.5 py-1 font-bold transition-all cursor-pointer shadow-xs"
                                        >
                                            {key === 'prev_year' ? 'همسان سال قبل' : key === 'prev_month' ? 'ماه قبل' : 'فصل قبل'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Executive 10 Key Metrics Cards Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
                            {[
                                { title: 'فروش خالص امروز', amount: stats.todayNetAmt, qty: stats.todayNetQty, fee: stats.todayFinalPrice, bg: 'bg-blue-50/80 border-blue-200 text-blue-950', badge: 'امروز' },
                                { title: 'فروش خالص ماه جاری', amount: stats.monthNetAmt, qty: stats.monthNetQty, fee: stats.monthFinalPrice, bg: 'bg-emerald-50/80 border-emerald-200 text-emerald-950', badge: 'این ماه' },
                                { title: 'فروش خالص فصل جاری', amount: stats.quarterNetAmt, qty: stats.quarterNetQty, fee: stats.quarterFinalPrice, bg: 'bg-purple-50/80 border-purple-200 text-purple-950', badge: 'این فصل' },
                                { title: 'فروش خالص امسال', amount: stats.yearNetAmt, qty: stats.yearNetQty, fee: stats.yearFinalPrice, bg: 'bg-amber-50/80 border-amber-200 text-amber-950', badge: 'سال ۱۴۰۴' },
                                { title: 'فروش خالص بازه', amount: stats.rangeNetAmt, qty: stats.rangeNetQty, fee: stats.rangeFinalPrice, bg: 'bg-indigo-50/80 border-indigo-200 text-indigo-950', badge: 'بازه اصلی' },
                                { title: 'وزن خالص بازه', value: `${stats.rangeNetQty.toLocaleString('fa-IR', { maximumFractionDigits: 1 })} kg`, desc: `مرجوعی: ${stats.rangeRetQty.toFixed(1)} kg`, bg: 'bg-slate-50 border-slate-200 text-slate-900', badge: 'وزن کل' },
                                { title: 'تعداد فاکتورها', value: `${new Set(displayedInvoices.map(i => i.InvoiceNum || i.DocId)).size} عدد`, desc: 'فاکتور صادر شده', bg: 'bg-slate-50 border-slate-200 text-slate-900', badge: 'فاکتور' },
                                { title: 'تعداد مشتریان', value: `${new Set(displayedInvoices.map(i => i.CustomerName || i.Notes)).size} مشتری`, desc: 'طرف حساب فعال', bg: 'bg-slate-50 border-slate-200 text-slate-900', badge: 'مشتری' },
                                { title: 'میانگین هر فاکتور', value: formatMoney(Math.round(new Set(displayedInvoices.map(i => i.InvoiceNum || i.DocId)).size > 0 ? stats.rangeNetAmt / new Set(displayedInvoices.map(i => i.InvoiceNum || i.DocId)).size : 0)) + ' ریال', desc: 'مبلغ میانگین', bg: 'bg-slate-50 border-slate-200 text-slate-900', badge: 'میانگین' },
                                { title: 'میانگین وزن هر فاکتور', value: `${(new Set(displayedInvoices.map(i => i.InvoiceNum || i.DocId)).size > 0 ? (stats.rangeNetQty / new Set(displayedInvoices.map(i => i.InvoiceNum || i.DocId)).size).toFixed(1) : 0)} kg`, desc: 'وزن میانگین فاکتور', bg: 'bg-slate-50 border-slate-200 text-slate-900', badge: 'بار متوسط' }
                            ].map((card, idx) => (
                                <div key={idx} className={`rounded-2xl p-3.5 border shadow-xs hover:shadow-md transition-all ${card.bg}`}>
                                    <div className="flex items-center justify-between text-[11px] font-extrabold mb-1 opacity-80">
                                        <span>{card.title}</span>
                                        <span className="text-[9px] bg-white/70 px-1.5 py-0.5 rounded-full font-bold">{card.badge}</span>
                                    </div>
                                    {'amount' in card ? (
                                        <>
                                            <div className="text-base font-black font-mono leading-tight">
                                                {formatMoney(card.amount)} <span className="text-[9px] font-bold">ریال</span>
                                            </div>
                                            <div className="text-[10px] font-semibold mt-1 opacity-90">
                                                وزن: {card.qty.toLocaleString('fa-IR', { maximumFractionDigits: 1 })} kg | فی: {formatMoney(Math.round(card.fee))}
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="text-base font-black font-mono leading-tight">{card.value}</div>
                                            <div className="text-[10px] font-semibold mt-1 opacity-75">{card.desc}</div>
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Group Family Breakdown Data Computation */}
                        {(() => {
                            // Compute Family Map and Sub-items map
                            const familyMap = new Map<string, {
                                familyName: string;
                                salesQty: number;
                                salesAmt: number;
                                returnQty: number;
                                returnAmt: number;
                                subItems: Map<string, {
                                    itemName: string;
                                    itemCode: string;
                                    salesQty: number;
                                    salesAmt: number;
                                    returnQty: number;
                                    returnAmt: number;
                                }>;
                            }>();

                            displayedInvoices.forEach(row => {
                                const qty = parseFloat(row.Quantity || 0);
                                const amt = parseFloat(row.Amount || 0);
                                const isReturn = row.OpCode === '13' || row.OpCode === '14';
                                const family = getMainFamily(row.GroupName, row.ItemName);
                                const itemName = row.ItemName || 'کالای بدون نام';
                                const itemCode = row.ItemCode || '';

                                if (!familyMap.has(family)) {
                                    familyMap.set(family, {
                                        familyName: family,
                                        salesQty: 0,
                                        salesAmt: 0,
                                        returnQty: 0,
                                        returnAmt: 0,
                                        subItems: new Map()
                                    });
                                }

                                const famData = familyMap.get(family)!;
                                if (isReturn) {
                                    famData.returnQty += qty;
                                    famData.returnAmt += amt;
                                } else {
                                    famData.salesQty += qty;
                                    famData.salesAmt += amt;
                                }

                                const subKey = `${itemCode}_${itemName}`;
                                if (!famData.subItems.has(subKey)) {
                                    famData.subItems.set(subKey, {
                                        itemName,
                                        itemCode,
                                        salesQty: 0,
                                        salesAmt: 0,
                                        returnQty: 0,
                                        returnAmt: 0
                                    });
                                }
                                const subData = famData.subItems.get(subKey)!;
                                if (isReturn) {
                                    subData.returnQty += qty;
                                    subData.returnAmt += amt;
                                } else {
                                    subData.salesQty += qty;
                                    subData.salesAmt += amt;
                                }
                            });

                            const familiesList = Array.from(familyMap.values());
                            let totalNetAmtAll = 0;
                            let totalNetQtyAll = 0;
                            familiesList.forEach(f => {
                                totalNetAmtAll += (f.salesAmt - f.returnAmt);
                                totalNetQtyAll += (f.salesQty - f.returnQty);
                            });

                            // Top selling, drop, fee insights
                            const sortedByAmt = [...familiesList].sort((a, b) => (b.salesAmt - b.returnAmt) - (a.salesAmt - a.returnAmt));
                            const sortedByWeight = [...familiesList].sort((a, b) => (b.salesQty - b.returnQty) - (a.salesQty - a.returnQty));
                            const sortedByFee = [...familiesList].filter(f => (f.salesQty - f.returnQty) > 50).sort((a, b) => {
                                const feeA = (a.salesAmt - a.returnAmt) / (a.salesQty - a.returnQty);
                                const feeB = (b.salesAmt - b.returnAmt) / (b.salesQty - b.returnQty);
                                return feeB - feeA;
                            });
                            const sortedByReturns = [...familiesList].sort((a, b) => b.returnAmt - a.returnAmt);

                            const topAmtFam = sortedByAmt[0];
                            const topWeightFam = sortedByWeight[0];
                            const topFeeFam = sortedByFee[0];
                            const topRetFam = sortedByReturns[0];

                            return (
                                <div className="space-y-6">
                                    {/* Executive Smart Insights Panel */}
                                    <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 text-white p-4 sm:p-5 rounded-2xl shadow-lg border border-blue-800/40">
                                        <div className="flex items-center gap-2 mb-3 border-b border-blue-800/60 pb-2.5">
                                            <Sparkles className="w-5 h-5 text-amber-400" />
                                            <h3 className="text-sm font-black text-amber-300">خلاصه مدیریتی و تحلیلی هوشمند کارخانه (Executive Insights)</h3>
                                        </div>
                                        
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                                            <div className="bg-white/10 backdrop-blur-md p-3 rounded-xl border border-white/10">
                                                <div className="text-[10px] text-blue-300 font-bold flex items-center justify-between">
                                                    <span>🏆 پرفروش‌ترین سرفصل (مبلغ)</span>
                                                    <Award className="w-3.5 h-3.5 text-amber-400" />
                                                </div>
                                                <div className="font-black text-white text-sm mt-1">{topAmtFam ? topAmtFam.familyName : '---'}</div>
                                                <div className="text-[10px] text-slate-300 font-mono mt-0.5">
                                                    خالص: {topAmtFam ? formatMoney(topAmtFam.salesAmt - topAmtFam.returnAmt) : 0} ریال
                                                </div>
                                            </div>

                                            <div className="bg-white/10 backdrop-blur-md p-3 rounded-xl border border-white/10">
                                                <div className="text-[10px] text-emerald-300 font-bold flex items-center justify-between">
                                                    <span>🏅 بیشترین حجم تولید/فروش (وزن)</span>
                                                    <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                                                </div>
                                                <div className="font-black text-white text-sm mt-1">{topWeightFam ? topWeightFam.familyName : '---'}</div>
                                                <div className="text-[10px] text-slate-300 font-mono mt-0.5">
                                                    وزن خالص: {topWeightFam ? (topWeightFam.salesQty - topWeightFam.returnQty).toLocaleString('fa-IR', { maximumFractionDigits: 1 }) : 0} kg
                                                </div>
                                            </div>

                                            <div className="bg-white/10 backdrop-blur-md p-3 rounded-xl border border-white/10">
                                                <div className="text-[10px] text-purple-300 font-bold flex items-center justify-between">
                                                    <span>💰 بالاترین فی خالص فروش</span>
                                                    <Coins className="w-3.5 h-3.5 text-purple-400" />
                                                </div>
                                                <div className="font-black text-white text-sm mt-1">{topFeeFam ? topFeeFam.familyName : '---'}</div>
                                                <div className="text-[10px] text-slate-300 font-mono mt-0.5">
                                                    فی متوسط: {topFeeFam && (topFeeFam.salesQty - topFeeFam.returnQty) > 0 ? formatMoney(Math.round((topFeeFam.salesAmt - topFeeFam.returnAmt) / (topFeeFam.salesQty - topFeeFam.returnQty))) : 0} ریال/kg
                                                </div>
                                            </div>

                                            <div className="bg-white/10 backdrop-blur-md p-3 rounded-xl border border-white/10">
                                                <div className="text-[10px] text-rose-300 font-bold flex items-center justify-between">
                                                    <span>🔻 بیشترین مرجوعی کد ۱۳</span>
                                                    <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
                                                </div>
                                                <div className="font-black text-white text-sm mt-1">{topRetFam && topRetFam.returnAmt > 0 ? topRetFam.familyName : 'فاقد مرجوعی'}</div>
                                                <div className="text-[10px] text-slate-300 font-mono mt-0.5">
                                                    مبلغ مرجوعی: {topRetFam ? formatMoney(topRetFam.returnAmt) : 0} ریال ({topRetFam ? topRetFam.returnQty.toFixed(1) : 0} kg)
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Main Tab View Switcher */}
                                    {salesSubTab === 'families' && !compareMode && (
                                        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                                            <div className="px-5 py-4 border-b border-slate-200 bg-slate-900 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                                <div>
                                                    <h3 className="font-black text-base flex items-center gap-2">
                                                        <span>گزارش رسمی سرفصل‌های اصلی کالا (با قابلیت Drill Down و توسعه ریز اقلام)</span>
                                                    </h3>
                                                    <p className="text-xs text-slate-300 mt-0.5">
                                                        اسپاندکس (کاور)، کش، پوشش، شواتیز، نایلون، نخ ملت، لایکرا، FDY، چیپس، POY، نخ ۱۲۰، لاستیک، نخ ۱۸۰، مستربچ
                                                    </p>
                                                </div>

                                                <button
                                                    onClick={() => {
                                                        const printWindow = window.open('', '_blank');
                                                        if (!printWindow) return;
                                                        let html = `
                                                            <html dir="rtl" lang="fa"><head><meta charset="utf-8"><title>گزارش سرفصل‌های اصلی کالا</title>
                                                            <style>body{font-family:Tahoma,sans-serif;padding:25px;direction:rtl;font-size:11px}
                                                            table{width:100%;border-collapse:collapse;margin-top:15px}
                                                            th,td{border:1px solid #cbd5e1;padding:8px;text-align:center}
                                                            th{background:#0f172a;color:white;font-bold:true}
                                                            .net{color:#15803d;font-weight:bold} .ret{color:#e11d48}
                                                            </style></head><body>
                                                            <h2>گزارش جامع سرفصل‌های اصلی فروش (سایان ERP)</h2>
                                                            <p>تاریخ: ${dateFrom} تا ${dateTo}</p>
                                                            <table><thead><tr>
                                                            <th>ردیف</th><th>نام سرفصل کالا</th><th>وزن فروش (kg)</th><th>وزن مرجوعی</th><th>وزن خالص</th><th>مبلغ فروش</th><th>مبلغ مرجوعی</th><th>فروش خالص (ریال)</th><th>فی خالص (ریال)</th><th>سهم %</th>
                                                            </tr></thead><tbody>`;
                                                        familiesList.forEach((fam, idx) => {
                                                            const nAmt = fam.salesAmt - fam.returnAmt;
                                                            const nQty = fam.salesQty - fam.returnQty;
                                                            const fee = nQty > 0 ? (nAmt / nQty) : 0;
                                                            const share = totalNetAmtAll > 0 ? (nAmt / totalNetAmtAll) * 100 : 0;
                                                            html += `<tr>
                                                                <td>${idx + 1}</td>
                                                                <td style="font-weight:bold;text-align:right">${fam.familyName}</td>
                                                                <td>${fam.salesQty.toFixed(1)}</td>
                                                                <td class="ret">${fam.returnQty.toFixed(1)}</td>
                                                                <td className="net">${nQty.toFixed(1)}</td>
                                                                <td>${fam.salesAmt.toLocaleString('fa-IR')}</td>
                                                                <td class="ret">${fam.returnAmt.toLocaleString('fa-IR')}</td>
                                                                <td className="net">${nAmt.toLocaleString('fa-IR')}</td>
                                                                <td style="font-weight:bold">${Math.round(fee).toLocaleString('fa-IR')}</td>
                                                                <td>${share.toFixed(1)}%</td>
                                                            </tr>`;
                                                        });
                                                        html += `</tbody></table></body></html>`;
                                                        printWindow.document.write(html);
                                                        printWindow.document.close();
                                                        printWindow.focus();
                                                        setTimeout(() => printWindow.print(), 400);
                                                    }}
                                                    className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs px-3.5 py-1.5 rounded-xl transition-all cursor-pointer shadow-sm flex items-center gap-1.5"
                                                >
                                                    <Printer className="w-3.5 h-3.5" />
                                                    <span>چاپ سرفصل‌های اصلی (PDF)</span>
                                                </button>
                                            </div>

                                            <div className="overflow-x-auto">
                                                <table className="w-full text-right text-xs">
                                                    <thead>
                                                        <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold">
                                                            <th className="p-3 w-10 text-center">#</th>
                                                            <th className="p-3">نام گروه / سرفصل اصلی کالا</th>
                                                            <th className="p-3 text-center">وزن فروش (kg)</th>
                                                            <th className="p-3 text-center text-rose-700 bg-rose-50/50">وزن مرجوعی (kg)</th>
                                                            <th className="p-3 text-center font-black text-blue-900 bg-blue-50/50">وزن خالص (kg)</th>
                                                            <th className="p-3 text-left">مبلغ فروش ناخالص (ریال)</th>
                                                            <th className="p-3 text-left text-rose-700 bg-rose-50/50">مبلغ مرجوعی کد ۱۳ (ریال)</th>
                                                            <th className="p-3 text-left font-black text-blue-900 bg-blue-50/50">فروش خالص نهایی (ریال)</th>
                                                            <th className="p-3 text-left font-black text-emerald-900 bg-emerald-50/50">فی خالص نهایی (ریال/kg)</th>
                                                            <th className="p-3 text-center">سهم (%)</th>
                                                            <th className="p-3 text-center w-24">Drill Down</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100">
                                                        {familiesList.map((fam, idx) => {
                                                            const netQty = fam.salesQty - fam.returnQty;
                                                            const netAmt = fam.salesAmt - fam.returnAmt;
                                                            const finalFee = netQty > 0 ? (netAmt / netQty) : 0;
                                                            const sharePct = totalNetAmtAll > 0 ? (netAmt / totalNetAmtAll) * 100 : 0;
                                                            const isExpanded = expandedGroupFamilies.has(fam.familyName);
                                                            const subItemsList = Array.from(fam.subItems.values());

                                                            return (
                                                                <React.Fragment key={idx}>
                                                                    <tr 
                                                                        onClick={() => {
                                                                            setExpandedGroupFamilies(prev => {
                                                                                const n = new Set(prev);
                                                                                if (n.has(fam.familyName)) n.delete(fam.familyName); else n.add(fam.familyName);
                                                                                return n;
                                                                            });
                                                                        }}
                                                                        className="hover:bg-slate-50 transition-colors cursor-pointer font-medium"
                                                                    >
                                                                        <td className="p-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                                                                        <td className="p-3 font-extrabold text-slate-900 flex items-center gap-2">
                                                                            <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                                                                            <span>{fam.familyName}</span>
                                                                            <span className="text-[10px] text-slate-400 font-normal">({subItemsList.length} کالا)</span>
                                                                        </td>
                                                                        <td className="p-3 text-center font-mono">{fam.salesQty.toLocaleString('fa-IR', { maximumFractionDigits: 1 })}</td>
                                                                        <td className="p-3 text-center font-mono text-rose-600 bg-rose-50/30">{fam.returnQty > 0 ? fam.returnQty.toLocaleString('fa-IR', { maximumFractionDigits: 1 }) : '-'}</td>
                                                                        <td className="p-3 text-center font-mono font-bold text-blue-950 bg-blue-50/30">{netQty.toLocaleString('fa-IR', { maximumFractionDigits: 1 })}</td>
                                                                        <td className="p-3 text-left font-mono">{formatMoney(fam.salesAmt)}</td>
                                                                        <td className="p-3 text-left font-mono text-rose-600 bg-rose-50/30">{fam.returnAmt > 0 ? formatMoney(fam.returnAmt) : '-'}</td>
                                                                        <td className="p-3 text-left font-mono font-black text-blue-950 bg-blue-50/30">{formatMoney(netAmt)}</td>
                                                                        <td className="p-3 text-left font-mono font-black text-emerald-800 bg-emerald-50/30">{formatMoney(Math.round(finalFee))}</td>
                                                                        <td className="p-3 text-center font-mono font-bold">
                                                                            <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px]">
                                                                                {sharePct.toFixed(1)}%
                                                                            </span>
                                                                        </td>
                                                                        <td className="p-3 text-center">
                                                                            <button className="inline-flex items-center gap-1 text-[11px] text-blue-700 font-black hover:underline focus:outline-none">
                                                                                <span>{isExpanded ? 'بستن' : 'ریز کالا'}</span>
                                                                                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                                                            </button>
                                                                        </td>
                                                                    </tr>

                                                                    {/* Nested Expanded Sub-Items Drill-Down Table */}
                                                                    {isExpanded && (
                                                                        <tr className="bg-blue-50/30">
                                                                            <td colSpan={11} className="p-3 sm:p-4 border-y border-blue-200">
                                                                                <div className="bg-white rounded-xl border border-blue-200 p-3.5 shadow-inner space-y-2">
                                                                                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                                                                        <h4 className="text-xs font-black text-blue-950 flex items-center gap-1.5">
                                                                                            <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                                                                                            <span>ریز اقلام و کالاهای زیرمجموعه سرفصل «{fam.familyName}»</span>
                                                                                        </h4>
                                                                                        <span className="text-[10px] text-slate-500 font-mono font-bold">مجموع فروش خالص گروه: {formatMoney(netAmt)} ریال</span>
                                                                                    </div>

                                                                                    <table className="w-full text-right text-[11px]">
                                                                                        <thead>
                                                                                            <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                                                                                                <th className="p-2 w-8 text-center">#</th>
                                                                                                <th className="p-2">کد کالا</th>
                                                                                                <th className="p-2">نام دقیق کالا</th>
                                                                                                <th className="p-2 text-center">وزن فروش</th>
                                                                                                <th className="p-2 text-center text-rose-700">وزن مرجوعی</th>
                                                                                                <th className="p-2 text-center font-bold text-blue-900">وزن خالص</th>
                                                                                                <th className="p-2 text-left">مبلغ فروش</th>
                                                                                                <th className="p-2 text-left text-rose-700">مبلغ مرجوعی</th>
                                                                                                <th className="p-2 text-left font-bold text-blue-900">مبلغ خالص</th>
                                                                                                <th className="p-2 text-left font-bold text-emerald-800">فی خالص</th>
                                                                                                <th className="p-2 text-center">سهم از گروه (%)</th>
                                                                                            </tr>
                                                                                        </thead>
                                                                                        <tbody className="divide-y divide-slate-100">
                                                                                            {subItemsList.map((sub, sIdx) => {
                                                                                                const sNetQty = sub.salesQty - sub.returnQty;
                                                                                                const sNetAmt = sub.salesAmt - sub.returnAmt;
                                                                                                const sFee = sNetQty > 0 ? (sNetAmt / sNetQty) : 0;
                                                                                                const sShareGroup = netAmt > 0 ? (sNetAmt / netAmt) * 100 : 0;

                                                                                                return (
                                                                                                    <tr key={sIdx} className="hover:bg-slate-50/70">
                                                                                                        <td className="p-2 text-center text-slate-400 font-mono">{sIdx + 1}</td>
                                                                                                        <td className="p-2 font-mono text-slate-500">{sub.itemCode || '-'}</td>
                                                                                                        <td className="p-2 font-bold text-slate-800">{sub.itemName}</td>
                                                                                                        <td className="p-2 text-center font-mono">{sub.salesQty.toFixed(1)}</td>
                                                                                                        <td className="p-2 text-center font-mono text-rose-600">{sub.returnQty > 0 ? sub.returnQty.toFixed(1) : '-'}</td>
                                                                                                        <td className="p-2 text-center font-mono font-bold text-blue-900">{sNetQty.toFixed(1)}</td>
                                                                                                        <td className="p-2 text-left font-mono">{formatMoney(sub.salesAmt)}</td>
                                                                                                        <td className="p-2 text-left font-mono text-rose-600">{sub.returnAmt > 0 ? formatMoney(sub.returnAmt) : '-'}</td>
                                                                                                        <td className="p-2 text-left font-mono font-bold text-blue-900">{formatMoney(sNetAmt)}</td>
                                                                                                        <td className="p-2 text-left font-mono font-bold text-emerald-800">{formatMoney(Math.round(sFee))}</td>
                                                                                                        <td className="p-2 text-center font-mono font-semibold text-slate-600">{sShareGroup.toFixed(1)}%</td>
                                                                                                    </tr>
                                                                                                );
                                                                                            })}
                                                                                        </tbody>
                                                                                    </table>
                                                                                </div>
                                                                            </td>
                                                                        </tr>
                                                                    )}
                                                                </React.Fragment>
                                                            );
                                                        })}
                                                    </tbody>
                                                    <tfoot>
                                                        <tr className="bg-slate-900 text-white font-bold border-t-2 border-slate-700">
                                                            <td colSpan={2} className="p-3 text-right">جمع کل سرفصل‌های اصلی:</td>
                                                            <td className="p-3 text-center font-mono">{familiesList.reduce((s, f) => s + f.salesQty, 0).toLocaleString('fa-IR', { maximumFractionDigits: 1 })}</td>
                                                            <td className="p-3 text-center font-mono text-rose-300">{familiesList.reduce((s, f) => s + f.returnQty, 0).toLocaleString('fa-IR', { maximumFractionDigits: 1 })}</td>
                                                            <td className="p-3 text-center font-mono font-black text-blue-300">{totalNetQtyAll.toLocaleString('fa-IR', { maximumFractionDigits: 1 })}</td>
                                                            <td className="p-3 text-left font-mono">{formatMoney(familiesList.reduce((s, f) => s + f.salesAmt, 0))}</td>
                                                            <td className="p-3 text-left font-mono text-rose-300">{formatMoney(familiesList.reduce((s, f) => s + f.returnAmt, 0))}</td>
                                                            <td className="p-3 text-left font-mono font-black text-blue-300">{formatMoney(totalNetAmtAll)}</td>
                                                            <td className="p-3 text-left font-mono font-black text-emerald-400">{formatMoney(Math.round(totalNetQtyAll > 0 ? totalNetAmtAll / totalNetQtyAll : 0))}</td>
                                                            <td colSpan={2} className="p-3 text-center font-mono">100.0%</td>
                                                        </tr>
                                                    </tfoot>
                                                </table>
                                            </div>
                                        </div>
                                    )}

                                    {/* Sub-Tab: Items Detail Report */}
                                    {salesSubTab === 'items' && !compareMode && (
                                        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 space-y-4">
                                            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-b border-slate-100 pb-3">
                                                <h3 className="text-sm font-black text-slate-800">گزارش تفکیکی کلیه کالاها و محصولات</h3>
                                                <div className="flex items-center gap-2 w-full sm:w-auto">
                                                    <div className="relative w-full sm:w-64">
                                                        <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                                                        <input 
                                                            type="text" 
                                                            placeholder="جستجو نام یا کد کالا..."
                                                            value={salesSearchQuery}
                                                            onChange={(e) => setSalesSearchQuery(e.target.value)}
                                                            className="text-xs bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-3 py-2 outline-none w-full focus:bg-white focus:border-blue-500 font-medium"
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                                                <table className="w-full text-right text-xs">
                                                    <thead className="bg-slate-100 sticky top-0 border-b border-slate-200 font-bold z-10">
                                                        <tr>
                                                            <th className="p-3 w-10 text-center">#</th>
                                                            <th className="p-3">کد کالا</th>
                                                            <th className="p-3">نام محصول</th>
                                                            <th className="p-3">سرفصل اصلی</th>
                                                            <th className="p-3 text-center">وزن خالص (kg)</th>
                                                            <th className="p-3 text-left">فروش خالص (ریال)</th>
                                                            <th className="p-3 text-left">فی خالص (ریال/kg)</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100">
                                                        {(() => {
                                                            const allItemsList: any[] = [];
                                                            familiesList.forEach(fam => {
                                                                fam.subItems.forEach(sub => {
                                                                    const netQ = sub.salesQty - sub.returnQty;
                                                                    const netA = sub.salesAmt - sub.returnAmt;
                                                                    if (salesSearchQuery.trim()) {
                                                                        const q = salesSearchQuery.toLowerCase();
                                                                        if (!sub.itemName.toLowerCase().includes(q) && !sub.itemCode.toLowerCase().includes(q)) return;
                                                                    }
                                                                    allItemsList.push({ ...sub, family: fam.familyName, netQ, netA, fee: netQ > 0 ? netA / netQ : 0 });
                                                                });
                                                            });

                                                            allItemsList.sort((a, b) => b.netA - a.netA);

                                                            return allItemsList.map((item, idx) => (
                                                                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                                                    <td className="p-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                                                                    <td className="p-3 font-mono text-slate-500">{item.itemCode || '-'}</td>
                                                                    <td className="p-3 font-bold text-slate-800">{item.itemName}</td>
                                                                    <td className="p-3 text-slate-600 font-medium">{item.family}</td>
                                                                    <td className="p-3 text-center font-mono font-bold text-blue-900">{item.netQ.toFixed(1)}</td>
                                                                    <td className="p-3 text-left font-mono font-bold text-blue-900">{formatMoney(item.netA)}</td>
                                                                    <td className="p-3 text-left font-mono font-black text-emerald-800">{formatMoney(Math.round(item.fee))}</td>
                                                                </tr>
                                                            ));
                                                        })()}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}

                                    {/* Sub-Tab: Invoices List */}
                                    {salesSubTab === 'invoices' && !compareMode && (
                                        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                                            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                                                <h3 className="text-sm font-bold text-slate-800">
                                                    لیست فاکتورهای فروش صادر شده ({displayedInvoices.length} آرتیکل)
                                                </h3>
                                            </div>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-right text-xs">
                                                    <thead>
                                                        <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
                                                            <th className="p-3 font-semibold w-12 text-center">ردیف</th>
                                                            <th className="p-3 font-semibold">شماره فاکتور</th>
                                                            <th className="p-3 font-semibold">نام مشتری</th>
                                                            <th className="p-3 font-semibold text-center">تعداد اقلام</th>
                                                            <th className="p-3 font-semibold text-center">مجموع وزن/مقدار</th>
                                                            <th className="p-3 font-semibold text-left">مبلغ کل (ریال)</th>
                                                            <th className="p-3 font-semibold text-center w-24">جزئیات</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100">
                                                        {(() => {
                                                            const invoicesMap = new Map<string, {
                                                                invoiceNum: string;
                                                                customerName: string;
                                                                totalAmount: number;
                                                                totalQuantity: number;
                                                                items: any[];
                                                            }>();
                                                            
                                                            displayedInvoices.forEach(row => {
                                                                const key = row.InvoiceNum || row.DocId;
                                                                if (!key) return;
                                                                const itemAmt = parseFloat(row.Amount || 0);
                                                                const itemQty = parseFloat(row.Quantity || 0);
                                                                const customerName = row.CustomerName || row.Notes || 'نامعلوم';
                                                                
                                                                if (!invoicesMap.has(key)) {
                                                                    invoicesMap.set(key, {
                                                                        invoiceNum: key,
                                                                        customerName: customerName,
                                                                        totalAmount: 0,
                                                                        totalQuantity: 0,
                                                                        items: []
                                                                    });
                                                                }
                                                                const existing = invoicesMap.get(key)!;
                                                                existing.totalAmount += itemAmt;
                                                                existing.totalQuantity += itemQty;
                                                                existing.items.push(row);
                                                            });
                                                            
                                                            const list = Array.from(invoicesMap.values());
                                                            if (list.length === 0) {
                                                                return <tr><td colSpan={7} className="p-8 text-center text-slate-400">هیچ فاکتوری یافت نشد</td></tr>;
                                                            }
                                                            
                                                            return list.map((inv, idx) => {
                                                                const isExpanded = expandedInvoiceId === inv.invoiceNum;
                                                                return (
                                                                    <React.Fragment key={inv.invoiceNum}>
                                                                        <tr onClick={() => setExpandedInvoiceId(isExpanded ? null : inv.invoiceNum)} className="hover:bg-slate-50 transition-colors cursor-pointer">
                                                                            <td className="p-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                                                                            <td className="p-3 font-mono font-bold text-blue-600">{inv.invoiceNum}</td>
                                                                            <td className="p-3 font-bold text-slate-800">{inv.customerName}</td>
                                                                            <td className="p-3 text-center font-mono text-slate-500">{inv.items.length} کالا</td>
                                                                            <td className="p-3 text-center font-mono font-bold text-slate-600">{inv.totalQuantity.toFixed(1)}</td>
                                                                            <td className="p-3 text-left font-mono font-black text-emerald-600">{formatMoney(inv.totalAmount)}</td>
                                                                            <td className="p-3 text-center">
                                                                                <button className="text-xs text-blue-600 font-bold">
                                                                                    {isExpanded ? 'بستن' : 'مشاهده'}
                                                                                </button>
                                                                            </td>
                                                                        </tr>
                                                                    </React.Fragment>
                                                                );
                                                            });
                                                        })()}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })()}
                    </div>
                )}

                {/* 4. PRODUCTION TAB */}
                {activeTab === 'production' && (
                    <div className="p-3.5 sm:p-6 space-y-4 sm:space-y-6">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between border-b border-slate-200 pb-4 gap-4">
                            <div>
                                <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                                    <Layers className="h-6 w-6 text-blue-600" />
                                    گزارش آمار کل تولید و ضایعات (سایان ERP)
                                </h2>
                                <p className="text-xs text-slate-500 mt-1">
                                    دریافت آنلاین و زنده اسناد ۶۱ (POY)، ۶۷ (DTY)، ۷۹ (کش)، و ۷۳ (اسپاندکس) از سایان + ثبت دستی ضایعات
                                </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <button
                                    onClick={fetchProduction}
                                    disabled={isLoading}
                                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
                                >
                                    <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                                    دریافت زنده از سایان
                                </button>

                                <button
                                    onClick={handleSaveWaste}
                                    disabled={isSavingWaste}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
                                >
                                    <Save className="h-4 w-4" />
                                    ذخیره مقادیر ضایعات
                                </button>

                                <button
                                    onClick={() => window.print()}
                                    className="bg-slate-700 hover:bg-slate-800 text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5 shadow-sm transition-all"
                                >
                                    <Printer className="h-4 w-4" />
                                    چاپ / PDF
                                </button>

                                <button
                                    onClick={handleExportExcel}
                                    className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5 shadow-sm transition-all"
                                >
                                    <Download className="h-4 w-4" />
                                    خروجی اکسل
                                </button>

                                <button
                                    onClick={handleSendBotReport}
                                    disabled={isSendingBot}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
                                >
                                    <Send className="h-4 w-4" />
                                    {isSendingBot ? 'در حال ارسال...' : 'ارسال به گروه‌های تلگرام / بله'}
                                </button>
                            </div>
                        </div>

                        {/* Top Filters & Stats */}
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-4">
                            <div className="flex flex-wrap items-center gap-3">
                                <span className="text-xs font-bold text-slate-700">ملاک تاریخ گزارش:</span>
                                <div className="flex items-center gap-2 bg-white px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono font-bold text-blue-900">
                                    <span>از: {dateFrom || '---'}</span>
                                    <span>تا: {dateTo || '---'}</span>
                                </div>
                                <span className="text-[11px] text-slate-500">(می‌توانید تاریخ را در نوار بالای صفحه تغییر داده و دکمه دریافت زنده را بزنید)</span>
                            </div>

                            <div className="flex items-center gap-4 text-xs font-bold">
                                <div className="bg-blue-50 text-blue-900 px-3 py-1.5 rounded-lg border border-blue-200">
                                    تولید کل: {prodLiveTotals.grandTotal.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} kg
                                </div>
                                <div className="bg-rose-50 text-rose-900 px-3 py-1.5 rounded-lg border border-rose-200">
                                    ضایعات کل: {prodWaste.totalWaste.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} kg ({prodWaste.totalPct.toFixed(2)}%)
                                </div>
                            </div>
                        </div>

                        {/* Main Production & Waste Table matching user screenshot format */}
                        <div className="border border-slate-300 rounded-xl overflow-hidden shadow-sm bg-white">
                            <div className="overflow-x-auto">
                                <table className="w-full text-center text-xs sm:text-sm border-collapse">
                                    <thead>
                                        {/* Row 1: Header Categories */}
                                        <tr className="bg-slate-200 text-slate-900 font-extrabold border-b border-slate-300">
                                            <th colSpan={2} className="p-2.5 border-r border-slate-300 bg-slate-300">کالاها</th>
                                            <th colSpan={5} className="p-2.5 bg-blue-100 text-blue-950">عملیات (اسناد تولید زنده سایان)</th>
                                        </tr>
                                        {/* Row 2: Sub Columns */}
                                        <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300 text-xs">
                                            <th className="p-2.5 border-r border-slate-300 w-20">واحد</th>
                                            <th className="p-2.5 border-r border-slate-300 text-right min-w-[200px]">کالا</th>
                                            <th className="p-2.5 border-r border-slate-300 w-36">61 سند تولید کارت POY</th>
                                            <th className="p-2.5 border-r border-slate-300 w-36">67 سند تولید کارت DTY</th>
                                            <th className="p-2.5 border-r border-slate-300 w-36">79 سند تولید کارت کش</th>
                                            <th className="p-2.5 border-r border-slate-300 w-36">73 سند تولید کارت اسپاندکس</th>
                                            <th className="p-2.5 bg-slate-200 font-black w-36">جمع</th>
                                        </tr>
                                    </thead>

                                    <tbody className="divide-y divide-slate-200 text-slate-800 font-medium">
                                        {isLoading ? (
                                            <tr>
                                                <td colSpan={7} className="py-12 text-center text-slate-500">
                                                    <div className="flex flex-col items-center justify-center gap-2">
                                                        <RefreshCw className="h-6 w-6 animate-spin text-blue-600" />
                                                        <span>در حال دریافت اطلاعات زنده از دیتابیس سایان...</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : prodLiveItems.length === 0 ? (
                                            <tr>
                                                <td colSpan={7} className="py-12 text-center text-slate-400 font-medium">
                                                    هیچ سند تولیدی در تاریخ {dateFrom} یافت نشد. جهت استعلام دکمه دریافت زنده از سایان را بفشارید.
                                                </td>
                                            </tr>
                                        ) : (
                                            prodLiveItems.map((item: any, idx: number) => (
                                                <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                                                    <td className="p-2.5 border-r border-slate-200 text-slate-500 font-sans">{item.unit || 'کیلوگرم'}</td>
                                                    <td className="p-2.5 border-r border-slate-200 text-right font-bold text-slate-900">{item.name}</td>
                                                    <td className="p-2.5 border-r border-slate-200 font-mono">{item.qty_61 > 0 ? item.qty_61.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) : '-'}</td>
                                                    <td className="p-2.5 border-r border-slate-200 font-mono">{item.qty_67 > 0 ? item.qty_67.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) : '-'}</td>
                                                    <td className="p-2.5 border-r border-slate-200 font-mono">{item.qty_79 > 0 ? item.qty_79.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) : '-'}</td>
                                                    <td className="p-2.5 border-r border-slate-200 font-mono">{item.qty_73 > 0 ? item.qty_73.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) : '-'}</td>
                                                    <td className="p-2.5 font-mono font-bold bg-slate-100 text-slate-900">{item.total > 0 ? item.total.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) : '-'}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>

                                    <tfoot>
                                        {/* Summary Row */}
                                        <tr className="bg-slate-200 text-slate-900 font-black border-t-2 border-slate-400">
                                            <td colSpan={2} className="p-3 text-right pr-4 text-sm bg-slate-300">جمع تولید</td>
                                            <td className="p-3 font-mono border-r border-slate-300">{prodLiveTotals.qty_61 ? prodLiveTotals.qty_61.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) : '-'}</td>
                                            <td className="p-3 font-mono border-r border-slate-300">{prodLiveTotals.qty_67 ? prodLiveTotals.qty_67.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) : '-'}</td>
                                            <td className="p-3 font-mono border-r border-slate-300">{prodLiveTotals.qty_79 ? prodLiveTotals.qty_79.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) : '-'}</td>
                                            <td className="p-3 font-mono border-r border-slate-300">{prodLiveTotals.qty_73 ? prodLiveTotals.qty_73.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) : '-'}</td>
                                            <td className="p-3 font-mono text-base bg-slate-300 text-blue-950">{prodLiveTotals.grandTotal ? prodLiveTotals.grandTotal.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) : '-'}</td>
                                        </tr>

                                        {/* Waste Manual Input Row */}
                                        <tr className="bg-rose-50 text-rose-900 font-bold border-t border-rose-200">
                                            <td colSpan={2} className="p-3 text-right pr-4 text-xs font-black text-rose-800 bg-rose-100">
                                                ضایعات (کیلوگرم) - ورود دستی:
                                            </td>
                                            <td className="p-2 border-r border-rose-200">
                                                <input
                                                    type="number"
                                                    step="0.1"
                                                    className="w-full text-center bg-white border border-rose-300 rounded p-1 font-mono text-xs font-bold focus:ring-2 focus:ring-rose-500 focus:outline-none"
                                                    value={prodWaste.waste_61 || ''}
                                                    onChange={(e) => handleWasteChange('waste_61', e.target.value)}
                                                    placeholder="0"
                                                />
                                            </td>
                                            <td className="p-2 border-r border-rose-200">
                                                <input
                                                    type="number"
                                                    step="0.1"
                                                    className="w-full text-center bg-white border border-rose-300 rounded p-1 font-mono text-xs font-bold focus:ring-2 focus:ring-rose-500 focus:outline-none"
                                                    value={prodWaste.waste_67 || ''}
                                                    onChange={(e) => handleWasteChange('waste_67', e.target.value)}
                                                    placeholder="0"
                                                />
                                            </td>
                                            <td className="p-2 border-r border-rose-200">
                                                <input
                                                    type="number"
                                                    step="0.1"
                                                    className="w-full text-center bg-white border border-rose-300 rounded p-1 font-mono text-xs font-bold focus:ring-2 focus:ring-rose-500 focus:outline-none"
                                                    value={prodWaste.waste_79 || ''}
                                                    onChange={(e) => handleWasteChange('waste_79', e.target.value)}
                                                    placeholder="0"
                                                />
                                            </td>
                                            <td className="p-2 border-r border-rose-200">
                                                <input
                                                    type="number"
                                                    step="0.1"
                                                    className="w-full text-center bg-white border border-rose-300 rounded p-1 font-mono text-xs font-bold focus:ring-2 focus:ring-rose-500 focus:outline-none"
                                                    value={prodWaste.waste_73 || ''}
                                                    onChange={(e) => handleWasteChange('waste_73', e.target.value)}
                                                    placeholder="0"
                                                />
                                            </td>
                                            <td className="p-3 font-mono font-black text-sm bg-rose-200 text-rose-950">
                                                {prodWaste.totalWaste ? prodWaste.totalWaste.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) : '0'}
                                            </td>
                                        </tr>

                                        {/* Waste Percentage Row */}
                                        <tr className="bg-amber-50 text-amber-900 font-bold border-t border-amber-200">
                                            <td colSpan={2} className="p-3 text-right pr-4 text-xs font-black text-amber-800 bg-amber-100">
                                                درصد ضایعات:
                                            </td>
                                            <td className="p-2.5 font-mono border-r border-amber-200">{prodWaste.pct_61 ? prodWaste.pct_61.toFixed(2) : '0.00'}%</td>
                                            <td className="p-2.5 font-mono border-r border-amber-200">{prodWaste.pct_67 ? prodWaste.pct_67.toFixed(2) : '0.00'}%</td>
                                            <td className="p-2.5 font-mono border-r border-amber-200">{prodWaste.pct_79 ? prodWaste.pct_79.toFixed(2) : '0.00'}%</td>
                                            <td className="p-2.5 font-mono border-r border-amber-200">{prodWaste.pct_73 ? prodWaste.pct_73.toFixed(2) : '0.00'}%</td>
                                            <td className="p-2.5 font-mono font-black bg-amber-200 text-amber-950">{prodWaste.totalPct ? prodWaste.totalPct.toFixed(2) : '0.00'}%</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>

                        {/* Waste Details Notes */}
                        <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-2">
                            <label className="block text-xs font-bold text-slate-800">
                                📝 جزئیات و توضیحات ضایعات (این توضیحات در کپشن زیر PDF ارسالی به گروه قرار خواهد گرفت):
                            </label>
                            <textarea
                                rows={3}
                                className="w-full p-3 border border-slate-300 rounded-lg text-xs leading-relaxed focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                placeholder="مثلا: ضایعات مربوط به نخ DTY به علت قطعی برق خط ۲ و تعویض نازل‌های اسپاندکس..."
                                value={prodWaste.details || ''}
                                onChange={(e) => setProdWaste({ ...prodWaste, details: e.target.value })}
                            />
                            <div className="flex justify-end">
                                <button
                                    onClick={handleSaveWaste}
                                    disabled={isSavingWaste}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-1.5 rounded-md flex items-center gap-1 transition-all disabled:opacity-50"
                                >
                                    <Save className="h-3.5 w-3.5" />
                                    ذخیره و ثبت در بایگانی ضایعات
                                </button>
                            </div>
                        </div>

                        {/* 4.5 PRODUCTION WASTE ARCHIVE SECTION */}
                        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 sm:p-6 space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-100">
                                <div>
                                    <h3 className="text-md font-bold text-slate-800 flex items-center gap-2">
                                        <Archive className="h-5 w-5 text-blue-600" />
                                        بایگانی و گزارشات ضایعات ثبت‌شده
                                    </h3>
                                    <p className="text-[11px] text-slate-500 mt-0.5">
                                        آرشیو کامل آمار تولید، جزئیات ضایعات و درصد خطای روزانه ثبت شده با قابلیت جستجو و گزارش‌گیری
                                    </p>
                                </div>
                                <div className="w-full sm:w-72 relative">
                                    <input
                                        type="text"
                                        placeholder="جستجو در تاریخ، توضیحات یا کالاها..."
                                        value={archiveSearch}
                                        onChange={(e) => setArchiveSearch(e.target.value)}
                                        className="w-full p-2 pr-8 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-slate-800"
                                    />
                                    <Search className="absolute right-2.5 top-2.5 h-4 w-4 text-slate-400" />
                                </div>
                            </div>

                            {isFetchingArchive ? (
                                <div className="py-8 text-center text-slate-400 text-xs">
                                    <Loader2 className="h-5 w-5 animate-spin mx-auto text-blue-600 mb-1" />
                                    <span>در حال بارگذاری اطلاعات آرشیو...</span>
                                </div>
                            ) : getFilteredArchive().length === 0 ? (
                                <div className="py-8 text-center text-slate-400 text-xs font-medium">
                                    هیچ رکوردی در بایگانی ضایعات یافت نشد. با پر کردن مقادیر فوق و ذخیره آن، اولین رکورد را ایجاد نمایید.
                                </div>
                            ) : (
                                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                                    <table className="w-full text-center text-xs border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                                                <th className="p-3 text-right">تاریخ گزارش</th>
                                                <th className="p-3">کل تولید (kg)</th>
                                                <th className="p-3 text-rose-800">کل ضایعات (kg)</th>
                                                <th className="p-3 text-amber-800">درصد ضایعات (%)</th>
                                                <th className="p-3">تفکیک ضایعات ۶۱ / ۶۷ / ۷۹ / ۷۳</th>
                                                <th className="p-3 text-right max-w-xs truncate">توضیحات / علل ضایعات</th>
                                                <th className="p-3 w-36">عملیات</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 text-slate-700">
                                            {getFilteredArchive().map((entry: any) => {
                                                const totalProd = entry.totals?.grandTotal || 
                                                    (parseFloat(entry.totals?.qty_61 || 0) + 
                                                     parseFloat(entry.totals?.qty_67 || 0) + 
                                                     parseFloat(entry.totals?.qty_79 || 0) + 
                                                     parseFloat(entry.totals?.qty_73 || 0)) || 0;
                                                
                                                const wastePct = totalProd > 0 ? (entry.totalWaste / totalProd) * 100 : 0;
                                                
                                                return (
                                                    <tr key={entry.id} className="hover:bg-slate-50/50 transition-colors">
                                                        <td className="p-3 text-right font-bold text-slate-900 font-mono">
                                                            {entry.dateFrom === entry.dateTo ? entry.dateFrom : `${entry.dateFrom} تا ${entry.dateTo}`}
                                                        </td>
                                                        <td className="p-3 font-mono font-bold">
                                                            {totalProd > 0 ? totalProd.toLocaleString('fa-IR', { maximumFractionDigits: 1 }) : '-'}
                                                        </td>
                                                        <td className="p-3 font-mono font-bold text-rose-700">
                                                            {entry.totalWaste > 0 ? entry.totalWaste.toLocaleString('fa-IR', { maximumFractionDigits: 1 }) : '-'}
                                                        </td>
                                                        <td className="p-3 font-mono font-black text-amber-700">
                                                            {wastePct > 0 ? `${wastePct.toFixed(2)}%` : '۰.۰۰%'}
                                                        </td>
                                                        <td className="p-3 font-mono text-slate-500 text-[11px]">
                                                            {(entry.waste_61 || 0).toLocaleString('fa-IR')} / {(entry.waste_67 || 0).toLocaleString('fa-IR')} / {(entry.waste_79 || 0).toLocaleString('fa-IR')} / {(entry.waste_73 || 0).toLocaleString('fa-IR')}
                                                        </td>
                                                        <td className="p-3 text-right max-w-xs truncate text-[11px] text-slate-600" title={entry.details}>
                                                            {entry.details || '---'}
                                                        </td>
                                                        <td className="p-3 flex items-center justify-center gap-1.5">
                                                            <button
                                                                onClick={() => handleLoadArchiveDate(entry)}
                                                                className="px-2 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded font-bold text-[10px] transition-colors cursor-pointer"
                                                                title="بارگذاری تاریخ این سند تولید و ضایعات"
                                                            >
                                                                بازخوانی روز
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteArchiveEntry(entry.id)}
                                                                className="p-1 text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                                                                title="حذف سند"
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* 5. CHEQUES TAB */}
                {activeTab === 'cheques' && (
                    <div className="p-3.5 sm:p-6 space-y-4 sm:space-y-6">
                        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 pb-4 gap-4">
                            <div>
                                <h2 className="text-xl font-bold text-slate-800">سامانه مدیریت چک‌ها و اسناد دریافتنی</h2>
                                <p className="text-xs text-slate-500 mt-1">مشاهده و دسته‌بندی چک‌های صندوق، بانکی، واخواست‌شده و خرج‌شده کارخانه</p>
                            </div>
                            
                            <div className="flex flex-col sm:flex-row gap-2 items-center w-full md:w-auto">
                                <div className="w-full md:w-auto">
                                    <div className="flex flex-wrap gap-1 border border-slate-300 rounded-md p-1 bg-slate-50 w-full justify-start">
                                        <button 
                                            onClick={() => setChequeStatusFilter('all')}
                                            className={`text-[10px] font-bold py-1 px-3 rounded cursor-pointer ${chequeStatusFilter === 'all' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                                        >
                                            همه
                                        </button>
                                        <button 
                                            onClick={() => setChequeStatusFilter('in_hand')}
                                            className={`text-[10px] font-bold py-1 px-3 rounded cursor-pointer ${chequeStatusFilter === 'in_hand' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                                        >
                                            در صندوق
                                        </button>
                                        <button 
                                            onClick={() => setChequeStatusFilter('at_bank')}
                                            className={`text-[10px] font-bold py-1 px-3 rounded cursor-pointer ${chequeStatusFilter === 'at_bank' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                                        >
                                            نزد بانک
                                        </button>
                                        <button 
                                            onClick={() => setChequeStatusFilter('returned')}
                                            className={`text-[10px] font-bold py-1 px-3 rounded cursor-pointer ${chequeStatusFilter === 'returned' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                                        >
                                            برگشتی
                                        </button>
                                        <button 
                                            onClick={() => setChequeStatusFilter('spent')}
                                            className={`text-[10px] font-bold py-1 px-3 rounded cursor-pointer ${chequeStatusFilter === 'spent' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                                        >
                                            وصول/خرج شده
                                        </button>
                                    </div>
                                </div>
                                
                                <div className="relative w-full md:w-56">
                                    <Search className="absolute right-2.5 top-2.5 h-4 w-4 text-slate-400" />
                                    <input 
                                        type="text"
                                        placeholder="جستجوی چک، بانک، صادرکننده..." 
                                        className="w-full pl-3 pr-8 py-1.5 border rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white" 
                                        value={chequeSearch}
                                        onChange={(e) => setChequeSearch(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Cheques Overview Stats */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 flex items-center justify-between">
                                <div>
                                    <div className="text-slate-500 font-bold text-[10px]">مجموع مبالغ چک‌های گزینش‌شده</div>
                                    <div className="text-xl font-black text-slate-800 mt-2 font-mono">
                                        {formatMoney(filteredCheques.reduce((sum, r) => sum + r.amount, 0))} <span className="text-xs font-bold">ریال</span>
                                    </div>
                                </div>
                                <Coins className="w-8 h-8 text-blue-500 opacity-20" />
                            </div>
                            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 flex items-center justify-between">
                                <div>
                                    <div className="text-slate-500 font-bold text-[10px]">تعداد چک‌ها</div>
                                    <div className="text-xl font-black text-slate-800 mt-2 font-mono">
                                        {filteredCheques.length} <span className="text-xs font-bold">فقره</span>
                                    </div>
                                </div>
                                <CheckSquare className="w-8 h-8 text-emerald-500 opacity-20" />
                            </div>
                            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 flex items-center justify-between">
                                <div>
                                    <div className="text-slate-500 font-bold text-[10px]">میانگین مبلغ چک‌ها</div>
                                    <div className="text-xl font-black text-slate-800 mt-2 font-mono">
                                        {formatMoney(filteredCheques.length ? filteredCheques.reduce((sum, r) => sum + r.amount, 0) / filteredCheques.length : 0)} <span className="text-xs font-bold">ریال</span>
                                    </div>
                                </div>
                                <TrendingUp className="w-8 h-8 text-purple-500 opacity-20" />
                            </div>
                        </div>

                        {/* Cheques table */}
                        <div className="rounded-xl border border-slate-200 overflow-hidden max-h-[450px] overflow-y-auto">
                            {/* Desktop view */}
                            <table className="w-full text-right text-xs hidden md:table">
                                <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 z-10">
                                    <tr>
                                        <th className="p-3.5 font-bold text-slate-700 w-16 text-center">ردیف</th>
                                        <th className="p-3.5 font-bold text-slate-700 w-32">شماره چک</th>
                                        <th className="p-3.5 font-bold text-slate-700 w-32">تاریخ سررسید</th>
                                        <th className="p-3.5 font-bold text-slate-700 w-44">بانک صادرکننده</th>
                                        <th className="p-3.5 font-bold text-slate-700">شرح / صادرکننده چک</th>
                                        <th className="p-3.5 font-bold text-slate-700 text-left w-40">مبلغ اسمی (ریال)</th>
                                        <th className="p-3.5 font-bold text-slate-700 w-44 text-center">وضعیت سند</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredCheques.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="text-center py-10 text-slate-400 font-medium">هیچ چکی یافت نشد. فیلترها را بررسی کنید.</td>
                                        </tr>
                                    ) : (
                                        filteredCheques.map((row, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="p-3 text-slate-400 text-center font-medium">{idx + 1}</td>
                                                <td className="p-3 font-mono font-bold text-slate-900">{row.chequeNo}</td>
                                                <td className="p-3 font-medium text-slate-500">{formatDateToJalali(row.dueDate)}</td>
                                                <td className="p-3 font-bold text-slate-800">{row.bankName}</td>
                                                <td className="p-3 font-semibold text-slate-800">{row.drawerName}</td>
                                                <td className="p-3 text-left font-mono font-extrabold text-blue-700">{formatMoney(row.amount)}</td>
                                                <td className="p-3 text-center">
                                                    <span className={`px-2.5 py-0.5 rounded text-[10px] font-extrabold border ${
                                                        row.statusGroup === 'spent' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                                        row.statusGroup === 'returned' ? 'bg-rose-50 text-rose-700 border-rose-100' :
                                                        row.statusGroup === 'at_bank' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                                        'bg-slate-50 text-slate-700 border-slate-200'
                                                    }`}>
                                                        {row.statusDesc}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>

                            {/* Mobile view */}
                            <div className="block md:hidden divide-y divide-slate-100 bg-white">
                                {filteredCheques.length === 0 ? (
                                    <div className="text-center py-10 text-slate-400 font-medium">هیچ چکی یافت نشد. فیلترها را بررسی کنید.</div>
                                ) : (
                                    filteredCheques.map((row, idx) => (
                                        <div key={idx} className="p-4 space-y-3 text-xs">
                                            <div className="flex justify-between items-center">
                                                <span className="text-[10px] text-slate-400 font-bold font-mono">#{idx + 1} | چک: {row.chequeNo}</span>
                                                <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold border ${
                                                    row.statusGroup === 'spent' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                                    row.statusGroup === 'returned' ? 'bg-rose-50 text-rose-700 border-rose-100' :
                                                    row.statusGroup === 'at_bank' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                                    'bg-slate-50 text-slate-700 border-slate-200'
                                                }`}>
                                                    {row.statusDesc}
                                                </span>
                                            </div>
                                            <div>
                                                <div className="text-slate-500 font-bold">{row.bankName}</div>
                                                <div className="text-[11px] text-slate-600 mt-0.5 font-semibold">صادرکننده: {row.drawerName}</div>
                                            </div>
                                            <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg font-mono">
                                                <div>
                                                    <span className="text-[9px] text-slate-400 font-sans block">سررسید</span>
                                                    <span className="font-bold text-slate-700 text-xs">{formatDateToJalali(row.dueDate)}</span>
                                                </div>
                                                <div className="text-left">
                                                    <span className="text-[9px] text-slate-400 font-sans block">مبلغ کل</span>
                                                    <span className="font-black text-blue-700 text-xs">{formatMoney(row.amount)} ریال</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Premium Statement Modal */}
            {isStatementModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in rtl">
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden">
                        {/* Modal Header */}
                        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                            <div>
                                <h3 className="text-lg font-extrabold text-slate-800 flex items-center gap-2">
                                    <FileText className="w-5 h-5 text-blue-600" />
                                    ریز صورتحساب و دفاترحساب اشخاص
                                </h3>
                                <div className="text-xs text-slate-500 mt-1 font-bold">
                                    نام شخص: <span className="text-slate-900 text-sm font-black">{modalTafsiliName}</span> (کد تفصیلی: <span className="text-slate-900 font-mono font-bold">{modalTafsiliCode}</span>)
                                </div>
                                <div className="text-[10px] text-blue-600 mt-0.5 font-bold">
                                    بازه زمانی: {dateFrom || '---'} تا {dateTo || '---'}
                                </div>
                            </div>
                            <button 
                                onClick={() => {
                                    setIsStatementModalOpen(false);
                                    setStatementData([]);
                                    setGuaranteeCheques([]);
                                    setStatementSearch('');
                                }}
                                className="p-1.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Modal Toolbar */}
                        <div className="p-4 bg-slate-100/50 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-3">
                            <div className="relative w-full sm:w-80">
                                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                                <input 
                                    type="text" 
                                    placeholder="جستجو در شرح تراکنش یا شماره سند..." 
                                    value={statementSearch} 
                                    onChange={e => setStatementSearch(e.target.value)} 
                                    className="w-full pl-3 pr-9 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white" 
                                />
                            </div>

                            <div className="flex gap-2 w-full sm:w-auto">
                                <button 
                                    onClick={() => fetchStatement(modalTafsiliCode)} 
                                    disabled={isLoading}
                                    className="flex-1 sm:flex-none px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50 transition-colors cursor-pointer"
                                >
                                    {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                                    بروزرسانی داده‌ها
                                </button>
                                <button 
                                    onClick={handlePrintStatement}
                                    disabled={isLoading || filteredStatementData.length === 0}
                                    className="flex-1 sm:flex-none px-4 py-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50 transition-colors cursor-pointer"
                                >
                                    <Printer className="w-3.5 h-3.5 text-slate-500" />
                                    چاپ / PDF
                                </button>
                            </div>
                        </div>

                        {/* Modal Body (Table of Transactions) */}
                        <div className="p-6 overflow-y-auto flex-1 bg-slate-50/50">
                            {isLoading ? (
                                <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-500 font-bold text-sm">
                                    <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                                    <span>در حال دریافت و تحلیل ریز گردش حساب سایان...</span>
                                </div>
                            ) : filteredStatementData.length > 0 ? (
                                <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                                    {/* Desktop View */}
                                    <table className="w-full text-right text-xs hidden md:table">
                                        <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                                            <tr>
                                                <th className="p-3 font-bold text-slate-700 w-24">تاریخ سند</th>
                                                <th className="p-3 font-bold text-slate-700 w-24">شماره سند</th>
                                                <th className="p-3 font-bold text-slate-700 w-40">سرفصل معین</th>
                                                <th className="p-3 font-bold text-slate-700">شرح آرتیکل</th>
                                                <th className="p-3 font-bold text-slate-700 text-left w-36">بدهکار (ریال)</th>
                                                <th className="p-3 font-bold text-slate-700 text-left w-36">بستانکار (ریال)</th>
                                                <th className="p-3 font-bold text-slate-700 text-left w-40">مانده حساب (ریال)</th>
                                                <th className="p-3 font-bold text-slate-700 w-20 text-center">تشخیص</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {filteredStatementData.map((row, idx) => (
                                                <tr key={idx} className="hover:bg-slate-50/30 transition-colors">
                                                    <td className="p-3 font-medium text-slate-500 whitespace-nowrap">{formatDateToJalali(row.Date)}</td>
                                                    <td className="p-3 font-mono text-slate-600 font-semibold">{row.SanadNo}</td>
                                                    <td className="p-3 text-slate-600 font-medium whitespace-nowrap">
                                                        {row.MoeinGroup && row.MoeinParent && row.MoeinCode ? (
                                                            <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded text-[10px] font-extrabold">
                                                                {row.MoeinGroup}{row.MoeinParent}{row.MoeinCode} - {row.MoeinName || 'سایر'}
                                                            </span>
                                                        ) : (
                                                            '-'
                                                        )}
                                                    </td>
                                                    <td className="p-3 font-medium text-slate-800 leading-relaxed">{row.Description || 'ثبت حسابداری'}</td>
                                                    <td className="p-3 text-left text-rose-600 font-mono font-medium">{row.bed > 0 ? formatMoney(row.bed) : '-'}</td>
                                                    <td className="p-3 text-left text-emerald-600 font-mono font-medium">{row.bes > 0 ? formatMoney(row.bes) : '-'}</td>
                                                    <td className={`p-3 text-left font-extrabold font-mono ${row.balance > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                                                        {formatMoney(row.balance)}
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                                                            row.balance > 0 ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'
                                                        }`}>
                                                            {row.balance > 0 ? 'بدهکار' : 'بستانکار'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}

                                            {/* Summary Sticky Foot */}
                                            <tr className="bg-slate-50 font-extrabold border-t-2 border-slate-200 shadow-[0_-2px_6px_rgba(0,0,0,0.03)] sticky bottom-0 z-10">
                                                <td colSpan={4} className="p-4 text-left font-extrabold text-slate-700">مجموع دوره تراکنش‌ها:</td>
                                                <td className="p-4 text-left text-rose-700 font-mono text-sm">
                                                    {formatMoney(filteredStatementData.reduce((sum, r) => sum + r.bed, 0))}
                                                </td>
                                                <td className="p-4 text-left text-emerald-700 font-mono text-sm">
                                                    {formatMoney(filteredStatementData.reduce((sum, r) => sum + r.bes, 0))}
                                                </td>
                                                <td colSpan={2} className={`p-4 text-left font-black font-mono text-sm ${
                                                    filteredStatementData[filteredStatementData.length - 1]?.balance > 0 ? 'text-rose-700' : 'text-emerald-700'
                                                }`}>
                                                    {formatMoney(filteredStatementData[filteredStatementData.length - 1]?.balance || 0)}
                                                    <span className="text-[10px] font-bold mr-1">
                                                        ({(filteredStatementData[filteredStatementData.length - 1]?.balance || 0) > 0 ? 'بدهکار' : 'بستانکار'})
                                                    </span>
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>

                                    {/* Mobile View */}
                                    <div className="block md:hidden divide-y divide-slate-100 bg-white">
                                        {filteredStatementData.map((row, idx) => (
                                            <div key={idx} className="p-4 space-y-2.5 text-xs">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-[10px] text-slate-400 font-bold font-mono">سند: {row.SanadNo} | {formatDateToJalali(row.Date)}</span>
                                                    <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold ${
                                                        row.balance > 0 ? 'bg-rose-50 text-rose-700 border border-rose-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                                    }`}>
                                                        {row.balance > 0 ? 'بدهکار' : 'بستانکار'}
                                                    </span>
                                                </div>
                                                
                                                {row.MoeinGroup && row.MoeinParent && row.MoeinCode && (
                                                    <div className="inline-block bg-slate-50 text-slate-700 px-2 py-1 rounded text-[10px] font-bold border border-slate-100">
                                                        معین: {row.MoeinGroup}{row.MoeinParent}{row.MoeinCode} - {row.MoeinName || 'سایر'}
                                                    </div>
                                                )}

                                                <div className="text-slate-800 font-medium leading-relaxed bg-slate-50/50 p-2.5 rounded-xl border border-dashed border-slate-150">
                                                    {row.Description || 'ثبت حسابداری'}
                                                </div>

                                                <div className="grid grid-cols-3 gap-2 text-center font-mono text-[11px] bg-slate-50 p-2 rounded-lg">
                                                    <div>
                                                        <span className="text-[9px] text-slate-400 font-sans block">بدهکار</span>
                                                        <span className="font-bold text-rose-600">{row.bed > 0 ? formatMoney(row.bed) : '-'}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-[9px] text-slate-400 font-sans block">بستانکار</span>
                                                        <span className="font-bold text-emerald-600">{row.bes > 0 ? formatMoney(row.bes) : '-'}</span>
                                                    </div>
                                                    <div className="text-left">
                                                        <span className="text-[9px] text-slate-400 font-sans block">مانده</span>
                                                        <span className={`font-black ${row.balance > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{formatMoney(row.balance)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}

                                        {/* Mobile Sticky / Persistent summary */}
                                        <div className="p-4 bg-slate-50 border-t-2 border-slate-200 text-xs font-black space-y-2">
                                            <div className="flex justify-between">
                                                <span className="text-slate-600">جمع گردش بدهکار دوره:</span>
                                                <span className="text-rose-700 font-mono font-bold text-sm">{formatMoney(filteredStatementData.reduce((sum, r) => sum + r.bed, 0))} ریال</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-600">جمع گردش بستانکار دوره:</span>
                                                <span className="text-emerald-700 font-mono font-bold text-sm">{formatMoney(filteredStatementData.reduce((sum, r) => sum + r.bes, 0))} ریال</span>
                                            </div>
                                            <div className="flex justify-between border-t border-slate-200/60 pt-1 mt-1 text-sm">
                                                <span className="text-slate-700">مانده نهایی دوره:</span>
                                                <span className={`font-mono text-base ${
                                                    filteredStatementData[filteredStatementData.length - 1]?.balance > 0 ? 'text-rose-700' : 'text-emerald-700'
                                                }`}>
                                                    {formatMoney(filteredStatementData[filteredStatementData.length - 1]?.balance || 0)} ریال
                                                    <span className="text-[10px] font-bold mr-1">
                                                        ({(filteredStatementData[filteredStatementData.length - 1]?.balance || 0) > 0 ? 'بدهکار' : 'بستانکار'})
                                                    </span>
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-24 text-slate-400 font-medium border-2 border-dashed border-slate-200 bg-white rounded-2xl shadow-sm">
                                    هیچ تراکنشی در بازه زمانی تعیین‌شده یافت نشد.
                                </div>
                            )}

                            {/* Guarantee Cheques Section */}
                            {!isLoading && guaranteeCheques.length > 0 && (
                                <div className="mt-6 space-y-3 bg-amber-50/40 p-3 sm:p-5 rounded-2xl border border-amber-200/60 shadow-sm animate-fadeIn">
                                    <div className="flex items-center gap-2 text-amber-900">
                                        <CheckSquare className="w-5 h-5 text-amber-600" />
                                        <h3 className="text-sm font-bold">چک‌های تضمینی و تعهدات مرتبط</h3>
                                    </div>
                                    <div className="rounded-xl border border-amber-200 overflow-hidden bg-white max-h-[300px] overflow-y-auto shadow-inner">
                                        {/* Desktop View */}
                                        <table className="w-full text-right text-xs hidden md:table">
                                            <thead className="bg-amber-50/80 sticky top-0 border-b border-amber-200 z-10">
                                                <tr>
                                                    <th className="p-3 font-bold text-amber-800 w-24">تاریخ سند</th>
                                                    <th className="p-3 font-bold text-amber-800 w-24">شماره سند</th>
                                                    <th className="p-3 font-bold text-amber-800 w-40">سرفصل معین</th>
                                                    <th className="p-3 font-bold text-amber-800">شرح آرتیکل</th>
                                                    <th className="p-3 font-bold text-amber-800 text-left w-36">مبلغ تضمین (ریال)</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-amber-100/60">
                                                {guaranteeCheques.map((row, idx) => (
                                                    <tr key={idx} className="hover:bg-amber-50/30 transition-colors">
                                                        <td className="p-3 font-medium text-slate-500 whitespace-nowrap">{formatDateToJalali(row.Date)}</td>
                                                        <td className="p-3 font-mono text-slate-600 font-semibold">{row.SanadNo}</td>
                                                        <td className="p-3 text-slate-600 font-medium whitespace-nowrap">
                                                            <span className="bg-amber-100/70 text-amber-800 px-2.5 py-0.5 rounded text-[10px] font-bold">
                                                                {row.MoeinGroup}{row.MoeinParent}{row.MoeinCode} - {row.MoeinName || 'سایر'}
                                                            </span>
                                                        </td>
                                                        <td className="p-3 font-medium text-slate-800 leading-relaxed">{row.Description}</td>
                                                        <td className="p-3 text-left text-amber-700 font-mono font-bold">
                                                            {formatMoney(row.bed > 0 ? row.bed : row.bes)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>

                                        {/* Mobile View */}
                                        <div className="block md:hidden divide-y divide-amber-100/60 bg-white">
                                            {guaranteeCheques.map((row, idx) => (
                                                <div key={idx} className="p-4 space-y-2 text-xs">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-[10px] text-slate-400 font-bold font-mono">سند: {row.SanadNo} | {formatDateToJalali(row.Date)}</span>
                                                        <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded text-[9px] font-bold">
                                                            {row.MoeinGroup}{row.MoeinParent}{row.MoeinCode} - {row.MoeinName || 'سایر'}
                                                        </span>
                                                    </div>
                                                    <div className="text-slate-800 font-medium leading-relaxed bg-amber-50/20 p-2.5 rounded-lg border border-dashed border-amber-200">
                                                        {row.Description}
                                                    </div>
                                                    <div className="flex justify-between items-center font-mono">
                                                        <span className="text-[9px] text-slate-400 font-sans">مبلغ تضمین</span>
                                                        <span className="font-extrabold text-amber-700 text-sm">{formatMoney(row.bed > 0 ? row.bed : row.bes)} ریال</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 border-t border-slate-100 flex justify-end bg-slate-50">
                            <button 
                                onClick={() => {
                                    setIsStatementModalOpen(false);
                                    setStatementData([]);
                                    setGuaranteeCheques([]);
                                    setStatementSearch('');
                                }}
                                className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                            >
                                بستن پنجره
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
