import fetch from 'node-fetch';

async function test() {
  const payload = {
    dateFrom: "1402/01/01",
    dateTo: "1402/01/01",
    items: [],
    totals: { qty_61: 10, grandTotal: 10 },
    waste: { details: "test", amount: 1 }
  };
  const res = await fetch('http://localhost:3000/api/sayan/production-report/send-bot', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  console.log(await res.text());
}
test();
