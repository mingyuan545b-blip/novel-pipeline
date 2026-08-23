/**
 * 世界域归属引导卡片
 * 文件位置：client/src/pages/entitycenter/ScopeGuideCard.jsx
 */

const SCOPE_LEVELS = [
    { key: 'off', label: '关闭', desc: '不启用世界域归属' },
    { key: 'basic', label: '基础', desc: '标记归属+穿越事件' },
    { key: 'full', label: '完整', desc: '归属+状态快照+串台检测' }
];

function ScopeGuideCard({ project, onUpdateLevel }) {
    const currentLevel = project?.settings?.worldScopeLevel || 'off';
    return (
        <div className="cyber-card ws-guide-card">
            <div className="ws-guide-icon" aria-hidden="true">🌐</div>
            <div className="ws-guide-title">世界域归属</div>
            <div className="ws-guide-desc">
                追踪角色/装备/NPC的世界归属，防止跨世界串台。<br />
                适用于副本博弈、次位面穿越等题材。
            </div>
            <div className="ws-guide-btns">
                {SCOPE_LEVELS.map(lv => (
                    <button key={lv.key}
                        className={`cyber-btn ${currentLevel === lv.key ? '' : 'cyber-btn-outline'} ws-guide-btn ${currentLevel === lv.key ? 'ws-guide-btn-active' : 'ws-guide-btn-inactive'}`}
                        onClick={() => onUpdateLevel(lv.key)}
                        title={lv.desc}
                    >
                        {lv.label}
                    </button>
                ))}
            </div>
            <div className="ws-guide-current">
                当前: {SCOPE_LEVELS.find(l => l.key === currentLevel)?.label || '关闭'}
            </div>
        </div>
    );
}

export default ScopeGuideCard;
export { SCOPE_LEVELS };
