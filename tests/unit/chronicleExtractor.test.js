/**
 * chronicleExtractor 单元测试 — 多维归一化（不打真实 LLM）
 */
jest.mock('../../server/services/llm', () => ({ chat: jest.fn() }));

const { parseChronicleResponse } = require('../../server/services/chronicleExtractor');

describe('parseChronicleResponse 多维归一化', () => {
    test('旧格式 quotes 字符串 → 归一为对象并补空 scene/why', () => {
        const out = parseChronicleResponse(JSON.stringify([
            { name: '沈砚', stance: '查真相', quotes: ['路就在脚下'] }
        ]));
        expect(out).toHaveLength(1);
        expect(out[0].quotes[0]).toEqual({ speaker: '', scene: '', quote: '路就在脚下', why: '', chapter: 0 });
        expect(out[0].highlights).toEqual([]);
        expect(out[0].relations).toEqual([]);
    });
    test('新格式 quotes 对象 + highlights/relations 保留', () => {
        const out = parseChronicleResponse(JSON.stringify([
            {
                name: '卡蜜尔', daily: '每日巡查底城', psychology: '冷→疑',
                stance: '守护秩序',
                highlights: [{ scene: '回望一生', what: '承认成败皆是收获', why: '立住达观人格' }],
                quotes: [{ scene: '回望一生', quote: '我曾踏足山巅', why: '道出人生态度' }],
                relations: [{ target: '沈砚', from: '陌生', to: '赏识', reason: '见其智' }]
            }
        ]));
        expect(out[0].daily).toBe('每日巡查底城');
        expect(out[0].psychology).toBe('冷→疑');
        expect(out[0].highlights).toHaveLength(1);
        expect(out[0].quotes[0].why).toBe('道出人生态度');
        expect(out[0].relations).toHaveLength(1);
    });
    test('仅日常/心理也保留（不再只看立场）', () => {
        const out = parseChronicleResponse(JSON.stringify([{ name: '柳三娘', daily: '对账到深夜' }]));
        expect(out).toHaveLength(1);
    });
    test('非数组/空 → []', () => {
        expect(parseChronicleResponse('not json')).toEqual([]);
        expect(parseChronicleResponse('{"a":1}')).toEqual([]);
    });
});
