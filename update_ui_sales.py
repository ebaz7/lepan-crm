with open("components/AccountingReports.tsx", "r", encoding="utf-8") as f:
    code = f.read()

# 1. Add Official Tax Checkbox right near Compare Mode
tax_checkbox_ui = """                                <label className="flex items-center gap-1.5 cursor-pointer bg-emerald-50 hover:bg-emerald-100 px-3 py-2 rounded-lg border border-emerald-200 transition-colors">
                                    <input 
                                        type="checkbox" 
                                        checked={applyOfficialTax}
                                        onChange={(e) => setApplyOfficialTax(e.target.checked)}
                                        className="rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500"
                                    />
                                    <span className="text-xs font-bold text-emerald-800">۱۰٪ ارزش افزوده رسمی (فاکتورهای رسمی)</span>
                                </label>"""

if "۱۰٪ ارزش افزوده رسمی" not in code:
    code = code.replace(
        '<span className="text-xs font-bold text-slate-700">فعال‌سازی مقایسه دو بازه</span>\n                                </label>',
        '<span className="text-xs font-bold text-slate-700">فعال‌سازی مقایسه دو بازه</span>\n                                </label>\n' + tax_checkbox_ui
    )

# 2. Add Average Price Table & Stats UI
avg_table_ui = """
                        {/* Top-level overviews for Period A */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="bg-blue-50/90 rounded-xl p-4 border border-blue-200 shadow-sm">
                                <div className="text-blue-700 font-bold text-xs flex justify-between items-center">
                                    <span>فروش ناخالص بازه</span>
                                    <span className="text-[10px] bg-blue-200 text-blue-800 px-1.5 py-0.5 rounded font-mono">Gross Sales</span>
                                </div>
                                <div className="text-xl font-black text-blue-950 mt-2 font-mono">
                                    {formatMoney(stats.rangeSalesAmt)} <span className="text-xs font-bold">ریال</span>
                                </div>
                                <div className="text-xs text-blue-700 font-bold mt-1">وزن: {stats.rangeSalesQty.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} کیلوگرم</div>
                            </div>

                            <div className="bg-rose-50/90 rounded-xl p-4 border border-rose-200 shadow-sm">
                                <div className="text-rose-700 font-bold text-xs flex justify-between items-center">
                                    <span>مرجوعی (برگشت از فروش)</span>
                                    <span className="text-[10px] bg-rose-200 text-rose-800 px-1.5 py-0.5 rounded font-mono">Returns</span>
                                </div>
                                <div className="text-xl font-black text-rose-950 mt-2 font-mono">
                                    {formatMoney(stats.rangeReturnAmt)} <span className="text-xs font-bold">ریال</span>
                                </div>
                                <div className="text-xs text-rose-700 font-bold mt-1">وزن: {stats.rangeReturnQty.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} کیلوگرم</div>
                            </div>

                            <div className="bg-emerald-50/90 rounded-xl p-4 border border-emerald-200 shadow-sm">
                                <div className="text-emerald-800 font-bold text-xs flex justify-between items-center">
                                    <span>فروش خالص برآیند</span>
                                    <span className="text-[10px] bg-emerald-200 text-emerald-800 px-1.5 py-0.5 rounded font-mono">Net Sales</span>
                                </div>
                                <div className="text-xl font-black text-emerald-950 mt-2 font-mono">
                                    {formatMoney(stats.rangeNetAmt)} <span className="text-xs font-bold">ریال</span>
                                </div>
                                <div className="text-xs text-emerald-700 font-bold mt-1">وزن خالص: {stats.rangeNetQty.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} کیلوگرم</div>
                            </div>

                            <div className="bg-amber-50/90 rounded-xl p-4 border border-amber-200 shadow-sm">
                                <div className="text-amber-800 font-bold text-xs flex justify-between items-center">
                                    <span>میانگین قیمت فروش خالص</span>
                                    <span className="text-[10px] bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded font-mono">Avg Price / Kg</span>
                                </div>
                                <div className="text-xl font-black text-amber-950 mt-2 font-mono">
                                    {formatMoney(stats.rangeAvgPrice)} <span className="text-xs font-bold">ریال / ک‌گ</span>
                                </div>
                                <div className="text-[11px] text-amber-700 font-medium mt-1">حاصل تقسیم مبلغ خالص به وزن خالص</div>
                            </div>
                        </div>

                        {/* Average Price Table Component */}
                        {(() => {
                            const { list, totals, overallAvgPrice } = getAveragePriceTableData();
                            return (
                                <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden mt-6">
                                    <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                                            <h3 className="text-sm font-bold text-slate-800">جدول تحلیلی میانگین قیمت فروش و مرجوعی (به تفکیک محصول)</h3>
                                        </div>
                                        <span className="text-xs font-mono text-slate-500 font-semibold bg-white border border-slate-200 px-2.5 py-1 rounded-md">
                                            مبلغ خالص ÷ وزن خالص
                                        </span>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-right text-xs">
                                            <thead>
                                                <tr className="bg-slate-100/70 text-slate-600 border-b border-slate-200 font-bold">
                                                    <th className="p-3 text-center w-12">#</th>
                                                    <th className="p-3">گروه کالا / محصول</th>
                                                    <th className="p-3 text-center text-blue-700">وزن فروش (ک‌گ)</th>
                                                    <th className="p-3 text-left text-blue-700">مبلغ فروش (ریال)</th>
                                                    <th className="p-3 text-center text-rose-700">وزن مرجوعی (ک‌گ)</th>
                                                    <th className="p-3 text-left text-rose-700">مبلغ مرجوعی (ریال)</th>
                                                    <th className="p-3 text-center text-emerald-800 bg-emerald-50/50">وزن خالص (ک‌گ)</th>
                                                    <th className="p-3 text-left text-emerald-800 bg-emerald-50/50">مبلغ خالص (ریال)</th>
                                                    <th className="p-3 text-center text-amber-900 bg-amber-50/60 font-black">میانگین قیمت (ریال/ک‌گ)</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {list.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={9} className="p-6 text-center text-slate-400">هیچ داده‌ای برای نمایش میانگین قیمت وجود ندارد.</td>
                                                    </tr>
                                                ) : (
                                                    list.map((row, idx) => (
                                                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                                            <td className="p-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                                                            <td className="p-3 font-bold text-slate-800">{row.groupName}</td>
                                                            <td className="p-3 text-center font-mono font-semibold text-blue-700">{row.salesQty.toLocaleString('fa-IR', { maximumFractionDigits: 1 })}</td>
                                                            <td className="p-3 text-left font-mono text-blue-700">{formatMoney(row.salesAmt)}</td>
                                                            <td className="p-3 text-center font-mono font-semibold text-rose-700">{row.returnQty > 0 ? row.returnQty.toLocaleString('fa-IR', { maximumFractionDigits: 1 }) : '-'}</td>
                                                            <td className="p-3 text-left font-mono text-rose-700">{row.returnAmt > 0 ? formatMoney(row.returnAmt) : '-'}</td>
                                                            <td className="p-3 text-center font-mono font-bold text-emerald-800 bg-emerald-50/30">{row.netQty.toLocaleString('fa-IR', { maximumFractionDigits: 1 })}</td>
                                                            <td className="p-3 text-left font-mono font-bold text-emerald-800 bg-emerald-50/30">{formatMoney(row.netAmt)}</td>
                                                            <td className="p-3 text-center font-mono font-black text-amber-900 bg-amber-50/40">{formatMoney(row.avgPrice)}</td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                            <tfoot>
                                                <tr className="bg-slate-200/80 font-bold border-t-2 border-slate-300">
                                                    <td colSpan={2} className="p-3 text-right text-slate-800">جمع کل (برآیند)</td>
                                                    <td className="p-3 text-center font-mono text-blue-800">{totals.salesQty.toLocaleString('fa-IR', { maximumFractionDigits: 1 })}</td>
                                                    <td className="p-3 text-left font-mono text-blue-800">{formatMoney(totals.salesAmt)}</td>
                                                    <td className="p-3 text-center font-mono text-rose-800">{totals.returnQty.toLocaleString('fa-IR', { maximumFractionDigits: 1 })}</td>
                                                    <td className="p-3 text-left font-mono text-rose-800">{formatMoney(totals.returnAmt)}</td>
                                                    <td className="p-3 text-center font-mono text-emerald-900 bg-emerald-100/80">{totals.netQty.toLocaleString('fa-IR', { maximumFractionDigits: 1 })}</td>
                                                    <td className="p-3 text-left font-mono text-emerald-900 bg-emerald-100/80">{formatMoney(totals.netAmt)}</td>
                                                    <td className="p-3 text-center font-mono text-amber-950 bg-amber-200/80 text-sm">{formatMoney(overallAvgPrice)}</td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                </div>
                            );
                        })()}
"""

start_cards = code.find("{/* Top-level overviews for Period A */}")
end_cards = code.find("{/* Today's Invoices Table */}")

if start_cards != -1 and end_cards != -1:
    code = code[:start_cards] + avg_table_ui + "\n                        " + code[end_cards:]
    with open("components/AccountingReports.tsx", "w", encoding="utf-8") as f:
        f.write(code)
    print("Updated AccountingReports.tsx UI successfully!")
else:
    print(f"Could not find card positions: start_cards={start_cards}, end_cards={end_cards}")
