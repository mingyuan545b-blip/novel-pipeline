/**
 * contractFieldChecker.js — 契约字段校验工具（纯函数）
 *
 * 从contractValidator.js拆分，负责：
 * - path取值（支持a.b.c）
 * - 单字段类型/长度/范围校验
 *
 * 设计原则：无状态、无IO、可独立测试
 */

/**
 * 按path取值（支持a.b.c路径）
 * @param {Object} obj - 待取值对象
 * @param {string} fieldPath - 字段路径，如 'chapter.outline'
 * @returns {*} 字段值（找不到返回undefined）
 */
function getByPath(obj, fieldPath) {
    return fieldPath.split('.').reduce((acc, key) => (acc == null ? null : acc[key]), obj);
}

/**
 * 校验单个字段
 * @param {*} value - 字段值
 * @param {Object} rule - 校验规则（type/minLength/min/max/severity/errorCode/message）
 * @param {string} fieldLabel - 字段标签（用于错误消息）
 * @returns {Array} 错误列表（每项含severity/errorCode/message）
 */
function validateField(value, rule, fieldLabel) {
    const errors = [];
    const severity = rule.severity || 'CRITICAL';
    const errorCode = rule.errorCode || 'UNKNOWN';
    const message = rule.message || `${fieldLabel}校验失败`;

    // 类型校验
    if (rule.type) {
        const actualType = Array.isArray(value) ? 'array' : typeof value;
        if (actualType !== rule.type) {
            errors.push({
                severity,
                errorCode,
                message: `${message}（期望${rule.type}，实际${actualType}）`
            });
            return errors;
        }
    }

    // 字符串长度校验
    if (rule.type === 'string' && typeof value === 'string') {
        if (rule.minLength !== undefined && value.length < rule.minLength) {
            errors.push({ severity, errorCode, message: `${message}（长度${value.length}<${rule.minLength}）` });
        }
    }

    // 数组长度校验
    if (rule.type === 'array' && Array.isArray(value)) {
        if (rule.minLength !== undefined && value.length < rule.minLength) {
            errors.push({ severity, errorCode, message: `${message}（长度${value.length}<${rule.minLength}）` });
        }
    }

    // 数值范围校验
    if (rule.type === 'number' && typeof value === 'number') {
        if (rule.min !== undefined && value < rule.min) {
            errors.push({ severity, errorCode, message: `${message}（值${value}<${rule.min}）` });
        }
        if (rule.max !== undefined && value > rule.max) {
            errors.push({ severity, errorCode, message: `${message}（值${value}>${rule.max}）` });
        }
    }

    return errors;
}

/**
 * 判断规则是否首章例外
 * @param {Object} rule - 规则对象
 * @param {boolean} isFirstChapter - 是否首章
 * @returns {boolean} 是否跳过校验
 */
function isExceptFirstChapter(rule, isFirstChapter) {
    return Boolean(rule?.exceptFirstChapter && isFirstChapter);
}

/**
 * 按severity分流到errors或warnings
 * @param {Array} errors - CRITICAL收集容器
 * @param {Array} warnings - 非CRITICAL收集容器
 * @param {Object} err - 错误对象（含severity）
 */
function routeBySeverity(errors, warnings, err) {
    if (err.severity === 'CRITICAL') errors.push(err);
    else warnings.push(err);
}

module.exports = {
    getByPath,
    validateField,
    isExceptFirstChapter,
    routeBySeverity
};
