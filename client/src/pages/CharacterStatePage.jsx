import useCharacterState from './characterstate/useCharacterState';
import StateEditor from './characterstate/StateEditor';
import HistoryTab from './characterstate/HistoryTab';
import MetaTab from './characterstate/MetaTab';
import { SCHEMA_COLORS, GENRE_LABELS, GENRE_COLORS, SCOPE_ICONS, SCOPE_LABELS, TABS } from './characterstate/characterStateConstants';

export default function CharacterStatePage() {
    const s = useCharacterState();
    const {
        currentProject, activeTab, setActiveTab, selectedChapter, setSelectedChapter,
        selectedCharacter, setSelectedCharacter, kvScopeFilter, setKvScopeFilter,
        historyCharId, setHistoryCharId, meta, charactersData, kvData, summaryData,
        statesData, chapterOptions, historyData, toBeijingTime, syncFrom, setSyncFrom,
        syncTo, setSyncTo, syncMut, handleSync,
    } = s;

    if (!currentProject) {
        return (<div><div className="page-header"><h1 className="page-title">角色状态管理</h1></div><div className="cyber-card cyber-empty">请先在仪表盘选择一个项目</div></div>);
    }

    const genreColor = GENRE_COLORS[meta?.genre?.id] || SCHEMA_COLORS.default;

    return (
        <div>
            <div className="page-header">
                <div className="flex-between">
                    <div>
                        <h1 className="page-title">角色状态管理</h1>
                        <p className="page-subtitle">
                            基于差量更新 + 链式快照的角色状态追踪系统
                            {meta?.genre && <span className="font-semibold" style={{ color: genreColor }}> · {meta.genre?.label || GENRE_LABELS[meta.genre?.id] || String(meta.genre?.id || meta.genre)}</span>}
                        </p>
                    </div>
                    {meta?.stats && (
                        <div className="flex gap-12">
                            <div className="text-center rounded p-8" style={{ background: 'rgba(0,200,255,0.08)', border: '1px solid rgba(0,200,255,0.2)', borderRadius: 8, padding: '6px 14px' }}>
                                <div className="text-xl font-bold text-cyan">{meta.stats.uniqueCharacters}</div><div className="text-xs text-muted">角色</div>
                            </div>
                            <div className="text-center rounded" style={{ background: 'rgba(255,100,255,0.08)', border: '1px solid rgba(255,100,255,0.2)', borderRadius: 8, padding: '6px 14px' }}>
                                <div className="text-xl font-bold text-pink">{meta.stats.hotEntries}</div><div className="text-xs text-muted">热点</div>
                            </div>
                            <div className="text-center rounded" style={{ background: 'rgba(0,255,150,0.08)', border: '1px solid rgba(0,255,150,0.2)', borderRadius: 8, padding: '6px 14px' }}>
                                <div className="text-xl font-bold text-green">{meta.stats.totalStateRecords}</div><div className="text-xs text-muted">快照</div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="cyber-tabs mb-20">
                {TABS.map(tab => (
                    <button key={tab.key} className={`cyber-tab ${activeTab === tab.key ? 'cyber-tab-active' : ''}`}
                        onClick={() => setActiveTab(tab.key)}
                        style={activeTab === tab.key ? { borderColor: 'var(--neon-blue)', color: 'var(--neon-blue)' } : {}}>
                        {tab.label}
                    </button>
                ))}
            </div>

            {activeTab === 'characters' && (
                <div>
                    <div className="flex gap-12 mb-16 items-center flex-wrap">
                        <label className="text-base text-muted">章节筛选:</label>
                        <select className="cyber-select max-w-150" value={selectedChapter || ''} onChange={e => setSelectedChapter(e.target.value ? parseInt(e.target.value) : null)}>
                            <option value="">当前章节 (第{meta?.currentChapter || '?'}章)</option>
                            {chapterOptions.map(n => <option key={n} value={n}>第{n}章</option>)}
                        </select>
                        <div className="ml-auto text-base text-muted">{charactersData?.characters?.length || 0} 个热点角色</div>
                    </div>
                    <StateEditor charactersData={charactersData} selectedCharacter={selectedCharacter} setSelectedCharacter={setSelectedCharacter} meta={meta} />
                </div>
            )}

            {activeTab === 'kv-index' && (
                <div>
                    <div className="flex gap-12 mb-16 items-center flex-wrap">
                        <label className="text-base text-muted">范围筛选:</label>
                        <select className="cyber-select max-w-150" value={kvScopeFilter} onChange={e => setKvScopeFilter(e.target.value)}>
                            <option value="all">全部范围</option>
                            {Object.entries(SCOPE_LABELS).map(([k, v]) => <option key={k} value={k}>{SCOPE_ICONS[k]} {v}</option>)}
                        </select>
                        <div className="ml-auto text-base text-muted">{kvData?.length || 0} 个实体</div>
                    </div>
                    {!kvData?.length ? (
                        <div className="cyber-card cyber-empty"><div className="cyber-empty-icon">⚡</div><div>暂无 KV 索引数据。请先运行 Pipeline 的 material-manager 步骤。</div></div>
                    ) : (
                        <div className="flex-col gap-12">
                            {kvData.map(entity => (
                                <div key={`${entity.scope}:${entity.entityKey}`} className="cyber-card"
                                    style={{ borderLeft: `3px solid ${entity.scope === 'character' ? 'var(--neon-pink)' : entity.scope === 'worldview' ? 'var(--neon-cyan)' : 'var(--neon-purple)'}` }}>
                                    <div className="flex items-center gap-8 mb-8">
                                        <span className="text-md">{SCOPE_ICONS[entity.scope] || '📋'}</span>
                                        <span className="text-md font-semibold">{entity.entityKey}</span>
                                        <span className="text-sm rounded" style={{ padding: '2px 8px', borderRadius: 10, background: 'rgba(0,200,255,0.1)', color: 'var(--neon-cyan)' }}>{SCOPE_LABELS[entity.scope] || entity.scope}</span>
                                    </div>
                                    <div className="grid-auto-180">
                                        {Object.entries(entity.fields).map(([key, field]) => (
                                            <div key={key} className="rounded text-sm" style={{ padding: '4px 8px', background: field.isHot ? 'rgba(255,100,0,0.06)' : 'var(--bg-secondary)', borderLeft: field.isHot ? '2px solid var(--neon-orange)' : '2px solid transparent' }}>
                                                <div className="text-xs text-muted flex-between"><span>{key}{field.isHot && ' 🔥'}</span><span>章{field.chapterUpdated}</span></div>
                                                <div className="text-base text-primary font-mono truncate">{String(field.value)}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'history' && (
                <HistoryTab historyData={historyData} historyCharId={historyCharId} setHistoryCharId={setHistoryCharId}
                    charactersData={charactersData} statesData={statesData} toBeijingTime={toBeijingTime} />
            )}

            {activeTab === 'summary' && (
                <div>
                    <div className="flex gap-12 mb-16 items-center flex-wrap">
                        <label className="text-base text-muted">章节筛选:</label>
                        <select className="cyber-select max-w-150" value={selectedChapter || ''} onChange={e => setSelectedChapter(e.target.value ? parseInt(e.target.value) : null)}>
                            <option value="">当前章节 (第{meta?.currentChapter || '?'}章)</option>
                            {chapterOptions.map(n => <option key={n} value={n}>第{n}章</option>)}
                        </select>
                    </div>
                    <div className="grid-2">
                        <div className="cyber-card cyber-card-border-left">
                            <h3 className="text-md font-semibold text-cyan mb-8">📝 简要摘要</h3>
                            <div className="text-md text-secondary pre-wrap lh-1-7 font-mono max-h-500 overflow-auto">{summaryData?.briefSummary || '暂无数据'}</div>
                        </div>
                        <div className="cyber-card cyber-card-border-left-purple">
                            <h3 className="text-md font-semibold text-purple mb-8">📖 详细摘要</h3>
                            <div className="text-md text-secondary pre-wrap lh-1-7 font-mono max-h-500 overflow-auto">{summaryData?.detailedSummary || '暂无数据'}</div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'meta' && (
                <MetaTab meta={meta} chapterOptions={chapterOptions} syncFrom={syncFrom} setSyncFrom={setSyncFrom}
                    syncTo={syncTo} setSyncTo={setSyncTo} syncMut={syncMut} handleSync={handleSync} />
            )}
        </div>
    );
}
