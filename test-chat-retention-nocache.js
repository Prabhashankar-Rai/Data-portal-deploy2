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
            messages: [{ role: 'user', content: 'show top 10 agents by retention ratio in 2025 (ignore cache 4)' }]
        })
    });
    
    const data = await res.json();
    console.log("SQL QUERY:", data.sql_query);
    console.log("DATA:");
    console.table(data.df);
}
testChat();
