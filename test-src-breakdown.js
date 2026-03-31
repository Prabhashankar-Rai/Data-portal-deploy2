const duckdb = require('duckdb');
const db = new duckdb.Database(':memory:');
const csvPath = 'C:/Users/PrabhashankarRai/Downloads/Enterprise-Portal-2026-main/Enterprise-Portal-2026-main/public/Data Download/Agent Data.csv';

db.all(`SELECT lob, src, SUM(gwp) as gwp_2024 FROM read_csv_auto('${csvPath}') WHERE EXTRACT(YEAR FROM ac_month_date) = 2024 AND lob IN ('Motor', 'Fire') GROUP BY lob, src ORDER BY lob, src`, (err, res) => {
    console.log("SRC BREAKDOWN:", res);
});

db.all(`SELECT lob, SUM(gwp) as gwp_2024 FROM read_csv_auto('${csvPath}') WHERE EXTRACT(YEAR FROM ac_month_date) = 2024 AND lob IN ('Motor', 'Fire') GROUP BY lob`, (err, res) => {
    console.log("TOTAL NO FILTER:", res);
});

db.all(`SELECT lob, SUM(gwp) as gwp_2024 FROM read_csv_auto('${csvPath}') WHERE EXTRACT(YEAR FROM ac_month_date) = 2024 AND lob IN ('Motor', 'Fire') AND src <> 'JRNAL' GROUP BY lob`, (err, res) => {
    console.log("TOTAL EXCLUDING JRNAL:", res);
});
