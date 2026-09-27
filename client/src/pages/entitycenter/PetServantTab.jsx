import { GenerativeAvatar, RadialProgress, RarityBadge, handleCardKey } from './UiComponents';
import { GROWTH_COLORS, SERVANT_LABELS } from './constants';
import CategoryBrowser from './CategoryBrowser';
import {
    petGroupOf, petGroups, petSearchOf, PET_SORTS,
    servantGroupOf, servantGroups, servantSearchOf, SERVANT_SORTS,
} from './entityBrowserConfig';
import { ownerFacetsOf, ownerGroupsOf } from './ownershipUtils';

function PetStat({ value, label, color }) {
    return (
        <div className="ec-flex-1">
            <div className="ec-flex ec-items-center ec-gap-6 ec-mb-2">
                <RadialProgress value={value} size={24} strokeWidth={2.5} color={color} />
                <span className="ec-text-11 ec-text-muted">{label} <span className="ec-tabular">{value}</span></span>
            </div>
        </div>
    );
}

function PetExpanded({ pet, getCharName }) {
    return (
        <div className="ec-expand-area ec-border-green" onClick={e => e.stopPropagation()}>
            <div className="ec-grid-2 ec-text-12">
                {pet._adapted?.abilities?.length > 0 && <div className="ec-text-muted">技能: <span className="ec-text-secondary">{pet._adapted.abilities.join(', ')}</span></div>}
                {pet._adapted?.ownerId && <div className="ec-text-muted">主人: <span className="ec-text-secondary">{getCharName(pet._adapted.ownerId)}</span></div>}
                {pet._adapted?.briefDesc && <div className="ec-span-full ec-text-muted">描述: <span className="ec-text-secondary">{pet._adapted.briefDesc}</span></div>}
            </div>
        </div>
    );
}

function PetCard({ pet, isExpanded, toggleExpand, getCharName }) {
    const petName = pet._adapted?.name || pet.id;
    const growthColor = GROWTH_COLORS[pet.growthStage] || 'var(--neon-cyan)';
    return (
        <div className="cyber-card ec-card-btn" role="button" tabIndex={0}
            onClick={() => toggleExpand(pet.id)}
            onKeyDown={handleCardKey(() => toggleExpand(pet.id))}
            aria-label={`展开宠物 ${petName}`}
            aria-expanded={isExpanded}
        >
            <div className="ec-flex ec-justify-between ec-items-start ec-mb-6">
                <div className="ec-flex-1 ec-min-w-0">
                    <div className="ec-flex ec-items-center ec-gap-6 ec-mb-4">
                        <GenerativeAvatar name={petName} size={28} />
                        <span className="ec-text-14 ec-font-600 ec-ellipsis">{petName}</span>
                        {pet.species && <span className="ec-badge ec-badge-cyan">{pet.species}</span>}
                        {pet.rarity && <RarityBadge rarity={pet.rarity} />}
                        {pet._adapted?.petClass && <span className="ec-badge ec-badge-purple">{pet._adapted.petClass}</span>}
                    </div>
                    {pet.growthStage && (
                        <span className="ec-badge-lg ec-badge-growth" style={{ '--growth-color': growthColor }}>
                            {pet.growthStage}
                        </span>
                    )}
                </div>
            </div>
            <div className="ec-flex ec-gap-12 ec-mt-6">
                {pet.loyalty !== undefined && <PetStat value={pet.loyalty} label="忠诚度" color="var(--neon-green)" />}
                {pet.intelligence !== undefined && <PetStat value={pet.intelligence} label="智慧度" color="var(--neon-purple)" />}
            </div>
            {isExpanded && <PetExpanded pet={pet} getCharName={getCharName} />}
        </div>
    );
}

export function PetsTab({ pets, expandedIds, toggleExpand, getCharName }) {
    const kindOf = (p) => (p._adapted?.ownerId ? 'character' : 'none');
    return (
        <CategoryBrowser items={pets} searchOf={petSearchOf} searchPlaceholder="搜索宠物名 / 物种 / 技能…"
            facets={ownerFacetsOf(pets, kindOf)} facetOf={kindOf} facetAllLabel="全部归属"
            groups={petGroups(pets)} groupOf={petGroupOf} sortOptions={PET_SORTS}
            renderCard={p => <PetCard pet={p} isExpanded={expandedIds.has(p.id)} toggleExpand={toggleExpand} getCharName={getCharName} />}
            emptyIcon="🐾" emptyText="暂无宠物数据（由素材 / 管线自动提取）" />
    );
}

function ServantExpanded({ sv, getCharName }) {
    return (
        <div className="ec-expand-area ec-border-pink" onClick={e => e.stopPropagation()}>
            <div className="ec-grid-2 ec-text-12">
                {sv._adapted?.masterId && <div className="ec-text-muted">主人: <span className="ec-text-secondary">{getCharName(sv._adapted.masterId)}</span></div>}
                {sv._adapted?.briefDesc && <div className="ec-span-full ec-text-muted">描述: <span className="ec-text-secondary">{sv._adapted.briefDesc}</span></div>}
            </div>
        </div>
    );
}

function ServantCard({ sv, isExpanded, toggleExpand, getCharName }) {
    const svName = sv._adapted?.name || sv.id;
    const typeLabel = SERVANT_LABELS[sv._adapted?.servantType] || sv._adapted?.servantType || '未知';
    return (
        <div className="cyber-card ec-card-btn" role="button" tabIndex={0}
            onClick={() => toggleExpand(sv.id)}
            onKeyDown={handleCardKey(() => toggleExpand(sv.id))}
            aria-label={`展开仆人 ${svName}`}
            aria-expanded={isExpanded}
        >
            <div className="ec-flex ec-justify-between ec-items-start ec-mb-6">
                <div className="ec-flex-1 ec-min-w-0">
                    <div className="ec-flex ec-items-center ec-gap-6 ec-mb-4">
                        <GenerativeAvatar name={svName} size={28} />
                        <span className="ec-text-14 ec-font-600 ec-ellipsis">{svName}</span>
                        <span className="ec-badge ec-badge-pink">{typeLabel}</span>
                    </div>
                </div>
            </div>
            <div className="ec-flex ec-gap-12 ec-mt-6">
                {sv.loyalty !== undefined && <PetStat value={sv.loyalty} label="忠诚度" color="var(--neon-green)" />}
                {sv._adapted?.competence !== undefined && <PetStat value={sv._adapted.competence} label="能力值" color="var(--neon-orange)" />}
            </div>
            {sv.specialty && (
                <div className="ec-mt-6 ec-text-11 ec-text-muted">
                    专长: <span className="ec-text-secondary">{Array.isArray(sv.specialty) ? sv.specialty.join(', ') : sv.specialty}</span>
                </div>
            )}
            {isExpanded && <ServantExpanded sv={sv} getCharName={getCharName} />}
        </div>
    );
}

export function ServantsTab({ servants, expandedIds, toggleExpand, getCharName }) {
    const kindOf = (s) => (s._adapted?.masterId ? 'character' : 'none');
    return (
        <CategoryBrowser items={servants} searchOf={servantSearchOf} searchPlaceholder="搜索仆人名 / 专长…"
            facets={ownerFacetsOf(servants, kindOf)} facetOf={kindOf} facetAllLabel="全部归属"
            groups={servantGroups(servants)} groupOf={servantGroupOf} sortOptions={SERVANT_SORTS}
            renderCard={s => <ServantCard sv={s} isExpanded={expandedIds.has(s.id)} toggleExpand={toggleExpand} getCharName={getCharName} />}
            emptyIcon="🧑‍💼" emptyText="暂无仆人数据（由素材 / 管线自动提取）" />
    );
}
