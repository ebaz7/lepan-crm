
import React, { useState, useMemo, useEffect } from 'react';
import { PaymentOrder, OrderStatus, SystemSettings, User, ExitPermit, ExitPermitStatus, WarehouseTransaction, UserRole } from '../types';
import { formatCurrency, getShamsiDateFromIso } from '../constants';
import { PieChart as RechartsPieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { TrendingUp, Clock, CheckCircle, Activity, XCircle, Banknote, Calendar as CalendarIcon, ShieldCheck, ArrowUpRight, CheckSquare, Truck, Package, ListChecks, PieChart, BarChart, BookOpen, PenTool, Edit3 } from 'lucide-react';
import { getRolePermissions } from '../services/authService';
import { getExitPermits, getWarehouseTransactions, getNotes } from '../services/storageService';
import { isInFinancialYear } from '../utils/dateUtils';
import { getRandomQuote } from '../utils/quotes';
import { Note } from '../types';

interface DashboardProps {
  orders: PaymentOrder[];
  settings?: SystemSettings;
  currentUser: User;
  onViewArchive?: () => void;
  onFilterByStatus?: (status: OrderStatus | 'pending_all') => void;
  onGoToPaymentApprovals: () => void;
  onGoToExitApprovals: () => void;
  onGoToBijakApprovals: () => void;
  financialYear?: string;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];
const MONTHS = [ 'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند' ];

const Dashboard: React.FC<DashboardProps> = ({ orders: rawOrders, settings, currentUser, onViewArchive, onFilterByStatus, onGoToPaymentApprovals, onGoToExitApprovals, onGoToBijakApprovals, financialYear }) => {
  const orders = useMemo(() => {
        if (!financialYear || financialYear === 'all') return rawOrders;
        return rawOrders.filter(o => isInFinancialYear(o.date, financialYear) || isInFinancialYear(o.payDate, financialYear));
  }, [rawOrders, financialYear]);

  const [showBankReport, setShowBankReport] = useState(false);
  const [bankReportTab, setBankReportTab] = useState<'summary' | 'timeline'>('summary');
  
  // Data for additional counts
  const [exitPermits, setExitPermits] = useState<ExitPermit[]>([]);
  const [warehouseTxs, setWarehouseTxs] = useState<WarehouseTransaction[]>([]);

  // Personal Notes State
  const [notes, setNotes] = useState<Note[]>([]);
  
  useEffect(() => {
    if (currentUser?.id) {
        getNotes().then(allNotes => {
            setNotes(allNotes.filter(n => n.userId === currentUser.id));
        }).catch(e => console.error("Load dashboard notes error", e));
    }
  }, [currentUser]);

  const dailyQuote = useMemo(() => getRandomQuote(), []);
    const shamsiDate = useMemo(() => {
        const parts = new Intl.DateTimeFormat('fa-IR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date()).split(' ');
        return { 
            weekday: parts[0], 
            day: parts[1], 
            month: parts[2], 
            year: new Intl.DateTimeFormat('fa-IR', { year: 'numeric' }).format(new Date()),
            full: new Intl.DateTimeFormat('fa-IR', { dateStyle: 'full' }).format(new Date())
        };
    }, []);

    // Market Prices (Simulated for Now, can be connected to real API)
    const [prices, setPrices] = useState({
        usd: '۶۲,۵۰۰',
        eur: '۶۷,۸۰۰',
        gold: '۳,۳۸۰,۰۰۰',
        updated: '۱۴:۲۰'
    });

    useEffect(() => {
        // Here we could fetch real prices from an API like bonbast or similar
        const fetchPrices = () => {
             // In a real app: fetch('...').then(res => res.json()).then(setPrices)
        };
        fetchPrices();
    }, []);

    // ... (rest of logic) ...

  // Permission Check
  const permissions = settings ? getRolePermissions(currentUser.role, settings, currentUser) : { canViewPaymentOrders: false };
  const hasPaymentAccess = permissions.canViewPaymentOrders === true;
  const hasExitAccess = permissions.canViewExitPermits === true;
  const hasWarehouseAccess = permissions.canManageWarehouse === true || permissions.canApproveBijak === true;

  useEffect(() => {
      const fetchData = async () => {
          try {
              // Only fetch if has access to avoid unnecessary calls (though data might be preloaded in App.tsx)
              if (hasExitAccess || hasWarehouseAccess) {
                  let [exits, txs] = await Promise.all([getExitPermits(), getWarehouseTransactions()]);
                  if (financialYear && financialYear !== 'all') {
                      exits = exits.filter(e => isInFinancialYear(e.date, financialYear));
                      txs = txs.filter(t => isInFinancialYear(t.date, financialYear));
                  }
                  setExitPermits(exits || []);
                  setWarehouseTxs(txs || []);
              }
          } catch (error) {
              console.error("Dashboard data load error", error);
              setExitPermits([]);
              setWarehouseTxs([]);
          }
      };
      fetchData();
  }, [hasExitAccess, hasWarehouseAccess, financialYear]);


  // --- CALC PENDING COUNTS FOR ACTION CARDS ---
  
  // 1. Payment Pending Count (Based on user role)
  let pendingPaymentCount = 0;
  if (hasPaymentAccess) {
      if (currentUser.role === UserRole.FINANCIAL || currentUser.role === UserRole.ADMIN || permissions.canApproveFinancial) {
          pendingPaymentCount += orders.filter(o => o.status === OrderStatus.PENDING || o.status === OrderStatus.REVOCATION_PENDING_FINANCE).length;
      }
      if (currentUser.role === UserRole.MANAGER || currentUser.role === UserRole.ADMIN || permissions.canApproveManager) {
          pendingPaymentCount += orders.filter(o => o.status === OrderStatus.APPROVED_FINANCE || o.status === OrderStatus.REVOCATION_PENDING_MANAGER).length;
      }
      if (currentUser.role === UserRole.CEO || currentUser.role === UserRole.ADMIN || permissions.canApproveCeo) {
          pendingPaymentCount += orders.filter(o => o.status === OrderStatus.APPROVED_MANAGER || o.status === OrderStatus.REVOCATION_PENDING_CEO).length;
      }
  }

  // 2. Exit Pending Count
  let pendingExitCount = 0;
  if (hasExitAccess) {
      if (currentUser.role === UserRole.CEO || currentUser.role === UserRole.ADMIN || permissions.canApproveExitCeo) {
          pendingExitCount += exitPermits.filter(p => p.status === ExitPermitStatus.PENDING_CEO).length;
      }
      if (currentUser.role === UserRole.FACTORY_MANAGER || currentUser.role === UserRole.ADMIN || permissions.canApproveExitFactory) {
          pendingExitCount += exitPermits.filter(p => p.status === ExitPermitStatus.PENDING_FACTORY).length;
      }
      if (currentUser.role === UserRole.WAREHOUSE_KEEPER || currentUser.role === UserRole.ADMIN || permissions.canApproveExitWarehouse) {
          pendingExitCount += exitPermits.filter(p => p.status === ExitPermitStatus.PENDING_WAREHOUSE).length;
      }
      if (currentUser.role === UserRole.SECURITY_HEAD || currentUser.role === UserRole.ADMIN || permissions.canApproveExitSecurity) {
          pendingExitCount += exitPermits.filter(p => p.status === ExitPermitStatus.PENDING_SECURITY).length;
      }
  }

  // 3. Bijak Pending Count
  let pendingBijakCount = 0;
  if (hasWarehouseAccess) {
      if (currentUser.role === UserRole.CEO || currentUser.role === UserRole.ADMIN || permissions.canApproveBijak) {
          pendingBijakCount += warehouseTxs.filter(t => t.type === 'OUT' && t.status === 'PENDING').length;
      }
  }

  const showActionSection = pendingPaymentCount > 0 || pendingExitCount > 0 || pendingBijakCount > 0;

  // ... (Existing Charts logic) ...
  const completedOrders = orders.filter(o => o.status === OrderStatus.APPROVED_CEO || o.status === OrderStatus.REVOKED);
  const totalAmount = completedOrders.reduce((sum, order) => sum + order.totalAmount, 0);
  const countPending = orders.filter(o => o.status === OrderStatus.PENDING).length;
  const countFin = orders.filter(o => o.status === OrderStatus.APPROVED_FINANCE).length;
  const countMgr = orders.filter(o => o.status === OrderStatus.APPROVED_MANAGER).length;
  const countRejected = orders.filter(o => o.status === OrderStatus.REJECTED).length;

  const activeCartable = hasPaymentAccess ? orders
    .filter(o => o.status !== OrderStatus.APPROVED_CEO && o.status !== OrderStatus.REJECTED && o.status !== OrderStatus.REVOKED)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 10) : [];

  const handleWidgetClick = (status: OrderStatus | 'pending_all') => {
      if (hasPaymentAccess && onFilterByStatus) {
          onFilterByStatus(status);
      }
  };

  const statusWidgets = [
    { key: OrderStatus.PENDING, label: 'کارتابل مالی', count: countPending, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100', barColor: 'bg-amber-500' },
    { key: OrderStatus.APPROVED_FINANCE, label: 'کارتابل مدیریت', count: countFin, icon: Activity, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100', barColor: 'bg-blue-500' },
    { key: OrderStatus.APPROVED_MANAGER, label: 'کارتابل مدیرعامل', count: countMgr, icon: ShieldCheck, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-100', barColor: 'bg-indigo-500' },
    { key: OrderStatus.REJECTED, label: 'رد شده', count: countRejected, icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-100', barColor: 'bg-red-500' },
    { key: OrderStatus.APPROVED_CEO, label: 'بایگانی', count: completedOrders.length, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-100', barColor: 'bg-green-500' }
  ];

  const methodDataRaw: Record<string, number> = {};
  orders.forEach(order => { order.paymentDetails.forEach(detail => { methodDataRaw[detail.method] = (methodDataRaw[detail.method] || 0) + detail.amount; }); });
  const methodData = Object.keys(methodDataRaw).map(key => ({ name: key, amount: methodDataRaw[key] }));

  const bankStats = useMemo(() => {
    const stats: Record<string, number> = {};
    completedOrders.forEach(order => { order.paymentDetails.forEach(detail => { if (detail.bankName && detail.bankName.trim() !== '') { const normalizedName = detail.bankName.trim(); stats[normalizedName] = (stats[normalizedName] || 0) + detail.amount; } }); });
    return Object.entries(stats).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [completedOrders]);

  const topBank = bankStats.length > 0 ? bankStats[0] : { name: '-', value: 0 };
  const mostActiveMonth = { label: '-', total: 0 }; // Simplified for now

  return (
    <div className="space-y-6 pb-20 md:pb-0 animate-fade-in">
        
        {/* TOP SECTION: MINIMAL DATE, PRICES & SLICK POETRY */}
        <div className="flex flex-col lg:flex-row gap-4">
            {/* Minimal Date Card - Smaller & Sleek */}
            <div className="bg-white rounded-2xl p-4 border border-indigo-100 shadow-sm flex items-center gap-4 min-w-[220px] shrink-0 relative group overflow-hidden">
                <div className="absolute top-0 right-0 p-1 opacity-10 group-hover:opacity-20 transition-opacity"><CalendarIcon size={40}/></div>
                <div className="bg-indigo-50 p-3 rounded-xl text-indigo-600 flex items-center justify-center relative z-10">
                    <CalendarIcon size={24} />
                </div>
                <div className="flex flex-col relative z-10">
                    <div className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-1">
                        {shamsiDate.weekday}
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse ml-auto" title="همگام‌سازی با گوگل کلندر"></span>
                    </div>
                    <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-black text-gray-800">{shamsiDate.day}</span>
                        <span className="text-sm font-bold text-gray-600">{shamsiDate.month}</span>
                    </div>
                    <div className="text-[9px] text-gray-400 font-bold mt-1 line-clamp-1">{shamsiDate.year} شمسی</div>
                </div>
            </div>

            {/* Market Prices Ticker */}
            <div className="bg-white rounded-2xl p-4 border border-emerald-100 shadow-sm flex items-center gap-6 overflow-x-auto no-scrollbar min-w-[350px]">
                <div className="flex flex-col shrink-0">
                    <div className="text-[10px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-1">
                       <TrendingUp size={10}/> نبض بازار
                    </div>
                    <div className="text-[9px] text-gray-400 font-bold">بروزرسانی: {prices.updated}</div>
                </div>
                
                <div className="flex items-center gap-8">
                    <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-gray-400">دلار (آزاد)</span>
                        <div className="flex items-center gap-1">
                            <span className="text-sm font-black text-gray-800">{prices.usd}</span>
                            <span className="text-[10px] text-gray-400">تومان</span>
                        </div>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-gray-400">یورو</span>
                        <div className="flex items-center gap-1">
                            <span className="text-sm font-black text-gray-800">{prices.eur}</span>
                            <span className="text-[10px] text-gray-400">تومان</span>
                        </div>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-gray-400">طلای ۱۸ عیار</span>
                        <div className="flex items-center gap-1">
                            <span className="text-sm font-black text-gray-800">{prices.gold}</span>
                            <span className="text-[10px] text-gray-400">تومان</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Slick Poetry - Smaller and More Elegant */}
            <div className="flex-1 bg-white rounded-2xl px-6 py-4 border border-rose-50 shadow-sm flex items-center justify-center relative overflow-hidden group min-h-[80px]">
                <div className="absolute right-0 top-0 h-full w-1 bg-rose-200"></div>
                <div className="relative z-10 flex flex-col items-center">
                    <div className="text-[10px] font-bold text-rose-300 mb-1 flex items-center gap-1"><PenTool size={10}/> زمزمه روز</div>
                    <p className="text-gray-700 font-bold text-sm text-center italic leading-relaxed" style={{ whiteSpace: 'pre-line' }}>{dailyQuote.text}</p>
                </div>
            </div>
        </div>

        {/* NOTES PREVIEW SECTION - Google Keep Style Preview */}
        <div className="bg-yellow-50/50 rounded-2xl p-6 border border-yellow-100 shadow-sm">
            <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                    <Edit3 size={20} className="text-yellow-600" />
                    <h3 className="font-black text-gray-800">برنامه یادداشت و تسک</h3>
                </div>
                <button 
                    onClick={() => {
                        window.dispatchEvent(new CustomEvent('CHANGE_TAB', { detail: 'knowledge' }));
                    }}
                    className="text-xs bg-yellow-100 text-yellow-700 px-3 py-1.5 rounded-lg font-black hover:bg-yellow-200 transition-colors shadow-sm border border-yellow-200"
                >
                    بازکردن برنامه اصلی
                </button>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {notes.length === 0 ? (
                    <div className="col-span-full py-8 text-center text-gray-400 text-sm border-2 border-dashed border-yellow-200 rounded-xl">
                        یادداشتی برای نمایش در پیشخوان وجود ندارد.
                    </div>
                ) : (
                    notes.slice(0, 4).map(note => (
                        <div 
                            key={note.id} 
                            onClick={() => window.dispatchEvent(new CustomEvent('CHANGE_TAB', { detail: 'knowledge' }))}
                            className={`${note.color || 'bg-white'} p-4 rounded-xl border border-yellow-200 shadow-sm hover:shadow-md transition-all cursor-pointer relative group`}
                        >
                            <h4 className="font-bold text-gray-800 text-sm mb-2 truncate">{note.title || 'بدون عنوان'}</h4>
                            <div className="space-y-2">
                                {note.content && <p className="text-xs text-gray-500 line-clamp-3 leading-relaxed">{note.content}</p>}
                                {note.tasks && note.tasks.length > 0 && (
                                    <div className="space-y-1 my-1">
                                        {note.tasks.slice(0, 3).map(task => (
                                            <div key={task.id} className="flex items-center gap-1.5 text-[10px] text-gray-500">
                                                {task.isCompleted ? <ListChecks size={10} className="text-blue-500"/> : <Clock size={10} className="text-gray-300"/>}
                                                <span className={task.isCompleted ? 'line-through opacity-50' : ''}>{task.text}</span>
                                            </div>
                                        ))}
                                        {note.tasks.length > 3 && <div className="text-[9px] text-gray-400">...</div>}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>

        {/* ACTIONABLE CARTABLE SECTION */}
        {showActionSection && (
            <div className="mb-8">
                <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2"><ListChecks className="text-blue-600"/> کارتابل و وظایف من</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {pendingPaymentCount > 0 && hasPaymentAccess && (
                        <div onClick={onGoToPaymentApprovals} className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white shadow-lg shadow-blue-200 cursor-pointer transform hover:scale-105 transition-all relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><Banknote size={80}/></div>
                            <div className="relative z-10">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="bg-white/20 p-3 rounded-xl"><CheckSquare size={24} className="text-white"/></div>
                                    <span className="bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full animate-pulse">{pendingPaymentCount} مورد</span>
                                </div>
                                <h3 className="text-2xl font-bold mb-1">تایید دستور پرداخت</h3>
                                <p className="text-blue-100 text-sm opacity-90">درخواست‌های منتظر تایید شما</p>
                            </div>
                        </div>
                    )}

                    {pendingExitCount > 0 && hasExitAccess && (
                        <div onClick={onGoToExitApprovals} className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl p-6 text-white shadow-lg shadow-orange-200 cursor-pointer transform hover:scale-105 transition-all relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><Truck size={80}/></div>
                            <div className="relative z-10">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="bg-white/20 p-3 rounded-xl"><ShieldCheck size={24} className="text-white"/></div>
                                    <span className="bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full animate-pulse">{pendingExitCount} مورد</span>
                                </div>
                                <h3 className="text-2xl font-bold mb-1">تایید مجوز خروج</h3>
                                <p className="text-orange-100 text-sm opacity-90">درخواست‌های خروج بار</p>
                            </div>
                        </div>
                    )}

                    {pendingBijakCount > 0 && hasWarehouseAccess && (
                        <div onClick={onGoToBijakApprovals} className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg shadow-purple-200 cursor-pointer transform hover:scale-105 transition-all relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><Package size={80}/></div>
                            <div className="relative z-10">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="bg-white/20 p-3 rounded-xl"><Activity size={24} className="text-white"/></div>
                                    <span className="bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full animate-pulse">{pendingBijakCount} مورد</span>
                                </div>
                                <h3 className="text-2xl font-bold mb-1">تایید بیجک انبار</h3>
                                <p className="text-purple-100 text-sm opacity-90">حواله‌های صادر شده از انبار</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        )}

        {/* PAYMENT DASHBOARD - ONLY IF ACCESS IS GRANTED */}
        {hasPaymentAccess && (
            <>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    {statusWidgets.map((widget) => (
                        <div key={widget.key} onClick={() => handleWidgetClick(widget.key === OrderStatus.APPROVED_CEO ? 'pending_all' : widget.key as any)} className={`bg-white p-4 rounded-2xl border ${widget.border} shadow-sm transition-all relative overflow-hidden group cursor-pointer hover:shadow-md`}>
                            <div className={`absolute top-0 right-0 w-1.5 h-full ${widget.barColor}`}></div>
                            <div className="flex justify-between items-start mb-2">
                                <div className={`p-2 rounded-xl ${widget.bg} ${widget.color}`}>
                                    <widget.icon size={20} />
                                </div>
                                <span className="text-2xl font-black text-gray-800 font-mono">{widget.count}</span>
                            </div>
                            <h3 className="text-xs font-bold text-gray-500">{widget.label}</h3>
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col">
                        <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2"><PieChart size={20} className="text-blue-500"/> توزیع روش‌های پرداخت</h3>
                        <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <RechartsPieChart>
                                    <Pie data={methodData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="amount">
                                        {methodData.map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}
                                    </Pie>
                                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                                    <Legend />
                                </RechartsPieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-gray-800 flex items-center gap-2"><BarChart size={20} className="text-indigo-500"/> پرداخت‌ها بر اساس بانک</h3>
                            <button onClick={() => setShowBankReport(true)} className="text-xs bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg font-bold hover:bg-indigo-100 transition-colors">گزارش کامل</button>
                        </div>
                        <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <RechartsBarChart data={bankStats.slice(0, 5)}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="name" tick={{fontSize: 10}} />
                                    <YAxis tick={{fontSize: 10}} tickFormatter={(value) => `${value/1000000}M`} />
                                    <Tooltip formatter={(value: number) => formatCurrency(value)} cursor={{fill: '#f3f4f6'}} />
                                    <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={40} />
                                </RechartsBarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2"><Activity size={20} className="text-orange-500"/> آخرین فعالیت‌ها (پرداخت)</h3>
                        {onViewArchive && <button onClick={onViewArchive} className="text-xs flex items-center gap-1 text-blue-600 hover:text-blue-700 font-bold bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100">مشاهده آرشیو <ArrowUpRight size={14}/></button>}
                    </div>
                    
                    <div className="divide-y divide-gray-100">
                        {activeCartable.length === 0 ? (
                            <div className="p-8 text-center text-gray-400 text-sm flex flex-col items-center gap-2">
                                <CheckCircle size={32} className="opacity-20"/>
                                موردی وجود ندارد.
                            </div>
                        ) : (
                            activeCartable.map(order => (
                                <div key={order.id} className="p-4 hover:bg-gray-50 transition-colors flex items-center justify-between group">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${order.status === OrderStatus.REJECTED ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                                            {order.trackingNumber % 100}
                                        </div>
                                        <div>
                                            <div className="font-bold text-gray-800 text-sm">{order.payee}</div>
                                            <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-2">
                                                <span>{new Date(order.date).toLocaleDateString('fa-IR')}</span>
                                                <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                                                <span>{order.requester}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-bold text-gray-900 font-mono text-sm">{formatCurrency(order.totalAmount)}</div>
                                        <div className={`text-[10px] mt-1 px-2 py-0.5 rounded inline-block ${order.status === OrderStatus.PENDING ? 'bg-amber-100 text-amber-700' : 'bg-blue-50 text-blue-600'}`}>
                                            {order.status}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </>
        )}

        {/* Bank Report Modal */}
        {showBankReport && hasPaymentAccess && (
            <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 animate-fade-in backdrop-blur-sm">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col overflow-hidden">
                    <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2"><Banknote size={20}/> گزارش تفصیلی بانک‌ها</h3>
                        <button onClick={() => setShowBankReport(false)} className="p-1 hover:bg-gray-200 rounded-full transition-colors"><XCircle size={20} className="text-gray-500"/></button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
                        {bankReportTab === 'summary' ? (
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="bg-white p-4 rounded-xl border border-indigo-100 shadow-sm flex items-center gap-4">
                                        <div className="bg-indigo-100 p-3 rounded-full text-indigo-600"><TrendingUp size={24}/></div>
                                        <div><div className="text-xs text-gray-500 font-bold">پر تراکنش‌ترین بانک</div><div className="text-lg font-black text-gray-800">{topBank.name}</div><div className="text-xs text-indigo-600 font-mono">{formatCurrency(topBank.value)}</div></div>
                                    </div>
                                </div>
                                <div className="bg-white rounded-xl border overflow-hidden">
                                    <table className="w-full text-sm text-right">
                                        <thead className="bg-gray-100 text-gray-600"><tr><th className="p-3">نام بانک</th><th className="p-3">مجموع پرداختی</th><th className="p-3">درصد از کل</th></tr></thead>
                                        <tbody className="divide-y">
                                            {bankStats.map((bank, idx) => (
                                                <tr key={idx} className="hover:bg-gray-50">
                                                    <td className="p-3 font-bold text-gray-800">{bank.name}</td>
                                                    <td className="p-3 font-mono text-gray-600">{formatCurrency(bank.value)}</td>
                                                    <td className="p-3 font-mono text-gray-500 dir-ltr">{((bank.value / totalAmount) * 100).toFixed(1)}%</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ) : (
                            <div>گزارش زمانی (همانند قبل)</div>
                        )}
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default Dashboard;
