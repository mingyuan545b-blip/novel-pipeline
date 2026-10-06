import { useState } from 'react';
import { EntityFilter, WorldFilter } from './ChronicleComponents';
import { dimensionCounts, dimensionKeysForLevel, LEVEL_HINTS } from './chronicleDimensions';
import { DimensionChips, ChronicleByDimension, ChronicleByChapter } from './ChronicleDims';
import useChronicleState from './useChronicleState';
import './chronicle.css';

const CHRONICLE_LEVELS = [
    { key: 'off', label: '关闭', desc: '不提取角色编年史数据' },
    { key: 'minimal', label: '精简', desc: '只提取主角+核心反派立场（最多2角色）' },
    { key: 'basic', label: '基础', desc: '提取所有角色立场+内在矛盾+日常/心理' },
    { key: 'full', label: '完整', desc: '全维度：日常/心理/立场/转变+高光+名言(场景/记忆点)+事迹+关系' }
];

function ChronicleGuideCard({ project, onUpdateLevel }) {
    const currentLevel = project?.settings?.chronicleLevel || 'off';
    return (
        <div className="cyber-card chr-guide-card">
            <div className="chr-guide-icon" aria-hidden="true">📜</div>
            <div className="chr-guide-title">角色编年史</div>
            <div className="chr-guide-desc">
                按 <b>8 个维度</b> 追踪角色：立场 / 立场转变 / 心理变化 / 日常 / 高光时刻 / 名言台词 / 事迹 / 关系变化。<br />
                启用后，Pipeline 每章完成后自动提取。
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

    const [activeDim, setActiveDim] = useState('all');
    const [viewMode, setViewMode] = useState('dimension'); // dimension | chapter

    const handleUpdateLevel = async (level) => {
        if (!project || !onUpdateProject) return;
        try {
            const newSettings = { ...(project.settings || {}), chronicleLevel: level };
            await onUpdateProject({ settings: newSettings });
        } catch { /* non-critical */ }
    };

    if (chronicleLevel === 'off') {
        return <ChronicleGuideCard project={project} onUpdateLevel={handleUpdateLevel} />;
    }

    const levelLabel = CHRONICLE_LEVELS.find(l => l.key === chronicleLevel)?.label || chronicleLevel;
    // 档位切换后若当前选中维度不在新档位可见范围内 → 视作「全部」（避免空白，且不用 effect setState）
    const activeDimSafe = activeDim === 'all' || dimensionKeysForLevel(chronicleLevel).includes(activeDim) ? activeDim : 'all';
    const counts = dimensionCounts(filteredChronicleData, chronicleLevel);

    return (
        <div className="chr-container">
            <div className="chr-header">
                <div className="chr-header-title">
                    角色编年史
                    <span className="chr-header-sub">
                        {levelLabel}模式 · {filteredChronicleData.length}条记录 · 展示：{LEVEL_HINTS[chronicleLevel] || '全维度'}
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

            <div className="chr-toolbar">
                <EntityFilter entities={entities} selectedEntityId={selectedEntityId} onChange={setSelectedEntityId} />
                {worldScopeLevel !== 'off' && (
                    <WorldFilter projectId={projectId} selectedWorldId={selectedWorldId} onChange={setSelectedWorldId} />
                )}
                <div className="chr-viewtoggle">
                    <button className={viewMode === 'dimension' ? 'chr-toggle-on' : ''} onClick={() => setViewMode('dimension')}>按维度</button>
                    <button className={viewMode === 'chapter' ? 'chr-toggle-on' : ''} onClick={() => setViewMode('chapter')}>按章节</button>
                </div>
            </div>

            <DimensionChips counts={counts} active={activeDimSafe} onChange={setActiveDim} level={chronicleLevel} />

            {loading ? (
                <div className="chr-loading">加载中...</div>
            ) : error ? (
                <div className="chr-error">
                    <span>{error}</span>
                    <button className="cyber-btn cyber-btn-sm cyber-btn-outline" onClick={fetchChronicle}>重试</button>
                </div>
            ) : viewMode === 'dimension' ? (
                <ChronicleByDimension data={filteredChronicleData} active={activeDimSafe} level={chronicleLevel} />
            ) : (
                <ChronicleByChapter data={filteredChronicleData} level={chronicleLevel} />
            )}
        </div>
    );
}
