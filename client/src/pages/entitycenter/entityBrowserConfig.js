/**
 * entityBrowserConfig.js — 各 tab 的"分类浏览器"配置（分面 / 分组 / 排序 / 检索文本）
 * 纯配置与纯函数，供 装备/功法/宠物/仆人 的 Tab 组件注入 CategoryBrowser。
 */
import { GROWTH_COLORS, SERVANT_LABELS } from './constants';
import { ownerPrefix, norm } from './categoryUtils';

// ————— 装备 / 功法（item-definitions）—————
/** 分面 = 名称里的"归属/势力"前缀（如《苍生簿》/白事堂/苍生局） */
export function defOwnerFacets(defs) {
    return [...new Set(defs.map(d => ownerPrefix(d.name)))]
        .map(k => ({ key: k, label: k, color: 'var(--neon-orange)' }));
}
export const defFacetOf = d => ownerPrefix(d.name);
export const defSearchOf = d =>
    [d.name, d.briefDesc, d.summaryDesc, d.detailDesc, (d.tags || []).join(' ')].join(' ');

/** 分组 = 绑定状态（未绑定的多为线索/一次性道具，可能是伏笔） */
export const DEF_GROUPS = [
    { key: 'bound', label: '角色持有', color: '#00c8ff', hint: '已绑定角色 · 常驻道具' },
    { key: 'loose', label: '未绑定', color: '#ff9f43', hint: '疑似线索 / 一次性道具 · 可能是伏笔' },
];

export function defSortOptions(boundIds) {
    const has = d => (boundIds.has(d.id) ? 1 : 0);
    return [
        { key: 'name', label: '名称 A→Z', cmp: (a, b) => norm(a.name).localeCompare(norm(b.name)) },
        { key: 'chapter', label: '来源章节（早→晚）', cmp: (a, b) => (a.sourceChapter || 999) - (b.sourceChapter || 999) },
        { key: 'bound', label: '已绑定优先', cmp: (a, b) => has(b) - has(a) || norm(a.name).localeCompare(norm(b.name)) },
    ];
}

// ————— 宠物 —————
const PET_GROWTH = ['幼体', '成长体', '成熟体', '完全体', '超凡体'];
export const petFacetOf = p => p.growthStage || '未标注';
export const petGroupOf = petFacetOf;
export const petFacets = pets =>
    PET_GROWTH.filter(k => pets.some(p => p.growthStage === k)).map(k => ({ key: k, label: k, color: GROWTH_COLORS[k] }));
export const petGroups = pets =>
    [...petFacets(pets), { key: '未标注', label: '未标注', color: '#64748b' }];
export const petSearchOf = p =>
    [p._adapted?.name, p.species, p._adapted?.petClass, p._adapted?.briefDesc, (p._adapted?.abilities || []).join(' ')].join(' ');
const petName = p => p._adapted?.name || p.id;
export const PET_SORTS = [
    { key: 'name', label: '名称 A→Z', cmp: (a, b) => norm(petName(a)).localeCompare(norm(petName(b))) },
    { key: 'loyalty', label: '忠诚度（高→低）', cmp: (a, b) => (b.loyalty || 0) - (a.loyalty || 0) },
];

// ————— 仆人 —————
export const servantFacetOf = s => s._adapted?.servantType || '未标注';
export const servantGroupOf = servantFacetOf;
export const servantFacets = servants =>
    Object.entries(SERVANT_LABELS)
        .filter(([k]) => servants.some(s => s._adapted?.servantType === k))
        .map(([k, label]) => ({ key: k, label }));
export const servantGroups = servants =>
    [...servantFacets(servants), { key: '未标注', label: '未标注', color: '#64748b' }];
export const servantSearchOf = s =>
    [s._adapted?.name, s._adapted?.briefDesc, Array.isArray(s.specialty) ? s.specialty.join(' ') : s.specialty].join(' ');
const svName = s => s._adapted?.name || s.id;
export const SERVANT_SORTS = [
    { key: 'name', label: '名称 A→Z', cmp: (a, b) => norm(svName(a)).localeCompare(norm(svName(b))) },
    { key: 'loyalty', label: '忠诚度（高→低）', cmp: (a, b) => (b.loyalty || 0) - (a.loyalty || 0) },
];
