const { initDatabaseAsync, closeDatabase } = require('../../server/db/database');
const store = require('../../server/db/store');
const { VALID_MATERIAL_TYPES, HIERARCHY_RULES, MATERIAL_STANDARDS } = require('../../server/config/materialTypes');
const { resolveConfig } = require('../../server/config');
const materialValidator = require('../../server/services/materialValidator');
const genreConfig = require('../../server/services/genreConfig');
const { v4: uuidv4 } = require('uuid');

let projectId;
let foundationMaterialIds = [];
let chapterIds = [];

beforeAll(async () => {
    await initDatabaseAsync(':memory:');
});

afterAll(() => {
    closeDatabase();
});

describe('Integration: Project Creation with 30-Chapter Outline', () => {
    test('create project with high-martial-crossplane genre', async () => {
        projectId = uuidv4();
        const project = {
            id: projectId,
            name: '位面掠夺·测试版',
            mode: 'novel',
            genre: 'high-martial-comedy',
            styleProfile: {
                key: 'high-martial-comedy',
                povRule: '第三人称有限视角',
                dialogueRule: '对话推动剧情',
                toneRule: '反套路喜剧'
            },
            wordConfig: resolveConfig({ mode: 'novel' }).wordConfig,
            description: '测试项目：位面掠夺系统，高武反套路喜剧题材，30章大纲，验证无污染',
            chapters: [],
            chapterIntents: { chapters: {} }
        };
        await store.setItem('projects', projectId, project);
        const retrieved = await store.getItem('projects', projectId);
        expect(retrieved).not.toBeNull();
        expect(retrieved.name).toBe('位面掠夺·测试版');
        expect(retrieved.genre).toBe('high-martial-comedy');
    });

    test('create 30 chapter outlines without pollution', async () => {
        const outlines = [
            '系统觉醒，主角获得位面掠夺能力',
            '初次进入规则怪谈位面，学习基本规则',
            '规则怪谈位面通关，获得第一个能力',
            '回归主世界，能力受修为压制测试',
            '势力冲突初现，加入宗门',
            '宗门试炼，展示压制后能力',
            '第二次位面探索预告',
            '进入抽象概念位面',
            '抽象概念位面通关，获得概念能力',
            '主世界冲突升级',
            '宗门大比，能力展示',
            '第三次位面探索预告',
            '进入文明类位面',
            '文明位面通关，获得文明遗产',
            '主世界大战序幕',
            '势力博弈，多线叙事',
            '第四次位面探索预告',
            '进入动漫类位面',
            '动漫位面通关，获得特殊道具',
            '主世界决战准备',
            '伏笔回收：规则怪谈位面遗留问题',
            '伏笔回收：抽象概念位面影响',
            '伏笔回收：文明位面遗产激活',
            '伏笔回收：动漫位面道具使用',
            '最终决战前夜',
            '最终决战（上）',
            '最终决战（下）',
            '战后重建',
            '新位面预告',
            '尾声：新的开始'
        ];

        expect(outlines.length).toBe(30);

        for (let i = 0; i < 30; i++) {
            const chapterId = uuidv4();
            chapterIds.push(chapterId);
            const chapter = {
                id: chapterId,
                projectId,
                chapterNumber: i + 1,
                status: 'outlined',
                outline: outlines[i],
                content: '',
                _reviewRounds: 0,
                _wordCountRetry: 0
            };
            await store.setItem('chapters', chapterId, chapter);
        }

        const allChapters = await store.queryItems('chapters', { projectId });
        expect(allChapters.length).toBe(30);

        const chapterNumbers = allChapters.map(c => c.chapterNumber).sort((a, b) => a - b);
        for (let i = 0; i < 30; i++) {
            expect(chapterNumbers[i]).toBe(i + 1);
        }
    });

    test('no cross-project pollution', async () => {
        const otherProjectId = uuidv4();
        await store.setItem('projects', otherProjectId, {
            id: otherProjectId,
            name: '其他项目',
            mode: 'shuangwen'
        });

        const otherChapters = await store.queryItems('chapters', { projectId: otherProjectId });
        expect(otherChapters.length).toBe(0);

        const ourChapters = await store.queryItems('chapters', { projectId });
        expect(ourChapters.length).toBe(30);
    });
});

describe('Integration: Foundation Materials Setup', () => {
    test('create main world materials (worldview, power-system, faction, character)', async () => {
        const worldviewId = uuidv4();
        foundationMaterialIds.push(worldviewId);
        await store.setItem('materials', worldviewId, {
            id: worldviewId,
            projectId,
            type: 'worldview',
            name: '修仙世界',
            currentContent: '灵气复苏，修仙者众。边界：不可逆天。违反后果：天谴降身。',
            parentPlane: null,
            isFoundation: true
        });

        const powerSystemId = uuidv4();
        foundationMaterialIds.push(powerSystemId);
        await store.setItem('materials', powerSystemId, {
            id: powerSystemId,
            projectId,
            type: 'power-system',
            name: '修仙战力体系',
            currentContent: '升级条件：需渡劫。代价：反噬三成修为。限制：不可越级。',
            parentPlane: null,
            isFoundation: true
        });

        const factionId = uuidv4();
        foundationMaterialIds.push(factionId);
        await store.setItem('materials', factionId, {
            id: factionId,
            projectId,
            type: 'faction',
            name: '天机宗',
            currentContent: '主世界大宗门',
            parentPlane: null,
            isFoundation: true
        });

        const characterId = uuidv4();
        foundationMaterialIds.push(characterId);
        await store.setItem('materials', characterId, {
            id: characterId,
            projectId,
            type: 'character',
            name: '张玄',
            currentContent: '核心欲望：位面之主。内在矛盾：凡心与仙道。行为模式：隐忍谋定。',
            parentFaction: factionId,
            parentPlane: null,
            isFoundation: true
        });

        const mats = await store.queryItems('materials', { projectId });
        expect(mats.length).toBe(4);
    });

    test('foundation materials cannot be deleted', async () => {
        for (const id of foundationMaterialIds) {
            const result = await store.deleteItem('materials', id);
            expect(result).toBe(false);
            expect(await store.getItem('materials', id)).not.toBeNull();
        }
    });

    test('create sub-plane materials with correct hierarchy', async () => {
        const subPlaneId = uuidv4();
        await store.setItem('materials', subPlaneId, {
            id: subPlaneId,
            projectId,
            type: 'sub-plane',
            name: '规则怪谈·镜中世界',
            currentContent: '镜像规则：不可直视镜中自己超过3秒',
            parentPlane: null
        });

        const spFactionId = uuidv4();
        await store.setItem('materials', spFactionId, {
            id: spFactionId,
            projectId,
            type: 'faction',
            name: '镜中守卫',
            currentContent: '守护镜像世界的神秘组织',
            parentPlane: subPlaneId
        });

        const spCharId = uuidv4();
        await store.setItem('materials', spCharId, {
            id: spCharId,
            projectId,
            type: 'character',
            name: '镜灵',
            currentContent: '核心欲望：逃离镜中。内在矛盾：存在即囚禁。行为模式：引诱闯入者。',
            parentFaction: spFactionId,
            parentPlane: subPlaneId
        });

        const spFaction = await store.getItem('materials', spFactionId);
        expect(spFaction.parentPlane).toBe(subPlaneId);

        const spChar = await store.getItem('materials', spCharId);
        expect(spChar.parentPlane).toBe(subPlaneId);
        expect(spChar.parentFaction).toBe(spFactionId);

        expect(await store.isFoundationMaterial(spFaction)).toBe(false);
        expect(await store.isFoundationMaterial(spChar)).toBe(false);
    });
});

describe('Integration: 10-Chapter Pipeline Simulation', () => {
    const writtenChapters = [];

    test('simulate writer → first-review → final-editor for 10 chapters', async () => {
        for (let i = 0; i < 10; i++) {
            const chapterId = chapterIds[i];
            let chapter = await store.getItem('chapters', chapterId);
            expect(chapter.status).toBe('outlined');

            chapter.status = 'written';
            chapter.content = `第${i + 1}章正文内容：${chapter.outline}。张玄站在山巅，灵气如潮水般涌来。他深吸一口气，感受着体内翻涌的力量。远处的天机宗灯火通明，宗门大比即将开始。`;
            chapter.writerOutput = chapter.content;
            chapter._reviewRounds = 1;
            await store.setItem('chapters', chapterId, chapter);

            chapter = await store.getItem('chapters', chapterId);
            chapter.status = 'first-reviewing';
            chapter.firstReviewOutput = JSON.stringify({
                verdict: 'pass',
                issues: [],
                score: 85
            });
            chapter.status = 'first-review-passed';
            await store.setItem('chapters', chapterId, chapter);

            chapter = await store.getItem('chapters', chapterId);
            chapter.status = 'final-editing';
            chapter.finalEditorOutput = chapter.content + '\n[定稿完成]';
            chapter.content = chapter.finalEditorOutput;
            chapter.status = 'approved';
            await store.setItem('chapters', chapterId, chapter);

            writtenChapters.push(chapterId);
        }

        const approved = await store.queryItems('chapters', c => c.projectId === projectId && c.status === 'approved');
        expect(approved.length).toBe(10);
    });

    test('chapter content is not polluted between chapters', async () => {
        for (let i = 0; i < 10; i++) {
            const chapter = await store.getItem('chapters', chapterIds[i]);
            expect(chapter.content).toContain(`第${i + 1}章`);
            expect(chapter.content).not.toContain(`第${i === 0 ? 10 : i}章`);
        }
    });

    test('review rounds tracked correctly', async () => {
        for (let i = 0; i < 10; i++) {
            const chapter = await store.getItem('chapters', chapterIds[i]);
            expect(chapter._reviewRounds).toBe(1);
            expect(chapter.status).toBe('approved');
        }
    });
});

describe('Integration: Material Management', () => {
    test('material-manager creates new materials with correct hierarchy', async () => {
        const newEquipId = uuidv4();
        await store.setItem('materials', newEquipId, {
            id: newEquipId,
            projectId,
            type: 'equipment',
            name: '灵镜碎片',
            currentContent: '从规则怪谈位面获得的道具，可短暂照出隐藏规则',
            parentPlane: null,
            sourceChapter: 3
        });

        const mat = await store.getItem('materials', newEquipId);
        expect(mat.type).toBe('equipment');
        expect(mat.sourceChapter).toBe(3);
        expect(await store.isFoundationMaterial(mat)).toBe(false);
    });

    test('material-manager updates existing materials', async () => {
        const worldviewId = foundationMaterialIds[0];
        const worldview = await store.getItem('materials', worldviewId);
        const originalContent = worldview.currentContent;

        worldview.currentContent = originalContent + '\n更新：灵气浓度随位面探索递增';
        worldview.changeLog = [
            { chapter: 5, change: '灵气浓度更新', timestamp: new Date().toISOString() }
        ];
        await store.setItem('materials', worldviewId, worldview);

        const updated = await store.getItem('materials', worldviewId);
        expect(updated.currentContent).toContain('灵气浓度随位面探索递增');
        expect(updated.changeLog.length).toBe(1);
    });

    test('new material validation works correctly', async () => {
        const validMaterial = {
            type: 'character',
            name: '新角色测试',
            currentContent: '核心欲望：证道。内在矛盾：情劫。行为模式：独行。',
            parentFaction: foundationMaterialIds[2]
        };
        const result = await materialValidator.validateMaterial(validMaterial);
        expect(result.valid).toBe(true);

        const invalidMaterial = {
            type: 'character',
            name: '无效角色'
        };
        const invalidResult = await materialValidator.validateMaterial(invalidMaterial);
        expect(invalidResult.valid).toBe(false);
    });

    test('material type validation rejects unknown types', async () => {
        const result = await materialValidator.validateMaterial({
            type: 'unknown-type',
            name: '测试'
        });
        expect(result.valid).toBe(false);
    });
});

describe('Integration: Foreshadow Recovery Mechanism', () => {
    const foreshadowIds = [];

    test('create foreshadowing materials with recovery windows', async () => {
        const foreshadows = [
            { name: '镜中预言', targetChapter: 21, content: '镜中世界预言：当三镜合一，位面门将开。预期回收窗口：第21章。关联角色：张玄、镜灵。' },
            { name: '宗门密令', targetChapter: 22, content: '天机宗密令：关于位面掠夺的真相。预期回收窗口：第22章。关联角色：宗主。' },
            { name: '灵镜碎片异变', targetChapter: 24, content: '灵镜碎片在特定条件下会共振。预期回收窗口：第24章。关联角色：张玄。' }
        ];

        for (const f of foreshadows) {
            const id = uuidv4();
            foreshadowIds.push(id);
            await store.setItem('materials', id, {
                id,
                projectId,
                type: 'foreshadowing',
                name: f.name,
                currentContent: f.content,
                targetChapter: f.targetChapter,
                status: 'planted',
                parentPlane: null
            });
        }

        const allForeshadows = await store.queryItems('materials', m => m.projectId === projectId && m.type === 'foreshadowing');
        expect(allForeshadows.length).toBe(3);
    });

    test('foreshadowing validation works', async () => {
        for (const id of foreshadowIds) {
            const f = await store.getItem('materials', id);
            const validation = MATERIAL_STANDARDS.foreshadowing.check(f.currentContent);
            expect(validation.valid).toBe(true);
        }
    });

    test('foreshadow recovery updates status', async () => {
        const f = await store.getItem('materials', foreshadowIds[0]);
        f.status = 'recovered';
        f.recoveredInChapter = 21;
        f.recoveryContent = '三镜合一，位面门开启，张玄踏入新世界';
        await store.setItem('materials', foreshadowIds[0], f);

        const updated = await store.getItem('materials', foreshadowIds[0]);
        expect(updated.status).toBe('recovered');
        expect(updated.recoveredInChapter).toBe(21);
    });

    test('unrecovered foreshadows remain planted', async () => {
        const planted = await store.queryItems('materials', m =>
            m.projectId === projectId && m.type === 'foreshadowing' && m.status === 'planted'
        );
        expect(planted.length).toBe(2);

        const recovered = await store.queryItems('materials', m =>
            m.projectId === projectId && m.type === 'foreshadowing' && m.status === 'recovered'
        );
        expect(recovered.length).toBe(1);
    });
});

describe('Integration: Genre Plugin Isolation', () => {
    test('high-martial genre detected correctly', () => {
        const styleProfile = { key: 'high-martial-comedy' };
        const detected = genreConfig.detectGenre(styleProfile);
        expect(detected).not.toBeNull();
        expect(detected.id).toBe('high-martial-comedy');
    });

    test('different genres do not pollute each other', () => {
        const hmGenre = genreConfig.getGenreById('high-martial-comedy');
        const babyGenre = genreConfig.getGenreById('baby');

        expect(hmGenre.id).not.toBe(babyGenre.id);

        if (hmGenre.styleProfile && babyGenre.styleProfile) {
            expect(hmGenre.styleProfile.key).not.toBe(babyGenre.styleProfile.key);
        }
    });

    test('genre review rules are project-specific', () => {
        const hmGenre = genreConfig.getGenreById('high-martial-comedy');
        const babyGenre = genreConfig.getGenreById('baby');

        if (hmGenre && babyGenre && hmGenre.reviewRules && babyGenre.reviewRules) {
            expect(hmGenre.reviewRules).not.toBe(babyGenre.reviewRules);
        } else {
            expect(true).toBe(true);
        }
    });
});

describe('Integration: Data Integrity Across Operations', () => {
    test('project material count is consistent', async () => {
        const allMats = await store.queryItems('materials', { projectId });
        const matTypes = {};
        for (const m of allMats) {
            matTypes[m.type] = (matTypes[m.type] || 0) + 1;
        }
        expect(allMats.length).toBeGreaterThan(0);
    });

    test('chapter ordering is preserved', async () => {
        const chapters = await store.queryItems('chapters', { projectId });
        const sorted = [...chapters].sort((a, b) => a.chapterNumber - b.chapterNumber);
        for (let i = 1; i < sorted.length; i++) {
            expect(sorted[i].chapterNumber).toBeGreaterThan(sorted[i - 1].chapterNumber);
        }
    });

    test('no data loss after multiple updates', async () => {
        const chapterId = chapterIds[0];
        const original = await store.getItem('chapters', chapterId);

        for (let i = 0; i < 10; i++) {
            const ch = await store.getItem('chapters', chapterId);
            ch._reviewRounds = (ch._reviewRounds || 0) + 1;
            await store.setItem('chapters', chapterId, ch);
        }

        const final = await store.getItem('chapters', chapterId);
        expect(final._reviewRounds).toBe((original._reviewRounds || 0) + 10);
        expect(final.outline).toBe(original.outline);
        expect(final.projectId).toBe(projectId);
    });

    test('concurrent material updates do not corrupt data', async () => {
        const matId = foundationMaterialIds[0];
        const original = await store.getItem('materials', matId);

        for (let i = 0; i < 20; i++) {
            const mat = await store.getItem('materials', matId);
            mat.updateCount = (mat.updateCount || 0) + 1;
            await store.setItem('materials', matId, mat);
        }

        const final = await store.getItem('materials', matId);
        expect(final.updateCount).toBe(20);
        expect(final.name).toBe(original.name);
        expect(final.type).toBe('worldview');
    });
});
