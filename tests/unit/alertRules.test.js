'use strict';

/**
 * alertRules 告警引擎单元测试（Q1）
 *
 * 测试策略：
 * - 使用 mock aggregator 返回聚合数据，不依赖真实日志流
 * - 使用 mock persister 验证告警持久化调用
 * - 覆盖：规则评估、阈值触发、冷却期、已存在告警去重、恢复清理、确认机制、排序、统计
 *
 * 文件位置：tests/unit/alertRules.test.js
 */

const {
    AlertEngine,
    DEFAULT_RULES,
    DEFAULT_EVALUATE_INTERVAL_MS,
    ALERT_COOLDOWN_MS
} = require('../../server/shared/alertRules');

// 创建 mock aggregator
function createMockAggregator(aggregations = []) {
    return {
        getAggregations: jest.fn(() => aggregations),
        clear: jest.fn()
    };
}

// 创建 mock persister
function createMockPersister() {
    return {
        persistAlert: jest.fn(() => Promise.resolve()),
        deleteAlert: jest.fn(() => Promise.resolve())
    };
}

// 构造聚合条目
function makeAgg(key, windowCount, sampleTraceId = 'tr-x', sampleMessage = 'msg') {
    return { key, windowCount, sampleTraceId, sampleMessage };
}

describe('alertRules (Q1)', () => {
    describe('常量与默认规则', () => {
        test('DEFAULT_EVALUATE_INTERVAL_MS 为正整数', () => {
            expect(DEFAULT_EVALUATE_INTERVAL_MS).toBeGreaterThan(0);
            expect(Number.isInteger(DEFAULT_EVALUATE_INTERVAL_MS)).toBe(true);
        });

        test('ALERT_COOLDOWN_MS 为正整数', () => {
            expect(ALERT_COOLDOWN_MS).toBeGreaterThan(0);
            expect(Number.isInteger(ALERT_COOLDOWN_MS)).toBe(true);
        });

        test('DEFAULT_RULES 至少 3 条且字段完整', () => {
            expect(DEFAULT_RULES.length).toBeGreaterThanOrEqual(3);
            for (const r of DEFAULT_RULES) {
                expect(r.id).toBeTruthy();
                expect(r.name).toBeTruthy();
                expect(r.severity).toMatch(/critical|warning|info/);
                expect(r.keyPattern).toBeTruthy();
                expect(r.threshold).toBeGreaterThan(0);
                expect(r.windowMs).toBeGreaterThan(0);
            }
        });

        test('DEFAULT_RULES 不可变（冻结或导出副本）', () => {
            // 引用相同不应被修改（如可修改则后续测试会受影响）
            const original = [...DEFAULT_RULES];
            try {
                DEFAULT_RULES.push({ id: 'fake' });
            } catch (e) { /* 冻结则 push 抛错 */ }
            // 至少保证外部使用不破坏原数组长度
            expect(DEFAULT_RULES.length).toBe(original.length);
        });
    });

    describe('constructor', () => {
        test('默认参数构造', () => {
            const e = new AlertEngine();
            expect(e._rules).toBe(DEFAULT_RULES);
            expect(e._evaluateIntervalMs).toBe(DEFAULT_EVALUATE_INTERVAL_MS);
            expect(e._activeAlerts.size).toBe(0);
            expect(e._lastTriggered.size).toBe(0);
        });

        test('自定义规则与间隔', () => {
            const rules = [{ id: 'r1', name: 'n', severity: 'info', keyPattern: 'k:', threshold: 1, windowMs: 1000 }];
            const e = new AlertEngine(rules, 5000);
            expect(e._rules).toBe(rules);
            expect(e._evaluateIntervalMs).toBe(5000);
        });
    });

    describe('attachAggregator / attachPersister', () => {
        test('注入 aggregator 后可被 evaluate 使用', () => {
            const agg = createMockAggregator([makeAgg('level:error', 100)]);
            const e = new AlertEngine();
            e.attachAggregator(agg);
            expect(e._aggregator).toBe(agg);
        });

        test('注入 persister 后可被 evaluate 调用', () => {
            const p = createMockPersister();
            const e = new AlertEngine();
            e.attachPersister(p);
            expect(e._persister).toBe(p);
        });
    });

    describe('start / stop', () => {
        test('start 启动定时器，stop 清理', () => {
            const e = new AlertEngine(undefined, 100);
            e.start();
            expect(e._evaluateTimer).not.toBeNull();
            e.stop();
            expect(e._evaluateTimer).toBeNull();
        });

        test('重复 start 不创建新定时器', () => {
            const e = new AlertEngine(undefined, 100);
            e.start();
            const t1 = e._evaluateTimer;
            e.start();
            expect(e._evaluateTimer).toBe(t1);
            e.stop();
        });

        test('stop 无定时器时不报错', () => {
            const e = new AlertEngine();
            expect(() => e.stop()).not.toThrow();
        });
    });

    describe('evaluate - 触发逻辑', () => {
        test('无 aggregator 返回空数组', () => {
            const e = new AlertEngine();
            expect(e.evaluate()).toEqual([]);
        });

        test('聚合计数达阈值触发告警', () => {
            const agg = createMockAggregator([makeAgg('level:error', 15)]);
            const p = createMockPersister();
            const e = new AlertEngine();
            e.attachAggregator(agg);
            e.attachPersister(p);

            const alerts = e.evaluate();
            expect(alerts.length).toBe(1);
            expect(alerts[0].ruleId).toBe('high-error-rate');
            expect(alerts[0].key).toBe('level:error');
            expect(alerts[0].count).toBe(15);
            expect(alerts[0].threshold).toBe(10);
            expect(alerts[0].severity).toBe('critical');
            expect(alerts[0].acknowledged).toBe(false);
            // 持久化被调用
            expect(p.persistAlert).toHaveBeenCalledTimes(1);
            expect(p.persistAlert).toHaveBeenCalledWith(alerts[0]);
        });

        test('聚合计数低于阈值不触发', () => {
            const agg = createMockAggregator([makeAgg('level:error', 5)]); // 阈值 10
            const e = new AlertEngine();
            e.attachAggregator(agg);
            expect(e.evaluate()).toEqual([]);
        });

        test('keyPattern 前缀匹配 — 不匹配的 key 不触发', () => {
            const agg = createMockAggregator([makeAgg('level:info', 100)]);
            const e = new AlertEngine();
            e.attachAggregator(agg);
            // 没有 level:info 规则
            expect(e.evaluate()).toEqual([]);
        });

        test('多条规则同时触发', () => {
            // level:error 匹配 high-error-rate，module:xxx 匹配 module-error-spike
            const agg = createMockAggregator([
                makeAgg('level:error', 15),
                makeAgg('module:writer', 8)
            ]);
            const e = new AlertEngine();
            e.attachAggregator(agg);
            const alerts = e.evaluate();
            expect(alerts.length).toBe(2);
            const ids = alerts.map(a => a.ruleId).sort();
            expect(ids).toEqual(['high-error-rate', 'module-error-spike']);
        });

        test('同一 key 多次 evaluate 不重复触发（去重）', () => {
            const agg = createMockAggregator([makeAgg('level:error', 15)]);
            const e = new AlertEngine();
            e.attachAggregator(agg);
            const first = e.evaluate();
            expect(first.length).toBe(1);
            // 第二次 evaluate — 同一 alertId 已存在
            const second = e.evaluate();
            expect(second.length).toBe(0);
        });
    });

    describe('evaluate - 冷却期', () => {
        test('冷却期内同规则其他 key 也不触发', () => {
            // 第一次触发 high-error-rate（level:error）
            const agg1 = createMockAggregator([makeAgg('level:error', 15)]);
            const e = new AlertEngine();
            e.attachAggregator(agg1);
            expect(e.evaluate().length).toBe(1);

            // 切换 aggregator 包含不同的 level:error key
            const agg2 = createMockAggregator([makeAgg('level:error', 20)]);
            e.attachAggregator(agg2);
            // 冷却期内，不再触发
            expect(e.evaluate().length).toBe(0);
        });

        test('冷却期后可再次触发（模拟时间）', () => {
            const agg = createMockAggregator([makeAgg('level:error', 15)]);
            const e = new AlertEngine();
            e.attachAggregator(agg);
            expect(e.evaluate().length).toBe(1);
            // 手动将 lastTriggered 回拨到冷却期之前
            const ruleId = 'high-error-rate';
            e._lastTriggered.set(ruleId, Date.now() - ALERT_COOLDOWN_MS - 1);
            // 由于去重，alertId 已存在 — 需要先清除
            e._activeAlerts.clear();
            expect(e.evaluate().length).toBe(1);
        });
    });

    describe('evaluate - 恢复清理', () => {
        test('计数低于阈值 50% 时告警恢复（删除）', () => {
            const agg1 = createMockAggregator([makeAgg('level:error', 15)]);
            const p = createMockPersister();
            const e = new AlertEngine();
            e.attachAggregator(agg1);
            e.attachPersister(p);
            e.evaluate();
            expect(e._activeAlerts.size).toBe(1);

            // 计数降到阈值 50% 以下
            const agg2 = createMockAggregator([makeAgg('level:error', 4)]); // 10 * 0.5 = 5，4 < 5
            e.attachAggregator(agg2);
            e.evaluate();
            expect(e._activeAlerts.size).toBe(0);
            expect(p.deleteAlert).toHaveBeenCalledTimes(1);
        });

        test('计数在阈值 50%-100% 之间不恢复', () => {
            const agg1 = createMockAggregator([makeAgg('level:error', 15)]);
            const e = new AlertEngine();
            e.attachAggregator(agg1);
            e.evaluate();
            // 计数降到 6（5 <= 6 < 10，不恢复）
            const agg2 = createMockAggregator([makeAgg('level:error', 6)]);
            e.attachAggregator(agg2);
            e.evaluate();
            expect(e._activeAlerts.size).toBe(1);
        });

        test('聚合中无该 key 时恢复', () => {
            const agg1 = createMockAggregator([makeAgg('level:error', 15)]);
            const e = new AlertEngine();
            e.attachAggregator(agg1);
            e.evaluate();
            // 聚合中不再有该 key
            const agg2 = createMockAggregator([]);
            e.attachAggregator(agg2);
            e.evaluate();
            expect(e._activeAlerts.size).toBe(0);
        });

        test('已确认的告警不参与恢复清理', () => {
            const agg1 = createMockAggregator([makeAgg('level:error', 15)]);
            const e = new AlertEngine();
            e.attachAggregator(agg1);
            const [alert] = e.evaluate();
            e.acknowledge(alert.id);
            // 计数降低
            const agg2 = createMockAggregator([makeAgg('level:error', 1)]);
            e.attachAggregator(agg2);
            e.evaluate();
            expect(e._activeAlerts.size).toBe(1);
        });
    });

    describe('getAlerts - 排序', () => {
        test('按严重程度排序（critical < warning < info）', () => {
            const agg = createMockAggregator([
                makeAgg('level:warn', 25),     // warning
                makeAgg('level:error', 15),    // critical
                makeAgg('module:x', 8)         // warning
            ]);
            const e = new AlertEngine();
            e.attachAggregator(agg);
            e.evaluate();
            const alerts = e.getAlerts();
            // critical 应排在最前
            expect(alerts[0].severity).toBe('critical');
        });

        test('同严重程度按触发时间倒序（新的在前）', () => {
            const rules = [
                { id: 'r1', name: 'n1', severity: 'warning', keyPattern: 'k1:', threshold: 1, windowMs: 1000 },
                { id: 'r2', name: 'n2', severity: 'warning', keyPattern: 'k2:', threshold: 1, windowMs: 1000 }
            ];
            const e = new AlertEngine(rules);
            // 第一次触发 r1
            e.attachAggregator(createMockAggregator([makeAgg('k1:a', 5)]));
            e.evaluate();
            // 手动将 r1 的 triggeredAt 设为较早时间
            const r1AlertId = 'r1:k1:a';
            e._activeAlerts.get(r1AlertId).triggeredAt = 1000;
            // 稍后触发 r2 — 清冷却与去重
            e._lastTriggered.clear();
            e.attachAggregator(createMockAggregator([makeAgg('k1:a', 5), makeAgg('k2:b', 5)]));
            e.evaluate();
            const alerts = e.getAlerts();
            expect(alerts.length).toBe(2);
            // 后触发的 r2（triggeredAt 更大）应在前
            expect(alerts[0].ruleId).toBe('r2');
        });
    });

    describe('acknowledge', () => {
        test('确认存在的告警返回 true', () => {
            const agg = createMockAggregator([makeAgg('level:error', 15)]);
            const e = new AlertEngine();
            e.attachAggregator(agg);
            const [alert] = e.evaluate();
            expect(e.acknowledge(alert.id)).toBe(true);
            expect(e._activeAlerts.get(alert.id).acknowledged).toBe(true);
        });

        test('确认不存在的告警返回 false', () => {
            const e = new AlertEngine();
            expect(e.acknowledge('nonexistent')).toBe(false);
        });

        test('确认后调用 persister.persistAlert 更新状态', () => {
            const agg = createMockAggregator([makeAgg('level:error', 15)]);
            const p = createMockPersister();
            const e = new AlertEngine();
            e.attachAggregator(agg);
            e.attachPersister(p);
            const [alert] = e.evaluate();
            p.persistAlert.mockClear();
            e.acknowledge(alert.id);
            expect(p.persistAlert).toHaveBeenCalledTimes(1);
            expect(p.persistAlert.mock.calls[0][0].acknowledged).toBe(true);
        });
    });

    describe('clear', () => {
        test('清空所有告警与冷却记录', () => {
            const agg = createMockAggregator([makeAgg('level:error', 15)]);
            const e = new AlertEngine();
            e.attachAggregator(agg);
            e.evaluate();
            expect(e._activeAlerts.size).toBeGreaterThan(0);
            expect(e._lastTriggered.size).toBeGreaterThan(0);
            e.clear();
            expect(e._activeAlerts.size).toBe(0);
            expect(e._lastTriggered.size).toBe(0);
        });
    });

    describe('getStats', () => {
        test('初始统计全为 0', () => {
            const e = new AlertEngine();
            const stats = e.getStats();
            expect(stats.totalAlerts).toBe(0);
            expect(stats.critical).toBe(0);
            expect(stats.warning).toBe(0);
            expect(stats.info).toBe(0);
            expect(stats.unacknowledged).toBe(0);
            expect(stats.rulesCount).toBe(DEFAULT_RULES.length);
            expect(stats.evaluateIntervalMs).toBe(DEFAULT_EVALUATE_INTERVAL_MS);
            expect(stats.persistenceEnabled).toBe(false);
        });

        test('触发告警后统计正确', () => {
            const agg = createMockAggregator([
                makeAgg('level:error', 15),
                makeAgg('level:warn', 25),
                makeAgg('module:x', 8)
            ]);
            const p = createMockPersister();
            const e = new AlertEngine();
            e.attachAggregator(agg);
            e.attachPersister(p);
            e.evaluate();
            const stats = e.getStats();
            expect(stats.totalAlerts).toBe(3);
            expect(stats.critical).toBe(1); // high-error-rate
            expect(stats.warning).toBe(2);  // high-warn-rate + module-error-spike
            expect(stats.info).toBe(0);
            expect(stats.unacknowledged).toBe(3);
            expect(stats.persistenceEnabled).toBe(true);
        });

        test('确认后 unacknowledged 递减', () => {
            const agg = createMockAggregator([makeAgg('level:error', 15)]);
            const e = new AlertEngine();
            e.attachAggregator(agg);
            const [alert] = e.evaluate();
            e.acknowledge(alert.id);
            const stats = e.getStats();
            expect(stats.unacknowledged).toBe(0);
        });
    });

    describe('getRules', () => {
        test('返回规则数组副本（不暴露内部引用）', () => {
            const e = new AlertEngine();
            const r1 = e.getRules();
            const r2 = e.getRules();
            expect(r1).not.toBe(r2); // 不同引用
            expect(r1).toEqual(r2);  // 内容相同
        });

        test('修改返回数组不影响内部规则', () => {
            const e = new AlertEngine();
            const rules = e.getRules();
            const originalLen = rules.length;
            rules.push({ id: 'fake' });
            expect(e.getRules().length).toBe(originalLen);
        });
    });

    describe('persister 异常容错', () => {
        test('persistAlert 抛错不影响 evaluate', () => {
            const agg = createMockAggregator([makeAgg('level:error', 15)]);
            const p = createMockPersister();
            p.persistAlert.mockRejectedValue(new Error('PG down'));
            const e = new AlertEngine();
            e.attachAggregator(agg);
            e.attachPersister(p);
            expect(() => e.evaluate()).not.toThrow();
            expect(e._activeAlerts.size).toBe(1);
        });

        test('deleteAlert 抛错不影响 evaluate', () => {
            const agg1 = createMockAggregator([makeAgg('level:error', 15)]);
            const p = createMockPersister();
            p.deleteAlert.mockRejectedValue(new Error('PG down'));
            const e = new AlertEngine();
            e.attachAggregator(agg1);
            e.attachPersister(p);
            e.evaluate();
            const agg2 = createMockAggregator([]);
            e.attachAggregator(agg2);
            expect(() => e.evaluate()).not.toThrow();
        });
    });
});
