/**
 * 角色状态字段提取模块单元测试
 * 覆盖：人格魅力系统4维度（参考蛊真人方源设计）
 */
const {
    extractCharacterStateFromContent,
    extractLabeledFields,
    extractQuoteLibrary,
} = require('../../server/services/pipeline/characterStateExtractor');

describe('characterStateExtractor - 人物魅力系统4维度', () => {
    test('解析【人格魅力】标签', () => {
        const content = '【人格魅力】冷酷理性+超然心态+不畏惧死亡，让读者记住这个角色的独特气质';
        const state = extractLabeledFields(content);
        expect(state.charisma).toBeTruthy();
        expect(state.charisma).toContain('冷酷理性');
        expect(state.charisma).toContain('超然心态');
    });

    test('解析【哲学观】标签（含双引号）', () => {
        const content = '【哲学观】"辱骂于我何加焉，旁人看法不值一顾"';
        const state = extractLabeledFields(content);
        expect(state.philosophy).toBeTruthy();
        expect(state.philosophy).toContain('辱骂于我何加焉');
    });

    test('解析【出场设计】标签', () => {
        const content = '【出场设计】重生500年前+春秋蝉底牌+冷酷心智，首次出场于练气一层';
        const state = extractLabeledFields(content);
        expect(state.entranceDesign).toBeTruthy();
        expect(state.entranceDesign).toContain('重生500年前');
        expect(state.entranceDesign).toContain('春秋蝉');
    });

    test('解析【金句库】多句多场景', () => {
        const content = `【金句库】
1. 遭遇非议时：辱骂于我何加焉
2. 突破境界时：我们既然意识到自己的渺小，那就更应该变得强大
3. 生死关头：我命由我不由天`;
        const quotes = extractQuoteLibrary(content);
        expect(quotes).toHaveLength(3);
        expect(quotes[0].scene).toBe('遭遇非议时');
        expect(quotes[0].quote).toContain('辱骂于我何加焉');
        expect(quotes[1].scene).toBe('突破境界时');
        expect(quotes[2].scene).toBe('生死关头');
        expect(quotes[2].quote).toContain('我命由我不由天');
    });

    test('金句库无场景标注归为通用场景', () => {
        const content = `【金句库】
- 第一句金句
- 第二句金句`;
        const quotes = extractQuoteLibrary(content);
        expect(quotes).toHaveLength(2);
        expect(quotes[0].scene).toBe('通用场景');
        expect(quotes[1].scene).toBe('通用场景');
    });

    test('金句库到下一个【标签】截断', () => {
        const content = `【金句库】
1. 场景A：金句一
【外貌】不应进入金句库`;
        const quotes = extractQuoteLibrary(content);
        expect(quotes).toHaveLength(1);
        expect(quotes[0].quote).toBe('金句一');
    });

    test('无金句库标签返回空数组', () => {
        const content = '【性格】沉稳冷静';
        const quotes = extractQuoteLibrary(content);
        expect(quotes).toEqual([]);
    });

    test('extractCharacterStateFromContent 整合4维度', () => {
        const content = `【性格】冷酷理性
【人格魅力】冷酷理性+超然心态+不畏惧死亡
【哲学观】辱骂于我何加焉
【金句库】
1. 遭遇非议时：辱骂于我何加焉
2. 突破境界时：我们既然意识到自己的渺小
【出场设计】重生500年前+春秋蝉底牌`;
        const state = extractCharacterStateFromContent(content, {});
        expect(state.personality).toBeTruthy();
        expect(state.charisma).toContain('冷酷理性');
        expect(state.philosophy).toContain('辱骂于我何加焉');
        expect(state.entranceDesign).toContain('重生500年前');
        expect(Array.isArray(state.quoteLibrary)).toBe(true);
        expect(state.quoteLibrary).toHaveLength(2);
        expect(state.quoteLibrary[0].scene).toBe('遭遇非议时');
    });

    test('兼容旧素材（无新字段）不报错', () => {
        const content = '【性格】温柔善良，乐于助人';
        const state = extractCharacterStateFromContent(content, {});
        expect(state.personality).toContain('温柔善良');
        expect(state.charisma).toBeUndefined();
        expect(state.philosophy).toBeUndefined();
        expect(state.entranceDesign).toBeUndefined();
        expect(state.quoteLibrary).toBeUndefined();
    });
});

/**
 * 20章E2E回归：组合标签《身份/职位》《性格/动机》残留
 * 实测：陈默 position="职位】前户曹档案库职员"、personality="动机】狂热、绝望、自我感动"
 */
describe('组合标签残留清除', () => {
    const { extractCharacterStateFromContent } = require('../../server/services/pipeline/characterStateExtractor');

    it('【身份/职位】不把第二个标签带进 position', () => {
        const r = extractCharacterStateFromContent('【身份/职位】前户曹档案库职员，“透明人”。', {});
        expect(r.position).toBe('前户曹档案库职员');
    });

    it('【性格/动机】不把第二个标签带进 personality', () => {
        const r = extractCharacterStateFromContent('【性格/动机】狂热、绝望、自我感动。', {});
        expect(r.personality).toBe('狂热、绝望、自我感动');
    });

    it('普通单标签行为不变', () => {
        const r = extractCharacterStateFromContent('【身份】丧仪司最年轻的收殓师\n【性格】表面玩世不恭、嘴贫', {});
        expect(r.position).toBe('丧仪司最年轻的收殓师');
        expect(r.personality).toBe('表面玩世不恭、嘴贫');
    });

    it('【习惯】走标签层而不是畸形 fallback（不残留右括号）', () => {
        const r = extractCharacterStateFromContent('【习惯】收殓时必与尸体低声交谈，记录疑点', {});
        expect(r.signatureDetail).toBe('收殓时必与尸体低声交谈');
        expect(r.signatureDetail).not.toContain('】');
    });
});
