const http = require('http');

function apiCall(method, path, body) {
    return new Promise((resolve, reject) => {
        const data = body ? JSON.stringify(body) : '';
        const options = {
            hostname: 'localhost',
            port: 3001,
            path,
            method,
            headers: { 'Content-Type': 'application/json' }
        };
        if (data) options.headers['Content-Length'] = Buffer.byteLength(data);
        const req = http.request(options, (res) => {
            let responseBody = '';
            res.on('data', chunk => responseBody += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, data: JSON.parse(responseBody) });
                } catch (_) {
                    resolve({ status: res.statusCode, data: responseBody });
                }
            });
        });
        req.on('error', reject);
        if (data) req.write(data);
        req.end();
    });
}

async function main() {
    const result = await apiCall('POST', '/api/projects', {
        name: '位面掠夺·万界归墟',
        genre: 'high-martial-crossplane',
        mode: 'tomato-short',
        description: '100万字目标·番茄平台适配·12卷360章·每卷一个次位面副本·反套路搞笑风格',
        styleProfile: {
            key: 'high-martial-crossplane',
            label: '主位面高武·反套路喜剧',
            povRule: '第三人称限制视角，男主视角为主',
            dialogueRule: '对话需体现角色性格，男主说话抽象但应景，禁止AI腔',
            behaviorRule: '行为需符合人设，男主谨小慎微但关键时刻果断',
            toneRule: '搞笑反套路，系统反套路化呈现，金句应景不烂梗',
            titleRule: '章节标题需有悬念感或反差感，禁止流水账式标题',
            reviewFocus: '战力一致性、次位面隔离性、角色性格一致性、反AI痕迹',
            materialFocus: '战力体系、次位面素材、角色关系'
        },
        wordConfig: {
            targetWords: 1000000,
            rejectMin: 1850,
            maxChapter: 3500,
            maxWords: 4000
        }
    });
    console.log('PROJECT_ID=' + result.data.id);
    console.log('Name=' + result.data.name);
    console.log('Mode=' + result.data.mode);
    console.log('Status=' + result.status);
}

main().catch(e => console.error('Error:', e.message));
