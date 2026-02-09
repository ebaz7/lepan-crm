
export const parseMessage = async (text, db) => {
    if (!text) return null;
    
    // Normalize text (Persian numbers to English, trim)
    const cleanText = text.replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).trim();
    const lowerText = cleanText.toLowerCase();

    // --- BALE MENU BUTTON TRIGGERS ---
    if (cleanText.includes('کارتابل پرداخت') || cleanText.includes('لیست پرداخت')) return { intent: 'REPORT_PAYMENT' };
    if (cleanText.includes('کارتابل خروج') || cleanText.includes('لیست خروج')) return { intent: 'REPORT_EXIT' };
    if (cleanText.includes('کارتابل بیجک') || cleanText.includes('لیست انبار')) return { intent: 'REPORT_BIJAK' };
    if (cleanText.includes('گزارشات کلی') || lowerText === 'report') return { intent: 'REPORT_GENERAL' };
    if (cleanText.includes('بایگانی')) return { intent: 'ARCHIVE_VIEW' }; 

    // --- APPROVAL / REJECTION LOGIC (Text Commands) ---
    
    // Payment: "تایید پرداخت 1001" or "ok 1001"
    const payApproveMatch = cleanText.match(/^(?:تایید|ok|yes)\s+(?:پرداخت|سند|واریز|هزینه|p)\s*(\d+)$/i);
    if (payApproveMatch) return { intent: 'APPROVE_PAYMENT', args: { number: payApproveMatch[1] } };

    const payRejectMatch = cleanText.match(/^(?:رد|کنسل|no|reject)\s+(?:پرداخت|سند|واریز|هزینه|p)\s*(\d+)$/i);
    if (payRejectMatch) return { intent: 'REJECT_PAYMENT', args: { number: payRejectMatch[1] } };

    // Exit: "تایید خروج 1001"
    const exitApproveMatch = cleanText.match(/^(?:تایید|ok|yes)\s+(?:خروج|بیجک|حواله|بار|مجوز|b)\s*(\d+)$/i);
    if (exitApproveMatch) return { intent: 'APPROVE_EXIT', args: { number: exitApproveMatch[1] } };

    const exitRejectMatch = cleanText.match(/^(?:رد|کنسل|no|reject)\s+(?:خروج|بیجک|حواله|بار|مجوز|b)\s*(\d+)$/i);
    if (exitRejectMatch) return { intent: 'REJECT_EXIT', args: { number: exitRejectMatch[1] } };

    // Generic: "تایید 1001" (Ambiguous handling)
    const genericMatch = cleanText.match(/^(?:تایید|اوکی|ok|رد|کنسل)\s+(\d+)$/i);
    if (genericMatch) {
        const action = cleanText.match(/رد|کنسل|no|reject/i) ? 'REJECT' : 'APPROVE';
        const number = genericMatch[1];
        
        const order = db.orders.find(o => o.trackingNumber == number);
        const permit = db.exitPermits.find(p => p.permitNumber == number);

        // If number exists in both, ask for clarity
        if (order && permit) return { intent: 'AMBIGUOUS', args: { number } };
        
        if (order) return { intent: `${action}_PAYMENT`, args: { number } };
        if (permit) return { intent: `${action}_EXIT`, args: { number } };
        
        return { intent: 'NOT_FOUND', args: { number } };
    }

    return null;
};
