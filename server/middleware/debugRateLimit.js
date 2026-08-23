/**
 * debugRateLimit.js — G6: debug 路由独立限流
 *
 * debug 路由用于日志检索和错误追踪，访问频率不应过高。
 * 独立限流防止日志扫描攻击和大量 trace 检索拖垮服务。
 *
 * 限流策略：
 *   - 窗口：60 秒
 *   - 上限：30 次/分钟（比 globalLimiter 200 次/分钟更严格）
 *   - 命中后返回 429，提示稍后重试
 *
 * 文件位置：server/middleware/debugRateLimit.js
 */
'use strict';

const rateLimit = require('express-rate-limit');

// debug 路由限流配置（G6）
const DEBUG_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const DEBUG_RATE_LIMIT_MAX = 30;

const debugLimiter = rateLimit({
    windowMs: DEBUG_RATE_LIMIT_WINDOW_MS,
    max: DEBUG_RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: 'Debug API 请求过于频繁，请稍后再试（每分钟最多 30 次）'
    }
});

module.exports = {
    debugLimiter,
    DEBUG_RATE_LIMIT_WINDOW_MS,
    DEBUG_RATE_LIMIT_MAX
};
