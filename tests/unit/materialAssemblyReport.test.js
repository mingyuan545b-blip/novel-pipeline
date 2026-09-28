/**
 * materialAssemblyReport（P1-4c 装配记账）单元测试
 * 覆盖：缺口分级（blocked/warn/info）/ 声明未解析兜底 / 来源追溯字段 / 密度原因
 */
jest.mock('../../server/shared/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));

const {
    buildAssemblyReport, buildGaps, buildProvenance, buildDensity, gradeGap, GAP_LEVEL
} = require('../../server/services/pipeline/materialAssemblyReport');

const need = (over = {}) => ({ type: 'character', detail: 'full', required: true, source: 'entity-center', ...over });

describe('gradeGap - 缺口分级', () => {
    test('required 且一条没拿到 → blocked（下游会凭空造，必须报警）', () => {
        const gap = gradeGap(need(), []);
        expect(gap.level).toBe(GAP_LEVEL.BLOCKED);
        expect(gap.reason).toBe('entity-missing');
    });

    test('可选类没拿到 → warn，不阻断', () => {
        const gap = gradeGap(need({ type: 'equipment', required: false, source: 'materials' }), []);
        expect(gap.level).toBe(GAP_LEVEL.WARN);
        expect(gap.reason).toBe('material-missing');
    });

    test('预算主动裁剪 → info，不算故障（省 token 是有意为之）', () => {
        const gap = gradeGap(need({ dropped: true, dropReason: 'not-relevant' }), []);
        expect(gap.level).toBe(GAP_LEVEL.INFO);
        expect(gap.reason).toBe('budget-dropped');
    });

    test('拿到了 → 无缺口', () => {
        expect(gradeGap(need(), [{ name: '林三' }])).toBeNull();
    });

    test('缺口原因按数据源定位（关系/知识库）', () => {
        expect(gradeGap(need({ source: 'relations' }), []).reason).toBe('relations-empty');
        expect(gradeGap(need({ type: 'knowledge-access', source: 'knowledge-access' }), []).reason).toBe('knowledge-empty');
    });
});

describe('buildGaps - 声明未解析的兜底', () => {
    test('materialNeeds 为空 → 记一条 context-unresolved blocked（绝不静默返回空素材）', () => {
        const gaps = buildGaps([], {});
        expect(gaps).toHaveLength(1);
        expect(gaps[0]).toMatchObject({ type: '*', source: 'context', level: GAP_LEVEL.BLOCKED, reason: 'context-unresolved' });
    });

    test('正常清单只回缺口项，带类型/来源/计划密度', () => {
        const gaps = buildGaps([need(), need({ type: 'foreshadowing', required: false })], { character: [{ name: 'a' }] });
        expect(gaps).toHaveLength(1);
        expect(gaps[0]).toMatchObject({ type: 'foreshadowing', required: false, level: GAP_LEVEL.WARN, plannedDepth: 'full' });
    });

    test('dropped 类不计入故障，但仍记录以便解释"为什么这章没有它"', () => {
        const gaps = buildGaps([need({ dropped: true })], {});
        expect(gaps[0].level).toBe(GAP_LEVEL.INFO);
    });
});

describe('buildProvenance - 来源追溯', () => {
    test('每条素材带 来源/素材ID/最后写入者/最后写入章', () => {
        const prov = buildProvenance({
            character: [{ name: '林三', source: 'materials', depth: 'L3', materialId: 'm1', lastWriter: 'material-manager', lastUpdatedChapter: 4 }],
            worldview: [{ name: '雾港', source: 'entity-center', depth: 'L2', materialId: null, lastWriter: null, lastUpdatedChapter: 2 }],
        });
        expect(prov).toHaveLength(2);
        expect(prov[0]).toEqual({ type: 'character', name: '林三', source: 'materials', depth: 'L3', materialId: 'm1', lastWriter: 'material-manager', lastUpdatedChapter: 4 });
        expect(prov[1].lastWriter).toBeNull();
    });

    test('缺字段不抛错（旧数据没有留痕）', () => {
        const prov = buildProvenance({ catchphrase: [{ name: '再算一遍' }] });
        expect(prov[0]).toMatchObject({ name: '再算一遍', source: 'materials', materialId: null, lastUpdatedChapter: null });
    });

    test('空装配 → 空数组', () => {
        expect(buildProvenance({})).toEqual([]);
        expect(buildProvenance(null)).toEqual([]);
    });
});

describe('buildDensity - 密度事实', () => {
    test('计划深度 vs 实际注入深度 + 原因', () => {
        const d = buildDensity([need({ resolvedDepth: 'L3' })], { character: [{ depth: 'L3', content: 'x'.repeat(50) }] });
        expect(d[0]).toMatchObject({ type: 'character', plannedDepth: 'full', actualDepth: 'L3', itemCount: 1, chars: 50, reason: 'depth-resolved' });
    });

    test('裁剪类原因是 budget-dropped；降级是 budget-degraded；其余 declared', () => {
        expect(buildDensity([need({ dropped: true })], {})[0].reason).toBe('budget-dropped');
        expect(buildDensity([need({ degraded: true })], {})[0].reason).toBe('budget-degraded');
        expect(buildDensity([need()], {})[0].reason).toBe('declared');
    });
});

describe('buildAssemblyReport - 汇总', () => {
    test('汇总计数与 blockedTypes 可用于报警与 UI 红标', () => {
        const report = buildAssemblyReport({
            context: { materialNeeds: [need(), need({ type: 'equipment', required: false }), need({ type: 'mood', dropped: true })] },
            scheduled: { materials: { mood: [] } },
        });
        expect(report.summary).toMatchObject({ typesPlanned: 3, gapBlocked: 1, gapWarn: 1, gapInfo: 1, blockedTypes: ['character'] });
        expect(report.gaps).toHaveLength(3);
    });

    test('未解析上下文 → summary.gapBlocked=1（供装配入口 ERROR 报警）', () => {
        const report = buildAssemblyReport({ context: { materialNeeds: [] }, scheduled: { materials: {} } });
        expect(report.summary.gapBlocked).toBe(1);
        expect(report.summary.blockedTypes).toEqual(['*']);
    });

    test('缺参不抛错', () => {
        expect(buildAssemblyReport({}).summary.gapBlocked).toBe(1);
    });
});
