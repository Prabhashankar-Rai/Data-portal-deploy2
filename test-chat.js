const fetch = require('node-fetch');

(async () => {
    try {
        const payload = {
            messages: [{ role: 'user', content: 'give me top 5 agents for fire business in 2025' }],
            datasetId: 'agent-data'
        };
        const res = await fetch('http://localhost:3000/api/generate-query', {
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
