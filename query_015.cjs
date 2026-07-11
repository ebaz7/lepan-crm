const http = require('http');
const data = JSON.stringify({ 
  query: `SELECT TOP 20 Field_015 FROM ACT_TBL_009 WHERE Field_015 IS NOT NULL AND Field_015 <> ''` 
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
