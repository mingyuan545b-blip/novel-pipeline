import './knowledge.css';

const STORYLINE_BADGE = {
    main: { label: '主线', className: 'foreshadow-badge-mainline' },
    sub: { label: '支线', className: 'foreshadow-badge-subline' }
};

function getSummary(f) {
    const content = f.currentContent || f.description || '';
    const summaryMatch = content.match(/(?:【?简介?】?|【?概述?】?|【?描述?】?|【?内容?】?)[：:]\s*([^\n]+)/);
    if (summaryMatch) return summaryMatch[1].trim();
    const lines = content.split('\n').filter(l => l.trim() && !l.startsWith('【'));
    if (lines.length > 0) return lines[0].trim().substring(0, 120);
    return content.substring(0, 120).trim();
}

function formatTime(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    const bj = new Date(d.getTime() + 8 * 3600000);
    return `${bj.getUTCFullYear()}-${String(bj.getUTCMonth() + 1).padStart(2, '0')}-${String(bj.getUTCDate()).padStart(2, '0')} ${String(bj.getUTCHours()).padStart(2, '0')}:${String(bj.getUTCMinutes()).padStart(2, '0')}`;
}

function ChapterLifecycle({ foreshadow }) {
    const logs = foreshadow.changeLog || [];
    if (logs.length === 0) return <span className="text-muted">暂无章节记录</span>;

    const startLog = logs[0];
    const changeLogs = logs.slice(1).filter(l => !l.to?.startsWith('[recycle]') && l.reason !== 'recycle');
    const recycleLog = logs.find(l => l.to?.startsWith('[recycle]') || l.reason === 'recycle' || l.reason?.includes('回收'));

    return (
        <div className="foreshadow-lifecycle">
            <div className="foreshadow-lifecycle-row">
                <span className="foreshadow-badge foreshadow-badge-plant">埋设</span>
                <span className="foreshadow-chapter-label">第{startLog.chapterNumber || '?'}章</span>
                {startLog.timestamp && <span className="foreshadow-timestamp">{formatTime(startLog.timestamp)}</span>}
            </div>
            {changeLogs.map((l, i) => (
                <div key={i} className="foreshadow-lifecycle-row foreshadow-lifecycle-indent">
                    <span className="foreshadow-badge foreshadow-badge-change">变化</span>
                    <span className="foreshadow-chapter-label">第{l.chapterNumber || '?'}章</span>
                    {l.reason && <span className="foreshadow-reason">{l.reason}</span>}
                    {l.timestamp && <span className="foreshadow-timestamp">{formatTime(l.timestamp)}</span>}
                </div>
            ))}
            {recycleLog ? (
                <div className="foreshadow-lifecycle-row foreshadow-lifecycle-indent">
                    <span className="foreshadow-badge foreshadow-badge-recycle">回收</span>
                    <span className="foreshadow-chapter-label">第{recycleLog.chapterNumber || '?'}章</span>
                    {recycleLog.reason && <span className="foreshadow-reason">{recycleLog.reason}</span>}
                </div>
            ) : (
                <div className="foreshadow-lifecycle-row foreshadow-lifecycle-indent">
                    <span className="foreshadow-badge foreshadow-badge-pending">⏳ 待回收</span>
                </div>
            )}
        </div>
    );
}

export default function ForeshadowPanel({ foreshadowings, onRefresh }) {
    // 防御性处理：确保 foreshadowings 是数组
    const safeForeshadowings = Array.isArray(foreshadowings) ? foreshadowings : [];
    const active = safeForeshadowings.filter(f => f && f.status !== 'recycle' && !f.archived);
    const recycled = safeForeshadowings.filter(f => f && (f.status === 'recycle' || f.archived));

    return (
        <div>
            <div className="foreshadow-header">
                <h3 className="foreshadow-header-title">伏笔追踪器</h3>
                <button className="cyber-btn cyber-btn-sm" onClick={onRefresh}>刷新</button>
            </div>

            {active.length > 0 && (
                <div className="mb-20">
                    <div className="foreshadow-section-title text-blue">进行中 ({active.length})</div>
                    <div className="foreshadow-list">
                        {active.map(f => {
                            const summary = getSummary(f);
                            return (
                                <div key={f.id} className="foreshadow-item foreshadow-item-active">
                                    <div className="foreshadow-item-name">
                                        {f.name}
                                        {(() => {
                                            const sl = STORYLINE_BADGE[f.storyline || 'sub'] || STORYLINE_BADGE.sub;
                                            return <span className={`foreshadow-badge ${sl.className}`}>{sl.label}</span>;
                                        })()}
                                    </div>
                                    {summary && <div className="foreshadow-item-summary">{summary}</div>}
                                    <ChapterLifecycle foreshadow={f} />
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {recycled.length > 0 && (
                <div>
                    <div className="foreshadow-section-title text-green">已回收 ({recycled.length})</div>
                    <div className="foreshadow-list">
                        {recycled.map(f => {
                            const summary = getSummary(f);
                            return (
                                <div key={f.id} className="foreshadow-item foreshadow-item-recycled">
                                    <div className="foreshadow-item-name">
                                        {f.name}
                                        {(() => {
                                            const sl = STORYLINE_BADGE[f.storyline || 'sub'] || STORYLINE_BADGE.sub;
                                            return <span className={`foreshadow-badge ${sl.className}`}>{sl.label}</span>;
                                        })()}
                                    </div>
                                    {summary && <div className="foreshadow-item-summary">{summary}</div>}
                                    <ChapterLifecycle foreshadow={f} />
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {active.length === 0 && recycled.length === 0 && (
                <div className="foreshadow-empty">暂无伏笔数据，完成章节创作后自动生成</div>
            )}
        </div>
    );
}
