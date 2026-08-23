/**
 * 全局通知系统
 *
 * 提供轻量级 toast 通知 API，支持：
 * - 显示成功/错误/警告消息
 * - 错误通知自动附带 traceId（便于用户反馈）
 * - 全局事件总线模式，任意组件可调用 showXxx，由 NotificationContainer 统一渲染
 *
 * 使用方式：
 *   import { showError, showSuccess } from '@/components/notifications';
 *   showError('保存失败', error);  // error 对象含 traceId 时自动显示
 *
 * 文件位置：client/src/components/notifications.js
 */

const MAX_NOTIFICATIONS = 5;
const DEFAULT_DURATION = 5000;

let _container = null;
const _queue = [];

/**
 * 注册通知容器（由 NotificationContainer 组件挂载时调用）
 * @param {Object} api - 容器暴露的 API：{ push(notification) }
 */
export function registerContainer(api) {
    _container = api;
    // 清空待发送队列
    while (_queue.length > 0) {
        const item = _queue.shift();
        _container.push(item);
    }
}

/**
 * 注销容器
 */
export function unregisterContainer() {
    _container = null;
}

function _notify(type, message, options = {}) {
    const notification = {
        id: `n-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type,
        message,
        duration: options.duration ?? DEFAULT_DURATION,
        traceId: options.traceId || null
    };
    if (_container) {
        _container.push(notification);
    } else {
        // 容器未挂载时入队等待
        _queue.push(notification);
        if (_queue.length > MAX_NOTIFICATIONS) _queue.shift();
    }
    return notification.id;
}

/**
 * 显示错误通知（支持从 axios error 提取 traceId）
 * @param {string} message - 错误消息
 * @param {Object} error - 可选，axios 错误对象或含 traceId 的 Error
 */
export function showError(message, error = null) {
    const traceId = error?.traceId || error?.response?.data?.traceId || null;
    _notify('error', message, { traceId, duration: 8000 });
}

/**
 * 显示成功通知
 * @param {string} message
 */
export function showSuccess(message) {
    _notify('success', message, { duration: 3000 });
}

/**
 * 显示警告通知
 * @param {string} message
 */
export function showWarn(message) {
    _notify('warn', message, { duration: 5000 });
}

/**
 * 显示信息通知
 * @param {string} message
 */
export function showInfo(message) {
    _notify('info', message, { duration: 4000 });
}
