
export const getTehranDateString = () => {
    try {
        const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
        const y = parts.find(p => p.type === 'year')?.value;
        const m = parts.find(p => p.type === 'month')?.value;
        const d = parts.find(p => p.type === 'day')?.value;
        if (y && m && d) return `${y}-${m}-${d}`;
    } catch(e) {}
    // fallback
    const date = new Date(Date.now() + 12600000); // +3:30
    return date.toISOString().split('T')[0];
};

export const generateUUID = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

export const findNextGapNumber = (items, company, field, settingsStart) => {
    let startNum = settingsStart || 1000;
    const existingNumbers = new Set();
    
    if (items && Array.isArray(items)) {
        for (const i of items) {
            const itemCompany = i.company || i.payingCompany || '';
            const targetCompany = company || '';
            if (itemCompany === targetCompany) {
                const num = parseInt(i[field]);
                if (!isNaN(num) && num >= startNum) {
                    existingNumbers.add(num);
                }
            }
        }
    }
    
    let expected = startNum; 
    while (existingNumbers.has(expected)) { expected++; }
    return expected;
};

export const checkForDuplicate = (list, numField, numValue, companyField, companyValue, excludeId = null) => {
    if (!list || !Array.isArray(list)) return false;
    
    const targetNum = Number(numValue);
    const targetCompany = (companyValue || '').toString().trim();

    return list.some(item => {
        if (item.id === excludeId) return false;
        const itemNum = Number(item[numField]);
        const itemCompany = (item[companyField] || '').toString().trim();
        return itemNum === targetNum && itemCompany === targetCompany;
    });
};

export const toShamsiYearMonth = (isoDate) => {
    try {
        if (!isoDate) return '';
        let safeDate = isoDate;
        if (typeof isoDate === 'string' && isoDate.match(/^\d{4}-\d{2}-\d{2}$/)) { safeDate = `${isoDate}T12:00:00.000Z`; }
        const d = new Date(safeDate);
        if (isNaN(d.getTime())) return '';
        const formatter = new Intl.DateTimeFormat('en-US-u-ca-persian', { year: 'numeric', month: '2-digit', timeZone: 'Asia/Tehran' });
        const parts = formatter.formatToParts(d);
        const year = parts.find(p => p.type === 'year')?.value;
        const month = parts.find(p => p.type === 'month')?.value;
        return `${year}/${month.padStart(2, '0')}`;
    } catch (e) { return ''; }
};

export const toShamsiFull = (isoDate) => {
    try { 
        if (!isoDate) return '';
        const d = new Date(isoDate);
        if (isNaN(d.getTime())) return isoDate;
        return new Intl.DateTimeFormat('fa-IR', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Tehran' }).format(d);
    } catch(e) { return isoDate; }
};

export const sanitizeGroupId = (id) => {
    if (!id) return '';
    let str = id.toString().trim();
    // Handle RTL trailing minus "123-" -> "-123"
    if (str.endsWith('-')) {
        str = '-' + str.slice(0, -1);
    }
    // Remove any other non-numeric chars (except minus at start)
    const match = str.match(/^-?\d+/);
    return match ? match[0] : str;
};
