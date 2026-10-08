/**
 * chronicleExtractor 单元测试 — 多维归一化（不打真实 LLM）
 */
jest.mock('../../server/services/llm', () => ({ chat: jest.fn() }));

const { parseChronicleResponse, CHRONICLE_PROMPTS } = require('../../server/services/chronicleExtractor');

describe('parseChronicleResponse 多维归一化', () => {
    test('旧格式 quotes 字符串 → 归一为对象并回填说话人/章号', () => {
        const out = parseChronicleResponse(JSON.stringify([
            { name: '沈砚', stance: '查真相', quotes: ['路就在脚下'] }
        ]), 7);
        expect(out).toHaveLength(1);
        // 说话人回填为角色名（编年史按角色存），章号回填当前章——修历史"speaker恒空/chapter恒0"
        expect(out[0].quotes[0]).toEqual({ speaker: '沈砚', scene: '', quote: '路就在脚下', why: '', chapter: 7 });
        expect(out[0].highlights).toEqual([]);
        expect(out[0].relations).toEqual([]);
    });
    test('highlights 补 cost 字段并归一', () => {
        const out = parseChronicleResponse(JSON.stringify([
            {
                name: '岑野', stance: '守规矩',
                highlights: [{ scene: '烧烤摊', what: '用笔冻结探员行动权', cost: '暴露底牌', why: '因为他怕线索断，所以宁可违规，也不肯放走证人' }]
            }
        ]), 1);
        expect(out[0].highlights[0]).toEqual({
            scene: '烧烤摊', what: '用笔冻结探员行动权', cost: '暴露底牌',
            why: '因为他怕线索断，所以宁可违规，也不肯放走证人'
        });
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

describe('full 档提示词：把"什么是高光/名言"写进 prompt（防回退成流水账）', () => {
    const p = CHRONICLE_PROMPTS.full;
    test('含判定标准与正例出处', () => {
        expect(p).toContain('高光时刻');
        expect(p).toContain('可截图');
        expect(p).toContain('只有他会做');
        expect(p).toContain('凡人修仙传');
        expect(p).toContain('英雄联盟');
    });
    test('含评论腔禁词与自检步骤', () => {
        expect(p).toContain('评论腔');
        expect(p).toContain('展现了');
        expect(p).toContain('自检');
    });
    test('字段含代价与原文要求', () => {
        expect(p).toContain('"cost"');
        expect(p).toContain('"speaker"');
        expect(p).toContain('逐字');
    });
});
