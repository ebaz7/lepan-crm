import React, { useState, useEffect } from 'react';
import { Package, Plus, Search, Edit2, Trash2, Tag, DollarSign, Filter, RefreshCw, ShoppingCart, MessageSquare, Check, X } from 'lucide-react';
import { apiCall } from '../services/apiService';
import { formatCurrency, parsePersianDate } from '../constants';

interface Product {
    id: string;
    code: string;
    name: string;
    group: string;
    price: number;
    stock: number;
    unit: string;
}

interface CustomerOrder {
    id: string;
    customerChatId: string;
    text: string;
    status: 'pending' | 'processing' | 'done' | 'rejected';
    date: string;
}

const ProductsModule: React.FC = () => {
    const [products, setProducts] = useState<Product[]>([]);
    const [orders, setOrders] = useState<CustomerOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState<'products' | 'orders'>('products');

    const [showProductModal, setShowProductModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [formData, setFormData] = useState({ code: '', name: '', group: '', price: '', stock: '', unit: '' });
    const [searchQuery, setSearchQuery] = useState('');

    const fetchData = async () => {
        setLoading(true);
        try {
            const [prods, ords] = await Promise.all([
                apiCall<Product[]>('/products'),
                apiCall<CustomerOrder[]>('/customer-orders')
            ]);
            setProducts(prods || []);
            setOrders(ords || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        const payload = {
            code: formData.code,
            name: formData.name,
            group: formData.group,
            price: Number(formData.price) || 0,
            stock: Number(formData.stock) || 0,
            unit: formData.unit || 'عدد'
        };

        try {
            if (editingProduct) {
                await apiCall(`/products/${editingProduct.id}`, 'PUT', payload);
            } else {
                await apiCall('/products', 'POST', payload);
            }
            setShowProductModal(false);
            fetchData();
        } catch (e) {
            console.error(e);
            alert('خطا در ذخیره اطلاعات');
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('آیا از حذف این محصول اطمینان دارید؟')) return;
        try {
            await apiCall(`/products/${id}`, 'DELETE');
            fetchData();
        } catch (e) {
            console.error(e);
        }
    };

    const handleUpdateOrder = async (id: string, status: string) => {
        try {
            await apiCall(`/customer-orders/${id}`, 'PUT', { status });
            fetchData();
        } catch (e) {
            console.error(e);
        }
    };

    const deleteOrder = async (id: string) => {
        if (!window.confirm('آیا از حذف این درخواست اطمینان دارید؟')) return;
        try {
            await apiCall(`/customer-orders/${id}`, 'DELETE');
            fetchData();
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <div className="space-y-6 animate-fade-in" dir="rtl">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <div>
                    <h2 className="text-2xl font-black text-gray-800 flex items-center gap-3">
                        <Package className="text-blue-600 w-8 h-8" />
                        مدیریت بازرگانی و فروش
                    </h2>
                    <p className="text-gray-500 mt-1 text-sm font-medium">مدیریت محصولات، قیمت‌ها و سفارشات مشتریان (ربات)</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={fetchData} className="p-2 border-2 text-gray-600 hover:bg-gray-50 rounded-xl transition-all">
                        <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    {view === 'products' && (
                        <button onClick={() => { setEditingProduct(null); setFormData({ code: '', name: '', group: '', price: '', stock: '' }); setShowProductModal(true); }} 
                                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition-all font-bold shadow-lg shadow-blue-200">
                            <Plus className="w-5 h-5" />
                            تعریف محصول جدید
                        </button>
                    )}
                </div>
            </div>

            <div className="flex gap-4 border-b-2 border-gray-100 pb-2">
                <button onClick={() => setView('products')} className={`flex flex-col items-center gap-1 font-bold pb-2 border-b-4 transition-all px-4 ${view === 'products' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                    <Package className="w-5 h-5" />
                    محصولات ({products.length})
                </button>
                <button onClick={() => setView('orders')} className={`flex flex-col items-center gap-1 font-bold pb-2 border-b-4 transition-all px-4 ${view === 'orders' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                    <ShoppingCart className="w-5 h-5" />
                    سفارشات مشتریان ({orders.length})
                </button>
            </div>

            {view === 'products' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-4 border-b border-gray-100 bg-gray-50 flex flex-col sm:flex-row gap-4 items-center justify-between">
                        <div className="relative w-full sm:w-96">
                            <Search className="w-5 h-5 absolute right-3 top-2.5 text-gray-400" />
                            <input 
                                type="text" 
                                placeholder="جستجو در محصولات..." 
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full pl-4 pr-10 py-2 border-2 border-gray-200 focus:border-blue-500 rounded-xl outline-none transition-all" 
                            />
                        </div>
                        <button 
                            onClick={async () => {
                                if (!confirm("آیا مایلید لیست قیمت برای کاربران ربات پیام‌رسان‌ها ارسال شود؟")) return;
                                try {
                                    let content = "📢 *لیست قیمت محصولات*\n\n";
                                    products.filter(p => Number(p.price) > 0).forEach(p => {
                                        content += `🔹 ${p.name}\n💰 قیمت: ${Number(p.price).toLocaleString()} ریال\n`;
                                    });
                                    const res = await apiCall('/bot/broadcast', 'POST', { message: content });
                                    alert(`ارسال با موفقیت به ${res.count} کاربر انجام شد.`);
                                } catch (e) {
                                    alert("خطا در ارسال پیام");
                                }
                            }}
                            className="bg-green-100 text-green-700 font-bold px-4 py-2 border border-green-200 rounded-xl hover:bg-green-200 flex items-center gap-2"
                        >
                            ارسال لیست قیمت به کاربران بات (تلگرام/بله)
                        </button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-right">
                            <thead className="bg-gray-50 border-b-2 border-gray-200 text-gray-600">
                                <tr>
                                    <th className="p-4 font-bold text-center">کد کالا</th>
                                    <th className="p-4 font-bold">نام کالا</th>
                                    <th className="p-4 font-bold text-center">گروه / دسته</th>
                                    <th className="p-4 font-bold text-center">قیمت فروش (ریال)</th>
                                    <th className="p-4 font-bold text-center">موجودی (واحد)</th>
                                    <th className="p-4 font-bold text-center">عملیات</th>
                                </tr>
                            </thead>
                            <tbody>
                                {products.filter(p => p.name.includes(searchQuery) || p.code.includes(searchQuery) || p.group.includes(searchQuery)).map(p => (
                                    <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                                        <td className="p-4 text-center font-mono text-gray-500">{p.code || '-'}</td>
                                        <td className="p-4 font-bold text-gray-800">{p.name}</td>
                                        <td className="p-4 text-center"><span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-lg text-xs font-bold">{p.group || 'بدون گروه'}</span></td>
                                        <td className="p-4 text-center font-mono font-bold text-green-700 bg-green-50/30">{p.price > 0 ? p.price.toLocaleString() : '-'}</td>
                                        <td className="p-4 text-center">
                                            <span className={`font-mono font-bold px-3 py-1 rounded-lg ${p.stock > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>{p.stock} {p.unit || 'عدد'}</span>
                                        </td>
                                        <td className="p-4 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <button onClick={() => { setEditingProduct(p); setFormData({ code: p.code, name: p.name, group: p.group, price: p.price.toString(), stock: p.stock.toString(), unit: p.unit || 'عدد' }); setShowProductModal(true); }} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Edit2 className="w-4 h-4" /></button>
                                                <button onClick={() => handleDelete(p.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {view === 'orders' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {orders.slice().reverse().map(order => (
                        <div key={order.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200 flex flex-col justify-between">
                            <div>
                                <div className="flex justify-between items-start mb-4">
                                    <span className="text-xs font-mono bg-gray-100 text-gray-600 px-2 py-1 rounded-lg shadow-sm">
                                        {parsePersianDate(order.date)}
                                    </span>
                                    <span className={`text-xs font-bold px-2 py-1 rounded-lg
                                        ${order.status === 'pending' ? 'bg-orange-100 text-orange-700' : 
                                          order.status === 'processing' ? 'bg-blue-100 text-blue-700' : 
                                          order.status === 'done' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                        {order.status === 'pending' ? 'جدید' : order.status === 'processing' ? 'در حال بررسی' : order.status === 'done' ? 'انجام شد' : 'رد شد'}
                                    </span>
                                </div>
                                <div className="bg-gray-50 border-2 border-gray-100 p-4 rounded-xl text-sm leading-relaxed text-gray-700 whitespace-pre-wrap font-medium h-32 overflow-y-auto mb-4">
                                    {order.text}
                                </div>
                                <div className="text-xs text-gray-500 flex items-center gap-1 mb-4">
                                    <MessageSquare className="w-3 h-3" /> آیدی مشتری: {order.customerChatId}
                                </div>
                            </div>
                            
                            <div className="pt-4 border-t-2 border-gray-100 flex flex-wrap gap-2 justify-between">
                                {order.status === 'pending' && <button onClick={() => handleUpdateOrder(order.id, 'processing')} className="flex-1 bg-blue-100 text-blue-700 py-2 rounded-xl text-sm font-bold hover:bg-blue-200 transition-colors">بررسی</button>}
                                {(order.status === 'pending' || order.status === 'processing') && <button onClick={() => handleUpdateOrder(order.id, 'done')} className="flex-1 bg-green-100 text-green-700 py-2 rounded-xl text-sm font-bold hover:bg-green-200 transition-colors flex items-center justify-center gap-1"><Check className="w-4 h-4"/> تایید و انجام</button>}
                                {(order.status === 'pending' || order.status === 'processing') && <button onClick={() => handleUpdateOrder(order.id, 'rejected')} className="flex-1 bg-red-100 text-red-700 py-2 rounded-xl text-sm font-bold hover:bg-red-200 transition-colors flex items-center justify-center gap-1"><X className="w-4 h-4"/> رد</button>}
                                <button onClick={() => deleteOrder(order.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"><Trash2 className="w-5 h-5"/></button>
                            </div>
                        </div>
                    ))}
                    {orders.length === 0 && <div className="col-span-full py-12 text-center text-gray-400 text-sm font-bold bg-white border border-dashed border-gray-200 rounded-xl">هیچ سفارشی یافت نشد.</div>}
                </div>
            )}

            {showProductModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-scale-in">
                        <div className="bg-blue-600 p-4 text-white flex justify-between items-center">
                            <h3 className="font-bold text-lg">{editingProduct ? 'ویرایش محصول' : 'محصول جدید'}</h3>
                            <button onClick={() => setShowProductModal(false)} className="bg-white/20 hover:bg-white/30 rounded-lg p-1 transition-colors"><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">نام کالا *</label>
                                <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-3 bg-gray-50 border-2 border-gray-200 focus:bg-white focus:border-blue-500 rounded-xl outline-none transition-all font-bold" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">کد کالا</label>
                                    <input type="text" value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})} className="w-full p-3 bg-gray-50 border-2 border-gray-200 focus:bg-white focus:border-blue-500 rounded-xl outline-none transition-all text-left font-mono" dir="ltr" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">گروه / دسته</label>
                                    <input type="text" value={formData.group} onChange={e => setFormData({...formData, group: e.target.value})} className="w-full p-3 bg-gray-50 border-2 border-gray-200 focus:bg-white focus:border-blue-500 rounded-xl outline-none transition-all font-bold" />
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">قیمت (ریال)</label>
                                    <input type="number" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} className="w-full p-3 bg-gray-50 border-2 border-gray-200 focus:bg-white focus:border-blue-500 rounded-xl outline-none transition-all font-mono font-bold" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">موجودی</label>
                                    <input type="number" value={formData.stock} onChange={e => setFormData({...formData, stock: e.target.value})} className="w-full p-3 bg-gray-50 border-2 border-gray-200 focus:bg-white focus:border-blue-500 rounded-xl outline-none transition-all font-mono font-bold" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">واحد</label>
                                    <input type="text" value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})} className="w-full p-3 bg-gray-50 border-2 border-gray-200 focus:bg-white focus:border-blue-500 rounded-xl outline-none transition-all font-bold" />
                                </div>
                            </div>
                            
                            <div className="pt-4 flex gap-3">
                                <button type="submit" className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-black text-lg hover:bg-blue-700 transition-all shadow-lg shadow-blue-200">
                                    ذخیره
                                </button>
                                <button type="button" onClick={() => setShowProductModal(false)} className="px-6 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition-all">
                                    انصراف
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProductsModule;
