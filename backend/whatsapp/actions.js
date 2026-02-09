
// Helper to save DB
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '..', '..', 'database.json');

const saveDb = (data) => {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
    } catch (e) { console.error("DB Write Error", e); }
};

const generateUUID = () => Date.now().toString(36) + Math.random().toString(36).substr(2);
const formatCurrency = (amount) => new Intl.NumberFormat('fa-IR').format(amount) + ' ریال';
const formatDate = () => new Date().toLocaleDateString('fa-IR');

// --- ACTIONS ---

export const handleCreatePayment = (db, args) => {
    const trackingNum = (db.settings.currentTrackingNumber || 1000) + 1;
    db.settings.currentTrackingNumber = trackingNum;
    
    const amount = typeof args.amount === 'string' ? parseInt(args.amount.replace(/[^0-9]/g, '')) : args.amount;
    
    const newOrder = { 
        id: generateUUID(), 
        trackingNumber: trackingNum, 
        date: new Date().toISOString().split('T')[0], 
        payee: args.payee, 
        totalAmount: amount, 
        description: args.description || 'ثبت از طریق ربات', 
        status: 'در انتظار بررسی مالی', 
        requester: 'Bot', 
        payingCompany: db.settings.defaultCompany, 
        paymentDetails: [
            {
                id: generateUUID(), 
                method: 'حواله بانکی', 
                amount: amount, 
                bankName: args.bank || 'نامشخص',
                description: args.description || 'ثبت خودکار'
            }
        ], 
        createdAt: Date.now() 
    };
    
    db.orders.unshift(newOrder);
    saveDb(db);
    return `✅ *دستور پرداخت ثبت شد*\n🔹 شماره: ${trackingNum}\n💰 مبلغ: ${formatCurrency(amount)}\n👤 ذینفع: ${args.payee}\n🏦 بانک: ${args.bank || '-'}`;
};

export const handleCreateBijak = (db, args) => {
    const company = db.settings.defaultCompany || 'نامشخص';
    const nextSeq = (db.settings.warehouseSequences?.[company] || 1000) + 1;
    if (!db.settings.warehouseSequences) db.settings.warehouseSequences = {};
    db.settings.warehouseSequences = { ...db.settings.warehouseSequences, [company]: nextSeq };
    
    const newTx = { 
        id: generateUUID(), 
        type: 'OUT', 
        date: new Date().toISOString(), 
        company: company, 
        number: nextSeq, 
        recipientName: args.recipient,
        driverName: args.driver || '',   
        plateNumber: args.plate || '',   
        items: [
            {
                itemId: generateUUID(), 
                itemName: args.itemName, 
                quantity: Number(args.count), 
                weight: 0,
                unitPrice: 0
            }
        ], 
        status: 'PENDING',
        createdAt: Date.now(), 
        createdBy: 'Bot' 
    };
    
    db.warehouseTransactions.unshift(newTx);
    saveDb(db);
    
    let msg = `📦 *حواله خروج (بیجک) صادر شد*\n🔹 شماره: ${nextSeq}\n📦 کالا: ${args.count} عدد ${args.itemName}\n👤 گیرنده: ${args.recipient}`;
    return msg;
};

export const handleApprovePayment = (db, number) => {
    const order = db.orders.find(o => o.trackingNumber == number);
    if (!order) return "❌ دستور پرداخت یافت نشد.";
    
    let oldStatus = order.status;
    if (order.status === 'در انتظار بررسی مالی') order.status = 'تایید مالی / در انتظار مدیریت';
    else if (order.status === 'تایید مالی / در انتظار مدیریت') order.status = 'تایید مدیریت / در انتظار مدیرعامل';
    else if (order.status === 'تایید مدیریت / در انتظار مدیرعامل') order.status = 'تایید نهایی';
    else if (order.status === 'تایید نهایی') return "ℹ️ این سند قبلاً تایید نهایی شده است.";
    
    saveDb(db);
    return `✅ *تایید شد*\nدستور پرداخت: ${number}\nوضعیت قبلی: ${oldStatus}\nوضعیت جدید: ${order.status}`;
};

export const handleRejectPayment = (db, number) => {
    const order = db.orders.find(o => o.trackingNumber == number);
    if (!order) return "❌ دستور پرداخت یافت نشد.";
    
    order.status = 'رد شده';
    saveDb(db);
    return `🚫 دستور پرداخت ${number} رد شد.`;
};

export const handleApproveExit = (db, number) => {
    const permit = db.exitPermits.find(p => p.permitNumber == number);
    if (!permit) return "❌ مجوز خروج یافت نشد.";
    
    let oldStatus = permit.status;
    if (permit.status === 'در انتظار تایید مدیرعامل') permit.status = 'در انتظار مدیر کارخانه';
    else if (permit.status === 'در انتظار مدیر کارخانه') permit.status = 'در انتظار تایید انبار';
    else if (permit.status === 'در انتظار تایید انبار') permit.status = 'در انتظار خروج';
    else if (permit.status === 'در انتظار خروج') permit.status = 'خارج شده (بایگانی)';
    else return "ℹ️ وضعیت این مجوز قابل تغییر نیست.";
    
    saveDb(db);
    return `✅ *تایید شد*\nمجوز خروج: ${number}\nوضعیت جدید: ${permit.status}`;
};

export const handleRejectExit = (db, number) => {
    const permit = db.exitPermits.find(p => p.permitNumber == number);
    if (!permit) return "❌ مجوز خروج یافت نشد.";
    
    permit.status = 'رد شده';
    saveDb(db);
    return `🚫 مجوز خروج ${number} رد شد.`;
};

// --- SPECIFIC REPORTS FOR BUTTONS ---

export const handlePaymentReport = (db, filterRole) => {
    let orders = db.orders.filter(o => o.status !== 'رد شده' && o.status !== 'باطل شده' && o.status !== 'تایید نهایی');
    
    if (filterRole === 'financial') orders = orders.filter(o => o.status === 'در انتظار بررسی مالی');
    if (filterRole === 'manager') orders = orders.filter(o => o.status === 'تایید مالی / در انتظار مدیریت');
    if (filterRole === 'ceo') orders = orders.filter(o => o.status === 'تایید مدیریت / در انتظار مدیرعامل');

    if (orders.length === 0) return "✅ کارتابل پرداخت خالی است.";

    let report = `💰 *کارتابل پرداخت*\n------------------\n`;
    orders.forEach(o => {
        report += `🔹 شماره: ${o.trackingNumber}\n`;
        report += `👤 ذینفع: ${o.payee}\n`;
        report += `💵 مبلغ: ${formatCurrency(o.totalAmount)}\n`;
        report += `📊 وضعیت: ${o.status}\n`;
        report += `⏳ اقدام: تایید ${o.trackingNumber}\n`;
        report += `------------------\n`;
    });
    return report;
};

export const handleExitReport = (db) => {
    const permits = db.exitPermits.filter(p => p.status !== 'خارج شده (بایگانی)' && p.status !== 'رد شده');
    
    if (permits.length === 0) return "✅ کارتابل خروج خالی است.";

    let report = `🚛 *کارتابل خروج بار*\n------------------\n`;
    permits.forEach(p => {
        report += `🔸 مجوز: ${p.permitNumber}\n`;
        report += `👤 گیرنده: ${p.recipientName}\n`;
        report += `📦 کالا: ${p.goodsName}\n`;
        report += `📊 وضعیت: ${p.status}\n`;
        report += `⏳ اقدام: تایید ${p.permitNumber}\n`;
        report += `------------------\n`;
    });
    return report;
};

export const handleBijakReport = (db) => {
    const bijaks = db.warehouseTransactions.filter(t => t.type === 'OUT' && t.status === 'PENDING');
    
    if (bijaks.length === 0) return "✅ کارتابل بیجک خالی است.";

    let report = `📦 *بیجک‌های در انتظار تایید*\n------------------\n`;
    bijaks.forEach(b => {
        const items = b.items.map(i => i.itemName).join(', ');
        report += `🔹 شماره: ${b.number}\n`;
        report += `👤 گیرنده: ${b.recipientName}\n`;
        report += `📦 اقلام: ${items}\n`;
        report += `------------------\n`;
    });
    return report;
};

export const handleReport = (db) => {
    return handlePaymentReport(db, null) + "\n" + handleExitReport(db);
};
