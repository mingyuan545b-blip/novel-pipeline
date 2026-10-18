/**
 * techniqueKey 单测（D2-a 原子化合成键）+ 提取原子去重
 */
const { atomicKey, isSameAtomic, coreOf } = require('../../server/services/techniqueKey');
const { isAtomicDuplicate } = require('../../server/services/techniqueExtraction');

describe('atomicKey / coreOf', () => {
    test('去噪 + 去虚词 → 语义核稳定', () => {
        expect(coreOf('压力倒计时（可视化）')).toBe('压力倒计时可视化');
        expect(coreOf('危机 的 感官·窄化')).toBe('危机感官窄化');
    });
    test('合成键 = 部门|子类|语义核', () => {
        const k = atomicKey({ department: '02_情节引擎部', subcategory: '02_悬念编码', display_name: '压力倒计时可视化' });
        expect(k).toBe('02_情节引擎部|02_悬念编码|压力倒计时可视化');
    });
    test('空输入安全', () => {
        expect(atomicKey(null)).toBe('');
        expect(atomicKey({})).toBe('||');
    });
});

describe('isSameAtomic', () => {
    const a = atomicKey({ department: '2部', subcategory: '悬念', display_name: '压力倒计时可视化' });
    test('同分类同核 → 相同', () => {
        const b = atomicKey({ department: '2部', subcategory: '悬念', display_name: '压力倒计时（可视化）' });
        expect(isSameAtomic(a, b)).toBe(true);
    });
    test('不同部门 → 不同（不跨类合并）', () => {
        const c = atomicKey({ department: '3部', subcategory: '悬念', display_name: '压力倒计时可视化' });
        expect(isSameAtomic(a, c)).toBe(false);
    });
    test('同分类核互相包含（≥4字）→ 视为同一原子', () => {
        const d = atomicKey({ department: '2部', subcategory: '悬念', display_name: '压力倒计时可视化节奏' });
        expect(isSameAtomic(a, d)).toBe(true);
    });
    test('短核（<4字）不靠包含判定，避免误并', () => {
        const x = atomicKey({ department: '2部', subcategory: '悬念', display_name: '钩子' });
        const y = atomicKey({ department: '2部', subcategory: '悬念', display_name: '钩子手' });
        expect(isSameAtomic(x, y)).toBe(false);
    });
});

describe('isAtomicDuplicate（提取去重接线）', () => {
    test('同原子键 → 判重', () => {
        const seen = [atomicKey({ department: '2部', subcategory: '悬念', display_name: '压力倒计时可视化' })];
        const t = { department: '2部', subcategory: '悬念', display_name: '压力倒计时可视化' };
        expect(isAtomicDuplicate(t, seen)).toBe(true);
    });
    test('新原子 → 不判重', () => {
        const seen = [atomicKey({ department: '2部', subcategory: '悬念', display_name: '压力倒计时可视化' })];
        const t = { department: '2部', subcategory: '悬念', display_name: '配角私心先行' };
        expect(isAtomicDuplicate(t, seen)).toBe(false);
    });
});
