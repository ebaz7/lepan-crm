import fetch from 'node-fetch';

async function test(url, key) {
  try {
    const res = await fetch(`${url}/query`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify({ query: "SELECT TOP 1 Field_001 FROM STR_TBL_010" })
    });
    console.log("Status:", url, res.status);
    const data = await res.json();
    console.log("Data:", data);
  } catch(e) {
    console.error("Error for", url, e.message);
  }
}

async function run() {
  await test('http://192.168.41.225:3000/api/external/v1', 's_gate_live_urp2vvxzpik4');
  await test('http://80.210.31.176:5000/api/external/v1', 's_gate_live_vgr182bwtpoa');
}
run();
