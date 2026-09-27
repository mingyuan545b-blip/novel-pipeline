/**
 * WorldCard.jsx — 世界卡片（从 WorldScopeComponents 抽离，保证单文件≤200行）
 * 改进：按类型分组归属实体、字段修正（name/isVisitor）、长列表折叠，解决"卡片难读"。
 */
import { useState } from 'react';
import { POWER_SYSTEMS, TECH_LEVELS, DANGER_LEVELS, WORLD_TYPES, getPowerSystemLabels, getWorldTypeLabel } from './worldConstants';

const TYPE_ICONS = { character: '👤', npc: '🧑', equipment: '⚔', pet: '🐾', servant: '🧑‍💼', faction: '🏳', item: '📦', other: '📋' };
const TYPE_LABELS = { character: '角色', npc: 'NPC', equipment: '装备', pet: '宠物', servant: '仆人', faction: '势力', item: '物品', other: '其他' };
const COLLAPSE_AT = 6;

function WorldAttributeRow({ label, children }) {
    if (!children) return null;
    return (
        <div className="ws-world-attr-row">
            <span className="ws-world-attr-label">{label}</span>
            <span className="ws-world-attr-value">{children}</span>
        </div>
    );
}

const isVisitor = (e) => e.isVisitor === true || e.status === 'visitor';

export default function WorldCard({ world, entities }) {
    const [expanded, setExpanded] = useState(false);
    const residents = entities.filter(e => !isVisitor(e));
    const visitors = entities.filter(e => isVisitor(e));
    const powerLabels = getPowerSystemLabels(world.powerSystem);
    const hasAttributes = powerLabels.length > 0 || world.culture || world.rules || world.techLevel || world.dangerLevel || world.description;

    const byType = {};
    for (const e of entities) { const t = e.entityType || 'other'; (byType[t] = byType[t] || []).push(e); }
    const typeEntries = Object.entries(byType).sort((a, b) => b[1].length - a[1].length);

    return (
        <div className="ws-world-card" style={{ borderLeftColor: world.color || '#888' }}>
            <div className="ws-world-header">
                <div className="ws-world-dot" style={{ background: world.color || '#888' }} />
                <div className="ws-world-name" style={{ color: world.color || '#888' }}>{world.name}</div>
                {world.worldType && world.worldType !== 'main' && (
                    <span className="ws-badge-type">{WORLD_TYPES[world.worldType]?.icon} {getWorldTypeLabel(world.worldType)}</span>
                )}
                <span className="ws-world-count">{residents.length} 归属{visitors.length > 0 ? ` · ${visitors.length} 穿越` : ''}</span>
            </div>

            <div className="ws-type-chips">
                {typeEntries.map(([t, list]) => (
                    <span key={t} className="ws-type-chip">{TYPE_ICONS[t] || '📋'} {TYPE_LABELS[t] || t} {list.length}</span>
                ))}
                {entities.length === 0 && <span className="ws-type-chip ws-type-chip-empty">暂无归属实体</span>}
            </div>

            {hasAttributes && (
                <div className="ws-world-attrs">
                    {powerLabels.length > 0 && (
                        <WorldAttributeRow label="武力体系">
                            <div className="ws-power-tags">
                                {powerLabels.map((label, i) => (
                                    <span key={i} className="ws-power-tag">{POWER_SYSTEMS[world.powerSystem[i]]?.icon} {label}</span>
                                ))}
                            </div>
                        </WorldAttributeRow>
                    )}
                    {world.techLevel && TECH_LEVELS[world.techLevel] && (
                        <WorldAttributeRow label="科技水平">{TECH_LEVELS[world.techLevel].icon} {TECH_LEVELS[world.techLevel].label}</WorldAttributeRow>
                    )}
                    {world.dangerLevel && DANGER_LEVELS[world.dangerLevel] && (
                        <WorldAttributeRow label="危险等级">{DANGER_LEVELS[world.dangerLevel].icon} {DANGER_LEVELS[world.dangerLevel].label}</WorldAttributeRow>
                    )}
                    {world.culture && <WorldAttributeRow label="文化">{world.culture}</WorldAttributeRow>}
                    {world.rules && <WorldAttributeRow label="世界规则">{world.rules}</WorldAttributeRow>}
                    {world.entryMethod && <WorldAttributeRow label="进入方式">{world.entryMethod}</WorldAttributeRow>}
                    {world.description && <WorldAttributeRow label="简介">{world.description}</WorldAttributeRow>}
                </div>
            )}

            {entities.length > 0 && (
                <div className="ws-entity-groups">
                    {typeEntries.map(([t, list]) => (
                        <div key={t} className="ws-entity-group">
                            <div className="ws-entity-group-head">
                                <span>{TYPE_ICONS[t] || '📋'} {TYPE_LABELS[t] || t}</span>
                                <span className="ws-entity-group-count">{list.length}</span>
                            </div>
                            <div className="ws-entity-list">
                                {(expanded ? list : list.slice(0, COLLAPSE_AT)).map((e, i) => (
                                    <div key={i} className="ws-entity-item">
                                        <span className="ws-entity-name">{e.name}</span>
                                        <span className={`ws-entity-badge ${isVisitor(e) ? 'ws-badge-visitor' : 'ws-badge-resident'}`}>
                                            {isVisitor(e) ? '穿越' : '归属'}
                                        </span>
                                    </div>
                                ))}
                                {!expanded && list.length > COLLAPSE_AT && (
                                    <div className="ws-entity-more">还有 {list.length - COLLAPSE_AT} 个…</div>
                                )}
                            </div>
                        </div>
                    ))}
                    {entities.length > COLLAPSE_AT && (
                        <button className="cyber-btn cyber-btn-sm cyber-btn-outline ws-expand-btn" onClick={() => setExpanded(!expanded)}>
                            {expanded ? '收起' : `展开全部 ${entities.length} 个`}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
