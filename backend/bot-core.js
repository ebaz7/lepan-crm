
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as Renderer from './renderer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '..', 'database.json');

const sessions = {}; 

// --- DATA ACCESS ---
const getDb = () => {
    try { 
        if (fs.existsSync(DB_PATH)) return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); 
    } catch (e) {}
    return { users: [], orders: [], exitPermits: [], warehouseTransactions: [], tradeRecords: [], settings: { companyNames: [] }, warehouseItems: [] };
};
const saveDb = (data) => fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));

const resolveUser = (db, platform, chatId) => {
    if (platform === 'telegram') return db.users.find(u => u.telegramChatId == chatId);
    if (platform === 'bale') return db.users.find(u => u.baleChatId == chatId);
    return null;
};

// --- KEYBOARDS ---
const KEYBOARDS = {
    MAIN: {
        inline_keyboard: [
            [{ text: '💰 مدیریت پرداخت', callback_data: 'MENU_PAY' }, { text: '🚛 مدیریت خروج', callback_data: 'MENU_EXIT' }],
            [{ text: '📦 انبار و موجودی', callback_data: 'MENU_WH' }, { text: '🌍 بازرگانی', callback_data: 'MENU_TRADE' }],
            [{ text: '📊 گزارشات مدیریتی', callback_data: 'MENU_REPORTS' }, { text: '👤 پروفایل', callback_data: 'MENU_PROFILE' }]
        ]
    },
    PAYMENT: {
        inline_keyboard: [
            [{ text: '➕ ثبت دستور پرداخت', callback_data: 'ACT_PAY_NEW' }],
            [{ text: '📂 کارتابل پرداخت', callback_data: 'ACT_PAY_CARTABLE' }],
            [{ text: '🗄️ آرشیو و جستجو', callback_data: 'ACT_PAY_ARCHIVE' }],
            [{ text: '📄 گزارش PDF پرداخت‌های اخیر', callback_data: 'RPT_PDF_PAY_RECENT' }],
            [{ text: '🔙 بازگشت', callback_data: 'MENU_MAIN' }]
        ]
    },
    EXIT: {
        inline_keyboard: [
            [{ text: '➕ ثبت مجوز خروج', callback_data: 'ACT_EXIT_NEW' }],
            [{ text: '📂 کارتابل خروج', callback_data: 'ACT_EXIT_CARTABLE' }],
            [{ text: '📄 گزارش PDF خروجی‌های اخیر', callback_data: 'RPT_PDF_EXIT_RECENT' }],
            [{ text: '🔙 بازگشت', callback_data: 'MENU_MAIN' }]
        ]
    },
    WAREHOUSE: {
        inline_keyboard: [
            [{ text: '📦 موجودی انبار (Stock PDF)', callback_data: 'WH_RPT_STOCK' }],
            [{ text: '📄 کاردکس کالا (PDF)', callback_data: 'WH_RPT_KARDEX' }],
            [{ text: '🚛 آخرین بیجک‌های خروجی (PDF)', callback_data: 'WH_RPT_BIJAKS' }],
            [{ text: '📥 آخرین رسیدهای ورود (PDF)', callback_data: 'WH_RPT_RECEIPTS' }],
            [{ text: '🔙 بازگشت', callback_data: 'MENU_MAIN' }]
        ]
    },
    TRADE: {
        inline_keyboard: [
            [{ text: '📂 لیست پرونده‌های فعال (PDF)', callback_data: 'TRD_RPT_ACTIVE' }],
            [{ text: '⏳ گزارش صف تخصیص ارز (PDF)', callback_data: 'TRD_RPT_ALLOCATION' }],
            [{ text: '💰 گزارش خرید ارز (PDF)', callback_data: 'TRD_RPT_CURRENCY' }],
            [{ text: '🛡️ گزارش تضامین و بیمه (PDF)', callback_data: 'TRD_RPT_INSURANCE' }],
            [{ text: '🔙 بازگشت', callback_data: 'MENU_MAIN' }]
        ]
    },
    BACK: { inline_keyboard: [[{ text: '🔙 انصراف', callback_data: 'MENU_MAIN' }]] }
};

// --- HANDLERS ---

export const handleMessage = async (platform, chatId, text, sendFn, sendPhotoFn, sendDocFn) => {
    const db = getDb();
    const user = resolveUser(db, platform, chatId);
    if (!user) return sendFn(chatId, "⛔ دسترسی غیرمجاز.");

    if (!sessions[chatId]) sessions[chatId] = { state: 'IDLE', data: {} };
    const session = sessions[chatId];

    if (text === '/start' || text === 'شروع') {
        session.state = 'IDLE';
        return sendFn(chatId, `👋 سلام ${user.fullName}\nخوش آمدید.`, { reply_markup: KEYBOARDS.MAIN });
    }

    // --- FORMS ---
    // 1. Payment
    if (session.state === 'PAY_AMOUNT') {
        const amt = parseInt(text.replace(/,/g, '').replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
        if (isNaN(amt)) return sendFn(chatId, "❌ مبلغ نامعتبر.");
        session.data.amount = amt;
        session.state = 'PAY_PAYEE';
        return sendFn(chatId, "👤 نام ذینفع:", { reply_markup: KEYBOARDS.BACK });
    }
    if (session.state === 'PAY_PAYEE') {
        session.data.payee = text;
        session.state = 'PAY_DESC';
        return sendFn(chatId, "📝 بابت:", { reply_markup: KEYBOARDS.BACK });
    }
    if (session.state === 'PAY_DESC') {
        const order = {
            id: Date.now().toString(),
            trackingNumber: (db.settings.currentTrackingNumber || 1000) + 1,
            date: new Date().toISOString().split('T')[0],
            payee: session.data.payee,
            totalAmount: session.data.amount,
            description: text,
            status: 'در انتظار بررسی مالی',
            requester: user.fullName,
            payingCompany: session.data.company || db.settings.defaultCompany || '-',
            createdAt: Date.now(),
            paymentDetails: [{ id: Date.now().toString(), method: 'حواله بانکی', amount: session.data.amount }]
        };
        db.settings.currentTrackingNumber = order.trackingNumber;
        if(!db.orders) db.orders = [];
        db.orders.unshift(order);
        saveDb(db);
        session.state = 'IDLE';
        await sendFn(chatId, `✅ سند #${order.trackingNumber} ثبت شد.`);
        await notifyRole(db, 'financial', `🔔 پرداخت جدید #${order.trackingNumber}`, 'PAYMENT', order, sendFn, sendPhotoFn);
        return;
    }

    // 2. Exit
    if (session.state === 'EXIT_RECIPIENT') {
        session.data.recipient = text;
        session.state = 'EXIT_GOODS';
        return sendFn(chatId, "📦 نام کالا:", { reply_markup: KEYBOARDS.BACK });
    }
    if (session.state === 'EXIT_GOODS') {
        session.data.goods = text;
        session.state = 'EXIT_COUNT';
        return sendFn(chatId, "🔢 تعداد:", { reply_markup: KEYBOARDS.BACK });
    }
    if (session.state === 'EXIT_COUNT') {
        const permit = {
            id: Date.now().toString(),
            permitNumber: (db.settings.currentExitPermitNumber || 1000) + 1,
            date: new Date().toISOString().split('T')[0],
            recipientName: session.data.recipient,
            goodsName: session.data.goods,
            cartonCount: parseInt(text) || 0,
            weight: 0,
            company: session.data.company || db.settings.defaultCompany || '-',
            status: 'در انتظار تایید مدیرعامل',
            requester: user.fullName,
            items: [{ goodsName: session.data.goods, cartonCount: parseInt(text)||0, weight: 0 }],
            createdAt: Date.now()
        };
        db.settings.currentExitPermitNumber = permit.permitNumber;
        if(!db.exitPermits) db.exitPermits = [];
        db.exitPermits.push(permit);
        saveDb(db);
        session.state = 'IDLE';
        await sendFn(chatId, `✅ خروج #${permit.permitNumber} ثبت شد.`);
        await notifyRole(db, 'ceo', `🔔 خروج جدید #${permit.permitNumber}`, 'EXIT', permit, sendFn, sendPhotoFn);
        return;
    }

    return sendFn(chatId, "دستور نامعتبر.", { reply_markup: KEYBOARDS.MAIN });
};

export const handleCallback = async (platform, chatId, data, sendFn, sendPhotoFn) => {
    const db = getDb();
    const user = resolveUser(db, platform, chatId);
    if (!user) return;

    if (!sessions[chatId]) sessions[chatId] = { state: 'IDLE', data: {} };
    const session = sessions[chatId];

    // Navigation
    if (data === 'MENU_MAIN') return sendFn(chatId, "🏠 منوی اصلی:", { reply_markup: KEYBOARDS.MAIN });
    if (data === 'MENU_PAY') return sendFn(chatId, "💰 مدیریت پرداخت:", { reply_markup: KEYBOARDS.PAYMENT });
    if (data === 'MENU_EXIT') return sendFn(chatId, "🚛 مدیریت خروج:", { reply_markup: KEYBOARDS.EXIT });
    if (data === 'MENU_WH') return sendFn(chatId, "📦 مدیریت انبار:", { reply_markup: KEYBOARDS.WAREHOUSE });
    if (data === 'MENU_TRADE') return sendFn(chatId, "🌍 مدیریت بازرگانی:", { reply_markup: KEYBOARDS.TRADE });

    // Actions
    if (data === 'ACT_PAY_NEW') {
        session.state = 'PAY_AMOUNT';
        return sendFn(chatId, "💵 مبلغ (ریال):");
    }
    if (data === 'ACT_EXIT_NEW') {
        session.state = 'EXIT_RECIPIENT';
        return sendFn(chatId, "👤 گیرنده:");
    }

    // --- CARTABLES (SMART ADMIN CHECK) ---
    if (data === 'ACT_PAY_CARTABLE') {
        let items = [];
        // ADMIN sees ALL pending
        if (user.role === 'admin') {
            items = (db.orders || []).filter(o => 
                o.status === 'در انتظار بررسی مالی' || 
                o.status === 'تایید مالی / در انتظار مدیریت' || 
                o.status === 'تایید مدیریت / در انتظار مدیرعامل' ||
                o.status.includes('ابطال')
            );
        } else {
            // Normal roles
            if (user.role === 'financial') items = (db.orders || []).filter(o => o.status === 'در انتظار بررسی مالی');
            if (user.role === 'manager') items = (db.orders || []).filter(o => o.status === 'تایید مالی / در انتظار مدیریت');
            if (user.role === 'ceo') items = (db.orders || []).filter(o => o.status === 'تایید مدیریت / در انتظار مدیرعامل');
        }
        
        if (items.length === 0) return sendFn(chatId, "✅ کارتابل پرداخت خالی است.");
        
        for (const item of items) {
            const img = await Renderer.generateRecordImage(item, 'PAYMENT');
            const kb = { inline_keyboard: [[{ text: '✅ تایید', callback_data: `APP_PAY_${item.id}` }, { text: '❌ رد', callback_data: `REJ_PAY_${item.id}` }]] };
            await sendPhotoFn(platform, chatId, img, `سند #${item.trackingNumber}`, { reply_markup: kb });
        }
        return;
    }

    if (data === 'ACT_EXIT_CARTABLE') {
        let items = [];
        if (user.role === 'admin') {
            items = (db.exitPermits || []).filter(p => 
                p.status === 'در انتظار تایید مدیرعامل' || 
                p.status === 'در انتظار مدیر کارخانه' || 
                p.status === 'در انتظار تایید انبار' ||
                p.status === 'در انتظار خروج'
            );
        } else {
            if (user.role === 'ceo') items = (db.exitPermits || []).filter(p => p.status === 'در انتظار تایید مدیرعامل');
            if (user.role === 'factory_manager') items = (db.exitPermits || []).filter(p => p.status === 'در انتظار مدیر کارخانه');
            if (user.role === 'warehouse_keeper') items = (db.exitPermits || []).filter(p => p.status === 'در انتظار تایید انبار');
            if (user.role === 'security_head') items = (db.exitPermits || []).filter(p => p.status === 'در انتظار خروج');
        }

        if (items.length === 0) return sendFn(chatId, "✅ کارتابل خروج خالی است.");

        for (const item of items) {
            const img = await Renderer.generateRecordImage(item, 'EXIT');
            const kb = { inline_keyboard: [[{ text: '✅ تایید', callback_data: `APP_EXIT_${item.id}` }, { text: '❌ رد', callback_data: `REJ_EXIT_${item.id}` }]] };
            await sendPhotoFn(platform, chatId, img, `مجوز #${item.permitNumber}`, { reply_markup: kb });
        }
        return;
    }

    // --- APPROVALS ---
    if (data.startsWith('APP_PAY_')) {
        const id = data.replace('APP_PAY_', '');
        const order = db.orders.find(o => o.id === id);
        if (order) {
            let next = '';
            if (order.status === 'در انتظار بررسی مالی') next = 'تایید مالی / در انتظار مدیریت';
            else if (order.status === 'تایید مالی / در انتظار مدیریت') next = 'تایید مدیریت / در انتظار مدیرعامل';
            else if (order.status === 'تایید مدیریت / در انتظار مدیرعامل') next = 'تایید نهایی';
            
            if (next) {
                order.status = next;
                saveDb(db);
                sendFn(chatId, `✅ تایید شد. وضعیت جدید: ${next}`);
                // Notify logic here (omitted for brevity)
            }
        }
    }

    // --- PDF REPORTS GENERATION ---
    
    // 1. WAREHOUSE STOCK PDF
    if (data === 'WH_RPT_STOCK') {
        sendFn(chatId, "⏳ در حال تولید گزارش موجودی انبار...");
        const items = db.warehouseItems || [];
        const txs = db.warehouseTransactions || [];
        
        // Calculate Stock
        const stockData = items.map(item => {
            let qty = 0;
            txs.forEach(tx => {
                if (tx.status !== 'REJECTED') {
                    const line = tx.items.find(i => i.itemId === item.id);
                    if (line) {
                        if (tx.type === 'IN') qty += line.quantity;
                        else qty -= line.quantity;
                    }
                }
            });
            return [item.name, item.code || '-', item.unit, qty];
        });

        const pdf = await Renderer.generateReportPDF('گزارش موجودی انبار', ['نام کالا', 'کد', 'واحد', 'موجودی'], stockData);
        // Using generic sendDoc if platform supports buffer
        // Note: For Bale/Telegram node libs, Buffer is supported.
        // We assume sendPhotoFn handles logic, but let's assume we pass a generic sendDocFn in server.js
        if(sendDocFn) await sendDocFn(chatId, pdf, 'Stock_Report.pdf', 'گزارش موجودی انبار');
        else sendFn(chatId, "PDF Created (Mock)");
    }

    // 2. TRADE REPORTS
    if (data === 'TRD_RPT_ALLOCATION') {
        sendFn(chatId, "⏳ در حال تولید گزارش صف تخصیص...");
        const records = (db.tradeRecords || []).filter(r => r.status !== 'Completed');
        const rows = records.map(r => [
            r.fileNumber, 
            r.goodsName, 
            r.company, 
            (r.stages['ALLOCATION_QUEUE']?.isCompleted ? 'در صف' : 'تخصیص یافته'),
            `${r.mainCurrency} ${r.freightCost}`
        ]);
        const pdf = await Renderer.generateReportPDF('گزارش صف تخصیص ارز', ['پرونده', 'کالا', 'شرکت', 'وضعیت', 'مبلغ'], rows, true);
        if(sendDocFn) await sendDocFn(chatId, pdf, 'Allocation_Report.pdf', 'گزارش صف تخصیص');
    }

    if (data === 'TRD_RPT_ACTIVE') {
        sendFn(chatId, "⏳ در حال تولید لیست پرونده‌ها...");
        const records = (db.tradeRecords || []).filter(r => r.status !== 'Completed');
        const rows = records.map(r => [r.fileNumber, r.goodsName, r.sellerName, r.company]);
        const pdf = await Renderer.generateReportPDF('لیست پرونده‌های فعال', ['شماره', 'کالا', 'فروشنده', 'شرکت'], rows);
        if(sendDocFn) await sendDocFn(chatId, pdf, 'Active_Files.pdf', 'لیست پرونده‌ها');
    }

    // 3. PAYMENT RECENT
    if (data === 'RPT_PDF_PAY_RECENT') {
        sendFn(chatId, "⏳ در حال تولید گزارش...");
        const recents = (db.orders || []).slice(0, 20).map(o => [o.trackingNumber, o.payee, o.totalAmount.toLocaleString(), o.date, o.status]);
        const pdf = await Renderer.generateReportPDF('لیست ۲۰ پرداخت اخیر', ['شماره', 'ذینفع', 'مبلغ', 'تاریخ', 'وضعیت'], recents);
        if(sendDocFn) await sendDocFn(chatId, pdf, 'Recent_Payments.pdf', 'گزارش پرداخت');
    }

    // 4. EXIT RECENT
    if (data === 'RPT_PDF_EXIT_RECENT') {
        sendFn(chatId, "⏳ در حال تولید گزارش...");
        const recents = (db.exitPermits || []).slice(0, 20).map(p => [p.permitNumber, p.recipientName, p.goodsName, p.date, p.status]);
        const pdf = await Renderer.generateReportPDF('لیست ۲۰ خروج اخیر', ['شماره', 'گیرنده', 'کالا', 'تاریخ', 'وضعیت'], recents);
        if(sendDocFn) await sendDocFn(chatId, pdf, 'Recent_Exits.pdf', 'گزارش خروج');
    }
};

const notifyRole = async (db, role, caption, type, data, sendFn, sendPhotoFn) => {
    const users = db.users.filter(u => u.role === role || u.role === 'admin');
    for (const u of users) {
        if (u.telegramChatId) {
            const img = await Renderer.generateRecordImage(data, type);
            const kb = { inline_keyboard: [[{ text: '✅ بررسی', callback_data: `ACT_${type}_CARTABLE` }]] };
            try { await sendPhotoFn('telegram', u.telegramChatId, img, caption, { reply_markup: kb }); } catch(e){}
        }
        if (u.baleChatId) {
            const img = await Renderer.generateRecordImage(data, type);
            const kb = { inline_keyboard: [[{ text: '✅ بررسی', callback_data: `ACT_${type}_CARTABLE` }]] };
            try { await sendPhotoFn('bale', u.baleChatId, img, caption, { reply_markup: kb }); } catch(e){}
        }
    }
};
