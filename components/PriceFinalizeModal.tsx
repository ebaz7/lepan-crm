
import React, { useState } from 'react';
import { ExitPermit, ExitPermitItem } from '../types';
import { Save, X, DollarSign, Calculator } from 'lucide-react';

interface Props {
  permit: ExitPermit;
  onClose: () => void;
  onConfirm: (updatedItems: ExitPermitItem[], totalInvoicePrice: number) => void;
}

const PriceFinalizeModal: React.FC<Props> = ({ permit, onClose, onConfirm }) => {
  const [items, setItems] = useState<ExitPermitItem[]>(
    permit.items.map(i => ({
      ...i,
      price: i.price || 0
    }))
  );

  const handleUpdatePrice = (index: number, value: number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], price: value };
    setItems(newItems);
  };

  const totalWeight = items.reduce((sum, i) => sum + (Number(i.deliveredWeight) || 0), 0);
  const totalInvoicePrice = items.reduce((sum, i) => {
      const weight = Number(i.deliveredWeight) || 0;
      const price = Number(i.price) || 0;
      return sum + (weight * price);
  }, 0);

  const handleSave = () => {
    if (items.some(i => !i.price || i.price <= 0)) {
        if (!confirm("برخی از اقلام قیمت ندارند. آیا ادامه می‌دهید؟")) return;
    }
    
    onConfirm(items, totalInvoicePrice);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4 animate-fade-in">
      <div className="glass-panel rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="bg-blue-50 p-4 border-b border-blue-100 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 p-2 rounded-lg text-blue-600"><DollarSign size={24} /></div>
            <div>
              <h3 className="font-bold text-lg text-gray-800">ثبت فی و صدور پیش‌فاکتور</h3>
              <p className="text-xs text-gray-500">قیمت واحد برای هر کیلوگرم کالا را وارد کنید.</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-red-500 transition-colors"><X size={24} /></button>
        </div>

        <div className="p-4 md:p-6 overflow-y-auto bg-gray-50 dark:bg-gray-900/40 text-gray-800 dark:text-gray-200 flex-1 min-h-0">
          <div className="glass-panel rounded-xl border border-gray-200/50 dark:border-white/10 shadow-sm overflow-hidden mb-6">
            <table className="w-full text-sm text-center">
              <thead className="bg-gray-100 dark:bg-gray-800/40 text-gray-700 font-bold">
                <tr>
                  <th className="p-3 w-10">#</th>
                  <th className="p-3 text-right">شرح کالا</th>
                  <th className="p-3 w-32">وزن نهایی (KG)</th>
                  <th className="p-3 w-40 bg-blue-50 text-blue-800">قیمت واحد (ریال)</th>
                  <th className="p-3 w-40">جمع کل (ریال)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-blue-50/10 transition-colors">
                    <td className="p-3 text-gray-500 font-mono">{idx + 1}</td>
                    <td className="p-3 text-right font-bold">{item.goodsName}</td>
                    <td className="p-3 font-mono font-bold text-green-700">{item.deliveredWeight || 0}</td>
                    <td className="p-3 bg-blue-50/20">
                      <input 
                        type="number" 
                        className="w-full border rounded-lg p-2 text-center font-mono font-bold text-blue-700 outline-none glass-panel" 
                        value={item.price || ''} 
                        onChange={e => handleUpdatePrice(idx, Number(e.target.value))}
                        onFocus={e => e.target.select()}
                        placeholder="0"
                      />
                    </td>
                    <td className="p-3 font-mono font-bold text-gray-700">
                      {((item.deliveredWeight || 0) * (item.price || 0)).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t border-gray-200">
                <tr>
                  <td colSpan={2} className="p-3 text-left pl-6 font-bold text-gray-600">
                    <div className="flex items-center justify-end gap-2">
                        <Calculator size={16}/>
                        <span>جمع کل فاکتور:</span>
                    </div>
                  </td>
                  <td className="p-3 font-bold text-green-700 font-mono text-lg">{totalWeight.toLocaleString()}</td>
                  <td className="p-3"></td>
                  <td className="p-3 font-black text-blue-800 font-mono text-lg">{totalInvoicePrice.toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div className="p-4 border-t glass-panel flex justify-end gap-3">
          <button onClick={onClose} className="px-6 py-2 rounded-xl border border-gray-300 text-gray-700 font-bold hover:bg-gray-50">انصراف</button>
          <button onClick={handleSave} className="px-6 py-2 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 shadow-lg flex items-center gap-2">
            <Save size={18} /> تایید و ارسال به انتظامات
          </button>
        </div>
      </div>
    </div>
  );
};

export default PriceFinalizeModal;
