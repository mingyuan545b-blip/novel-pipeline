import { GenerativeAvatar, RarityBadge, ProgressBar, handleCardKey } from './UiComponents';
import { MASTERY_MAP } from './constants';
import CategoryBrowser from './CategoryBrowser';
import { defOwnerFacets, defFacetOf, defSearchOf, DEF_GROUPS, defSortOptions } from './entityBrowserConfig';

function EmptyState({ icon, text }) {
    return (
        <div className="cyber-card cyber-empty">
            <div className="cyber-empty-icon" aria-hidden="true">{icon}</div>
            <div>{text}</div>
        </div>
    );
}

function ExpandedContent({ item, descLevel, toggleDesc, binders, getCharName, borderColor }) {
    return (
        <div className="ec-expand-area" style={{ borderLeft: `3px solid ${borderColor}` }} onClick={e => e.stopPropagation()}>
            <div className="ec-flex ec-gap-6 ec-mb-8">
                <button className="cyber-btn cyber-btn-sm ec-inner-btn ec-text-11 ec-btn-compact"
                    onClick={e => { e.stopPropagation(); toggleDesc(item.id); }}>
                    {descLevel[item.id] === 'detail' ? '简要描述' : '详细描述'}
                </button>
            </div>
            <div className="ec-text-12 ec-text-secondary ec-desc-block">
                {descLevel[item.id] === 'detail' ? (item.detailDesc || item.summaryDesc || '暂无详细描述') : (item.summaryDesc || item.detailDesc || '暂无描述')}
            </div>
            {binders.length > 0 && <BindersList binders={binders} getCharName={getCharName} />}
        </div>
    );
}

function BindersList({ binders, getCharName }) {
    return (
        <div className="ec-mt-8">
            <div className="ec-text-11 ec-text-muted ec-mb-4">绑定角色:</div>
            <div className="ec-flex ec-gap-4 ec-flex-wrap">
                {binders.map(b => (
                    <span key={b.id} className="ec-badge ec-badge-cyan">{getCharName(b.characterId)}</span>
                ))}
            </div>
        </div>
    );
}

function DefinitionCard({ item, isExpanded, descLevel, toggleExpand, toggleDesc, allBinds, getCharName, borderColor }) {
    const binders = allBinds.filter(b => b.defId === item.id);
    return (
        <div className="cyber-card ec-card-btn" role="button" tabIndex={0}
            onClick={() => toggleExpand(item.id)}
            onKeyDown={handleCardKey(() => toggleExpand(item.id))}
            aria-label={`展开 ${item.name || item.id}`}
            aria-expanded={isExpanded}
        >
            <div className="ec-flex ec-justify-between ec-items-start ec-mb-6">
                <div className="ec-flex-1 ec-min-w-0">
                    <div className="ec-flex ec-items-center ec-gap-6 ec-mb-4">
                        <GenerativeAvatar name={item.name || item.defName || item.id} size={28} />
                        <span className="ec-text-14 ec-font-600 ec-ellipsis">{item.name || item.defName || item.id}</span>
                        <RarityBadge rarity={item.rarity} />
                    </div>
                    {item.briefDesc && <div className="ec-text-12 ec-text-muted ec-line-clamp-2 ec-line-height-15">{item.briefDesc}</div>}
                </div>
            </div>
            {isExpanded && (
                <ExpandedContent item={item} descLevel={descLevel} toggleDesc={toggleDesc} binders={binders} getCharName={getCharName} borderColor={borderColor} />
            )}
        </div>
    );
}

export function EquipmentTab({ equipment, expandedIds, descLevel, toggleExpand, toggleDesc, allBinds, getCharName }) {
    const boundIds = new Set(allBinds.map(b => b.defId));
    return (
        <CategoryBrowser items={equipment} searchOf={defSearchOf} searchPlaceholder="搜索装备名 / 描述…"
            facets={defOwnerFacets(equipment)} facetOf={defFacetOf} facetAllLabel="全部归属"
            groups={DEF_GROUPS} groupOf={d => (boundIds.has(d.id) ? 'bound' : 'loose')}
            sortOptions={defSortOptions(boundIds)}
            renderCard={d => <DefinitionCard item={d} isExpanded={expandedIds.has(d.id)} descLevel={descLevel} toggleExpand={toggleExpand} toggleDesc={toggleDesc} allBinds={allBinds} getCharName={getCharName} borderColor="var(--neon-orange)" />}
            emptyIcon="⚔" emptyText="暂无装备数据（来源 item-definitions）" />
    );
}

function TechniqueBinders({ binders, getCharName }) {
    return (
        <div className="ec-mt-8">
            <div className="ec-text-11 ec-text-muted ec-mb-6">修炼进度:</div>
            <div className="ec-flex-col ec-gap-4">
                {binders.map(b => {
                    const mastery = MASTERY_MAP[b.masteryLevel] ?? (b.masteryProgress || 0);
                    return (
                        <div key={b.id} className="ec-flex ec-items-center ec-gap-8">
                            <span className="ec-text-11 ec-text-secondary ec-ellipsis ec-min-w-60">{getCharName(b.characterId)}</span>
                            {b.masteryLevel && <span className="ec-text-10 ec-text-muted ec-shrink-0">{b.masteryLevel}</span>}
                            <ProgressBar value={mastery} color={mastery >= 85 ? '#ffd700' : mastery >= 60 ? 'var(--neon-purple)' : 'var(--neon-cyan)'} />
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function TechniqueCard({ item, isExpanded, descLevel, toggleExpand, toggleDesc, allBinds, getCharName }) {
    const binders = allBinds.filter(b => b.defId === item.id);
    return (
        <div className="cyber-card ec-card-btn" role="button" tabIndex={0}
            onClick={() => toggleExpand(item.id)}
            onKeyDown={handleCardKey(() => toggleExpand(item.id))}
            aria-label={`展开功法 ${item.name || item.id}`}
            aria-expanded={isExpanded}
        >
            <div className="ec-flex ec-justify-between ec-items-start ec-mb-6">
                <div className="ec-flex-1 ec-min-w-0">
                    <div className="ec-flex ec-items-center ec-gap-6 ec-mb-4">
                        <GenerativeAvatar name={item.name || item.defName || item.id} size={28} />
                        <span className="ec-text-14 ec-font-600 ec-ellipsis">{item.name || item.defName || item.id}</span>
                        <RarityBadge rarity={item.rarity} />
                    </div>
                    {item.briefDesc && <div className="ec-text-12 ec-text-muted ec-line-clamp-2 ec-line-height-15">{item.briefDesc}</div>}
                </div>
            </div>
            {isExpanded && (
                <div className="ec-expand-area ec-border-purple" onClick={e => e.stopPropagation()}>
                    <div className="ec-flex ec-gap-6 ec-mb-8">
                        <button className="cyber-btn cyber-btn-sm ec-inner-btn ec-text-11 ec-btn-compact"
                            onClick={e => { e.stopPropagation(); toggleDesc(item.id); }}>
                            {descLevel[item.id] === 'detail' ? '简要描述' : '详细描述'}
                        </button>
                    </div>
                    <div className="ec-text-12 ec-text-secondary ec-desc-block">
                        {descLevel[item.id] === 'detail' ? (item.detailDesc || item.summaryDesc || '暂无详细描述') : (item.summaryDesc || item.detailDesc || '暂无描述')}
                    </div>
                    {binders.length > 0 && <TechniqueBinders binders={binders} getCharName={getCharName} />}
                </div>
            )}
        </div>
    );
}

export function TechniquesTab({ techniques, expandedIds, descLevel, toggleExpand, toggleDesc, allBinds, getCharName }) {
    const boundIds = new Set(allBinds.map(b => b.defId));
    return (
        <CategoryBrowser items={techniques} searchOf={defSearchOf} searchPlaceholder="搜索功法名 / 描述…"
            facets={defOwnerFacets(techniques)} facetOf={defFacetOf} facetAllLabel="全部归属"
            groups={DEF_GROUPS} groupOf={d => (boundIds.has(d.id) ? 'bound' : 'loose')}
            sortOptions={defSortOptions(boundIds)}
            renderCard={d => <TechniqueCard item={d} isExpanded={expandedIds.has(d.id)} descLevel={descLevel} toggleExpand={toggleExpand} toggleDesc={toggleDesc} allBinds={allBinds} getCharName={getCharName} />}
            emptyIcon="📜" emptyText="暂无功法数据（来源 item-definitions）" />
    );
}

export { EmptyState };
