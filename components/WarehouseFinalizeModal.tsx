
import React, { useState } from 'react';
import { ExitPermit, ExitPermitItem } from '../types';
import { Save, X, Package, Calculator, Plus, Trash2 } from 'lucide-react';
import { generateUUID } from '../constants';

interface Props {
  permit: ExitPermit;
  onClose: () => void;
  onConfirm: (updatedItems: ExitPermitItem[], extraData: { driverName?: string, driverPhone?: string, plateNumber?: string }) => void;
}

const WarehouseFinalizeModal: React.FC<Props> = ({ permit, onClose, onConfirm }) => {
  const [items, setItems] = useState<ExitPermitItem[]>(
    permit.items && permit.items.length > 0 
      ? permit.items.map(i => ({
          ...i,
          deliveredCartonCount: i.deliveredCartonCount ?? i.cartonCount,
          deliveredWeight: i.deliveredWeight ?? i.weight
        })) 
      : [{ id: generateUUID(), goodsName: permit.goodsName || '', cartonCount: permit.cartonCount || 0, weight: permit.weight || 0, deliveredCartonCount: permit.cartonCount || 0, deliveredWeight: permit.weight || 0 }]
  );

  const [driverName, setDriverName] = useState(permit.driverName || '');
  const [driverPhone, setDriverPhone] = useState(permit.driverPhone || '');
  
  // Plate parts: [12] [الف] [123] [11]
  const initialPlate = permit.plateNumber || '';
  const plateMatch = initialPlate.match(/^(\d{2})([آابپتثجچحخدذرزژسشصضطظعغفقکگلمنوهی])(\d{3})(\d{2})$/);
  
  const [plate1, setPlate1] = useState(plateMatch ? plateMatch[1] : '');
  const [plateChar, setPlateChar] = useState(plateMatch ? plateMatch[2] : '');
  const [plate2, setPlate2] = useState(plateMatch ? plateMatch[3] : '');
  const [plateCity, setPlateCity] = useState(plateMatch ? plateMatch[4] : '');

  const plateChars = ['الف', 'ب', 'ت', 'ج', 'د', 'س', 'ص', 'ط', 'ع', 'ق', 'ل', 'م', 'ن', 'و', 'ه', 'ی', 'ژ', 'ت'];

  const handleUpdateItem = (index: number, field: keyof ExitPermitItem, value: string | number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleAddItem = () => {
    setItems([...items, { id: generateUUID(), goodsName: '', cartonCount: 0, weight: 0, deliveredCartonCount: 0, deliveredWeight: 0 }]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length === 1) return alert("حداقل یک ردیف کالا باید وجود داشته باشد.");
    const newItems = [...items];
    newItems.splice(index, 1);
    setItems(newItems);
  };

  const totalRequestedCount = items.reduce((sum, i) => sum + (Number(i.cartonCount) || 0), 0);
  const totalDeliveredCount = items.reduce((sum, i) => sum + (Number(i.deliveredCartonCount) || 0), 0);
  const totalRequestedWeight = items.reduce((sum, i) => sum + (Number(i.weight) || 0), 0);
  const totalDeliveredWeight = items.reduce((sum, i) => sum + (Number(i.deliveredWeight) || 0), 0);

  const handleSave = () => {
    if (items.some(i => !i.goodsName)) return alert("نام کالا نمی‌تواند خالی باشد.");
    const finalizedItems = items.map(i => ({
        ...i,
        cartonCount: Number(i.cartonCount), 
        weight: Number(i.weight),
        deliveredCartonCount: Number(i.deliveredCartonCount),
        deliveredWeight: Number(i.deliveredWeight)
    }));

    const finalPlate = (plate1 && plateChar && plate2 && plateCity) 
        ? `${plate1}${plateChar}${plate2}${plateCity}` 
        : (permit.plateNumber || '');

    onConfirm(finalizedItems, { 
        driverName, 
        driverPhone, 
        plateNumber: finalPlate 
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4 animate-fade-in">
      <div className="glass-panel rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="bg-orange-50 p-4 border-b border-orange-100 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-orange-100 p-2 rounded-lg text-orange-600"><Package size={24} /></div>
            <div><h3 className="font-bold text-lg text-gray-800">تایید نهایی انبار (توزین خروج)</h3><p className="text-xs text-gray-500">لطفاً مقدار دقیق خروجی را وارد کنید.</p></div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-red-500 transition-colors"><X size={24} /></button>
        </div>

        <div className="p-4 md:p-6 overflow-y-auto bg-gray-50 dark:bg-gray-900/40 text-gray-800 dark:text-gray-200 flex-1 min-h-0">
          <div className="glass-panel rounded-xl border border-gray-200/50 dark:border-white/10 shadow-sm overflow-x-auto w-full max-w-full block mb-6" style={{ WebkitOverflowScrolling: 'touch' }}>
            <table className="w-full min-w-[700px] text-sm text-center">
              <thead className="bg-gray-100 dark:bg-gray-800/40 text-gray-800 dark:text-gray-200 text-gray-700 font-bold whitespace-nowrap">
                <tr><th className="p-3 w-10">#</th><th className="p-3 text-right">شرح کالا</th><th className="p-3 w-24 bg-blue-50 text-blue-800 border-l border-white">عدد/کارتن (درخواست)</th><th className="p-3 w-24 bg-green-50 text-green-800">کارتن خروجی</th><th className="p-3 w-24 bg-blue-50 text-blue-800 border-l border-white">وزن درخواستی</th><th className="p-3 w-24 bg-green-50 text-green-800">وزن خروجی</th><th className="p-3 w-10"></th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item, idx) => (
                  <tr key={item.id || idx} className="hover:bg-blue-50/30 transition-colors">
                    <td className="p-3 text-gray-500 font-mono">{idx + 1}</td>
                    <td className="p-3"><input className="w-full border rounded-lg p-2 text-sm font-bold" value={item.goodsName} onChange={e => handleUpdateItem(idx, 'goodsName', e.target.value)} placeholder="نام کالا"/></td>
                    <td className="p-3 bg-blue-50/30 font-mono text-gray-500 border-l border-gray-100">{item.cartonCount}</td>
                    <td className="p-3 bg-green-50/30"><input type="number" className="w-full border rounded-lg p-2 text-center font-mono font-bold text-green-700 outline-none glass-panel" value={item.deliveredCartonCount} onChange={e => handleUpdateItem(idx, 'deliveredCartonCount', Number(e.target.value))}/></td>
                    <td className="p-3 bg-blue-50/30 font-mono text-gray-500 border-l border-gray-100">{item.weight}</td>
                    <td className="p-3 bg-green-50/30"><input type="number" className="w-full border rounded-lg p-2 text-center font-mono font-bold text-green-700 outline-none glass-panel" value={item.deliveredWeight} onChange={e => handleUpdateItem(idx, 'deliveredWeight', Number(e.target.value))}/></td>
                    <td className="p-3 text-center"><button onClick={() => handleRemoveItem(idx)} className="text-gray-400 hover:text-red-500 p-1"><Trash2 size={18}/></button></td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t border-gray-200">
                <tr>
                  <td colSpan={2} className="p-3 text-left pl-6 font-bold text-gray-600 flex items-center justify-between"><button onClick={handleAddItem} className="text-xs bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-blue-100 font-bold border border-blue-200"><Plus size={14}/> افزودن کالا</button><span className="flex items-center gap-2"><Calculator size={16}/> جمع کل:</span></td>
                  <td className="p-3 font-bold text-gray-500 font-mono text-lg bg-blue-50/30 border-l border-gray-200">{totalRequestedCount}</td>
                  <td className="p-3 font-black text-green-700 font-mono text-lg bg-green-50/30 border-l border-gray-200">{totalDeliveredCount}</td>
                  <td className="p-3 font-bold text-gray-500 font-mono text-lg bg-blue-50/30 border-l border-gray-200">{totalRequestedWeight}</td>
                  <td className="p-3 font-black text-green-700 font-mono text-lg bg-green-50/30">{totalDeliveredWeight}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-4 p-4 glass-panel rounded-2xl border-orange-100 border">
             <div className="space-y-4">
                <h4 className="font-bold text-orange-800 text-sm flex items-center gap-2 border-b border-orange-100 pb-2 mb-4">اطلاعات راننده</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 block mb-1">نام راننده (اختیاری)</label>
                    <input className="w-full border rounded-lg p-2 text-sm" value={driverName} onChange={e => setDriverName(e.target.value)} placeholder="مثلا: علی محمدی" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 block mb-1">شماره تماس (اختیاری)</label>
                    <input className="w-full border rounded-lg p-2 text-sm font-mono" dir="ltr" value={driverPhone} onChange={e => setDriverPhone(e.target.value)} placeholder="0912..." />
                  </div>
                </div>
             </div>

             <div className="space-y-4">
                <h4 className="font-bold text-orange-800 text-sm flex items-center gap-2 border-b border-orange-100 pb-2 mb-2">اطلاعات خودرو</h4>
                <label className="text-[10px] font-bold text-gray-500 block">پلاک خودرو (ملی ایران)</label>
                
                <div className="flex items-center justify-center pt-2">
                    {/* Visual Iran Plate Input */}
                    <div className="flex items-center bg-white border-2 border-gray-800 rounded-md overflow-hidden h-14 font-black shadow-md ring-offset-2 ring-1 ring-gray-100" dir="ltr">
                        {/* Blue Part */}
                        <div className="bg-[#1E4198] w-6 h-full flex flex-col items-center justify-center text-white py-1 relative">
                            <div className="flex flex-col items-center gap-0.5">
                                <div className="flex gap-[1px]">
                                    <div className="w-1.5 h-1 bg-green-500"></div>
                                    <div className="w-1.5 h-1 bg-white"></div>
                                    <div className="w-1.5 h-1 bg-red-500"></div>
                                </div>
                                <span className="text-[6px] font-bold leading-none">I.R.</span>
                                <span className="text-[6px] font-bold leading-none">IRAN</span>
                            </div>
                        </div>

                        {/* Two Digits */}
                        <div className="w-12 h-full flex items-center justify-center">
                            <input 
                                className="w-full h-full text-center text-2xl outline-none focus:bg-blue-50/50" 
                                value={plate1} 
                                onChange={e => setPlate1(e.target.value.slice(0,2).replace(/\D/g,''))}
                                placeholder="--"
                                maxLength={2}
                            />
                        </div>

                        {/* Letter */}
                        <div className="w-12 h-full flex items-center justify-center border-x border-gray-200">
                           <select 
                             className="w-full h-full text-center text-xl bg-transparent outline-none appearance-none"
                             value={plateChar}
                             onChange={e => setPlateChar(e.target.value)}
                           >
                             <option value=""></option>
                             {plateChars.map(c => <option key={c} value={c}>{c}</option>)}
                           </select>
                        </div>

                        {/* Three Digits */}
                        <div className="w-16 h-full flex items-center justify-center">
                            <input 
                                className="w-full h-full text-center text-2xl outline-none focus:bg-blue-50/50" 
                                value={plate2} 
                                onChange={e => setPlate2(e.target.value.slice(0,3).replace(/\D/g,''))}
                                placeholder="---"
                                maxLength={3}
                            />
                        </div>

                        {/* City Code (Last Two Digits) */}
                        <div className="w-12 h-full flex flex-col border-l-2 border-gray-800 bg-gray-50/30">
                            <div className="h-4 flex items-center justify-center text-[7px] border-b border-gray-300 font-bold text-gray-400">IRAN</div>
                            <input 
                                className="w-full flex-1 h-full text-center text-xl outline-none bg-transparent" 
                                value={plateCity} 
                                onChange={e => setPlateCity(e.target.value.slice(0,2).replace(/\D/g,''))}
                                placeholder="--"
                                maxLength={2}
                            />
                        </div>
                    </div>
                </div>
             </div>
          </div>
        </div>
        <div className="p-4 border-t glass-panel flex justify-end gap-3">
          <button onClick={onClose} className="px-6 py-2 rounded-xl border border-gray-300 text-gray-700 font-bold hover:bg-gray-50">انصراف</button>
          <button onClick={handleSave} className="px-6 py-2 rounded-xl bg-orange-600 text-white font-bold hover:bg-orange-700 shadow-lg flex items-center gap-2">
            <Save size={18} /> تایید نهایی و ارسال به انتظامات
          </button>
        </div>
      </div>
    </div>
  );
};
export default WarehouseFinalizeModal;
