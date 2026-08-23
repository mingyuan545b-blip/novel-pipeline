const { shouldOverrideReviewRejection } = require('../../server/services/pipeline/reviewOverride');

// 注意: shouldOverrideReviewRejection 是 async 函数（陷阱#43 override治理改造）
// 所有调用必须 await，所有 test 回调必须 async

describe('reviewOverride - word count hallucination override', () => {
    test('should override when system word count meets threshold but LLM says insufficient', async () => {
        const stepResult = {
            passed: false,
            feedback: { summary: '字数不足，低于最低要求2200字', issues: [] }
        };
        const result = await shouldOverrideReviewRejection(stepResult, 'content', 3000, 2200, [], {});
        expect(result.override).toBe(true);
        expect(result.reason).toContain('幻觉');
        expect(result.reason).toContain('3000');
        expect(result.reason).toContain('2200');
    });

    test('should override when feedback mentions 字数硬拦截', async () => {
        const stepResult = {
            passed: false,
            feedback: { summary: '字数硬拦截', scheduleNote: '', issues: [] }
        };
        const result = await shouldOverrideReviewRejection(stepResult, 'content', 2500, 2200, [], {});
        expect(result.override).toBe(true);
    });

    test('should override when feedback mentions 低于X字', async () => {
        const stepResult = {
            passed: false,
            feedback: { summary: '低于2200字', issues: [] }
        };
        const result = await shouldOverrideReviewRejection(stepResult, 'content', 2800, 2200, [], {});
        expect(result.override).toBe(true);
    });

    test('should not override when system word count is below threshold', async () => {
        const stepResult = {
            passed: false,
            feedback: { summary: '字数不足，低于最低要求', issues: [] }
        };
        const result = await shouldOverrideReviewRejection(stepResult, 'content', 1500, 2200, [], {});
        expect(result.override).toBe(false);
    });

    test('should not override when word count is not the rejection reason', async () => {
        const stepResult = {
            passed: false,
            feedback: { summary: '情节不够紧凑', issues: [] }
        };
        const result = await shouldOverrideReviewRejection(stepResult, 'content', 3000, 2200, [], {});
        expect(result.override).toBe(false);
    });
});

describe('reviewOverride - dialect misjudgment override', () => {
    test('should override when review says dialect is non-standard and project has dialect characters', async () => {
        const stepResult = {
            passed: false,
            feedback: { summary: '方言使用不符合规范', issues: [] }
        };
        const materials = [{ type: 'character', dialectRegion: '河南' }];
        const result = await shouldOverrideReviewRejection(stepResult, 'content', 3000, 2200, materials, {});
        expect(result.override).toBe(true);
        expect(result.reason).toContain('误判');
    });

    test('should override when review says 方言错误', async () => {
        const stepResult = {
            passed: false,
            feedback: { summary: '方言错误', issues: [] }
        };
        const materials = [{ type: 'character', dialectRegion: '四川' }];
        const result = await shouldOverrideReviewRejection(stepResult, 'content', 3000, 2200, materials, {});
        expect(result.override).toBe(true);
    });

    test('should override when review says 口音不对', async () => {
        const stepResult = {
            passed: false,
            feedback: { summary: '口音不对', issues: [] }
        };
        const materials = [{ type: 'character', dialectRegion: '东北' }];
        const result = await shouldOverrideReviewRejection(stepResult, 'content', 3000, 2200, materials, {});
        expect(result.override).toBe(true);
    });

    test('should not override dialect when no characters have dialect set', async () => {
        const stepResult = {
            passed: false,
            feedback: { summary: '方言不规范', issues: [] }
        };
        const materials = [{ type: 'character', name: '张三' }];
        const result = await shouldOverrideReviewRejection(stepResult, 'content', 3000, 2200, materials, {});
        expect(result.override).toBe(false);
    });

    test('should not override dialect when materials array is empty', async () => {
        const stepResult = {
            passed: false,
            feedback: { summary: '方言不规范', issues: [] }
        };
        const result = await shouldOverrideReviewRejection(stepResult, 'content', 3000, 2200, [], {});
        expect(result.override).toBe(false);
    });
});

describe('reviewOverride - style misjudgment override', () => {
    test('should override when review says style is inappropriate and project has styled characters', async () => {
        const stepResult = {
            passed: false,
            feedback: { summary: '说话风格不当', issues: [] }
        };
        const materials = [{ type: 'character', speechStyle: 'abstract' }];
        const result = await shouldOverrideReviewRejection(stepResult, 'content', 3000, 2200, materials, {});
        expect(result.override).toBe(true);
        expect(result.reason).toContain('风格');
    });

    test('should override when review says 语气不严肃', async () => {
        const stepResult = {
            passed: false,
            feedback: { summary: '语气不严肃', issues: [] }
        };
        const materials = [{ type: 'character', speechStyle: 'crazy' }];
        const result = await shouldOverrideReviewRejection(stepResult, 'content', 3000, 2200, materials, {});
        expect(result.override).toBe(true);
    });

    test('should override when review says 风格违和', async () => {
        const stepResult = {
            passed: false,
            feedback: { summary: '风格违和', issues: [] }
        };
        const materials = [{ type: 'character', speechStyle: 'chuunibyou' }];
        const result = await shouldOverrideReviewRejection(stepResult, 'content', 3000, 2200, materials, {});
        expect(result.override).toBe(true);
    });

    test('should not override style when no characters have speech style set', async () => {
        const stepResult = {
            passed: false,
            feedback: { summary: '说话风格不当', issues: [] }
        };
        const materials = [{ type: 'character', name: '李四' }];
        const result = await shouldOverrideReviewRejection(stepResult, 'content', 3000, 2200, materials, {});
        expect(result.override).toBe(false);
    });
});

describe('reviewOverride - humor misjudgment override', () => {
    test('should override when review says humor is excessive in comedy genre', async () => {
        const stepResult = {
            passed: false,
            feedback: { summary: '幽默过度', issues: [] }
        };
        const project = { styleProfile: { genreLabel: '反套路喜剧' } };
        const result = await shouldOverrideReviewRejection(stepResult, 'content', 3000, 2200, [], project);
        expect(result.override).toBe(true);
        expect(result.reason).toContain('反套路喜剧');
    });

    test('should override when review says 搞笑过多 in comedy genre', async () => {
        const stepResult = {
            passed: false,
            feedback: { summary: '搞笑过多', issues: [] }
        };
        const project = { styleProfile: { genreLabel: '搞笑日常' } };
        const result = await shouldOverrideReviewRejection(stepResult, 'content', 3000, 2200, [], project);
        expect(result.override).toBe(true);
    });

    test('should override when review says 吐槽过多 in comedy genre', async () => {
        const stepResult = {
            passed: false,
            feedback: { summary: '吐槽过多', issues: [] }
        };
        const project = { styleProfile: { genreLabel: '爽文' } };
        const result = await shouldOverrideReviewRejection(stepResult, 'content', 3000, 2200, [], project);
        expect(result.override).toBe(true);
    });

    test('should not override humor in non-comedy genre', async () => {
        const stepResult = {
            passed: false,
            feedback: { summary: '幽默过度', issues: [] }
        };
        const project = { styleProfile: { genreLabel: '严肃正剧' } };
        const result = await shouldOverrideReviewRejection(stepResult, 'content', 3000, 2200, [], project);
        expect(result.override).toBe(false);
    });

    test('should not override humor when project has no genre label', async () => {
        const stepResult = {
            passed: false,
            feedback: { summary: '幽默过度', issues: [] }
        };
        const result = await shouldOverrideReviewRejection(stepResult, 'content', 3000, 2200, [], {});
        expect(result.override).toBe(false);
    });
});

describe('reviewOverride - red line violations should not be overridden', () => {
    test('should not override when 方括号标签 violation exists', async () => {
        const stepResult = {
            passed: false,
            feedback: { summary: '使用了方括号标签格式', issues: [] }
        };
        const result = await shouldOverrideReviewRejection(stepResult, 'content', 3000, 2200, [], {});
        expect(result.override).toBe(false);
    });

    test('should not override when 视角跳跃 violation exists', async () => {
        const stepResult = {
            passed: false,
            feedback: { summary: '存在视角跳跃问题', issues: [] }
        };
        const result = await shouldOverrideReviewRejection(stepResult, 'content', 3000, 2200, [], {});
        expect(result.override).toBe(false);
    });

    test('should not override when 情节断裂 violation exists', async () => {
        const stepResult = {
            passed: false,
            feedback: { summary: '情节断裂严重', issues: [] }
        };
        const result = await shouldOverrideReviewRejection(stepResult, 'content', 3000, 2200, [], {});
        expect(result.override).toBe(false);
    });

    test('should not override when 术语错误 violation exists alongside dialect', async () => {
        const stepResult = {
            passed: false,
            feedback: { summary: '方言不规范且术语错误', issues: [] }
        };
        const materials = [{ type: 'character', dialectRegion: '河南' }];
        const result = await shouldOverrideReviewRejection(stepResult, 'content', 3000, 2200, materials, {});
        expect(result.override).toBe(false);
    });

    test('should not override when dialect misjudgment coexists with 视角跳跃', async () => {
        const stepResult = {
            passed: false,
            feedback: { summary: '方言不规范且视角跳跃', issues: [] }
        };
        const materials = [{ type: 'character', dialectRegion: '河南' }];
        const result = await shouldOverrideReviewRejection(stepResult, 'content', 3000, 2200, materials, {});
        expect(result.override).toBe(false);
    });

    test('should not override when style misjudgment coexists with 严重逻辑 violation', async () => {
        const stepResult = {
            passed: false,
            feedback: { summary: '说话风格不当且严重逻辑错误', issues: [] }
        };
        const materials = [{ type: 'character', speechStyle: 'abstract' }];
        const result = await shouldOverrideReviewRejection(stepResult, 'content', 3000, 2200, materials, {});
        expect(result.override).toBe(false);
    });

    test('should not override when humor misjudgment coexists with 关键矛盾', async () => {
        const stepResult = {
            passed: false,
            feedback: { summary: '幽默过度且关键矛盾', issues: [] }
        };
        const project = { styleProfile: { genreLabel: '喜剧' } };
        const result = await shouldOverrideReviewRejection(stepResult, 'content', 3000, 2200, [], project);
        expect(result.override).toBe(false);
    });
});

describe('reviewOverride - edge cases', () => {
    test('should return no override when stepResult is null', async () => {
        const result = await shouldOverrideReviewRejection(null, 'content', 3000, 2200, [], {});
        expect(result.override).toBe(false);
    });

    test('should return no override when stepResult has passed=true', async () => {
        const stepResult = { passed: true, feedback: {} };
        const result = await shouldOverrideReviewRejection(stepResult, 'content', 3000, 2200, [], {});
        expect(result.override).toBe(false);
    });

    test('should return no override when feedback is empty', async () => {
        const stepResult = { passed: false, feedback: {} };
        const result = await shouldOverrideReviewRejection(stepResult, 'content', 3000, 2200, [], {});
        expect(result.override).toBe(false);
    });

    test('should handle issues as objects with desc field', async () => {
        const stepResult = {
            passed: false,
            feedback: { summary: '', issues: [{ desc: '方言不规范' }] }
        };
        const materials = [{ type: 'character', dialectRegion: '四川' }];
        const result = await shouldOverrideReviewRejection(stepResult, 'content', 3000, 2200, materials, {});
        expect(result.override).toBe(true);
    });

    test('should handle issues as objects with description field', async () => {
        const stepResult = {
            passed: false,
            feedback: { summary: '', issues: [{ description: '方言不规范' }] }
        };
        const materials = [{ type: 'character', dialectRegion: '四川' }];
        const result = await shouldOverrideReviewRejection(stepResult, 'content', 3000, 2200, materials, {});
        expect(result.override).toBe(true);
    });

    test('should handle issues as strings', async () => {
        const stepResult = {
            passed: false,
            feedback: { summary: '', issues: ['方言不规范'] }
        };
        const materials = [{ type: 'character', dialectRegion: '四川' }];
        const result = await shouldOverrideReviewRejection(stepResult, 'content', 3000, 2200, materials, {});
        expect(result.override).toBe(true);
    });

    test('should combine summary and scheduleNote for text analysis', async () => {
        const stepResult = {
            passed: false,
            feedback: { summary: '', scheduleNote: '方言不规范', issues: [] }
        };
        const materials = [{ type: 'character', dialectRegion: '河南' }];
        const result = await shouldOverrideReviewRejection(stepResult, 'content', 3000, 2200, materials, {});
        expect(result.override).toBe(true);
    });

    test('should not override for generic quality issues', async () => {
        const stepResult = {
            passed: false,
            feedback: { summary: '叙事节奏偏慢，需要加快', issues: [] }
        };
        const result = await shouldOverrideReviewRejection(stepResult, 'content', 3000, 2200, [], {});
        expect(result.override).toBe(false);
    });

    test('should not override when systemWordCount or rejectMinWords is missing for word count check', async () => {
        const stepResult = {
            passed: false,
            feedback: { summary: '字数不足', issues: [] }
        };
        const result = await shouldOverrideReviewRejection(stepResult, 'content', null, 2200, [], {});
        expect(result.override).toBe(false);
    });
});

describe('reviewOverride - keyword proximity check', () => {
    test('should not match when topic and issue keywords are far apart (>200 chars)', async () => {
        const padding = '这是一段很长的审核文本用于填充距离以确保关键词间距超过200字符'.repeat(10);
        const stepResult = {
            passed: false,
            feedback: { summary: `风格${padding}不自然`, issues: [] }
        };
        const materials = [{ type: 'character', speechStyle: 'abstract' }];
        const result = await shouldOverrideReviewRejection(stepResult, 'content', 3000, 2200, materials, {});
        expect(result.override).toBe(false);
    });

    test('should match when topic and issue keywords are close (within 200 chars)', async () => {
        const stepResult = {
            passed: false,
            feedback: { summary: '说话风格不自然', issues: [] }
        };
        const materials = [{ type: 'character', speechStyle: 'abstract' }];
        const result = await shouldOverrideReviewRejection(stepResult, 'content', 3000, 2200, materials, {});
        expect(result.override).toBe(true);
    });

    test('should not match dialect override when dialect and issue keywords are far apart', async () => {
        const padding = '这是一段很长的审核文本用于填充距离以确保关键词间距超过200字符'.repeat(10);
        const stepResult = {
            passed: false,
            feedback: { summary: `方言${padding}不规范`, issues: [] }
        };
        const materials = [{ type: 'character', dialectRegion: '河南' }];
        const result = await shouldOverrideReviewRejection(stepResult, 'content', 3000, 2200, materials, {});
        expect(result.override).toBe(false);
    });

    test('should match dialect override when keywords are close', async () => {
        const stepResult = {
            passed: false,
            feedback: { summary: '方言不规范', issues: [] }
        };
        const materials = [{ type: 'character', dialectRegion: '河南' }];
        const result = await shouldOverrideReviewRejection(stepResult, 'content', 3000, 2200, materials, {});
        expect(result.override).toBe(true);
    });
});
