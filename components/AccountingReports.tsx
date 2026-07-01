import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { Search, Loader2 } from 'lucide-react';
import * as jalaali from 'jalaali-js';

export default function AccountingReports() {
    const [activeTab, setActiveTab] = useState('traz');
    const [isLoading, setIsLoading] = useState(false);
    
    // Traz State
    const [trazData, setTrazData] = useState<any[]>([]);
    const [trazSearch, setTrazSearch] = useState('');
    
    // Statement State
    const [tafsilis, setTafsilis] = useState<any[]>([]);
    const [selectedTafsili, setSelectedTafsili] = useState('');
    const [statementData, setStatementData] = useState<any[]>([]);
    
    // Fetch common data (Tafsilis)
    const fetchTafsilis = async () => {
        try {
            const res = await fetch('/api/sayan-proxy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    path: '/query',
                    method: 'POST',
                    body: { query: `SELECT Field_003 as Code, Field_006 as Name FROM ACT_TBL_007 WHERE Field_004 = '11'` }
                })
            });
            const data = await res.json();
            if (data.data) {
                setTafsilis(data.data);
            }
        } catch (err) {
            console.error('Error fetching tafsilis', err);
        }
    };

    const fetchTraz = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/sayan-proxy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    path: '/query',
                    method: 'POST',
                    body: { 
                        query: `
                            SELECT 
                                t24.Field_010 as TafsiliRaw,
                                SUM(CAST(t24.Field_006 AS FLOAT)) as TotalBed,
                                SUM(CAST(t24.Field_007 AS FLOAT)) as TotalBes
                            FROM ACT_TBL_024 t24
                            WHERE t24.Field_010 LIKE '11:%'
                            GROUP BY t24.Field_010
                        `
                    }
                })
            });
            const data = await res.json();
            if (data.data) {
                // Map with tafsili names
                const mapped = data.data.map((row: any) => {
                    // Extract code from '11:CODE' or '11:CODE-12:CODE2'
                    const match = row.TafsiliRaw.match(/11:(\d+)/);
                    const code = match ? match[1] : '';
                    const tafsili = tafsilis.find(t => t.Code === code);
                    const name = tafsili ? tafsili.Name : code;
                    const bed = parseFloat(row.TotalBed || 0);
                    const bes = parseFloat(row.TotalBes || 0);
                    const balance = bed - bes;
                    return { code, name, bed, bes, balance };
                }).filter((r: any) => r.balance !== 0); // Hide zero balance
                
                mapped.sort((a: any, b: any) => Math.abs(b.balance) - Math.abs(a.balance));
                setTrazData(mapped);
            }
        } catch (err: any) {
            toast.error('خطا در دریافت تراز اشخاص');
        } finally {
            setIsLoading(false);
        }
    };

    const fetchStatement = async () => {
        if (!selectedTafsili) {
            toast.error('لطفا یک شخص را انتخاب کنید');
            return;
        }
        setIsLoading(true);
        try {
            const res = await fetch('/api/sayan-proxy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    path: '/query',
                    method: 'POST',
                    body: { 
                        query: `
                            SELECT 
                                t9.Field_004 as SanadNo,
                                t9.Field_009 as Bed,
                                t9.Field_010 as Bes,
                                t9.Field_011 as Description,
                                t8.Field_008 as Date
                            FROM ACT_TBL_009 t9
                            LEFT JOIN ACT_TBL_008 t8 ON t9.Field_004 = t8.Field_006 AND t9.Field_003 = t8.Field_004
                            WHERE t9.Field_015 LIKE '%11:${selectedTafsili}%'
                            ORDER BY t8.Field_008 ASC, CAST(t9.Field_001 AS INT) ASC
                        `
                    }
                })
            });
            const data = await res.json();
            if (data.data) {
                let runningBalance = 0;
                const mapped = data.data.map((row: any) => {
                    const bed = parseFloat(row.Bed || 0);
                    const bes = parseFloat(row.Bes || 0);
                    runningBalance += (bed - bes);
                    return { ...row, bed, bes, balance: runningBalance };
                });
                setStatementData(mapped);
            }
        } catch (err: any) {
            toast.error('خطا در دریافت صورتحساب');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchTafsilis();
    }, []);

    useEffect(() => {
        if (activeTab === 'traz' && tafsilis.length > 0 && trazData.length === 0) {
            fetchTraz();
        }
    }, [activeTab, tafsilis]);

    const formatMoney = (val: number) => new Intl.NumberFormat('fa-IR').format(Math.abs(val));
    const formatStatus = (val: number) => {
        if (val > 0) return 'بدهکار';
        if (val < 0) return 'بستانکار';
        return 'بی‌حساب';
    };
    
    const formatDate = (dateStr: string) => {
        if (!dateStr) return '';
        try {
            const d = new Date(dateStr);
            const j = jalaali.toJalaali(d.getFullYear(), d.getMonth() + 1, d.getDate());
            return `${j.jy}/${String(j.jm).padStart(2, '0')}/${String(j.jd).padStart(2, '0')}`;
        } catch {
            return dateStr;
        }
    };

    const filteredTraz = trazData.filter(t => 
        t.name.includes(trazSearch) || t.code.includes(trazSearch)
    );

    return (
        <div className="p-4 md:p-8 rtl max-w-7xl mx-auto space-y-6">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 mb-6">حسابداری و مالی</h1>
            
            <div className="flex space-x-reverse space-x-4 mb-6 border-b border-gray-200">
                <button 
                    onClick={() => setActiveTab('traz')} 
                    className={`py-2 px-6 text-lg font-medium border-b-2 ${activeTab === 'traz' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    تراز اشخاص (بدهکاران و بستانکاران)
                </button>
                <button 
                    onClick={() => setActiveTab('statement')} 
                    className={`py-2 px-6 text-lg font-medium border-b-2 ${activeTab === 'statement' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    صورتحساب مشتری
                </button>
            </div>
            
            {activeTab === 'traz' && (
                <div className="bg-white rounded-lg shadow border border-gray-100 p-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
                        <h2 className="text-xl font-semibold">لیست بدهکاران و بستانکاران</h2>
                        <div className="flex gap-2 w-full md:w-auto">
                            <div className="relative w-full md:w-64">
                                <Search className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
                                <input 
                                    type="text"
                                    placeholder="جستجوی شخص..." 
                                    className="w-full pl-3 pr-10 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    value={trazSearch}
                                    onChange={(e) => setTrazSearch(e.target.value)}
                                />
                            </div>
                            <button 
                                onClick={fetchTraz} 
                                className="flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 text-sm font-medium"
                            >
                                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'بروزرسانی'}
                            </button>
                        </div>
                    </div>
                    
                    <div className="rounded-md border border-gray-200 max-h-[600px] overflow-auto">
                        <table className="w-full text-right text-sm">
                            <thead className="bg-gray-50 sticky top-0 border-b">
                                <tr>
                                    <th className="p-3 font-semibold text-gray-700">کد</th>
                                    <th className="p-3 font-semibold text-gray-700">نام شخص</th>
                                    <th className="p-3 font-semibold text-gray-700">جمع بدهکار</th>
                                    <th className="p-3 font-semibold text-gray-700">جمع بستانکار</th>
                                    <th className="p-3 font-semibold text-gray-700">مانده</th>
                                    <th className="p-3 font-semibold text-gray-700">وضعیت</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {filteredTraz.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="text-center py-8 text-gray-500">
                                            {isLoading ? 'در حال بارگذاری...' : 'موردی یافت نشد'}
                                        </td>
                                    </tr>
                                ) : (
                                    filteredTraz.map((row, idx) => (
                                        <tr key={idx} className="hover:bg-gray-50">
                                            <td className="p-3 font-mono text-gray-500">{row.code}</td>
                                            <td className="p-3 font-medium">{row.name}</td>
                                            <td className="p-3 text-red-600">{formatMoney(row.bed)}</td>
                                            <td className="p-3 text-green-600">{formatMoney(row.bes)}</td>
                                            <td className="p-3 font-bold">{formatMoney(row.balance)}</td>
                                            <td className="p-3">
                                                <span className={`px-2 py-1 rounded-full text-xs ${
                                                    row.balance > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                                                }`}>
                                                    {formatStatus(row.balance)}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
            
            {activeTab === 'statement' && (
                <div className="bg-white rounded-lg shadow border border-gray-100 p-6">
                    <h2 className="text-xl font-semibold mb-6">صورتحساب ریز تراکنش‌ها</h2>
                    
                    <div className="flex flex-col md:flex-row gap-4 items-end mb-6">
                        <div className="flex-1 w-full relative">
                            <label className="block text-sm font-medium mb-1 text-gray-700">انتخاب مشتری / شخص</label>
                            <select 
                                className="w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                value={selectedTafsili}
                                onChange={(e) => setSelectedTafsili(e.target.value)}
                            >
                                <option value="">-- انتخاب کنید --</option>
                                {tafsilis.map(t => (
                                    <option key={t.Code} value={t.Code}>{t.Name} ({t.Code})</option>
                                ))}
                            </select>
                        </div>
                        <button 
                            onClick={fetchStatement} 
                            disabled={isLoading || !selectedTafsili} 
                            className="w-full md:w-auto px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium flex items-center justify-center disabled:opacity-50"
                        >
                            {isLoading ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
                            مشاهده صورتحساب
                        </button>
                    </div>

                    {statementData.length > 0 && (
                        <div className="rounded-md border border-gray-200 mt-6 max-h-[600px] overflow-auto">
                            <table className="w-full text-right text-sm">
                                <thead className="bg-gray-50 sticky top-0 border-b">
                                    <tr>
                                        <th className="p-3 font-semibold text-gray-700">تاریخ</th>
                                        <th className="p-3 font-semibold text-gray-700">سند</th>
                                        <th className="p-3 font-semibold text-gray-700 w-1/3">شرح</th>
                                        <th className="p-3 font-semibold text-gray-700">بدهکار</th>
                                        <th className="p-3 font-semibold text-gray-700">بستانکار</th>
                                        <th className="p-3 font-semibold text-gray-700">مانده</th>
                                        <th className="p-3 font-semibold text-gray-700">تشخیص</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {statementData.map((row, idx) => (
                                        <tr key={idx} className="hover:bg-gray-50">
                                            <td className="p-3 whitespace-nowrap text-gray-600">{formatDate(row.Date)}</td>
                                            <td className="p-3 font-mono text-gray-500">{row.SanadNo}</td>
                                            <td className="p-3 leading-relaxed">{row.Description}</td>
                                            <td className="p-3 text-red-600">{row.bed > 0 ? formatMoney(row.bed) : '-'}</td>
                                            <td className="p-3 text-green-600">{row.bes > 0 ? formatMoney(row.bes) : '-'}</td>
                                            <td className="p-3 font-bold">{formatMoney(row.balance)}</td>
                                            <td className="p-3 text-xs text-gray-500">{formatStatus(row.balance)}</td>
                                        </tr>
                                    ))}
                                    
                                    {/* Summary Row */}
                                    <tr className="bg-gray-100 font-bold sticky bottom-0 border-t-2 border-gray-300">
                                        <td colSpan={3} className="p-3 text-left">جمع کل:</td>
                                        <td className="p-3 text-red-700">
                                            {formatMoney(statementData.reduce((sum, r) => sum + r.bed, 0))}
                                        </td>
                                        <td className="p-3 text-green-700">
                                            {formatMoney(statementData.reduce((sum, r) => sum + r.bes, 0))}
                                        </td>
                                        <td colSpan={2} className={`p-3 text-right ${
                                            statementData[statementData.length-1].balance > 0 ? 'text-red-700' : 'text-green-700'
                                        }`}>
                                            {formatMoney(statementData[statementData.length-1].balance)} ({formatStatus(statementData[statementData.length-1].balance)})
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

