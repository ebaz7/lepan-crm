const fs = require('fs');
let file = './components/reports/CurrencyReport.tsx';
let txt = fs.readFileSync(file, 'utf8');

// 1. Add description to recordInfo mappings
txt = txt.replace(/goodsName: r\.goodsName,/g, "goodsName: r.goodsName, description: r.description,");
txt = txt.replace(/const groups: any\[\] = \[\];/g, "const groups: { recordInfo: any, tranches: any[] }[] = [];");

// 2. Add onUpdateRecord to Props
if (!txt.includes('onUpdateRecord')) {
    txt = txt.replace(/interface CurrencyReportProps \{[\s\S]*?\}/, "interface CurrencyReportProps {\n    records: TradeRecord[];\n    onSelectTranche?: (recordId: string, trancheId?: string | null) => void;\n    onUpdateRecord?: (record: TradeRecord) => void;\n}");
}

// Extract props
txt = txt.replace(/const CurrencyReport: React\.FC<CurrencyReportProps> = \(\{ records, onSelectTranche \}\) => \{/, "const CurrencyReport: React.FC<CurrencyReportProps> = ({ records, onSelectTranche, onUpdateRecord }) => {");

// 3. Helper for update
const updateHelper = `
    const handleUpdateRecordField = (recordId: string, field: 'goodsName' | 'description', value: string) => {
        if(!onUpdateRecord) return;
        const rec = records.find(r => r.id === recordId);
        if(!rec) return;
        if(rec[field] !== value) {
            onUpdateRecord({ ...rec, [field]: value });
        }
    };
`;
if (!txt.includes('handleUpdateRecordField')) {
    txt = txt.replace("const [rates, setRates] = useState<ExchangeRates>({", updateHelper + "    const [rates, setRates] = useState<ExchangeRates>({");
}

// 4. Update Web Header
const webHeaderRegex = /<thead className="bg-slate-50 dark:bg-slate-900 border-b-2 border-slate-200 dark:border-slate-800 text-xs font-black text-slate-600 dark:text-slate-400">[\s\S]*?<\/thead>/;
const newWebHeader = `<thead className="bg-blue-800 text-white text-xs font-black border-b-2 border-slate-200 shadow-md">
    <tr>
        <th className="p-3 text-center align-middle border-l border-blue-700 sticky right-0 bg-blue-800 z-30 shadow-[inset_-2px_0_4px_rgba(0,0,0,0.1)]">ردیف</th>
        <th className="p-3 text-center align-middle border-l border-blue-700 sticky right-[45px] bg-blue-800 z-30 shadow-[inset_-2px_0_4px_rgba(0,0,0,0.1)] w-[250px]">شرح کالا</th>
        <th className="p-3 text-center align-middle border-l border-blue-700 w-[200px]">توضیحات</th>
        <th className="p-3 text-center align-middle border-l border-blue-700">پرونده</th>
        <th className="p-3 text-center align-middle border-l border-blue-700">ثبت سفارش</th>
        <th className="p-3 text-center align-middle border-l border-blue-700">شرکت</th>
        <th className="p-3 text-center align-middle border-l border-blue-700">معادل دلاری خرید ارز</th>
        <th className="p-3 text-center align-middle border-l border-blue-700 font-extrabold max-w-[150px]">ارز تحویلی (نهایی)</th>
        <th className="p-3 text-center align-middle border-l border-blue-700">وضعیت</th>
        <th className="p-3 text-center align-middle border-l border-blue-700 max-w-[150px]">بهای ارز (کسر عودت)</th>
        <th className="p-3 text-center align-middle border-l border-blue-700 max-w-[150px]">بهای تمام شده برحسب تحویلی</th>
        <th className="p-3 text-center align-middle border-l border-blue-700 cursor-pointer hover:bg-blue-700 transition" onClick={() => setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')}>تاریخ خرید ارز {sortDirection === 'asc' ? '▲' : '▼'}</th>
        <th className="p-3 text-center align-middle border-l border-blue-700 max-w-[130px]">مقدار ارز (اولیه)</th>
        <th className="p-3 text-center align-middle border-l border-blue-700">نوع ارز</th>
        <th className="p-3 text-center align-middle border-l border-blue-700">صرافی</th>
        <th className="p-3 text-center align-middle border-l border-blue-700">کارگزار</th>
        <th className="p-3 text-center align-middle border-l border-blue-700">بانک</th>
        <th className="p-3 text-center align-middle border-l border-blue-700">مبلغ عودت</th>
        <th className="p-3 text-center align-middle">تاریخ عودت</th>
    </tr>
</thead>`;
txt = txt.replace(webHeaderRegex, newWebHeader);

// Web Body
const webBodyRegex = /\{processedGroups\.map\(\(group, gIndex\) => \{[\s\S]*?<\/React\.Fragment>\n                                    \);\n                                \}\)\}/;
const newWebBody = `{processedGroups.map((group, gIndex) => {
    const groupRowSpan = group.tranches.length;
    let baseGlobalIdx = processedGroups.slice(0, gIndex).reduce((acc, g) => acc + g.tranches.length, 0);
    return (
        <React.Fragment key={\`web_\${gIndex}\`}>
            {group.tranches.map((t: any, tIndex: number) => {
                const globalIdx = baseGlobalIdx + tIndex + 1;
                const isEven = globalIdx % 2 === 0;
                const rowClass = isEven ? 'bg-indigo-50/30 dark:bg-slate-800/10' : 'bg-white dark:bg-slate-900';
                
                return (
                    <tr 
                        key={\`web_row_\${gIndex}_\${tIndex}\`} 
                        className={\`hover:bg-blue-50/60 dark:hover:bg-slate-800/60 transition-colors group text-slate-800 dark:text-slate-200 font-semibold \${rowClass}\`}
                    >
                        {tIndex === 0 && (
                            <>
                                <td className="p-0 align-middle text-center font-bold border-l border-slate-200 dark:border-slate-800 sticky right-0 z-20 shadow-[-1px_0_2px_rgba(0,0,0,0.05)] bg-inherit" rowSpan={groupRowSpan}>
                                    <div className="flex items-center justify-center p-3 h-full">{gIndex + 1}</div>
                                </td>
                                <td className="p-1 align-middle text-center font-black text-slate-900 dark:text-white border-l border-slate-200 dark:border-slate-800 sticky right-[45px] z-20 w-[250px] bg-inherit shadow-[-1px_0_2px_rgba(0,0,0,0.05)]" rowSpan={groupRowSpan} title={group.recordInfo.goodsName}>
                                    <textarea 
                                        className="w-full bg-transparent border border-transparent hover:border-slate-300 focus:bg-white focus:border-blue-500 rounded p-1.5 text-center text-xs font-bold leading-relaxed resize-none min-h-[44px] transition-colors"
                                        defaultValue={group.recordInfo.goodsName}
                                        onBlur={(e) => handleUpdateRecordField(group.recordInfo.recordId, 'goodsName', e.target.value)}
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                </td>
                                <td className="p-1 align-middle text-center w-[200px] border-l border-slate-200" rowSpan={groupRowSpan}>
                                    <textarea 
                                        className="w-full bg-transparent border border-transparent hover:border-slate-300 focus:bg-white focus:border-blue-500 rounded p-1.5 text-center text-xs leading-relaxed resize-none text-slate-600 dark:text-slate-400 min-h-[44px] transition-colors"
                                        placeholder="توضیحات..."
                                        defaultValue={group.recordInfo.description || ''}
                                        onBlur={(e) => handleUpdateRecordField(group.recordInfo.recordId, 'description', e.target.value)}
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                </td>
                                <td className="p-3 align-middle text-center font-mono font-black text-blue-600 dark:text-blue-400 border-l border-slate-200" rowSpan={groupRowSpan}>
                                    {group.recordInfo.fileNumber}
                                </td>
                                <td className="p-3 align-middle text-center font-mono text-slate-500 dark:text-slate-400 border-l border-slate-200" rowSpan={groupRowSpan}>
                                    {group.recordInfo.registrationNumber || '-'}
                                </td>
                                <td className="p-3 align-middle text-center font-extrabold text-slate-700 dark:text-slate-300 border-l border-slate-200" rowSpan={groupRowSpan}>
                                    {group.recordInfo.company}
                                </td>
                            </>
                        )}
                        <td className="p-3 align-middle cursor-pointer border-l border-slate-200 text-center font-mono font-bold text-gray-500" onClick={() => setSelectedRowDetail({ group, tranche: t, index: globalIdx })}>
                            {formatUSD(t.usdAmount)} $
                        </td>
                        <td className="p-3 align-middle cursor-pointer border-l border-slate-200 text-center font-mono font-black text-blue-700 dark:text-blue-400" onClick={() => setSelectedRowDetail({ group, tranche: t, index: globalIdx })}>
                            <div className="bg-blue-50/80 px-2 py-1.5 rounded-lg inline-block shadow-sm">
                                {formatNumberString(t.deliveredAmount)} <span className="text-[10px] text-slate-500">{t.currencyType}</span>
                            </div>
                        </td>
                        <td className="p-3 align-middle cursor-pointer border-l border-slate-200 text-center" onClick={() => setSelectedRowDetail({ group, tranche: t, index: globalIdx })}>
                            {t.isDelivered ? <span className="bg-green-100 text-green-700 px-2.5 py-1 rounded-md text-xs border border-green-200 font-bold shadow-sm">تحویل شده</span> : <span className="bg-orange-100 text-orange-700 px-2.5 py-1 rounded-md text-xs border border-orange-200 font-bold shadow-sm">انتظار</span>}
                        </td>
                        <td className="p-3 align-middle cursor-pointer border-l border-slate-200 text-center font-mono font-black text-green-700 dark:text-green-400" onClick={() => setSelectedRowDetail({ group, tranche: t, index: globalIdx })}>
                            <div className="bg-green-50/80 px-2 py-1.5 rounded-lg inline-block shadow-sm">
                                {formatNumberString(t.rialAmount)}
                            </div>
                        </td>
                        <td className="p-3 align-middle cursor-pointer border-l border-slate-200 text-center font-mono font-bold text-indigo-700 dark:text-indigo-400" onClick={() => setSelectedRowDetail({ group, tranche: t, index: globalIdx })}>
                            <div className="bg-indigo-50/80 px-2 py-1.5 rounded-lg inline-block shadow-sm border border-indigo-100">
                                {formatNumberString(t.finalCostPerUnit)} <span className="text-[9px] text-indigo-400 font-sans block">ریال</span>
                            </div>
                        </td>
                        <td className="p-3 align-middle text-center font-mono border-l border-slate-200 text-slate-600">
                            {t.purchaseDate || '-'}
                        </td>
                        <td className="p-3 align-middle text-center font-mono border-l border-slate-200 font-bold text-rose-700 dark:text-rose-400">
                            {formatNumberString(t.originalAmount)}
                        </td>
                        <td className="p-3 align-middle text-center font-extrabold border-l border-slate-200 text-slate-700 dark:text-slate-300">
                            {t.currencyType}
                        </td>
                        <td className="p-3 align-middle text-center border-l border-slate-200 text-slate-600 dark:text-slate-300">
                            {t.exchangeName}
                        </td>
                        <td className="p-3 align-middle text-center border-l border-slate-200 text-slate-600 dark:text-slate-300">
                            {t.brokerName}
                        </td>
                        {tIndex === 0 && (
                            <td className="p-3 align-middle text-center border-l border-slate-200 font-extrabold text-slate-600 dark:text-slate-300" rowSpan={groupRowSpan}>
                                {group.recordInfo.bank}
                            </td>
                        )}
                        <td className="p-3 align-middle text-center font-mono border-l border-slate-200 text-orange-600">
                            {t.returnAmount ? formatNumberString(t.returnAmount) : '-'}
                        </td>
                        <td className="p-3 align-middle text-center font-mono text-slate-500">
                            {t.returnDate || '-'}
                        </td>
                    </tr>
                );
            })}
        </React.Fragment>
    );
})}`;

txt = txt.replace(webBodyRegex, newWebBody);

fs.writeFileSync(file, txt, 'utf8');
console.log('Script updated Web table.');
