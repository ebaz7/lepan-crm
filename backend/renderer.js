
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
            browser = await puppeteer.launch({
                headless: "new", // Use new headless mode for better stability
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
                timeout: 60000 // Increased timeout to 60s
            });
            console.log("[Renderer] Puppeteer Launched Successfully.");
        } catch (e) {
            console.error("⚠️ Puppeteer Launch Failed:", e.message);
            // Re-throw to let the caller know exactly why it failed
            throw new Error(`Puppeteer Launch Failed: ${e.message}`);
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
            title = 'مجوز خروج کالا';
            htmlData = `
                <div class="row"><span class="label">شماره مجوز:</span><span class="value">#${record.permitNumber}</span></div>
                <div class="row"><span class="label">گیرنده:</span><span class="value">${record.recipientName}</span></div>
                <div class="row"><span class="label">کالا:</span><span class="value">${record.goodsName}</span></div>
                <div class="row"><span class="label">تعداد/وزن:</span><span class="value">${record.cartonCount} کارتن / ${record.weight} KG</span></div>
                <div class="row"><span class="label">وضعیت:</span><span class="value">${record.status}</span></div>
            `;
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
