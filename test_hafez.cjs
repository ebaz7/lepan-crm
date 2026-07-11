const http = require('http');
const data = JSON.stringify({ 
  query: `
    SELECT 
        SUM(CAST(Field_009 AS FLOAT)) as Bed,
        SUM(CAST(Field_010 AS FLOAT)) as Bes
    FROM ACT_TBL_009 
    WHERE Field_015 LIKE '%حافظ دریا%' OR Field_015 LIKE '%11:0028%'
  ` 
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
