const duckdb = require('duckdb');
const fs = require('fs');
const db = new duckdb.Database(':memory:');

let output = {};

db.all(`
  SELECT 
    agent_no, 
    SUM(nwp) as total_nwp, 
    SUM(gwp) as total_gwp, 
    (SUM(nwp) / SUM(gwp)) * 100 as calculated_retention,
    SUM(nwp/NULLIF(gwp,0)) * 100 as bad_retention
  FROM read_csv_auto('public/Data Download/Agent Data.csv', normalize_names=true) 
  WHERE src <> 'JRNAL' AND EXTRACT(YEAR FROM CAST(ac_month_date AS DATE)) = 2025
  AND agent_no IN ('00000000', '02026233', '00487181')
  GROUP BY agent_no
`, function(err, res) {
  if (err) throw err;
  output.specific = res;

  db.all(`
    SELECT 
      agent_no, 
      SUM(nwp) as total_nwp, 
      SUM(gwp) as total_gwp, 
      (SUM(nwp) / SUM(gwp)) * 100 as retention_ratio
    FROM read_csv_auto('public/Data Download/Agent Data.csv', normalize_names=true) 
    WHERE src <> 'JRNAL' AND EXTRACT(YEAR FROM CAST(ac_month_date AS DATE)) = 2025
    GROUP BY agent_no
    ORDER BY retention_ratio DESC
    LIMIT 10
  `, function(err, res2) {
    if (err) throw err;
    output.top10 = res2;
    fs.writeFileSync('output.json', JSON.stringify(output, null, 2));
    console.log("Done writing output.json");
  });
});
