const fetch = require('node-fetch');
const fs = require('fs');
const { performance } = require('perf_hooks');

async function testQuery(question, datasetId) {
    console.log(`\nTesting: "${question}"`);
    try {
        const start = performance.now();
        const response = await fetch('http://localhost:3000/api/generate-query', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Cookie': 'user_id=test_user; role=ADMIN'
            },
            body: JSON.stringify({
                messages: [{ role: 'user', content: question }],
                datasetId: datasetId
            })
        });
        
        const data = await response.json();
        const end = performance.now();
        
        return { 
            question, 
            status: response.status, 
            cached: data.cached || false,
            latency_ms: Math.round(end - start),
            prompt_tokens: data.usage?.prompt_tokens,
            query: data.sql_query
        };
    } catch (e) {
        return { question, error: e.toString() };
    }
}

async function runTests() {
    const results = [];
    
    // Call 1: Original Call (should hit OpenAI, high latency, very low tokens due to JIT schema pruning)
    results.push(await testQuery("what is the total GWP for year 2025?", "uw-data"));
    
    // Call 2: Identical Call (should hit in-memory cache instantly without calling OpenAI)
    results.push(await testQuery("what is the total GWP for year 2025?", "uw-data"));
    
    fs.writeFileSync('test_perf_output.json', JSON.stringify(results, null, 2));
    console.log("\nDone");
}

runTests();
