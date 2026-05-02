export const isInFinancialYear = (dateStr: string | undefined | null, financialYear: string | undefined): boolean => {
    if (!financialYear || financialYear === 'all') return true;
    if (!dateStr) return false;
    
    // Convert dateStr (ISO) to Shamsi year
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return false;
        
        // fa-IR-u-nu-latn gives format like "1403/12/29"
        const shamsiDate = d.toLocaleDateString('fa-IR-u-nu-latn');
        const shamsiYear = shamsiDate.split('/')[0];
        
        return shamsiYear === financialYear;
    } catch (e) {
        return false;
    }
};
