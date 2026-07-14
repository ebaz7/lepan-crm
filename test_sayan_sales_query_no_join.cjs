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

        console.log("=================== QUERY DETAILS FOR DOC 415182 ===================");
        const details = await querySayan("SELECT TOP 10 * FROM STR_TBL_011 WHERE Field_004 = '415182'");
        console.log("Details for doc 415182:", details);

        console.log("=================== LET'S FIND ANY ROWS IN STR_TBL_011 ===================");
        const anyDetails = await querySayan("SELECT TOP 5 * FROM STR_TBL_011");
        console.log("Any Details:", anyDetails);

    } catch (e) {
        console.error("Execution error:", e);
    }
}

run();
