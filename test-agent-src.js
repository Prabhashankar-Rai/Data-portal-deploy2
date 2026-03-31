const duckdb = require('duckdb');
const db = new duckdb.Database(':memory:');

db.all(`SELECT DISTINCT src, SUM(try_cast("gwp" as double)) as total_gwp, SUM(try_cast("nwp" as double)) as total_nwp FROM read_csv_auto('C:/Users/PrabhashankarRai/Downloads/Enterprise-Portal-2026-main/Enterprise-Portal-2026-main/public/Data Download/Agent Data.csv', ignore_errors=true, null_padding=true, parallel=false) WHERE agent_no = '00000000' GROUP BY src`, (err, res) => {
    if (err) console.error(err);
    else console.log(res);
});
