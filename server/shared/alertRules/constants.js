'use strict';

/**
 * 告警规则常量定义
 *
 * 包含：评估间隔、冷却时间、内置规则集
 * 文件位置：server/shared/alertRules/constants.js
 */

// 默认评估间隔（30 秒）
const DEFAULT_EVALUATE_INTERVAL_MS = parseInt(process.env.ALERT_EVALUATE_INTERVAL_MS, 10) || 30000;
// 告警冷却时间（避免重复触发，5 分钟）
const ALERT_COOLDOWN_MS = 5 * 60 * 1000;

/**
 * 内置告警规则（Q1: 冻结防止外部修改，符合配置统一管理原则）
 * @typedef {Object} AlertRule
 * @property {string} id - 规则 ID
 * @property {string} name - 规则名称
 * @property {string} description - 规则描述
 * @property {string} severity - critical/warning/info
 * @property {string} keyPattern - 聚合键匹配模式（前缀匹配）
 * @property {number} threshold - 触发阈值（windowCount）
 * @property {number} windowMs - 评估窗口（ms）
 */
const DEFAULT_RULES = Object.freeze([
    Object.freeze({
        id: 'high-error-rate',
        name: '高频错误告警',
        description: '某模块在窗口内错误次数超过阈值',
        severity: 'critical',
        keyPattern: 'level:error',
        threshold: 10,
        windowMs: 5 * 60 * 1000
    }),
    Object.freeze({
        id: 'high-warn-rate',
        name: '高频警告告警',
        description: '某模块在窗口内警告次数超过阈值',
        severity: 'warning',
        keyPattern: 'level:warn',
        threshold: 20,
        windowMs: 5 * 60 * 1000
    }),
    Object.freeze({
        id: 'module-error-spike',
        name: '模块错误激增',
        description: '某模块错误次数超过阈值',
        severity: 'warning',
        keyPattern: 'module:',
        threshold: 5,
        windowMs: 5 * 60 * 1000
    })
]);

module.exports = {
    DEFAULT_EVALUATE_INTERVAL_MS,
    ALERT_COOLDOWN_MS,
    DEFAULT_RULES
};
