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
        description: args.description || 'ثبت از طریق واتساپ', 
        status: 'در انتظار بررسی مالی', 
        requester: 'WhatsApp', 
        payingCompany: db.settings.defaultCompany, 
        paymentDetails: [{ id: generateUUID(), method: 'حواله بانکی', amount: amount, bankName: args.bank || 'نامشخص', description: args.description || 'ثبت خودکار' }], 
        createdAt: Date.now() 
    };
    db.orders.unshift(newOrder);
    saveDb(db);
    return `✅ *دستور پرداخت ثبت شد*\n🔹 شماره: ${trackingNum}\n💰 مبلغ: ${formatCurrency(amount)}\n👤 ذینفع: ${args.payee}\n🏦 بانک: ${args.bank || '-'}`;
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
    return `✅ *تایید شد*\nدستور پرداخت: ${number}\nوضعیت جدید: ${order.status}`;
};

export const handleRejectPayment = (db, number) => {
    const order = db.orders.find(o => o.trackingNumber == number);
    if (!order) return "❌ دستور پرداخت یافت نشد.";
    order.status = 'رد شده';
    saveDb(db);
    return `🚫 دستور پرداخت ${number} رد شد.`;
};

export const handleReport = (db) => {
    const pendingOrders = db.orders.filter(o => o.status !== 'تایید نهایی' && o.status !== 'رد شده');
    let report = `📊 گزارش کارتابل دستور پرداخت‌ها\nوضعیت: ${formatDate()}\n---------------------------\n`;
    if (pendingOrders.length > 0) {
        pendingOrders.forEach(o => { report += `🔹 شماره: ${o.trackingNumber}\n👤 ذینفع: ${o.payee}\n💰 مبلغ: ${formatCurrency(o.totalAmount)}\n⏳ وضعیت: ${o.status}\n---------------------------\n`; });
    } else { report += "هیچ دستور پرداخت بازی وجود ندارد."; }
    return report;
};
