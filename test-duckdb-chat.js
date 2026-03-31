const fs = require('fs');
async function testChat() {
    const res = await fetch('http://localhost:3000/api/ai-chat', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Cookie': 'role=ADMIN' 
        },
        body: JSON.stringify({
            datasetId: 'agent-data',
            messages: [{ role: 'user', content: 'Compare LOB-wise GWP between 2024 and 2025 (ignore cache 1)' }]
        })
    });
    
    const data = await res.json();
    console.log("SQL QUERY:", data.sql_query);
    console.log("DATA:", JSON.stringify(data.df, null, 2));
}
testChat();
