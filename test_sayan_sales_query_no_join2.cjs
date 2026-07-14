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

        console.log("=================== QUERY HEADER FOR DOC '241' ===================");
        const headerById = await querySayan("SELECT TOP 5 * FROM STR_TBL_010 WHERE Field_001 = '241'");
        console.log("Header by Field_001 = '241':", headerById);

        console.log("=================== QUERY HEADER FOR OTHER COLUMNS IN '241' ===================");
        const headerByField_007 = await querySayan("SELECT TOP 5 * FROM STR_TBL_010 WHERE Field_007 = '00241' OR Field_007 = '241'");
        console.log("Header by Field_007 = '241':", headerByField_007);

        const headerByField_003 = await querySayan("SELECT TOP 5 * FROM STR_TBL_010 WHERE Field_003 = '241'");
        console.log("Header by Field_003 = '241':", headerByField_003);

    } catch (e) {
        console.error("Execution error:", e);
    }
}

run();
