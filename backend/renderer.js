
import puppeteer from 'puppeteer';

let browser = null;

const getBrowser = async () => {
    if (!browser) {
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none']
        });
    }
    return browser;
};

const baseHtml = (content) => `
<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="UTF-8">
<style>
    @import url('https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;700;900&display=swap');
    body { font-family: 'Vazirmatn', sans-serif; background: #fff; padding: 20px; margin: 0; box-sizing: border-box; }
    .card { border: 4px solid #333; border-radius: 20px; padding: 30px; box-shadow: 0 10px 20px rgba(0,0,0,0.1); max-width: 700px; margin: 0 auto; background: white; }
    .header { text-align: center; border-bottom: 3px solid #eee; padding-bottom: 20px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
    .logo-area { font-size: 40px; }
    .title-area { text-align: right; }
    .title { font-size: 28px; font-weight: 900; color: #1e40af; margin: 0; }
    .subtitle { font-size: 16px; color: #6b7280; margin-top: 5px; font-weight: bold; }
    .row { display: flex; justify-content: space-between; margin-bottom: 12px; border-bottom: 1px dashed #eee; padding-bottom: 8px; align-items: center; }
    .label { font-weight: bold; color: #4b5563; font-size: 16px; }
    .value { font-family: 'Courier New', monospace; color: #111; font-weight: 900; font-size: 18px; direction: ltr; }
    .value-fa { color: #111; font-weight: 900; font-size: 18px; }
    .status-badge { text-align: center; margin-top: 30px; padding: 15px; border-radius: 15px; font-weight: 900; color: white; font-size: 20px; }
    .status-PENDING { background-color: #f59e0b; }
    .status-APPROVED { background-color: #10b981; }
    .status-REJECTED { background-color: #ef4444; }
    .status-EXITED { background-color: #3b82f6; }
    .footer { margin-top: 25px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #eee; padding-top: 10px; }
    .items-table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 14px; }
    .items-table th { background: #f3f4f6; padding: 8px; text-align: center; border: 1px solid #ddd; }
    .items-table td { padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; }
</style>
</head>
<body>
    ${content}
</body>
</html>
`;

export const generateRecordImage = async (data, type) => {
    const browser = await getBrowser();
    const page = await browser.newPage();
    await page.setViewport({ width: 800, height: 1000, deviceScaleFactor: 2 });
    
    let content = '';
    const dateStr = new Date(data.date || Date.now()).toLocaleDateString('fa-IR');

    if (type === 'PAYMENT') {
        const statusClass = data.status.includes('رد') ? 'status-REJECTED' : data.status.includes('تایید نهایی') ? 'status-APPROVED' : 'status-PENDING';
        
        content = `
        <div class="card">
            <div class="header">
                <div class="title-area">
                    <div class="title">دستور پرداخت</div>
                    <div class="subtitle">Payment Order #${data.trackingNumber}</div>
                </div>
                <div class="logo-area">💰</div>
            </div>
            <div class="row"><span class="label">درخواست کننده:</span><span class="value-fa">${data.requester}</span></div>
            <div class="row"><span class="label">تاریخ ثبت:</span><span class="value">${dateStr}</span></div>
            <div class="row"><span class="label">شرکت:</span><span class="value-fa">${data.payingCompany || '-'}</span></div>
            <div class="row"><span class="label">گیرنده (ذینفع):</span><span class="value-fa">${data.payee}</span></div>
            <div class="row"><span class="label">مبلغ کل:</span><span class="value">${parseInt(data.totalAmount).toLocaleString()} RIAL</span></div>
            
            <div style="background:#f9fafb; padding:15px; border-radius:10px; margin: 15px 0;">
                <span class="label" style="display:block; margin-bottom:5px;">شرح:</span>
                <span class="value-fa" style="font-size:16px; font-weight:normal;">${data.description || '-'}</span>
            </div>

            <div class="status-badge ${statusClass}">
                ${data.status}
            </div>
            <div class="footer">تولید شده توسط ربات سیستم مالی</div>
        </div>`;
    } else if (type === 'EXIT') {
        const statusClass = data.status === 'خارج شده (بایگانی)' ? 'status-EXITED' : data.status.includes('رد') ? 'status-REJECTED' : 'status-PENDING';
        
        let itemsHtml = '';
        if (data.items && data.items.length > 0) {
            itemsHtml = `<table class="items-table"><thead><tr><th>کالا</th><th>تعداد</th><th>وزن</th></tr></thead><tbody>`;
            data.items.forEach(i => {
                itemsHtml += `<tr><td>${i.goodsName}</td><td>${i.cartonCount}</td><td>${i.weight}</td></tr>`;
            });
            itemsHtml += `</tbody></table>`;
        } else {
            itemsHtml = `<div class="row"><span class="label">کالا:</span><span class="value-fa">${data.goodsName}</span></div>
                         <div class="row"><span class="label">تعداد / وزن:</span><span class="value">${data.cartonCount} / ${data.weight}</span></div>`;
        }

        content = `
        <div class="card">
            <div class="header">
                <div class="title-area">
                    <div class="title">مجوز خروج کالا</div>
                    <div class="subtitle">Exit Permit #${data.permitNumber}</div>
                </div>
                <div class="logo-area">🚛</div>
            </div>
            <div class="row"><span class="label">درخواست کننده:</span><span class="value-fa">${data.requester}</span></div>
            <div class="row"><span class="label">تاریخ:</span><span class="value">${dateStr}</span></div>
            <div class="row"><span class="label">گیرنده:</span><span class="value-fa">${data.recipientName}</span></div>
            <div class="row"><span class="label">شرکت:</span><span class="value-fa">${data.company || '-'}</span></div>
            
            ${itemsHtml}

            ${data.driverName ? `<div class="row"><span class="label">راننده:</span><span class="value-fa">${data.driverName}</span></div>` : ''}
            ${data.plateNumber ? `<div class="row"><span class="label">پلاک:</span><span class="value">${data.plateNumber}</span></div>` : ''}
            
            <div class="status-badge ${statusClass}">
                ${data.status}
            </div>
            ${data.exitTime ? `<div style="text-align:center; margin-top:10px; font-size:24px; font-weight:bold; color:#1e3a8a;">🕒 زمان خروج: ${data.exitTime}</div>` : ''}
            
            <div class="footer">تولید شده توسط ربات سیستم مالی</div>
        </div>`;
    }

    await page.setContent(baseHtml(content));
    const element = await page.$('.card');
    const imageBuffer = await element.screenshot({ type: 'png' });
    await page.close();
    return imageBuffer;
};

export const generatePdfBuffer = async (html) => {
    const browser = await getBrowser();
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
    await page.close();
    return pdfBuffer;
};
