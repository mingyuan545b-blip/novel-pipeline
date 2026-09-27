import { useMemo as _useMemo } from 'react';

/**
 * ownershipUtils.js — 归属判定（纯函数）
 *
 * 用户诉求："装备归属是人、组织还是什么，要具体标记"（不止装备，道具/功法/宠物/仆人也要）。
 * 判定依据（按优先级）：
 *   1. 有绑定角色（character-binds / ownerId / masterId）→ 归属「角色」；
 *   2. 名称前缀像势力/机构（白事堂/苍生局/漕帮…，按后缀判定）→ 归属「组织/势力」；
 *   3. 否则 → 「未归属」（多为线索/一次性道具，可能是伏笔）。
 */
import { ownerPrefix } from './categoryUtils';

const ORG_SUFFIX = /(堂|帮|局|司|阁|会|教|宗|门|军|府|宫|殿|盟|庄|楼|馆|院|派|部|处|衙|团|社|号|行|栈|铺|坊|寺|观|岛|城|谷|山)$/;

export const OWNER_KINDS = [
    { key: 'character', label: '角色持有', color: '#00c8ff', hint: '已绑定角色 · 有人持有' },
    { key: 'org', label: '组织/势力', color: '#ff9f43', hint: '据名称判定归属某势力/机构' },
    { key: 'none', label: '未归属', color: '#64748b', hint: '未标记归属 · 可能是线索/一次性道具' },
];
const KIND_META = Object.fromEntries(OWNER_KINDS.map(k => [k.key, k]));

/** 装备/功法/道具：bindNames 为该条目绑定的角色名数组 */
export function classifyDef(def, bindNames) {
    if (bindNames && bindNames.length) return { kind: 'character', owners: bindNames };
    const p = ownerPrefix(def?.name);
    if (p !== '未归类' && ORG_SUFFIX.test(p)) return { kind: 'org', owners: [p] };
    return { kind: 'none', owners: [] };
}

/** 宠物/仆人：有 ownerId/masterId 即角色持有 */
export function classifyOwned(ownerId) {
    return ownerId ? { kind: 'character', owners: [] } : { kind: 'none', owners: [] };
}

export function ownerText(cls) {
    if (cls.kind === 'character') return cls.owners.length ? `归属：${cls.owners.join('、')}（角色）` : '归属：角色持有';
    if (cls.kind === 'org') return `归属：${cls.owners[0]}（组织/势力）`;
    return '未归属';
}

export function ownerFacetsOf(items, kindOf) {
    const counts = {};
    for (const it of items) { const k = kindOf(it); counts[k] = (counts[k] || 0) + 1; }
    return OWNER_KINDS.filter(k => counts[k.key]).map(k => ({ key: k.key, label: k.label, color: k.color, count: counts[k.key] }));
}

export function ownerGroupsOf(items, kindOf) {
    return OWNER_KINDS.filter(k => items.some(it => kindOf(it) === k.key)).map(k => ({ ...k, hint: KIND_META[k.key].hint }));
}

// React hook：把"绑定→归属"的派生逻辑集中一处（供 装备/功法 复用）

export function useOwnership(items, allBinds, getCharName) {
    return _useMemo(() => {
        const bindsByDef = new Map();
        for (const b of allBinds || []) {
            const list = bindsByDef.get(b.defId) || [];
            list.push(getCharName(b.characterId));
            bindsByDef.set(b.defId, list);
        }
        return {
            kindOf: (d) => classifyDef(d, bindsByDef.get(d.id)).kind,
            ownerOf: (d) => ownerText(classifyDef(d, bindsByDef.get(d.id))),
            boundIds: new Set(bindsByDef.keys()),
        };
    }, [items, allBinds, getCharName]);
}
