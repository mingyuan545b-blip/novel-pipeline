require('dotenv').config({ override: true });
const store = require('../store');
const { runAgent } = require('../services/pipeline/agentRunner');
const { v4: uuidv4 } = require('uuid');
const CHECKLIST = require('./testChecklist');

const STYLE_PROFILE_ID = '5e2884a8-642a-45b4-9701-753017b98f30';

async function runTest() {
    console.log('🚀 开始端到端Pipeline测试...\n');
    const projectId = uuidv4();
    try {
        CHECKLIST.updateStep(1, 'in_progress');
        const project = { id: projectId, name: '破笼之鸟', description: '落魄设计师沈星晚×野性纹身师陆野', mode: 'novel', genre: '都市甜宠', styleProfile: STYLE_PROFILE_ID, wordConfig: { rejectMin: 2000, targetMin: 2200, targetMax: 2800, maxWords: 3000 }, targetChapters: 20, constraints: ['character-depth', 'anti-tool-character', 'hook-every-chapter', 'simple-readable-style'], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        await store.setItem('projects', projectId, project);
        CHECKLIST.updateStep(1, 'completed', `项目ID: ${projectId}`);

        CHECKLIST.updateStep(2, 'in_progress');
        const savedProject = await store.getItem('projects', projectId);
        if (savedProject?.constraints?.length === 4) { CHECKLIST.updateStep(2, 'completed', `约束: ${savedProject.constraints.join(', ')}`); }
        else throw new Error('写作约束配置失败');

        CHECKLIST.updateStep(3, 'in_progress');
        const charData = [
            { name: '沈星晚', content: '沈星晚，26岁，落魄设计师。性格清醒独立，不傻白甜，拒绝施舍。说话务实直接，偶尔自嘲。', dialect: '南方', speech: '务实直接，带专业术语但用大白话解释' },
            { name: '陆野', content: '陆野，28岁，野性纹身师。话少但句句戳心，声音低沉。温柔体现在行动：默默修东西、送药膏、照顾猫。', dialect: '本地', speech: '话少，低沉，偶尔痞气，句句戳心' }
        ];
        for (const c of charData) { const id = uuidv4(); await store.setItem('materials', id, { id, projectId, type: 'character', name: c.name, currentContent: c.content, dialectRegion: c.dialect, speechStyle: c.speech, createdAt: new Date().toISOString() }); }
        const projectMats = (await store.listItems('materials')).filter(m => m.projectId === projectId);
        CHECKLIST.updateStep(3, 'completed', `创建${projectMats.length}个角色素材`);

        CHECKLIST.updateStep(4, 'in_progress');
        const outline = { projectId, chapterNumber: 1, chapterTitle: '第1章：缝纫机与纹身笔', content: '【本章核心】沈星晚在改衣铺忙碌，陆野首次出场改皮衣。\n【场景1】沈星晚修缝纫机，展现落魄现状\n【场景2】陆野推门而入，皮衣需要修改\n【场景3】陆野离开后留下药膏\n【章末钩子】会员卡背面："你的手，不该只碰针线。"', createdAt: new Date().toISOString() };
        await store.setItem('chapter-outlines', `${projectId}-ch1`, outline);
        CHECKLIST.updateStep(4, 'completed', '第1章大纲已创建');

        CHECKLIST.updateStep(5, 'in_progress');
        const writerResult = await runAgent('writer', { mode: 'novel', projectId, chapterNumber: 1, chapterOutline: outline.content, materials: projectMats });
        CHECKLIST.updateStep(5, 'completed', `字数: ${writerResult.response.length}`);

        CHECKLIST.updateStep(6, 'in_progress');
        const reviewerResult = await runAgent('first-review', { mode: 'novel', projectId, chapterContent: writerResult.response, chapterOutline: outline.content, materials: projectMats });
        CHECKLIST.updateStep(6, 'completed', `审核报告: ${reviewerResult.response.length}字符`);

        CHECKLIST.updateStep(7, 'in_progress');
        const reviserResult = await runAgent('reviser', { mode: 'novel', projectId, chapterContent: writerResult.response, reviewContext: reviewerResult.response, chapterOutline: outline.content });
        CHECKLIST.updateStep(7, 'completed', `修改后字数: ${reviserResult.response.length}`);

        CHECKLIST.updateStep(8, 'in_progress');
        const finalResult = await runAgent('final-editor', { mode: 'novel', projectId, chapterContent: reviserResult.response, reviewContext: reviewerResult.response });
        CHECKLIST.updateStep(8, 'completed', `定稿: ${finalResult.response.length}字符`);

        CHECKLIST.updateStep(9, 'in_progress');
        const fc = reviserResult.response;
        const checks = { wordCount: fc.length >= 2000, hasDialogue: fc.includes('「') || fc.includes('"'), hasDescription: fc.length > 500, noForbiddenFormats: !['系统面板', '等级提示', '进度条'].some(f => fc.includes(f)), noTimeDesc: !/0\.[0-9]秒/.test(fc) };
        const passedCount = Object.values(checks).filter(v => v).length;
        CHECKLIST.updateStep(9, 'completed', `质量: ${passedCount}/${Object.keys(checks).length}通过`);
        CHECKLIST.printReport();
        console.log('\n📖 正文预览:\n' + fc.substring(0, 500) + '...');
    } catch (err) { console.error(`❌ 测试失败: ${err.message}`); CHECKLIST.printReport(); process.exit(1); }
}

runTest().catch(err => { console.error('❌ 测试脚本执行失败:', err); process.exit(1); });
