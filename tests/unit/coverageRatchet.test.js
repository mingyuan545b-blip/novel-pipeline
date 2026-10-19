/**
 * 覆盖率棘轮（E4/G4）单元测试 —— 基线比对语义
 */
const fs = require('fs');
const path = require('path');
const {
    extractCoverage, diffAgainstBaseline, aggregateAll, mergeBaseline, METRICS,
    EPSILON_PER_FILE, EPSILON_AGGREGATE
} = require('../../scripts/lib/coverageBaseline');

// 覆盖率报告属"环境产物"：未跑 --coverage 时不存在（如 npm run test:unit）。
// 此时**显式跳过**，而不是让 test:unit 失败。
const COV_JSON = path.join(__dirname, '../../coverage/coverage-final.json');
const covTest = fs.existsSync(COV_JSON) ? test : test.skip;

describe('coverageBaseline.extractCoverage', () => {
    covTest('从 istanbul 计数换算四项百分比（真实报告）', () => {
        const data = extractCoverage(require('path').join(__dirname, '../../coverage/coverage-final.json'));
        const keys = Object.keys(data);
        expect(keys.length).toBeGreaterThan(100);
        for (const k of keys.slice(0, 20)) {
            for (const m of METRICS) expect(typeof data[k][m]).toBe('number');
        }
        expect(keys.every((k) => k.startsWith('server/'))).toBe(true);
    });
});

describe('coverageBaseline.diffAgainstBaseline（含容差语义）', () => {
    test('下降超过单文件容差即报错（含指标与百分点）', () => {
        const base = { 'server/a.js': { statements: 90, branches: 80, functions: 85, lines: 90 } };
        const cur = { 'server/a.js': { statements: 90 - EPSILON_PER_FILE - 5, branches: 80, functions: 85, lines: 90 } };
        const r = diffAgainstBaseline(base, cur);
        expect(r.regressions).toHaveLength(1);
        expect(r.regressions[0]).toContain('statements');
    });

    test('容差内的小幅下降不报错（并行调度抖动，已实测记录）', () => {
        const base = { 'server/a.js': { statements: 90, branches: 80, functions: 85, lines: 90 } };
        const cur = { 'server/a.js': { statements: 90 - EPSILON_PER_FILE + 0.5, branches: 80, functions: 85, lines: 90 } };
        expect(diffAgainstBaseline(base, cur, { 'server/a.js': { statements: 400, branches: 10, functions: 20, lines: 400 } }).regressions).toEqual([]);
    });

    test('小分母文件按粒度补偿（1 个单元 = 100/总数 pp）', () => {
        const base = { 'server/small.js': { statements: 100, branches: 100, functions: 100, lines: 100 } };
        const cur = { 'server/small.js': { statements: 100, branches: 90, functions: 100, lines: 100 } };
        const units = { 'server/small.js': { statements: 12, branches: 10, functions: 5, lines: 12 } };
        // 容差 = 5 + 100/10 = 15pp → 10pp 的下降被容忍（实测 debugPgWriter 即此类）
        expect(diffAgainstBaseline(base, cur, units).regressions).toEqual([]);
        // 但若单元多（400 分支），同样 10pp 下降就是真退化
        const unitsBig = { 'server/small.js': { statements: 400, branches: 400, functions: 100, lines: 400 } };
        expect(diffAgainstBaseline(base, cur, unitsBig).regressions).toHaveLength(1);
    });

    test('上升/持平不报错；新文件进 unknown', () => {
        const base = { 'server/a.js': { statements: 90, branches: 80, functions: 85, lines: 90 } };
        const cur = {
            'server/a.js': { statements: 95, branches: 80, functions: 85, lines: 90 },
            'server/b.js': { statements: 10, branches: 10, functions: 10, lines: 10 },
        };
        const r = diffAgainstBaseline(base, cur);
        expect(r.regressions).toEqual([]);
        expect(r.improvements).toBe(1);
        expect(r.unknown).toEqual(['server/b.js']);
    });

    test('aggregateAll 为全量平均，EPSILON_AGGREGATE 远小于单文件容差', () => {
        const agg = aggregateAll({ a: { statements: 100, branches: 0, functions: 50, lines: 100 } });
        expect(agg.statements).toBe(100);
        expect(agg.branches).toBe(0);
        expect(EPSILON_AGGREGATE).toBeLessThan(EPSILON_PER_FILE);
    });

    test('mergeBaseline 取历史最优（棘轮只上不下）', () => {
        const merged = mergeBaseline(
            { 'a.js': { statements: 90, branches: 70, functions: 80, lines: 90 } },
            { 'a.js': { statements: 80, branches: 75, functions: 80, lines: 85 } }
        );
        expect(merged['a.js']).toEqual({ statements: 90, branches: 75, functions: 80, lines: 90 });
    });
});
