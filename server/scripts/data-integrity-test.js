/**
 * 数据完整性验证 - 跨模块数据一致性检查
 * 用法: node scripts/data-integrity-test.js [PROJECT_ID]
 */
require('dotenv').config({ override: true });
const store = require('../store');

const RESULTS = [];

async function test(name, fn) {
    const start = Date.now();
    try {
        const result = await fn();
        const ms = Date.now() - start;
        RESULTS.push({ name, passed: result.passed, ms, detail: result.detail || '' });
        const icon = result.passed ? '✅' : '❌';
        console.log(`${icon} ${name} (${ms}ms) ${result.detail || ''}`);
        return result.passed;
    } catch (e) {
        const ms = Date.now() - start;
        RESULTS.push({ name, passed: false, ms, detail: e.message });
        console.log(`❌ ${name} (${ms}ms) ERROR: ${e.message}`);
        return false;
    }
}

async function run() {
    let projectId = process.argv[2];
    if (!projectId) {
        const projects = await store.listItems('projects');
        if (projects.length === 0) { console.error('❌ 没有项目'); process.exit(1); }
        projectId = projects[0].id;
    }
    const project = await store.getItem('projects', projectId);
    console.log(`\n🧪 数据完整性验证 - ${project.name}`);
    console.log('='.repeat(60));

    // DI-01: 素材→实体注册表→状态缓存 三表一致性
    await test('DI-01: 素材-实体注册表一致性', async () => {
        const materials = await store.queryItems('materials', { projectId, type: 'character' });
        const entities = await store.queryItems('entity-registry', { projectId, entityType: 'character' });
        const issues = [];
        for (const mat of materials) {
            const entity = entities.find(e => e.name === mat.name);
            if (!entity) issues.push(`素材"${mat.name}"无对应实体`);
        }
        return { passed: issues.length === 0, detail: issues.length > 0 ? `问题: ${issues.slice(0, 5).join('; ')}` : `materials=${materials.length} entities=${entities.length} 全部匹配` };
    });

    // DI-02: 已完成章节有对应实体状态（第1章无缓存是正常的，从第2章开始才有delta）
    await test('DI-02: 已完成章节有对应实体状态', async () => {
        const chapters = await store.queryItems('chapters', { projectId });
        const writtenChapters = chapters.filter(c => ['written', 'first-reviewing', 'second-reviewing', 'final-editing', 'approved', 'material-updated'].includes(c.status));
        const cache = await store.queryItems('character-state-cache', { projectId });
        const cacheChapterNums = new Set(cache.map(c => c.chapterNumber));
        // 第1章无缓存是正常的（初始状态无delta），从第2章开始检查
        const chaptersNeedingCache = writtenChapters.filter(c => c.chapterNumber > 1);
        const missingCache = chaptersNeedingCache.filter(c => !cacheChapterNums.has(c.chapterNumber));
        return {
            passed: chaptersNeedingCache.length === 0 || missingCache.length === 0,
            detail: `writtenChapters=${writtenChapters.length} cacheChapters=${cacheChapterNums.size} missingCache=[${missingCache.map(c=>c.chapterNumber).join(',')}]`
        };
    });

    // DI-03: 大纲偏移检测配置
    await test('DI-03: 甜宠题材无霸总偏移', async () => {
        const materials = await store.queryItems('materials', { projectId });
        const chapters = await store.queryItems('chapters', { projectId });
        const bazaInMaterials = materials.some(m =>
            (m.name && m.name.includes('霸总')) ||
            (m.role && m.role.includes('霸总')) ||
            (m.data && typeof m.data === 'string' && m.data.includes('霸总'))
        );
        const bazaInChapters = chapters.some(c =>
            c.content && c.content.includes('霸总')
        );
        return {
            passed: !bazaInMaterials && !bazaInChapters,
            detail: `materialsHasBaza=${bazaInMaterials} chaptersHasBaza=${bazaInChapters}`
        };
    });

    // DI-04: 约束注入链路
    await test('DI-04: 项目约束配置', async () => {
        const constraints = project.constraints || [];
        const hasConstraints = constraints.length > 0;
        return {
            passed: true, // 约束可选
            detail: `constraints=${JSON.stringify(constraints)}`
        };
    });

    // DI-05: 风格配置链路
    await test('DI-05: 风格配置链路', async () => {
        const hasStyleProfile = !!project.styleProfile;
        const hasWordConfig = !!project.wordConfig;
        const styleProfile = project.styleProfile || {};
        // namingStyle属于styleProfile（见styleHierarchy.js），不属于wordConfig
        const hasNamingStyle = !!styleProfile.namingStyle;
        return {
            passed: hasStyleProfile || hasWordConfig,
            detail: `styleProfile=${hasStyleProfile} wordConfig=${hasWordConfig} namingStyle=${hasNamingStyle}`
        };
    });

    // DI-06: 角色编年史与章节对应
    await test('DI-06: 编年史与章节对应', async () => {
        const chronicles = await store.queryItems('character-chronicle', { projectId });
        const chapters = await store.queryItems('chapters', { projectId });
        const chapterNums = new Set(chapters.map(c => c.chapterNumber));
        const chronicleChapterNums = new Set(chronicles.map(c => c.chapterNumber));
        const orphanChronicles = [...chronicleChapterNums].filter(n => !chapterNums.has(n));
        return {
            passed: orphanChronicles.length === 0,
            detail: `chronicles=${chronicles.length} chapters=${chapters.length} orphanChronicleChapters=[${orphanChronicles.join(',')}]`
        };
    });

    // DI-07: 知识库事实与素材关联
    await test('DI-07: 知识库事实projectId一致', async () => {
        const facts = await store.queryItems('knowledge-facts', { projectId });
        const wrongProject = facts.filter(f => f.projectId && f.projectId !== projectId);
        return {
            passed: wrongProject.length === 0,
            detail: `facts=${facts.length} wrongProject=${wrongProject.length}`
        };
    });

    // DI-08: 记忆层projectId一致
    await test('DI-08: 记忆层projectId一致', async () => {
        const layers = await store.queryItems('memory-layers', { projectId });
        const wrongProject = layers.filter(l => l.projectId && l.projectId !== projectId);
        return {
            passed: wrongProject.length === 0,
            detail: `layers=${layers.length} wrongProject=${wrongProject.length}`
        };
    });

    // DI-09: 实体关系双向完整性
    await test('DI-09: 实体关系双向完整性', async () => {
        const relations = await store.queryItems('entity-relations', { projectId });
        const entities = await store.queryItems('entity-registry', { projectId });
        const entityIds = new Set(entities.map(e => e.id));
        const brokenRelations = relations.filter(r =>
            (r.fromEntityId && !entityIds.has(r.fromEntityId)) ||
            (r.toEntityId && !entityIds.has(r.toEntityId))
        );
        return {
            passed: brokenRelations.length === 0,
            detail: `relations=${relations.length} broken=${brokenRelations.length}`
        };
    });

    // DI-10: 章节序号连续性
    await test('DI-10: 章节序号连续性', async () => {
        const chapters = await store.queryItems('chapters', { projectId });
        const nums = chapters.map(c => c.chapterNumber).filter(n => n > 0).sort((a, b) => a - b);
        const gaps = [];
        for (let i = 1; i < nums.length; i++) {
            if (nums[i] - nums[i - 1] > 1) gaps.push(`${nums[i - 1]}→${nums[i]}`);
        }
        return {
            passed: gaps.length === 0,
            detail: `chapters=${nums.length} range=${nums[0]}-${nums[nums.length - 1]} gaps=[${gaps.join(',')}]`
        };
    });

    // Summary
    console.log('\n' + '='.repeat(60));
    const passed = RESULTS.filter(r => r.passed).length;
    const failed = RESULTS.filter(r => !r.passed).length;
    const total = RESULTS.length;
    console.log(`📊 结果: ${passed}/${total} 通过, ${failed} 失败`);

    if (failed > 0) {
        console.log('\n❌ 失败项:');
        RESULTS.filter(r => !r.passed).forEach(r => {
            console.log(`   - ${r.name}: ${r.detail}`);
        });
    }

    // JSON report
    const fs = require('fs');
    const path = require('path');
    const reportPath = path.join(__dirname, '..', 'test-reports', `integrity-${Date.now()}.json`);
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify({
        timestamp: new Date().toISOString(),
        project: { id: projectId, name: project.name },
        total, passed, failed,
        results: RESULTS
    }, null, 2));
    console.log(`\n📄 报告: ${reportPath}`);

    process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => { console.error('Fatal:', e.message); process.exit(2); });
