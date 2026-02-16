import React, { useState, useEffect } from 'react';
import { PaymentOrder, User, OrderStatus, SystemSettings, UserRole } from '../types';
import { updateOrderStatus, deleteOrder } from '../services/storageService';
import { formatCurrency, formatDate, getStatusLabel } from '../constants';
import { Eye, Edit, Trash2, CheckCircle, XCircle, Search, Filter, RefreshCw, Archive, Clock, MoreVertical } from 'lucide-react';
import PrintVoucher from './PrintVoucher';
import EditOrderModal from './EditOrderModal';
import MobileOrderCard from './mobile/MobileOrderCard';
import useIsMobile from '../hooks/useIsMobile';

interface ManageOrdersProps {
  orders: PaymentOrder[];
  refreshData: () => void;
  currentUser: User;
  initialTab?: 'current' | 'archive';
  settings?: SystemSettings;
  statusFilter?: any;
}

const ManageOrders: React.FC<ManageOrdersProps> = ({ orders, refreshData, currentUser, initialTab = 'current', settings, statusFilter }) => {
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState<'current' | 'archive'>(initialTab);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewOrder, setViewOrder] = useState<PaymentOrder | null>(null);
  const [editOrder, setEditOrder] = useState<PaymentOrder | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  useEffect(() => {
    if (statusFilter) {
       // Apply external filter logic if needed, usually passed from Dashboard
       // For now, simpler implementation
    }
  }, [statusFilter]);

  useEffect(() => {
      const handlePopState = (event: PopStateEvent) => {
          if (viewOrder) {
              setViewOrder(null);
          }
      };
      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
  }, [viewOrder]);

  const openOrderView = (order: PaymentOrder) => {
      if (isMobile) {
          if (window.location.protocol !== 'blob:') {
              window.history.pushState({ view: 'order_detail', orderId: order.id }, '', '#manage/view');
          } else {
              window.history.pushState({ view: 'order_detail' }, '');
          }
      }
      setViewOrder(order);
  };

  const closeOrderView = () => {
      if (isMobile && viewOrder) {
          window.history.back(); 
      } else {
          setViewOrder(null);
      }
  };

  const handleDelete = async (id: string) => {
      if (confirm('آیا از حذف این دستور پرداخت اطمینان دارید؟')) {
          await deleteOrder(id);
          refreshData();
      }
  };

  const handleApprove = async (order: PaymentOrder) => {
      if (!confirm('آیا تایید می‌کنید؟')) return;
      
      let nextStatus = OrderStatus.PENDING;
      if (order.status === OrderStatus.PENDING) nextStatus = OrderStatus.APPROVED_FINANCE;
      else if (order.status === OrderStatus.APPROVED_FINANCE) nextStatus = OrderStatus.APPROVED_MANAGER;
      else if (order.status === OrderStatus.APPROVED_MANAGER) nextStatus = OrderStatus.APPROVED_CEO;
      
      await updateOrderStatus(order.id, nextStatus, currentUser);
      refreshData();
      if (viewOrder) closeOrderView();
  };

  const handleReject = async (order: PaymentOrder) => {
      const reason = prompt('دلیل رد درخواست:');
      if (!reason) return;
      await updateOrderStatus(order.id, OrderStatus.REJECTED, currentUser, reason);
      refreshData();
      if (viewOrder) closeOrderView();
  };

  const filteredOrders = orders.filter(order => {
      const isArchived = order.status === OrderStatus.APPROVED_CEO || order.status === OrderStatus.REJECTED || order.status === OrderStatus.REVOKED;
      if (activeTab === 'current' && isArchived) return false;
      if (activeTab === 'archive' && !isArchived) return false;

      if (searchTerm) {
          const search = searchTerm.toLowerCase();
          const match = order.payee.toLowerCase().includes(search) || 
                        order.description?.toLowerCase().includes(search) ||
                        order.trackingNumber.toString().includes(search) ||
                        order.totalAmount.toString().includes(search);
          if (!match) return false;
      }

      if (filterStatus !== 'ALL') {
          if (order.status !== filterStatus) return false;
      }

      return true;
  }).sort((a, b) => b.createdAt - a.createdAt);

  const canEdit = (order: PaymentOrder) => {
      if (currentUser.role === UserRole.ADMIN) return true;
      if (currentUser.role === UserRole.USER && order.requester === currentUser.fullName && order.status === OrderStatus.PENDING) return true;
      if (order.status === OrderStatus.REJECTED && order.requester === currentUser.fullName) return true;
      return false;
  };

  const canApprove = (order: PaymentOrder) => {
      if (order.status === OrderStatus.APPROVED_CEO || order.status === OrderStatus.REJECTED) return false;
      if (currentUser.role === UserRole.ADMIN) return true;
      if (currentUser.role === UserRole.FINANCIAL && order.status === OrderStatus.PENDING) return true;
      if (currentUser.role === UserRole.MANAGER && order.status === OrderStatus.APPROVED_FINANCE) return true;
      if (currentUser.role === UserRole.CEO && order.status === OrderStatus.APPROVED_MANAGER) return true;
      return false;
  };

  return (
    <div className="space-y-4 animate-fade-in">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-200">
            <div className="flex bg-gray-100 p-1 rounded-xl w-full md:w-auto">
                <button onClick={() => setActiveTab('current')} className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'current' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}>جاری</button>
                <button onClick={() => setActiveTab('archive')} className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'archive' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}>بایگانی</button>
            </div>
            <div className="flex gap-2 w-full md:w-auto">
                <div className="relative flex-1 md:w-64">
                    <input className="w-full border rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100" placeholder="جستجو (نام، شماره، مبلغ)..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                </div>
                <button onClick={refreshData} className="bg-gray-100 p-2 rounded-xl text-gray-600 hover:bg-gray-200"><RefreshCw size={20} /></button>
            </div>
        </div>

        {isMobile ? (
            <div className="space-y-3">
                {filteredOrders.map(order => (
                    <MobileOrderCard 
                        key={order.id} 
                        order={order} 
                        onView={openOrderView}
                        onDelete={canEdit(order) ? handleDelete : undefined}
                        canDelete={canEdit(order)}
                    />
                ))}
                {filteredOrders.length === 0 && <div className="text-center text-gray-400 py-10">موردی یافت نشد.</div>}
            </div>
        ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="w-full text-sm text-right">
                    <thead className="bg-gray-50 text-gray-600 border-b border-gray-100">
                        <tr>
                            <th className="p-4">شماره</th>
                            <th className="p-4">ذینفع</th>
                            <th className="p-4">مبلغ (ریال)</th>
                            <th className="p-4">تاریخ</th>
                            <th className="p-4">وضعیت</th>
                            <th className="p-4">درخواست کننده</th>
                            <th className="p-4 text-center">عملیات</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {filteredOrders.map(order => (
                            <tr key={order.id} className="hover:bg-gray-50/50 transition-colors">
                                <td className="p-4 font-mono font-bold text-gray-700">{order.trackingNumber}</td>
                                <td className="p-4 font-bold text-gray-800">{order.payee}</td>
                                <td className="p-4 font-mono text-blue-600 dir-ltr text-right">{formatCurrency(order.totalAmount).replace('ریال','')}</td>
                                <td className="p-4 text-gray-500">{formatDate(order.date)}</td>
                                <td className="p-4">
                                    <span className={`px-2 py-1 rounded text-xs border ${order.status === OrderStatus.APPROVED_CEO ? 'bg-green-50 text-green-700 border-green-100' : order.status === OrderStatus.REJECTED ? 'bg-red-50 text-red-700 border-red-100' : 'bg-blue-50 text-blue-700 border-blue-100'}`}>
                                        {getStatusLabel(order.status)}
                                    </span>
                                </td>
                                <td className="p-4 text-gray-500">{order.requester}</td>
                                <td className="p-4">
                                    <div className="flex justify-center gap-1">
                                        <button onClick={() => openOrderView(order)} className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="مشاهده"><Eye size={18} /></button>
                                        {canEdit(order) && <button onClick={() => setEditOrder(order)} className="p-1.5 text-gray-500 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors" title="ویرایش"><Edit size={18} /></button>}
                                        {canEdit(order) && <button onClick={() => handleDelete(order.id)} className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="حذف"><Trash2 size={18} /></button>}
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {filteredOrders.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-gray-400">موردی یافت نشد.</td></tr>}
                    </tbody>
                </table>
            </div>
        )}

        {viewOrder && (
            <div className={isMobile ? "fixed inset-0 z-[100] bg-white overflow-y-auto" : ""}>
                <PrintVoucher 
                    order={viewOrder} 
                    onClose={closeOrderView} 
                    settings={settings}
                    onApprove={canApprove(viewOrder) ? () => handleApprove(viewOrder) : undefined}
                    onReject={canApprove(viewOrder) ? () => handleReject(viewOrder) : undefined}
                    onEdit={canEdit(viewOrder) ? () => { setEditOrder(viewOrder); closeOrderView(); } : undefined}
                />
            </div>
        )}

        {editOrder && (
            <EditOrderModal 
                order={editOrder} 
                onClose={() => setEditOrder(null)} 
                onSave={() => { setEditOrder(null); refreshData(); }} 
            />
        )}
    </div>
  );
};

export default ManageOrders;