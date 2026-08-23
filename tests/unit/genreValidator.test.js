'use strict';

/**
 * genreValidator 单元测试（R7 — genre 一致性校验）
 *
 * 测试策略：
 * - mock logger 避免污染输出
 * - 构造合法/非法 genre 对象，覆盖所有校验分支
 * - 覆盖 agentMaterialAccess 校验、materialFocus 交叉校验、未知字段告警
 *
 * 文件位置：tests/unit/genreValidator.test.js
 */

jest.mock('../../server/shared/logger', () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
}));

const {
    validateGenre,
    VALID_MATERIAL_TYPES,
    AGENT_TYPES,
    DETAIL_LEVELS,
    GENRE_REQUIRED_FIELDS,
    GENRE_OPTIONAL_FIELDS
} = require('../../server/services/genres/genreValidator');
const logger = require('../../server/shared/logger');

// 构造合法的 genre 对象
function makeValidGenre(overrides = {}) {
    const agentMaterialAccess = {};
    for (const agent of AGENT_TYPES) {
        agentMaterialAccess[agent] = { needs: ['character'], detail: 'full' };
    }
    return {
        id: 'test-genre',
        label: '测试题材',
        patterns: ['测试'],
        foundation: { theme: '测试' },
        incompatibleConstraints: [],
        requiredConstraints: [],
        styleProfile: { materialFocus: { primary: ['character'], secondary: [], skip: [] } },
        genreBase: 'high-martial-comedy',
        agentMaterialAccess,
        ...overrides
    };
}

describe('genreValidator (R7)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('常量导出', () => {
        test('VALID_MATERIAL_TYPES 包含核心素材类型', () => {
            expect(VALID_MATERIAL_TYPES).toContain('character');
            expect(VALID_MATERIAL_TYPES).toContain('foreshadowing');
            expect(VALID_MATERIAL_TYPES).toContain('power-system');
            expect(VALID_MATERIAL_TYPES).toContain('narrative-bridge');
        });

        test('AGENT_TYPES 包含 10 个 Agent', () => {
            expect(AGENT_TYPES).toHaveLength(10);
            expect(AGENT_TYPES).toContain('writer');
            expect(AGENT_TYPES).toContain('reviser');
            expect(AGENT_TYPES).toContain('reader');
        });

        test('DETAIL_LEVELS 包含 3 个级别', () => {
            expect(DETAIL_LEVELS).toEqual(['full', 'summary', 'index']);
        });

        test('GENRE_REQUIRED_FIELDS 包含核心必填字段', () => {
            expect(GENRE_REQUIRED_FIELDS).toContain('id');
            expect(GENRE_REQUIRED_FIELDS).toContain('foundation');
            expect(GENRE_REQUIRED_FIELDS).toContain('agentMaterialAccess');
        });

        test('GENRE_OPTIONAL_FIELDS 不与 REQUIRED_FIELDS 重叠', () => {
            const requiredSet = new Set(GENRE_REQUIRED_FIELDS);
            for (const f of GENRE_OPTIONAL_FIELDS) {
                expect(requiredSet.has(f)).toBe(false);
            }
        });
    });

    describe('validateGenre - 合法 genre', () => {
        test('合法 genre 返回 valid=true 空 errors', () => {
            const result = validateGenre(makeValidGenre());
            expect(result.valid).toBe(true);
            expect(result.errors).toEqual([]);
        });

        test('合法 genre 不输出 error 日志', () => {
            validateGenre(makeValidGenre());
            expect(logger.error).not.toHaveBeenCalled();
        });

        test('合法 genre 输出 ✅ 通过日志', () => {
            validateGenre(makeValidGenre());
            expect(logger.info).toHaveBeenCalledWith(
                'baseGenreTemplate',
                expect.stringContaining('✅ 题材插件验证通过')
            );
        });
    });

    describe('validateGenre - 必填字段缺失', () => {
        test('缺少 id 报错', () => {
            const g = makeValidGenre();
            delete g.id;
            const result = validateGenre(g);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('缺少必填字段: id');
        });

        test('缺少 foundation 报错', () => {
            const g = makeValidGenre();
            delete g.foundation;
            const result = validateGenre(g);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('foundation'))).toBe(true);
        });

        test('缺少 agentMaterialAccess 报错（含显式提示）', () => {
            const g = makeValidGenre();
            delete g.agentMaterialAccess;
            const result = validateGenre(g);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('必须显式声明每个Agent的素材访问权限'))).toBe(true);
        });

        test('所有必填字段缺失时报多条错误', () => {
            const result = validateGenre({});
            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThanOrEqual(GENRE_REQUIRED_FIELDS.length);
        });

        test('字段值为 null 视为缺失', () => {
            const g = makeValidGenre({ foundation: null });
            const result = validateGenre(g);
            expect(result.errors.some(e => e.includes('foundation'))).toBe(true);
        });
    });

    describe('validateGenre - 未知字段告警', () => {
        test('未知字段触发 warning', () => {
            const g = makeValidGenre({ typoField: 'xxx' });
            const result = validateGenre(g);
            expect(result.warnings.some(w => w.includes('typoField'))).toBe(true);
        });

        test('isMatch 字段不视为未知', () => {
            const g = makeValidGenre({ isMatch: () => false });
            const result = validateGenre(g);
            expect(result.warnings.some(w => w.includes('isMatch'))).toBe(false);
        });

        test('有 warning 但无 error 时 valid=true', () => {
            const g = makeValidGenre({ extraField: 1 });
            const result = validateGenre(g);
            expect(result.valid).toBe(true);
            expect(result.warnings.length).toBeGreaterThan(0);
        });
    });

    describe('validateGenre - agentMaterialAccess 校验', () => {
        test('缺少某个 Agent 报错', () => {
            const g = makeValidGenre();
            delete g.agentMaterialAccess.writer;
            const result = validateGenre(g);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('writer'))).toBe(true);
        });

        test('包含未知 Agent 触发 warning', () => {
            const g = makeValidGenre();
            g.agentMaterialAccess.unknownAgent = { needs: ['character'], detail: 'full' };
            const result = validateGenre(g);
            expect(result.warnings.some(w => w.includes('unknownAgent'))).toBe(true);
        });

        test('needs 非数组报错', () => {
            const g = makeValidGenre();
            g.agentMaterialAccess.writer.needs = 'not-array';
            const result = validateGenre(g);
            expect(result.errors.some(e => e.includes('needs 必须是数组'))).toBe(true);
        });

        test('needs 包含未知素材类型触发 warning', () => {
            const g = makeValidGenre();
            g.agentMaterialAccess.writer.needs = ['character', 'unknown-type'];
            const result = validateGenre(g);
            expect(result.warnings.some(w => w.includes('unknown-type'))).toBe(true);
        });

        test('detail 非 full/summary/index 报错', () => {
            const g = makeValidGenre();
            g.agentMaterialAccess.writer.detail = 'invalid';
            const result = validateGenre(g);
            expect(result.errors.some(e => e.includes('detail 必须是'))).toBe(true);
        });

        test('needs 包含 skip 类型报错', () => {
            const g = makeValidGenre({
                styleProfile: {
                    materialFocus: { primary: ['character'], secondary: [], skip: ['item'] }
                }
            });
            g.agentMaterialAccess.writer.needs = ['character', 'item'];
            const result = validateGenre(g);
            expect(result.errors.some(e => e.includes('skip类型') && e.includes('item'))).toBe(true);
        });

        test('needs 包含未在 materialFocus 声明的类型触发 warning', () => {
            const g = makeValidGenre({
                styleProfile: {
                    materialFocus: { primary: ['character'], secondary: [], skip: [] }
                }
            });
            // equipment 未在 primary/secondary/skip 中声明
            g.agentMaterialAccess.writer.needs = ['character', 'equipment'];
            const result = validateGenre(g);
            expect(result.warnings.some(w => w.includes('未在materialFocus中声明') && w.includes('equipment'))).toBe(true);
        });
    });

    describe('validateGenre - materialFocus 校验', () => {
        test('materialFocus 包含未知素材类型触发 warning', () => {
            const g = makeValidGenre({
                styleProfile: {
                    materialFocus: { primary: ['character', 'fake-type'], secondary: [], skip: [] }
                }
            });
            const result = validateGenre(g);
            expect(result.warnings.some(w => w.includes('fake-type'))).toBe(true);
        });

        test('primary 类型无 Agent 覆盖触发 warning', () => {
            const g = makeValidGenre({
                styleProfile: {
                    materialFocus: { primary: ['character', 'foreshadowing'], secondary: [], skip: [] }
                }
            });
            // 所有 Agent 都只 needs character，foreshadowing 无 Agent 覆盖
            for (const agent of AGENT_TYPES) {
                g.agentMaterialAccess[agent].needs = ['character'];
            }
            const result = validateGenre(g);
            expect(result.warnings.some(w => w.includes('foreshadowing') && w.includes('无Agent覆盖'))).toBe(true);
        });

        test('secondary 类型无 Agent 覆盖也触发 warning', () => {
            const g = makeValidGenre({
                styleProfile: {
                    materialFocus: { primary: ['character'], secondary: ['item'], skip: [] }
                }
            });
            for (const agent of AGENT_TYPES) {
                g.agentMaterialAccess[agent].needs = ['character'];
            }
            const result = validateGenre(g);
            expect(result.warnings.some(w => w.includes('item'))).toBe(true);
        });
    });

    describe('validateGenre - 日志输出', () => {
        test('有 error 时输出 ❌ 失败日志', () => {
            const result = validateGenre({ id: 'bad' });
            expect(result.valid).toBe(false);
            expect(logger.error).toHaveBeenCalledWith(
                'baseGenreTemplate',
                expect.stringContaining('❌ 题材插件验证失败')
            );
        });

        test('仅有 warning 时输出 ⚠️ 警告日志', () => {
            const g = makeValidGenre({ extraField: 1 });
            validateGenre(g);
            expect(logger.warn).toHaveBeenCalledWith(
                'baseGenreTemplate',
                expect.stringContaining('⚠️ 题材插件验证警告')
            );
        });

        test('有 error 时同时输出 warning', () => {
            const g = makeValidGenre({ extraField: 1 });
            delete g.foundation;
            validateGenre(g);
            expect(logger.warn).toHaveBeenCalled();
        });
    });
});
