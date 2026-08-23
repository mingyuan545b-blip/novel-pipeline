/**
 * worldviewClassification.js — 世界观3维分类系统
 * 将素材按类型分类为宏观/中观/微观，并计算加载深度
 */
const {
    WORLDVIEW_DEPTH_RULES,
    TYPE_TO_WORLDVIEW_DEPTH,
    CHARACTER_MATERIAL_TYPES,
    resolveDepth,
} = require('./contextDepthConstants');

/** 分类单个素材的世界观维度 */
function classifyMaterial(material) {
    const type = material.type || material.category || '';

    if (CHARACTER_MATERIAL_TYPES.has(type)) {
        return { worldviewDepth: null, category: 'character', rule: null };
    }

    const depth = TYPE_TO_WORLDVIEW_DEPTH[type];
    if (depth) {
        return { worldviewDepth: depth, category: 'worldview', rule: WORLDVIEW_DEPTH_RULES[depth] };
    }

    if (type === 'foreshadowing') return { worldviewDepth: null, category: 'foreshadowing', rule: null };
    if (type === 'equipment' || type === 'technique') return { worldviewDepth: null, category: 'bindable', rule: null };
    if (type === 'sub-plane') return { worldviewDepth: 'meso', category: 'worldview', rule: WORLDVIEW_DEPTH_RULES.meso };

    return { worldviewDepth: null, category: 'other', rule: null };
}

/** 批量分类素材 */
function classifyMaterials(materials) {
    const result = { macro: [], meso: [], micro: [], character: [], foreshadowing: [], bindable: [], other: [] };
    for (const m of materials) {
        const cls = classifyMaterial(m);
        m._worldviewClassification = cls;
        if (cls.worldviewDepth && result[cls.worldviewDepth]) {
            result[cls.worldviewDepth].push(m);
        } else if (result[cls.category]) {
            result[cls.category].push(m);
        } else {
            result.other.push(m);
        }
    }
    return result;
}

/** 根据大纲文本决定世界观素材的加载深度 */
function resolveWorldviewLoadDepth(material, outlineText) {
    const cls = classifyMaterial(material);
    if (!cls.rule) return null;

    const nameLower = (material.name || '').toLowerCase();
    const isMentioned = outlineText && (
        outlineText.includes(nameLower) ||
        nameLower.split(/[-\s]/).some(n => n.length >= 2 && outlineText.includes(n))
    );

    if (isMentioned) return resolveDepth(cls.rule.outlineMentionLoad);
    if (cls.rule.defaultLoad === null) return null;
    return resolveDepth(cls.rule.defaultLoad);
}

/** 获取项目世界观分类概览 */
function getClassificationOverview(materials) {
    const classified = classifyMaterials(materials);
    const overview = {};
    for (const [depth, rule] of Object.entries(WORLDVIEW_DEPTH_RULES)) {
        const items = classified[depth] || [];
        overview[depth] = {
            label: rule.label,
            description: rule.description,
            count: items.length,
            defaultLoad: rule.defaultLoad,
            outlineMentionLoad: rule.outlineMentionLoad,
            items: items.map(m => ({ id: m.id, name: m.name, type: m.type })),
        };
    }
    overview.character = { count: classified.character.length, items: classified.character.map(m => ({ id: m.id, name: m.name })) };
    overview.other = { count: (classified.foreshadowing.length + classified.bindable.length + classified.other.length) };
    return overview;
}

module.exports = {
    classifyMaterial,
    classifyMaterials,
    resolveWorldviewLoadDepth,
    getClassificationOverview,
};
