const duckdb = require('duckdb');
const db = new duckdb.Database(':memory:');

db.all(`SELECT lob, SUM(gwp) as gwp, SUM(gwp_total) as gwp_total FROM read_csv_auto('C:/Users/PrabhashankarRai/Downloads/Enterprise-Portal-2026-main/Enterprise-Portal-2026-main/public/Data Download/Agent Data.csv', ignore_errors=true, null_padding=true, parallel=false) WHERE EXTRACT(YEAR FROM ac_month_date) IN (2024, 2025) AND lob IN ('Motor', 'Fire') GROUP BY lob`, (err, res) => {
    if (err) console.error(err);
    else console.log(res);
});
