/**
 * ProgressPage — 运行看板（/progress）
 *
 * 用户诉求（2026-10-01）："当前进度第多少章、哪个 Agent 在干什么、用了多久、第几轮"。
 * 数据由 GET /api/pipeline/progress/:projectId 一次取齐（服务端组装，避免前端多请求时序不一致）。
 */
import useProgressState from './progress/useProgressState';
import ProgressOverview from './progress/ProgressOverview';
import CurrentStepPanel from './progress/CurrentStepPanel';
import AgentStatsPanel from './progress/AgentStatsPanel';
import StepTimelinePanel from './progress/StepTimelinePanel';
import { fmtTime } from './progress/progressConstants';
import s from './progress/progress.module.css';

export default function ProgressPage() {
    const st = useProgressState();

    if (!st.projectId) {
        return (
            <div className={s.page}>
                <div className={s.empty}>请先在顶栏选择一个项目，再查看运行进度</div>
            </div>
        );
    }

    return (
        <div className={s.page}>
            <header className={s.head}>
                <div>
                    <h2 className={s.title}>🚀 运行看板</h2>
                    <p className={s.sub}>
                        {st.currentProject?.name || '未命名项目'}
                        {st.updatedAt ? ` · 上次更新 ${fmtTime(new Date(st.updatedAt).toISOString())}` : ''}
                        {st.view?.running ? ' · 运行中每 10 秒自动刷新' : ' · 空闲时每 30 秒刷新'}
                    </p>
                </div>
                <button type="button" className={s.refreshBtn} onClick={st.refresh} disabled={st.loading}>
                    {st.loading ? '刷新中…' : '立即刷新'}
                </button>
            </header>

            {st.error && <div className={s.errorBox}>加载失败：{st.error}</div>}

            <ProgressOverview view={st.view} />

            <div className={s.grid2}>
                <CurrentStepPanel view={st.view} />
                <AgentStatsPanel view={st.view} />
            </div>

            <StepTimelinePanel view={st.view} />
        </div>
    );
}
