const fs = require('fs');
const csv = fs.readFileSync('./public/data-download/sales-data.csv', 'utf8');
const lines = csv.split(/\r?\n/).filter(Boolean);

const clean = (value) => value.trim().replace(/^"(.*)"$/, '$1');

const columns = lines[0].split(',').map(h => clean(h));

const rows = lines.slice(1).map(line => {
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

        if (rowVal === undefined) return true;

        if (f.operator === '=') {
            return String(rowVal).toLowerCase() === String(userVal).toLowerCase();
        } else if (f.operator === '!=' || f.operator === '<>') {
            return String(rowVal).toLowerCase() !== String(userVal).toLowerCase();
        }
        return true;
    });
});

const withBranch = filteredRows.filter(r => r.reporting_line?.toLowerCase().includes('branch'));
console.log('Total filtered:', filteredRows.length);
console.log('Any with branch?', withBranch.length);

if (withBranch.length > 0) {
    console.log('Sample leak:', withBranch[0]);
}

const uniqueLines = new Set(filteredRows.map(r => r.reporting_line));
console.log('Unique lines:', Array.from(uniqueLines));
