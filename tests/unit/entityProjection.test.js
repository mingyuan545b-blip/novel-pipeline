/**
 * S4：实体投影单一源 + merge 占位/空值保护（P1-D）
 */
jest.mock('../../server/store', () => ({ getItem: jest.fn(), setItem: jest.fn(), queryItems: jest.fn() }));
jest.mock('../../server/services/entityRegistry', () => ({ registerEntity: jest.fn(async () => {}) }));
jest.mock('../../server/shared/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));

const store = require('../../server/store');
const { mergeExistingEntity } = require('../../server/services/entityCenter/entityBehaviorRules');
const { buildCharacterEntityPatch } = require('../../server/services/pipeline/entityProjection');
const { hasMeaningfulValue } = require('../../server/shared/fieldValueGuards');

describe('S4 字段值护卫', () => {
    test('占位/空值判定', () => {
        for (const v of ['', '无', '无 | 无', 'n/a', 'N/A', [], {}, null, undefined]) expect(hasMeaningfulValue(v)).toBe(false);
        for (const v of ['冷厉', 0, false, ['a']]) expect(hasMeaningfulValue(v)).toBe(true);
    });
});

describe('S4 buildCharacterEntityPatch（单一投影）', () => {
    test('素材优先、解析兜底、占位不入选', () => {
        const patch = buildCharacterEntityPatch(
            { personality: '无 | 无', speakingTone: '冷厉', profile: { innerConflict: '复仇 vs 良知' } },
            { personality: '外柔内刚', craftStyle: '白描' }
        );
        expect(patch.personality).toBe('外柔内刚');       // 占位跳过 → 取解析兜底
        expect(patch.speakingTone).toBe('冷厉');
        expect(patch.craftStyle).toBe('白描');
        expect(patch.profile.innerConflict).toBe('复仇 vs 良知');
    });

    test('可从状态增量构建补丁（深键进 profile）', () => {
        const patch = buildCharacterEntityPatch({ signatureDetail: '左手旧伤', fateArc: '从孤狼到守护' });
        expect(patch.signatureDetail).toBe('左手旧伤');
        expect(patch.profile.fateArc).toBe('从孤狼到守护');
    });
});

describe('S4 mergeExistingEntity 占位保护', () => {
    test('占位/空值不覆盖已有好值，有意义的新值才填充', async () => {
        const existing = {
            id: 'e1', projectId: 'p1', name: '林婉', personality: '外柔内刚', speakingTone: '温柔',
            profile: { innerConflict: '家族的期望 vs 自我' }, lastAppearChapter: 1
        };
        store.getItem.mockResolvedValue({ ...existing });
        store.setItem.mockResolvedValue(undefined);

        await mergeExistingEntity({}, existing, {
            personality: '无 | 无',      // 占位 → 不覆盖
            speakingTone: '',            // 空 → 不覆盖
            position: '账房先生',         // 有意义 → 填充
            profile: { innerConflict: '无', fateArc: '觉醒' }
        });

        const saved = store.setItem.mock.calls.find(c => c[0] === 'entities')[2];
        expect(saved.personality).toBe('外柔内刚');
        expect(saved.speakingTone).toBe('温柔');
        expect(saved.position).toBe('账房先生');
        expect(saved.profile.innerConflict).toBe('家族的期望 vs 自我');
        expect(saved.profile.fateArc).toBe('觉醒');
    });

    test('全部为占位/无意义 → 不触发写入', async () => {
        const existing = { id: 'e2', projectId: 'p1', name: '甲', personality: '刚' };
        store.getItem.mockClear();
        store.setItem.mockClear();
        await mergeExistingEntity({}, existing, { personality: '无 | 无', speakingTone: '' });
        expect(store.setItem).not.toHaveBeenCalled();
    });
});
