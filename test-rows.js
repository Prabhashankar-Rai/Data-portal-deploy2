const duckdb = require('duckdb');
const db = new duckdb.Database(':memory:');

db.all(`SELECT COUNT(*) as cnt FROM read_csv_auto('C:/Users/PrabhashankarRai/Downloads/Enterprise-Portal-2026-main/Enterprise-Portal-2026-main/public/Data Download/Agent Data.csv', normalize_names=true)`, (err, res) => {
    if (err) console.error(err);
    else console.log("NORMALIZED:", res);
});

db.all(`SELECT COUNT(*) as cnt FROM read_csv_auto('C:/Users/PrabhashankarRai/Downloads/Enterprise-Portal-2026-main/Enterprise-Portal-2026-main/public/Data Download/Agent Data.csv')`, (err, res) => {
    if (err) console.error(err);
    else console.log("RAW:", res);
});
