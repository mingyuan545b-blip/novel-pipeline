'use strict';

/**
 * 告警规则引擎类
 *
 * 职责：定时评估规则、维护告警状态（触发/恢复/确认）
 * 文件位置：server/shared/alertRules/alertEngine.js
 */

const {
    DEFAULT_RULES,
    DEFAULT_EVALUATE_INTERVAL_MS,
    ALERT_COOLDOWN_MS
} = require('./constants');

class AlertEngine {
    constructor(rules = DEFAULT_RULES, evaluateIntervalMs = DEFAULT_EVALUATE_INTERVAL_MS) {
        this._rules = rules;
        this._evaluateIntervalMs = evaluateIntervalMs;
        /** @type {Map<string, Alert>} */
        this._activeAlerts = new Map();
        /** @type {Map<string, number>} 规则最后触发时间（冷却用） */
        this._lastTriggered = new Map();
        this._evaluateTimer = null;
        this._aggregator = null;
        this._persister = null;
    }

    /** 注入聚合器实例（依赖注入，避免循环依赖） */
    attachAggregator(aggregator) { this._aggregator = aggregator; }

    /** 注入持久化实例（依赖注入） */
    attachPersister(persister) { this._persister = persister; }

    /** 启动定时评估 */
    start() {
        if (this._evaluateTimer) return;
        this._evaluateTimer = setInterval(() => this.evaluate(), this._evaluateIntervalMs);
        if (this._evaluateTimer.unref) this._evaluateTimer.unref();
    }

    /** 停止定时评估 */
    stop() {
        if (this._evaluateTimer) {
            clearInterval(this._evaluateTimer);
            this._evaluateTimer = null;
        }
    }

    /** 评估所有规则 */
    evaluate() {
        if (!this._aggregator) return [];
        const aggregations = this._aggregator.getAggregations({ limit: 200, minCount: 1 });
        const now = Date.now();
        const newAlerts = [];

        for (const rule of this._rules) {
            const lastTriggered = this._lastTriggered.get(rule.id) || 0;
            if (now - lastTriggered < ALERT_COOLDOWN_MS) continue;

            for (const agg of aggregations) {
                if (!agg.key.startsWith(rule.keyPattern)) continue;
                if (agg.windowCount < rule.threshold) continue;

                const alertId = `${rule.id}:${agg.key}`;
                if (this._activeAlerts.has(alertId)) continue;

                const alert = {
                    id: alertId,
                    ruleId: rule.id,
                    ruleName: rule.name,
                    severity: rule.severity,
                    key: agg.key,
                    count: agg.windowCount,
                    threshold: rule.threshold,
                    triggeredAt: now,
                    sampleTraceId: agg.sampleTraceId,
                    sampleMessage: agg.sampleMessage,
                    acknowledged: false
                };
                this._activeAlerts.set(alertId, alert);
                this._lastTriggered.set(rule.id, now);
                newAlerts.push(alert);

                if (this._persister) {
                    this._persister.persistAlert(alert).catch(() => {});
                }
            }
        }

        // 清理已恢复的告警（计数低于阈值的 50%）
        for (const [alertId, alert] of this._activeAlerts) {
            if (alert.acknowledged) continue;
            const rule = this._rules.find(r => r.id === alert.ruleId);
            if (!rule) continue;
            const agg = aggregations.find(a => a.key === alert.key);
            if (!agg || agg.windowCount < rule.threshold * 0.5) {
                this._activeAlerts.delete(alertId);
                if (this._persister) {
                    this._persister.deleteAlert(alertId).catch(() => {});
                }
            }
        }

        return newAlerts;
    }

    /** 获取所有活跃告警（按严重程度 + 触发时间排序） */
    getAlerts() {
        const severityOrder = { critical: 0, warning: 1, info: 2 };
        const alerts = Array.from(this._activeAlerts.values());
        alerts.sort((a, b) => {
            const so = severityOrder[a.severity] - severityOrder[b.severity];
            if (so !== 0) return so;
            return b.triggeredAt - a.triggeredAt;
        });
        return alerts;
    }

    /** 确认告警（标记为已处理） */
    acknowledge(alertId) {
        const alert = this._activeAlerts.get(alertId);
        if (!alert) return false;
        alert.acknowledged = true;
        if (this._persister) {
            this._persister.persistAlert(alert).catch(() => {});
        }
        return true;
    }

    /** 清空所有告警 */
    clear() {
        this._activeAlerts.clear();
        this._lastTriggered.clear();
    }

    /** 获取告警统计 */
    getStats() {
        const alerts = Array.from(this._activeAlerts.values());
        return {
            totalAlerts: alerts.length,
            critical: alerts.filter(a => a.severity === 'critical').length,
            warning: alerts.filter(a => a.severity === 'warning').length,
            info: alerts.filter(a => a.severity === 'info').length,
            unacknowledged: alerts.filter(a => !a.acknowledged).length,
            rulesCount: this._rules.length,
            evaluateIntervalMs: this._evaluateIntervalMs,
            persistenceEnabled: !!this._persister
        };
    }

    /** 获取规则列表 */
    getRules() { return [...this._rules]; }
}

module.exports = { AlertEngine };
