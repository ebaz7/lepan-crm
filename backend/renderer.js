
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

let browser = null;

const getBrowser = async () => {
    if (!browser) {
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
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
    @font-face { font-family: 'Vazir'; src: url('https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/fonts/webfonts/Vazirmatn-Regular.woff2') format('woff2'); }
    body { font-family: 'Vazir', sans-serif; background: #fff; padding: 20px; margin: 0; }
    .card { border: 2px solid #333; border-radius: 15px; padding: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); max-width: 600px; margin: 0 auto; }
    .header { text-align: center; border-bottom: 2px solid #eee; padding-bottom: 15px; margin-bottom: 15px; }
    .title { font-size: 24px; font-weight: bold; color: #1e40af; }
    .subtitle { font-size: 14px; color: #6b7280; margin-top: 5px; }
    .row { display: flex; justify-content: space-between; margin-bottom: 10px; border-bottom: 1px dashed #eee; padding-bottom: 5px; }
    .label { font-weight: bold; color: #374151; }
    .value { font-family: 'Courier New', monospace; color: #111; font-weight: bold; direction: ltr; }
    .status { text-align: center; margin-top: 20px; padding: 10px; border-radius: 10px; font-weight: bold; color: white; }
    .status.PENDING { background-color: #f59e0b; }
    .status.APPROVED { background-color: #10b981; }
    .status.REJECTED { background-color: #ef4444; }
    .footer { margin-top: 20px; text-align: center; font-size: 12px; color: #9ca3af; }
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
    
    let content = '';
    if (type === 'PAYMENT') {
        content = `
        <div class="card">
            <div class="header">
                <div class="title">دستور پرداخت</div>
                <div class="subtitle">Payment Order #${data.trackingNumber}</div>
            </div>
            <div class="row"><span class="label">گیرنده (ذینفع):</span><span class="value">${data.payee}</span></div>
            <div class="row"><span class="label">مبلغ:</span><span class="value">${parseInt(data.totalAmount).toLocaleString()} RIAL</span></div>
            <div class="row"><span class="label">شرکت:</span><span class="value">${data.payingCompany || '-'}</span></div>
            <div class="row"><span class="label">تاریخ:</span><span class="value">${data.date}</span></div>
            <div class="row"><span class="label">درخواست کننده:</span><span class="value">${data.requester}</span></div>
            <div class="row"><span class="label">توضیحات:</span><span class="value">${data.description || '-'}</span></div>
            <div class="status ${data.status.includes('تایید') ? 'APPROVED' : data.status.includes('رد') ? 'REJECTED' : 'PENDING'}">
                ${data.status}
            </div>
            <div class="footer">تولید شده توسط سیستم مدیریت مالی</div>
        </div>`;
    } else if (type === 'EXIT') {
        content = `
        <div class="card">
            <div class="header">
                <div class="title">مجوز خروج کالا</div>
                <div class="subtitle">Exit Permit #${data.permitNumber}</div>
            </div>
            <div class="row"><span class="label">گیرنده:</span><span class="value">${data.recipientName}</span></div>
            <div class="row"><span class="label">کالا:</span><span class="value">${data.goodsName}</span></div>
            <div class="row"><span class="label">تعداد/وزن:</span><span class="value">${data.cartonCount} Box / ${data.weight} KG</span></div>
            <div class="row"><span class="label">راننده:</span><span class="value">${data.driverName || '-'}</span></div>
            <div class="row"><span class="label">پلاک:</span><span class="value">${data.plateNumber || '-'}</span></div>
            <div class="status ${data.status === 'خارج شده (بایگانی)' ? 'APPROVED' : data.status.includes('رد') ? 'REJECTED' : 'PENDING'}">
                ${data.status}
            </div>
            ${data.exitTime ? `<div style="text-align:center; margin-top:10px; font-size:18px; font-weight:bold;">🕒 زمان خروج: ${data.exitTime}</div>` : ''}
        </div>`;
    }

    await page.setContent(baseHtml(content));
    const element = await page.$('.card');
    const imageBuffer = await element.screenshot();
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
