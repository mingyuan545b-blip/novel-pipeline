'use strict';

/**
 * 输入验证与净化中间件
 *
 * 职责：
 * 1. 截断超长字符串，防止日志膨胀与内存攻击
 * 2. 清洗 XSS 危险模式（<script>、javascript:、onXxx= 事件处理器）
 * 3. 递归净化嵌套对象（深度上限 10，防止循环引用栈溢出）
 *
 * 清洗策略：strip（移除匹配片段），而非 escape（转义）。
 * 原因：本项目主要消费 JSON API，前端使用 React（默认转义），
 * 章节内容等富文本场景由专用白名单过滤器处理，此处只做通用兜底。
 *
 * 文件位置：server/middleware/inputSanitizer.js
 */

const MAX_BODY_SIZE = 10 * 1024 * 1024;
const MAX_STRING_LENGTH = 100000;
const MAX_SANITIZE_DEPTH = 10;

// XSS 危险模式：按顺序匹配，先移除 script 标签，再移除 javascript: 协议与事件处理器
const DANGEROUS_PATTERNS = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript\s*:/gi,
    /\bon\w+\s*=/gi
];

/**
 * 净化字符串：截断超长 + 移除 XSS 危险模式
 * @param {string} str - 待净化的字符串
 * @returns {string} 净化后的字符串
 */
function sanitizeString(str) {
    if (typeof str !== 'string') return str;
    let result = str;
    // 先移除 XSS 危险模式
    for (const pattern of DANGEROUS_PATTERNS) {
        result = result.replace(pattern, '');
    }
    // 再截断超长字符串
    if (result.length > MAX_STRING_LENGTH) {
        return result.substring(0, MAX_STRING_LENGTH);
    }
    return result;
}

/**
 * 递归净化对象（含数组）
 * @param {*} obj - 待净化的值
 * @param {number} [depth=0] - 当前递归深度
 * @returns {*} 净化后的值
 */
function sanitizeObject(obj, depth = 0) {
    if (depth > MAX_SANITIZE_DEPTH) return obj;
    if (obj === null || obj === undefined) return obj;
    if (typeof obj === 'string') return sanitizeString(obj);
    if (typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(item => sanitizeObject(item, depth + 1));
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
        result[key] = sanitizeObject(value, depth + 1);
    }
    return result;
}

/**
 * Express 中间件：净化 req.body 与 req.query
 * 注意：Express 5+ 中 req.query 是只读 getter，不能整体赋值，需逐属性就地净化
 */
function inputSanitizer(req, res, next) {
    if (req.body && typeof req.body === 'object') {
        req.body = sanitizeObject(req.body);
    }
    if (req.query && typeof req.query === 'object') {
        // Express 5+ req.query 只有 getter，不能整体赋值
        // 就地净化每个属性值，不增删 key
        for (const key of Object.keys(req.query)) {
            req.query[key] = sanitizeObject(req.query[key]);
        }
    }
    next();
}

module.exports = {
    inputSanitizer,
    sanitizeString,
    sanitizeObject,
    DANGEROUS_PATTERNS,
    MAX_STRING_LENGTH,
    MAX_SANITIZE_DEPTH
};
