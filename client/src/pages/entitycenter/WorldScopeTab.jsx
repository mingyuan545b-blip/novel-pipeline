import { useState, useMemo } from 'react';
import { pipelineApi } from '../../services/api';
import { TransitionTimeline, ViolationPanel, AddWorldForm, FactionsPanel } from './WorldScopeComponents';
import WorldCard from './WorldCard';
import { shapeWorlds } from './worldScopeUtils';
import logger from '../../shared/logger';
import ScopeGuideCard, { SCOPE_LEVELS } from './ScopeGuideCard';
import useWorldScope from './useWorldScope';
import './worldScope.css';

export default function WorldScopeTab({ projectId, project, onUpdateProject }) {
    const [showAddWorld, setShowAddWorld] = useState(false);
    const [query, setQuery] = useState('');
    const [sortBy, setSortBy] = useState('entities');
    const [onlyWithEntities, setOnlyWithEntities] = useState(false);
    const scopeLevel = project?.settings?.worldScopeLevel || 'off';
    const { scopeData, loading, error, extracting, fetchScope, handleExtract, DEFAULT_WORLDS } = useWorldScope(projectId, scopeLevel);

    const handleUpdateLevel = async (level) => {
        if (!project || !onUpdateProject) return;
        try {
            await onUpdateProject({ settings: { ...(project.settings || {}), worldScopeLevel: level } });
        } catch (err) { logger.error('WorldScope', 'Failed to update world scope level:', err.message); }
    };

    const handleAddWorld = async (world) => {
        const worlds = [...(scopeData?.worlds || DEFAULT_WORLDS), world];
        try {
            await pipelineApi.saveWorldScopeWorlds(projectId, worlds);
            setShowAddWorld(false);
            fetchScope();
        } catch (err) { logger.error('WorldScope', 'Failed to add world:', err.message); }
    };

    if (scopeLevel === 'off') {
        return <ScopeGuideCard project={project} onUpdateLevel={handleUpdateLevel} />;
    }

    const worlds = scopeData?.worlds || DEFAULT_WORLDS;
    const worldEntities = scopeData?.worldEntities || {};
    const events = scopeData?.events || [];
    const violations = events.flatMap(e => e.violations || []).filter(Boolean);
    const totalEntities = Object.values(worldEntities).reduce((sum, arr) => sum + arr.length, 0);
    const emptyWorlds = worlds.filter(w => !(worldEntities[w.id] || []).length).length;

    const shown = useMemo(
        () => shapeWorlds(worlds, worldEntities, { query, sortBy, onlyWithEntities }),
        [worlds, worldEntities, query, sortBy, onlyWithEntities]
    );

    return (
        <div className="ws-container">
            <div className="ws-header">
                <div className="ws-header-title">
                    世界域归属
                    <span className="ws-header-sub">
                        {scopeLevel === 'full' ? '完整模式' : '基础模式'} · {worlds.length}个世界 · {totalEntities}个实体归属
                    </span>
                </div>
                <div className="ws-header-btns">
                    <button className="cyber-btn cyber-btn-outline ws-header-btn" onClick={handleExtract} disabled={extracting}>
                        {extracting ? '提取中...' : '补提取'}
                    </button>
                    {SCOPE_LEVELS.filter(l => l.key !== 'off').map(lv => (
                        <button key={lv.key}
                            className={`cyber-btn ${scopeLevel === lv.key ? '' : 'cyber-btn-outline'} ws-header-btn`}
                            onClick={() => handleUpdateLevel(lv.key)}>{lv.label}</button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="ws-loading">加载中...</div>
            ) : error ? (
                <div className="ws-error">
                    <span>{error}</span>
                    <button className="cyber-btn cyber-btn-sm cyber-btn-outline" onClick={fetchScope}>重试</button>
                </div>
            ) : (
                <>
                    <div className="cb-tools ec-mb-12">
                        <input className="cb-search" placeholder="搜索世界名…" value={query}
                            onChange={e => setQuery(e.target.value)} aria-label="搜索世界" />
                        <select className="cb-sort" value={sortBy} onChange={e => setSortBy(e.target.value)} aria-label="排序">
                            <option value="entities">归属数（多→少）</option>
                            <option value="name">名称 A→Z</option>
                        </select>
                        <button className={`cb-chip ${onlyWithEntities ? 'cb-chip-on' : ''}`}
                            onClick={() => setOnlyWithEntities(v => !v)}>仅有归属</button>
                        <span className="cb-count">{shown.length}/{worlds.length}{emptyWorlds > 0 ? ` · ${emptyWorlds} 个空缺` : ''}</span>
                    </div>

                    {shown.length === 0 && <div className="cb-empty">没有匹配的世界</div>}
                    <div className="ws-worlds-grid">
                        {shown.map(w => (
                            <WorldCard key={w.id} world={w} entities={w._entities} />
                        ))}
                        <div className="ws-add-world" onClick={() => setShowAddWorld(true)} role="button" tabIndex={0}
                            onKeyDown={e => e.key === 'Enter' && setShowAddWorld(true)}>+ 添加世界</div>
                    </div>
                    {showAddWorld && <AddWorldForm onAdd={handleAddWorld} onCancel={() => setShowAddWorld(false)} />}
                    <TransitionTimeline events={events} />
                    <ViolationPanel violations={violations} />
                    <FactionsPanel factionsByWorld={scopeData?.factionsByWorld} worlds={worlds} />
                </>
            )}
        </div>
    );
}
