/**
 * 辅助系统降级计数器
 * 用于统计genreInjector/materialUpdateProcessor等辅助系统的静默失败次数
 * 在pipeline执行结束后汇总上报，避免辅助系统持续失败但用户不知情
 */

const counters = new Map();

/**
 * 记录一次辅助系统降级
 * @param {string} systemName - 系统名称（如 'genreInjector', 'materialUpdate'）
 * @param {string} submodule - 子模块（如 'genreProfile', 'namingStyle'）
 * @param {string} errorMessage - 错误信息
 */
function recordDegradation(systemName, submodule, errorMessage) {
    const key = `${systemName}:${submodule}`;
    if (!counters.has(key)) {
        counters.set(key, { systemName, submodule, count: 0, lastError: '', lastTime: null });
    }
    const entry = counters.get(key);
    entry.count++;
    entry.lastError = errorMessage || 'unknown';
    entry.lastTime = new Date().toISOString();
}

/**
 * 获取并清空当前累计的降级记录
 * @returns {Array} 降级记录数组
 */
function drainDegradations() {
    const entries = [...counters.values()];
    counters.clear();
    return entries;
}

/**
 * 获取当前累计的降级记录（不清空）
 * @returns {Array} 降级记录数组
 */
function peekDegradations() {
    return [...counters.values()];
}

/**
 * 汇总降级记录为日志消息
 * @param {string} context - 上下文（如 'chapter-5', 'pipeline-run-xxx'）
 * @returns {string|null} 汇总消息，无降级则返回null
 */
function summarizeDegradations(context) {
    const entries = peekDegradations();
    if (entries.length === 0) return null;
    const total = entries.reduce((sum, e) => sum + e.count, 0);
    const details = entries.map(e => `${e.systemName}.${e.submodule}(${e.count}次)`).join(', ');
    return `[${context}] 辅助系统降级汇总: 共${total}次降级 — ${details}`;
}

module.exports = {
    recordDegradation,
    drainDegradations,
    peekDegradations,
    summarizeDegradations,
};
