import useMetricsState from './useMetricsState';
import {
    PipelineSummaryCard, LlmSummaryCard, StepBreakdownCard,
    ProviderBreakdownCard, SnapshotTimelineCard
} from './MetricsCards';
import {
    HttpSummaryCard, LlmLatencyCard, SlowRoutesCard,
    SlowestStepsCard, QuotaPredictionCard
} from './MetricsPerformanceCards';
import styles from './metrics.module.css';

export default function MetricsPage() {
    const { metrics, snapshots, quotaPrediction, loading, error, autoRefresh, setAutoRefresh, refresh, triggerSnapshot } = useMetricsState();

    if (loading) return <div className={styles.metricsLoading}>加载监控数据...</div>;
    if (error) return <div className={styles.metricsError}>加载失败: {error}</div>;

    const pipeline = metrics?.pipeline || {};
    const llm = metrics?.llm || {};
    const http = metrics?.http || {};

    return (
        <div className={styles.metricsPage}>
            <div className={styles.metricsHeader}>
                <h2>系统监控</h2>
                <div className={styles.metricsHeaderActions}>
                    <label className={styles.metricsAutoRefresh}>
                        <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} />
                        自动刷新
                    </label>
                    <button className={styles.metricsBtn} onClick={triggerSnapshot} aria-label="手动创建快照">手动快照</button>
                    <button className={styles.metricsBtn} onClick={refresh} aria-label="刷新监控数据">刷新</button>
                </div>
            </div>

            <div className={styles.metricsGrid}>
                {/* 总览卡片 */}
                <PipelineSummaryCard summary={pipeline.summary} />
                <LlmSummaryCard summary={llm.summary} />
                <HttpSummaryCard summary={http.summary} />
                <LlmLatencyCard summary={llm.summary} providers={llm.providers} />
                <QuotaPredictionCard prediction={quotaPrediction} />

                {/* 详情表格 */}
                <StepBreakdownCard steps={pipeline.steps} />
                <ProviderBreakdownCard providers={llm.providers} />

                {/* G1：性能排行卡片 */}
                <SlowestStepsCard slowestSteps={pipeline.slowestSteps} />
                <SlowRoutesCard slowRoutes={http.summary?.slowRoutes} />

                {/* 快照历史 */}
                <SnapshotTimelineCard snapshots={snapshots} />
            </div>
        </div>
    );
}
