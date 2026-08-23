/**
 * contextDepthConstants.js — 上下文深度常量（上下文电路图专用）
 * 从depthVersionConstants提取，仅保留上下文决策/电路图/预算管理所需的常量
 * 深度版本生成/存储系统已删除（与上下文电路图重叠）
 */

/** 5层深度定义 */
const DEPTH_LEVELS = {
    L0: { key: 'L0', label: '索引', maxChars: 60,  tokenBudget: 40,  color: '#444444' },
    L1: { key: 'L1', label: '简要', maxChars: 200, tokenBudget: 130, color: '#888888' },
    L2: { key: 'L2', label: '摘要', maxChars: 500, tokenBudget: 330, color: '#ffaa00' },
    L3: { key: 'L3', label: '完整', maxChars: 1500, tokenBudget: 1000, color: '#00ff88' },
    L4: { key: 'L4', label: '原始', maxChars: null, tokenBudget: null, color: '#00aaff' },
};

/** 旧名→新层级映射（向后兼容） */
const LEGACY_DEPTH_MAP = {
    index: 'L0', brief: 'L1', summary: 'L2', full: 'L3', raw: 'L4',
};

/** 将任意深度标识解析为标准L0-L4 */
function resolveDepth(depth) {
    if (!depth) return 'L2';
    if (DEPTH_LEVELS[depth]) return depth;
    if (LEGACY_DEPTH_MAP[depth]) return LEGACY_DEPTH_MAP[depth];
    return 'L2';
}

/** 世界观3维分类规则 */
const WORLDVIEW_DEPTH_RULES = {
    macro: {
        label: '宏观', description: '全局通识，几乎每章都需要',
        types: ['power-system', 'worldview'],
        defaultLoad: 'L1', outlineMentionLoad: 'L2', budgetRatio: 0.15,
    },
    meso: {
        label: '中观', description: '按场景/剧情需要加载',
        types: ['faction', 'organization', 'geography', 'institution', 'religion'],
        defaultLoad: 'L0', outlineMentionLoad: 'L2', relatedEntityLoad: 'L1', budgetRatio: 0.25,
    },
    micro: {
        label: '微观', description: '极少需要，深度涉及时才加载',
        types: ['scene', 'phenomenon', 'technology', 'custom'],
        defaultLoad: null, outlineMentionLoad: 'L1', budgetRatio: 0.10,
    },
};

/** 素材类型→世界观维度映射 */
const TYPE_TO_WORLDVIEW_DEPTH = {};
for (const [depth, rule] of Object.entries(WORLDVIEW_DEPTH_RULES)) {
    for (const type of rule.types) {
        TYPE_TO_WORLDVIEW_DEPTH[type] = depth;
    }
}

/** 角色类型集合 */
const CHARACTER_MATERIAL_TYPES = new Set([
    'character', 'character-psychology', 'character-combat', 'character-personality',
    'character-relationship', 'character-dialogue', 'character-behavior',
]);

/** 仆从绑定类型 */
const SERVANT_BIND_TYPES = new Set(['pet', 'servant']);

/** 仆从默认加载深度规则 */
const SERVANT_LOAD_RULES = {
    ownerPresent: 'L2', ownerAbsent: 'L0', combatScene: 'L3',
    stateChange: 'L2', ownerIsProtagonist: 'L2',
};

module.exports = {
    DEPTH_LEVELS, LEGACY_DEPTH_MAP, resolveDepth,
    WORLDVIEW_DEPTH_RULES, TYPE_TO_WORLDVIEW_DEPTH,
    CHARACTER_MATERIAL_TYPES, SERVANT_BIND_TYPES, SERVANT_LOAD_RULES,
};
