/**
 * CharacterOverview.jsx — 未选中角色时的右侧概览
 * 原状态是一大片留白提示"请选择角色"，浪费屏幕；改为先给一眼全局（谁多、谁重要）。
 */
import { GROUP_META, GROUP_ORDER, countByRole } from './characterListUtils';

const TOP_N = 6;

/** characters 需为 adaptChar 归一化后的列表（角色/等级/出场次数已就位） */
export default function CharacterOverview({ characters, onSelect }) {
    const counts = countByRole(characters);
    const total = characters.length || 1;
    const top = [...characters].sort((a, b) => b.appearCount - a.appearCount).slice(0, TOP_N);

    return (
        <div className="cl-overview">
            <h3 className="cl-ov-title">角色总览</h3>
            <p className="cl-ov-sub">共 {characters.length} 个角色 · 点击左侧任意角色查看完整设定、装备与关系</p>

            <div className="cl-ov-section">
                <div className="cl-ov-label">等级分布</div>
                <div className="cl-ov-bars">
                    {GROUP_ORDER.filter(r => counts[r] > 0).map(role => (
                        <div className="cl-ov-bar" key={role}>
                            <span style={{ color: GROUP_META[role].color }}>{GROUP_META[role].label}</span>
                            <div className="cl-ov-track">
                                <div className="cl-ov-fill" style={{ width: `${(counts[role] / total) * 100}%`, background: GROUP_META[role].color }} />
                            </div>
                            <span className="cl-ov-value">{counts[role]} 个</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="cl-ov-section">
                <div className="cl-ov-label">出场最多的角色</div>
                <div className="cl-ov-top">
                    {top.map(c => (
                        <button key={c.id} className="cl-ov-chip" onClick={() => onSelect?.(c.id)}>
                            <span className="cl-ov-chip-name" style={{ color: GROUP_META[c.role]?.color }}>{c.name}</span>
                            <span className="cl-ov-chip-meta">{GROUP_META[c.role]?.label || c.role} · 出场 {c.appearCount} 次</span>
                        </button>
                    ))}
                </div>
                <div className="cl-ov-tip">出场次数是判断角色重要度的最直接信号；与大纲设定不符时，检查实体中心的等级标注。</div>
            </div>
        </div>
    );
}
