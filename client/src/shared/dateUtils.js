/**
 * 通用日期工具函数
 */

/**
 * 格式化时间戳为 YYYYMMDD HH:mm:ss
 * @param {string|number|Date} ts
 * @returns {string}
 */
export function formatTimestamp(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    if (isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/**
 * 格式化时间戳为 YYYY-MM-DD
 * @param {string|number|Date} ts
 * @returns {string}
 */
export function formatDate(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    if (isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * 格式化时间戳为 HH:mm
 * @param {string|number|Date} ts
 * @returns {string}
 */
export function formatTime(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    if (isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * 计算相对时间（如 5分钟前、2小时前、3天前）
 * @param {string|number|Date} ts
 * @returns {string}
 */
export function formatRelative(ts) {
    if (!ts) return '';
    const now = Date.now();
    const d = new Date(ts).getTime();
    if (isNaN(d)) return '';

    const diff = now - d;
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`;
    return formatDate(ts);
}

/**
 * 计算持续时间（毫秒 → 人类可读）
 * @param {number} ms
 * @returns {string}
 */
export function formatDuration(ms) {
    if (!ms || ms < 0) return '0s';
    if (ms < 1000) return `${ms}ms`;
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
}

/* ESM-only — no module.exports needed */
