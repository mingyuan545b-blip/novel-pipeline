/**
 * properNounGuard 单测（D2-b 反趋同·专名禁令）+ 提取链路接线验证
 */
const { hasProperNounSignal } = require('../../server/services/properNounGuard');
const parse = require('../../server/services/libraryExtractParse');
const { getDimension } = require('../../server/config/libraryExtractDimensions');

describe('hasProperNounSignal（以名称特征为主，不靠长词表）', () => {
    test('书名号/引号包裹 → 命中', () => {
        expect(hasProperNounSignal('《死亡高考》评分制')).toBe(true);
        expect(hasProperNounSignal('「压力倒计时」')).toBe(true);
    });
    test('纯 ASCII（外来名/罗马字）→ 命中', () => {
        expect(hasProperNounSignal('dragonball')).toBe(true);
        expect(hasProperNounSignal('ABC12')).toBe(true);
    });
    test('正常中文技法名 → 不命中', () => {
        expect(hasProperNounSignal('压力倒计时可视化')).toBe(false);
        expect(hasProperNounSignal('配角私心先行')).toBe(false);
    });
    test('空值安全', () => {
        expect(hasProperNounSignal('')).toBe(false);
        expect(hasProperNounSignal(null)).toBe(false);
    });
});

describe('提取链路接线（libraryExtractParse）', () => {
    const DIM = getDimension('pressure');
    const base = {
        definition: '把不可见的压力换算成读者能自己计算的刻度',
        implementation_rules: ['给出明确数值', '数值随时间收紧'],
    };
    test('含专名信号的技法名 → 判废', () => {
        expect(parse.normalizeTechnique({ ...base, name: '《死亡高考》评分制' }, DIM)).toBeNull();
        expect(parse.normalizeTechnique({ ...base, name: 'kamehameha' }, DIM)).toBeNull();
    });
    test('正常名 → 保留（行为与旧正则一致）', () => {
        expect(parse.normalizeTechnique({ ...base, name: '压力倒计时' }, DIM)).not.toBeNull();
    });
});
