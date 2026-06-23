const fs = require('fs');

// 1. Types update
let t = fs.readFileSync('./types.ts', 'utf8');
t = t.split('\n').join('\n'); // normalize
if (!t.includes('description?: string')) {
    t = t.replace('goodsName: string;', 'goodsName: string;\n    description?: string;');
    fs.writeFileSync('./types.ts', t, 'utf8');
}

// 2. TradeModule adding onUpdateRecord
let tm = fs.readFileSync('./components/TradeModule.tsx', 'utf8');
const searchTM = `<CurrencyReport 
                        records={currentList`;
const replaceTM = `<CurrencyReport 
                        onUpdateRecord={updateTradeRecord}
                        records={currentList`;
if (tm.includes(searchTM)) {
    tm = tm.replace(searchTM, replaceTM);
}

// In TradeModule, add "مقدار ارز" (Purchased Amount) and "معادل دلار" (USD) for Tranches in Tranche Delivery modal
// We have `modalStr` injected earlier.
const deliveriesTableHead = `<th className="p-3">تاریخ</th>
                                        <th className="p-3">مقدار تحویلی</th>
                                        <th className="p-3">تحویل‌گیرنده</th>
                                        <th className="p-3">توضیحات</th>
                                        <th className="p-3">حذف</th>`;

const newDeliveriesTableHead = `<th className="p-3 text-center">تاریخ</th>
                                        <th className="p-3 text-center">مقدار تحویلی</th>
                                        <th className="p-3 text-center">معادل دلار</th>
                                        <th className="p-3 text-center">تحویل‌گیرنده</th>
                                        <th className="p-3 text-center">توضیحات</th>
                                        <th className="p-3 text-center">حذف</th>`;

const deliveriesTableBody = `<td className="p-3 font-mono font-bold text-green-705">{formatNumberString(delivery.amount)} {tr.currencyType}</td>
                                            <td className="p-3">{delivery.recipientName || '-'}</td>
                                            <td className="p-3 text-gray-500">{delivery.description || '-'}</td>
                                            <td className="p-3">`;

// Wait, the USD equivalent needs a rate. But the delivery doesn't inherently have a USD rate unless we calculate it.
// The user says: "برای بخش تحویل ارز هم مقدار هم ارز خریداری شده بیاد هم یه ستون معادل دلاری بیاد ". 
// They might mean inside the tranche delivery header: show "Purchased Amount", "Delivered Amount", "USD eq".  
// Let's change the "Tranche Specs Card" inside the modal instead to display these!

// `tr.amount`, we already have it. Let's add USD equivalent. Wait, we don't know the exact exchange rate inside TradeModule modal easily without rates. But we can show "ارز خریداری شده (مقدار)" and something else if they want.

fs.writeFileSync('./components/TradeModule.tsx', tm, 'utf8');
console.log('Trade module and types updated');
