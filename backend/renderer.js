
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Correctly resolve root directory from backend folder
const ROOT_DIR = path.resolve(__dirname, '..'); 

let browser = null;

// --- FONT LOADER (ROBUST OFFLINE SUPPORT) ---
const getFontBase64 = () => {
    try {
        const pathsToCheck = [
            path.join(ROOT_DIR, 'public', 'fonts', 'Vazirmatn-Regular.woff2'),
            path.join(ROOT_DIR, 'dist', 'fonts', 'Vazirmatn-Regular.woff2'), 
            path.join(process.cwd(), 'public', 'fonts', 'Vazirmatn-Regular.woff2')
        ];

        for (const p of pathsToCheck) {
            if (fs.existsSync(p)) {
                return fs.readFileSync(p).toString('base64');
            }
        }
    } catch (e) {
        console.warn("[Renderer] Error loading font:", e.message);
    }
    return null;
};

const fontBase64 = getFontBase64();
const fontFaceRule = fontBase64 
    ? `@font-face { font-family: 'Vazirmatn'; src: url(data:font/woff2;base64,${fontBase64}) format('woff2'); font-weight: normal; font-style: normal; }`
    : `/* No Local Font Found */`;

// --- SYSTEM CHROME DETECTION (WINDOWS) ---
const findSystemChrome = () => {
    const commonPaths = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Users\\' + (process.env.USERNAME || '') + '\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe',
        // Common Chromium locations just in case
        'C:\\Program Files\\Chromium\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Chromium\\Application\\chrome.exe'
    ];

    // Check environment variable first if user set it
    if (process.env.PUPPETEER_EXECUTABLE_PATH && fs.existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
        console.log(`[Renderer] Using configured executable: ${process.env.PUPPETEER_EXECUTABLE_PATH}`);
        return process.env.PUPPETEER_EXECUTABLE_PATH;
    }

    for (const p of commonPaths) {
        if (fs.existsSync(p)) {
            console.log(`[Renderer] Found System Chrome: ${p}`);
            return p;
        }
    }
    return null;
};

const getBrowser = async () => {
    // Check if browser process is still alive and connected
    if (browser && !browser.isConnected()) {
        console.warn("[Renderer] Browser disconnected, recreating instance...");
        try { await browser.close(); } catch(e){}
        browser = null;
    }

    if (!browser) {
        try {
            console.log("[Renderer] Launching Puppeteer...");
            
            // Build Launch Config
            const launchConfig = {
                headless: "new", 
                args: [
                    '--no-sandbox', 
                    '--disable-setuid-sandbox', 
                    '--disable-dev-shm-usage', 
                    '--disable-gpu', 
                    '--font-render-hinting=none',
                    '--disable-extensions',
                    '--disable-background-networking',
                    '--disable-default-apps',
                    '--disable-sync',
                    '--hide-scrollbars',
                    '--metrics-recording-only',
                    '--mute-audio',
                    '--no-first-run',
                    '--safebrowsing-disable-auto-update'
                ],
                timeout: 60000 
            };

            // Try to find system chrome if local one might be missing
            // This is safer for Windows Service or non-standard environments
            const systemChrome = findSystemChrome();
            if (systemChrome) {
                launchConfig.executablePath = systemChrome;
            } else {
                console.log("[Renderer] No System Chrome found, trying default bundled Chromium...");
            }

            browser = await puppeteer.launch(launchConfig);
            console.log("[Renderer] Puppeteer Launched Successfully.");
        } catch (e) {
            console.error("⚠️ Puppeteer Launch Failed:", e.message);
            // Re-throw to let the caller know exactly why it failed
            throw new Error(`Puppeteer Launch Failed: ${e.message}\nIf running as Service, ensure 'chrome.exe' is installed or 'npm install' was run.`);
        }
    }
    return browser;
};

// --- STYLES ---
const BASE_STYLE = `
    ${fontFaceRule}
    * { box-sizing: border-box; }
    body { 
        font-family: 'Vazirmatn', 'Tahoma', sans-serif !important; 
        background: #fff; 
        padding: 40px; 
        direction: rtl; 
        margin: 0;
    }
    .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
    .title { font-size: 24px; font-weight: 900; color: #1e3a8a; }
    .meta { display: flex; justify-content: space-between; margin-top: 10px; font-size: 14px; color: #555; font-weight: bold; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
    th { background: #f3f4f6; padding: 12px; border: 1px solid #ddd; text-align: center; font-weight: 900; color: #333; }
    td { padding: 10px; border: 1px solid #ddd; text-align: center; color: #444; }
    tr:nth-child(even) { background-color: #fafafa; }
    .footer { margin-top: 40px; text-align: center; font-size: 10px; color: #888; border-top: 1px solid #eee; padding-top: 10px; }
    .amount { font-family: monospace; font-weight: bold; font-size: 14px; direction: ltr; }
    
    /* VOUCHER / PERMIT STYLE */
    .voucher-container { border: 2px solid #000; padding: 20px; position: relative; min-height: 500px; }
    .voucher-header { display: flex; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 15px; margin-bottom: 20px; }
    .voucher-title { font-size: 22px; font-weight: 900; }
    .voucher-meta div { margin-bottom: 5px; font-weight: bold; }
    .voucher-row { display: flex; margin-bottom: 10px; border: 1px solid #eee; padding: 10px; border-radius: 5px; background: #fcfcfc; }
    .voucher-label { width: 120px; font-weight: bold; color: #555; }
    .voucher-val { flex: 1; font-weight: bold; color: #000; }
    .voucher-signatures { display: flex; justify-content: space-between; margin-top: 50px; text-align: center; font-size: 12px; font-weight: bold; }
    .sig-box { width: 100px; height: 60px; border-bottom: 1px solid #000; margin: 0 auto; }
`;

// --- TEMPLATES ---
const generateRecordCardHTML = (title, data, type) => {
    let headerColor = '#1e40af'; // Blue
    if (type === 'EXIT') headerColor = '#c2410c'; // Orange
    if (type === 'BIJAK') headerColor = '#b91c1c'; // Red
    if (type === 'RECEIPT') headerColor = '#15803d'; // Green

    return `
    <!DOCTYPE html>
    <html lang="fa" dir="rtl">
    <head>
    <meta charset="UTF-8">
    <style>
        ${BASE_STYLE}
        body { padding: 20px; width: 800px; display: block; }
        .card { background: white; border-radius: 20px; box-shadow: none; border: 1px solid #333; overflow: hidden; }
        .card-header { background: ${headerColor}; color: white; padding: 25px; text-align: center; }
        .card-title { font-size: 32px; font-weight: 900; margin: 0; }
        .row { display: flex; justify-content: space-between; border-bottom: 2px dashed #ccc; padding: 15px 20px; font-size: 20px; }
        .label { color: #555; font-weight: bold; }
        .value { color: #000; font-weight: 900; }
    </style>
    </head>
    <body>
        <div class="card">
            <div class="card-header">
                <div class="card-title">${title}</div>
                <div style="margin-top:5px; opacity:0.9; font-size: 16px;">${new Date().toLocaleDateString('fa-IR')}</div>
            </div>
            ${data}
        </div>
    </body>
    </html>`;
};

// --- EXPORTED FUNCTIONS ---

export const generateRecordImage = async (record, type) => {
    try {
        const browser = await getBrowser();
        const page = await browser.newPage();
        await page.setViewport({ width: 800, height: 1000, deviceScaleFactor: 2 });

        let htmlData = '';
        let title = '';

        if (type === 'PAYMENT') {
            title = 'دستور پرداخت وجه';
            htmlData = `
                <div class="row"><span class="label">شماره سند:</span><span class="value">#${record.trackingNumber}</span></div>
                <div class="row"><span class="label">درخواست کننده:</span><span class="value">${record.requester}</span></div>
                <div class="row"><span class="label">ذینفع:</span><span class="value">${record.payee}</span></div>
                <div class="row"><span class="label">مبلغ:</span><span class="value amount" style="color:#1e40af">${parseInt(record.totalAmount).toLocaleString()}</span></div>
                <div class="row"><span class="label">شرکت:</span><span class="value">${record.payingCompany}</span></div>
                <div class="row"><span class="label">بابت:</span><span class="value" style="font-size: 16px;">${record.description}</span></div>
                <div class="row"><span class="label">وضعیت:</span><span class="value">${record.status}</span></div>
            `;
        } else if (type === 'EXIT') {
            const shamsiDate = toShamsiFull(record.date);
            const displayItems = record.items && record.items.length > 0 ? record.items : [{ goodsName: record.goodsName || '', cartonCount: record.cartonCount || 0, weight: record.weight || 0, deliveredCartonCount: record.cartonCount || 0, deliveredWeight: record.weight || 0 }];
            const displayDestinations = record.destinations && record.destinations.length > 0 ? record.destinations : [{ recipientName: record.recipientName || '', address: record.destinationAddress || '', phone: '' }];
            
            const totalCartonsReq = displayItems.reduce((acc, i) => acc + (Number(i.cartonCount) || 0), 0);
            const totalWeightReq = displayItems.reduce((acc, i) => acc + (Number(i.weight) || 0), 0);
            const totalCartonsDel = displayItems.reduce((acc, i) => acc + (Number(i.deliveredCartonCount ?? i.cartonCount) || 0), 0);
            const totalWeightDel = displayItems.reduce((acc, i) => acc + (Number(i.deliveredWeight ?? i.weight) || 0), 0);
            const showDeliveryColumns = displayItems.some(i => i.deliveredCartonCount !== undefined);

            const itemsRows = displayItems.map((item, idx) => `
                <tr class="text-base">
                    <td class="border-2 border-black p-2 font-bold">${idx + 1}</td>
                    <td class="border-2 border-black p-2 font-extrabold text-center align-middle">${item.goodsName}</td>
                    ${showDeliveryColumns ? `
                        <td class="border-2 border-black p-2 font-mono text-gray-400 bg-gray-50/50">${item.cartonCount}</td>
                        <td class="border-2 border-black p-2 font-mono font-black bg-green-50/30">${item.deliveredCartonCount ?? item.cartonCount}</td>
                        <td class="border-2 border-black p-2 font-mono text-gray-400 bg-gray-50/50">${item.weight}</td>
                        <td class="border-2 border-black p-2 font-mono font-black bg-green-50/30">${item.deliveredWeight ?? item.weight}</td>
                    ` : `
                        <td class="border-2 border-black p-2 font-mono font-black">${item.cartonCount}</td>
                        <td class="border-2 border-black p-2 font-mono font-black">${item.weight}</td>
                    `}
                </tr>
            `).join('');

            const destsHtml = displayDestinations.map((dest, idx) => `
                <div class="${idx > 0 ? 'border-t-2 border-gray-200 mt-2 pt-2' : ''}">
                    <div class="grid grid-cols-2 gap-4">
                        <div><span class="font-bold text-gray-500 ml-2 text-xs">تحویل گیرنده:</span> <span class="font-black text-xl">${dest.recipientName}</span></div>
                        <div><span class="font-bold text-gray-500 ml-2 text-xs">شماره تماس:</span> <span class="font-mono font-black text-lg text-left">${dest.phone || '-'}</span></div>
                    </div>
                    <div class="mt-1"><span class="font-bold text-gray-500 ml-2 text-xs">آدرس مقصد:</span> <span class="font-bold text-sm">${dest.address}</span></div>
                </div>
            `).join('');

            const html = `<!DOCTYPE html><html lang="fa" dir="rtl"><head><meta charset="UTF-8">
            <script src="https://cdn.tailwindcss.com"></script>
            <style>
                ${fontFaceRule}
                * { box-sizing: border-box; }
                body { background: white; padding: 0 !important; font-family: 'Vazirmatn', sans-serif !important; }
                .stamp { border: 2.5px solid #1e40af; color: #1e40af; border-radius: 12px; padding: 8px; transform: rotate(-5deg); text-align: center; background: white; min-width: 95px; opacity: 0.9; }
                .stamp.black { border-color: black; color: black; }
                .stamp-title { font-size: 10px; font-weight: bold; border-bottom: 1.5px solid currentColor; margin-bottom: 4px; padding-bottom: 4px; text-align: center; }
                .stamp-name { font-size: 14px; font-weight: 900; text-align: center; }
                #capture-wrapper { 
                    padding: 10mm; 
                    margin: 0 auto; 
                    width: 210mm; 
                    height: 296mm;
                    background: white; 
                    direction: rtl; 
                    display: flex;
                    flex-direction: column;
                    box-sizing: border-box;
                    overflow: hidden;
                }
            </style>
            </head><body>
            <div id="capture-wrapper">
                <div class="flex justify-between items-center border-b-[5px] border-black pb-4 mb-4">
                    <div class="flex flex-col"><h1 class="text-4xl font-black mb-1">مجوز خروج کالا از کارخانه</h1><p class="text-base font-bold text-gray-600">سیستم مکانیزه مدیریت بار و خروج</p></div>
                    <div class="text-left space-y-2"><div class="text-2xl font-black bg-gray-100 px-6 py-2 border-[3px] border-black rounded-xl text-center">شماره: ${record.permitNumber}</div><div class="text-sm font-bold text-center">تاریخ: ${shamsiDate}</div></div>
                </div>
                
                <div class="flex-1 space-y-6">
                    <div class="space-y-1">
                        <h3 class="font-black text-xl mb-1 flex items-center gap-2">📦 لیست اقلام و کالاها</h3>
                        <table class="w-full text-sm border-collapse border-[3px] border-black text-center">
                            <thead>
                                <tr class="bg-gray-100 text-base">
                                    <th class="border-[2.5px] border-black p-2 w-10" rowspan="${showDeliveryColumns ? 2 : 1}">#</th>
                                    <th class="border-[2.5px] border-black p-2 text-center" rowspan="${showDeliveryColumns ? 2 : 1}">شرح کالا / محصول</th>
                                    <th class="border-[2.5px] border-black p-1" colspan="${showDeliveryColumns ? 2 : 1}">تعداد (کارتن)</th>
                                    <th class="border-[2.5px] border-black p-1" colspan="${showDeliveryColumns ? 2 : 1}">وزن (KG)</th>
                                </tr>
                                ${showDeliveryColumns ? `
                                <tr class="bg-gray-50 text-xs">
                                    <th class="border-[2px] border-black p-1 text-gray-400 w-20">درخواستی</th><th class="border-[2px] border-black p-1 w-20 bg-green-50 text-green-800">خروجی</th>
                                    <th class="border-[2px] border-black p-1 text-gray-400 w-20">درخواستی</th><th class="border-[2px] border-black p-1 w-20 bg-green-50 text-green-800">خروجی</th>
                                </tr>
                                ` : ''}
                            </thead>
                            <tbody>
                                ${itemsRows}
                                <tr class="bg-gray-100 text-lg font-black">
                                    <td colspan="2" class="border-[2.5px] border-black p-3 text-left pl-8">جمع کل:</td>
                                    ${showDeliveryColumns ? `
                                        <td class="border-[2.5px] border-black p-2 font-mono text-gray-500">${totalCartonsReq}</td>
                                        <td class="border-[2.5px] border-black p-2 font-mono text-black">${totalCartonsDel}</td>
                                        <td class="border-[2.5px] border-black p-2 font-mono text-gray-500">${totalWeightReq}</td>
                                        <td class="border-[2.5px] border-black p-2 font-mono text-black">${totalWeightDel}</td>
                                    ` : `
                                        <td class="border-[2.5px] border-black p-2 font-mono">${totalCartonsReq}</td>
                                        <td class="border-[2.5px] border-black p-2 font-mono">${totalWeightReq}</td>
                                    `}
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div class="space-y-1">
                        <h3 class="font-black text-xl mb-1 flex items-center gap-2">📍 مشخصات گیرنده</h3>
                        <div class="border-[3px] border-black rounded-2xl p-4 bg-gray-50">${destsHtml}</div>
                    </div>

                    ${(record.driverName || record.plateNumber) ? `
                    <div class="space-y-1">
                        <h3 class="font-black text-xl mb-1 flex items-center gap-2">🚛 مشخصات حمل</h3>
                        <div class="border-[3px] border-black rounded-2xl p-4 bg-gray-50 text-sm flex gap-12">
                            <div><span class="font-bold text-gray-500 ml-2">نام راننده:</span> <span class="font-black text-2xl">${record.driverName || '-'}</span></div>
                            <div><span class="font-bold text-gray-500 ml-2">شماره پلاک:</span> <span class="font-mono font-black text-2xl" dir="ltr">${record.plateNumber || '-'}</span></div>
                        </div>
                    </div>` : ''}

                    ${record.description ? `<div class="space-y-1"><h3 class="font-black text-xl mb-1">توضیحات</h3><div class="border-[3px] border-black rounded-2xl p-4 bg-white text-sm min-h-[50px] font-bold">${record.description}</div></div>` : ''}
                </div>

                <div class="mt-auto pt-6 border-t-[5px] border-black grid grid-cols-5 gap-2 text-center items-end">
                    <div class="flex flex-col items-center justify-between min-h-[90px]"><div class="mb-2 flex items-center justify-center h-full"><div class="stamp"><div class="stamp-title">مدیر فروش</div><div class="stamp-name">${record.requester || '-'}</div></div></div><div class="w-full border-t-2 border-gray-400 pt-1 text-[11px] font-bold text-gray-500">درخواست کننده</div></div>
                    <div class="flex flex-col items-center justify-between min-h-[90px]"><div class="mb-2 flex items-center justify-center h-full">${record.approverCeo ? `<div class="stamp"><div class="stamp-title">مدیریت</div><div class="stamp-name">${record.approverCeo}</div></div>` : '<span class="text-gray-300 text-xs font-bold">---</span>'}</div><div class="w-full border-t-2 border-gray-400 pt-1 text-[11px] font-bold text-gray-500">مدیرعامل</div></div>
                    <div class="flex flex-col items-center justify-between min-h-[90px]"><div class="mb-2 flex items-center justify-center h-full">${record.approverFactory ? `<div class="stamp"><div class="stamp-title">مدیر کارخانه</div><div class="stamp-name">${record.approverFactory}</div></div>` : '<span class="text-gray-300 text-xs font-bold">---</span>'}</div><div class="w-full border-t-2 border-gray-400 pt-1 text-[11px] font-bold text-gray-500">مدیر کارخانه</div></div>
                    <div class="flex flex-col items-center justify-between min-h-[90px]"><div class="mb-2 flex items-center justify-center h-full">${record.approverWarehouse ? `<div class="stamp"><div class="stamp-title">تحویل انبار</div><div class="stamp-name">${record.approverWarehouse}</div></div>` : '<span class="text-gray-300 text-xs font-bold">---</span>'}</div><div class="w-full border-t-2 border-gray-400 pt-1 text-[11px] font-bold text-gray-500">سرپرست انبار</div></div>
                    <div class="flex flex-col items-center justify-between min-h-[90px]">
                        <div class="mb-2 flex items-center justify-center h-full">
                            ${record.status === 'خارج شد' || record.status === 'خارج شده (بایگانی)' ? `
                                <div class="stamp black">
                                    <div class="stamp-title">انتظامات / خروج</div>
                                    <div class="stamp-name">${record.approverSecurity || 'نگهبان'}</div>
                                    ${record.exitTime ? `
                                        <div class="mt-2 border-t border-dashed border-gray-400 pt-1">
                                            <div class="text-[9px] font-black text-center">ساعت خروج:</div>
                                            <div class="text-2xl font-black text-center font-mono leading-none">${record.exitTime}</div>
                                        </div>
                                    ` : ''}
                                </div>
                            ` : '<div class="border-[3px] border-dashed border-gray-300 rounded-2xl p-3 h-20 w-24 flex items-center justify-center text-gray-300 text-[10px] font-bold">امضاء انتظامات</div>'}
                        </div>
                        <div class="w-full border-t-[3px] border-black pt-1 text-[11px] font-black text-black">تایید خروج</div>
                    </div>
                </div>
                <div class="mt-3 border-t border-gray-300 text-[10px] text-gray-400 text-center font-bold">نسخه چاپی سیستم مدیریت هوشمند بار</div>
            </div></body></html>`;

            // Make viewport wide enough
            await page.setViewport({ width: 900, height: 1300, deviceScaleFactor: 2 });
            await page.setContent(html, { waitUntil: 'networkidle0' });
            
            const card = await page.$('#capture-wrapper');
            const buffer = await card.screenshot({ type: 'png' });
            await page.close();
            return buffer;

        } else if (type === 'BIJAK' || type === 'RECEIPT') {
            title = type === 'BIJAK' ? 'حواله خروج (بیجک)' : 'رسید ورود کالا';
            htmlData = `
                <div class="row"><span class="label">شماره سند:</span><span class="value">#${record.number || record.proformaNumber}</span></div>
                <div class="row"><span class="label">شرکت:</span><span class="value">${record.company}</span></div>
                <div class="row"><span class="label">${type === 'BIJAK' ? 'گیرنده' : 'فرستنده'}:</span><span class="value">${type === 'BIJAK' ? record.recipientName : record.proformaNumber}</span></div>
                <div class="row"><span class="label">تعداد اقلام:</span><span class="value">${record.items.length} قلم</span></div>
                <div class="row"><span class="label">راننده:</span><span class="value">${record.driverName || '-'}</span></div>
            `;
        }

        await page.setContent(generateRecordCardHTML(title, htmlData, type), { waitUntil: 'networkidle0' });
        const card = await page.$('.card');
        const buffer = await card.screenshot({ type: 'png' });
        await page.close();
        return buffer;
    } catch (e) {
        console.error("Renderer Image Error:", e.message);
        throw e;
    }
};

export const generatePdfBuffer = async (html) => {
    try {
        const browser = await getBrowser();
        const page = await browser.newPage();
        let finalHtml = html;
        if (!html.includes('@font-face') && fontFaceRule) {
            finalHtml = html.replace('<head>', `<head><style>${fontFaceRule} body { font-family: 'Vazirmatn' !important; }</style>`);
        } else if (!html.includes('<head>')) {
             finalHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${BASE_STYLE}</style></head><body>${html}</body></html>`;
        }
        
        await page.setContent(finalHtml, { waitUntil: 'networkidle0' });
        const pdf = await page.pdf({ format: 'A4', printBackground: true });
        await page.close();
        return pdf;
    } catch(e) {
        console.error("Renderer PDF Buffer Error:", e.message);
        throw e;
    }
};

// 1. Voucher PDF
export const generateVoucherPDF = async (order) => {
    try {
        const browser = await getBrowser();
        const page = await browser.newPage();
        const linesHtml = order.paymentDetails.map((d, i) => `<tr><td>${i+1}</td><td>${d.method}</td><td class="amount">${parseInt(d.amount).toLocaleString()}</td><td>${d.bankName || '-'}</td><td>${d.description || '-'}</td></tr>`).join('');
        const html = `<!DOCTYPE html><html lang="fa" dir="rtl"><head><meta charset="UTF-8"><style>${BASE_STYLE}</style></head><body>
            <div class="voucher-container">
                <div class="voucher-header"><div><div class="voucher-title">${order.payingCompany}</div><div>رسید دستور پرداخت</div></div><div class="voucher-meta"><div>شماره: ${order.trackingNumber}</div><div>تاریخ: ${new Date(order.date).toLocaleDateString('fa-IR')}</div></div></div>
                <div class="voucher-row"><span class="voucher-label">در وجه:</span><span class="voucher-val">${order.payee}</span></div>
                <div class="voucher-row"><span class="voucher-label">مبلغ:</span><span class="voucher-val amount">${parseInt(order.totalAmount).toLocaleString()}</span></div>
                <table><thead><tr><th>#</th><th>روش</th><th>مبلغ</th><th>بانک</th><th>شرح</th></tr></thead><tbody>${linesHtml}</tbody></table>
            </div></body></html>`;
        await page.setContent(html, { waitUntil: 'networkidle0' });
        const pdf = await page.pdf({ format: 'A5', landscape: true, printBackground: true });
        await page.close();
        return pdf;
    } catch (e) { 
        console.error("Generate Voucher PDF Error:", e.message);
        throw e;
    }
};

// 2. Exit Permit PDF
export const generateExitPermitPDF = async (permit) => {
    try {
        const browser = await getBrowser();
        const page = await browser.newPage();
        const itemsHtml = permit.items.map((i, idx) => `<tr><td>${idx+1}</td><td>${i.goodsName}</td><td>${i.cartonCount}</td><td>${i.weight}</td></tr>`).join('');
        const html = `<!DOCTYPE html><html lang="fa" dir="rtl"><head><meta charset="UTF-8"><style>${BASE_STYLE}</style></head><body>
            <div class="voucher-container" style="min-height: 800px;">
                <div class="voucher-header"><div><div class="voucher-title">${permit.company}</div><div>مجوز خروج کالا</div></div><div class="voucher-meta"><div>شماره: ${permit.permitNumber}</div><div>تاریخ: ${new Date(permit.date).toLocaleDateString('fa-IR')}</div></div></div>
                <div class="voucher-row"><span class="voucher-label">گیرنده:</span><span class="voucher-val">${permit.recipientName}</span></div>
                <div class="voucher-row"><span class="voucher-label">راننده:</span><span class="voucher-val">${permit.driverName || '-'}</span></div>
                <table><thead><tr><th>#</th><th>کالا</th><th>تعداد</th><th>وزن</th></tr></thead><tbody>${itemsHtml}</tbody></table>
                <div class="voucher-signatures" style="margin-top:100px"><div><div class="sig-box"></div><div>فروش</div></div><div><div class="sig-box"></div><div>مدیریت</div></div><div><div class="sig-box"></div><div>انبار</div></div><div><div class="sig-box"></div><div>انتظامات</div></div></div>
            </div></body></html>`;
        await page.setContent(html, { waitUntil: 'networkidle0' });
        const pdf = await page.pdf({ format: 'A4', printBackground: true });
        await page.close();
        return pdf;
    } catch (e) {
        console.error("Generate Exit Permit PDF Error:", e.message);
        throw e;
    }
};

// 3. Bijak PDF
export const generateBijakPDF = async (tx) => {
    try {
        const browser = await getBrowser();
        const page = await browser.newPage();
        const itemsHtml = tx.items.map((i, idx) => `<tr><td>${idx+1}</td><td>${i.itemName}</td><td>${i.quantity}</td><td>${i.weight}</td></tr>`).join('');
        const html = `<!DOCTYPE html><html lang="fa" dir="rtl"><head><meta charset="UTF-8"><style>${BASE_STYLE}</style></head><body>
            <div class="voucher-container">
                <div class="voucher-header"><div><div class="voucher-title">${tx.company}</div><div>حواله خروج (بیجک)</div></div><div class="voucher-meta"><div>شماره: ${tx.number}</div><div>تاریخ: ${new Date(tx.date).toLocaleDateString('fa-IR')}</div></div></div>
                <div class="voucher-row"><span class="voucher-label">گیرنده:</span><span class="voucher-val">${tx.recipientName}</span></div>
                <div class="voucher-row"><span class="voucher-label">راننده:</span><span class="voucher-val">${tx.driverName || '-'} (${tx.plateNumber||'-'})</span></div>
                <table><thead><tr><th>#</th><th>کالا</th><th>تعداد</th><th>وزن</th></tr></thead><tbody>${itemsHtml}</tbody></table>
                <div class="voucher-signatures"><div><div class="sig-box"></div><div>انباردار</div></div><div><div class="sig-box"></div><div>مدیریت</div></div><div><div class="sig-box"></div><div>راننده</div></div></div>
            </div></body></html>`;
        await page.setContent(html, { waitUntil: 'networkidle0' });
        const pdf = await page.pdf({ format: 'A5', landscape: false, printBackground: true });
        await page.close();
        return pdf;
    } catch (e) {
        console.error("Generate Bijak PDF Error:", e.message);
        throw e;
    }
};

// 4. Report PDF
export const generateReportPDF = async (title, columns, rows, landscape = false) => {
    try {
        const browser = await getBrowser();
        const page = await browser.newPage();
        
        let thead = '<tr>';
        columns.forEach(c => thead += `<th>${c}</th>`);
        thead += '</tr>';

        let tbody = '';
        rows.forEach(r => {
            tbody += '<tr>';
            r.forEach(cell => tbody += `<td>${cell}</td>`);
            tbody += '</tr>';
        });

        const html = `<!DOCTYPE html><html lang="fa" dir="rtl"><head><meta charset="UTF-8"><style>${BASE_STYLE}</style></head><body>
            <div class="header">
                <div class="title">${title}</div>
                <div class="meta"><span>تاریخ گزارش: ${new Date().toLocaleDateString('fa-IR')}</span></div>
            </div>
            <table>
                <thead>${thead}</thead>
                <tbody>${tbody}</tbody>
            </table>
            <div class="footer">سیستم مدیریت مالی و انبار - گزارش سیستمی</div>
        </body></html>`;

        await page.setContent(html, { waitUntil: 'networkidle0' });
        const pdf = await page.pdf({ format: 'A4', landscape, printBackground: true });
        await page.close();
        return pdf;
    } catch (e) { 
        console.error("Generate Report PDF Error:", e.message);
        throw e;
    }
};
