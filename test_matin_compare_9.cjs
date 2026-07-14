const axios = require('axios');
async function run() {
  const url = 'http://80.210.31.176:5000/api/external/v1/query';
  const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' };
  
  try {
    // 1. Direct query in ACT_TBL_009
    const q1 = `SELECT 
      Field_001 as RowId,
      Field_003 as DocType,
      Field_004 as DocNum,
      CAST(Field_009 as FLOAT) as Debit,
      CAST(Field_010 as FLOAT) as Credit
      FROM ACT_TBL_009
      WHERE (Field_015 LIKE '%:112127-%' OR Field_015 LIKE '%-112127-%' OR Field_015 LIKE '%:112127' OR Field_015 LIKE '112127:%')
    `;
    const res1 = await axios.post(url, { query: q1 }, { headers });
    const directRows = res1.data.data;
    
    // 2. Query with join in AccountingReports
    const q2 = `SELECT 
      t9.Field_001 as RowId,
      t9.Field_003 as DocType,
      t9.Field_004 as DocNum,
      CAST(t9.Field_009 as FLOAT) as Debit,
      CAST(t9.Field_010 as FLOAT) as Credit,
      t8.Field_008 as GregDate
      FROM ACT_TBL_009 t9
      LEFT JOIN ACT_TBL_008 t8 ON t8.Field_004 = t9.Field_003 AND t8.Field_005 = t9.Field_004
      WHERE (t9.Field_015 LIKE '%:112127-%' OR t9.Field_015 LIKE '%-112127-%' OR t9.Field_015 LIKE '%:112127' OR t9.Field_015 LIKE '112127:%')
    `;
    const res2 = await axios.post(url, { query: q2 }, { headers });
    const joinedRows = res2.data.data;
    
    console.log("Direct rows count:", directRows.length);
    console.log("Joined rows count:", joinedRows.length);
    
    const directMap = {};
    directRows.forEach(r => { directMap[r.RowId] = r; });
    
    const joinedCounts = {};
    joinedRows.forEach(r => {
      joinedCounts[r.RowId] = (joinedCounts[r.RowId] || 0) + 1;
    });
    
    let duplicates = 0;
    Object.keys(joinedCounts).forEach(rowId => {
      if (joinedCounts[rowId] > 1) {
        duplicates++;
        console.log(`RowId ${rowId} matches ${joinedCounts[rowId]} times! Direct:`, directMap[rowId]);
      }
    });
    console.log("Total duplicated row IDs:", duplicates);
    
  } catch(e) {
    console.error("Error:", e.message);
  }
}
run();
