import * as xlsx from 'xlsx';
import path from 'path';

const filePath = path.join(process.cwd(), 'public', 'data-download', 'PIB Knowledge Bank.xlsx');
const workbook = xlsx.readFile(filePath);
console.log("Sheets available:", workbook.SheetNames);

const pibSheet = workbook.Sheets['PIB Data'];
if (pibSheet) {
    const dashboards = xlsx.utils.sheet_to_json<any>(pibSheet, { raw: false });
    console.log(`Found ${dashboards.length} rows in PIB Data`);
    dashboards.forEach((row, i) => {
        console.log(`Row ${i+1}: Name = ${row['Dashboard Name']} | URL = ${row['Dashboard URL']}`);
    });
} else {
    console.log("No sheet named 'PIB Data'");
}
