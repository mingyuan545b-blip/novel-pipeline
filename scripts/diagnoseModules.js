/**
 * 诊断脚本2：诊断装备、世界域、编年史问题
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const store = require('../server/store');
const http = require('http');
const REQUEST_SECRET = process.env.REQUEST_SECRET || '';
const PROJECT_ID = '1397512a-9f09-41fd-ac1e-7d68dd5b722f';

function fetchApi(path) {
    return new Promise((resolve, reject) => {
        http.get({
            hostname: 'localhost',
            port: 3001,
            path: path,
            headers: { 'Authorization': `Bearer ${REQUEST_SECRET}` }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
                catch (e) { resolve({ status: res.statusCode, data: data.substring(0, 500) }); }
            });
        }).on('error', reject);
    });
}

(async () => {
    try {
        await store.ensureBackend();

        // 1. 诊断装备问题
        console.log('=== 1. 装备诊断 ===');
        const materials = await store.queryItems('materials', { projectId: PROJECT_ID });
        const equipMaterials = materials.filter(m => m.type === 'equipment');
        console.log(`materials表装备数: ${equipMaterials.length}`);
        for (const m of equipMaterials) {
            console.log(`  - ${m.name} (type=${m.type})`);
        }

        const itemDefs = await store.queryItems('item-definitions', { projectId: PROJECT_ID });
        console.log(`item-definitions表数: ${itemDefs.length}`);
        for (const d of itemDefs.slice(0, 5)) {
            console.log(`  - ${d.name} (defType=${d.defType})`);
        }

        // 检查装备API
        const equipApi = await fetchApi(`/api/entity-center/item-definitions?projectId=${PROJECT_ID}`);
        console.log(`装备API状态: ${equipApi.status}, 数量: ${Array.isArray(equipApi.data) ? equipApi.data.length : 'N/A'}`);

        // 2. 诊断世界域问题
        console.log('\n=== 2. 世界域诊断 ===');
        const wsApi1 = await fetchApi(`/api/worldscope?projectId=${PROJECT_ID}`);
        console.log(`/api/worldscope状态: ${wsApi1.status}`);

        const wsApi2 = await fetchApi(`/api/world-scopes?projectId=${PROJECT_ID}`);
        console.log(`/api/world-scopes状态: ${wsApi2.status}`);

        // 查看world-scopes表
        const worldScopes = await store.queryItems('world-scopes', { projectId: PROJECT_ID });
        console.log(`world-scopes表数据: ${worldScopes.length}`);
        for (const ws of worldScopes.slice(0, 3)) {
            console.log(`  - ${ws.name || ws.id} (type=${ws.type || '未知'})`);
        }

        // 3. 诊断编年史问题
        console.log('\n=== 3. 编年史诊断 ===');
        const chronicles = await store.queryItems('character_chronicle', { projectId: PROJECT_ID });
        console.log(`character_chronicle表数据: ${chronicles.length}`);

        const chronApi = await fetchApi(`/api/entity-center/character-chronicle?projectId=${PROJECT_ID}`);
        console.log(`编年史API状态: ${chronApi.status}, 数据: ${Array.isArray(chronApi.data) ? chronApi.data.length : 'N/A'}`);

        // 查看章节状态
        console.log('\n=== 4. 章节状态 ===');
        const chapters = await store.queryItems('chapters', { projectId: PROJECT_ID });
        for (const c of chapters) {
            console.log(`  第${c.chapterNumber}章: status=${c.status}, wordCount=${c.wordCount}`);
        }

        // 查看project settings
        console.log('\n=== 5. 项目settings ===');
        const project = await store.getItem('projects', PROJECT_ID);
        console.log(`settings: ${JSON.stringify(project.settings)}`);
        console.log(`chronicleLevel: ${project.settings.chronicleLevel || '(未设置)'}`);
        console.log(`worldScopeLevel: ${project.settings.worldScopeLevel || '(未设置)'}`);

    } catch (err) {
        console.error('诊断失败:', err.message);
        console.error(err.stack);
    } finally {
        process.exit(0);
    }
})();
