const duckdb = require('duckdb');
const db = new duckdb.Database(':memory:');
const csvPath = 'C:/Users/PrabhashankarRai/Downloads/Enterprise-Portal-2026-main/Enterprise-Portal-2026-main/public/Data Download/Agent Data.csv';

db.all(`SELECT lob, SUM(gwp) as gwp_2024 FROM read_csv_auto('${csvPath}') WHERE EXTRACT(YEAR FROM ac_month_date) = 2024 AND ytd_flag = '1' GROUP BY lob ORDER BY lob LIMIT 5`, (err, res) => {
    console.log("YTD FLAG = 1:", res);
});
db.all(`SELECT lob, SUM(gwp) as gwp_2024 FROM read_csv_auto('${csvPath}') WHERE EXTRACT(YEAR FROM ac_month_date) = 2024 AND typeof(lob) = 'VARCHAR' GROUP BY lob ORDER BY lob LIMIT 5`, (err, res) => {
    console.log("BASE:", res);
});
