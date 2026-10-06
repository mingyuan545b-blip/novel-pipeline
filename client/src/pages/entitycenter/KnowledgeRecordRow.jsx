/**
 * KnowledgeRecordRow.jsx — 限知树视图的紧凑叶子行（一行 = 一条事实 × 一个角色）
 *
 * 树有两条轴，用开关控制列：
 *   人物轴：显示 分类 + 事实 + 渠道 + 章节/备注；
 *   事件轴：事实与渠道已在上层节点展示，这里只留 角色 + 确信度 + 章节/备注。
 */
import { useState } from 'react';
import { ConfidenceBadge, SourceBadge } from './KnowledgeFactGroup';
import { categoryMeta, categoryOf } from './knowledgeUtils';
import s from './knowledge.module.css';

export default function KnowledgeRecordRow({
    record, nameOf, showEntity, showConfidence, showSource = true,
    showCategory = true, showFact = true, onDelete,
}) {
    const [confirmId, setConfirmId] = useState(null);
    const cat = categoryMeta(categoryOf(record));
    const title = record.factText || record.factId;
    const isConfirming = confirmId === record.id;
    return (
        <div className={`ec-flex ec-items-center ec-gap-8 ${s.row}`}>
            <span className={s.rowDot} style={{ background: cat.color }} title={cat.label} />
            {showCategory && <span className={`ec-text-11 ec-shrink-0 ${s.rowCat}`}>{cat.label}</span>}
            {showFact && <span className={`ec-text-13 ec-ellipsis ${s.rowTitle}`}>{title}</span>}
            {showEntity && <span className={`ec-text-11 ec-shrink-0 ${s.rowName}`}>{nameOf(record.entityId)}</span>}
            {showConfidence && <ConfidenceBadge confidence={record.confidence} />}
            {showSource && <SourceBadge sourceHow={record.sourceHow} />}
            {record.sinceChapter > 0 && <span className={`ec-text-11 ec-shrink-0 ${s.factChapter}`}>Ch{record.sinceChapter}</span>}
            {record.notes && <span className={`ec-text-11 ec-ellipsis ${s.factNotes}`}>{record.notes}</span>}
            <button className={`cyber-btn ${s.factDelete}`}
                onClick={() => isConfirming ? onDelete(record.id) : setConfirmId(record.id)}
                onBlur={() => setConfirmId(null)}>
                {isConfirming ? '确认?' : '×'}
            </button>
        </div>
    );
}
