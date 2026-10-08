/**
 * namingQualitySpec 单元测试 — 命名三问 / 禁用名单 / 时代取法
 */
const spec = require('../../server/services/namingQualitySpec');

describe('validateName（禁用名单 + 流水线拼名）', () => {
    test('点名禁用名全部拦下', () => {
        for (const n of ['萧炎', '龙傲天', '沈砚', '顾清寒', '柳如烟', '叶凡', '叶辰']) {
            expect(spec.validateName(n, 'xianxia').valid).toBe(false);
        }
    });
    test('复姓套餐式命名被拦', () => {
        expect(spec.validateName('慕容轩', 'xianxia').issues.join()).toContain('复姓套餐');
    });
    test('墓王之王式好名通过（骆时秋/寒千落/风满楼/烛九阴/陈梦飞/齐庆疾/南锦屏）', () => {
        for (const n of ['骆时秋', '寒千落', '风满楼', '烛九阴', '陈梦飞', '齐庆疾', '南锦屏']) {
            const r = spec.validateName(n, 'wuxia');
            expect({ n, valid: r.valid, issues: r.issues }).toEqual({ n, valid: true, issues: [] });
        }
    });
    test('空名字不通过', () => {
        expect(spec.validateName('', 'wuxia').valid).toBe(false);
    });
});

describe('inferEraKey', () => {
    test('按题材推断时代风格', () => {
        expect(spec.inferEraKey('high-martial-comedy')).toBe('xianxia');
        expect(spec.inferEraKey('wuxia-jianghu')).toBe('wuxia');
        expect(spec.inferEraKey('horror-folklore')).toBe('zhiguai');
        expect(spec.inferEraKey('scifi-hard')).toBe('scifi');
        expect(spec.inferEraKey('')).toBe('xianxia');
    });
});

describe('buildNamingGuidance', () => {
    test('含取法/正反例/禁用名单/三问', () => {
        const g = spec.buildNamingGuidance('wuxia');
        expect(g).toContain('命名标准');
        expect(g).toContain('风满楼');
        expect(g).toContain('禁用名');
        expect(g).toContain('萧炎');
        expect(g).toContain('命名三问');
    });
});

describe('validateNames 批量', () => {
    test('列出违规项与下标', () => {
        const r = spec.validateNames(['风满楼', '萧炎'], 'wuxia');
        expect(r.valid).toBe(false);
        expect(r.total).toBe(2);
        expect(r.failed).toHaveLength(1);
        expect(r.failed[0].index).toBe(1);
    });
});
