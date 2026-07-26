export const isInFinancialYear = (dateStr: string | undefined | null, financialYear: string | undefined): boolean => {
    if (!financialYear || financialYear === 'all') return true;
    if (!dateStr) return false;
    
    try {
        let shamsiYear: number | null = null;
        const str = String(dateStr).trim();

        // 1. If dateStr starts with a 4-digit Shamsi year (e.g. 13xx or 14xx)
        const shamsiMatch = str.match(/^(13\d\d|14\d\d)[/-]/);
        if (shamsiMatch) {
            shamsiYear = parseInt(shamsiMatch[1], 10);
        } else {
            // 2. Otherwise try parsing as a Gregorian Date
            const d = new Date(str);
            if (!isNaN(d.getTime())) {
                const shamsiDate = d.toLocaleDateString('fa-IR-u-nu-latn');
                const parts = shamsiDate.split('/');
                if (parts.length > 0) {
                    const yStr = parts[0].replace(/[^\d]/g, '');
                    if (yStr) shamsiYear = parseInt(yStr, 10);
                }
            }
        }

        if (!shamsiYear) return false;

        const targetYearStr = String(financialYear).replace(/[^\d]/g, '');
        const targetYear = parseInt(targetYearStr, 10);
        
        if (isNaN(targetYear)) return true;
        return shamsiYear === targetYear;
    } catch (e) {
        return false;
    }
};
