
import puppeteer from 'puppeteer';

let browser = null;

const getBrowser = async () => {
    if (!browser) {
        try {
            browser = await puppeteer.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none']
            });
        } catch (e) {
            console.error("⚠️ Puppeteer Launch Failed.", e.message);
            return null;
        }
    }
    return browser;
};

// --- STYLES ---
const BASE_STYLE = `
    @import url('https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;700;900&display=swap');
    body { font-family: 'Vazirmatn', sans-serif; background: #fff; padding: 40px; direction: rtl; }
    .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
    .title { font-size: 24px; font-weight: 900; color: #1e3a8a; }
    .meta { display: flex; justify-content: space-between; margin-top: 10px; font-size: 14px; color: #555; font-weight: bold; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
    th { background: #f3f4f6; padding: 12px; border: 1px solid #ddd; text-align: center; font-weight: 900; color: #333; }
    td { padding: 10px; border: 1px solid #ddd; text-align: center; color: #444; }
    tr:nth-child(even) { background-color: #fafafa; }
    .footer { margin-top: 40px; text-align: center; font-size: 10px; color: #888; border-top: 1px solid #eee; padding-top: 10px; }
    .badge { padding: 4px 8px; border-radius: 12px; font-size: 10px; font-weight: bold; color: white; }
    .badge-green { background: #16a34a; }
    .badge-red { background: #dc2626; }
    .badge-blue { background: #2563eb; }
    .badge-gray { background: #6b7280; }
    .amount { font-family: monospace; font-weight: bold; font-size: 14px; direction: ltr; }
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
                    ${row.map(cell => `<td>${cell}</td>`).join('')}
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
    body { padding: 20px; width: 800px; }
    .card { background: white; border-radius: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.15); overflow: hidden; border: 1px solid #e5e7eb; }
    .card-header { background: ${type === 'PAYMENT' ? '#1e40af' : type === 'EXIT' ? '#0f766e' : '#7e22ce'}; color: white; padding: 25px; text-align: center; }
    .card-title { font-size: 32px; font-weight: 900; margin: 0; }
    .row { display: flex; justify-content: space-between; border-bottom: 2px dashed #f3f4f6; padding: 12px 20px; font-size: 18px; }
    .label { color: #6b7280; font-weight: bold; }
    .value { color: #111827; font-weight: 900; }
</style>
</head>
<body>
    <div class="card">
        <div class="card-header">
            <div class="card-title">${title}</div>
            <div style="margin-top:5px; opacity:0.9;">${new Date().toLocaleString('fa-IR')}</div>
        </div>
        ${data}
    </div>
</body>
</html>`;

// --- EXPORTED FUNCTIONS ---

// 1. Generate Image for Telegram/Bale (Single Record)
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
                <div class="row"><span class="label">بابت:</span><span class="value">${record.description}</span></div>
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

        await page.setContent(generateRecordCardHTML(title, htmlData, type));
        const card = await page.$('.card');
        const buffer = await card.screenshot({ type: 'png' });
        await page.close();
        return buffer;
    } catch (e) {
        console.error("Renderer Image Error:", e);
        return Buffer.from("");
    }
};

// 2. Generate PDF Report (List of Records)
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

// 3. Simple Buffer Generator from HTML (For custom raw HTML)
export const generatePdfBuffer = async (html) => {
    const browser = await getBrowser();
    if (!browser) return Buffer.from("");
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({ format: 'A4', printBackground: true });
    await page.close();
    return pdf;
};
