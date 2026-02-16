
// ... (Previous server code) ...

// --- FIXED DELETE LOGIC ---
app.delete('/api/exit-permits/:id', (req, res) => { 
    const db = getDb(); 
    const idToDelete = req.params.id;
    
    // Ensure array exists to prevent crash
    if (!db.exitPermits) {
        db.exitPermits = [];
        return res.json([]);
    }

    // Ensure we compare IDs as strings to avoid type mismatch bugs
    // Some IDs might be numbers in older records, params are strings
    const initialLen = db.exitPermits.length;
    
    // Filter out the item
    db.exitPermits = db.exitPermits.filter(p => String(p.id) !== String(idToDelete)); 
    
    if (db.exitPermits.length === initialLen) {
        // Fallback: try removing by permitNumber if ID match failed (rare edge case for legacy data)
         db.exitPermits = db.exitPermits.filter(p => String(p.permitNumber) !== String(idToDelete));
    }

    saveDb(db); 
    res.json(db.exitPermits); 
});

// ... (Rest of server code) ...
