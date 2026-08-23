import { useState } from 'react';
import {
    TRACE_ENTITY_TYPES,
    getEntityTypeMeta,
    getOriginMethodLabel,
    getOriginMethodIcon,
    getTraceActionMeta
} from './crossWorldTraceConstants';

/**
 * 单条跨世界溯源卡片
 * 文件位置：client/src/pages/entitycenter/TraceCard.jsx
 */
function TraceCard({ trace, onDelete }) {
    const [expanded, setExpanded] = useState(false);
    const typeMeta = getEntityTypeMeta(trace.entityType);
    const methodIcon = getOriginMethodIcon(trace.originMethod);
    const methodLabel = getOriginMethodLabel(trace.originMethod);
    const traceLog = Array.isArray(trace.traceLog) ? trace.traceLog : [];

    return (
        <div className="cwt-trace-card">
            <div className="cwt-trace-header" onClick={() => setExpanded(!expanded)} role="button" tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && setExpanded(!expanded)}>
                <span className="cwt-trace-icon">{typeMeta.icon}</span>
                <div className="cwt-trace-info">
                    <div className="cwt-trace-name">{trace.entityName}</div>
                    <div className="cwt-trace-sub">
                        <span className="cwt-badge-type">{typeMeta.label}</span>
                        {trace.characterName && <span className="cwt-holder">持有: {trace.characterName}</span>}
                    </div>
                </div>
                <div className="cwt-trace-origin">
                    <span className="cwt-origin-label">来源</span>
                    <span className="cwt-origin-world">{trace.originWorldName}</span>
                    <span className="cwt-origin-chapter">第{trace.originChapter}章</span>
                    <span className="cwt-origin-method" title={methodLabel}>{methodIcon} {methodLabel}</span>
                </div>
                <button className="cwt-expand-btn" type="button" aria-label="展开">
                    {expanded ? '▼' : '▶'}
                </button>
            </div>

            {expanded && (
                <div className="cwt-trace-body">
                    <div className="cwt-current">
                        当前所在: <span className="cwt-current-world">{trace.currentWorldName || trace.currentWorldId}</span>
                    </div>
                    <div className="cwt-trace-log-title">轨迹时间线 ({traceLog.length}条事件)</div>
                    <div className="cwt-timeline">
                        {traceLog.map((evt, i) => {
                            const actionMeta = getTraceActionMeta(evt.action);
                            return (
                                <div key={i} className={`cwt-timeline-item cwt-action-${actionMeta.color}`}>
                                    <div className="cwt-timeline-dot">{actionMeta.icon}</div>
                                    <div className="cwt-timeline-content">
                                        <div className="cwt-timeline-action">{actionMeta.label}</div>
                                        <div className="cwt-timeline-detail">
                                            {evt.fromWorld && <span>从 {evt.fromWorld} </span>}
                                            {evt.toWorld && <span>→ {evt.toWorld} </span>}
                                            <span className="cwt-timeline-ch">第{evt.chapter}章</span>
                                        </div>
                                        {evt.note && <div className="cwt-timeline-note">{evt.note}</div>}
                                    </div>
                                </div>
                            );
                        })}
                        {traceLog.length === 0 && <div className="cwt-empty-log">暂无轨迹事件</div>}
                    </div>
                    <div className="cwt-trace-actions">
                        <button className="cyber-btn cyber-btn-sm cyber-btn-outline"
                            onClick={() => onDelete(trace)}>删除溯源</button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default TraceCard;
