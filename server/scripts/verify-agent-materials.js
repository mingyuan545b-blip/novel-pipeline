/**
 * verify-agent-materials.js — 验证所有Agent素材获取链路
 * 检查每个agent是否通过scheduleMaterials拿到该拿的素材
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), override: true });
process.env.USE_PG = 'true';
const store = require('../store');
const { assembleMaterialState } = require('../services/pipeline/materialStateAssembler');
const { resolveGenreFromProject } = require('../services/genreConfig');
const { AGENT_DECLARATIONS } = require('../services/pipeline/agentDeclarations');

const AGENTS = [
    'writer', 'reviser', 'polisher', 'intent-planner',
    'first-review', 'second-review', 'fast-review',
    'final-editor', 'reader', 'material-manager'
];

async function main() {
    // 找到第一个项目
    const projects = await store.queryItems('projects', {});
    if (projects.length === 0) {
        console.log('ERROR: No projects found');
        process.exit(1);
    }
    const project = projects[0];
    const projectId = project.id;
    console.log(`\n=== 验证项目: ${project.title || project.name} (${projectId}) ===\n`);

    // 获取素材
    const materials = await store.queryItems('materials', { projectId });
    const activeMats = materials.filter(m => !m.archived);
    console.log(`活跃素材总数: ${activeMats.length}`);
    const matTypes = {};
    activeMats.forEach(m => { matTypes[m.type] = (matTypes[m.type] || 0) + 1; });
    console.log('素材类型分布:', JSON.stringify(matTypes));

    // 获取题材
    const genre = resolveGenreFromProject(project);
    console.log(`题材: ${genre?.id || 'unknown'}\n`);

    // 模拟chapter
    const chapter = { chapterNumber: 1, outline: '温以宁和薄寒第一次相遇', scene: '主世界' };

    // 验证每个agent
    const results = [];
    for (const agentType of AGENTS) {
        const decl = AGENT_DECLARATIONS[agentType];
        if (!decl) {
            console.log(`❌ ${agentType}: 无声明（BUG）`);
            results.push({ agent: agentType, status: 'MISSING_DECLARATION' });
            continue;
        }

        const declaredTypes = decl.materialNeeds.map(n => n.type);
        try {
            const scheduled = await assembleMaterialState(agentType, {
                projectId, chapter, materials, ctx: {}, project, genre
            });

            const loadedTypes = Object.keys(scheduled.materials);
            const loadedCounts = {};
            for (const [type, items] of Object.entries(scheduled.materials)) {
                loadedCounts[type] = items.length;
            }

            const missingTypes = declaredTypes.filter(t => !loadedTypes.includes(t) || scheduled.materials[t].length === 0);
            const constraintsLen = scheduled.constraints?.text?.length || 0;

            const status = missingTypes.length === 0 ? 'OK' : 'PARTIAL';
            const icon = status === 'OK' ? '✅' : '⚠️';

            console.log(`${icon} ${agentType}:`);
            console.log(`   声明类型: [${declaredTypes.join(', ')}]`);
            console.log(`   实际获取: ${JSON.stringify(loadedCounts)}`);
            console.log(`   缺失类型: [${missingTypes.join(', ')}]`);
            console.log(`   约束文本: ${constraintsLen}字符`);
            console.log('');

            results.push({ agent: agentType, status, declaredTypes, loadedCounts, missingTypes, constraintsLen });
        } catch (e) {
            console.log(`❌ ${agentType}: 调度失败 - ${e.message}`);
            results.push({ agent: agentType, status: 'ERROR', error: e.message });
        }
    }

    // 汇总
    const ok = results.filter(r => r.status === 'OK').length;
    const partial = results.filter(r => r.status === 'PARTIAL').length;
    const error = results.filter(r => r.status === 'ERROR' || r.status === 'MISSING_DECLARATION').length;
    console.log(`\n=== 汇总 ===`);
    console.log(`✅ 完全通过: ${ok}/${AGENTS.length}`);
    console.log(`⚠️ 部分缺失: ${partial}`);
    console.log(`❌ 错误: ${error}`);

    // 检查题材access.js vs agentDeclarations一致性
    console.log(`\n=== 题材access.js vs agentDeclarations 一致性检查 ===`);
    const genreAccess = genre?.agentMaterialAccess || {};
    for (const agentType of AGENTS) {
        const accessNeeds = genreAccess[agentType]?.needs || [];
        const declNeeds = AGENT_DECLARATIONS[agentType]?.materialNeeds.map(n => n.type) || [];
        const inAccessNotDecl = accessNeeds.filter(n => !declNeeds.includes(n));
        const inDeclNotAccess = declNeeds.filter(n => !accessNeeds.includes(n));
        if (inAccessNotDecl.length > 0 || inDeclNotAccess.length > 0) {
            console.log(`${agentType}:`);
            if (inAccessNotDecl.length > 0) console.log(`  题材要求但声明缺失: [${inAccessNotDecl.join(', ')}]`);
            if (inDeclNotAccess.length > 0) console.log(`  声明有但题材未要求: [${inDeclNotAccess.join(', ')}]`);
        }
    }

    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
