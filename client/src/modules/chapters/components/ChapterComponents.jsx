import { formatTimestamp } from '../shared/dateUtils';
import { safeStr, wordCount } from '../shared/utils';
import { STATUS_LABELS, STATUS_COLORS, WRITTEN_STATUSES } from '../../../shared/chapterStatusConstants';

export { STATUS_LABELS, STATUS_COLORS, WRITTEN_STATUSES };

export function ChapterCard({ chapter, selected, onSelect, onEdit, onDelete, onReset }) {
    return (
        <div
            className={`chapter-card ${selected ? 'cyber-card-glow' : ''}`}
            onClick={() => onSelect(chapter)}
        >
            <div className="chapter-number">{chapter.chapterNumber}</div>
            <div className="chapter-info">
                <div className="chapter-title">{chapter.title}</div>
                <div className="chapter-meta">
                    <span className={`cyber-badge cyber-badge-${STATUS_COLORS[chapter.status] || 'blue'}`}>
                        {STATUS_LABELS[chapter.status] || chapter.status}
                    </span>
                    <span>{wordCount(chapter.content)}字</span>
                    <span>R{chapter.round || 0}</span>
                </div>
                {chapter.updatedAt && (
                    <div className="chapter-updated">更新于: {formatTimestamp(chapter.updatedAt)}</div>
                )}
            </div>
            <div className="chapter-actions">
                <button className="cyber-btn cyber-btn-sm" onClick={e => { e.stopPropagation(); onEdit(chapter); }}>编辑</button>
                {WRITTEN_STATUSES.includes(chapter.status) && (
                    <button className="cyber-btn cyber-btn-sm" style={{ color: 'var(--neon-orange)' }} onClick={e => { e.stopPropagation(); onReset(chapter.id); }}>重置</button>
                )}
                <button className="cyber-btn cyber-btn-danger cyber-btn-sm" onClick={e => { e.stopPropagation(); onDelete(chapter.id); }}>删除</button>
            </div>
        </div>
    );
}

export function ChapterEditor({ chapter, form, onChange, onSave, onCancel }) {
    return (
        <div className="chapter-editor">
            <h3>编辑第{chapter.chapterNumber}章 - {chapter.title}</h3>
            <div className="form-group">
                <label>标题</label>
                <input className="cyber-input" value={form.title || ''} onChange={e => onChange({ title: e.target.value })} />
            </div>
            <div className="form-group">
                <label>大纲</label>
                <textarea className="cyber-textarea" rows="4" value={form.outline || ''} onChange={e => onChange({ outline: e.target.value })} />
            </div>
            <div className="form-group">
                <label>正文</label>
                <textarea className="cyber-textarea" rows="12" value={form.content || ''} onChange={e => onChange({ content: e.target.value })} />
            </div>
            <div className="chapter-editor-actions">
                <button className="cyber-btn" onClick={onSave}>保存</button>
                <button className="cyber-btn cyber-btn-secondary" onClick={onCancel}>取消</button>
            </div>
        </div>
    );
}

export function ChapterDetail({ chapter }) {
    if (!chapter) return <p className="empty-state">选择左侧章节查看详情</p>;

    return (
        <div className="chapter-detail">
            <h2>第{chapter.chapterNumber}章 - {chapter.title}</h2>
            <div className="chapter-detail-meta">
                <span className={`cyber-badge cyber-badge-${STATUS_COLORS[chapter.status] || 'blue'}`}>
                    {STATUS_LABELS[chapter.status] || chapter.status}
                </span>
                <span>{wordCount(chapter.content)}字</span>
                <span>R{chapter.round || 0}</span>
                {chapter.updatedAt && <span>更新于: {formatTimestamp(chapter.updatedAt)}</span>}
            </div>

            {chapter.outline && (
                <div className="chapter-section">
                    <h3>大纲</h3>
                    <pre className="chapter-outline">{safeStr(chapter.outline)}</pre>
                </div>
            )}

            {chapter.content && (
                <div className="chapter-section">
                    <h3>正文</h3>
                    <pre className="chapter-content-text">{safeStr(chapter.content)}</pre>
                </div>
            )}

            {chapter.firstReviewOutput && (
                <div className="chapter-section">
                    <h3>初审输出</h3>
                    <pre className="review-output">{safeStr(chapter.firstReviewOutput)}</pre>
                </div>
            )}

            {chapter.secondReviewOutput && (
                <div className="chapter-section">
                    <h3>复审输出</h3>
                    <pre className="review-output">{safeStr(chapter.secondReviewOutput)}</pre>
                </div>
            )}

            {chapter.finalEditorOutput && (
                <div className="chapter-section">
                    <h3>定稿人输出</h3>
                    <pre className="review-output">{safeStr(chapter.finalEditorOutput)}</pre>
                </div>
            )}
        </div>
    );
}
