const fs = require('fs');
let txt = fs.readFileSync('./components/TradeModule.tsx', 'utf8');

const regex = /const renderTrancheDeliveriesModal = \(\) => \{[\s\S]*?\/\/ Default Dashboard View/;

const correctModalAndEnd = `const renderTrancheDeliveriesModal = () => {
        if (!selectedTrancheForDeliveries) return null;
        const tr = (selectedRecord?.currencyPurchaseData?.tranches || []).find((t) => t.id === selectedTrancheForDeliveries) || 
                   currencyForm.tranches?.find(t => t.id === selectedTrancheForDeliveries);
        if (!tr) return null;
        const deliveries = tr.deliveries || [];
        return (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
                <div className="glass-panel rounded-2xl shadow-xl w-full max-w-4xl bg-white p-6 animate-scale-in max-h-[90vh] overflow-y-auto text-right" dir="rtl">
                    <div className="flex justify-between items-center mb-6 border-b pb-3">
                        <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                            <Coins size={22} className="text-green-600"/>
                            ثبت و مدیریت تحویل‌های پارت
                        </h3>
                        <button onClick={() => setSelectedTrancheForDeliveries(null)} className="p-1 hover:bg-gray-100 rounded-lg"><X size={20} className="text-gray-400 hover:text-red-500" /></button>
                    </div>

                    {/* Tranche Specs Card */}
                    <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 mb-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                        <div><span className="text-gray-500 block">مبلغ کل پارت:</span><span className="font-bold font-mono text-amber-800 text-sm">{formatNumberString(tr.amount)} {tr.currencyType}</span></div>
                        <div><span className="text-gray-500 block">کل هزینه ریالی:</span><span className="font-bold font-mono text-gray-800">{formatNumberString(tr.rialAmount || 0)} ریال</span></div>
                        <div><span className="text-gray-500 block">صرافی/کارگزار:</span><span className="font-bold">{tr.exchangeName || '-'} {tr.brokerName ? \`(\${tr.brokerName})\` : ''}</span></div>
                        <div><span className="text-gray-500 block">تاریخ خرید:</span><span className="font-bold">{tr.date || '-'}</span></div>
                    </div>

                    {/* Add Delivery Form */}
                    <div className="border p-4 rounded-xl mb-6 bg-gray-50 text-right">
                        <h4 className="font-bold text-sm text-gray-700 mb-3 flex items-center gap-1">افزودن تحویل جدید</h4>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-600">مقدار تحویلی *</label>
                                <input 
                                    className="w-full border rounded-lg p-2 text-sm dir-ltr font-bold text-green-700 bg-white" 
                                    value={newDeliveryForm.amount} 
                                    onChange={e => setNewDeliveryForm({...newDeliveryForm, amount: e.target.value})} 
                                    onBlur={e => setNewDeliveryForm({...newDeliveryForm, amount: formatNumberString(deformatNumberString(e.target.value))})}
                                    placeholder="مقدار ارز..." 
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-600">تاریخ تحویل</label>
                                <input 
                                    className="w-full border rounded-lg p-2 text-sm dir-ltr bg-white" 
                                    value={newDeliveryForm.date} 
                                    onChange={e => setNewDeliveryForm({...newDeliveryForm, date: e.target.value})} 
                                    placeholder="۱۴۰۳/۰۱/۰۱" 
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-600 font-sans">تحویل‌گیرنده</label>
                                <input 
                                    className="w-full border rounded-lg p-2 text-sm bg-white" 
                                    value={newDeliveryForm.recipientName} 
                                    onChange={e => setNewDeliveryForm({...newDeliveryForm, recipientName: e.target.value})} 
                                    placeholder="نام شخص..." 
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-600 font-sans">توضیحات</label>
                                <input 
                                    className="w-full border rounded-lg p-2 text-sm bg-white" 
                                    value={newDeliveryForm.description} 
                                    onChange={e => setNewDeliveryForm({...newDeliveryForm, description: e.target.value})} 
                                    placeholder="توضیحات..." 
                                />
                            </div>
                        </div>
                        <button 
                            onClick={handleAddTrancheDelivery} 
                            className="mt-4 w-full bg-green-600 text-white rounded-lg p-2 font-bold hover:bg-green-700 text-sm transition-all flex items-center justify-center gap-1"
                        >
                            <Plus size={16}/> ثبت تحویل
                        </button>
                    </div>

                    {/* Deliveries List */}
                    <h4 className="font-bold text-sm text-gray-700 mb-3">تحویل‌های ثبت شده</h4>
                    {deliveries.length === 0 ? (
                        <div className="text-center py-6 text-xs text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">تحویلی برای این پارت ثبت نشده است.</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs text-right mt-1 border-collapse">
                                <thead className="bg-blue-800 text-white shadow-sm border-b-2 border-slate-200">
                                    <tr>
                                        <th className="p-3 text-center align-middle border border-blue-700">تاریخ</th>
                                        <th className="p-3 text-center align-middle border border-blue-700">مقدار ارز خریداری شده (پارت)</th>
                                        <th className="p-3 text-center align-middle border border-blue-700 bg-blue-700">مقدار تحویلی</th>
                                        <th className="p-3 text-center align-middle border border-blue-700">معادل دلاری خرید ارز</th>
                                        <th className="p-3 text-center align-middle border border-blue-700">معادل دلاری تحویلی</th>
                                        <th className="p-3 text-center align-middle border border-blue-700">تحویل‌گیرنده</th>
                                        <th className="p-3 text-center align-middle border border-blue-700">توضیحات</th>
                                        <th className="p-3 text-center align-middle border border-blue-700">حذف</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {deliveries.map((delivery, dIdx) => (
                                        <tr key={delivery.id} className={\`border-b transition-colors hover:bg-blue-50 \${dIdx % 2 === 0 ? 'bg-slate-50' : 'bg-white'}\`}>
                                            <td className="p-3 font-mono text-center align-middle border border-slate-200">{delivery.date || '-'}</td>
                                            <td className="p-3 font-mono font-bold text-slate-700 text-center align-middle border border-slate-200">{formatNumberString(tr.amount)} <span className="text-[10px] text-slate-500 font-sans">{tr.currencyType}</span></td>
                                            <td className="p-3 font-mono font-bold text-green-700 text-center align-middle border border-slate-200 bg-green-50/50">{formatNumberString(delivery.amount)} <span className="text-[10px] text-green-500 font-sans">{tr.currencyType}</span></td>
                                            <td className="p-3 font-mono font-bold text-blue-700 text-center align-middle border border-slate-200">
                                                {(() => {
                                                    let usdRate = 0;
                                                    const cType = tr.currencyType;
                                                    if (cType === 'EUR') usdRate = 1.08;
                                                    else if (cType === 'AED') usdRate = 0.272;
                                                    else if (cType === 'CNY') usdRate = 0.14;
                                                    else if (cType === 'TRY') usdRate = 0.031;
                                                    else if (cType === 'USD') usdRate = 1;
                                                    return usdRate > 0 ? (tr.amount * usdRate).toLocaleString('en-US', {maximumFractionDigits:2}) + ' $' : '-';
                                                })()}
                                            </td>
                                            <td className="p-3 font-mono font-bold text-blue-700 text-center align-middle border border-slate-200 bg-blue-50/50">
                                                {(() => {
                                                    let usdRate = 0;
                                                    const cType = tr.currencyType;
                                                    if (cType === 'EUR') usdRate = 1.08;
                                                    else if (cType === 'AED') usdRate = 0.272;
                                                    else if (cType === 'CNY') usdRate = 0.14;
                                                    else if (cType === 'TRY') usdRate = 0.031;
                                                    else if (cType === 'USD') usdRate = 1;
                                                    return usdRate > 0 ? (delivery.amount * usdRate).toLocaleString('en-US', {maximumFractionDigits:2}) + ' $' : '-';
                                                })()}
                                            </td>
                                            <td className="p-3 text-center align-middle border border-slate-200 text-slate-700">{delivery.recipientName || '-'}</td>
                                            <td className="p-3 text-slate-500 text-center align-middle border border-slate-200">{delivery.description || '-'}</td>
                                            <td className="p-3 text-center align-middle border border-slate-200">
                                                <button 
                                                    onClick={() => handleRemoveTrancheDelivery(tr.id, delivery.id)} 
                                                    className="text-red-500 hover:text-red-700 transition"
                                                >
                                                    <Trash2 size={16}/>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-slate-100 border-t-2 border-slate-300 font-bold">
                                    <tr>
                                        <td className="p-3 text-center align-middle border border-slate-200">مجموع تحویل‌ها</td>
                                        <td className="p-3 text-center align-middle border border-slate-200 font-mono text-slate-800">{formatNumberString(tr.amount)} {tr.currencyType}</td>
                                        <td className="p-3 text-center align-middle border border-slate-200 font-mono text-green-800 bg-green-100/50">{formatNumberString(deliveries.reduce((sum, d) => sum + d.amount, 0))} {tr.currencyType}</td>
                                        <td colSpan={5} className="border border-slate-200"></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    if (selectedRecord && viewMode === 'details') {
        const CurrentDetailsComponent = tradeFormMap[selectedRecord.commodityGroup] || null;
        return (
            <div className="flex flex-col h-full bg-gray-50/50">
                <div className="p-4 bg-white border-b sticky top-0 z-30 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <button onClick={() => {setSelectedRecord(null); setViewMode('list');}} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all active:scale-95 text-gray-700">
                            <ChevronRight size={18}/>
                        </button>
                        <div className="border-r pr-3">
                            <h2 className="text-xl font-black text-gray-800 flex items-center gap-2">
                                پرونده: {selectedRecord.fileNumber}
                                {selectedRecord.status === 'Completed' && <span className="bg-green-100 text-green-700 text-[10px] px-2 py-0.5 rounded-full font-bold">پایان یافته</span>}
                            </h2>
                            <p className="text-xs text-gray-500 font-medium">{selectedRecord.goodsName} - {selectedRecord.company}</p>
                        </div>
                    </div>
                </div>
                <div className="flex-1 overflow-auto p-4 md:p-6 custom-scrollbar">
                    {CurrentDetailsComponent && <CurrentDetailsComponent record={selectedRecord} onUpdateRecord={updateTradeRecord} />}
                </div>
            </div>
        );
    }

    // Default Dashboard View`;

txt = txt.replace(regex, correctModalAndEnd);
fs.writeFileSync('./components/TradeModule.tsx', txt, 'utf8');
console.log("Restored renderTrancheDeliveriesModal and fixed table!");
