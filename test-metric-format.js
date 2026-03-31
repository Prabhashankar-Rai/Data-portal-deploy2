const fs = require('fs');
const dataset = JSON.parse(fs.readFileSync('data/datasets.json', 'utf8')).find(d => d.id === 'agent_data');
const activeMetrics = JSON.parse(fs.readFileSync('data/ai-metrics.json', 'utf8'));
const normalizations = JSON.parse(fs.readFileSync('data/ai-column-aliases.json', 'utf8'));

const metricRules = activeMetrics.map((m) => {
    let parsedFormula = m.formula;
    m.required.forEach((reqCol) => {
        const normList = normalizations[reqCol.toLowerCase()] || [];
        if (dataset?.columns) {
            const matchedCol = dataset.columns.find((c) => 
                c.name.toLowerCase() === reqCol.toLowerCase() || normList.includes(c.name.toLowerCase())
            );
            if (matchedCol) {
                const regex = new RegExp(reqCol, "gi");
                parsedFormula = parsedFormula.replace(regex, matchedCol.name);
            }
        }
    });
    return `- ${m.name} = ${parsedFormula}`;
}).join('\n');

fs.writeFileSync('test-metric-result.txt', metricRules);
