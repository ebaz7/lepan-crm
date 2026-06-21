const fs = require('fs');
let file = './components/TradeModule.tsx';
let txt = fs.readFileSync(file, 'utf8');

const searchPoint1 = `{(() => {
        let usdRate = 0;
        const cType = tr.currencyType;
        if (cType === 'EUR') usdRate = 1.08;
        else if (cType === 'AED') usdRate = 0.272;
        else if (cType === 'CNY') usdRate = 0.14;
        else if (cType === 'TRY') usdRate = 0.031;
        else if (cType === 'USD') usdRate = 1;`;

const startIdx = txt.indexOf(searchPoint1);
if (startIdx !== -1) {
    const endIdx = txt.indexOf('<button', startIdx);
    
    const before = txt.substring(0, startIdx);
    const after = txt.substring(endIdx); // starts with <button
    
    const middle = `{(() => {
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

    txt = before + middle + after;

    const tfootRegex = /<td colSpan=\{3\}><\/td>/;
    txt = txt.replace(tfootRegex, '<td colSpan={5}></td>');

    fs.writeFileSync(file, txt, 'utf8');
    console.log("Fixed via index replacement");
} else {
    console.log("Could not find start index");
}
