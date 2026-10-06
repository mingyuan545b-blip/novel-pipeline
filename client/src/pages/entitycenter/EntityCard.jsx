/**
 * EntityCard.jsx — 装备 / 功法 列表卡片（紧凑只读）
 *
 * 交互约定（用户诉求）：点击卡片只在右侧详情栏展开细节，左侧卡片本身不变形、不内联展开。
 * 卡片仅承载「概要」：名称 / 稀有度 / 一行简介 / 归属与生命周期。
 */
import { useMemo, useState } from 'react';
import { GenerativeAvatar, RarityBadge } from './UiComponents';
import CategoryBrowser from './CategoryBrowser';
import { defSearchOf, defSortOptions } from './entityBrowserConfig';
import { ownerFacetsOf, ownerGroupsOf, useOwnership } from './ownershipUtils';
import DefinitionDetailPane from './DefinitionDetailPane';
import DefinitionSplitView from './DefinitionSplitView';
import { lifecycleLabel, isRetired } from './lifecycleUi';

function DefinitionCard({ item, owner, material, typeLabel, badgeClass }) {
    const desc = item.briefDesc || item.summaryDesc || item.detailDesc || material?.description || '';
    const retired = isRetired(material);
    return (
        <div className="cyber-card ec-def-card">
            <GenerativeAvatar name={item.name || item.id} size={26} />
            <div className="ec-def-card-body">
                <div className="ec-def-card-title">
                    <span className="ec-text-13 ec-font-600 ec-ellipsis">{item.name || item.id}</span>
                    <RarityBadge rarity={item.rarity} />
                </div>
                {desc && <div className="ec-text-11 ec-text-muted ec-ellipsis">{desc}</div>}
                <div className="ec-def-card-foot">
                    {typeLabel && <span className={`ec-badge ${badgeClass}`}>{typeLabel}</span>}
                    {owner && <span className="ec-text-10 ec-text-muted ec-ellipsis">{owner}</span>}
                    {material && <span className={`ec-text-10 ec-shrink-0 ${retired ? 'ec-text-muted' : 'ec-text-secondary'}`}>{lifecycleLabel(material)}</span>}
                </div>
            </div>
        </div>
    );
}

function RetiredToggle({ count, showRetired, onToggle }) {
    return (
        <div className="cb-chips ec-mb-8">
            <button className={`cb-chip ${showRetired ? 'cb-chip-on' : ''}`} onClick={onToggle}>
                含已归档/报废 {count} 个
            </button>
        </div>
    );
}

export function EquipmentTab({ equipment, allBinds, getCharName, materialsByName, onPatchLifecycle, currentChapter }) {
    const { kindOf, ownerOf, boundIds } = useOwnership(equipment, allBinds, getCharName);
    const [showRetired, setShowRetired] = useState(false);
    const matOf = d => materialsByName && materialsByName.get(d.name);
    const retiredCount = equipment.filter(d => isRetired(matOf(d))).length;
    const items = useMemo(() => (showRetired ? equipment : equipment.filter(d => !isRetired(matOf(d)))),
        // eslint-disable-next-line react-hooks/exhaustive-deps -- matOf 由 materialsByName 派生
        [equipment, showRetired, materialsByName]);
    return (
        <>
            <RetiredToggle count={retiredCount} showRetired={showRetired} onToggle={() => setShowRetired(v => !v)} />
            <DefinitionSplitView items={items} emptyIcon="⚔"
                browserOf={({ selectedId, onSelect }) => (
                    <CategoryBrowser items={items} searchOf={defSearchOf} searchPlaceholder="搜索装备名 / 描述…"
                        facets={ownerFacetsOf(equipment, kindOf)} facetOf={kindOf} facetAllLabel="全部归属"
                        groups={ownerGroupsOf(equipment, kindOf)} groupOf={kindOf}
                        sortOptions={defSortOptions(boundIds)} selectedId={selectedId} onSelect={onSelect}
                        renderCard={d => <DefinitionCard item={d} owner={ownerOf(d)} material={matOf(d)} typeLabel="装备" badgeClass="ec-badge-orange" />}
                        emptyIcon="⚔" emptyText={retiredCount ? '装备都已归档/报废（勾选上方可查看）' : '暂无装备数据（来源 item-definitions）'} />
                )}
                detailOf={d => <DefinitionDetailPane item={d} material={matOf(d)} allBinds={allBinds} getCharName={getCharName}
                    ownerText={ownerOf(d)} onPatchLifecycle={onPatchLifecycle} borderColor="var(--neon-orange)" currentChapter={currentChapter} />} />
        </>
    );
}

export function TechniquesTab({ techniques, allBinds, getCharName, materialsByName, onPatchLifecycle, currentChapter }) {
    const { kindOf, ownerOf, boundIds } = useOwnership(techniques, allBinds, getCharName);
    const [showRetired, setShowRetired] = useState(false);
    const matOf = d => materialsByName && materialsByName.get(d.name);
    const retiredCount = techniques.filter(d => isRetired(matOf(d))).length;
    const items = useMemo(() => (showRetired ? techniques : techniques.filter(d => !isRetired(matOf(d)))),
        // eslint-disable-next-line react-hooks/exhaustive-deps -- matOf 由 materialsByName 派生
        [techniques, showRetired, materialsByName]);
    return (
        <>
            <RetiredToggle count={retiredCount} showRetired={showRetired} onToggle={() => setShowRetired(v => !v)} />
            <DefinitionSplitView items={items} emptyIcon="📜"
                browserOf={({ selectedId, onSelect }) => (
                    <CategoryBrowser items={items} searchOf={defSearchOf} searchPlaceholder="搜索功法名 / 描述…"
                        facets={ownerFacetsOf(techniques, kindOf)} facetOf={kindOf} facetAllLabel="全部归属"
                        groups={ownerGroupsOf(techniques, kindOf)} groupOf={kindOf}
                        sortOptions={defSortOptions(boundIds)} selectedId={selectedId} onSelect={onSelect}
                        renderCard={d => <DefinitionCard item={d} owner={ownerOf(d)} material={matOf(d)} typeLabel="功法" badgeClass="ec-badge-purple" />}
                        emptyIcon="📜" emptyText="暂无功法数据（来源 item-definitions）" />
                )}
                detailOf={d => <DefinitionDetailPane item={d} material={matOf(d)} allBinds={allBinds} getCharName={getCharName}
                    ownerText={ownerOf(d)} onPatchLifecycle={onPatchLifecycle} borderColor="var(--neon-purple)" currentChapter={currentChapter} />} />
        </>
    );
}
