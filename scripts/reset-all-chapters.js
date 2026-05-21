const http = require('http');
const projectId = 'd4808c1a-3378-4372-b672-9d0a6bd075f8';
const SECRET = 'novel-pipeline-2024-secure';

function apiCall(method, path, body) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost', port: 3001, path, method,
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SECRET}` }
        };
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); } catch (e) { resolve(data); }
            });
        });
        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function main() {
    const chapters = await apiCall('GET', `/api/chapters?projectId=${projectId}`);
    console.log(`Found ${chapters.length} chapters`);
    let reset = 0;
    for (const ch of chapters) {
        if (ch.status !== 'outlined') {
            await apiCall('POST', `/api/chapters/${ch.id}/reset`);
            reset++;
        }
    }
    console.log(`Reset ${reset} chapters`);
    
    const project = await apiCall('GET', `/api/projects/${projectId}`);
    if (project._circuitBreaker) {
        project._circuitBreaker = { consecutiveFailures: 0, lastFailureStep: '', tripped: false, tripChapter: 0, history: [] };
        await apiCall('PUT', `/api/projects/${projectId}`, { _circuitBreaker: project._circuitBreaker });
        console.log('Circuit breaker reset');
    }
}

main();
