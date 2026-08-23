import FlavorDetailPanel from './FlavorDetailPanel';
import FlavorEditForm from './FlavorEditForm';

export default function FlavorCard({ dragHandleProps, state }) {
    const {
        currentProject, editingFlavor, setEditingFlavor, flavorForm, setFlavorForm,
        startEditFlavor, saveFlavor,
        flavorNamingStyles, flavorDialects, flavorSpeechStyles,
        worldviewTemplates, systemPersonas,
        expandedFlavorDetail, flavorDetailData, flavorDetailLoading,
        handleFlavorTagClick, closeFlavorDetail
    } = state;

    const sp = currentProject?.styleProfile || {};

    const renderTags = () => {
        const tags = [];
        if (sp.namingStyle) {
            const ns = flavorNamingStyles.find(s => s.id === sp.namingStyle);
            tags.push({ key: 'namingStyle', id: sp.namingStyle, icon: '✒️', label: ns?.label || sp.namingStyle, color: 'var(--neon-orange)', rgb: '255,200,0' });
        } else if (currentProject?.genre) {
            tags.push({ key: 'namingStyle', id: null, icon: '✒️', label: '自动推断', color: 'var(--text-muted)', rgb: '128,128,128' });
        }
        if (sp.defaultDialect) {
            const d = flavorDialects.find(x => x.region === sp.defaultDialect);
            tags.push({ key: 'dialect', id: sp.defaultDialect, icon: '🗣', label: d?.label || sp.defaultDialect, color: 'var(--neon-green)', rgb: '0,255,150' });
        }
        if (sp.defaultSpeechStyle) {
            const s = flavorSpeechStyles.find(x => x.id === sp.defaultSpeechStyle);
            tags.push({ key: 'speechStyle', id: sp.defaultSpeechStyle, icon: '🎭', label: s?.label || sp.defaultSpeechStyle, color: 'var(--neon-pink)', rgb: '255,100,255' });
        }
        if (sp.worldviewTemplate) {
            const w = worldviewTemplates.find(x => x.id === sp.worldviewTemplate);
            tags.push({ key: 'worldviewTemplate', id: sp.worldviewTemplate, icon: '🌍', label: w?.label || sp.worldviewTemplate, color: 'var(--neon-cyan)', rgb: '0,240,255' });
        }
        if (sp.systemPersona) {
            const sp2 = systemPersonas.find(x => x.id === sp.systemPersona);
            tags.push({ key: 'systemPersona', id: sp.systemPersona, icon: '🤖', label: sp2?.label || sp.systemPersona, color: '#9b59b6', rgb: '155,89,182' });
        }
        return tags;
    };

    return (
        <div className="cyber-card">
            <div className="card-header" {...dragHandleProps}>
                <div className="card-title-row">
                    <span className="drag-handle">⋮⋮</span>
                    <h3 className="card-title card-title-orange">🎭 说话风味（三轴配置）</h3>
                </div>
                {currentProject && (
                    <button className="cyber-btn cyber-btn-sm" onClick={() => editingFlavor ? setEditingFlavor(false) : startEditFlavor()}>
                        {editingFlavor ? '取消' : '配置'}
                    </button>
                )}
            </div>
            {currentProject ? (
                editingFlavor ? (
                    <FlavorEditForm
                        flavorForm={flavorForm} setFlavorForm={setFlavorForm}
                        flavorNamingStyles={flavorNamingStyles} flavorDialects={flavorDialects}
                        flavorSpeechStyles={flavorSpeechStyles} worldviewTemplates={worldviewTemplates}
                        systemPersonas={systemPersonas} saveFlavor={saveFlavor}
                        setEditingFlavor={setEditingFlavor}
                    />
                ) : <FlavorTagsDisplay tags={renderTags()} expandedFlavorDetail={expandedFlavorDetail}
                    flavorDetailData={flavorDetailData} flavorDetailLoading={flavorDetailLoading}
                    handleFlavorTagClick={handleFlavorTagClick} closeFlavorDetail={closeFlavorDetail} />
            ) : (
                <div className="text-sm text-muted">请先选择产品</div>
            )}
        </div>
    );
}

function FlavorTagsDisplay({ tags, expandedFlavorDetail, flavorDetailData, flavorDetailLoading, handleFlavorTagClick, closeFlavorDetail }) {
    if (tags.length === 0) {
        return <div className="text-sm text-muted">未配置，角色可单独设置方言/风格/命名规范</div>;
    }
    return (
        <div>
            <div className="tag-group">
                {tags.map((t, i) => (
                    <span key={i} className="flavor-tag"
                        style={{
                            background: `rgba(${t.rgb},0.1)`, color: t.color,
                            border: `1px solid rgba(${t.rgb},${expandedFlavorDetail === t.key ? '0.5' : '0.2'})`,
                            cursor: t.id ? 'pointer' : 'default'
                        }}
                        onClick={() => t.id && handleFlavorTagClick(t.key, t.id)}
                        onMouseEnter={e => { if (t.id) e.currentTarget.style.background = `rgba(${t.rgb},0.2)`; }}
                        onMouseLeave={e => { if (t.id) e.currentTarget.style.background = `rgba(${t.rgb},0.1)`; }}
                    >
                        {t.icon} {t.label} {expandedFlavorDetail === t.key ? '▾' : t.id ? '▸' : ''}
                    </span>
                ))}
            </div>
            <FlavorDetailPanel expandedFlavorDetail={expandedFlavorDetail}
                flavorDetailData={flavorDetailData} flavorDetailLoading={flavorDetailLoading}
                closeDetail={closeFlavorDetail} />
        </div>
    );
}
