/**
 * carryOutGate 单元测试 — 副本带出判定与渠道标签
 * 依据：docs/design/实体中心-副本归属与带出机制.md
 */
const { CARRY_OUT_POLICIES, buildWorld, validateWorld } = require('../../server/services/worldConstants');
const {
    evaluateCarryOut, validateChannelTag, buildChannelTag, resolvePolicy, detectCarryOutViolation
} = require('../../server/services/carryOutGate');

const entity = { name: '小白' };

describe('worldConstants — 带出策略', () => {
    test('CARRY_OUT_POLICIES 含 6 种策略', () => {
        expect(Object.keys(CARRY_OUT_POLICIES).sort()).toEqual(
            ['item', 'locked', 'medium', 'native', 'permission', 'plot']
        );
    });
    test('buildWorld 默认 carryOutPolicy=native 且带 exitMethod/channelTag', () => {
        const w = buildWorld();
        expect(w.carryOutPolicy).toBe('native');
        expect(w.exitMethod).toBe('自然离开');
        expect(w.channelTag).toBe('');
    });
    test('validateWorld 拒绝非法 carryOutPolicy', () => {
        expect(validateWorld(buildWorld({ carryOutPolicy: 'nope' }))).toEqual(
            expect.arrayContaining([expect.stringContaining('carryOutPolicy')])
        );
        expect(validateWorld(buildWorld({ carryOutPolicy: 'medium' }))).toEqual([]);
    });
});

describe('resolvePolicy', () => {
    test('缺省 → native；非法 → __invalid__', () => {
        expect(resolvePolicy({})).toBe('native');
        expect(resolvePolicy(null)).toBe('native');
        expect(resolvePolicy({ carryOutPolicy: 'bogus' })).toBe('__invalid__');
    });
});

describe('evaluateCarryOut', () => {
    test('native 允许带出', () => {
        const r = evaluateCarryOut(entity, { carryOutPolicy: 'native' });
        expect(r.allowed).toBe(true);
        expect(r.requires).toEqual({});
    });
    test('locked 拒绝带出', () => {
        expect(evaluateCarryOut(entity, { carryOutPolicy: 'locked' }).allowed).toBe(false);
    });
    test('medium：无媒介拒绝，有媒介放行', () => {
        const world = { carryOutPolicy: 'medium' };
        const denied = evaluateCarryOut(entity, world, {});
        expect(denied.allowed).toBe(false);
        expect(denied.requires).toEqual({ medium: true });
        expect(evaluateCarryOut(entity, world, { medium: '养魂木' }).allowed).toBe(true);
    });
    test('item / permission / plot 各自凭据', () => {
        expect(evaluateCarryOut(entity, { carryOutPolicy: 'item' }, { item: '钥匙' }).allowed).toBe(true);
        expect(evaluateCarryOut(entity, { carryOutPolicy: 'permission' }, { permission: '内门' }).allowed).toBe(true);
        expect(evaluateCarryOut(entity, { carryOutPolicy: 'permission' }, { item: '钥匙' }).allowed).toBe(false);
        expect(evaluateCarryOut(entity, { carryOutPolicy: 'plot' }, {}).allowed).toBe(false);
        expect(evaluateCarryOut(entity, { carryOutPolicy: 'plot' }, { plotGrant: true }).allowed).toBe(true);
    });
    test('非法策略保守拒绝', () => {
        expect(evaluateCarryOut(entity, { carryOutPolicy: 'zzz' }).allowed).toBe(false);
    });
});

describe('validateChannelTag', () => {
    test('native/locked 不强制渠道标签', () => {
        expect(validateChannelTag({ carryOutPolicy: 'native' }).valid).toBe(true);
        expect(validateChannelTag({ carryOutPolicy: 'locked' }).valid).toBe(true);
    });
    test('非 native 策略必须有 channelTag', () => {
        expect(validateChannelTag({ carryOutPolicy: 'medium' }).valid).toBe(false);
        expect(validateChannelTag({ carryOutPolicy: 'medium', channelTag: '秘境·白骨道' }).valid).toBe(true);
    });
});

describe('buildChannelTag', () => {
    test('无标签返回占位', () => {
        expect(buildChannelTag({})).toBe('未定义渠道');
    });
    test('拼接媒介/道具/权限', () => {
        expect(buildChannelTag({ channelTag: '白骨道' }, { medium: '养魂木' })).toBe('白骨道·媒介:养魂木');
        expect(buildChannelTag({ channelTag: '白骨道' }, { item: '钥匙', permission: '内门' }))
            .toBe('白骨道·道具:钥匙·权限:内门');
    });
});

describe('detectCarryOutViolation（软门禁）', () => {
    const worlds = [
        { id: 'main-world', name: '主世界', carryOutPolicy: 'native' },
        { id: 'dungeon-1', name: '白骨道', carryOutPolicy: 'medium', channelTag: '白骨道' }
    ];
    test('native 世界不报违规', () => {
        expect(detectCarryOutViolation(worlds, { character: 'A', from: 'main-world', to: 'main-world' })).toBeNull();
    });
    test('回主世界且源副本需凭据、无 channel → 违规', () => {
        const v = detectCarryOutViolation(worlds, { character: '小白', from: 'dungeon-1', to: 'main-world' });
        expect(v).not.toBeNull();
        expect(v.entity).toBe('小白');
        expect(v.description).toContain('渠道标签');
    });
    test('带 channel → 不报违规', () => {
        expect(detectCarryOutViolation(worlds, { character: '小白', from: 'dungeon-1', to: 'main-world', channel: '白骨道' })).toBeNull();
    });
    test('非回主世界不校验', () => {
        expect(detectCarryOutViolation(worlds, { character: 'A', from: 'dungeon-1', to: 'dungeon-2' })).toBeNull();
    });
});
