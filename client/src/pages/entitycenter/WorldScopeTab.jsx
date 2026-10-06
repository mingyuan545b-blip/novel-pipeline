import { useState, useMemo } from 'react';
import { pipelineApi } from '../../services/api';
import { TransitionTimeline, ViolationPanel, AddWorldForm, FactionsPanel } from './WorldScopeComponents';
import WorldCard from './WorldCard';
import WorldContractPanel from './WorldContractPanel';
import { shapeWorlds } from './worldScopeUtils';
import { mergeWorldsWithContracts } from './worldContractUtils';
import logger from '../../shared/logger';
import ScopeGuideCard, { SCOPE_LEVELS } from './ScopeGuideCard';
import useWorldScope from './useWorldScope';
import './worldScope.css';

const SUB_TABS = [
    { key: 'worlds', label: '世界与归属', icon: '🌍' },
    { key: 'contract', label: '通行契约', icon: '🎫' },
    { key: 'events', label: '穿越事件', icon: '🧭' },
    { key: 'factions', label: '势力', icon: '🏳' }
];

export default function WorldScopeTab({ projectId, project, onUpdateProject }) {
    const [showAddWorld, setShowAddWorld] = useState(false);
    const [query, setQuery] = useState('');
    const [sortBy, setSortBy] = useState('entities');
    const [onlyWithEntities, setOnlyWithEntities] = useState(false);
    const [subTab, setSubTab] = useState('worlds');
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

    // Hooks 必须先于条件返回调用（否则破坏 Hook 顺序）
    const shown = useMemo(
        () => shapeWorlds(scopeData?.worlds || DEFAULT_WORLDS, scopeData?.worldEntities || {},
            { query, sortBy, onlyWithEntities }),
        [scopeData, DEFAULT_WORLDS, query, sortBy, onlyWithEntities]
    );

    if (scopeLevel === 'off') {
        return <ScopeGuideCard project={project} onUpdateLevel={handleUpdateLevel} />;
    }

    const worlds = scopeData?.worlds || DEFAULT_WORLDS;
    const worldEntities = scopeData?.worldEntities || {};
    const events = scopeData?.events || [];
    const violations = events.flatMap(e => e.violations || []).filter(Boolean);
    const totalEntities = Object.values(worldEntities).reduce((sum, arr) => sum + arr.length, 0);
    const emptyWorlds = worlds.filter(w => !(worldEntities[w.id] || []).length).length;
    const projectWorlds = scopeData?.projectWorlds || [];

    const handleSaveContract = async (worldId, patch) => {
        const merged = mergeWorldsWithContracts(projectWorlds, worlds);
        const next = merged.map(w => (w.id === worldId ? { ...w, ...patch } : w));
        try {
            await pipelineApi.saveWorldScopeWorlds(projectId, next);
            fetchScope();
        } catch (err) { logger.error('WorldScope', 'Failed to save contract:', err.message); }
    };

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

            <div className="ws-subtabs">
                {SUB_TABS.map(t => (
                    <button key={t.key} className={`ws-subtab ${subTab === t.key ? 'ws-subtab-on' : ''}`}
                        onClick={() => setSubTab(t.key)}>
                        {t.icon} {t.label}
                        {t.key === 'events' && violations.length > 0 && <span className="ws-subtab-badge">{violations.length}</span>}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="ws-loading">加载中...</div>
            ) : error ? (
                <div className="ws-error">
                    <span>{error}</span>
                    <button className="cyber-btn cyber-btn-sm cyber-btn-outline" onClick={fetchScope}>重试</button>
                </div>
            ) : subTab === 'worlds' ? (
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
                </>
            ) : subTab === 'contract' ? (
                <WorldContractPanel worlds={worlds} projectWorlds={projectWorlds} worldEntities={worldEntities} onSave={handleSaveContract} />
            ) : subTab === 'events' ? (
                <>
                    <TransitionTimeline events={events} />
                    <ViolationPanel violations={violations} />
                </>
            ) : (
                <FactionsPanel factionsByWorld={scopeData?.factionsByWorld} worlds={worlds} />
            )}
        </div>
    );
}
