import fs from 'fs';
let code = fs.readFileSync('components/AccountingReports.tsx', 'utf8');

code = code.replace(
/<button \n                                    onClick=\{handlePrintPeriodSales\}[\s\S]*?<\/button>/,
`<button 
                                    onClick={handlePrintPeriodSales}
                                    className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-3.5 rounded-lg text-xs transition-all cursor-pointer shadow-sm hover:shadow active:scale-95"
                                    title="دریافت گزارش جامع فاکتورهای دوره‌ای با فرمت رسمی و خروجی PDF"
                                >
                                    <Printer className="w-3.5 h-3.5" />
                                    <span>فرم چاپی فروش دوره‌ای (PDF)</span>
                                </button>
                                
                                <button 
                                    onClick={() => handleSendSalesBotReport('range')}
                                    disabled={isSendingSalesBot}
                                    className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-3.5 rounded-lg text-xs transition-all cursor-pointer shadow-sm hover:shadow active:scale-95 disabled:opacity-50"
                                    title="ارسال آمار دوره‌ای (بازه زمانی انتخاب شده) به کانال‌ها و گروه‌های بله و تلگرام"
                                >
                                    <Send className="w-3.5 h-3.5" />
                                    <span>{isSendingSalesBot ? 'در حال ارسال بازه...' : 'ارسال فروش دوره‌ای به بات'}</span>
                                </button>`
);
fs.writeFileSync('components/AccountingReports.tsx', code);
