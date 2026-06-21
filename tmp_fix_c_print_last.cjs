const fs = require('fs');
let file = './components/reports/CurrencyReport.tsx';
let txt = fs.readFileSync(file, 'utf8');

const regexColgroup = /<colgroup>[\s\S]*?<\/colgroup>/sm;
const regexThead = /<thead>\s*<tr className="bg-\[#1e40af\] text-white font-black text-\[9px\] border-black">[\s\S]*?<\/thead>/sm;
const regexTbody = /<tbody>\s*\{processedGroups\.map\(\(group, gIndex\) => \([\s\S]*?<\/tbody>/sm;

const newColgroup = `<colgroup>
    <col style={{width: '25px'}} />
    <col />
    <col />
    <col style={{width: '60px'}} />
    <col style={{width: '60px'}} />
    <col style={{width: '75px'}} />
    <col style={{width: '60px'}} />
    <col style={{width: '60px'}} />
    <col style={{width: '35px'}} />
    <col style={{width: '55px'}} />
    <col style={{width: '70px'}} />
    <col style={{width: '70px'}} />
    <col style={{width: '55px'}} />
    <col style={{width: '55px'}} />
    <col style={{width: '60px'}} />
    <col style={{width: '60px'}} />
    <col style={{width: '30px'}} />
    <col style={{width: '55px'}} />
    <col style={{width: '45px'}} />
</colgroup>`;

const newThead = `<thead>
    <tr className="bg-[#1e40af] text-white font-black text-[9px] border-black">
        <th className="border border-black p-1 align-middle text-center bg-[#1e40af] text-white">ردیف</th>
        <th className="border border-black p-1 align-middle text-center bg-[#1e40af] text-white">شرح کالا</th>
        <th className="border border-black p-1 align-middle text-center bg-[#1e40af] text-white">توضیحات</th>
        <th className="border border-black p-1 align-middle text-center bg-[#1e40af] text-white">پرونده</th>
        <th className="border border-black p-1 align-middle text-center bg-[#1e40af] text-white">ثبت سفارش</th>
        <th className="border border-black p-1 align-middle text-center bg-[#1e40af] text-white">نام شرکت</th>
        <th className="border border-black p-1 align-middle text-center bg-[#1e3a8a] text-white">دلار معادل</th>
        <th className="border border-black p-1 align-middle text-center bg-[#1e3a8a] text-white">مقدار ارز</th>
        <th className="border border-black p-1 align-middle text-center bg-[#1e3a8a] text-white">نوع</th>
        <th className="border border-black p-1 align-middle text-center bg-[#1e40af] text-white">تاریخ خرید</th>
        <th className="border border-black p-1 align-middle text-center bg-[#1e40af] text-white">بهای ارز (ریال)</th>
        <th className="border border-black p-1 align-middle text-center bg-[#1e40af] text-white">بهای تمام شده</th>
        <th className="border border-black p-1 align-middle text-center bg-[#1e40af] text-white">صرافی</th>
        <th className="border border-black p-1 align-middle text-center bg-[#1e40af] text-white">کارگزار</th>
        <th className="border border-black p-1 align-middle text-center bg-[#1e40af] text-white">بانک</th>
        <th className="border border-black p-1 align-middle text-center bg-[#14532d] text-white">تحویلی</th>
        <th className="border border-black p-1 align-middle text-center bg-[#14532d] text-white">وضعیت</th>
        <th className="border border-black p-1 align-middle text-center bg-[#1e40af] text-white">عودت</th>
        <th className="border border-black p-1 align-middle text-center bg-[#1e40af] text-white">ت. عودت</th>
    </tr>
</thead>`;

const newTbody = `<tbody>
                    {processedGroups.map((group, gIndex) => (
                        <React.Fragment key={gIndex}>
                            {group.tranches.map((t: any, tIndex: number) => {
                                const localZebraBg = gIndex % 2 === 0 ? 'bg-[#f8fafc]' : 'bg-[#ffffff]';
                                return (
                                <tr key={\`\${gIndex}_\${tIndex}\`} className={\`text-gray-800 leading-tight text-black text-[9px] \${localZebraBg}\`}>
                                    {tIndex === 0 && (
                                        <>
                                            <td className="border border-black p-1 align-middle text-center font-bold text-black" rowSpan={group.tranches.length}>{gIndex + 1}</td>
                                            <td className="border border-black p-1 align-middle text-center font-bold text-black break-words max-w-[120px]" rowSpan={group.tranches.length} title={group.recordInfo.goodsName}>{group.recordInfo.goodsName}</td>
                                            <td className="border border-black p-1 align-middle text-center font-bold text-black break-words max-w-[120px]" rowSpan={group.tranches.length}>{group.recordInfo.description || ''}</td>
                                            <td className="border border-black p-1 align-middle text-center font-mono font-bold text-black" rowSpan={group.tranches.length}>{group.recordInfo.fileNumber}</td>
                                            <td className="border border-black p-1 align-middle text-center font-mono text-black" rowSpan={group.tranches.length}>{group.recordInfo.registrationNumber || '-'}</td>
                                            <td className="border border-black p-1 align-middle text-center font-bold text-black" rowSpan={group.tranches.length}>{group.recordInfo.company}</td>
                                        </>
                                    )}
                                    
                                    <td className="border border-black p-1 align-middle text-center font-mono font-black text-black">{formatUSD(t.usdAmount)}</td>
                                    <td className="border border-black p-1 align-middle text-center font-mono font-bold text-black">{formatNumberString(t.originalAmount)}</td>
                                    <td className="border border-black p-1 align-middle text-center font-bold text-black">{t.currencyType}</td>
                                    <td className="border border-black p-1 align-middle text-center dir-ltr font-bold text-black">{t.purchaseDate}</td>
                                    <td className="border border-black p-1 align-middle text-center font-mono font-bold text-black">{t.rialAmount > 0 ? formatNumberString(t.rialAmount) : '-'}</td>
                                    <td className="border border-black p-1 align-middle text-center font-mono font-bold text-black">{t.finalCostPerUnit > 0 ? formatNumberString(t.finalCostPerUnit) : '-'}</td>
                                    <td className="border border-black p-1 align-middle text-center text-[9px] font-bold text-black max-w-[60px] truncate" title={t.exchangeName}>{t.exchangeName}</td>
                                    <td className="border border-black p-1 align-middle text-center font-mono text-[9px] font-bold text-black max-w-[60px] truncate">{t.brokerName}</td> 
                                    
                                    {tIndex === 0 && <td className="border border-black p-1 align-middle text-center font-bold text-black max-w-[60px] truncate" rowSpan={group.tranches.length}>{group.recordInfo.bank}</td>}
                                    
                                    <td className="border border-black p-1 align-middle text-center font-mono font-black text-black">{formatNumberString(t.deliveredAmount)}</td>
                                    <td className="border border-black p-1 align-middle text-center font-bold text-black">{t.isDelivered ? '✅' : '⏳'}</td>
                                    <td className="border border-black p-1 align-middle text-center font-black text-black">{t.returnAmount > 0 ? formatNumberString(t.returnAmount) : '-'}</td>
                                    <td className="border border-black p-1 align-middle text-center font-bold text-black">{t.returnDate}</td>
                                </tr>
                                )
                            })}
                        </React.Fragment>
                    ))}
                </tbody>`;

txt = txt.replace(regexColgroup, newColgroup);
txt = txt.replace(regexThead, newThead);
txt = txt.replace(regexTbody, newTbody);

fs.writeFileSync(file, txt, 'utf8');
console.log('Fixed Print Table matching headers and alignment.');
