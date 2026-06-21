const fs = require('fs');
let file = './components/TradeModule.tsx';
let txt = fs.readFileSync(file, 'utf8');

const errorRegex = /return usdRate > 0 \? \(delivery\.amount \* usdRate\)\.toLocaleString\('en-US', \{maximumFractionDigits:2\}\) \+ ' \n\s*<button /m;
if(errorRegex.test(txt)){
    console.log("Found error!");
}

// Just replace that chunk fully
const targetChunk = /<td className="p-3 font-mono font-bold text-blue-700 text-center border-l border-gray-100">\s*\{\(\(\) => \{\s*let usdRate = 0;\s*const cType = tr\.currencyType;\s*if \(cType === 'EUR'\) usdRate = 1\.08;\s*else if \(cType === 'AED'\) usdRate = 0\.272;\s*else if \(cType === 'CNY'\) usdRate = 0\.14;\s*else if \(cType === 'TRY'\) usdRate = 0\.031;\s*else if \(cType === 'USD'\) usdRate = 1;\s*return usdRate > 0 \? \(delivery\.amount \* usdRate\)\.toLocaleString\('en-US', \{maximumFractionDigits:2\}\) \+ ' \n\s*<button /m;

const replacement = `<td className="p-3 font-mono font-bold text-blue-700 text-center border-l border-gray-100">
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
    <button `;

txt = txt.replace(targetChunk, replacement);

// fix tfoot as well:
const tfootRegex = /<td colSpan=\{3\}><\/td>/;
const tfootRep = `<td colSpan={5}></td>`;
txt = txt.replace(tfootRegex, tfootRep);

fs.writeFileSync(file, txt, 'utf8');
console.log('Fixed broken table body inside TradeModule.');
