/**
 * techniqueExtraction 单元测试 — 切块/采样/去重（纯函数部分，不触发LLM）
 */
const { splitIntoChunks, sampleEvenly, isDuplicate } = require('../../server/services/techniqueExtraction');

describe('techniqueExtraction - 文本切块', () => {
    test('按章节边界切块', () => {
        const text = '第1章 开端\n内容A\n第2章 发展\n内容B\n第3章 结尾\n内容C';
        const chunks = splitIntoChunks(text, 12);
        expect(chunks.length).toBeGreaterThan(1);
        expect(chunks[0]).toContain('第1章');
    });

    test('无章节标记时按长度硬切', () => {
        const chunks = splitIntoChunks('啊'.repeat(100), 30);
        expect(chunks.length).toBe(4);
    });

    test('空输入返回空数组', () => {
        expect(splitIntoChunks('', 100)).toEqual([]);
    });
});

describe('techniqueExtraction - 均匀采样', () => {
    test('窗口数不超过文本块数', () => {
        const chunks = ['a', 'b'];
        const sample = sampleEvenly(chunks, 10, 5);
        expect(sample.split('【样本').length - 1).toBe(2);
    });

    test('采样覆盖首尾（长文本不会只看开头）', () => {
        const chunks = Array.from({ length: 10 }, (_, i) => `mark${i}` + 'x'.repeat(20));
        const sample = sampleEvenly(chunks, 50, 3);
        expect(sample).toContain('mark0');
        expect(sample.match(/mark\d+/g).some(m => parseInt(m.slice(4), 10) >= 8)).toBe(true);
    });
});

describe('techniqueExtraction - 去重', () => {
    test('同名视为重复', () => {
        expect(isDuplicate('压力倒计时可视化', ['压力倒计时可视化'])).toBe(true);
    });

    test('包含关系视为重复（防换个后缀重复入库）', () => {
        expect(isDuplicate('压力倒计时', ['压力倒计时可视化'])).toBe(true);
    });

    test('不同技法不判重', () => {
        expect(isDuplicate('群像分光法', ['压力倒计时可视化'])).toBe(false);
    });
});
