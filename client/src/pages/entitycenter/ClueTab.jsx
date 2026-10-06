/**
 * ClueTab.jsx — 线索道具列（证据 / 关键道具 / 情报 / 道具 / 消耗品）
 *
 * 与装备/功法一致：左侧卡片紧凑只读（概要不内联展开），点击后在右侧详情栏载入细节。
 * 这些条目此前只存在于 item-definitions，UI 无正式位置。合并到 materials 后数据源会切换，
 * 这里统一用 isClueDef 判定保持兼容；布局走「列表 + 详情」双栏。
 */
import { useMemo } from 'react';
import CategoryBrowser from './CategoryBrowser';
import DefinitionSplitView from './DefinitionSplitView';
import DefinitionDetailPane from './DefinitionDetailPane';
import { useItemDefinitions } from '../../hooks/queries/useEntityCenter';
import { defSearchOf, defSortOptions, isClueDef, clueFacets, clueFacetOf, CLUE_TYPE_LABELS } from './entityBrowserConfig';
import { ownerGroupsOf, useOwnership } from './ownershipUtils';
import { GenerativeAvatar } from './UiComponents';

function ClueCard({ item, binders, owner }) {
    const typeLabel = CLUE_TYPE_LABELS[item.defType] || item.defType;
    const desc = item.briefDesc || item.summaryDesc || item.detailDesc || '';
    return (
        <div className="cyber-card ec-def-card">
            <GenerativeAvatar name={item.name || item.id} size={26} />
            <div className="ec-def-card-body">
                <div className="ec-def-card-title">
                    <span className="ec-text-13 ec-font-600 ec-ellipsis">{item.name || item.id}</span>
                    <span className="ec-badge ec-badge-cyan ec-shrink-0">{typeLabel}</span>
                </div>
                {desc && <div className="ec-text-11 ec-text-muted ec-ellipsis">{desc}</div>}
                <div className="ec-def-card-foot">
                    {owner && <span className="ec-text-10 ec-text-muted ec-ellipsis">{owner}</span>}
                    {binders.length > 0 && <span className="ec-text-10 ec-text-secondary ec-ellipsis">持有：{binders.join('、')}</span>}
                </div>
            </div>
        </div>
    );
}

export default function ClueTab({ projectId, allBinds, getCharName, currentChapter }) {
    const { data } = useItemDefinitions(projectId);
    const clues = useMemo(() => (data || []).filter(isClueDef), [data]);
    const { kindOf, ownerOf } = useOwnership(clues, allBinds, getCharName);
    const binderNamesOf = id => (allBinds || []).filter(b => b.defId === id).map(b => getCharName(b.characterId));

    return (
        <DefinitionSplitView items={clues} emptyIcon="🔎"
            browserOf={({ selectedId, onSelect }) => (
                <CategoryBrowser items={clues} searchOf={defSearchOf} searchPlaceholder="搜索线索名 / 描述…"
                    facets={clueFacets(clues)} facetOf={clueFacetOf} facetAllLabel="全部类型"
                    groups={ownerGroupsOf(clues, kindOf)} groupOf={kindOf}
                    sortOptions={defSortOptions(new Set())} selectedId={selectedId} onSelect={onSelect}
                    renderCard={d => <ClueCard item={d} binders={binderNamesOf(d.id)} owner={ownerOf(d)} />}
                    emptyIcon="🔎" emptyText="暂无线索道具（来源 item-definitions）" />
            )}
            detailOf={d => <DefinitionDetailPane item={d} allBinds={allBinds} getCharName={getCharName}
                ownerText={ownerOf(d)} borderColor="var(--neon-cyan)" currentChapter={currentChapter} />} />
    );
}
