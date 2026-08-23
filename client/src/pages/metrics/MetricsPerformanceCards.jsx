/**
 * 性能监控卡片集合（G1：对接 M1/M2/M3 后端指标）
 *
 * 包含：
 * - HttpSummaryCard：HTTP 请求总览（M2）
 * - SlowRoutesCard：慢路由 Top5（M2）
 * - SlowestStepsCard：最慢步骤 Top5（M3）
 * - LlmLatencyCard：LLM 延迟指标（M1）
 * - QuotaPredictionCard：配额预测
 *
 * 文件位置：client/src/pages/metrics/MetricsPerformanceCards.jsx
 */

import { formatMs, formatNumber } from './metricsUtils';

/**
 * HTTP 请求总览卡片（M2）
 */
export function HttpSummaryCard({ summary }) {
    if (!summary) return null;
    return (
        <div className="metrics-card">
            <div className="metrics-card-title">HTTP 请求</div>
            <div className="metrics-card-grid">
                <div className="metrics-stat">
                    <span className="metrics-stat-value">{formatNumber(summary.totalRequests)}</span>
                    <span className="metrics-stat-label">总请求</span>
                </div>
                <div className="metrics-stat">
                    <span className="metrics-stat-value metrics-stat-error">{formatNumber(summary.totalFailures)}</span>
                    <span className="metrics-stat-label">失败</span>
                </div>
                <div className="metrics-stat">
                    <span className="metrics-stat-value metrics-stat-error">{formatNumber(summary.totalSlowRequests)}</span>
                    <span className="metrics-stat-label">慢请求</span>
                </div>
            </div>
        </div>
    );
}

/**
 * LLM 延迟指标卡片（M1）
 */
export function LlmLatencyCard({ summary, providers }) {
    if (!summary) return null;
    // 从 providers 中提取最大 p95LatencyMs
    let maxP95 = 0;
    if (providers) {
        for (const data of Object.values(providers)) {
            if (data.p95LatencyMs > maxP95) maxP95 = data.p95LatencyMs;
        }
    }
    return (
        <div className="metrics-card">
            <div className="metrics-card-title">LLM 延迟</div>
            <div className="metrics-card-grid">
                <div className="metrics-stat">
                    <span className="metrics-stat-value">{formatMs(summary.maxLatencyMs)}</span>
                    <span className="metrics-stat-label">最大延迟</span>
                </div>
                <div className="metrics-stat">
                    <span className="metrics-stat-value">{formatMs(maxP95)}</span>
                    <span className="metrics-stat-label">P95 延迟</span>
                </div>
                <div className="metrics-stat">
                    <span className="metrics-stat-value metrics-stat-error">{formatNumber(summary.totalSlowRequests)}</span>
                    <span className="metrics-stat-label">慢调用数</span>
                </div>
            </div>
        </div>
    );
}

/**
 * 慢路由 Top5 卡片（M2）
 */
export function SlowRoutesCard({ slowRoutes }) {
    if (!slowRoutes || slowRoutes.length === 0) return null;
    return (
        <div className="metrics-card metrics-card-wide">
            <div className="metrics-card-title">慢路由 Top5（按 P95 排序）</div>
            <div className="metrics-table-wrap">
                <table className="metrics-table">
                    <thead>
                        <tr><th>路由</th><th>请求数</th><th>P95 耗时</th><th>平均耗时</th><th>慢请求数</th></tr>
                    </thead>
                    <tbody>
                        {slowRoutes.map((r, i) => (
                            <tr key={i}>
                                <td>{r.route}</td>
                                <td>{formatNumber(r.count)}</td>
                                <td className={r.p95Ms >= 3000 ? 'metrics-text-error' : ''}>{formatMs(r.p95Ms)}</td>
                                <td>{formatMs(r.avgMs)}</td>
                                <td className={r.slowCount > 0 ? 'metrics-text-error' : ''}>{formatNumber(r.slowCount)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

/**
 * 最慢步骤 Top5 卡片（M3）
 */
export function SlowestStepsCard({ slowestSteps }) {
    if (!slowestSteps || slowestSteps.length === 0) return null;
    return (
        <div className="metrics-card metrics-card-wide">
            <div className="metrics-card-title">最慢步骤 Top5（按 P95 排序）</div>
            <div className="metrics-table-wrap">
                <table className="metrics-table">
                    <thead>
                        <tr><th>步骤</th><th>执行数</th><th>P50</th><th>P95</th><th>P99</th><th>平均</th></tr>
                    </thead>
                    <tbody>
                        {slowestSteps.map((s, i) => (
                            <tr key={i}>
                                <td>{s.stepName}</td>
                                <td>{formatNumber(s.count)}</td>
                                <td>{formatMs(s.p50Ms)}</td>
                                <td className={s.p95Ms >= 30000 ? 'metrics-text-error' : ''}>{formatMs(s.p95Ms)}</td>
                                <td>{formatMs(s.p99Ms)}</td>
                                <td>{formatMs(s.avgMs)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

/**
 * 配额预测卡片
 */
export function QuotaPredictionCard({ prediction }) {
    if (!prediction) return null;
    const hoursToExhaustion = prediction.hoursToExhaustion;
    const willExhaust = hoursToExhaustion !== null && hoursToExhaustion !== undefined;
    return (
        <div className="metrics-card">
            <div className="metrics-card-title">配额预测</div>
            <div className="metrics-card-grid">
                <div className="metrics-stat">
                    <span className="metrics-stat-value">{formatNumber(prediction.hourlyTokenRate)}</span>
                    <span className="metrics-stat-label">小时消耗</span>
                </div>
                <div className="metrics-stat">
                    <span className="metrics-stat-value">{formatNumber(prediction.remainingTokens)}</span>
                    <span className="metrics-stat-label">剩余配额</span>
                </div>
                <div className="metrics-stat">
                    <span className={`metrics-stat-value ${willExhaust && hoursToExhaustion < 24 ? 'metrics-stat-error' : ''}`}>
                        {willExhaust ? `${hoursToExhaustion.toFixed(1)}h` : '∞'}
                    </span>
                    <span className="metrics-stat-label">预计耗尽</span>
                </div>
            </div>
        </div>
    );
}
