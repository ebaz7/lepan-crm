
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
            console.error("⚠️ Puppeteer Launch Failed. Image generation will not work.", e.message);
            return null;
        }
    }
    return browser;
};

// HTML Templates for Screenshots
const generateHtml = (title, data, type) => `
<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="UTF-8">
<style>
    @import url('https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;700;900&display=swap');
    body { font-family: 'Vazirmatn', sans-serif; background: #f3f4f6; padding: 20px; box-sizing: border-box; width: 800px; }
    .card { background: white; border-radius: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.15); overflow: hidden; border: 1px solid #e5e7eb; }
    .header { background: ${type === 'PAYMENT' ? '#1e40af' : type === 'EXIT' ? '#0f766e' : '#7e22ce'}; color: white; padding: 25px; text-align: center; }
    .title { font-size: 32px; font-weight: 900; margin: 0; }
    .subtitle { font-size: 18px; opacity: 0.9; margin-top: 5px; font-family: monospace; }
    .content { padding: 30px; }
    .row { display: flex; justify-content: space-between; border-bottom: 2px dashed #f3f4f6; padding: 12px 0; font-size: 18px; }
    .label { color: #6b7280; font-weight: bold; }
    .value { color: #111827; font-weight: 900; }
    .footer { background: #f9fafb; padding: 15px; text-align: center; color: #6b7280; font-size: 14px; font-weight: bold; border-top: 1px solid #e5e7eb; }
    .status { text-align: center; margin-top: 20px; padding: 10px; border-radius: 10px; font-weight: bold; color: white; font-size: 20px; }
    .highlight { color: ${type === 'PAYMENT' ? '#1e40af' : '#0f766e'}; }
    .items-table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    .items-table th { background: #f3f4f6; padding: 10px; text-align: center; font-size: 16px; border: 1px solid #ddd; }
    .items-table td { padding: 10px; text-align: center; font-size: 18px; border: 1px solid #ddd; font-weight: bold; }
</style>
</head>
<body>
    <div class="card">
        <div class="header">
            <div class="title">${title}</div>
            <div class="subtitle">${new Date().toLocaleString('fa-IR')}</div>
        </div>
        <div class="content">
            ${data}
        </div>
        <div class="footer">سیستم یکپارچه مدیریت مالی و بازرگانی</div>
    </div>
</body>
</html>`;

export const generateRecordImage = async (record, type) => {
    const browser = await getBrowser();
    if (!browser) return Buffer.from(""); // Return empty buffer if puppeteer failed

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 800, height: 1200, deviceScaleFactor: 2 });

        let htmlData = '';
        let title = '';

        if (type === 'PAYMENT') {
            title = 'دستور پرداخت وجه';
            htmlData = `
                <div class="row"><span class="label">شماره سند:</span><span class="value" style="font-family:monospace; font-size: 24px;">#${record.trackingNumber}</span></div>
                <div class="row"><span class="label">درخواست کننده:</span><span class="value">${record.requester}</span></div>
                <div class="row"><span class="label">ذینفع (گیرنده):</span><span class="value">${record.payee}</span></div>
                <div class="row"><span class="label">مبلغ:</span><span class="value highlight" style="font-size: 28px;">${parseInt(record.totalAmount).toLocaleString('fa-IR')} ریال</span></div>
                <div class="row"><span class="label">بابت:</span><span class="value">${record.description}</span></div>
                <div class="row"><span class="label">وضعیت فعلی:</span><span class="value">${record.status}</span></div>
            `;
        } 
        else if (type === 'EXIT') {
            title = 'مجوز خروج کالا';
            let itemsHtml = `<table class="items-table"><thead><tr><th>کالا</th><th>تعداد</th><th>وزن (KG)</th></tr></thead><tbody>`;
            if (record.items && record.items.length > 0) {
                record.items.forEach(i => {
                    itemsHtml += `<tr><td>${i.goodsName}</td><td>${i.cartonCount || i.deliveredCartonCount || 0}</td><td>${i.weight || i.deliveredWeight || 0}</td></tr>`;
                });
            } else {
                itemsHtml += `<tr><td>${record.goodsName}</td><td>${record.cartonCount}</td><td>${record.weight}</td></tr>`;
            }
            itemsHtml += `</tbody></table>`;

            htmlData = `
                <div class="row"><span class="label">شماره مجوز:</span><span class="value" style="font-family:monospace; font-size: 24px;">#${record.permitNumber}</span></div>
                <div class="row"><span class="label">گیرنده:</span><span class="value">${record.recipientName}</span></div>
                <div class="row"><span class="label">شرکت:</span><span class="value">${record.company}</span></div>
                <div class="row"><span class="label">راننده / پلاک:</span><span class="value">${record.driverName || '-'} | ${record.plateNumber || '-'}</span></div>
                ${itemsHtml}
                ${record.exitTime ? `<div class="row" style="background:#ecfccb; border:none; margin-top:10px;"><span class="label" style="color:#365314">ساعت خروج:</span><span class="value" style="font-size:24px; color:#365314">${record.exitTime}</span></div>` : ''}
                <div class="status" style="background:${record.status.includes('رد')?'#ef4444':'#f59e0b'}">${record.status}</div>
            `;
        }
        else if (type === 'BIJAK') {
            title = 'بیجک انبار';
            htmlData = `
                <div class="row"><span class="label">شماره بیجک:</span><span class="value">#${record.number}</span></div>
                <div class="row"><span class="label">گیرنده:</span><span class="value">${record.recipientName}</span></div>
                <div class="row"><span class="label">صادر کننده:</span><span class="value">${record.createdBy}</span></div>
                <div class="row"><span class="label">تعداد اقلام:</span><span class="value">${record.items.length}</span></div>
            `;
        }

        await page.setContent(generateHtml(title, htmlData, type));
        const card = await page.$('.card');
        const buffer = await card.screenshot({ type: 'png' });
        await page.close();
        return buffer;
    } catch (e) {
        console.error("Renderer Error:", e);
        return Buffer.from("");
    }
};

// PDF Generation for Reports
export const generatePdfBuffer = async (html) => {
    const browser = await getBrowser();
    if (!browser) throw new Error("Browser not available");
    
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '1cm', bottom: '1cm' } });
    await page.close();
    return pdf;
};
