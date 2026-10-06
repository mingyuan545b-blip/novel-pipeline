/**
 * knowledgeUtils — 确信度分组（限知树状视图的一级维度）
 */
import { groupByConfidence, groupKnowledge, groupByCategory, confidenceMeta } from '../../pages/entitycenter/knowledgeUtils';

const rec = (id, confidence, factText, entityId = 'e1') => ({ id, confidence, factText, entityId, sourceHow: 'witnessed' });

describe('confidenceMeta', () => {
    test('known keys map to label/color', () => {
        expect(confidenceMeta('certain').label).toBe('确信');
        expect(confidenceMeta('suspect').color).toBeTruthy();
    });
    test('unknown confidence falls back to 未知', () => {
        expect(confidenceMeta('weird').key).toBe('unknown');
    });
});

describe('groupByConfidence', () => {
    const records = [
        rec('a', 'suspect', '身份:沈砚-销籍', 'e1'),
        rec('b', 'certain', '秘密:三账漏洞', 'e1'),
        rec('c', 'certain', '身份:白主簿-立场', 'e2'),
        rec('d', 'weird', '物品:残缺算珠'),
    ];
    const groups = groupByConfidence(records);

    test('buckets ordered certain → suspect → misinformed → unknown', () => {
        expect(groups.map(g => g.key)).toEqual(['certain', 'suspect', 'unknown']);
    });
    test('each leaf is a single record (fact × character)', () => {
        for (const g of groups) for (const f of g.facts) expect(f.records).toHaveLength(1);
    });
    test('certain bucket holds 2 records', () => {
        expect(groups.find(g => g.key === 'certain').facts).toHaveLength(2);
    });
    test('group meta carries label and color', () => {
        const g = groups.find(x => x.key === 'suspect');
        expect(g.meta.label).toBe('怀疑');
        expect(g.meta.color).toBeTruthy();
    });
    test('same fact splits across buckets by confidence', () => {
        const split = groupByConfidence([rec('x', 'certain', 'F'), rec('y', 'suspect', 'F')]);
        expect(split.map(g => g.key)).toEqual(['certain', 'suspect']);
        expect(split[0].facts[0].factKey).toBe('F');
    });
});

describe('groupKnowledge dispatch', () => {
    test('category mode uses category grouping', () => {
        const records = [rec('a', 'certain', '身份:沈砚'), rec('b', 'certain', '秘密:漏洞')];
        expect(groupKnowledge(records, 'category').map(g => g.key).sort()).toEqual(['秘密', '身份']);
    });
    test('default mode is confidence', () => {
        expect(groupKnowledge([rec('a', 'certain', 'F')], undefined)[0].key).toBe('certain');
    });
    test('groupByCategory still exported', () => {
        expect(typeof groupByCategory).toBe('function');
    });
});
