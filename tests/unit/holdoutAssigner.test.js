/**
 * holdoutAssigner 单测（D3-a 留出集）
 */
const { hashInt, bucketOf, isHoldout, DEFAULT_BUCKETS } = require('../../server/services/holdoutAssigner');

describe('确定性', () => {
    test('同输入 → 同结果（可复现）', () => {
        expect(bucketOf('p1', 7)).toBe(bucketOf('p1', 7));
        expect(isHoldout('p1', 7)).toBe(isHoldout('p1', 7));
    });
    test('不同 projectId/章节 → 一般不落同桶（哈希分散）', () => {
        expect(bucketOf('p1', 1)).not.toBe(bucketOf('p2', 1));
    });
    test('桶号在 [0,buckets) 内', () => {
        for (let ch = 1; ch <= 50; ch++) {
            const b = bucketOf('proj', ch, 10);
            expect(b).toBeGreaterThanOrEqual(0);
            expect(b).toBeLessThan(DEFAULT_BUCKETS);
        }
    });
    test('hashInt 稳定且非负', () => {
        expect(hashInt('abc')).toBe(hashInt('abc'));
        expect(hashInt('abc')).toBeGreaterThanOrEqual(0);
    });
});

describe('比例', () => {
    test('ratio=0 → 无 holdout；ratio=1 → 全部 holdout', () => {
        for (let ch = 1; ch <= 20; ch++) {
            expect(isHoldout('p', ch, { ratio: 0 })).toBe(false);
            expect(isHoldout('p', ch, { ratio: 1 })).toBe(true);
        }
    });
    test('非法 ratio 回落默认（0.2）且不抛', () => {
        expect(typeof isHoldout('p', 1, { ratio: NaN })).toBe('boolean');
        expect(isHoldout('p', 1, { ratio: 5 })).toBe(isHoldout('p', 1, { ratio: 1 }));
    });
    test('比例单调：0.3 的留出 ≥ 0.1 的留出', () => {
        const count = (r) => { let n = 0; for (let ch = 1; ch <= 100; ch++) if (isHoldout('p', ch, { ratio: r })) n++; return n; };
        expect(count(0.3)).toBeGreaterThanOrEqual(count(0.1));
    });
});
