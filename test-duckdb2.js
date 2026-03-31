const duckdb = require('duckdb');
const db = new duckdb.Database(':memory:');

db.all(`DESCRIBE SELECT * FROM read_csv_auto('C:/Users/PrabhashankarRai/Downloads/Enterprise-Portal-2026-main/Enterprise-Portal-2026-main/public/Data Download/Agent Data.csv', ignore_errors=true, null_padding=true, parallel=false)`, (err, res) => {
    if (err) {
        console.error("DuckDB Error:", err);
    } else {
        const col = res.find(r => r.column_name === 'ac_month_date');
        console.log("ac_month_date type:", col ? col.column_type : 'Not Found');
        
        db.all(`SELECT ac_month_date FROM read_csv_auto('C:/Users/PrabhashankarRai/Downloads/Enterprise-Portal-2026-main/Enterprise-Portal-2026-main/public/Data Download/Agent Data.csv', ignore_errors=true, null_padding=true, parallel=false) LIMIT 5`, (err2, res2) => {
            console.log("Sample values:", res2);
        });
    }
});
