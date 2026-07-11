const http = require('http');
const data = JSON.stringify({ 
  query: `SELECT * FROM ACT_TBL_007 WHERE Field_006 LIKE N'%حافظ دریا%'` 
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
  res.on('end', () => console.log("RESPONSE:", body));
});
req.write(data);
req.end();
