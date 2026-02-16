
// ... (قبلی کدها حفظ شود)

// --- FIXED DELETE LOGIC ---
app.delete('/api/exit-permits/:id', (req, res) => { 
    const db = getDb(); 
    const idToDelete = req.params.id;
    
    // اطمینان از وجود آرایه برای جلوگیری از خطای سرور
    if (!db.exitPermits) {
        db.exitPermits = [];
        return res.json([]);
    }

    // تبدیل هر دو طرف مقایسه به رشته برای جلوگیری از خطای تایپ (String vs Number)
    const initialLen = db.exitPermits.length;
    
    db.exitPermits = db.exitPermits.filter(p => String(p.id) !== String(idToDelete)); 
    
    // اگر با ID حذف نشد (در موارد نادر دیتای قدیمی)، تلاش برای حذف با شماره مجوز
    if (db.exitPermits.length === initialLen) {
         db.exitPermits = db.exitPermits.filter(p => String(p.permitNumber) !== String(idToDelete));
    }

    saveDb(db); 
    res.json(db.exitPermits); 
});

// ... (ادامه کدها حفظ شود)
