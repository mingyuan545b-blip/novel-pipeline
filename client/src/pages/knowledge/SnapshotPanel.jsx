import { useState } from 'react';
import './knowledge.css';

const DIFF_DIM_LABELS = {
    characterChanges: '角色变更',
    relationshipChanges: '关系变更',
    equipmentChanges: '装备变更',
    foreshadowingChanges: '伏笔变更'
};
const DIFF_DIMS = Object.keys(DIFF_DIM_LABELS);

export default function SnapshotPanel({ snapshots, diff, onDiff, projectId: _projectId }) {
    const [diffA, setDiffA] = useState('');
    const [diffB, setDiffB] = useState('');
    // 防御性处理：确保 snapshots 是数组
    const safeSnapshots = Array.isArray(snapshots) ? snapshots : [];

    return (
        <div>
            <div className="snapshot-card">
                <h3 className="snapshot-title">状态快照历史</h3>
                <p className="snapshot-desc">每章完成后自动保存全量世界状态快照，支持回溯和对比</p>
                {safeSnapshots.length === 0 ? (
                    <div className="snapshot-empty">暂无快照，完成章节创作后自动生成</div>
                ) : (
                    <div className="snapshot-list">
                        {safeSnapshots.map((s, i) => (
                            <div key={i} className="snapshot-item">
                                <div className="snapshot-item-left">
                                    <span className="snapshot-item-chapter">第{s.chapterNumber}章</span>
                                    <span className="snapshot-item-counts">
                                        {Object.keys(s.characterStates || {}).length}角色 | {Object.keys(s.relationshipStates || {}).length}关系
                                    </span>
                                </div>
                                <span className="snapshot-item-time">
                                    {s.timestamp ? new Date(s.timestamp).toLocaleString() : ''}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="snapshot-card">
                <h3 className="snapshot-title">快照对比</h3>
                <div className="snapshot-diff-input-row">
                    <input type="number" value={diffA} onChange={e => setDiffA(e.target.value)} placeholder="章节A"
                        className="snapshot-diff-input" />
                    <span className="snapshot-diff-vs">vs</span>
                    <input type="number" value={diffB} onChange={e => setDiffB(e.target.value)} placeholder="章节B"
                        className="snapshot-diff-input" />
                    <button className="snapshot-diff-btn" onClick={() => onDiff(diffA, diffB)} disabled={!diffA || !diffB}>
                        对比
                    </button>
                </div>

                {diff && <SnapshotDiffView diff={diff} />}
            </div>
        </div>
    );
}

function SnapshotDiffView({ diff }) {
    return (
        <div>
            {DIFF_DIMS.map(dim => {
                const changes = diff[dim] || [];
                if (!changes.length) return null;
                return (
                    <div key={dim} className="mb-12">
                        <h4 className="snapshot-dim-title">{DIFF_DIM_LABELS[dim]}</h4>
                        {changes.map((c, i) => (
                            <div key={i} className="snapshot-dim-item">
                                <strong>{c.name}</strong> — {c.change}
                                {c.fields && Object.entries(c.fields).map(([k, v]) => (
                                    <div key={k} className="snapshot-dim-field">
                                        {k}: <span className="snapshot-dim-from">{v.from}</span> → <span className="snapshot-dim-to">{v.to}</span>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                );
            })}
        </div>
    );
}
