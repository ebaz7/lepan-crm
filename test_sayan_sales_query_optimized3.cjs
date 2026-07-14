const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function run() {
    try {
        const sayanApiUrl = "http://80.210.31.176:5000/api/external/v1";
        const sayanApiKey = "s_gate_live_vgr182bwtpoa";
        const queryUrl = `${sayanApiUrl.replace(/\/$/, '')}/query`;

        async function querySayan(sql) {
            try {
                const res = await fetch(queryUrl, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${sayanApiKey}`,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({ query: sql })
                });
                if (!res.ok) {
                    const text = await res.text();
                    return { error: `HTTP ${res.status}: ${text}` };
                }
                const data = await res.json();
                return data.data || data;
            } catch (e) {
                return { error: e.message };
            }
        }

        console.log("=================== STEP 1: FETCH HEADERS BY DATE ===================");
        const headersSql = `
            SELECT 
                Field_001, Field_008, Field_004, Field_005, Field_009, Field_010, Field_011, Field_019, Field_027, Field_029, Field_037, Field_038, Field_007 
            FROM STR_TBL_010 
            WHERE Field_009 = '12' 
              AND Field_008 >= '2024-03-19T00:00:00.000Z' 
              AND Field_008 <= '2024-03-21T23:59:59.000Z'
            ORDER BY Field_008 DESC
        `;
        const start = Date.now();
        const headers = await querySayan(headersSql);
        console.log(`Headers fetched in ${Date.now() - start}ms. Count:`, Array.isArray(headers) ? headers.length : 'Error', headers);

        if (Array.isArray(headers) && headers.length > 0) {
            console.log("=================== STEP 2: FETCH MATCHING DETAILS ===================");
            
            // Extract unpadded and padded numbers for IN clause
            const numbers = new Set();
            headers.forEach(h => {
                const numStr = String(h.Field_007 || '').trim();
                if (numStr) {
                    numbers.add(`'${numStr}'`);
                    const parsed = parseInt(numStr);
                    if (!isNaN(parsed)) {
                        numbers.add(`'${parsed}'`);
                    }
                }
                const idStr = String(h.Field_001 || '').trim();
                if (idStr) {
                    numbers.add(`'${idStr}'`);
                }
            });

            const idsClause = Array.from(numbers).join(',');
            const detailsSql = `
                SELECT * 
                FROM STR_TBL_011 
                WHERE Field_004 IN (${idsClause})
            `;
            const start2 = Date.now();
            const details = await querySayan(detailsSql);
            console.log(`Details fetched in ${Date.now() - start2}ms. Count:`, Array.isArray(details) ? details.length : 'Error');
            
            if (Array.isArray(details) && details.length > 0) {
                console.log("Matching sample detail:", details[0]);
                
                // Let's match them in memory using our hybrid logic
                const matched = headers.map(row => {
                    const matchedDetails = details.filter((d) => {
                        const detailDocId = String(d.Field_004).trim();
                        const headerDocId = String(row.Field_001).trim();
                        const headerDocNum = String(row.Field_007).trim();
                        
                        if (detailDocId === headerDocId) return true;
                        if (parseInt(detailDocId) === parseInt(headerDocNum)) return true;
                        return false;
                    });
                    return {
                        DocId: row.Field_001,
                        DocNum: row.Field_007,
                        Date: row.Field_008,
                        ItemsCount: matchedDetails.length,
                        Items: matchedDetails
                    };
                });
                console.log("Matched documents with items:", matched);
            }
        }

    } catch (e) {
        console.error("Execution error:", e);
    }
}

run();
