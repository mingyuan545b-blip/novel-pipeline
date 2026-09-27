/**
 * 健康检查的运行时探针（从 healthSummaryHandler 拆出，保证文件≤200行、函数≤100行）。
 * 汇总 LLM 超时/慢请求与流水线任务看门狗两项非致命预警；指标不可用时静默跳过，不影响健康检查。
 */
function collectRuntimeProbes(checks, errors, warnings) {
    // LLM 超时/慢请求预警（2026-09-21）：把"网关悬挂"从"只能翻日志"变成可观测指标
    try {
        const llmTimeoutTracker = require('../services/llmTimeoutTracker');
        const llmStats = llmTimeoutTracker.snapshot();
        checks['llm-latency'] = {
            source: 'runtime',
            totalRequests: llmStats.totalRequests,
            timeouts: llmStats.timeouts,
            slowRequests: llmStats.slowRequests,
            consecutiveTimeouts: llmStats.consecutiveTimeouts,
            lastTimeout: llmStats.lastTimeout,
            degraded: llmStats.degraded,
            ok: !llmStats.degraded
        };
        if (llmStats.degraded) errors.push(`LLM 连续 ${llmStats.consecutiveTimeouts} 次超时，疑似供应商网关异常`);
        else if (llmStats.timeouts > 0) warnings.push(`LLM 累计超时 ${llmStats.timeouts} 次（最近: ${llmStats.lastTimeout?.provider}/${llmStats.lastTimeout?.model}）`);
    } catch (e) { /* 指标不可用时不影响健康检查 */ }

    // 任务看门狗：是否存在长时间 running 的流水线任务（LLM 悬挂的直接后果）
    try {
        const taskSnapshot = require('./pipeline/asyncTaskManager').snapshot();
        checks['pipeline-tasks'] = {
            source: 'runtime',
            running: taskSnapshot.running,
            longestRunningMs: taskSnapshot.longestRunningMs,
            timeouts: taskSnapshot.timeouts,
            ok: taskSnapshot.longestRunningMs < 30 * 60 * 1000
        };
        if (taskSnapshot.timeouts > 0) warnings.push(`有 ${taskSnapshot.timeouts} 个流水线任务被看门狗判定超时`);
    } catch (e) { /* 同上 */ }
}

module.exports = { collectRuntimeProbes };
