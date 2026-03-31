const duckdb = require('duckdb');
const db = new duckdb.Database(':memory:');

db.all(`SELECT lob, SUM(gwp) as total_gwp FROM read_csv_auto('C:/Users/PrabhashankarRai/Downloads/Enterprise-Portal-2026-main/Enterprise-Portal-2026-main/public/Data Download/Agent Data.csv', ignore_errors=true, null_padding=true, parallel=false) WHERE EXTRACT(YEAR FROM ac_month_date) = 2024 GROUP BY lob`, (err, res) => {
    if (err) console.error(err);
    else console.log(res);
});
