
import React, { useState } from 'react';
import { ExitPermit, ExitPermitStatus, ExitPermitItem, ExitPermitDestination } from '../types';
import { editExitPermit } from '../services/storageService';
import { generateUUID, getShamsiDateFromIso, jalaliToGregorian, getCurrentShamsiDate } from '../constants';
// Added Edit to the imports from lucide-react
import { Save, X, Package, MapPin, Hash, Plus, Trash2, Truck, Edit } from 'lucide-react';

interface EditExitPermitModalProps {
  permit: ExitPermit;
  onClose: () => void;
  onSave: (updated: ExitPermit) => void;
}

const EditExitPermitModal: React.FC<EditExitPermitModalProps> = ({ permit, onClose, onSave }) => {
  const initialShamsi = getShamsiDateFromIso(permit.date);
  const [shamsiDate, setShamsiDate] = useState({ year: initialShamsi.year, month: initialShamsi.month, day: initialShamsi.day });
  const [items, setItems] = useState<ExitPermitItem[]>(permit.items);
  const [destinations, setDestinations] = useState<ExitPermitDestination[]>(permit.destinations);
  const [driverInfo, setDriverInfo] = useState({ plateNumber: permit.plateNumber || '', driverName: permit.driverName || '', description: permit.description || '' });

  const handleUpdateItem = (id: string, field: keyof ExitPermitItem, value: any) => {
      setItems(items.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  const handleSave = async () => {
      const isoDate = jalaliToGregorian(shamsiDate.year, shamsiDate.month, shamsiDate.day).toISOString().split('T')[0];
      const updated: ExitPermit = {
          ...permit,
          date: isoDate,
          items,
          destinations,
          ...driverInfo,
          status: ExitPermitStatus.PENDING_CEO, // RESET CYCLE
          approverCeo: undefined,
          approverFactory: undefined,
          approverWarehouse: undefined,
          approverSecurity: undefined,
          exitTime: undefined,
          updatedAt: Date.now()
      };
      await editExitPermit(updated);
      onSave(updated);
      onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
        <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-4xl p-8 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6 border-b pb-4">
                {/* Fixed: Edit icon is now correctly imported */}
                <h2 className="text-xl font-black text-gray-800 flex items-center gap-2"><Edit className="text-amber-500"/> اصلاح مجوز خروج #{permit.permitNumber}</h2>
                <button onClick={onClose} className="text-gray-400 hover:text-red-500"><X size={24}/></button>
            </div>
            <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 p-4 rounded-2xl border">
                        <label className="text-xs font-black text-gray-400 block mb-2">نام گیرنده</label>
                        <input className="w-full bg-white border rounded-xl p-2 font-bold" value={destinations[0].recipientName} onChange={e => { const d = [...destinations]; d[0].recipientName = e.target.value; setDestinations(d); }} />
                    </div>
                    <div className="bg-gray-50 p-4 rounded-2xl border">
                        <label className="text-xs font-black text-gray-400 block mb-2">نام راننده</label>
                        <input className="w-full bg-white border rounded-xl p-2 font-bold" value={driverInfo.driverName} onChange={e => setDriverInfo({...driverInfo, driverName: e.target.value})} />
                    </div>
                </div>
                <div className="border rounded-2xl p-4">
                    <h3 className="text-sm font-black mb-3">اقلام کالا</h3>
                    {items.map((item, idx) => (
                        <div key={item.id} className="flex gap-2 mb-2">
                            <input className="flex-1 border rounded-xl p-2 text-sm" value={item.goodsName} onChange={e => handleUpdateItem(item.id, 'goodsName', e.target.value)} />
                            <input type="number" className="w-24 border rounded-xl p-2 text-sm text-center" value={item.cartonCount} onChange={e => handleUpdateItem(item.id, 'cartonCount', +e.target.value)} />
                        </div>
                    ))}
                </div>
                <button onClick={handleSave} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black shadow-xl flex items-center justify-center gap-2">
                    <Save size={20}/> ذخیره تغییرات و بازگشت به مدیرعامل
                </button>
            </div>
        </div>
    </div>
  );
};
export default EditExitPermitModal;
