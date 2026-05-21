const http = require('http');
const CH1_ID = '486f40a6-807e-491a-b95c-b82ae2f7b55f';

function apiCall(method, path, body) {
    return new Promise((resolve, reject) => {
        const data = body ? JSON.stringify(body) : '';
        const options = { hostname: 'localhost', port: 3001, path, method, headers: { 'Content-Type': 'application/json' } };
        if (data) options.headers['Content-Length'] = Buffer.byteLength(data);
        const req = http.request(options, (res) => {
            let d = ''; res.on('data', c => d += c);
            res.on('end', () => { try { resolve({ status: res.statusCode, data: JSON.parse(d) }); } catch (_) { resolve({ status: res.statusCode, data: d }); } });
        });
        req.on('error', reject);
        if (data) req.write(data);
        req.end();
    });
}

async function main() {
    const ch = (await apiCall('GET', `/api/chapters/${CH1_ID}`)).data;
    console.log('Status:', ch.status);
    console.log('WordCount:', ch.content ? ch.content.replace(/\s/g, '').length : 0);
    console.log('ReviewRounds:', ch._reviewRounds);
    console.log('SkipReason:', ch._skipReason || 'none');
    console.log('Round:', ch.round);
    console.log('HasContent:', !!ch.content);
    console.log('HasFirstReview:', !!ch.firstReviewOutput);
    console.log('HasMaterialManager:', !!ch.materialManagerOutput);
    if (ch.content) {
        console.log('\nContent preview (first 800 chars):');
        console.log(ch.content.substring(0, 800));
    }
}

main().catch(e => console.error('Error:', e.message));
