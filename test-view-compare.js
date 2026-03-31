const duckdb = require('duckdb');
const db = new duckdb.Database(':memory:');
const csvPath = 'C:/Users/PrabhashankarRai/Downloads/Enterprise-Portal-2026-main/Enterprise-Portal-2026-main/public/Data Download/Agent Data.csv';

const filters = []; // Admin has NO filters per the code logic
let viewQuery = `SELECT * FROM read_csv_auto('${csvPath}', normalize_names=true)`;

db.all(`CREATE OR REPLACE VIEW insurance_data_filtered AS ${viewQuery}`, (err) => {
    if (err) console.error(err);
    else {
        db.all(`SELECT lob, SUM(gwp) FILTER (WHERE EXTRACT(YEAR FROM ac_month_date) = 2024 AND src <> 'JRNL') AS gwp_2024 FROM insurance_data_filtered GROUP BY lob ORDER BY lob LIMIT 5`, (err, res) => {
            console.log("AI QUERY:", res);
        });
        
        db.all(`SELECT lob, SUM(gwp) as gwp_2024 FROM read_csv_auto('${csvPath}', normalize_names=false) WHERE EXTRACT(YEAR FROM ac_month_date) = 2024 AND src <> 'JRNL' GROUP BY lob ORDER BY lob LIMIT 5`, (err, res) => {
            console.log("RAW FILE:", res);
        });
    }
});
