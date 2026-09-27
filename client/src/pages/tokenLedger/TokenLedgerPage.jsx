/**
 * TokenLedgerPage.jsx — Token 去向面板
 * 回答三件事：token 花在哪、哪个环节最费、哪里被截断/烧在返修上。
 * 支持按场景（战斗/社交/探索…）筛选，切换即时重算。
 */
import useTokenLedgerState from './useTokenLedgerState';
import TokenSummaryCards from './TokenSummaryCards';
import TokenSharePanel from './TokenSharePanel';
import TokenTrendChart from './TokenTrendChart';
import TokenAlertsPanel from './TokenAlertsPanel';
import TokenChapterTable from './TokenChapterTable';
import { sceneOptions } from './tokenLedgerFilter';
import { decorateSteps } from './tokenLedgerConstants';
import { formatPct } from './tokenLedgerFormat';
import s from './tokenLedger.module.css';

const METRIC_TABS = [
    { key: 'total', label: '总消耗' },
    { key: 'perK', label: '每千字效率' },
    { key: 'cache', label: '缓存命中' },
];

export default function TokenLedgerPage() {
    const {
        currentProject, data, loading, error, load,
        sceneKey, metric, setSceneKey, setMetric,
        detail, toggleChapter,
    } = useTokenLedgerState();

    if (!currentProject) {
        return <div className={s.emptyState}><div className={s.emptyIcon}>🎯</div><div>请先在顶部选择一个项目</div></div>;
    }
    if (loading && !data) return <div className={s.loading}>正在统计 token 去向…</div>;
    if (error) return <div className={s.errorBox}>加载失败：{error}<button className={s.btn} onClick={load}>重试</button></div>;

    const scenes = sceneOptions(data);
    const totals = data?.totals;
    const hasData = data?.hasData;

    return (
        <div className={s.page}>
            <div className={s.header}>
                <div>
                    <h1 className={s.title}>🎯 Token 去向</h1>
                    <p className={s.subtitle}>
                        每章花了多少 token、分别花在哪个环节、哪几段被预算截断 —— 让上下文成本一目了然
                    </p>
                </div>
                <div className={s.headerActions}>
                    <button className={s.btn} onClick={load} disabled={loading}>{loading ? '统计中…' : '🔄 刷新'}</button>
                </div>
            </div>

            {!hasData ? (
                <div className={s.emptyState}>
                    <div className={s.emptyIcon}>📭</div>
                    <div>该项目还没有 token 账本</div>
                    <div className={s.emptyTip}>跑一章流水线后即可看到数据；历史项目可执行 <code>node scripts/backfillTokenLedger.js --apply</code> 回填</div>
                </div>
            ) : (
                <>
                    <SceneFilter scenes={scenes} active={sceneKey} onPick={setSceneKey} chapters={totals?.chapters} />
                    <InsightLine data={data} />
                    <TokenSummaryCards totals={totals} />

                    <div className={s.twoCol}>
                        <TokenSharePanel title="💰 Token 花在哪" hint="按提示词分段（可看出上下文里谁最占地方）"
                            items={data.bySection} />
                        <TokenSharePanel title="🏭 哪个环节最费" hint="按流水线步骤（返修/审核往往比执笔更贵）"
                            items={decorateSteps(data.byStep)} />
                    </div>

                    <div className={s.panel}>
                        <div className={s.panelHead}>
                            <h3 className={s.panelTitle}>📈 逐章趋势</h3>
                            <div className={s.tabs}>
                                {METRIC_TABS.map(t => (
                                    <button key={t.key} className={`${s.tab} ${metric === t.key ? s.tabOn : ''}`}
                                        onClick={() => setMetric(t.key)}>{t.label}</button>
                                ))}
                            </div>
                        </div>
                        <TokenTrendChart trend={data.trend} metric={metric} onSelectChapter={toggleChapter} />
                    </div>

                    <TokenAlertsPanel alerts={data.alerts} onJumpChapter={toggleChapter} />

                    <div className={s.panel}>
                        <div className={s.panelHead}>
                            <h3 className={s.panelTitle}>📋 逐章明细</h3>
                            <span className={s.panelHint}>{coverageHint(data.chapters)}</span>
                        </div>
                        <TokenChapterTable chapters={data.chapters} detail={detail} onToggleChapter={toggleChapter} />
                    </div>
                </>
            )}
        </div>
    );
}

function SceneFilter({ scenes, active, onPick, chapters }) {
    if (!scenes || scenes.length === 0) return null;
    return (
        <div className={s.filterBar}>
            <span className={s.filterLabel}>场景筛选</span>
            <button className={`${s.chip} ${!active ? s.chipOn : ''}`} onClick={() => onPick('')}>
                全部（{chapters || 0}章）
            </button>
            {scenes.map(sc => (
                <button key={sc.key} className={`${s.chip} ${active === sc.key ? s.chipOn : ''}`}
                    onClick={() => onPick(active === sc.key ? '' : sc.key)}>
                    {sc.label}（{sc.chapters}章 · {formatPct(sc.share)}）
                </button>
            ))}
        </div>
    );
}

/** 明细表提示：哪些章缺记录（执行日志会被轮转清理，需解释清楚避免误判） */
function coverageHint(chapters) {
    const list = chapters || [];
    if (list.length === 0) return '点击任意一行，展开该章每一次模型调用的 token 明细';
    const max = Math.max(...list.map(c => c.chapter));
    const gaps = [];
    for (let i = 1; i <= max; i++) { if (!list.some(c => c.chapter === i)) gaps.push(i); }
    const base = '点击任意一行，展开该章每一次模型调用的 token 明细';
    return gaps.length > 0
        ? `${base} · 第${gaps.join('、')}章无记录（该章执行日志已被轮转清理或未产生 token 用量）`
        : base;
}

/** 一句话结论：让不看数字的人也能知道问题在哪 */
function InsightLine({ data }) {
    const top = data?.bySection?.[0];
    const trunc = (data?.bySection || []).filter(x => x.truncatedCount > 0);
    if (!top) return null;
    return (
        <div className={s.insight}>
            <span>最大头是「{top.label}」，占 {formatPct(top.share)}</span>
            {trunc.length > 0 && (
                <span className={s.insightWarn}>
                    另有 {trunc.length} 类内容被预算截断（{trunc.map(x => x.label).join('、')}），规则与素材可能没真正进到模型里
                </span>
            )}
        </div>
    );
}
