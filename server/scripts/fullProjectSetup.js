require('dotenv').config({ override: true });
process.env.USE_PG = 'true';
process.env.USE_SQLITE = 'false';

const store = require('../store');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const CHARACTERS = require('./setupCharacters');
const OUTLINES = require('./setupOutlines');

const PROJECT_ID = uuidv4();
const STYLE_PROFILE_ID = '5e2884a8-642a-45b4-9701-753017b98f30';

async function setupProject() {
    const results = [];

    console.log('\n[1/5] 创建项目（破笼之鸟）...');
    const project = {
        id: PROJECT_ID, name: '破笼之鸟',
        description: '落魄设计师沈星晚×野性纹身师陆野，双向救赎的都市甜宠故事。',
        mode: 'novel', genre: '都市甜宠', styleProfile: STYLE_PROFILE_ID,
        wordConfig: { rejectMin: 2000, targetMin: 2200, targetMax: 2800, maxWords: 3000 },
        targetChapters: 20,
        constraints: ['character-depth', 'anti-tool-character', 'hook-every-chapter', 'simple-readable-style'],
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    };
    await store.setItem('projects', PROJECT_ID, project);
    results.push('✅ 项目创建成功');

    console.log('\n[2/5] 验证StyleProfile...');
    const styleProfile = await store.getItem('style-profiles', STYLE_PROFILE_ID);
    if (styleProfile) { results.push(`✅ StyleProfile已存在: ${styleProfile.label}`); }
    else {
        await store.setItem('style-profiles', STYLE_PROFILE_ID, {
            id: STYLE_PROFILE_ID, key: 'urban-sweetpet-designer-tattoo', label: '都市甜宠·落魄设计师×纹身师',
            povRule: '采用第三人称限知视角（偏女主沈星晚），每章不超过2个视角切换。',
            dialogueRule: '对话简洁有留白，甜宠靠行动不靠嘴，禁用"霸道总裁式"油腻台词。',
            behaviorRule: '甜宠靠行动不靠嘴：男主温柔体现在修东西、送药膏、照顾猫，不说"我保护你"。',
            toneRule: '市井烟火+克制温柔+张力拉满。场景描写接地气。情绪藏在细节里。',
            mechanicFormat: { forbiddenFormats: ['系统面板', '等级提示', '进度条', '面临抉择模板', '评分式描述', '0.5秒/0.3秒类时间描述'] },
            createdAt: new Date().toISOString()
        });
        results.push('✅ StyleProfile已创建');
    }

    console.log('\n[3/5] 创建人物素材库...');
    for (const char of CHARACTERS) {
        const charId = uuidv4();
        await store.setItem('materials', charId, {
            id: charId, projectId: PROJECT_ID, type: 'character', name: char.name, role: char.role,
            currentContent: char.content, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
        });
        console.log(`  ✅ ${char.name} (${char.role})`);
    }
    results.push(`✅ 创建${CHARACTERS.length}个角色素材`);

    console.log('\n[4/5] 创建20章完整大纲...');
    for (const o of OUTLINES) {
        const outlineKey = `${PROJECT_ID}-ch${o.chapter}`;
        await store.setItem('chapter-outlines', outlineKey, {
            id: outlineKey, projectId: PROJECT_ID, chapterNumber: o.chapter,
            chapterTitle: `第${o.chapter}章：${o.title}`, content: o.content,
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
        });
        console.log(`  ✅ 第${o.chapter}章：${o.title}`);
    }
    results.push(`✅ 创建${OUTLINES.length}章大纲`);

    console.log('\n[5/5] 验证完整配置...');
    const savedProject = await store.getItem('projects', PROJECT_ID);
    const materials = (await store.listItems('materials')).filter(m => m.projectId === PROJECT_ID);
    const outlines = (await store.listItems('chapter-outlines')).filter(o => o.projectId === PROJECT_ID);
    console.log(`  项目: ${savedProject.name} | 素材: ${materials.length}个 | 大纲: ${outlines.length}章`);
    results.push(materials.length === 4 && outlines.length === 20 ? '✅ 完整配置验证通过' : '❌ 配置不完整');

    fs.writeFileSync(path.join(__dirname, '../../lastProjectId.txt'), PROJECT_ID);
    console.log('\n' + '='.repeat(60) + '\n📋 项目建立完成报告\n' + '='.repeat(60));
    results.forEach(r => console.log(`  ${r}`));
    return PROJECT_ID;
}

setupProject().catch(err => { console.error('❌ 项目建立失败:', err); process.exit(1); });
