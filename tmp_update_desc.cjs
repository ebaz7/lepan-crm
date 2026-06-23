const fs = require('fs');
let content = fs.readFileSync('components/reports/CurrencyReport.tsx', 'utf8');

const target1 = `                                                                <td className="p-3 text-right font-black text-slate-900 dark:text-white truncate border-l border-slate-200 dark:border-slate-800 sticky right-12 group-hover:bg-slate-100 dark:group-hover:bg-slate-850 z-20 max-w-[200px]" rowSpan={groupRowSpan} title={group.recordInfo.goodsName}>\r\n                                                                    {group.recordInfo.goodsName}\r\n                                                                </td>`;
const replacement1 = `                                                                <td className="p-3 align-middle text-center font-black text-slate-900 dark:text-white truncate border-l border-slate-200 dark:border-slate-800 sticky right-12 group-hover:bg-slate-100 dark:group-hover:bg-slate-850 z-20 max-w-[200px]" rowSpan={groupRowSpan} title={group.recordInfo.goodsName}>\r\n                                                                    {group.recordInfo.goodsName}\r\n                                                                </td>\r\n                                                                <td className="p-3 align-middle text-center border-l font-bold border-slate-200 dark:border-slate-800" rowSpan={groupRowSpan}>\r\n                                                                    {group.recordInfo.description || '-'}\r\n                                                                </td>`;

if (content.includes(target1)) content = content.replace(target1, replacement1);
else console.log('not found t1 with crlf');

fs.writeFileSync('components/reports/CurrencyReport.tsx', content);
