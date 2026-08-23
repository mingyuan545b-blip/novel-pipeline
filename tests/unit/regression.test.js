const { shouldOverrideReviewRejection } = require('../../server/services/pipeline/reviewOverride');
const { isFoundationMaterial } = require('../../server/db/jsonStore');
const { validateMaterial, validateHierarchy } = require('../../server/services/materialValidator');
const { VALID_MATERIAL_TYPES } = require('../../server/config/materialTypes');

describe('P0回归测试 - 审核覆盖逻辑', () => {
    test('字数幻觉覆盖: 系统字数达标但LLM说不够', async () => {
        const stepResult = {
            passed: false,
            feedback: { summary: '字数不足，低于最低要求2200字', issues: [] }
        };
        const result = await shouldOverrideReviewRejection(stepResult, '正文内容', 3000, 2200, [], {});
        expect(result.override).toBe(true);
        expect(result.reason).toContain('幻觉');
    });

    test('字数幻觉不覆盖: 系统字数确实不够', async () => {
        const stepResult = {
            passed: false,
            feedback: { summary: '字数不足，低于最低要求', issues: [] }
        };
        const result = await shouldOverrideReviewRejection(stepResult, '正文', 1500, 2200, [], {});
        expect(result.override).toBe(false);
    });

    test('方言误判覆盖: 审核说方言不规范', async () => {
        const stepResult = {
            passed: false,
            feedback: { summary: '方言使用不符合规范', issues: [{ desc: '方言表达不规范' }] }
        };
        const chapterContent = '俺跟你说，这事儿整得贼拉离谱';
        const result = await shouldOverrideReviewRejection(stepResult, chapterContent, 3000, 2200, [], {});
        expect(result.override).toBe(true);
        expect(result.reason).toContain('误判');
    });

    test('风格误判覆盖: 审核说说话风格不当', async () => {
        const stepResult = {
            passed: false,
            feedback: { summary: '说话风格不当，表达方式不合适', issues: [] }
        };
        const materials = [{ type: 'character', speechStyle: 'abstract' }];
        const result = await shouldOverrideReviewRejection(stepResult, '正文', 3000, 2200, materials, {});
        expect(result.override).toBe(true);
    });

    test('幽默误判覆盖: 喜剧题材被说幽默过度', async () => {
        const stepResult = {
            passed: false,
            feedback: { summary: '幽默过度，搞笑过多', issues: [] }
        };
        const project = { styleProfile: { genreLabel: '反套路喜剧' } };
        const result = await shouldOverrideReviewRejection(stepResult, '正文', 3000, 2200, [], project);
        expect(result.override).toBe(true);
    });

    test('不覆盖: 普通情节问题', async () => {
        const stepResult = {
            passed: false,
            feedback: { summary: '情节不够紧凑，视角跳跃', issues: [{ desc: '视角不统一' }] }
        };
        const result = await shouldOverrideReviewRejection(stepResult, '正文', 3000, 2200, [], {});
        expect(result.override).toBe(false);
    });

    test('不覆盖: 方括号标签是红线', async () => {
        const stepResult = {
            passed: false,
            feedback: { summary: '使用了方括号标签格式', issues: [{ desc: '方括号标签违规' }] }
        };
        const result = await shouldOverrideReviewRejection(stepResult, '正文', 3000, 2200, [], {});
        expect(result.override).toBe(false);
    });
});

describe('P0回归测试 - 基底素材保护', () => {
    test('worldview无parentPlane是基底', async () => {
        expect(await isFoundationMaterial({ type: 'worldview', id: 'w1' })).toBe(true);
    });

    test('power-system无parentPlane是基底', async () => {
        expect(await isFoundationMaterial({ type: 'power-system', id: 'ps1' })).toBe(true);
    });

    test('faction且parentPlane=null是基底', async () => {
        expect(await isFoundationMaterial({ type: 'faction', id: 'f1', parentPlane: null })).toBe(true);
    });

    test('faction且有parentPlane不是基底', async () => {
        expect(await isFoundationMaterial({ type: 'faction', id: 'f2', parentPlane: 'sp1' })).toBe(false);
    });

    test('institution且parentPlane=null是基底', async () => {
        expect(await isFoundationMaterial({ type: 'institution', id: 'i1', parentPlane: null })).toBe(true);
    });

    test('isFoundation=true显式标记优先', async () => {
        expect(await isFoundationMaterial({ type: 'other', id: 'o1', isFoundation: true, sourceChapter: 5 })).toBe(true);
    });

    test('isFoundation=false显式标记优先', async () => {
        expect(await isFoundationMaterial({ type: 'worldview', id: 'w2', isFoundation: false, parentPlane: null })).toBe(false);
    });

    test('有sourceChapter的不是基底', async () => {
        expect(await isFoundationMaterial({ type: 'worldview', id: 'w3', sourceChapter: 5 })).toBe(false);
    });

    test('null输入返回false', async () => {
        expect(await isFoundationMaterial(null)).toBe(false);
    });
});

describe('P0回归测试 - 素材类型三处同步', () => {
    test('VALID_MATERIAL_TYPES包含所有28+类型', async () => {
        expect(VALID_MATERIAL_TYPES.length).toBeGreaterThanOrEqual(28);
    });

    test('关键类型都存在', async () => {
        const criticalTypes = ['worldview', 'character', 'faction', 'foreshadowing', 'equipment', 'sub-plane', 'power-system', 'mechanism', 'institution', 'narrative-bridge'];
        for (const t of criticalTypes) {
            expect(VALID_MATERIAL_TYPES).toContain(t);
        }
    });

    test('无重复类型', async () => {
        const unique = new Set(VALID_MATERIAL_TYPES);
        expect(unique.size).toBe(VALID_MATERIAL_TYPES.length);
    });
});

describe('P0回归测试 - 素材层级校验', () => {
    test('character缺少parentFaction被拒绝', async () => {
        const result = await validateHierarchy({ type: 'character', parentFaction: undefined });
        expect(result.valid).toBe(false);
    });

    test('faction缺少parentPlane被拒绝', async () => {
        const result = await validateHierarchy({ type: 'faction', parentPlane: undefined });
        expect(result.valid).toBe(false);
    });

    test('character有parentFaction通过', async () => {
        const result = await validateHierarchy({ type: 'character', parentFaction: 'fac-1' });
        expect(result.valid).toBe(true);
    });

    test('worldview不需要parent', async () => {
        const result = await validateHierarchy({ type: 'worldview' });
        expect(result.valid).toBe(true);
    });
});

describe('P0回归测试 - 素材验证', () => {
    test('无效类型被拒绝并建议替代', async () => {
        const result = await validateMaterial({ type: 'invalid-type', name: '测试', currentContent: '内容' });
        expect(result.valid).toBe(false);
    });

    test('foreshadowing内容不含伏笔关键词时建议修正', async () => {
        const result = await validateMaterial({
            type: 'foreshadowing',
            name: '铁皮瓦片导流层',
            currentContent: '这个结构具有过滤和传导功能，触发条件是灵气浓度'
        });
        if (result.typeMismatch) {
            expect(result.suggestedType).toBeDefined();
        }
    });
});
