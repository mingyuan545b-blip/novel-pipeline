import { useState, useMemo, useCallback } from 'react';
import logger from '../../shared/logger';
import { GenerativeAvatar, handleCardKey, LoadingSkeleton } from './UiComponents';
import { ROLE_COLORS, ROLE_LABELS, ROLE_PRIORITY } from './constants';
import { useDeleteEntity } from '../../hooks/queries/useEntityCenter';
import { CharacterDetail, RoleBadge, WorldScopeBadge, formatTime } from './CharacterDetail';

const SORT_OPTIONS = [
    { key: 'createdAt_desc', label: '创建时间 (新→旧)' },
    { key: 'createdAt_asc', label: '创建时间 (旧→新)' },
    { key: 'name_asc', label: '名称 A→Z' },
    { key: 'roleLevel_desc', label: '角色等级 (高→低)' },
];

function sortCharacters(characters, sortKey) {
    const sorted = [...characters];
    switch (sortKey) {
        case 'createdAt_desc':
            sorted.sort((a, b) => ((b.createdAt || b._adapted?.createdAt || '').localeCompare(a.createdAt || a._adapted?.createdAt || '')));
            break;
        case 'createdAt_asc':
            sorted.sort((a, b) => ((a.createdAt || a._adapted?.createdAt || '').localeCompare(b.createdAt || b._adapted?.createdAt || '')));
            break;
        case 'name_asc':
            sorted.sort((a, b) => ((a._adapted?.name || a.id).localeCompare(b._adapted?.name || b.id)));
            break;
        case 'roleLevel_desc':
            sorted.sort((a, b) => (ROLE_PRIORITY[b._adapted?.roleLevel] || 0) - (ROLE_PRIORITY[a._adapted?.roleLevel] || 0));
            break;
        default:
            sorted.sort((a, b) => ((b.createdAt || '').localeCompare(a.createdAt || '')));
    }
    return sorted;
}

function CharacterList({ characters, selectedCharId, setSelectedCharId, regLoading, onDeleteChar }) {
    const [sortBy, setSortBy] = useState('createdAt_desc');
    const [confirmDeleteId, setConfirmDeleteId] = useState(null);

    const sorted = useMemo(() => sortCharacters(characters, sortBy), [characters, sortBy]);

    const handleDeleteClick = useCallback((e, ch) => {
        e.stopPropagation();
        if (confirmDeleteId === ch.id) {
            onDeleteChar(ch.id);
            setConfirmDeleteId(null);
        } else {
            setConfirmDeleteId(ch.id);
            setTimeout(() => setConfirmDeleteId(null), 3000);
        }
    }, [confirmDeleteId, onDeleteChar]);

    if (regLoading) return <LoadingSkeleton />;
    if (!characters.length) {
        return (
            <div className="cyber-card cyber-empty">
                <div className="cyber-empty-icon" aria-hidden="true">👤</div>
                <div>暂无角色数据</div>
            </div>
        );
    }
    return (
        <>
            <div className="ec-sort-bar">
                <select className="ec-sort-select" value={sortBy} onChange={e => setSortBy(e.target.value)} aria-label="排序方式">
                    {SORT_OPTIONS.map(opt => <option key={opt.key} value={opt.key}>{opt.label}</option>)}
                </select>
                <span className="ec-text-11 ec-text-muted ec-tabular">{characters.length} 个角色</span>
            </div>
            {sorted.map(ch => {
                const chName = ch._adapted?.name || ch.id;
                const chRole = ch._adapted?.roleLevel || 'npc';
                const roleColor = ROLE_COLORS[chRole] || '#888';
                const roleLabel = ROLE_LABELS[chRole] || chRole || 'NPC';
                const isSelected = selectedCharId === ch.id;
                const isConfirming = confirmDeleteId === ch.id;
                const createdStr = ch.createdAt || ch._adapted?.createdAt;
                return (
                    <div key={ch.id} className={`cyber-card ec-card-item ${isSelected ? 'ec-char-selected' : 'ec-char-unselected'}`}>
                        <button className="ec-card-main-btn"
                            onClick={() => setSelectedCharId(isSelected ? null : ch.id)}
                            onKeyDown={handleCardKey(() => setSelectedCharId(isSelected ? null : ch.id))}
                            aria-label={`选择角色 ${chName}`}
                        >
                            <div className="ec-flex ec-gap-10 ec-items-center">
                                <GenerativeAvatar name={chName} size={36} />
                                <div className="ec-flex-1 ec-min-w-0">
                                    <div className="ec-flex ec-items-center ec-gap-6 ec-mb-4">
                                        <span className="ec-text-14 ec-font-600 ec-text-primary ec-ellipsis">{chName}</span>
                                        <RoleBadge roleColor={roleColor} label={roleLabel} />
                                        {ch._adapted?.worldScopePrimary && ch._adapted.worldScopePrimary !== 'main-world' && (
                                            <WorldScopeBadge primary={ch._adapted.worldScopePrimary} name={ch._adapted.worldScopeName} color={ch._adapted.worldScopeColor} isVisitor={ch._adapted.worldScopeIsVisitor} />
                                        )}
                                    </div>
                                    <div className="ec-flex ec-items-center ec-gap-8">
                                        {(ch._adapted?.appearCount) !== undefined && (
                                            <span className="ec-text-11 ec-text-muted ec-tabular">出场 {ch._adapted.appearCount} 次</span>
                                        )}
                                        {createdStr && (
                                            <span className="ec-text-11 ec-text-muted ec-tabular">{formatTime(createdStr)}</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </button>
                        <button className={`ec-delete-btn ${isConfirming ? 'ec-delete-confirm' : ''}`}
                            onClick={e => handleDeleteClick(e, ch)}
                            aria-label={isConfirming ? `确认删除 ${chName}` : `删除 ${chName}`}
                            title={isConfirming ? '再次点击确认删除' : '删除此角色'}
                        >
                            {isConfirming ? '确认?' : '×'}
                        </button>
                    </div>
                );
            })}
        </>
    );
}

export default function CharacterTab({ characters, selectedCharId, setSelectedCharId, regLoading, selectedChar, charBinds, charRelations, getCharName, LoadingSkeleton, projectId, onRepaired }) {
    const deleteMut = useDeleteEntity();

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
            <div className="ec-char-sidebar">
                <CharacterList characters={characters} selectedCharId={selectedCharId} setSelectedCharId={setSelectedCharId} regLoading={regLoading} LoadingSkeleton={LoadingSkeleton} onDeleteChar={handleDeleteChar} />
            </div>
            <div className="ec-flex-1 ec-min-w-0">
                <CharacterDetail selectedChar={selectedChar} charBinds={charBinds} charRelations={charRelations} getCharName={getCharName} projectId={projectId} onRepaired={onRepaired} />
            </div>
        </div>
    );
}
