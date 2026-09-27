/**
 * CharacterListPanel.jsx — 角色列表面板
 * 搜索 → 等级筛选 → 分组（主角/配角/NPC）→ 组内排序，默认按重要度。
 */
import { useState, useMemo, useCallback } from 'react';
import CharacterRow from './CharacterRow';
import { GROUP_META, SORT_OPTIONS, groupCharacters, countByRole, filterCharacters } from './characterListUtils';

const ROLE_CHIPS = [
    { key: 'all', label: '全部' },
    { key: 'protagonist', label: '主角' },
    { key: 'supporting', label: '配角' },
    { key: 'npc', label: 'NPC' },
];

export default function CharacterListPanel({ characters, selectedCharId, onSelect, onDeleteChar, loading }) {
    const [sortBy, setSortBy] = useState('importance');
    const [query, setQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [confirmId, setConfirmId] = useState(null);

    const counts = useMemo(() => countByRole(characters), [characters]);
    const groups = useMemo(
        () => groupCharacters(filterCharacters(characters, query, roleFilter), sortBy),
        [characters, query, roleFilter, sortBy]
    );
    const shown = groups.reduce((n, g) => n + g.members.length, 0);

    const handleDelete = useCallback((e, id) => {
        e.stopPropagation();
        if (confirmId === id) { onDeleteChar(id); setConfirmId(null); }
        else { setConfirmId(id); setTimeout(() => setConfirmId(null), 3000); }
    }, [confirmId, onDeleteChar]);

    if (loading) return <div className="cl-empty">加载角色中…</div>;
    if (!characters.length) return <div className="cl-empty">暂无角色数据</div>;

    return (
        <div className="cl-panel">
            <div className="cl-tools">
                <input className="cl-search" value={query} placeholder="搜索角色名…"
                    onChange={e => setQuery(e.target.value)} aria-label="搜索角色" />
                <div className="cl-sortrow">
                    <select className="cl-sort" value={sortBy} onChange={e => setSortBy(e.target.value)} aria-label="排序方式">
                        {SORT_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
                    </select>
                    <span className="cl-count">{shown}/{characters.length}</span>
                </div>
                <div className="cl-chips">
                    {ROLE_CHIPS.map(c => (
                        <button key={c.key} className={`cl-chip ${roleFilter === c.key ? 'cl-chip-on' : ''}`}
                            onClick={() => setRoleFilter(c.key)}>
                            {c.key !== 'all' && <span className="cl-chip-dot" style={{ background: GROUP_META[c.key].color }} />}
                            {c.label}{c.key === 'all' ? ` ${characters.length}` : ` ${counts[c.key]}`}
                        </button>
                    ))}
                </div>
            </div>

            {shown === 0 && <div className="cl-empty">没有匹配的角色</div>}

            {groups.map(g => (
                <div key={g.role}>
                    <div className="cl-group">
                        <span className="cl-group-dot" style={{ background: g.meta.color }} />
                        <span className="cl-group-name" style={{ color: g.meta.color }}>{g.meta.label}</span>
                        <span className="cl-group-count">{g.members.length}</span>
                        <span className="cl-group-hint">{g.meta.hint}</span>
                    </div>
                    {g.members.map(c => (
                        <CharacterRow key={c.id} char={c} selected={selectedCharId === c.id}
                            confirming={confirmId === c.id}
                            onSelect={() => onSelect(selectedCharId === c.id ? null : c.id)}
                            onDelete={e => handleDelete(e, c.id)} />
                    ))}
                </div>
            ))}
        </div>
    );
}
