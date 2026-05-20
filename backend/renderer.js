
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

export const generateRecordImage = async (record, type, options = {}) => {
    try {
        const { isEdit, isDelete } = options;
        const browser = await getBrowser();
        const page = await browser.newPage();
        await page.setViewport({ width: 800, height: 1000, deviceScaleFactor: 2 });

        let htmlData = '';
        let title = '';

        if (type === 'PAYMENT') {
            title = 'دستور پرداخت وجه';
            if (isEdit) title += ' (ویرایش شده)';
            if (isDelete) title += ' (حذف شده)';
            const banks = (record.paymentDetails && record.paymentDetails.length > 0) 
                ? [...new Set(record.paymentDetails.map(d => d.bankName || d.method || 'صندوق / نقدی').filter(Boolean))].join('، ')
                : 'صندوق / نقدی';

            htmlData = `
                <div class="row"><span class="label">شماره پیگیری:</span><span class="value">#${record.trackingNumber}</span></div>
                <div class="row"><span class="label">نام ذینفع:</span><span class="value" style="font-size: 24px;">${record.payee}</span></div>
                <div class="row"><span class="label">مبلغ پرداختی:</span><span class="value amount" style="color:#1e40af; font-size: 28px;">${parseInt(record.totalAmount).toLocaleString()} ریال</span></div>
                <div class="row"><span class="label">بانک / منبع پرداخت:</span><span class="value" style="color:#b91c1c">${banks}</span></div>
                <div class="row"><span class="label">شرکت پرداخت‌کننده:</span><span class="value">${record.payingCompany}</span></div>
                <div class="row"><span class="label">بابت / شرح:</span><span class="value" style="font-size: 16px; border: 1px solid #eee; padding: 10px; border-radius: 8px; background: #fafafa; display: block; width: 100%; text-align: right; margin-top: 5px;">${record.description}</span></div>
                <div class="row" style="margin-top: 15px; border-top: 2px solid #eee; padding-top: 10px;"><span class="label">درخواست‌کننده:</span><span class="value">${record.requester}</span></div>
                <div class="row"><span class="label">وضعیت نهایی:</span><span class="value" style="color: ${record.status.includes('تایید') ? '#15803d' : '#444'}">${record.status}</span></div>
            `;
        } else if (type === 'EXIT' || type === 'CUSTOMER_INVOICE') {
            const isInvoice = type === 'CUSTOMER_INVOICE';
            const showDelivery = record.items && record.items.some(i => i.deliveredCartonCount !== undefined);
            const itemsToRender = (record.items && record.items.length > 0) 
                ? record.items 
                : [{ goodsName: record.goodsName || 'نامشخص', cartonCount: record.cartonCount || 0, weight: record.weight || 0 }];
            
            const totalCartons = itemsToRender.reduce((acc, i) => acc + (Number(i.cartonCount) || 0), 0);
            const totalWeight = itemsToRender.reduce((acc, i) => acc + (Number(i.weight) || 0), 0);
            const totalDelCartons = showDelivery ? itemsToRender.reduce((acc, i) => acc + (Number(i.deliveredCartonCount ?? 0) || 0), 0) : totalCartons;
            const totalDelWeight = showDelivery ? itemsToRender.reduce((acc, i) => acc + (Number(i.deliveredWeight ?? 0) || 0), 0) : totalWeight;

            const itemsHtml = itemsToRender.map((i, idx) => `
                <tr class="text-base">
                    <td class="border-2 border-black p-2">${idx+1}</td>
                    <td class="border-2 border-black p-2 font-bold text-center">${i.goodsName}</td>
                    ${showDelivery ? `
                        <td class="border-2 border-black p-2 font-mono text-gray-400 bg-gray-50">${i.cartonCount}</td>
                        <td class="border-2 border-black p-2 font-mono font-bold bg-green-50">${i.deliveredCartonCount ?? i.cartonCount}</td>
                        <td class="border-2 border-black p-2 font-mono text-gray-400 bg-gray-50">${i.weight}</td>
                        <td class="border-2 border-black p-2 font-mono font-bold bg-green-50">${i.deliveredWeight ?? i.weight}</td>
                    ` : `
                        <td class="border-2 border-black p-2 font-mono font-bold">${i.cartonCount}</td>
                        <td class="border-2 border-black p-2 font-mono font-bold">${i.weight}</td>
                    `}
                </tr>
            `).join('');

            const destsHtml = (record.destinations || [{recipientName: record.recipientName, address: record.destinationAddress, phone: ''}]).map(d => `
                <div class="border-b-2 border-gray-200 pb-2 mb-2 last:border-0 last:pb-0">
                    <div class="flex justify-between mb-1">
                        <div><span class="font-bold text-gray-500 ml-2">تحویل گیرنده:</span> <span class="font-bold text-lg">${d.recipientName}</span></div>
                        <div><span class="font-bold text-gray-500 ml-2">شماره تماس:</span> <span class="font-mono font-bold text-lg dir-ltr">${d.phone || '-'}</span></div>
                    </div>
                    <div><span class="font-bold text-gray-500 ml-2">آدرس مقصد:</span> <span class="font-bold">${d.address || '-'}</span></div>
                </div>
            `).join('');

            const formatDateSafe = (dateVal) => {
                if (!dateVal) return '-';
                try {
                    const iso = String(dateVal).split('T')[0];
                    const parts = iso.split('-');
                    if (parts.length === 3) {
                        return new Date(parts[0], parts[1]-1, parts[2], 12).toLocaleDateString('fa-IR');
                    }
                    return new Date(dateVal).toLocaleDateString('fa-IR');
                } catch(e) { return '-'; }
            };

            const html = `<!DOCTYPE html><html lang="fa" dir="rtl"><head><meta charset="UTF-8">
            <script src="https://cdn.tailwindcss.com"></script>
            <style>
                ${fontFaceRule}
                body { background: white; padding: 0 !important; font-family: 'Vazirmatn', sans-serif !important; margin: 0; }
                .watermark-badge { position: absolute; top: 40px; left: 40px; font-size: 40px; font-weight: 900; opacity: 0.2; transform: rotate(-15deg); user-select: none; border: 4px solid; padding: 5px 20px; border-radius: 12px; z-index: 50; }
                .badge-edit { color: #d97706; border-color: #d97706; }
                .badge-delete { color: #dc2626; border-color: #dc2626; opacity: 0.4; }
                #capture-wrapper { 
                    padding: 10mm; 
                    margin: 0 auto; 
                    width: 210mm; 
                    background: white; 
                    direction: rtl; 
                    display: flex;
                    flex-direction: column;
                    box-sizing: border-box;
                    color: black;
                    position: relative;
                }
                .stamp { border: 2px solid #1e40af; color: #1e40af; border-radius: 10px; padding: 6px; transform: rotate(-3deg); text-align: center; background: white; min-width: 80px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); display: inline-block; }
                .stamp.black { border-color: black; color: black; }
                .stamp-title { font-size: 9px; font-weight: bold; border-bottom: 1px solid #1e40af; margin-bottom: 3px; padding-bottom: 1px; }
                .stamp.black .stamp-title { border-color: black; }
                .stamp-name { font-size: 12px; font-weight: 900; }
                table { width: 100%; border-collapse: collapse; border: 2px solid black; margin-top: 10px; text-align: center; }
                th, td { border: 2px solid black; padding: 6px; }
                th { background-color: #f3f4f6; }
                .meta-section { border-bottom: 2px solid black; padding-bottom: 10px; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center; }
                .invoice-header { background: #1e3a8a; color: white; padding: 20px; border-radius: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
                .invoice-table th { background: #1e3a8a; color: white; border-color: #1e3a8a; }
                .invoice-table td { border-color: #e5e7eb; }
                .invoice-total { background: #eff6ff; font-weight: 900; }
            </style>
            </head><body>
            <div id="capture-wrapper">
                ${isEdit ? '<div class="watermark-badge badge-edit">ویرایش شده</div>' : ''}
                ${isDelete ? '<div class="watermark-badge badge-delete">حذف شده</div>' : ''}
                
                ${isInvoice ? `
                    <div class="invoice-header">
                        <div>
                            <h1 style="font-size: 28px; font-weight: 900; margin: 0;">پیش‌فاکتور فروش کالا</h1>
                            <p style="font-size: 14px; opacity: 0.8; margin: 0;">سند تایید تحویل کالا و بارنامه پیوست</p>
                        </div>
                        <div style="text-align: left;">
                            <div style="font-size: 20px; font-weight: 900; border: 2px solid white; padding: 5px 15px; border-radius: 8px;">No: ${record.permitNumber}</div>
                            <div style="font-size: 12px; margin-top: 5px;">تاریخ: ${formatDateSafe(record.date)}</div>
                        </div>
                    </div>
                ` : `
                    <div class="meta-section">
                        <div><h1 style="font-size: 22px; font-weight: 900; margin: 0;">مجوز خروج کالا از کارخانه</h1><p style="font-size: 12px; font-weight: bold; color: #4b5563; margin: 0;">سیستم مکانیزه مدیریت بار و خروج</p></div>
                        <div style="text-align: left;"><div style="font-size: 16px; font-weight: 900; background: #e5e7eb; padding: 6px 12px; border: 2px solid black; border-radius: 6px;">شماره: ${record.permitNumber}</div><div style="font-size: 12px; font-weight: bold; margin-top: 3px;">تاریخ: ${formatDateSafe(record.date)}</div></div>
                    </div>
                `}

                <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px; margin-bottom: 15px;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 13px;">
                        <div>
                            <div style="color: #6b7280; font-weight: bold; margin-bottom: 3px;">${isInvoice ? 'خریدار / گیرنده کالا:' : 'مقصد / تحویل گیرنده:'}</div>
                            ${isInvoice ? `<div style="font-size: 18px; font-weight: 900; color: #1e3a8a;">${record.recipientName}</div><div style="font-size: 11px; color: #4b5563; margin-top: 5px;">${record.destinationAddress || '-'}</div>` : destsHtml}
                        </div>
                        <div>
                            <div style="color: #6b7280; font-weight: bold; margin-bottom: 3px;">مشخصات حمل و راننده:</div>
                            <div style="display: flex; flex-direction: column; gap: 4px;">
                                <div><span style="color: #6b7280; margin-left: 2px;">نام:</span> <b style="font-size: 14px;">${record.driverName || '-'}</b></div>
                                <div><span style="color: #6b7280; margin-left: 2px;">موبایل:</span> <b style="font-size: 14px; font-family: monospace;">${record.driverPhone || '-'}</b></div>
                                <div><span style="color: #6b7280; margin-left: 2px;">پلاک:</span> <b dir="ltr" style="display: inline-block; font-size: 14px; border: 1px solid #333; padding: 1px 4px; border-radius: 4px; background: white;">${record.plateNumber || '-'}</b></div>
                            </div>
                        </div>
                    </div>
                </div>

                <div style="flex: 1;">
                    <h3 style="margin-bottom: 5px; font-weight: bold;">${isInvoice ? 'شرح اقلام فاکتور' : 'لیست اقلام و کالاها'}</h3>
                    <table class="${isInvoice ? 'invoice-table' : ''}">
                        <thead>
                            <tr style="font-weight: bold; font-size: 11px;">
                                <th style="width: 40px;">#</th>
                                <th>شرح کالا / خدمات</th>
                                <th style="width: 80px;">تعداد (کارتن)</th>
                                <th style="width: 100px;">وزن (KG)</th>
                                ${isInvoice ? `
                                    <th style="width: 120px;">فی (ریال)</th>
                                    <th style="width: 150px;">جمع کل</th>
                                ` : ''}
                            </tr>
                        </thead>
                        <tbody style="font-size: 12px;">
                            ${(record.items||[{goodsName: record.goodsName, cartonCount: record.cartonCount, deliveredCartonCount: record.deliveredCartonCount, weight: record.weight, deliveredWeight: record.deliveredWeight, price: record.price}]).map((i, idx) => {
                                const qty = i.deliveredCartonCount ?? i.cartonCount ?? 0;
                                const weight = i.deliveredWeight ?? i.weight ?? 0;
                                const price = i.price || 0;
                                return `
                                <tr>
                                    <td>${idx+1}</td>
                                    <td style="font-weight: bold; text-align: right; padding-right: 15px;">${i.goodsName}</td>
                                    <td style="font-weight: 900;">${qty}</td>
                                    <td>${Number(weight).toFixed(2)}</td>
                                    ${isInvoice ? `
                                        <td style="font-family: monospace; font-size: 13px;">${Number(price).toLocaleString()}</td>
                                        <td style="font-family: monospace; font-weight: 900; background: #f8fafc; font-size: 14px; color: #1e3a8a;">${(qty * price).toLocaleString()}</td>
                                    ` : ''}
                                </tr>
                            `;}).join('')}
                            ${isInvoice ? `
                                <tr class="invoice-total">
                                    <td colspan="5" style="text-align: left; padding-left: 20px; font-size: 14px; font-weight: 900; border-top: 2px solid #1e3a8a;">جمع کل قابل پرداخت:</td>
                                    <td style="font-size: 20px; color: white; background: #1e3a8a; border: 2px solid #1e3a8a;">${(record.items||[]).reduce((sum, item) => sum + ((item.deliveredCartonCount ?? item.cartonCount ?? 0) * (item.price || 0)), 0).toLocaleString()} ریال</td>
                                </tr>
                            ` : ''}
                        </tbody>
                    </table>
                </div>

                ${(isInvoice || record.status === 'خارج شده (بایگانی)' || record.status === 'خارج شد') ? '' : `
                    <div style="margin-top: 30px; border-top: 2px solid #000; padding-top: 15px; display: flex; justify-content: space-between; align-items: start; flex-wrap: wrap; gap: 5px;">
                        <div style="text-align: center; flex: 1; min-width: 80px;">
                            <div class="stamp"><div class="stamp-title">ثبت کننده</div><div class="stamp-name">${record.requesterRole || record.requester || '-'}</div></div>
                            <div style="font-size: 8px; font-weight: bold; margin-top: 3px;">مدیرفروش / ثبت سفارش</div>
                        </div>
                        <div style="text-align: center; flex: 1; min-width: 80px;">                
                            ${record.approverCeo ? `<div class="stamp"><div class="stamp-title">مدیرعامل</div><div class="stamp-name">${record.approverCeo}</div></div>` : '<div style="height: 40px; border-bottom: 1px dashed #ccc; margin: 0 5px;"></div>'}
                            <div style="font-size: 8px; font-weight: bold; margin-top: 3px;">مدیرعامل / تایید فروش</div>
                        </div>
                        <div style="text-align: center; flex: 1; min-width: 80px;">
                            ${record.approverFactory ? `<div class="stamp"><div class="stamp-title">مدیر کارخانه</div><div class="stamp-name">${record.approverFactory}</div></div>` : '<div style="height: 40px; border-bottom: 1px dashed #ccc; margin: 0 5px;"></div>'}
                            <div style="font-size: 8px; font-weight: bold; margin-top: 3px;">مدیر کارخانه / مجوز ورود و بارگیری</div>
                        </div>
                        <div style="text-align: center; flex: 1; min-width: 80px;">
                            ${record.approverWarehouse ? `<div class="stamp"><div class="stamp-title">تحویل انبار</div><div class="stamp-name">${record.approverWarehouse}</div></div>` : '<div style="height: 40px; border-bottom: 1px dashed #ccc; margin: 0 5px;"></div>'}
                            <div style="font-size: 8px; font-weight: bold; margin-top: 3px;">سرپرست انبار / انجام بارگیری</div>
                        </div>
                        <div style="text-align: center; flex: 1; min-width: 80px;">
                            ${(record.status === 'در انتظار تایید نهایی مدیر کارخانه' || record.status === 'خارج شد' || record.status === 'خارج شده (بایگانی)') ? `
                                <div class="stamp black"><div class="stamp-title">انتظامات</div><div class="stamp-name">${record.approverSecurity || 'سرپرست انتظامات'}</div></div>
                            ` : '<div style="height: 40px; border-bottom: 1px dashed #ccc; margin: 0 5px;"></div>'}
                            <div style="font-size: 8px; font-weight: bold; margin-top: 3px;">سرپرست انتظامات / بازرسی و تایید بارگیری</div>
                        </div>
                        <div style="text-align: center; flex: 1; min-width: 80px;">
                            ${(record.status === 'خارج شد' || record.status === 'خارج شده (بایگانی)') ? `
                                <div class="stamp black"><div class="stamp-title">مدیر کارخانه</div><div class="stamp-name">${record.approverFactoryFinal || '...'}</div>${record.exitTime ? `<div style="font-size: 7px; font-weight: bold;">ساعت: ${record.exitTime}</div>` : ''}</div>
                            ` : '<div style="height: 40px; border-bottom: 1px dashed #ccc; margin: 0 5px;"></div>'}
                            <div style="font-size: 8px; font-weight: bold; margin-top: 3px;">مدیر کارخانه / تایید نهایی خروج</div>
                        </div>
                    </div>
                `}

                ${isInvoice ? `
                    <div style="margin-top: 40px; display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 20px;">
                        <div style="background: #f1f5f9; padding: 15px; border-radius: 12px; font-size: 11px;">
                            <b style="color: #1e3a8a; display: block; margin-bottom: 5px; border-bottom: 1px solid #cbd5e1; padding-bottom: 2px;">توضیحات و شرایط فروش:</b>
                            ۱. کالا صحیح و سالم و مطابق با سفارش تحویل گردید.<br/>
                            ۲. هرگونه مغایرت باید در لحظه تحویل به راننده اعلام گردد.<br/>
                            ۳. امضای این برگ به منزله تایید نهایی و دریافت کالا توسط خریدار است.
                        </div>
                        <div style="text-align: center; border-right: 1px solid #eee;">
                            <div style="font-weight: 900; font-size: 12px; color: #1e3a8a; margin-bottom: 50px;">مهر و امضای فروشنده</div>
                            <div style="font-size: 9px; color: #94a3b8; border: 2px dashed #e2e8f0; padding: 10px; border-radius: 50%; width: 80px; height: 80px; margin: 0 auto; display: flex; align-items: center; justify-content: center; transform: rotate(-10deg);">SEAL & SIGN</div>
                        </div>
                        <div style="text-align: center; border-right: 1px solid #eee;">
                            <div style="font-weight: 900; font-size: 12px; color: #1e3a8a; margin-bottom: 50px;">امضای تحویل گیرنده</div>
                            <div style="height: 60px;"></div>
                        </div>
                    </div>
                ` : ''}
            </div></body></html>`;

            // Make viewport wide enough
            await page.setViewport({ width: 900, height: 1300, deviceScaleFactor: 2 });
            await page.setContent(html, { waitUntil: 'networkidle0' });
            
            const card = await page.$('#capture-wrapper');
            const buffer = await card.screenshot({ type: 'png' });
            await page.close();
            return buffer;

        } else if (type === 'BIJAK' || type === 'RECEIPT') {
            const isBijak = type === 'BIJAK';
            const showPrices = options.forceHidePrices !== true;
            
            const formatDateSafe = (dateVal) => {
                if (!dateVal) return '-';
                try { return new Date(dateVal).toLocaleDateString('fa-IR'); } catch(e) { return '-'; }
            };

            const html = `<!DOCTYPE html><html lang="fa" dir="rtl"><head><meta charset="UTF-8">
            <script src="https://cdn.tailwindcss.com"></script>
            <style>
                ${fontFaceRule}
                body { background: white; padding: 0 !important; font-family: 'Vazirmatn', sans-serif !important; margin: 0; }
                .watermark-badge { position: absolute; top: 40px; left: 40px; font-size: 40px; font-weight: 900; opacity: 0.2; transform: rotate(-15deg); user-select: none; border: 4px solid; padding: 5px 20px; border-radius: 12px; z-index: 50; }
                .badge-edit { color: #d97706; border-color: #d97706; }
                .badge-delete { color: #dc2626; border-color: #dc2626; opacity: 0.4; }
                #capture-wrapper { 
                    padding: 8mm; 
                    margin: 0 auto; 
                    width: 148mm; 
                    min-height: 209mm;
                    background: white; 
                    direction: rtl; 
                    display: flex;
                    flex-direction: column;
                    box-sizing: border-box;
                    color: black;
                    position: relative;
                    border: 1px solid #eee;
                }
                .stamp { border: 2px solid #1e40af; color: #1e40af; border-radius: 10px; padding: 4px; transform: rotate(-5deg); text-align: center; background: white; min-width: 80px; display: inline-block; }
                .stamp.green { border-color: #166534; color: #166534; }
                .stamp-title { font-size: 8px; font-weight: bold; border-bottom: 1px solid currentColor; margin-bottom: 2px; padding-bottom: 1px; }
                .stamp-name { font-size: 11px; font-weight: 900; }
                table { width: 100%; border-collapse: collapse; border: 1.5px solid black; margin-top: 5px; text-align: center; }
                th, td { border: 1.5px solid black; padding: 4px; }
                th { background-color: #f3f4f6; font-size: 10px; }
                td { font-size: 11px; }
                .meta-section { border-bottom: 2px solid black; padding-bottom: 8px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: start; }
            </style>
            </head><body>
            <div id="capture-wrapper">
                ${isEdit ? '<div class="watermark-badge badge-edit">ویرایش شده</div>' : ''}
                ${isDelete ? '<div class="watermark-badge badge-delete">حذف شده</div>' : ''}
                
                <div class="meta-section">
                    <div>
                        <h1 style="font-size: 18px; font-weight: 900; margin: 0;">${record.company}</h1>
                        <p style="font-size: 11px; font-weight: bold; color: #4b5563; margin: 0;">${isBijak ? 'حواله خروج کالا (بیجک)' : 'رسید ورود کالا'}</p>
                    </div>
                    <div style="text-align: left;">
                        <div style="font-size: 14px; font-weight: 900; border: 2px solid black; padding: 4px 10px; border-radius: 4px;">NO: ${record.number || record.proformaNumber}</div>
                        <div style="font-size: 10px; font-weight: bold; margin-top: 2px;">تاریخ: ${formatDateSafe(record.date)}</div>
                    </div>
                </div>

                <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 8px; margin-bottom: 10px; font-size: 11px;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                        <div><span style="color: #6b7280;">${isBijak ? 'تحویل گیرنده' : 'فرستنده'}:</span> <b>${isBijak ? record.recipientName : (record.supplierName || record.proformaNumber)}</b></div>
                        <div><span style="color: #6b7280;">مقصد/محل:</span> <b>${record.destination || record.location || '-'}</b></div>
                        <div><span style="color: #6b7280;">راننده:</span> <b>${record.driverName || '-'}</b></div>
                        <div><span style="color: #6b7280;">پلاک:</span> <b style="direction: ltr; display: inline-block;">${record.plateNumber || '-'}</b></div>
                    </div>
                </div>

                <div style="flex: 1;">
                    <table>
                        <thead>
                            <tr>
                                <th style="width: 30px;">#</th>
                                <th>شرح کالا</th>
                                <th style="width: 60px;">تعداد</th>
                                <th style="width: 70px;">وزن (KG)</th>
                                ${showPrices ? '<th style="width: 90px;">فی (ریال)</th>' : ''}
                            </tr>
                        </thead>
                        <tbody>
                            ${(record.items || []).map((item, idx) => `
                                <tr>
                                    <td>${idx + 1}</td>
                                    <td style="text-align: right; font-weight: bold; padding-right: 8px;">${item.itemName}</td>
                                    <td>${item.quantity}</td>
                                    <td>${item.weight ? Number(item.weight).toFixed(2) : 0}</td>
                                    ${showPrices ? `<td style="font-family: monospace;">${item.unitPrice ? parseInt(item.unitPrice).toLocaleString() : '-'}</td>` : ''}
                                </tr>
                            `).join('')}
                            <tr style="background-color: #f3f4f6; font-weight: bold;">
                                <td colspan="2" style="text-align: left; padding-left: 10px;">جمع کل:</td>
                                <td>${(record.items || []).reduce((a, b) => a + (Number(b.quantity) || 0), 0)}</td>
                                <td>${(record.items || []).reduce((a, b) => a + (Number(b.weight) || 0), 0).toFixed(2)}</td>
                                ${showPrices ? '<td></td>' : ''}
                            </tr>
                        </tbody>
                    </table>
                    
                    ${options.stockInfo && options.stockInfo.length > 0 ? `
                    <div style="margin-top: 10px; font-size: 11px;">
                        <h4 style="margin: 0 0 5px 0; font-weight: bold; font-size: 11px; color: #4b5563;">📊 مانده موجودی پس از خروج:</h4>
                        <table style="border: 1px solid #9ca3af; margin-top: 0;">
                            <thead>
                                <tr>
                                    <th style="background-color: #e5e7eb; padding: 2px;">کالا</th>
                                    <th style="background-color: #e5e7eb; padding: 2px; width: 60px;">مانده (کارتن)</th>
                                    <th style="background-color: #e5e7eb; padding: 2px; width: 70px;">مانده (وزن)</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${options.stockInfo.map(s => `
                                    <tr>
                                        <td style="text-align: right; font-weight: bold; padding: 2px 8px; font-size: 10px;">${s.name}</td>
                                        <td style="padding: 2px; font-size: 10px; font-weight: bold; color: ${s.qty < 0 ? '#dc2626' : '#166534'}">${s.qty.toFixed(2)}</td>
                                        <td style="padding: 2px; font-size: 10px; color: ${s.weight < 0 ? '#dc2626' : '#166534'}">${s.weight.toFixed(2)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                    ` : ''}

                    ${record.description ? `<div style="margin-top: 10px; font-size: 10px; border: 1px solid #eee; padding: 5px; border-radius: 4px;"><b>توضیحات:</b> ${record.description}</div>` : ''}
                </div>

                <div style="margin-top: 20px; border-top: 1.5px solid black; padding-top: 10px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; text-align: center;">
                    <div>
                        <div class="stamp"><div class="stamp-title">انباردار (ثبت)</div><div class="stamp-name">${record.createdBy || 'کاربر انبار'}</div></div>
                        <div style="font-size: 9px; font-weight: bold; color: #4b5563; margin-top: 4px;">امضا انباردار</div>
                    </div>
                    <div>
                        ${record.approvedBy ? `<div class="stamp green"><div class="stamp-title">تایید مدیریت</div><div class="stamp-name">${record.approvedBy}</div></div>` : '<div style="height: 40px; border-bottom: 1px dashed #ccc; margin: 0 10px;"></div>'}
                        <div style="font-size: 9px; font-weight: bold; color: #4b5563; margin-top: 4px;">امضا مدیریت</div>
                    </div>
                    <div>
                        <div style="height: 40px;"></div>
                        <div style="font-size: 9px; font-weight: bold; color: #4b5563; margin-top: 4px;">امضا تحویل گیرنده</div>
                    </div>
                </div>
            </div></body></html>`;

            await page.setViewport({ width: 600, height: 850, deviceScaleFactor: 2 });
            await page.setContent(html, { waitUntil: 'networkidle0' });
            const card = await page.$('#capture-wrapper');
            const buffer = await card.screenshot({ type: 'png' });
            await page.close();
            return buffer;
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

export const generatePdfBuffer = async (html, options = {}) => {
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
        const pdfOptions = { format: 'A4', printBackground: true, ...options };
        const pdf = await page.pdf(pdfOptions);
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

export const generateMeetingAnnouncementImage = async (meeting) => {
    try {
        const browser = await getBrowser();
        const page = await browser.newPage();
        
        const html = `<!DOCTYPE html><html lang="fa" dir="rtl"><head><meta charset="UTF-8">
            <script src="https://cdn.tailwindcss.com"></script>
            <style>
                ${fontFaceRule}
                body { background: #f9fafb; padding: 20px !important; font-family: 'Vazirmatn', sans-serif !important; }
                .card { background: white; border-radius: 24px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1); border: 2px solid #e5e7eb; overflow: hidden; width: 600px; }
                .header { background: #1e3a8a; color: white; padding: 30px; text-align: center; }
                .content { padding: 30px; }
                .item { padding: 10px; border-bottom: 1px solid #f3f4f6; font-size: 14px; }
            </style>
        </head><body>
            <div class="card">
                <div class="header">
                    <h1 style="font-size: 28px; font-weight: 900; margin: 0;">اعلان برگزاری جلسه تولید</h1>
                    <div style="font-size: 16px; margin-top: 10px;">شماره: ${meeting.meetingNumber}</div>
                </div>
                <div class="content">
                    <div style="font-size: 18px; font-weight: bold; margin-bottom: 20px;">
                        جلسه در تاریخ ${meeting.date} ساعت ${meeting.time} در ${meeting.location} برگزار خواهد شد.
                    </div>
                    <div style="font-size: 14px; color: #4b5563;">
                        <p>رئیس: ${meeting.chairman}</p>
                        <p>دبیر: ${meeting.secretary}</p>
                    </div>
                </div>
            </div></body></html>`;

        await page.setViewport({ width: 640, height: 800, deviceScaleFactor: 2 });
        await page.setContent(html, { waitUntil: 'networkidle0' });
        const card = await page.$('.card');
        const buffer = await card.screenshot({ type: 'png' });
        await page.close();
        return buffer;
    } catch (e) {
        console.error("Generate Announcement Image Error:", e.message);
        throw e;
    }
};

export const generateMeetingMinutesPDF = async (meeting) => {
    try {
        const browser = await getBrowser();
        const page = await browser.newPage();
        
        const html = `<!DOCTYPE html><html lang="fa" dir="rtl"><head><meta charset="UTF-8">
            <style>
                ${BASE_STYLE}
                .meeting-header { border: 2px solid #333; padding: 15px; margin-bottom: 20px; }
                .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px; }
                .sub-title { font-size: 18px; font-weight: bold; border-right: 4px solid #1e3a8a; padding-right: 10px; margin: 20px 0 10px 0; }
                .stamp { border: 2px solid #166534; color: #166534; border-radius: 10px; padding: 6px; transform: rotate(-3deg); text-align: center; background: white; min-width: 100px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); display: inline-block; margin: 5px; }
                .stamp-title { font-size: 9px; font-weight: bold; border-bottom: 1px solid #166534; margin-bottom: 3px; padding-bottom: 1px; }
                .stamp-name { font-size: 12px; font-weight: 900; }
                .stamp-date { font-size: 8px; font-weight: bold; margin-top: 2px; }
            </style>
        </head><body>
            <div class="header">
                <div class="title">صورتجلسه</div>
                <div class="meta" style="justify-content: center; gap: 20px;"><span>شماره: ${meeting.meetingNumber}</span><span>تاریخ: ${meeting.date}</span></div>
            </div>

            <div class="meeting-header">
                <div class="grid-2">
                    <div><b>زمان برگزاری:</b> ${meeting.time}</div>
                    <div><b>مکان:</b> ${meeting.location}</div>
                    <div><b>رئیس جلسه:</b> ${meeting.chairman}</div>
                    <div><b>دبیر جلسه:</b> ${meeting.secretary}</div>
                </div>
            </div>

            <div class="sub-title">اعضای حاضر</div>
            <div style="font-size: 13px;">${meeting.attendees.filter(a => a.isPresent).map(a => `• ${a.fullName} - ${a.role}`).join('<br/>')}
                 ${(meeting.guestAttendees || []).map(g => `• ${g} - مدعو`).join('<br/>')}</div>

            <div class="sub-title">مصوبات و تصمیمات</div>
            <table>
                <thead>
                    <tr><th style="width: 40px;">ردیف</th><th>شرح مصوبه</th><th style="width: 150px;">مسئول اجرا</th><th style="width: 100px;">زمان/مهلت</th></tr>
                </thead>
                <tbody>
                    ${meeting.items.map((item, idx) => `
                        <tr>
                            <td>${idx + 1}</td>
                            <td style="text-align: right;">${item.description}</td>
                            <td>${item.responsiblePerson}</td>
                            <td>${item.duration}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
                    
            <div class="sub-title">امضاها و تاییدات</div>
            <div style="display: flex; flex-wrap: wrap; margin-top: 20px;">
                ${Object.entries(meeting.approvals || {}).map(([username, appInfo]) => {
                    const attendee = meeting.attendees.find(a => a.username === username);
                    const name = attendee ? attendee.fullName : username;
                    const role = attendee ? attendee.role : 'عضو';
                    return `
                        <div class="stamp">
                            <div class="stamp-title">تایید شد</div>
                            <div class="stamp-name">${name}</div>
                            <div class="stamp-date">${role}</div>
                            <div class="stamp-date">${new Date(appInfo.date).toLocaleDateString('fa-IR')}</div>
                        </div>
                    `;
                }).join('')}
            </div>
        </body></html>`;


        await page.setContent(html, { waitUntil: 'networkidle0' });
        const pdf = await page.pdf({ format: 'A4', printBackground: true });
        await page.close();
        return pdf;
    } catch (e) {
        console.error("Generate Meeting PDF Error:", e.message);
        throw e;
    }
};
