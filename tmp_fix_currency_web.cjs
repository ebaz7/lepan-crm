const fs = require('fs');
let file = './components/reports/CurrencyReport.tsx';
let txt = fs.readFileSync(file, 'utf8');

const theadRegex = /<thead>\s*<tr className="bg-slate-100.*?<\/tr>\s*<\/thead>/sm;
const newThead = `<thead>
    <tr className="bg-[#1e40af] text-white font-extrabold border-b-2 border-[#1e3a8a] shrink-0 select-none text-xs">
        <th className="p-3 text-center w-12 sticky right-0 bg-[#1e40af] z-20 shadow-sm align-middle whitespace-nowrap border-l border-[#1e3a8a]">ردیف</th>
        <th className="p-3 text-center min-w-[200px] sticky right-12 bg-[#1e40af] z-20 shadow-sm align-middle whitespace-nowrap border-l border-[#1e3a8a]">شرح کالا</th>
        <th className="p-3 text-center min-w-[200px] align-middle whitespace-nowrap border-l border-[#1e3a8a]">توضیحات</th>
        <th className="p-3 text-center min-w-[110px] align-middle whitespace-nowrap border-l border-[#1e3a8a]">پرونده</th>
        <th className="p-3 text-center min-w-[110px] align-middle whitespace-nowrap border-l border-[#1e3a8a]">ثبت سفارش</th>
        <th className="p-3 text-center min-w-[120px] align-middle whitespace-nowrap border-l border-[#1e3a8a]">نام شرکت</th>
        <th className="p-3 text-center min-w-[125px] align-middle whitespace-nowrap border-l border-[#1e3a8a]">معادل دلار</th>
        <th className="p-3 text-center min-w-[115px] align-middle whitespace-nowrap border-l border-[#1e3a8a]">مقدار ارز</th>
        <th className="p-3 text-center min-w-[65px] align-middle whitespace-nowrap border-l border-[#1e3a8a]">نوع ارز</th>
        <th className="p-3 text-center min-w-[105px] align-middle whitespace-nowrap font-sans border-l border-[#1e3a8a]">تاریخ خرید</th>
        <th className="p-3 text-center min-w-[135px] align-middle whitespace-nowrap border-l border-[#1e3a8a]">ارز (ریال)</th>
        <th className="p-3 text-center min-w-[115px] align-middle whitespace-nowrap border-l border-[#1e3a8a]">صرافی</th>
        <th className="p-3 text-center min-w-[115px] align-middle whitespace-nowrap border-l border-[#1e3a8a]">کارگزار</th>
        <th className="p-3 text-center min-w-[125px] align-middle whitespace-nowrap border-l border-[#1e3a8a]">بانک</th>
        <th className="p-3 text-center min-w-[125px] align-middle whitespace-nowrap border-l border-[#1e3a8a]">تحویلی</th>
        <th className="p-3 text-center min-w-[65px] align-middle whitespace-nowrap border-l border-[#1e3a8a]">وضعیت</th>
        <th className="p-3 text-center min-w-[115px] align-middle whitespace-nowrap border-l border-[#1e3a8a]">مبلغ عودت</th>
        <th className="p-3 text-center min-w-[105px] align-middle whitespace-nowrap font-sans border-l border-[#1e3a8a]">تاریخ عودت</th>
    </tr>
</thead>`;

txt = txt.replace(theadRegex, newThead);

const tbodyRegex = /<tbody className="divide-y divide-slate-100 dark:divide-slate-800\/80">[\s\S]*?<\/table>/sm;
const newTbody = `<tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
    {processedGroups.map((group, gIndex) => {
        const groupRowSpan = group.tranches.length;
        return (
            <React.Fragment key={\`web_\${gIndex}\`}>
                {group.tranches.map((t: any, tIndex: number) => {
                    const bgClass = gIndex % 2 === 0 ? 'bg-indigo-50/40' : 'bg-white';
                    return (
                        <tr key={t.id} className={\`hover:bg-blue-50 transition-colors \${bgClass}\`}>
                            {tIndex === 0 && (
                                <>
                                    <td rowSpan={groupRowSpan} className="p-2 border-l border-slate-200 sticky right-0 z-10 font-bold text-center align-middle bg-inherit w-12 text-slate-500">
                                        <div className="flex items-center justify-center h-full w-full">{gIndex + 1}</div>
                                    </td>
                                    <td rowSpan={groupRowSpan} className="p-3 border-l border-slate-200 sticky right-12 z-10 bg-inherit min-w-[200px] align-middle text-center">
                                        <textarea
                                            className="w-full bg-transparent resize-none text-center align-middle outline-none focus:ring-2 focus:ring-[#1e40af] rounded-lg p-1 text-sm font-semibold text-slate-800 min-h-[44px]"
                                            defaultValue={group.recordInfo.goodsName || ''}
                                            onBlur={e => onUpdateRecord && onUpdateRecord(group.recordInfo.id, { goodsName: e.target.value })}
                                            rows={2}
                                            placeholder="شرح کالا..."
                                        />
                                    </td>
                                    <td rowSpan={groupRowSpan} className="p-3 border-l border-slate-200 bg-inherit min-w-[200px] align-middle text-center">
                                        <textarea
                                            className="w-full bg-transparent resize-none text-center align-middle outline-none focus:ring-2 focus:ring-[#1e40af] rounded-lg p-1 text-sm text-slate-600 min-h-[44px]"
                                            defaultValue={group.recordInfo.description || ''}
                                            onBlur={e => onUpdateRecord && onUpdateRecord(group.recordInfo.id, { description: e.target.value })}
                                            rows={2}
                                            placeholder="توضیحات..."
                                        />
                                    </td>
                                    <td rowSpan={groupRowSpan} className="p-3 border-l border-slate-200 text-center align-middle font-bold text-slate-800 dir-ltr">{group.recordInfo.fileNumber}</td>
                                    <td rowSpan={groupRowSpan} className="p-3 border-l border-slate-200 text-center align-middle font-sans text-slate-600">{group.recordInfo.registrationNumber || '-'}</td>
                                    <td rowSpan={groupRowSpan} className="p-3 border-l border-slate-200 text-center align-middle font-bold text-slate-700 whitespace-pre-wrap">{group.recordInfo.company}</td>
                                </>
                            )}
                            <td className="p-3 text-center align-middle border-l border-slate-200 font-mono font-black text-blue-700">{formatNumberString(t.usdAmount)}</td>
                            <td className="p-3 text-center align-middle border-l border-slate-200 font-mono font-black text-slate-700">{formatNumberString(t.originalAmount)}</td>
                            <td className="p-3 text-center align-middle border-l border-slate-200 whitespace-nowrap"><span className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded text-[10px] font-bold tracking-widest">{t.currencyType}</span></td>
                            <td className="p-3 text-center align-middle border-l border-slate-200 font-mono text-slate-600 whitespace-nowrap">{t.purchaseDate || '-'}</td>
                            <td className="p-3 text-center align-middle border-l border-slate-200 font-mono font-bold text-slate-600">{formatNumberString(t.rialAmount)}</td>
                            <td className="p-3 text-center align-middle border-l border-slate-200 text-slate-700">{t.exchangeName}</td>
                            <td className="p-3 text-center align-middle border-l border-slate-200 text-slate-700">{t.brokerName}</td>
                            <td className="p-3 text-center align-middle border-l border-slate-200 text-slate-700">{group.recordInfo.bank || '-'}</td>
                            <td className="p-3 text-center align-middle border-l border-slate-200 font-mono font-bold text-green-700">{formatNumberString(t.deliveredAmount)}</td>
                            <td className="p-3 text-center align-middle border-l border-slate-200 whitespace-nowrap">{t.isDelivered ? <span className="text-green-600 font-bold bg-green-50 px-2.5 py-1 rounded-full flex items-center justify-center gap-1"><CheckCircle2 size={12}/>ت</span> : <span className="text-amber-600 font-bold bg-amber-50 px-2.5 py-1 rounded-full flex items-center justify-center gap-1"><Clock size={12}/>م</span>}</td>
                            <td className="p-3 text-center align-middle border-l border-slate-200 font-mono font-bold text-red-600">{formatNumberString(t.returnAmount)}</td>
                            <td className="p-3 text-center align-middle font-mono font-bold text-red-500 whitespace-nowrap">{t.returnDate || '-'}</td>
                        </tr>
                    );
                })}
            </React.Fragment>
        );
    })}
</tbody>
</table>`;

txt = txt.replace(tbodyRegex, newTbody);
fs.writeFileSync(file, txt, 'utf8');
console.log('Script updated Web UI Table headers and rows.');
