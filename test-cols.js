const duckdb = require('duckdb');
const db = new duckdb.Database(':memory:');

db.all(`DESCRIBE SELECT * FROM read_csv_auto('C:/Users/PrabhashankarRai/Downloads/Enterprise-Portal-2026-main/Enterprise-Portal-2026-main/public/Data Download/Agent Data.csv', ignore_errors=true, null_padding=true, parallel=false)`, (err, res) => {
    if (err) console.error(err);
    else console.log("COLUMNS:", res.map(r => r.column_name));
});
