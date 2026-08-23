import { StanceTimeline, QuotesSection, DeedsSection, EntityFilter, WorldFilter } from './ChronicleComponents';
import useChronicleState from './useChronicleState';
import './chronicle.css';

const CHRONICLE_LEVELS = [
    { key: 'off', label: '关闭', desc: '不提取角色编年史数据' },
    { key: 'minimal', label: '精简', desc: '只提取主角+核心反派立场（最多2角色）' },
    { key: 'basic', label: '基础', desc: '提取所有角色立场+内在矛盾' },
    { key: 'full', label: '完整', desc: '提取立场+语录+事迹+转变原因' }
];

function ChronicleGuideCard({ project, onUpdateLevel }) {
    const currentLevel = project?.settings?.chronicleLevel || 'off';
    return (
        <div className="cyber-card chr-guide-card">
            <div className="chr-guide-icon" aria-hidden="true">📜</div>
            <div className="chr-guide-title">角色编年史</div>
            <div className="chr-guide-desc">
                追踪角色的立场转变、语录和事迹。<br />
                启用后，Pipeline每章完成后自动提取角色数据。
            </div>
            <div className="chr-guide-btns">
                {CHRONICLE_LEVELS.map(lv => (
                    <button key={lv.key}
                        className={`cyber-btn ${currentLevel === lv.key ? '' : 'cyber-btn-outline'} chr-guide-btn ${currentLevel === lv.key ? 'chr-guide-btn-active' : 'chr-guide-btn-inactive'}`}
                        onClick={() => onUpdateLevel(lv.key)} title={lv.desc}>
                        {lv.label}
                    </button>
                ))}
            </div>
            <div className="chr-guide-current">
                当前: {CHRONICLE_LEVELS.find(l => l.key === currentLevel)?.label || '关闭'}
            </div>
        </div>
    );
}

export default function ChronicleTab({ projectId, project, onUpdateProject }) {
    const {
        loading, error, extracting, selectedEntityId, selectedWorldId,
        chronicleLevel, worldScopeLevel, filteredChronicleData, entities,
        setSelectedEntityId, setSelectedWorldId, fetchChronicle, handleExtract,
    } = useChronicleState(projectId, project);

    const handleUpdateLevel = async (level) => {
        if (!project || !onUpdateProject) return;
        try {
            // 只发送 settings 字段，避免发送完整 project 对象触发验证器 400
            const newSettings = { ...(project.settings || {}), chronicleLevel: level };
            await onUpdateProject({ settings: newSettings });
        } catch { /* non-critical */ }
    };

    if (chronicleLevel === 'off') {
        return <ChronicleGuideCard project={project} onUpdateLevel={handleUpdateLevel} />;
    }

    const isFull = chronicleLevel === 'full';
    const levelLabel = CHRONICLE_LEVELS.find(l => l.key === chronicleLevel)?.label || chronicleLevel;

    return (
        <div className="chr-container">
            <div className="chr-header">
                <div className="chr-header-title">
                    角色编年史
                    <span className="chr-header-sub">
                        {levelLabel}模式 · {filteredChronicleData.length}条记录
                    </span>
                </div>
                <div className="chr-header-btns">
                    <button className="cyber-btn cyber-btn-outline chr-header-btn" onClick={handleExtract} disabled={extracting}>
                        {extracting ? '提取中...' : '补提取'}
                    </button>
                    {CHRONICLE_LEVELS.map(lv => (
                        <button key={lv.key}
                            className={`cyber-btn ${chronicleLevel === lv.key ? '' : 'cyber-btn-outline'} chr-header-btn`}
                            onClick={() => handleUpdateLevel(lv.key)}>
                            {lv.label}
                        </button>
                    ))}
                </div>
            </div>

            <EntityFilter entities={entities} selectedEntityId={selectedEntityId} onChange={setSelectedEntityId} />
            {worldScopeLevel !== 'off' && (
                <WorldFilter projectId={projectId} selectedWorldId={selectedWorldId} onChange={setSelectedWorldId} />
            )}

            {loading ? (
                <div className="chr-loading">加载中...</div>
            ) : error ? (
                <div className="chr-error">
                    <span>{error}</span>
                    <button className="cyber-btn cyber-btn-sm cyber-btn-outline" onClick={fetchChronicle}>重试</button>
                </div>
            ) : filteredChronicleData.length === 0 ? (
                <div className="chr-empty">暂无编年史数据，Pipeline运行后将自动提取</div>
            ) : (
                <>
                    <StanceTimeline chronicleData={filteredChronicleData} />
                    {isFull && <QuotesSection chronicleData={filteredChronicleData} />}
                    {isFull && <DeedsSection chronicleData={filteredChronicleData} />}
                </>
            )}
        </div>
    );
}
