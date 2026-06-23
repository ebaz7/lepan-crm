const fs = require('fs');
let file = './components/reports/CurrencyReport.tsx';
let txt = fs.readFileSync(file, 'utf8');

const printTheadRegex = /<colgroup>[\s\S]*?<\/colgroup>\s*<thead>[\s\S]*?<\/thead>/;
const newPrintThead = `<colgroup>
    <col style={{width: '25px'}} />
    <col />
    <col />
    <col style={{width: '65px'}} />
    <col style={{width: '65px'}} />
    <col style={{width: '75px'}} />
    <col style={{width: '65px'}} />
    <col style={{width: '60px'}} />
    <col style={{width: '40px'}} />
    <col style={{width: '60px'}} />
    <col style={{width: '75px'}} />
    <col style={{width: '65px'}} />
    <col style={{width: '60px'}} />
    <col style={{width: '65px'}} />
    <col style={{width: '60px'}} />
    <col style={{width: '45px'}} />
    <col style={{width: '60px'}} />
    <col style={{width: '50px'}} />
</colgroup>
<thead>
    <tr className="bg-[#1e40af] text-white font-black text-[9px] border-black">
        <th className="border border-black p-1 align-middle text-center bg-[#1e40af] text-white">ردیف</th>
        <th className="border border-black p-1 align-middle text-center bg-[#1e40af] text-white">شرح کالا</th>
        <th className="border border-black p-1 align-middle text-center bg-[#1e40af] text-white">توضیحات</th>
        <th className="border border-black p-1 align-middle text-center bg-[#1e40af] text-white">پرونده</th>
        <th className="border border-black p-1 align-middle text-center bg-[#1e40af] text-white">ثبت سفارش</th>
        <th className="border border-black p-1 align-middle text-center bg-[#1e40af] text-white">نام شرکت</th>
        <th className="border border-black p-1 align-middle text-center bg-[#1e3a8a] text-white">معادل دلار</th>
        <th className="border border-black p-1 align-middle text-center bg-[#1e3a8a] text-white">مقدار ارز</th>
        <th className="border border-black p-1 align-middle text-center bg-[#1e3a8a] text-white">نوع</th>
        <th className="border border-black p-1 align-middle text-center bg-[#1e40af] text-white">تاریخ خرید</th>
        <th className="border border-black p-1 align-middle text-center bg-[#1e40af] text-white">بهای ارز (ریال)</th>
        <th className="border border-black p-1 align-middle text-center bg-[#1e40af] text-white">صرافی</th>
        <th className="border border-black p-1 align-middle text-center bg-[#1e40af] text-white">کارگزار</th>
        <th className="border border-black p-1 align-middle text-center bg-[#1e40af] text-white">بانک</th>
        <th className="border border-black p-1 align-middle text-center bg-[#14532d] text-white">تحویلی</th>
        <th className="border border-black p-1 align-middle text-center bg-[#14532d] text-white">وضعیت</th>
        <th className="border border-black p-1 align-middle text-center bg-[#1e40af] text-white">عودت</th>
        <th className="border border-black p-1 align-middle text-center bg-[#1e40af] text-white">ت. عودت</th>
    </tr>
</thead>`;

if(printTheadRegex.test(txt)){
    txt = txt.replace(printTheadRegex, newPrintThead);
} else {
    console.log("Could not find print thead");
}

const printBodyClass = /<tr className="border border-black text-black leading-tight text-\[10px\]">/g;
txt = txt.replace(printBodyClass, '<tr className={`border border-black ${globalIdx % 2 === 0 ? "bg-slate-50" : "bg-white"} leading-tight text-[10px]`}>');

const tdAlignRegex = /<td className="border border-black p-1/g;
txt = txt.replace(tdAlignRegex, '<td className="border border-black p-1 align-middle text-center');

fs.writeFileSync(file, txt, 'utf8');
console.log('Script updated print headers and rows.');
