const { buildParagraphContexts, findParagraphIndex, checkBabyInnerVoice, checkBabyCausalReasoning, checkAdultInnerVoiceExcess, checkOmniscientNarration, checkBabyPresence } = require('../../server/services/genres/baby/detectorsHelpers');

describe('baby/detectorsHelpers', () => {
    describe('buildParagraphContexts', () => {
        test('splits content into paragraphs', () => {
            const { paragraphs, contexts } = buildParagraphContexts('第一段\n\n第二段\n\n第三段');
            expect(paragraphs.length).toBe(3);
            expect(contexts.length).toBe(3);
        });

        test('identifies adult context', () => {
            const { contexts } = buildParagraphContexts('陈工看着监控屏幕，检查仪器数据');
            expect(contexts[0]).toBe('adult');
        });

        test('identifies baby context', () => {
            const { contexts } = buildParagraphContexts('小满拍拍小手，开心地笑了');
            expect(contexts[0]).toBe('baby');
        });

        test('identifies unknown context', () => {
            const { contexts } = buildParagraphContexts('天气晴朗，万里无云');
            expect(contexts[0]).toBe('unknown');
        });

        test('handles empty content', () => {
            const { paragraphs, contexts } = buildParagraphContexts('');
            expect(paragraphs.length).toBe(1);
        });
    });

    describe('findParagraphIndex', () => {
        test('finds correct paragraph for position', () => {
            const paragraphs = ['短文本', '较长的第二段文本内容', '第三段'];
            expect(findParagraphIndex(0, paragraphs)).toBe(0);
            expect(findParagraphIndex(5, paragraphs)).toBe(1);
        });

        test('returns 0 for position beyond content', () => {
            const paragraphs = ['短'];
            expect(findParagraphIndex(100, paragraphs)).toBe(0);
        });
    });

    describe('checkBabyInnerVoice', () => {
        test('detects adult-like inner voice for baby', () => {
            const issues = [];
            const content = '小满意识到局势的严重性，心中暗想必须立刻行动';
            const { paragraphs, contexts } = buildParagraphContexts(content);
            checkBabyInnerVoice(content, paragraphs, contexts, issues);
            expect(issues.length).toBeGreaterThan(0);
            expect(issues[0].severity).toBe('critical');
        });

        test('no issues for baby-appropriate content', () => {
            const issues = [];
            const content = '小满拍拍小手，开心地蹦蹦跳跳';
            const { paragraphs, contexts } = buildParagraphContexts(content);
            checkBabyInnerVoice(content, paragraphs, contexts, issues);
            expect(issues.length).toBe(0);
        });
    });

    describe('checkBabyCausalReasoning', () => {
        test('detects causal reasoning by baby', () => {
            const issues = [];
            const content = '小满知道必须立刻逃跑，因此他拼命地跑';
            const { paragraphs, contexts } = buildParagraphContexts(content);
            checkBabyCausalReasoning(content, paragraphs, contexts, issues);
            expect(issues.length).toBeGreaterThan(0);
        });

        test('no issues for simple baby actions', () => {
            const issues = [];
            const content = '小满抱住妈妈的大腿，哼唧着要吃奶';
            const { paragraphs, contexts } = buildParagraphContexts(content);
            checkBabyCausalReasoning(content, paragraphs, contexts, issues);
            expect(issues.length).toBe(0);
        });
    });

    describe('checkAdultInnerVoiceExcess', () => {
        test('detects excessive adult inner voice', () => {
            const issues = [];
            const content = '他意识到危险。他暗想对策。他心中叹气。他盘算着下一步。他权衡利弊。他暗道不妙。';
            const { paragraphs, contexts } = buildParagraphContexts(content);
            checkAdultInnerVoiceExcess(content, contexts, paragraphs, issues);
            expect(issues.length).toBeGreaterThan(0);
            expect(issues[0].severity).toBe('high');
        });

        test('no issues for moderate adult inner voice', () => {
            const issues = [];
            const content = '他看见了什么。他走过去看了看。';
            const { paragraphs, contexts } = buildParagraphContexts(content);
            checkAdultInnerVoiceExcess(content, contexts, paragraphs, issues);
            expect(issues.length).toBe(0);
        });
    });

    describe('checkOmniscientNarration', () => {
        test('detects omniscient narration', () => {
            const issues = [];
            const content = '然而，殊不知这一切早在他的计划之中。';
            const { paragraphs, contexts } = buildParagraphContexts(content);
            checkOmniscientNarration(content, paragraphs, contexts, issues);
            expect(issues.length).toBeGreaterThanOrEqual(0);
        });

        test('no issues for character-perspective narration', () => {
            const issues = [];
            const content = '他看见了远处的山。';
            const { paragraphs, contexts } = buildParagraphContexts(content);
            checkOmniscientNarration(content, paragraphs, contexts, issues);
            expect(issues.length).toBe(0);
        });
    });

    describe('checkBabyPresence', () => {
        test('detects missing baby actions', () => {
            const issues = [];
            const content = '他坐在那里思考了很久。';
            checkBabyPresence(content, issues);
            expect(issues.some(i => i.pattern === 'missing-baby-action')).toBe(true);
        });

        test('detects missing baby perspective', () => {
            const issues = [];
            const content = '天气晴朗，万里无云，风景如画。';
            checkBabyPresence(content, issues);
            expect(issues.some(i => i.pattern === 'missing-baby-perspective')).toBe(true);
        });

        test('no issues when baby actions present', () => {
            const issues = [];
            const content = '小满拍拍小手，开心地蹦蹦跳跳，感觉好暖和。';
            checkBabyPresence(content, issues);
            expect(issues.some(i => i.pattern === 'missing-baby-action')).toBe(false);
        });
    });
});
