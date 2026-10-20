/**
 * techIndexSearch 单元测试 — BM25检索与分词（纯函数）
 */
const search = require('../../server/services/techIndexSearch');

const ENTRIES = [
    { id: 'a', display_name: '压力倒计时可视化', tags: ['压力', '倒计时'], department: '02_情节引擎部', subcategory: '08_压力传导', modes: ['novel'], injection_point: 'writer' },
    { id: 'b', display_name: '群像分光法', tags: ['群像', '宏大'], department: '03_人物熔炉部', subcategory: '07_群像设计', modes: ['novel'], injection_point: 'writer' },
    { id: 'c', display_name: '弧光三段锚点', tags: ['弧光', '人物'], department: '03_人物熔炉部', subcategory: '05_人物弧光', modes: ['shuangwen'], injection_point: 'intent-planner' },
];

describe('techIndexSearch - 分词', () => {
    test('中文按双字切分，英文数字按词切分', () => {
        const tokens = search.tokenize('压力ABC123');
        expect(tokens).toContain('压力');
        expect(tokens).toContain('abc123');
    });

    test('空输入返回空数组', () => {
        expect(search.tokenize('')).toEqual([]);
        expect(search.tokenize(null)).toEqual([]);
    });
});

describe('techIndexSearch - BM25检索', () => {
    const stats = search.buildStats(ENTRIES);

    test('命中展示名相关条目且按分数降序', () => {
        const res = search.searchEntries(ENTRIES, '压力 倒计时', stats, { topK: 3 });
        expect(res.length).toBeGreaterThan(0);
        expect(res[0].id).toBe('a');
        expect(res.length <= 1 || res[0].score >= res[1].score).toBe(true);   // 结果按分数降序
    });

    test('mode过滤生效', () => {
        const res = search.searchEntries(ENTRIES, '弧光', stats, { mode: 'novel', topK: 5 });
        expect(res.every(r => r.modes.includes('novel'))).toBe(true);
    });

    test('injectionPoint过滤生效', () => {
        const res = search.searchEntries(ENTRIES, '弧光', stats, { injectionPoint: 'intent-planner', topK: 5 });
        expect(res.every(r => r.injection_point === 'intent-planner')).toBe(true);
    });

    test('department过滤生效', () => {
        const res = search.searchEntries(ENTRIES, '群像', stats, { department: '03_人物熔炉部', topK: 5 });
        expect(res.every(r => r.department === '03_人物熔炉部')).toBe(true);
    });

    test('无匹配返回空数组', () => {
        expect(search.searchEntries(ENTRIES, '量子力学', stats, {})).toEqual([]);
    });
});
