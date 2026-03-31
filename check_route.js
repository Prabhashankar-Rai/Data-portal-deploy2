const fs = require('fs');
const readline = require('readline');

function clean(value) {
  return value.trim().replace(/^"(.*)"$/, '$1');
}

function parseCSVLine(line) {
  if (line.indexOf('"') === -1) {
    return line.split(',').map(clean);
  }

  const cells = [];
  let inQuotes = false;
  let cell = '';
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      cells.push(clean(cell));
      cell = '';
    } else {
      cell += c;
    }
  }
  cells.push(clean(cell));
  return cells;
}

const fileStream = fs.createReadStream('public/data-download/Agent.csv', 'utf8');
const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

let count = 0;
let cols = [];
let f_idx = -1;
let lobSet = new Set();

rl.on('line', (line) => {
  if (!line.trim()) return;
  const values = parseCSVLine(line);
  if (count === 0) {
    cols = values;
    f_idx = cols.findIndex(c => c.toLowerCase() === 'lob');
  } else {
    // try to match the exact row matching logic
    const rowVal = values[f_idx];
    if (rowVal) {
        lobSet.add(rowVal);
    }
  }
  count++;
});
rl.on('close', () => { 
    console.log('unique lobs in agent:', Array.from(lobSet).slice(0, 10));
    console.log('LOB array length:', Array.from(lobSet).length);
});
