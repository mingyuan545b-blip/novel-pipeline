/**
 * asyncTaskManager — 异步任务注册表 + 看门狗
 *
 * 修复（2026-09-21 20章E2E）：
 *  1) 原实现把卡死任务标成 status='timeout'，但**没有任何消费方识别这个状态**
 *     （前端只认 completed/failed，脚本只认 completed/failed）→ 任务永远显示 running，
 *     实测一次任务卡死 13 分钟，前端与验证脚本一直空转轮询。
 *     现在：导出 isTerminal / terminalReason，前端与脚本统一按此判断。
 *  2) 扫描间隔从 10 分钟降到 60 秒，避免最长 40 分钟才被发现。
 *  3) 超时/卡死同时打 ERROR 日志（原来静默改状态）。
 */
const logger = require('../../shared/logger');

const MAX_ASYNC_TASKS = 100;
const TASK_CLEANUP_INTERVAL_MS = 60 * 1000;
const TASK_MAX_AGE_MS = 60 * 60 * 1000;
const TASK_TIMEOUT_MS = 30 * 60 * 1000;

/** 终止态：消费方只应依赖这个判定，不要再硬编码字符串 */
const TERMINAL_STATUSES = new Set(['completed', 'done', 'failed', 'error', 'timeout', 'cancelled']);

function isTerminal(status) {
    return TERMINAL_STATUSES.has(status);
}

function isSuccess(status) {
    return status === 'completed' || status === 'done';
}

function terminalReason(task) {
    if (!task || !isTerminal(task.status)) return null;
    if (isSuccess(task.status)) return null;
    return task.error || (task.status === 'timeout' ? `任务超时（${Math.round(TASK_TIMEOUT_MS / 60000)}分钟无进展）` : '任务失败');
}

const tasks = new Map();

const _watchdogTimer = setInterval(() => {
    const now = Date.now();
    for (const [id, task] of tasks.entries()) {
        const age = now - (task.startedAt || task.completedAt || now);
        if (task.status !== 'running' && age > TASK_MAX_AGE_MS) {
            tasks.delete(id);
        }
        if (task.status === 'running' && age > TASK_TIMEOUT_MS) {
            task.status = 'timeout';
            task.error = `任务超时（${Math.round(TASK_TIMEOUT_MS / 60000)}分钟无进展，疑似LLM调用悬挂）`;
            task.completedAt = now;
            logger.error('asyncTask', `[WATCHDOG] 任务卡死已终止: ${id}（运行 ${Math.round(age / 60000)} 分钟）`, {
                taskId: id, ageMs: age, errorCode: 'TASK_WATCHDOG_TIMEOUT'
            });
        }
    }
    if (tasks.size > MAX_ASYNC_TASKS) {
        const entries = [...tasks.entries()]
            .filter(([_, t]) => t.status !== 'running')
            .sort((a, b) => (a[1].completedAt || a[1].startedAt) - (b[1].completedAt || b[1].startedAt));
        const toDelete = entries.slice(0, tasks.size - MAX_ASYNC_TASKS + 10);
        for (const [id] of toDelete) tasks.delete(id);
    }
}, TASK_CLEANUP_INTERVAL_MS);
// 定时器不应阻止进程退出（测试/CLI 脚本会被它挂住）
if (typeof _watchdogTimer.unref === 'function') _watchdogTimer.unref();

function createTask(prefix) {
    const taskId = prefix + '_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
    tasks.set(taskId, { status: 'running', progress: 0, result: null, error: null, startedAt: Date.now() });
    return taskId;
}

function getTask(taskId) {
    return tasks.get(taskId);
}

function updateTask(taskId, updates) {
    const task = tasks.get(taskId);
    if (task) {
        // 已终止的任务不再被后续写入改回 running（防止悬挂回调"复活"任务）
        if (task.status === 'timeout' && updates.status === 'running') return;
        Object.assign(task, updates);
    }
}

/** 看门狗快照（供健康检查暴露当前是否有卡死任务） */
function snapshot() {
    const now = Date.now();
    const running = [...tasks.entries()].filter(([, t]) => t.status === 'running');
    return {
        total: tasks.size,
        running: running.length,
        longestRunningMs: running.reduce((m, [id, t]) => {
            const age = now - (t.startedAt || now);
            return age > m.age ? { taskId: id, age } : m;
        }, { taskId: null, age: 0 }).age,
        timeouts: [...tasks.values()].filter(t => t.status === 'timeout').length
    };
}

module.exports = { tasks, createTask, getTask, updateTask, isTerminal, isSuccess, terminalReason, snapshot, TASK_TIMEOUT_MS };
