'use strict';

/**
 * 告警规则引擎聚合入口
 * 对外保持 require('shared/alertRules') 路径不变
 * 文件位置：server/shared/alertRules/index.js
 */

const { AlertEngine } = require('./alertEngine');
const {
    DEFAULT_RULES,
    DEFAULT_EVALUATE_INTERVAL_MS,
    ALERT_COOLDOWN_MS
} = require('./constants');

// 单例
const alertEngine = new AlertEngine();

module.exports = {
    AlertEngine,
    alertEngine,
    DEFAULT_RULES,
    DEFAULT_EVALUATE_INTERVAL_MS,
    ALERT_COOLDOWN_MS
};
