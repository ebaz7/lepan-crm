const http = require('http');

async function runQuery(queryStr) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
        path: '/query',
        method: 'POST',
        body: { query: queryStr }
    });

    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/sayan-proxy',
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        'Content-Length': Buffer.byteLength(data) 
      }
    };

    const req = http.request(options, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        console.log('Status code:', res.statusCode);
        console.log('Raw body response:', body);
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
    const q007 = await runQuery(`SELECT TOP 1 Field_003, Field_006 FROM ACT_TBL_007`);
  } catch (err) {
    console.error('Error running main:', err);
  }
}

main();
