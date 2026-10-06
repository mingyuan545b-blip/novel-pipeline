/* eslint-disable react-refresh/only-export-components */
import { ROLE_COLORS } from './constants';
import { CharacterHeader, RoleBadge, WorldScopeBadge, formatTime } from './CharacterHeader';
import DataHealthBanner from './DataHealthBanner';
import { BindsSection, RelationsSection } from './BindsAndRelations';
import CharacterTraits from './CharacterTraits';
import OwnershipSection from './OwnershipSection';
import { BehaviorRulesSection } from './BehaviorRulesSection';
import GenreStateSection from './GenreStateSection';
import KnowledgeSection from './KnowledgeSection';

function CharacterDetail({ selectedChar, charBinds, charRelations, getCharName, projectId, onRepaired }) {
    if (!selectedChar) {
        return (
            <div className="cyber-card cyber-empty">
                <div className="cyber-empty-icon" aria-hidden="true">👤</div>
                <div>请从左侧选择一个角色查看详情</div>
            </div>
        );
    }

    const adapted = selectedChar._adapted;
    const roleColor = ROLE_COLORS[adapted?.roleLevel || 'npc'];

    return (
        <div className="ec-flex-col ec-gap-12">
            <CharacterHeader adapted={adapted} roleColor={roleColor} />
            <DataHealthBanner adapted={adapted} projectId={projectId} onRepaired={onRepaired} />
            <CharacterTraits adapted={adapted} />
            <OwnershipSection projectId={projectId} adapted={adapted} />
            <BehaviorRulesSection behaviorRules={adapted?.behaviorRules} />
            <GenreStateSection adapted={adapted} />
            <BindsSection charBinds={charBinds} />
            <RelationsSection charRelations={charRelations} getCharName={getCharName} />
            <KnowledgeSection entityId={selectedChar?.id} projectId={projectId} />
        </div>
    );
}

export { CharacterDetail, RoleBadge, WorldScopeBadge, formatTime };
