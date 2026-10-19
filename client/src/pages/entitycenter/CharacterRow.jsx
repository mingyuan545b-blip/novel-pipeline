/**
 * CharacterRow.jsx — 单个角色行（按等级分级显示：主角醒目 / 配角次之 / NPC 收敛）
 */
import { GenerativeAvatar } from './UiComponents';
import { handleCardKey } from './uiHelpers';
import { ROLE_COLORS, ROLE_LABELS } from './constants';
import { RoleBadge, WorldScopeBadge, formatTime } from './CharacterDetail';

export default function CharacterRow({ char, selected, confirming, onSelect, onDelete }) {
    const role = char.role || 'npc';
    const roleColor = ROLE_COLORS[role] || '#888';
    const levelClass = role === 'protagonist' ? 'cl-p1' : role === 'supporting' ? 'cl-p2' : 'cl-p3';
    const avatarSize = role === 'protagonist' ? 44 : role === 'supporting' ? 36 : 28;

    return (
        <div className={`cl-row ${levelClass} ${selected ? 'cl-row-on' : ''}`}>
            <button className="cl-row-btn" onClick={onSelect} onKeyDown={handleCardKey(onSelect)}
                aria-label={`选择角色 ${char.name}`}>
                <GenerativeAvatar name={char.name} size={avatarSize} />
                <div className="cl-row-body">
                    <div className="cl-row-top">
                        <span className="cl-row-name">{char.name}</span>
                        <RoleBadge roleColor={roleColor} label={ROLE_LABELS[role] || role} />
                        {char.worldScopePrimary && char.worldScopePrimary !== 'main-world' && (
                            <WorldScopeBadge primary={char.worldScopePrimary} name={char.worldScopeName}
                                color={char.worldScopeColor} isVisitor={char.worldScopeIsVisitor} />
                        )}
                    </div>
                    <div className="cl-row-meta">
                        {char.appearCount > 0 && (
                            <span className="cl-appear" style={{ color: roleColor }}>出场 {char.appearCount} 次</span>
                        )}
                        {char.createdAt && <span>{formatTime(char.createdAt)}</span>}
                    </div>
                </div>
            </button>
            <button className={`cl-del ${confirming ? 'cl-del-on' : ''}`} onClick={onDelete}
                aria-label={confirming ? `确认删除 ${char.name}` : `删除 ${char.name}`}
                title={confirming ? '再次点击确认删除' : '删除此角色'}>
                {confirming ? '确认?' : '×'}
            </button>
        </div>
    );
}
