import { QUEST_STATUS_LABELS, QUEST_PRIORITY_LABELS } from './materialConstants';
import styles from './materials.module.css';

export default function QuestFormModal({
    show, editingQuest, questForm, setQuestForm,
    onSave, onCancel,
}) {
    if (!show) return null;

    return (
        <div className="cyber-modal-overlay">
            <div className={`cyber-modal ${styles.modalMedium}`} onClick={e => e.stopPropagation()}>
                <h2>{editingQuest ? '编辑任务' : questForm.parentId ? '新建子任务' : '新建任务'}</h2>
                <div className="form-group">
                    <label className="form-label">任务标题</label>
                    <input className="cyber-input" value={questForm.title}
                        onChange={e => setQuestForm({ ...questForm, title: e.target.value })}
                        placeholder="输入任务标题..." />
                </div>
                <div className="form-group">
                    <label className="form-label">任务描述</label>
                    <textarea className="cyber-textarea" value={questForm.description}
                        onChange={e => setQuestForm({ ...questForm, description: e.target.value })}
                        rows={4} placeholder="描述任务内容..." />
                </div>
                <div className="form-row">
                    <div className="form-group">
                        <label className="form-label">状态</label>
                        <select className="cyber-select" value={questForm.status}
                            onChange={e => setQuestForm({ ...questForm, status: e.target.value })}>
                            {Object.entries(QUEST_STATUS_LABELS).map(([k, l]) => (
                                <option key={k} value={k}>{l}</option>
                            ))}
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">优先级</label>
                        <select className="cyber-select" value={questForm.priority}
                            onChange={e => setQuestForm({ ...questForm, priority: e.target.value })}>
                            {Object.entries(QUEST_PRIORITY_LABELS).map(([k, l]) => (
                                <option key={k} value={k}>{l}</option>
                            ))}
                        </select>
                    </div>
                </div>
                <div className="form-group">
                    <label className="form-label">备注</label>
                    <textarea className="cyber-textarea" value={questForm.notes}
                        onChange={e => setQuestForm({ ...questForm, notes: e.target.value })}
                        rows={3} placeholder="备注信息..." />
                </div>
                <div className="form-group">
                    <label className="form-label">标签（逗号分隔）</label>
                    <input className="cyber-input"
                        value={questForm.tags?.join(', ') || ''}
                        onChange={e => setQuestForm({
                            ...questForm,
                            tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean),
                        })}
                        placeholder="标签1, 标签2..." />
                </div>
                <div className={styles.modalFooter}>
                    <button className="cyber-btn" onClick={onCancel}>取消</button>
                    <button className="cyber-btn cyber-btn-primary" onClick={onSave}
                        disabled={!questForm.title.trim()}>
                        {editingQuest ? '保存' : '创建'}
                    </button>
                </div>
            </div>
        </div>
    );
}
