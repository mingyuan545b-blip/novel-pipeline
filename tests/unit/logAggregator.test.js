const { LogAggregator } = require('../../server/shared/logAggregator');
const { AlertEngine, DEFAULT_RULES } = require('../../server/shared/alertRules');

describe('logAggregator', () => {
    describe('ingest + getAggregations', () => {
        test('仅聚合 warn/error 级别', () => {
            const agg = new LogAggregator(30);
            agg.ingest({ timestamp: new Date().toISOString(), level: 'info', module: 'm', message: 'a', context: {} }, 'tr-1');
            agg.ingest({ timestamp: new Date().toISOString(), level: 'debug', module: 'm', message: 'b', context: {} }, 'tr-1');
            const items = agg.getAggregations();
            expect(items.length).toBe(0);
        });

        test('warn/error 日志被聚合', () => {
            const agg = new LogAggregator(30);
            const ts = new Date().toISOString();
            agg.ingest({ timestamp: ts, level: 'error', module: 'req', message: 'err1', context: {} }, 'tr-1');
            agg.ingest({ timestamp: ts, level: 'warn', module: 'req', message: 'warn1', context: {} }, 'tr-2');
            const items = agg.getAggregations();
            // 应该有 level:error, level:warn, module:req（3 个键）
            const keys = items.map(i => i.key);
            expect(keys).toContain('level:error');
            expect(keys).toContain('level:warn');
            expect(keys).toContain('module:req');
        });

        test('多次相同键的日志计数累加', () => {
            const agg = new LogAggregator(30);
            const ts = new Date().toISOString();
            for (let i = 0; i < 5; i++) {
                agg.ingest({ timestamp: ts, level: 'error', module: 'm', message: `err${i}`, context: {} }, `tr-${i}`);
            }
            const items = agg.getAggregations();
            const errorLevel = items.find(i => i.key === 'level:error');
            expect(errorLevel.count).toBe(5);
            expect(errorLevel.windowCount).toBe(5);
        });

        test('context.code 和 context.status 也作为聚合维度', () => {
            const agg = new LogAggregator(30);
            const ts = new Date().toISOString();
            agg.ingest({ timestamp: ts, level: 'error', module: 'm', message: 'a', context: { code: 'INTERNAL_ERROR', status: 500 } }, 'tr-1');
            const items = agg.getAggregations();
            const keys = items.map(i => i.key);
            expect(keys).toContain('code:INTERNAL_ERROR');
            expect(keys).toContain('status:500');
        });

        test('minCount 过滤', () => {
            const agg = new LogAggregator(30);
            const ts = new Date().toISOString();
            agg.ingest({ timestamp: ts, level: 'error', module: 'm1', message: 'a', context: {} }, 'tr-1');
            agg.ingest({ timestamp: ts, level: 'error', module: 'm2', message: 'b', context: {} }, 'tr-2');
            agg.ingest({ timestamp: ts, level: 'error', module: 'm1', message: 'c', context: {} }, 'tr-3');
            const items = agg.getAggregations({ minCount: 2 });
            // level:error 计数 3，module:m1 计数 2，module:m2 计数 1
            // minCount=2 应过滤掉 module:m2
            const keys = items.map(i => i.key);
            expect(keys).toContain('level:error');
            expect(keys).toContain('module:m1');
            expect(keys).not.toContain('module:m2');
        });

        test('按 count 降序排序', () => {
            const agg = new LogAggregator(30);
            const ts = new Date().toISOString();
            agg.ingest({ timestamp: ts, level: 'error', module: 'a', message: 'a', context: {} }, 'tr-1');
            for (let i = 0; i < 3; i++) {
                agg.ingest({ timestamp: ts, level: 'error', module: 'b', message: 'b', context: {} }, `tr-${i}`);
            }
            const items = agg.getAggregations();
            // level:error count=4, module:b count=3, module:a count=1
            expect(items[0].count).toBeGreaterThanOrEqual(items[1].count);
        });

        test('limit 生效', () => {
            const agg = new LogAggregator(30);
            const ts = new Date().toISOString();
            for (let i = 0; i < 20; i++) {
                agg.ingest({ timestamp: ts, level: 'error', module: `m${i}`, message: 'a', context: {} }, `tr-${i}`);
            }
            const items = agg.getAggregations({ limit: 5 });
            expect(items.length).toBe(5);
        });
    });

    describe('clear', () => {
        test('清空所有聚合数据', () => {
            const agg = new LogAggregator(30);
            agg.ingest({ timestamp: new Date().toISOString(), level: 'error', module: 'm', message: 'a', context: {} }, 'tr-1');
            agg.clear();
            expect(agg.getAggregations().length).toBe(0);
            expect(agg.getStats().totalKeys).toBe(0);
        });
    });

    describe('getStats', () => {
        test('返回窗口信息', () => {
            const agg = new LogAggregator(30);
            const stats = agg.getStats();
            expect(stats.windowMinutes).toBe(30);
            expect(stats.totalKeys).toBe(0);
        });
    });
});

describe('alertRules', () => {
    describe('evaluate', () => {
        test('未达阈值不触发告警', () => {
            const agg = new LogAggregator(30);
            const engine = new AlertEngine(DEFAULT_RULES, 1000);
            engine.attachAggregator(agg);
            const ts = new Date().toISOString();
            // DEFAULT_RULES 最低阈值 5（module-error-spike），只触发 4 次以低于所有规则阈值
            for (let i = 0; i < 4; i++) {
                agg.ingest({ timestamp: ts, level: 'error', module: 'm', message: 'a', context: {} }, `tr-${i}`);
            }
            const newAlerts = engine.evaluate();
            expect(newAlerts.length).toBe(0);
        });

        test('达到阈值触发告警', () => {
            const agg = new LogAggregator(30);
            const engine = new AlertEngine(DEFAULT_RULES, 1000);
            engine.attachAggregator(agg);
            const ts = new Date().toISOString();
            // 高频错误阈值 10，触发 11 次
            for (let i = 0; i < 11; i++) {
                agg.ingest({ timestamp: ts, level: 'error', module: 'm', message: 'a', context: {} }, `tr-${i}`);
            }
            const newAlerts = engine.evaluate();
            expect(newAlerts.length).toBeGreaterThan(0);
            const hasHighErrorRate = newAlerts.some(a => a.ruleId === 'high-error-rate');
            expect(hasHighErrorRate).toBe(true);
        });

        test('冷却期内不重复触发', () => {
            const agg = new LogAggregator(30);
            const engine = new AlertEngine(DEFAULT_RULES, 1000);
            engine.attachAggregator(agg);
            const ts = new Date().toISOString();
            for (let i = 0; i < 15; i++) {
                agg.ingest({ timestamp: ts, level: 'error', module: 'm', message: 'a', context: {} }, `tr-${i}`);
            }
            const first = engine.evaluate();
            expect(first.length).toBeGreaterThan(0);
            // 第二次评估（冷却期内）不应触发新告警
            const second = engine.evaluate();
            expect(second.length).toBe(0);
        });
    });

    describe('acknowledge', () => {
        test('确认告警后标记为已处理', () => {
            const agg = new LogAggregator(30);
            const engine = new AlertEngine(DEFAULT_RULES, 1000);
            engine.attachAggregator(agg);
            const ts = new Date().toISOString();
            for (let i = 0; i < 15; i++) {
                agg.ingest({ timestamp: ts, level: 'error', module: 'm', message: 'a', context: {} }, `tr-${i}`);
            }
            const newAlerts = engine.evaluate();
            const alertId = newAlerts[0].id;
            const ok = engine.acknowledge(alertId);
            expect(ok).toBe(true);
            const alerts = engine.getAlerts();
            const acked = alerts.find(a => a.id === alertId);
            expect(acked.acknowledged).toBe(true);
        });

        test('确认不存在的告警返回 false', () => {
            const engine = new AlertEngine();
            expect(engine.acknowledge('not-exist')).toBe(false);
        });
    });

    describe('getStats', () => {
        test('返回规则数和评估间隔', () => {
            const engine = new AlertEngine(DEFAULT_RULES, 30000);
            const stats = engine.getStats();
            expect(stats.rulesCount).toBe(DEFAULT_RULES.length);
            expect(stats.evaluateIntervalMs).toBe(30000);
            expect(stats.totalAlerts).toBe(0);
        });
    });

    describe('clear', () => {
        test('清空所有告警', () => {
            const agg = new LogAggregator(30);
            const engine = new AlertEngine(DEFAULT_RULES, 1000);
            engine.attachAggregator(agg);
            const ts = new Date().toISOString();
            for (let i = 0; i < 15; i++) {
                agg.ingest({ timestamp: ts, level: 'error', module: 'm', message: 'a', context: {} }, `tr-${i}`);
            }
            engine.evaluate();
            engine.clear();
            expect(engine.getAlerts().length).toBe(0);
        });
    });
});
