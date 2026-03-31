const fs = require('fs');
const csv = fs.readFileSync('./public/data-download/sales-data.csv', 'utf8');
const lines = csv.split(/\r?\n/).filter(Boolean);

const clean = (value) => value.trim().replace(/^"(.*)"$/, '$1');

const columns = lines[0].split(',').map(h => clean(h));
console.log('Columns:', columns);

const rows = lines.slice(1, 3).map(line => {
    const values = line.split(',');
    const row = {};
    columns.forEach((col, i) => {
        if (col.length > 0) {
            if (values[i] !== undefined) {
                row[col] = clean(values[i]);
            } else {
                row[col] = '';
            }
        }
    });
    return row;
});

console.log('Row 0:', rows[0]);

const rowFilters = [{
    column_name: 'REPORTING_LINE',
    element_value: 'Alternative Channel',
    operator: '='
}];

const filteredRows = rows.filter(row => {
    return rowFilters.every(f => {
        const colName = f.column_name;
        const userVal = f.element_value;

        const actualColKey = Object.keys(row).find(k => k.trim().toLowerCase() === colName.trim().toLowerCase());
        const rowVal = actualColKey ? row[actualColKey] : undefined;

        console.log('Testing filter -> colName:', colName, 'userVal:', userVal, 'actualColKey:', actualColKey, 'rowVal:', rowVal);

        if (rowVal === undefined) return true;

        if (f.operator === '=') {
            return String(rowVal).toLowerCase() === String(userVal).toLowerCase();
        } else if (f.operator === '!=' || f.operator === '<>') {
            return String(rowVal).toLowerCase() !== String(userVal).toLowerCase();
        }
        return true;
    });
});

console.log('Filtered rows length:', filteredRows.length);
