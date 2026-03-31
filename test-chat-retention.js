const fs = require('fs');
const path = require('path');

async function testChat() {
    const res = await fetch('http://localhost:3000/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            datasetId: 'agent_data',
            messages: [{ role: 'user', content: 'show top 10 agents by retention ratio in 2025' }]
        })
    });
    
    const data = await res.json();
    console.log("SQL QUERY:", data.sql_query);
    console.log("DATA:");
    console.table(data.df);
}
testChat();
