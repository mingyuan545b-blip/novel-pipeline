/**
 * 诊断脚本：查看素材content和entity数据，诊断4维度字段为空的根因
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env'), override: true });
const store = require('../server/store');

const PROJECT_ID = '1397512a-9f09-41fd-ac1e-7d68dd5b722f';

(async () => {
    try {
        await store.ensureBackend();

        console.log('=== 1. 查询素材表 ===');
        const materials = await store.queryItems('materials', { projectId: PROJECT_ID });
        console.log(`素材数: ${materials.length}`);
        for (const m of materials) {
            console.log(`\n--- 素材: ${m.name} (type=${m.type}) ---`);
            const content = m.content || m.initialContent || '';
            console.log(`content长度: ${content.length}`);
            // 检查是否包含4维度标签
            const hasCharisma = content.includes('人格魅力') || content.includes('魅力点');
            const hasPhilosophy = content.includes('哲学观') || content.includes('哲学理念');
            const hasQuote = content.includes('金句库') || content.includes('金句');
            const hasEntrance = content.includes('出场设计') || content.includes('出场方式');
            console.log(`包含【人格魅力】: ${hasCharisma}`);
            console.log(`包含【哲学观】: ${hasPhilosophy}`);
            console.log(`包含【金句库】: ${hasQuote}`);
            console.log(`包含【出场设计】: ${hasEntrance}`);
            // 打印content前500字符
            console.log(`content前500字符:\n${content.substring(0, 500)}`);
            // 如果包含标签，打印标签附近内容
            if (hasCharisma) {
                const idx = content.indexOf('人格魅力');
                console.log(`\n【人格魅力】附近: ...${content.substring(Math.max(0, idx - 20), idx + 100)}...`);
            }
        }

        console.log('\n=== 2. 查询entities表 ===');
        const entities = await store.queryItems('entities', { projectId: PROJECT_ID, entityType: 'character' });
        console.log(`entity数: ${entities.length}`);
        for (const e of entities) {
            console.log(`\n--- entity: ${e.name} ---`);
            console.log(`charisma: ${e.charisma || '(空)'}`);
            console.log(`philosophy: ${e.philosophy || '(空)'}`);
            console.log(`quoteLibrary: ${JSON.stringify(e.quoteLibrary) || '(空)'}`);
            console.log(`entranceDesign: ${e.entranceDesign || '(空)'}`);
            console.log(`sourceContent前200字符: ${(e.sourceContent || '').substring(0, 200)}`);
        }

        console.log('\n=== 3. 查询entity-registry表 ===');
        const registries = await store.queryItems('entity-registry', { projectId: PROJECT_ID, entityType: 'character' });
        console.log(`registry数: ${registries.length}`);
        for (const r of registries) {
            console.log(`  - ${r.name}: charisma=${r.charisma || '(空)'}`);
        }

    } catch (err) {
        console.error('诊断失败:', err.message);
        console.error(err.stack);
    } finally {
        process.exit(0);
    }
})();
