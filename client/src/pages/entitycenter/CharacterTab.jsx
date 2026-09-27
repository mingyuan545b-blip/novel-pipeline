/**
 * CharacterTab.jsx — 实体中心「角色」页
 * 布局：左侧分组列表（按等级分主次） + 右侧详情（未选中时显示总览）
 */
import { useCallback, useMemo } from 'react';
import logger from '../../shared/logger';
import { useDeleteEntity } from '../../hooks/queries/useEntityCenter';
import { CharacterDetail } from './CharacterDetail';
import CharacterListPanel from './CharacterListPanel';
import CharacterOverview from './CharacterOverview';
import { adaptChar } from './characterListUtils';

export default function CharacterTab({ characters, selectedCharId, setSelectedCharId, regLoading, selectedChar, charBinds, charRelations, getCharName, projectId, onRepaired }) {
    const deleteMut = useDeleteEntity();
    const adapted = useMemo(() => (characters || []).map(adaptChar), [characters]);

    const handleDeleteChar = useCallback(async (charId) => {
        try {
            await deleteMut.mutateAsync({ type: 'entity-registry', id: charId });
            if (selectedCharId === charId) setSelectedCharId(null);
        } catch (e) {
            logger.error('CharacterTab', 'Delete failed:', e.message);
        }
    }, [deleteMut, selectedCharId, setSelectedCharId]);

    return (
        <div className="ec-flex ec-gap-16">
            <CharacterListPanel characters={adapted} selectedCharId={selectedCharId}
                onSelect={setSelectedCharId} onDeleteChar={handleDeleteChar} loading={regLoading} />
            <div className="ec-flex-1 ec-min-w-0">
                {selectedChar ? (
                    <CharacterDetail selectedChar={selectedChar} charBinds={charBinds} charRelations={charRelations}
                        getCharName={getCharName} projectId={projectId} onRepaired={onRepaired} />
                ) : (
                    <CharacterOverview characters={adapted} onSelect={setSelectedCharId} />
                )}
            </div>
        </div>
    );
}
