const http = require('http');

async function runDirectQuery(queryStr) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ query: queryStr });

    const options = {
      // Connect directly to Sayan API server
      hostname: '192.168.41.225',
      port: 3000,
      path: '/api/external/v1/query',
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        'Authorization': 'Bearer s_gate_live_urp2vvxzpik4',
        'Accept': 'application/json',
        'Content-Length': Buffer.byteLength(data) 
      }
    };

    const req = http.request(options, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve(parsed.data || parsed);
        } catch (e) {
          reject(new Error(`Failed to parse: ${body}`));
        }
      });
    });
    req.on('error', err => reject(err));
    req.write(data);
    req.end();
  });
}

async function main() {
  try {
    console.log('--- Direct Querying Sayan for 112127 ---');
    const q007 = await runDirectQuery(`
      SELECT Field_003 as Code, Field_006 as Name, Field_005 as TafsiliCode, Field_004 as MoeinGroup 
      FROM ACT_TBL_007 
      WHERE Field_003 = '112127' OR Field_005 = '112127'
    `);
    console.log('ACT_TBL_007 results:', q007);

    console.log('\n--- Direct Querying Sayan for Name like متین ---');
    const q007Name = await runDirectQuery(`
      SELECT Field_003 as Code, Field_006 as Name, Field_005 as TafsiliCode, Field_004 as MoeinGroup 
      FROM ACT_TBL_007 
      WHERE Field_006 LIKE N'%متین%'
    `);
    console.log('ACT_TBL_007 by name:', q007Name);

  } catch (err) {
    console.error('Error in direct query:', err);
  }
}

main();
