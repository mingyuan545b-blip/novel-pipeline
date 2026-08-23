import ReplyInput from './ReplyInput';

const INTERACTION_TYPE_MAP = {
    comment: { label: '评论', bg: 'rgba(0,255,100,0.2)', color: 'var(--neon-green)' },
    review: { label: '书评', bg: 'rgba(255,0,255,0.2)', color: 'var(--neon-pink)' },
    tip: { label: '打赏', bg: 'rgba(255,200,0,0.2)', color: '#FFC800' },
    question: { label: '提问', bg: 'rgba(0,240,255,0.2)', color: 'var(--neon-blue)' },
    suggestion: { label: '建议', bg: 'rgba(0,255,100,0.2)', color: 'var(--neon-green)' }
};

export default function InteractionPanel({
    interactions, interactionStats,
    showAddInteraction, setShowAddInteraction,
    newInteraction, setNewInteraction,
    onAddInteraction, onReplyInteraction, onMarkRead, onDeleteInteraction
}) {
    return (
        <div>
            <div className="flex-between mb-16">
                <div className="cyber-section-title" style={{ margin: 0 }}>读者互动</div>
                <button className="cyber-btn cyber-btn-primary" onClick={() => setShowAddInteraction(true)}>+ 添加互动</button>
            </div>

            {showAddInteraction && (
                <AddInteractionForm newInteraction={newInteraction} setNewInteraction={setNewInteraction}
                    onSave={onAddInteraction} onCancel={() => setShowAddInteraction(false)} />
            )}

            {interactionStats && <InteractionStats stats={interactionStats} />}

            {interactions.length === 0 ? (
                <div className="cyber-card text-center text-muted p-20">暂无互动记录</div>
            ) : (
                interactions.map(interaction => (
                    <InteractionCard key={interaction.id} interaction={interaction}
                        onMarkRead={onMarkRead} onDelete={onDeleteInteraction} onReply={onReplyInteraction} />
                ))
            )}
        </div>
    );
}

function AddInteractionForm({ newInteraction, setNewInteraction, onSave, onCancel }) {
    const update = (key, value) => setNewInteraction(prev => ({ ...prev, [key]: value }));

    return (
        <div className="cyber-card mb-16" style={{ borderColor: 'var(--neon-pink)' }}>
            <h4 className="text-pink mb-12">添加互动记录</h4>
            <div className="config-grid">
                <div className="form-group">
                    <label className="form-label">平台</label>
                    <input className="cyber-input" value={newInteraction.platformName} onChange={e => update('platformName', e.target.value)} placeholder="番茄/七猫/抖音/掌阅/书旗" />
                </div>
                <div className="form-group">
                    <label className="form-label">类型</label>
                    <select className="cyber-input" value={newInteraction.type} onChange={e => update('type', e.target.value)}>
                        <option value="comment">评论</option><option value="review">书评</option>
                        <option value="tip">打赏</option><option value="question">提问</option>
                        <option value="suggestion">建议</option>
                    </select>
                </div>
                <div className="form-group">
                    <label className="form-label">读者昵称</label>
                    <input className="cyber-input" value={newInteraction.author} onChange={e => update('author', e.target.value)} />
                </div>
                <div className="form-group">
                    <label className="form-label">章节号</label>
                    <input className="cyber-input" type="number" value={newInteraction.chapterNumber} onChange={e => update('chapterNumber', parseInt(e.target.value) || 0)} />
                </div>
            </div>
            <div className="form-group">
                <label className="form-label">内容</label>
                <textarea className="cyber-input" value={newInteraction.content} onChange={e => update('content', e.target.value)} rows={3} placeholder="读者评论/反馈内容" />
            </div>
            <div className="flex gap-12" style={{ alignItems: 'center' }}>
                <label className="config-checkbox-label">
                    <input type="checkbox" checked={newInteraction.needsReply} onChange={e => update('needsReply', e.target.checked)} />
                    需要回复
                </label>
                <div className="flex gap-4" style={{ alignItems: 'center' }}>
                    <label className="form-label" style={{ margin: 0 }}>评分:</label>
                    <input className="cyber-input" type="number" value={newInteraction.rating || ''} onChange={e => update('rating', e.target.value ? parseFloat(e.target.value) : null)} min={1} max={5} step={0.5} style={{ width: 60 }} />
                </div>
            </div>
            <div className="action-row mt-12">
                <button className="cyber-btn" onClick={onCancel}>取消</button>
                <button className="cyber-btn cyber-btn-primary" onClick={onSave}>添加</button>
            </div>
        </div>
    );
}

function InteractionStats({ stats }) {
    const items = [
        { value: stats.comments, label: '评论', color: 'var(--neon-blue)' },
        { value: stats.tips, label: '打赏', color: 'var(--neon-green)' },
        { value: stats.questions, label: '提问', color: 'var(--neon-orange)' },
        { value: stats.avgRating, label: '平均评分', color: 'var(--neon-pink)' }
    ];
    return (
        <div className="interaction-stats-grid">
            {items.map(item => (
                <div key={item.label} className="cyber-card text-center cyber-card-compact">
                    <div className="interaction-stat-value" style={{ color: item.color }}>{item.value}</div>
                    <div className="text-sm text-muted">{item.label}</div>
                </div>
            ))}
        </div>
    );
}

function InteractionCard({ interaction, onMarkRead, onDelete, onReply }) {
    const typeInfo = INTERACTION_TYPE_MAP[interaction.type] || INTERACTION_TYPE_MAP.comment;
    const borderLeftColor = interaction.needsReply && !interaction.reply ? 'var(--neon-orange)' : interaction.isRead ? 'var(--neon-green)' : 'var(--neon-blue)';

    return (
        <div className="cyber-card interaction-card" style={{ borderLeft: `3px solid ${borderLeftColor}`, opacity: interaction.isRead ? 0.8 : 1 }}>
            <div className="interaction-header">
                <div className="interaction-meta">
                    <span className="cyber-badge" style={{ background: typeInfo.bg, color: typeInfo.color }}>{typeInfo.label}</span>
                    <span className="font-semibold text-base text-secondary">{interaction.author}</span>
                    <span className="text-sm text-muted">{interaction.platformName}</span>
                    {interaction.chapterNumber > 0 && <span className="text-sm text-muted">第{interaction.chapterNumber}章</span>}
                    {interaction.rating && <span className="text-base" style={{ color: '#FFC800' }}>★{interaction.rating}</span>}
                </div>
                <div className="flex gap-4">
                    {!interaction.isRead && <button className="cyber-btn cyber-btn-sm text-xs" onClick={() => onMarkRead(interaction.id)}>已读</button>}
                    <button className="cyber-btn cyber-btn-sm text-xs text-red" onClick={() => onDelete(interaction.id)}>删除</button>
                </div>
            </div>
            <div className="interaction-content">{interaction.content}</div>
            {interaction.reply ? (
                <div className="interaction-reply">回复: {interaction.reply}</div>
            ) : (
                <ReplyInput id={interaction.id} onReply={onReply} />
            )}
        </div>
    );
}
