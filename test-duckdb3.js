const duckdb = require('duckdb');
const db = new duckdb.Database(':memory:');

db.all(`SELECT agent_no, SUM(try_cast("gwp" as double)) as total_gwp 
FROM read_csv_auto('C:/Users/PrabhashankarRai/Downloads/Enterprise-Portal-2026-main/Enterprise-Portal-2026-main/public/Data Download/Agent Data.csv', ignore_errors=true, null_padding=true, parallel=false) 
WHERE lower(lob) LIKE '%fire%' AND EXTRACT(YEAR FROM "ac_month_date") = 2025 
GROUP BY agent_no 
ORDER BY total_gwp DESC LIMIT 5`, (err, res) => {
    if (err) {
        console.error("DuckDB Error:", err);
    } else {
        console.log("Success! Rows:", res);
    }
});
