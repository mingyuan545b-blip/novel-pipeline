/**
 * KnowledgeFactGroup.jsx — 单条事实（可含多个角色的认知记录）
 * 从 KnowledgeTab 拆出，保证单文件≤200行。
 */
import { useState } from 'react';
import { CONFIDENCE_LABELS, CONFIDENCE_COLORS, SOURCE_HOW_LABELS } from './constants';
import s from './knowledge.module.css';

export function ConfidenceBadge({ confidence }) {
    const color = CONFIDENCE_COLORS[confidence] || '#888';
    const label = CONFIDENCE_LABELS[confidence] || confidence;
    return <span className={s.confidenceBadge} style={{ color }}>[{label}]</span>;
}

export function SourceBadge({ sourceHow }) {
    const label = SOURCE_HOW_LABELS[sourceHow] || sourceHow;
    return <span className={s.sourceBadge}>({label})</span>;
}

export default function KnowledgeFactGroup({ factKey, records, entityNameMap, onDelete }) {
    const [confirmId, setConfirmId] = useState(null);
    return (
        <div className={`cyber-card ${s.factCard}`}>
            <div className="ec-flex ec-justify-between ec-items-center">
                <h4 className={`ec-section-title ${s.factTitle}`}>{factKey}</h4>
                <span className={s.factCount}>{records.length} 条记录</span>
            </div>
            <div className="ec-flex ec-flex-col ec-gap-6 ec-mt-8">
                {records.map(r => (
                    <div key={r.id} className={`ec-flex ec-items-center ec-gap-8 ${s.factRow}`}>
                        <span className={s.factName}>{entityNameMap.get(r.entityId) || r.entityId}</span>
                        <ConfidenceBadge confidence={r.confidence} />
                        <SourceBadge sourceHow={r.sourceHow} />
                        {r.sinceChapter > 0 && <span className={s.factChapter}>Ch{r.sinceChapter}</span>}
                        {r.notes && <span className={s.factNotes}>{r.notes}</span>}
                        <button className={`cyber-btn ${s.factDelete}`}
                            onClick={() => confirmId === r.id ? onDelete(r.id) : setConfirmId(r.id)}
                            onBlur={() => setConfirmId(null)}>
                            {confirmId === r.id ? '确认?' : '×'}
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
