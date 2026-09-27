/**
 * libraryExtractParse 单元测试 — 提取结果解析/规范化/去重（纯函数）
 */
const parse = require('../../server/services/libraryExtractParse');
const { getDimension } = require('../../server/config/libraryExtractDimensions');

const DIM = getDimension('pressure');

describe('libraryExtractParse - JSON提取', () => {
    test('剥离think标签后解析', () => {
        const raw = '<think\u003e思考中...\u003c/think\u003e{"techniques":[{"name":"压力倒计时"}]}';
        expect(parse.parseTechniques(raw)[0].name).toBe('压力倒计时');
    });

    test('剥离markdown代码块', () => {
        const raw = '```json\n{"techniques":[{"name":"a"}]}\n```';
        expect(parse.parseTechniques(raw)).toHaveLength(1);
    });

    test('非法JSON抛错', () => {
        expect(() => parse.parseTechniques('不是JSON')).toThrow();
    });

    test('数组根节点兼容', () => {
        expect(parse.parseTechniques('[{"name":"x"}]')).toHaveLength(1);
    });
});

describe('libraryExtractParse - 规范化', () => {
    const base = {
        name: '压力倒计时可视化',
        definition: '把不可见的压力换算成读者能自己计算的刻度',
        implementation_rules: ['给出明确数值', '数值随时间收紧'],
        anti_patterns: ['倒计时永不归零'],
        evidence: ['还剩两分半'],
        tags: ['压力', '倒计时'],
    };

    test('合法输入保留关键字段', () => {
        const t = parse.normalizeTechnique(base, DIM);
        expect(t.display_name).toBe('压力倒计时可视化');
        expect(t.implementation_rules).toHaveLength(2);
        expect(t.source_type).toBe('extracted');
        expect(t.injection_point).toBe('writer');
    });

    test('规则少于2条则判废（防读后感式条目）', () => {
        expect(parse.normalizeTechnique({ ...base, implementation_rules: ['只有一条'] }, DIM)).toBeNull();
    });

    test('技法名含书名号/引号等专有名词特征则判废', () => {
        expect(parse.normalizeTechnique({ ...base, name: '《死亡高考》评分制' }, DIM)).toBeNull();
    });

    test('缺失定义则判废', () => {
        expect(parse.normalizeTechnique({ ...base, definition: '' }, DIM)).toBeNull();
    });

    test('越界部门回落到维度首选部门，子类回落到该部门首个', () => {
        const t = parse.normalizeTechnique({ ...base, department: '99_不存在的部', subcategory: '99_不存在的子类' }, DIM);
        expect(DIM.departments).toContain(t.department);
        expect(t.subcategory).toBeTruthy();
    });
});

describe('libraryExtractParse - ID生成', () => {
    test('同分类序号取最大值+1并补零', () => {
        const id = parse.makeId('02_情节引擎部', '02_悬念编码', ['02_情节引擎部_02_悬念编码_05', '02_情节引擎部_02_悬念编码_02']);
        expect(id).toBe('02_情节引擎部_02_悬念编码_06');
    });

    test('无既有条目时从01开始', () => {
        expect(parse.makeId('06_世界构建部', '07_宏大感构建', [])).toBe('06_世界构建部_07_宏大感构建_01');
    });
});
