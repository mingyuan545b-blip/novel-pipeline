/**
 * simulateProjectCreation.js — 总工程师模拟新建项目流程测试
 * 直接调用业务函数（不启动HTTP服务），模拟真实用户新建项目
 *
 * 六大测试方向：
 * F1: 参数校验+必填字段
 * F2: 默认配置生成+genre适配+字段完整性
 * F3: 数据存储一致性+读取回写
 * F4: DataContext委托方法对新建项目可用性
 * F5: 项目删除联动+28种关联数据清理
 * F6: 边界场景（空参数/超长名称/未知genre/重复创建）
 *
 * 用法：node scripts/simulateProjectCreation.js
 * 退出码：0=全部通过，1=有bug
 */
'use strict';

const path = require('path');
const fs = require('fs');

// 设置NODE_PATH以便require server模块
process.env.NODE_PATH = path.join(__dirname, '..', 'server');
require('module').Module._initPaths();

const { createProjectData } = require('./../server/routes/projects/projectCreateHandler');
const { verifyProject } = require('./../server/routes/projects/projectCreateVerify');
const { cascadeDeleteProject, CASCADE_STORE_TYPES } = require('./../server/routes/projects/projectDeleteHandler');
const store = require('./../server/store');
const { resolveGenreFromProject } = require('./../server/services/genreConfig');
const { DataContext } = require('./../server/services/dataContext');

let bugCount = 0;
let warnCount = 0;
const createdProjectIds = []; // 测试后清理

function bug(msg) { console.error(`  ❌ [BUG] ${msg}`); bugCount++; }
function warn(msg) { console.warn(`  ⚠️  [WARN] ${msg}`); warnCount++; }
function ok(msg) { console.log(`  ✅ ${msg}`); }
function info(msg) { console.log(`  ℹ️  ${msg}`); }

/** 模拟express的req对象 */
function mockReq(body = {}) {
    return { body };
}

/** 清理测试创建的项目 */
async function cleanup() {
    for (const id of createdProjectIds) {
        try {
            await cascadeDeleteProject(id);
        } catch (_) { /* 忽略清理错误 */ }
    }
}

// ============ F1: 参数校验+必填字段 ============

async function testF1ParameterValidation() {
    console.log('\n=== F1: 参数校验+必填字段测试 ===');

    // F1.1: 完整参数创建
    console.log('\n[F1.1] 完整参数创建项目');
    const req1 = mockReq({
        name: '模拟测试项目-完整参数',
        genre: 'high-martial-crossplane',
        description: '总工程师模拟测试项目',
        targetChapters: 50
    });
    const project1 = createProjectData(req1);
    if (!project1.id) { bug('项目id为空'); return; }
    if (project1.name !== '模拟测试项目-完整参数') { bug(`name不匹配: ${project1.name}`); }
    if (project1.genre !== 'high-martial-crossplane') { bug(`genre不匹配: ${project1.genre}`); }
    if (project1.mode !== 'novel') { bug(`mode应为novel，实际: ${project1.mode}`); }
    if (project1.status !== 'draft') { bug(`status应为draft，实际: ${project1.status}`); }
    if (project1.currentChapter !== 0) { bug(`currentChapter应为0，实际: ${project1.currentChapter}`); }
    ok('完整参数创建字段正确');

    // F1.2: 缺少name时使用默认值
    console.log('\n[F1.2] 缺少name时使用默认值');
    const req2 = mockReq({ genre: 'urban-fantasy' });
    const project2 = createProjectData(req2);
    if (project2.name !== 'Untitled Project') { bug(`默认name应为"Untitled Project"，实际: ${project2.name}`); }
    ok('缺少name时使用默认值');

    // F1.3: 缺少genre（关键测试——Pipeline全部依赖genre）
    console.log('\n[F1.3] 缺少genre（关键风险）');
    const req3 = mockReq({ name: '无genre项目' });
    const project3 = createProjectData(req3);
    if (project3.genre !== '') { bug(`genre应为空字符串，实际: ${project3.genre}`); }
    if (project3.subGenre !== null) { bug(`subGenre应为null，实际: ${project3.subGenre}`); }
    if (project3.styleProfile !== null) { bug(`styleProfile应为null（无genre无法构建），实际: ${JSON.stringify(project3.styleProfile).substring(0, 50)}`); }
    if (project3.constraints.length === 0) { bug('constraints为空（应使用NOVEL_DEFAULTS.defaultConstraints）'); }
    info(`无genre项目constraints: ${project3.constraints.join(', ')}`);
    ok('缺少genre时使用默认constraints');

    // F1.4: settings合并测试
    console.log('\n[F1.4] settings合并测试');
    const req4 = mockReq({
        name: 'settings测试',
        genre: 'baby',
        settings: { autoPipeline: true, customField: 'test' }
    });
    const project4 = createProjectData(req4);
    if (project4.settings.autoPipeline !== true) { bug(`settings.autoPipeline应合并为true，实际: ${project4.settings.autoPipeline}`); }
    if (project4.settings.chapterRounds !== 3) { bug(`settings.chapterRounds应保留默认3，实际: ${project4.settings.chapterRounds}`); }
    if (project4.settings.customField !== 'test') { bug(`settings.customField应保留，实际: ${project4.settings.customField}`); }
    ok('settings合并正确');
}

// ============ F2: 默认配置生成+genre适配 ============

async function testF2GenreAdaptation() {
    console.log('\n=== F2: 默认配置生成+genre适配测试 ===');

    const GENRES = ['high-martial-crossplane', 'urban-fantasy', 'baby', 'rule-horror', 'infinite-dungeon'];

    for (const genre of GENRES) {
        console.log(`\n[F2] genre="${genre}"适配测试`);
        const req = mockReq({ name: `测试-${genre}`, genre });
        const project = createProjectData(req);

        // 检查subGenre自动推断
        if (!project.subGenre) {
            bug(`subGenre未自动推断: genre=${genre}`);
        } else if (project.subGenre !== genre) {
            warn(`subGenre(${project.subGenre})与genre(${genre})不一致`);
        }

        // 检查styleProfile完整性
        if (!project.styleProfile) {
            bug(`styleProfile为null: genre=${genre}`);
            continue;
        }

        const REQUIRED_SP_FIELDS = ['povRule', 'dialogueRule', 'behaviorRule', 'toneRule', 'titleRule'];
        for (const field of REQUIRED_SP_FIELDS) {
            if (!project.styleProfile[field]) {
                bug(`styleProfile.${field}为空: genre=${genre}`);
            }
        }

        // 检查wordConfig（字段名为minWords/targetWords/maxWords，非targetMinWords/targetMaxWords）
        if (!project.wordConfig) {
            warn(`wordConfig为null: genre=${genre}（将使用系统默认）`);
        } else {
            // wordConfig字段名来自genreProfileRegistry.js第72行: { minWords, targetWords, maxWords }
            if (!project.wordConfig.minWords) { bug(`wordConfig.minWords缺失: genre=${genre}`); }
            if (!project.wordConfig.targetWords) { bug(`wordConfig.targetWords缺失: genre=${genre}`); }
            if (!project.wordConfig.maxWords) { bug(`wordConfig.maxWords缺失: genre=${genre}`); }
        }

        // 检查constraints非空
        if (!project.constraints || project.constraints.length === 0) {
            bug(`constraints为空: genre=${genre}`);
        }

        ok(`genre="${genre}"适配完成 (subGenre=${project.subGenre}, constraints=${project.constraints.length}个)`);
    }
}

// ============ F3: 数据存储一致性 ============

async function testF3StorageConsistency() {
    console.log('\n=== F3: 数据存储一致性+读取回写测试 ===');

    // F3.1: 创建项目并存储
    console.log('\n[F3.1] 创建项目并存储到store');
    const req = mockReq({
        name: '存储一致性测试项目',
        genre: 'high-martial-crossplane',
        description: '测试存储读取一致性'
    });
    const project = createProjectData(req);

    try {
        await store.setItem('projects', project.id, project);
        createdProjectIds.push(project.id);
        ok('项目写入store成功');
    } catch (e) {
        bug(`项目写入store失败: ${e.message}`);
        return;
    }

    // F3.2: 读取并验证字段一致性
    console.log('\n[F3.2] 读取项目并验证字段一致性');
    const saved = await store.getItem('projects', project.id);
    if (!saved) { bug('读取项目为null'); return; }

    const FIELDS_TO_CHECK = ['id', 'name', 'genre', 'mode', 'subGenre', 'status', 'currentChapter', 'styleProfile', 'constraints', 'wordConfig'];
    for (const field of FIELDS_TO_CHECK) {
        const original = JSON.stringify(project[field]);
        const stored = JSON.stringify(saved[field]);
        if (original !== stored) {
            bug(`字段${field}不一致: 原始=${original?.substring(0, 50)}, 存储=${stored?.substring(0, 50)}`);
        }
    }
    ok('存储读取字段一致性验证通过');

    // F3.3: 调用verifyProject验证
    console.log('\n[F3.3] 调用verifyProject自动验证');
    const verification = await verifyProject(project.id);
    if (!verification.valid) {
        const criticalIssues = verification.issues.filter(i => i.level === 'critical');
        for (const issue of criticalIssues) {
            bug(`verifyProject critical: ${issue.field} - ${issue.message}`);
        }
    }
    if (verification.issues.length > 0) {
        info(`verifyProject发现${verification.issues.length}个问题（含warning）`);
    }
    ok(`verifyProject完成: valid=${verification.valid}, issues=${verification.issues.length}`);

    // F3.4: updatedAt时间戳更新测试
    console.log('\n[F3.4] updatedAt时间戳更新测试');
    const updateReq = mockReq({ name: '存储一致性测试项目-已更新' });
    const updated = { ...saved, ...updateReq.body, id: saved.id, updatedAt: new Date().toISOString() };
    await store.setItem('projects', saved.id, updated);
    const reRead = await store.getItem('projects', saved.id);
    if (reRead.name !== '存储一致性测试项目-已更新') { bug(`更新后name不匹配: ${reRead.name}`); }
    if (reRead.updatedAt === saved.updatedAt) { bug('updatedAt未更新'); }
    ok('updatedAt时间戳更新正确');
}

// ============ F4: DataContext委托方法可用性 ============

async function testF4DataContextAvailability() {
    console.log('\n=== F4: DataContext委托方法对新建项目可用性测试 ===');

    // 创建测试项目
    const req = mockReq({
        name: 'DataContext测试项目',
        genre: 'high-martial-crossplane',
        description: '测试DataContext委托方法'
    });
    const project = createProjectData(req);
    await store.setItem('projects', project.id, project);
    createdProjectIds.push(project.id);

    // 实例化DataContext
    let ctx;
    try {
        ctx = new DataContext(project.id);
        ok('DataContext实例化成功');
    } catch (e) {
        bug(`DataContext实例化失败: ${e.message}`);
        return;
    }

    // F4.1: getProject可用性
    console.log('\n[F4.1] getProject可用性');
    try {
        const proj = await ctx.getProject();
        if (!proj) { bug('getProject返回null'); }
        else if (proj.id !== project.id) { bug(`getProject返回id不匹配: ${proj.id}`); }
        else ok('getProject可用');
    } catch (e) { bug(`getProject异常: ${e.message}`); }

    // F4.2: getStyleProfile可用性
    console.log('\n[F4.2] getStyleProfile可用性');
    try {
        const sp = await ctx.getStyleProfile();
        if (!sp) { bug('getStyleProfile返回null'); }
        else if (!sp.povRule) { bug('getStyleProfile.povRule为空'); }
        else ok(`getStyleProfile可用 (povRule="${sp.povRule.substring(0, 20)}...")`);
    } catch (e) { bug(`getStyleProfile异常: ${e.message}`); }

    // F4.3: getGenre可用性
    console.log('\n[F4.3] getGenre可用性');
    try {
        const genre = await ctx.getGenre();
        if (!genre) { bug('getGenre返回null'); }
        else if (!genre.id) { bug('getGenre返回对象缺少id'); }
        else ok(`getGenre可用 (id="${genre.id}")`);
    } catch (e) { bug(`getGenre异常: ${e.message}`); }

    // F4.4: getChapters可用性（新建项目应为空数组）
    console.log('\n[F4.4] getChapters可用性');
    try {
        const chapters = await ctx.getChapters();
        if (!Array.isArray(chapters)) { bug(`getChapters应返回数组，实际: ${typeof chapters}`); }
        else if (chapters.length !== 0) { warn(`新建项目chapters应为空，实际: ${chapters.length}个`); }
        else ok('getChapters可用（新建项目返回空数组）');
    } catch (e) { bug(`getChapters异常: ${e.message}`); }

    // F4.5: getMaterials可用性（新建项目应为空数组）
    console.log('\n[F4.5] getMaterials可用性');
    try {
        const materials = await ctx.getMaterials();
        if (!Array.isArray(materials)) { bug(`getMaterials应返回数组，实际: ${typeof materials}`); }
        else if (materials.length !== 0) { warn(`新建项目materials应为空，实际: ${materials.length}个`); }
        else ok('getMaterials可用（新建项目返回空数组）');
    } catch (e) { bug(`getMaterials异常: ${e.message}`); }

    // F4.6: getQuests可用性
    console.log('\n[F4.6] getQuests可用性');
    try {
        const quests = await ctx.getQuests();
        if (!Array.isArray(quests)) { bug(`getQuests应返回数组，实际: ${typeof quests}`); }
        else ok(`getQuests可用（返回${quests.length}个）`);
    } catch (e) { bug(`getQuests异常: ${e.message}`); }

    // F4.7: getTimelines可用性
    console.log('\n[F4.7] getTimelines可用性');
    try {
        const timelines = await ctx.getTimelines();
        if (!Array.isArray(timelines)) { bug(`getTimelines应返回数组，实际: ${typeof timelines}`); }
        else ok(`getTimelines可用（返回${timelines.length}个）`);
    } catch (e) { bug(`getTimelines异常: ${e.message}`); }
}

// ============ F5: 项目删除联动 ============

async function testF5CascadeDelete() {
    console.log('\n=== F5: 项目删除联动+28种关联数据清理测试 ===');

    // 创建测试项目
    const req = mockReq({
        name: '删除联动测试项目',
        genre: 'high-martial-crossplane'
    });
    const project = createProjectData(req);
    await store.setItem('projects', project.id, project);

    // 为项目创建一些关联数据（模拟真实使用场景）
    // 注意：关联数据必须包含id字段，否则cascadeDelete的deleteItem会收到undefined
    console.log('\n[F5.1] 创建关联数据');
    const relatedData = [
        { type: 'chapters', id: `${project.id}-ch1`, data: { id: `${project.id}-ch1`, projectId: project.id, chapterNumber: 1, content: '测试章节' } },
        { type: 'materials', id: `${project.id}-mat1`, data: { id: `${project.id}-mat1`, projectId: project.id, type: 'character', name: '主角' } },
        { type: 'timelines', id: `${project.id}-tl1`, data: { id: `${project.id}-tl1`, projectId: project.id, event: '事件1' } },
        { type: 'quests', id: `${project.id}-q1`, data: { id: `${project.id}-q1`, projectId: project.id, title: '任务1' } },
        { type: 'entity-registry', id: `${project.id}-ent1`, data: { id: `${project.id}-ent1`, projectId: project.id, name: '实体1' } },
    ];

    for (const item of relatedData) {
        try {
            await store.setItem(item.type, item.id, item.data);
            info(`创建关联数据: ${item.type}/${item.id}`);
        } catch (e) {
            warn(`创建关联数据失败: ${item.type} - ${e.message}`);
        }
    }

    // F5.2: 执行级联删除
    console.log('\n[F5.2] 执行级联删除');
    let deletedCounts;
    try {
        const result = await cascadeDeleteProject(project.id);
        deletedCounts = result.deletedCounts || result;
        ok(`级联删除完成: ${JSON.stringify(result)}`);
    } catch (e) {
        bug(`级联删除失败: ${e.message}`);
        return;
    }

    // F5.3: 验证项目本身已删除
    console.log('\n[F5.3] 验证项目本身已删除');
    const deletedProject = await store.getItem('projects', project.id);
    if (deletedProject) { bug('项目本身未被删除'); }
    else ok('项目本身已删除');

    // F5.4: 验证关联数据已清理
    console.log('\n[F5.4] 验证关联数据已清理');
    for (const item of relatedData) {
        const remaining = await store.getItem(item.type, item.id);
        if (remaining) { bug(`关联数据未清理: ${item.type}/${item.id}`); }
    }
    ok('关联数据清理验证完成');

    // F5.5: CASCADE_STORE_TYPES完整性检查
    console.log('\n[F5.5] CASCADE_STORE_TYPES完整性检查');
    info(`级联删除类型数: ${CASCADE_STORE_TYPES.length}`);
    if (CASCADE_STORE_TYPES.length < 28) {
        bug(`CASCADE_STORE_TYPES数量不足28种，实际: ${CASCADE_STORE_TYPES.length}`);
    } else {
        ok(`CASCADE_STORE_TYPES包含${CASCADE_STORE_TYPES.length}种关联数据类型`);
    }

    // F5.6: 检查是否有重复的store type
    console.log('\n[F5.6] 检查CASCADE_STORE_TYPES是否有重复');
    const uniqueTypes = new Set(CASCADE_STORE_TYPES);
    if (uniqueTypes.size !== CASCADE_STORE_TYPES.length) {
        const duplicates = CASCADE_STORE_TYPES.filter((item, idx) => CASCADE_STORE_TYPES.indexOf(item) !== idx);
        bug(`CASCADE_STORE_TYPES有重复: ${duplicates.join(', ')}`);
    } else {
        ok('CASCADE_STORE_TYPES无重复');
    }
}

// ============ F6: 边界场景 ============

async function testF6BoundaryScenarios() {
    console.log('\n=== F6: 边界场景测试 ===');

    // F6.1: 超长项目名（200字符边界）
    console.log('\n[F6.1] 超长项目名（250字符）');
    const longName = 'A'.repeat(250);
    const req1 = mockReq({ name: longName, genre: 'baby' });
    const project1 = createProjectData(req1);
    // Bug#8修复后：createProjectData会截断到FIELD_LIMITS.NAME_MAX(200)
    if (project1.name.length !== 200) { bug(`超长name应截断到200，实际: ${project1.name.length}`); }
    else ok(`超长name已截断到200字符（Bug#8修复生效）`);

    // F6.2: 未知genre
    console.log('\n[F6.2] 未知genre');
    const req2 = mockReq({ name: '未知genre项目', genre: 'non-existent-genre' });
    const project2 = createProjectData(req2);
    if (project2.subGenre !== null) { bug(`未知genre的subGenre应为null，实际: ${project2.subGenre}`); }
    if (project2.styleProfile !== null) { bug(`未知genre的styleProfile应为null，实际: ${JSON.stringify(project2.styleProfile).substring(0, 50)}`); }
    if (project2.wordConfig !== null) { bug(`未知genre的wordConfig应为null，实际: ${JSON.stringify(project2.wordConfig)}`); }
    info(`未知genre: subGenre=${project2.subGenre}, styleProfile=${project2.styleProfile}, wordConfig=${project2.wordConfig}`);
    ok('未知genre正确降级为null（不崩溃）');

    // F6.3: 重复创建相同参数项目
    console.log('\n[F6.3] 重复创建相同参数项目（验证id唯一性）');
    const req3 = mockReq({ name: '重复创建测试', genre: 'baby' });
    const project3a = createProjectData(req3);
    const project3b = createProjectData(req3);
    if (project3a.id === project3b.id) { bug('两次创建id相同（uuid冲突）'); }
    else ok(`两次创建id不同: ${project3a.id.substring(0, 8)} vs ${project3b.id.substring(0, 8)}`);

    // F6.4: 空body对象
    console.log('\n[F6.4] 空body对象');
    const req4 = mockReq({});
    const project4 = createProjectData(req4);
    if (project4.name !== 'Untitled Project') { bug(`空body的name应为默认值，实际: ${project4.name}`); }
    if (project4.genre !== '') { bug(`空body的genre应为空字符串，实际: ${project4.genre}`); }
    if (project4.mode !== 'novel') { bug(`空body的mode应为novel，实际: ${project4.mode}`); }
    ok('空body对象正确使用默认值');

    // F6.5: mode强制为novel（即使传入其他值）
    console.log('\n[F6.5] mode强制为novel测试');
    const req5 = mockReq({ name: 'mode测试', genre: 'baby', mode: 'tomato' });
    const project5 = createProjectData(req5);
    // Bug#4修复后：createProjectData强制mode=SUPPORTED_MODE('novel')，忽略前端传入值
    if (project5.mode !== 'novel') {
        bug(`createProjectData未强制mode=novel，实际: ${project5.mode}`);
    } else {
        ok(`传入mode='tomato'被强制为'novel'（Bug#4修复生效）`);
    }

    // F6.6: targetChapters=0边界
    console.log('\n[F6.6] targetChapters=0边界');
    const req6 = mockReq({ name: '零章节测试', genre: 'baby', targetChapters: 0 });
    const project6 = createProjectData(req6);
    // Bug#5修复后：targetChapters=0是合法值，不会被|| falsy改为100
    if (project6.targetChapters !== 0) {
        bug(`targetChapters=0应保留，实际: ${project6.targetChapters}`);
    } else {
        ok(`targetChapters=0正确保留（Bug#5修复生效）`);
    }

    // F6.7: null值传入
    console.log('\n[F6.7] null值传入');
    const req7 = mockReq({ name: null, genre: null, description: null });
    const project7 = createProjectData(req7);
    if (project7.name !== 'Untitled Project') { bug(`name=null应使用默认值，实际: ${project7.name}`); }
    if (project7.genre !== '') { bug(`genre=null应为空字符串，实际: ${project7.genre}`); }
    if (project7.description !== '') { bug(`description=null应为空字符串，实际: ${project7.description}`); }
    ok('null值正确降级为默认值');
}

// ============ 主函数 ============

async function main() {
    console.log('========================================');
    console.log('总工程师模拟新建项目流程测试');
    console.log('========================================');

    try {
        await testF1ParameterValidation();
        await testF2GenreAdaptation();
        await testF3StorageConsistency();
        await testF4DataContextAvailability();
        await testF5CascadeDelete();
        await testF6BoundaryScenarios();
    } catch (e) {
        console.error(`\n💥 测试执行异常: ${e.message}`);
        console.error(e.stack);
        bugCount++;
    } finally {
        await cleanup();
    }

    console.log('\n========================================');
    console.log('模拟测试完成');
    console.log('========================================');
    console.log(`  Bug数: ${bugCount}`);
    console.log(`  警告数: ${warnCount}`);

    if (bugCount === 0) {
        console.log('\n✅ 全部测试通过 — 未发现bug');
        process.exit(0);
    } else {
        console.log(`\n❌ 发现${bugCount}个bug`);
        process.exit(1);
    }
}

main();
