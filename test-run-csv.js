const fetch = require('node-fetch');

(async () => {
    try {
        const payload = {
            sql_query: 'SELECT agent_no, SUM(try_cast("gwp" as double)) as total_gwp FROM dataset_view WHERE lower(lob) LIKE \'%fire%\' AND EXTRACT(YEAR FROM "ac_month_date") = 2025 GROUP BY agent_no ORDER BY total_gwp DESC LIMIT 5',
            question: 'give me top 5 agents for fire business in 2025',
            datasetId: 'agent-data'
        };
        const res = await fetch('http://localhost:3000/api/run-csv-query', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': 'user_id=admin@example.com; role=ADMIN'
            },
            body: JSON.stringify(payload)
        });
        const text = await res.text();
        console.log("RESPONSE:", text);
    } catch (e) {
        console.error(e);
    }
})();
