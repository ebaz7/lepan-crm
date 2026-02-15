
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
        // Priority 1: Check in 'public/fonts' relative to root
        const pathsToCheck = [
            path.join(ROOT_DIR, 'public', 'fonts', 'Vazirmatn-Regular.woff2'),
            path.join(ROOT_DIR, 'dist', 'fonts', 'Vazirmatn-Regular.woff2'), // Production build
            path.join(process.cwd(), 'public', 'fonts', 'Vazirmatn-Regular.woff2') // CWD fallback
        ];

        for (const p of pathsToCheck) {
            if (fs.existsSync(p)) {
                console.log(`[Renderer] Font found at: ${p}`);
                return fs.readFileSync(p).toString('base64');
            }
        }
        console.warn("[Renderer] Font file NOT found. PDF text might be squares.");
    } catch (e) {
        console.warn("[Renderer] Error loading font:", e.message);
    }
    return null;
};

const fontBase64 = getFontBase64();
// IMPORTANT: Use specific font-family name that matches CSS
const fontFaceRule = fontBase64 
    ? `@font-face { font-family: 'Vazirmatn'; src: url(data:font/woff2;base64,${fontBase64}) format('woff2'); font-weight: normal; font-style: normal; }`
    : `/* No Local Font Found */`;

const getBrowser = async () => {
    if (!browser) {
        try {
            console.log("[Renderer] Launching Puppeteer...");
            browser = await puppeteer.launch({
                headless: "new",
                args: [
                    '--no-sandbox', 
                    '--disable-setuid-sandbox', 
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--font-render-hinting=none'
                ],
                // Timeout specifically for slow environments
                timeout: 60000 
            });
        } catch (e) {
            console.error("⚠️ Puppeteer Launch Failed:", e.message);
            return null;
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
    .badge { padding: 4px 8px; border-radius: 12px; font-size: 10px; font-weight: bold; color: white; }
    .amount { font-family: monospace; font-weight: bold; font-size: 14px; direction: ltr; }
    
    /* VOUCHER STYLE */
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
const generateReportHTML = (title, columns, rows) => `
<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head><meta charset="UTF-8"><style>${BASE_STYLE}</style></head>
<body>
    <div class="header">
        <div class="title">${title}</div>
        <div class="meta">
            <span>تاریخ گزارش: ${new Date().toLocaleDateString('fa-IR')}</span>
            <span>تعداد رکورد: ${rows.length}</span>
        </div>
    </div>
    <table>
        <thead>
            <tr>
                <th style="width: 50px">ردیف</th>
                ${columns.map(c => `<th>${c}</th>`).join('')}
            </tr>
        </thead>
        <tbody>
            ${rows.map((row, idx) => `
                <tr>
                    <td>${idx + 1}</td>
                    ${row.map(cell => `<td>${cell || '-'}</td>`).join('')}
                </tr>
            `).join('')}
        </tbody>
    </table>
    <div class="footer">سیستم یکپارچه مدیریت مالی و بازرگانی - نسخه بات</div>
</body>
</html>`;

const generateRecordCardHTML = (title, data, type) => `
<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="UTF-8">
<style>
    ${BASE_STYLE}
    body { padding: 20px; width: 800px; display: block; }
    .card { background: white; border-radius: 20px; box-shadow: none; border: 1px solid #333; overflow: hidden; }
    .card-header { background: ${type === 'PAYMENT' ? '#1e40af' : type === 'EXIT' ? '#0f766e' : '#7e22ce'}; color: white; padding: 25px; text-align: center; }
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

// --- EXPORTED FUNCTIONS ---

export const generateRecordImage = async (record, type) => {
    const browser = await getBrowser();
    if (!browser) return Buffer.from("");

    try {
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
                <div class="row"><span class="label">راننده:</span><span class="value">${record.driverName || '-'}</span></div>
                <div class="row"><span class="label">وضعیت:</span><span class="value">${record.status}</span></div>
            `;
        }

        await page.setContent(generateRecordCardHTML(title, htmlData, type), { waitUntil: 'networkidle0' });
        const card = await page.$('.card');
        if (!card) throw new Error("Card element not found");
        
        const buffer = await card.screenshot({ type: 'png' });
        await page.close();
        return buffer;
    } catch (e) {
        console.error("Renderer Image Error:", e);
        return Buffer.from("");
    }
};

export const generateReportPDF = async (title, columns, rows, landscape = false) => {
    const browser = await getBrowser();
    if (!browser) return Buffer.from("");

    try {
        const page = await browser.newPage();
        await page.setContent(generateReportHTML(title, columns, rows), { waitUntil: 'networkidle0' });
        const pdf = await page.pdf({ 
            format: 'A4', 
            landscape: landscape,
            printBackground: true, 
            margin: { top: '20px', bottom: '20px', left: '20px', right: '20px' } 
        });
        await page.close();
        return pdf;
    } catch (e) {
        console.error("Renderer PDF Error:", e);
        return Buffer.from("");
    }
};

export const generatePdfBuffer = async (html) => {
    const browser = await getBrowser();
    if (!browser) return Buffer.from("");
    const page = await browser.newPage();
    
    // Ensure font is injected
    let finalHtml = html;
    if (!html.includes('@font-face') && fontFaceRule) {
        finalHtml = html.replace('<head>', `<head><style>${fontFaceRule} body { font-family: 'Vazirmatn' !important; }</style>`);
    }

    await page.setContent(finalHtml, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({ format: 'A4', printBackground: true });
    await page.close();
    return pdf;
};

export const generateVoucherPDF = async (order) => {
    const browser = await getBrowser();
    if (!browser) return Buffer.from("");

    try {
        const page = await browser.newPage();
        
        const linesHtml = order.paymentDetails.map((d, i) => `
            <tr>
                <td>${i+1}</td>
                <td>${d.method}</td>
                <td class="amount">${parseInt(d.amount).toLocaleString()}</td>
                <td>${d.bankName || (d.method === 'چک' ? `چک: ${d.chequeNumber}` : '-')}</td>
                <td>${d.description || '-'}</td>
            </tr>
        `).join('');

        const html = `
        <!DOCTYPE html>
        <html lang="fa" dir="rtl">
        <head><meta charset="UTF-8"><style>${BASE_STYLE}</style></head>
        <body>
            <div class="voucher-container">
                <div class="voucher-header">
                    <div>
                        <div class="voucher-title">${order.payingCompany}</div>
                        <div>رسید دستور پرداخت وجه</div>
                    </div>
                    <div class="voucher-meta">
                        <div>شماره: <span style="font-family:monospace">${order.trackingNumber}</span></div>
                        <div>تاریخ: ${new Date(order.date).toLocaleDateString('fa-IR')}</div>
                    </div>
                </div>

                <div class="voucher-row">
                    <span class="voucher-label">در وجه (ذینفع):</span>
                    <span class="voucher-val">${order.payee}</span>
                </div>
                <div class="voucher-row">
                    <span class="voucher-label">مبلغ کل:</span>
                    <span class="voucher-val amount" style="font-size:16px">${parseInt(order.totalAmount).toLocaleString()} ریال</span>
                </div>
                <div class="voucher-row">
                    <span class="voucher-label">بابت:</span>
                    <span class="voucher-val">${order.description}</span>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th style="width:30px">#</th>
                            <th>روش</th>
                            <th>مبلغ</th>
                            <th>بانک / جزئیات</th>
                            <th>شرح ردیف</th>
                        </tr>
                    </thead>
                    <tbody>${linesHtml}</tbody>
                </table>

                <div class="voucher-signatures">
                    <div>
                        <div class="sig-box"></div>
                        <div>درخواست کننده<br/>${order.requester}</div>
                    </div>
                    <div>
                        <div class="sig-box"></div>
                        <div>مدیر مالی<br/>${order.approverFinancial || '---'}</div>
                    </div>
                    <div>
                        <div class="sig-box"></div>
                        <div>مدیریت<br/>${order.approverManager || '---'}</div>
                    </div>
                    <div>
                        <div class="sig-box"></div>
                        <div>مدیر عامل<br/>${order.approverCeo || '---'}</div>
                    </div>
                </div>
            </div>
        </body>
        </html>
        `;

        await page.setContent(html, { waitUntil: 'networkidle0' });
        const pdf = await page.pdf({ 
            format: 'A5', 
            landscape: true,
            printBackground: true
        });
        await page.close();
        return pdf;
    } catch (e) {
        console.error("Voucher PDF Error:", e);
        return Buffer.from("");
    }
};
