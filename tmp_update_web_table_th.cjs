const fs = require('fs');
let content = fs.readFileSync('components/reports/CurrencyReport.tsx', 'utf8');

const target = `<tr className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-extrabold border-b border-slate-200 dark:border-slate-800 shrink-0 select-none">
                                    <th className="p-3.5 text-center w-12 sticky right-0 bg-slate-100 dark:bg-slate-800 z-20 shadow-sm">ردیف</th>
                                    <th className="p-3.5 text-right min-w-[190px] sticky right-12 bg-slate-100 dark:bg-slate-800 z-20 shadow-sm">شرح کالا</th>
                                    <th className="p-3.5 text-center min-w-[110px]">شماره سفارش پرونده</th>
                                    <th className="p-3.5 text-center min-w-[110px]">ثبت سفارش</th>
                                    <th className="p-3.5 text-center min-w-[120px]">نام شرکت</th>
                                    <th className="p-3.5 text-center min-w-[125px] bg-blue-50/40 dark:bg-blue-950/20 text-blue-800 dark:text-blue-300">معادل دلار آمریکا</th>
                                    <th className="p-3.5 text-center min-w-[115px] bg-blue-50/40 dark:bg-blue-950/20 text-blue-800 dark:text-blue-300">مقدار ارز</th>
                                    <th className="p-3.5 text-center min-w-[65px] bg-blue-50/40 dark:bg-blue-950/20 text-blue-800 dark:text-blue-300">نوع ارز</th>
                                    <th className="p-3.5 text-center min-w-[105px] font-sans">تاریخ خرید</th>
                                    <th className="p-3.5 text-center min-w-[135px]">ارز خریداری شده (ریال)</th>
                                    <th className="p-3.5 text-center min-w-[115px]">صرافی عامل</th>
                                    <th className="p-3.5 text-center min-w-[115px]">کارگزار</th>
                                    <th className="p-3.5 text-center min-w-[125px]">بانک عامل</th>
                                    <th className="p-3.5 text-center min-w-[125px] bg-green-50/40 dark:bg-green-950/20 text-green-800 dark:text-green-300">مقدار تحویل شده</th>
                                    <th className="p-3.5 text-center min-w-[65px] bg-green-50/40 dark:bg-green-950/20 text-green-800 dark:text-green-300">وضعیت</th>
                                    <th className="p-3.5 text-center min-w-[115px] bg-red-50/40 dark:bg-red-950/20 text-red-800 dark:text-red-300">مبلغ عودت</th>
                                    <th className="p-3.5 text-center min-w-[105px] bg-red-50/40 dark:bg-red-950/20 text-red-800 dark:text-red-300 font-sans">تاریخ عودت</th>
                                </tr>`;

const replacement = `<tr className="bg-[#1e40af] text-white font-extrabold border-b border-blue-900 shrink-0 select-none">
                                    <th className="p-3.5 align-middle text-center w-12 sticky right-0 bg-[#1e40af] z-20 shadow-sm border-l border-blue-700">ردیف</th>
                                    <th className="p-3.5 align-middle text-center min-w-[190px] sticky right-12 bg-[#1e40af] z-20 shadow-sm border-l border-blue-700">شرح کالا</th>
                                    <th className="p-3.5 align-middle text-center min-w-[150px] border-l border-blue-700">توضیحات</th>
                                    <th className="p-3.5 align-middle text-center min-w-[110px] border-l border-blue-700">شماره سفارش پرونده</th>
                                    <th className="p-3.5 align-middle text-center min-w-[110px] border-l border-blue-700">ثبت سفارش</th>
                                    <th className="p-3.5 align-middle text-center min-w-[120px] border-l border-blue-700">نام شرکت</th>
                                    <th className="p-3.5 align-middle text-center min-w-[125px] border-l border-blue-700">معادل دلار آمریکا</th>
                                    <th className="p-3.5 align-middle text-center min-w-[115px] border-l border-blue-700">مقدار ارز</th>
                                    <th className="p-3.5 align-middle text-center min-w-[65px] border-l border-blue-700">نوع ارز</th>
                                    <th className="p-3.5 align-middle text-center min-w-[105px] font-sans border-l border-blue-700">تاریخ خرید</th>
                                    <th className="p-3.5 align-middle text-center min-w-[135px] border-l border-blue-700">ارز خریداری شده (ریال)</th>
                                    <th className="p-3.5 align-middle text-center min-w-[115px] border-l border-blue-700">صرافی عامل</th>
                                    <th className="p-3.5 align-middle text-center min-w-[115px] border-l border-blue-700">کارگزار</th>
                                    <th className="p-3.5 align-middle text-center min-w-[125px] border-l border-blue-700">بانک عامل</th>
                                    <th className="p-3.5 align-middle text-center min-w-[125px] border-l border-blue-700">مقدار تحویل شده</th>
                                    <th className="p-3.5 align-middle text-center min-w-[65px] border-l border-blue-700">وضعیت</th>
                                    <th className="p-3.5 align-middle text-center min-w-[115px] border-l border-blue-700">مبلغ عودت</th>
                                    <th className="p-3.5 align-middle text-center min-w-[105px] font-sans">تاریخ عودت</th>
                                </tr>`;

content = content.replace(target.replace(/\r\n/g, '\n'), replacement);
content = content.replace(target, replacement); // try both
fs.writeFileSync('components/reports/CurrencyReport.tsx', content);
console.log('updated th');
