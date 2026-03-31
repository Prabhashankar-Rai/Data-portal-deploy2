const duckdb = require('duckdb');
const db = new duckdb.Database(':memory:');

db.all(`SELECT * FROM read_csv_auto('C:/Users/PrabhashankarRai/Downloads/Enterprise-Portal-2026-main/Enterprise-Portal-2026-main/public/Data Download/Agent Data.csv', ignore_errors=true, null_padding=true, parallel=false) LIMIT 5`, (err, res) => {
    if (err) {
        console.error("DuckDB Error:", err);
    } else {
        console.log("Success! Rows:", res.length);
    }
});
