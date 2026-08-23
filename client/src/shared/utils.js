/**
 * 通用字符串工具函数
 */

/**
 * 安全地将任意值转为字符串，不抛出异常
 * @param {any} v
 * @returns {string}
 */
export function safeStr(v) {
    if (v == null) return '';
    if (typeof v === 'string') return v;
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    try { return JSON.stringify(v); } catch { return String(v); }
}

/**
 * 截断字符串到指定长度
 * @param {string} str
 * @param {number} maxLen
 * @param {string} suffix
 * @returns {string}
 */
export function truncate(str, maxLen = 100, suffix = '...') {
    const s = safeStr(str);
    if (s.length <= maxLen) return s;
    return s.substring(0, maxLen - suffix.length) + suffix;
}

/**
 * 转义 HTML 特殊字符
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
    const s = safeStr(str);
    return s.replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * 计算中文字数（去除空白字符）
 * @param {string} str
 * @returns {number}
 */
export function wordCount(str) {
    if (!str) return 0;
    return str.replace(/\s/g, '').length;
}

/**
 * 驼峰转中划线命名
 * @param {string} str
 * @returns {string}
 */
export function camelToKebab(str) {
    return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

/**
 * 生成 UUID v4
 * @returns {string}
 */
export function uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}

/**
 * 格式化字节大小
 * @param {number} bytes
 * @returns {string}
 */
export function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 防抖函数
 * @param {Function} fn
 * @param {number} delay
 * @returns {Function}
 */
export function debounce(fn, delay = 300) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
}

/**
 * 节流函数
 * @param {Function} fn
 * @param {number} interval
 * @returns {Function}
 */
export function throttle(fn, interval = 300) {
    let last = 0;
    return (...args) => {
        const now = Date.now();
        if (now - last >= interval) {
            last = now;
            fn(...args);
        }
    };
}

/* ESM-only — no module.exports needed */
