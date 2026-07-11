const http = require('http');
const data = JSON.stringify({
  path: '/query',
  method: 'POST',
  body: { query: `SELECT TOP 5 * FROM STR_TBL_010 WHERE Field_012 = '10615'` } // 10615 is sales invoice (فاکتور فروش) based on previous knowledge, or maybe Field_012 = '571'?
});
const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/sayan-proxy',
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
};
const req = http.request(options, res => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => console.log('RESPONSE STR_TBL_010:', body));
});
req.write(data);
req.end();
