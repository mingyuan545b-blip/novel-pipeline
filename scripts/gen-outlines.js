const http = require('http');

function apiRequest(method, path, body, token) {
    return new Promise((resolve, reject) => {
        const data = body ? JSON.stringify(body) : null;
        const options = {
            hostname: 'localhost', port: 3001, path, method,
            headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': 'Bearer ' + token } : {}) }
        };
        const req = http.request(options, r => {
            let d = '';
            r.on('data', c => d += c);
            r.on('end', () => { try { resolve(JSON.parse(d)) } catch (e) { resolve(d) } });
        });
        req.on('error', reject);
        if (data) req.write(data);
        req.end();
    });
}

(async () => {
    const authRes = await apiRequest('POST', '/api/auth/token', { secret: 'dev' });
    const token = authRes.token;
    const pid = 'f3f70acb-1a6a-4271-ba27-0afdb27b6493';

    // Generate outlines
    console.log('=== Generating outlines ===');
    const res = await apiRequest('POST', '/api/pipeline/generate-outlines', { projectId: pid, targetChapters: 25 }, token);
    console.log('Count:', res.count);
    console.log('Created:', res.created?.length || 0);
    console.log('Rhythm issues:', res.rhythmIssues || 'none');
    console.log('Error:', res.error || 'none');

    process.exit(0);
})();
