const fs = require('fs');
let file = './components/TradeModule.tsx';
let txt = fs.readFileSync(file, 'utf8');

const tableHeadRegex = /<thead className="bg-gray-100 text-gray-700">\s*<tr>\s*<th className="p-3">تاریخ<\/th>\s*<th className="p-3">مقدار تحویلی<\/th>\s*<th className="p-3">تحویل‌گیرنده<\/th>\s*<th className="p-3">توضیحات<\/th>\s*<th className="p-3">حذف<\/th>\s*<\/tr>\s*<\/thead>/m;

const newTableHead = `<thead className="bg-gray-100 text-gray-700">
    <tr>
        <th className="p-3 text-center border-l border-gray-200">تاریخ</th>
        <th className="p-3 text-center border-l border-gray-200">مقدار ارز خریداری شده (پارت)</th>
        <th className="p-3 text-center border-l bg-green-50 text-green-700 border-gray-200">مقدار تحویلی</th>
        <th className="p-3 text-center border-l font-bold text-blue-700 border-gray-200">معادل دلاری</th>
        <th className="p-3 text-center border-l border-gray-200">تحویل‌گیرنده</th>
        <th className="p-3 text-center border-l border-gray-200">توضیحات</th>
        <th className="p-3 text-center border-gray-200">حذف</th>
    </tr>
</thead>`;

txt = txt.replace(tableHeadRegex, newTableHead);

const tableBodyRegex = /<td className="p-3 font-mono">\{delivery\.date \|\| '-'\}.*?<td className="p-3 font-mono font-bold text-green-705">\{formatNumberString\(delivery\.amount\)\} \{tr\.currencyType\}<\/td>\s*<td className="p-3">\{delivery\.recipientName \|\| '-'\}.*?<td className="p-3 text-gray-500">\{delivery\.description \|\| '-'\}.*?<td className="p-3">/sm;

const newTableBody = `<td className="p-3 font-mono text-center border-l border-gray-100">{delivery.date || '-'}</td>
<td className="p-3 font-mono font-bold text-gray-600 text-center border-l border-gray-100">{formatNumberString(tr.amount)} {tr.currencyType}</td>
<td className="p-3 font-mono font-bold text-green-700 text-center border-l border-green-100 bg-green-50/50">{formatNumberString(delivery.amount)} {tr.currencyType}</td>
<td className="p-3 font-mono font-bold text-blue-700 text-center border-l border-gray-100">
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
<td className="p-3 text-center border-l border-gray-100">{delivery.recipientName || '-'}</td>
<td className="p-3 text-gray-500 text-center border-l border-gray-100">{delivery.description || '-'}</td>
<td className="p-3 text-center">
`;

txt = txt.replace(tableBodyRegex, newTableBody);

fs.writeFileSync(file, txt, 'utf8');
console.log('Script updated TradeModule deliveries modal.');
