import { formatMs, formatNumber } from './metricsUtils';

export function PipelineSummaryCard({ summary }) {
    if (!summary) return null;
    return (
        <div className="metrics-card">
            <div className="metrics-card-title">Pipeline 步骤</div>
            <div className="metrics-card-grid">
                <div className="metrics-stat">
                    <span className="metrics-stat-value">{formatNumber(summary.totalSteps)}</span>
                    <span className="metrics-stat-label">总执行</span>
                </div>
                <div className="metrics-stat">
                    <span className="metrics-stat-value metrics-stat-error">{formatNumber(summary.totalFailures)}</span>
                    <span className="metrics-stat-label">失败</span>
                </div>
                <div className="metrics-stat">
                    <span className="metrics-stat-value">{formatMs(summary.totalMs)}</span>
                    <span className="metrics-stat-label">总耗时</span>
                </div>
            </div>
        </div>
    );
}

export function LlmSummaryCard({ summary }) {
    if (!summary) return null;
    return (
        <div className="metrics-card">
            <div className="metrics-card-title">LLM 调用</div>
            <div className="metrics-card-grid">
                <div className="metrics-stat">
                    <span className="metrics-stat-value">{formatNumber(summary.totalRequests)}</span>
                    <span className="metrics-stat-label">总请求</span>
                </div>
                <div className="metrics-stat">
                    <span className="metrics-stat-value">{formatNumber(summary.totalTokens)}</span>
                    <span className="metrics-stat-label">Token消耗</span>
                </div>
                <div className="metrics-stat">
                    <span className="metrics-stat-value metrics-stat-error">{formatNumber(summary.totalFailures)}</span>
                    <span className="metrics-stat-label">失败</span>
                </div>
            </div>
        </div>
    );
}

export function StepBreakdownCard({ steps }) {
    if (!steps || Object.keys(steps).length === 0) return null;
    const entries = Object.entries(steps).sort((a, b) => b[1].count - a[1].count);
    return (
        <div className="metrics-card metrics-card-wide">
            <div className="metrics-card-title">步骤详情</div>
            <div className="metrics-table-wrap">
                <table className="metrics-table">
                    <thead>
                        <tr><th>步骤</th><th>执行次数</th><th>失败</th><th>平均耗时</th><th>成功率</th></tr>
                    </thead>
                    <tbody>
                        {entries.map(([name, data]) => {
                            const avgMs = data.count > 0 ? Math.round(data.totalMs / data.count) : 0;
                            const rate = data.count > 0 ? ((1 - data.failures / data.count) * 100).toFixed(1) : '-';
                            return (
                                <tr key={name}>
                                    <td>{name}</td>
                                    <td>{data.count}</td>
                                    <td className={data.failures > 0 ? 'metrics-text-error' : ''}>{data.failures}</td>
                                    <td>{formatMs(avgMs)}</td>
                                    <td>{rate}%</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export function ProviderBreakdownCard({ providers }) {
    if (!providers || Object.keys(providers).length === 0) return null;
    const entries = Object.entries(providers);
    return (
        <div className="metrics-card metrics-card-wide">
            <div className="metrics-card-title">LLM Provider 详情</div>
            <div className="metrics-table-wrap">
                <table className="metrics-table">
                    <thead>
                        <tr><th>Provider</th><th>请求</th><th>Token</th><th>失败</th><th>平均Token/请求</th></tr>
                    </thead>
                    <tbody>
                        {entries.map(([name, data]) => {
                            const avgTokens = data.requestCount > 0 ? Math.round(data.totalTokens / data.requestCount) : 0;
                            return (
                                <tr key={name}>
                                    <td>{name}</td>
                                    <td>{data.requestCount}</td>
                                    <td>{formatNumber(data.totalTokens)}</td>
                                    <td className={data.failureCount > 0 ? 'metrics-text-error' : ''}>{data.failureCount}</td>
                                    <td>{formatNumber(avgTokens)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export function SnapshotTimelineCard({ snapshots }) {
    if (!snapshots || snapshots.length === 0) return null;
    return (
        <div className="metrics-card metrics-card-wide">
            <div className="metrics-card-title">快照历史 (最近 {snapshots.length} 个)</div>
            <div className="metrics-table-wrap">
                <table className="metrics-table">
                    <thead>
                        <tr><th>时间</th><th>Pipeline步骤</th><th>Pipeline失败</th><th>LLM请求</th><th>LLM Token</th></tr>
                    </thead>
                    <tbody>
                        {snapshots.map((s, i) => (
                            <tr key={i}>
                                <td>{s.timestamp ? new Date(s.timestamp).toLocaleString('zh-CN') : '-'}</td>
                                <td>{s.pipeline?.summary?.totalSteps ?? '-'}</td>
                                <td className={s.pipeline?.summary?.totalFailures > 0 ? 'metrics-text-error' : ''}>{s.pipeline?.summary?.totalFailures ?? '-'}</td>
                                <td>{s.llm?.summary?.totalRequests ?? '-'}</td>
                                <td>{formatNumber(s.llm?.summary?.totalTokens)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
