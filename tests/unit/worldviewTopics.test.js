const { normalizeTopic, resolveTopicKey } = require('../../server/services/worldviewTopics');

describe('worldviewTopics 主题归一', () => {
    test('normalizeTopic 剥离括号/斜杠后缀', () => {
        expect(normalizeTopic('以账治世的世界（大雍/架空古代）')).toBe('以账治世的世界');
        expect(normalizeTopic('三账合议制/以账治世')).toBe('三账合议制');
    });

    test('精确命中', () => {
        expect(resolveTopicKey('苍生局', ['苍生局', '白事堂运作模式'])).toBe('苍生局');
    });

    test('归一后命中（括号/斜杠变体归到既有主题）', () => {
        expect(resolveTopicKey('三账合议制实体化', ['三账合议制'])).toBe('三账合议制');
        expect(resolveTopicKey('以账治世的世界（苍生簿世界）', ['以账治世的世界'])).toBe('以账治世的世界');
    });

    test('同义尾缀（机制/模式）互含命中', () => {
        expect(resolveTopicKey('白事堂运作机制', ['白事堂运作模式'])).toBe('白事堂运作模式');
    });

    test('长度比过低不合并（避免过宽吞并）', () => {
        expect(resolveTopicKey('力量体系', ['以账治世的力量体系细则补充说明'])).toBe('力量体系');
    });

    test('无匹配 → 返回原名（允许新建）', () => {
        expect(resolveTopicKey('全新设定X', ['苍生局'])).toBe('全新设定X');
    });
});
