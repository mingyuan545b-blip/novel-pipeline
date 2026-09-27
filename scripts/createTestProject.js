/**
 * 创建新项目：只复用世界观框架（主世界高武·反套路喜剧），其余全部重新设计
 * 世界观框架：高武世界+小世界穿越+反套路系统+五家九境+喜剧风格
 * 重新设计：角色名、剧情、装备、功法、小世界内容
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env'), override: true });
const http = require('http');
const REQUEST_SECRET = process.env.REQUEST_SECRET || '';

function fetchApi(method, path, body) {
    return new Promise((resolve, reject) => {
        const data = body ? JSON.stringify(body) : null;
        const options = {
            hostname: 'localhost',
            port: 3001,
            path: path,
            method: method,
            headers: {
                'Authorization': `Bearer ${REQUEST_SECRET}`,
                'Content-Type': 'application/json'
            }
        };
        if (data) options.headers['Content-Length'] = Buffer.byteLength(data);

        const req = http.request(options, (res) => {
            let respData = '';
            res.on('data', chunk => respData += chunk);
            res.on('end', () => {
                try { resolve({ status: res.statusCode, data: JSON.parse(respData) }); }
                catch (e) { resolve({ status: res.statusCode, data: respData }); }
            });
        });
        req.on('error', reject);
        if (data) req.write(data);
        req.end();
    });
}

(async () => {
    try {
        console.log('=== 创建新项目 ===');
        const projectBody = {
            name: '高武测试_人物魅力系统验证_' + Date.now(),
            description: '只复用主世界高武世界观框架，验证人物魅力4维度+装备+功法+世界域+编年史模块',
            genre: '高武',
            subGenre: 'high-martial-comedy',
            targetChapters: 3,
            settings: {
                chapterRounds: 3,
                chronicleLevel: 'full',
                worldScopeLevel: 'full'
            }
        };

        console.log('请求参数:', JSON.stringify(projectBody, null, 2));

        const resp = await fetchApi('POST', '/api/projects', projectBody);
        console.log(`\nHTTP状态: ${resp.status}`);
        console.log('响应:', JSON.stringify(resp.data, null, 2).substring(0, 1000));

        if (resp.status === 201 || resp.data.id) {
            console.log('\n✅ 项目创建成功');
            console.log(`项目ID: ${resp.data.id}`);
            console.log(`项目名: ${resp.data.name}`);
        } else {
            console.log('\n❌ 项目创建失败');
        }
    } catch (err) {
        console.error('创建失败:', err.message);
        console.error(err.stack);
    } finally {
        process.exit(0);
    }
})();
