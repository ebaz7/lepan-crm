import fetch from 'node-fetch';

async function query(sql) {
  const res = await fetch('http://localhost:3000/api/sayan-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      method: 'POST',
      path: '/query',
      body: { query: sql }
    })
  });
  return res.json();
}

async function main() {
  try {
    console.log("=== Checking STR_TBL_010 distinct Field_009 (Types) ===");
    const types = await query(`SELECT DISTINCT Field_009 FROM STR_TBL_010`);
    console.log("Doc types:", types);

    console.log("=== Searching for Invoice 15 / Madadi ===");
    const inv15 = await query(`
      SELECT t10.*, t07.Field_006 as CustomerName 
      FROM STR_TBL_010 t10
      LEFT JOIN ACT_TBL_007 t07 ON t10.Field_010 = t07.Field_005
      WHERE t10.Field_006 = '15' OR t07.Field_006 LIKE N'%مددی%'
    `);
    console.log("Invoice 15 / Madadi results:", JSON.stringify(inv15, null, 2));
  } catch (e) {
    console.error(e);
  }
}
main();
