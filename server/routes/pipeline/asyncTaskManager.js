const MAX_ASYNC_TASKS = 100;
const TASK_CLEANUP_INTERVAL_MS = 10 * 60 * 1000;
const TASK_MAX_AGE_MS = 60 * 60 * 1000;
const TASK_TIMEOUT_MS = 30 * 60 * 1000;

const tasks = new Map();

setInterval(() => {
    const now = Date.now();
    for (const [id, task] of tasks.entries()) {
        const age = now - (task.startedAt || task.completedAt || now);
        if (task.status !== 'running' && age > TASK_MAX_AGE_MS) {
            tasks.delete(id);
        }
        if (task.status === 'running' && age > TASK_TIMEOUT_MS) {
            task.status = 'timeout';
            task.error = 'Task timed out (30min)';
            task.completedAt = now;
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
    if (task) Object.assign(task, updates);
}

module.exports = { tasks, createTask, getTask, updateTask };
