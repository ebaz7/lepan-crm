
import React, { useState } from 'react';
import { ExitPermit, ExitPermitItem } from '../types';
// Add missing Warehouse icon import
import { Save, X, Package, Scale, Calculator, Warehouse } from 'lucide-react';

interface Props {
  permit: ExitPermit;
  onClose: () => void;
  onConfirm: (updatedItems: ExitPermitItem[]) => void;
}

const WarehouseFinalizeModal: React.FC<Props> = ({ permit, onClose, onConfirm }) => {
  const [items, setItems] = useState<ExitPermitItem[]>(
    permit.items.map(i => ({
      ...i,
      deliveredCartonCount: i.deliveredCartonCount ?? i.cartonCount,
      deliveredWeight: i.deliveredWeight ?? i.weight
    }))
  );

  const handleUpdateItem = (index: number, field: keyof ExitPermitItem, value: number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const totalDeliveredCount = items.reduce((sum, i) => sum + (Number(i.deliveredCartonCount) || 0), 0);
  const totalDeliveredWeight = items.reduce((sum, i) => sum + (Number(i.deliveredWeight) || 0), 0);

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[150] flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="bg-orange-50 p-6 border-b border-orange-100 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="bg-orange-200 p-3 rounded-2xl text-orange-700 shadow-inner"><Warehouse size={28} /></div>
            <div>
                <h3 className="font-black text-xl text-gray-800">تایید توزین و تحویل انبار</h3>
                <p className="text-xs text-gray-500 font-bold mt-1">مقدار دقیق خروجی را جهت صدور نهایی وارد کنید.</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-red-500 transition-colors"><X size={28} /></button>
        </div>

        <div className="p-8 overflow-y-auto bg-gray-50/50">
          <div className="space-y-4">
            {items.map((item, idx) => (
              <div key={item.id} className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex flex-col md:flex-row items-center gap-6">
                <div className="flex-1">
                    <span className="text-[10px] font-black text-slate-400 block mb-1">شرح کالا</span>
                    <div className="font-bold text-slate-800">{item.goodsName}</div>
                </div>
                <div className="w-full md:w-32">
                    <label className="text-[10px] font-black text-blue-600 block mb-1">تعداد خروجی</label>
                    <input type="number" className="w-full border-2 border-blue-50 rounded-2xl p-3 text-center font-black text-blue-700 focus:border-blue-400 outline-none" value={item.deliveredCartonCount} onChange={e => handleUpdateItem(idx, 'deliveredCartonCount', +e.target.value)} />
                </div>
                <div className="w-full md:w-40">
                    <label className="text-[10px] font-black text-green-600 block mb-1">وزن نهایی (KG)</label>
                    <input type="number" className="w-full border-2 border-green-50 rounded-2xl p-3 text-center font-black text-green-700 focus:border-green-400 outline-none" value={item.deliveredWeight} onChange={e => handleUpdateItem(idx, 'deliveredWeight', +e.target.value)} />
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-8 bg-slate-900 rounded-[2rem] p-6 text-white flex flex-col md:flex-row justify-around items-center shadow-xl">
              <div className="flex items-center gap-3"><Calculator className="text-blue-400"/> <span className="text-sm font-bold opacity-70">جمع کل تعداد:</span> <span className="text-2xl font-black font-mono">{totalDeliveredCount}</span></div>
              <div className="w-px h-10 bg-white/10 hidden md:block"></div>
              <div className="flex items-center gap-3"><Scale className="text-green-400"/> <span className="text-sm font-bold opacity-70">جمع کل وزن:</span> <span className="text-2xl font-black font-mono">{totalDeliveredWeight} kg</span></div>
          </div>
        </div>

        <div className="p-6 border-t bg-white flex justify-end gap-3">
          <button onClick={onClose} className="px-8 py-3 rounded-2xl border-2 border-gray-100 text-gray-500 font-bold hover:bg-gray-50">انصراف</button>
          <button onClick={() => onConfirm(items)} className="px-10 py-3 rounded-2xl bg-orange-600 text-white font-black hover:bg-orange-700 shadow-xl shadow-orange-200 transition-all flex items-center gap-2">
            <Save size={20} /> تایید و ارسال به انتظامات
          </button>
        </div>
      </div>
    </div>
  );
};
export default WarehouseFinalizeModal;
