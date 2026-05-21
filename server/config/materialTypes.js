const VALID_MATERIAL_TYPES = [
    'worldview', 'character', 'equipment', 'relationship',
    'power-system', 'sub-plane', 'faction', 'institution',
    'catchphrase', 'famous-scene', 'growth-history',
    'foreshadowing', 'location', 'narrative-bridge',
    'writing-technique', 'mechanism', 'other',
    'scene', 'phenomenon', 'organization', 'geography', 'technology',
    'character-psychology', 'character-combat', 'character-personality',
    'character-relationship', 'character-dialogue', 'character-behavior',
    'material', 'index', 'craft'
];

const MATERIAL_TYPE_LABELS = {
    worldview: '世界观', character: '人物卡', equipment: '装备', relationship: '人物关系',
    'power-system': '战力体系', 'sub-plane': '次位面', faction: '势力', institution: '机构',
    catchphrase: '金句/热梗', 'famous-scene': '名场面', 'growth-history': '成长史',
    foreshadowing: '伏笔', location: '地点', 'narrative-bridge': '叙事衔接',
    'writing-technique': '写作手法', mechanism: '机制', other: '其他',
    scene: '场景', phenomenon: '现象', organization: '组织', geography: '地理', technology: '科技',
    'character-psychology': '人物心理', 'character-combat': '人物战斗', 'character-personality': '人物性格',
    'character-relationship': '人物关系详情', 'character-dialogue': '人物对话', 'character-behavior': '人物行为',
    material: '材料', index: '索引', craft: '创作规范'
};

const MATERIAL_TYPE_ICONS = {
    worldview: '🌍', character: '👤', equipment: '⚔', relationship: '🔗',
    'power-system': '⚡', 'sub-plane': '🌀', faction: '🏛', institution: '🏯',
    catchphrase: '💬', 'famous-scene': '🎬', 'growth-history': '📈',
    foreshadowing: '🔮', location: '📍', 'narrative-bridge': '🌉',
    'writing-technique': '✍️', mechanism: '⚙️', other: '📋',
    scene: '🏞️', phenomenon: '✨', organization: '🏢', geography: '🗺️', technology: '🔬',
    'character-psychology': '🧠', 'character-combat': '💥', 'character-personality': '🎭',
    'character-relationship': '🤝', 'character-dialogue': '🗣️', 'character-behavior': '🏃',
    material: '🧪', index: '📑', craft: '📝'
};

const MATERIAL_TYPE_COLORS = {
    worldview: 'blue', character: 'pink', equipment: 'orange', relationship: 'red',
    'power-system': 'purple', 'sub-plane': 'cyan', faction: 'gold', institution: 'brown',
    catchphrase: 'green', 'famous-scene': 'orange', 'growth-history': 'blue',
    foreshadowing: 'purple', location: 'teal', 'narrative-bridge': 'gray',
    'writing-technique': 'indigo', mechanism: 'steel', other: 'blue',
    scene: 'emerald', phenomenon: 'violet', organization: 'slate', geography: 'jade', technology: 'amber',
    'character-psychology': 'rose', 'character-combat': 'crimson', 'character-personality': 'fuchsia',
    'character-relationship': 'coral', 'character-dialogue': 'sky', 'character-behavior': 'lime',
    material: 'sand', index: 'slate', craft: 'indigo'
};

const DOMAIN_CATEGORIES = {
    world: ['worldview', 'power-system', 'faction', 'character', 'institution', 'location', 'equipment'],
    subplane: ['sub-plane'],
    craft: ['craft', 'writing-technique', 'narrative-bridge', 'catchphrase', 'famous-scene', 'foreshadowing', 'growth-history', 'relationship', 'mechanism', 'index', 'other']
};

const WORLDVIEW_TYPES = new Set([
    'worldview', 'power-system', 'scene', 'phenomenon', 'institution',
    'organization', 'faction', 'geography', 'technology'
]);

const CHARACTER_TYPES = new Set([
    'character', 'character-psychology', 'character-combat', 'character-personality',
    'character-relationship', 'character-dialogue', 'character-behavior', 'foreshadowing'
]);

const CRAFT_TYPES = new Set(['mechanism', 'writing-technique', 'index', 'craft']);

const HIERARCHY_RULES = {
    'sub-plane': { parentRequired: false, parentFields: [] },
    'faction': { parentRequired: true, parentFields: ['parentPlane'], description: '势力必须归属一个位面（次位面或主世界），parentPlane字段必填' },
    'character': { parentRequired: true, parentFields: ['parentFaction'], description: '人物必须归属一个势力，parentFaction字段必填；若属于次位面势力，还需parentPlane' },
    'equipment': { parentRequired: false, parentFields: ['parentPlane'], description: '道具可归属次位面，parentPlane可选' },
    'institution': { parentRequired: true, parentFields: ['parentPlane'], description: '机构必须归属一个位面，parentPlane字段必填' },
    'worldview': { parentRequired: false, parentFields: [] },
    'power-system': { parentRequired: false, parentFields: [] },
    'foreshadowing': { parentRequired: false, parentFields: [] },
    'relationship': { parentRequired: false, parentFields: [] },
    'catchphrase': { parentRequired: false, parentFields: [] },
    'famous-scene': { parentRequired: false, parentFields: [] },
    'growth-history': { parentRequired: false, parentFields: [] },
    'location': { parentRequired: false, parentFields: ['parentPlane'] },
    'narrative-bridge': { parentRequired: false, parentFields: [] },
    'writing-technique': { parentRequired: false, parentFields: [] },
    'mechanism': { parentRequired: false, parentFields: [] },
    'craft': { parentRequired: false, parentFields: [] },
    'other': { parentRequired: false, parentFields: [] }
};

const MATERIAL_STANDARDS = {
    character: {
        requiredFields: ['核心欲望', '内在矛盾', '行为模式'],
        validationMessage: '人物素材缺少必要字段：核心欲望、内在矛盾、行为模式',
        check(content) {
            const missing = [];
            if (!/核心欲望|内心渴望|最想|终极目标|最大愿望/.test(content)) missing.push('核心欲望');
            if (!/内在矛盾|内心冲突|两难|矛盾|挣扎|纠结/.test(content)) missing.push('内在矛盾');
            if (!/行为模式|行事风格|习惯|性格特点|行为特征|处事方式/.test(content)) missing.push('行为模式');
            return { valid: missing.length === 0, missing, message: missing.length > 0 ? `人物素材缺少: ${missing.join('、')}` : '' };
        }
    },
    worldview: {
        requiredFields: ['边界条件', '违反后果'],
        validationMessage: '世界观素材缺少必要字段：边界条件、违反后果',
        check(content) {
            const missing = [];
            if (!/边界|限制|禁忌|不可|禁止|上限|极限|规则/.test(content)) missing.push('边界条件');
            if (!/后果|代价|惩罚|反噬|反作用|遭到|受到/.test(content)) missing.push('违反后果');
            return { valid: missing.length === 0, missing, message: missing.length > 0 ? `世界观素材缺少: ${missing.join('、')}` : '' };
        }
    },
    'power-system': {
        requiredFields: ['升级条件', '代价/限制'],
        validationMessage: '战力体系素材缺少必要字段：升级条件、代价/限制',
        check(content) {
            const missing = [];
            if (!/升级|突破|进阶|晋升|提升条件|修炼/.test(content)) missing.push('升级条件');
            if (!/代价|限制|反噬|副作用|消耗|代价|瓶颈/.test(content)) missing.push('代价/限制');
            return { valid: missing.length === 0, missing, message: missing.length > 0 ? `战力体系素材缺少: ${missing.join('、')}` : '' };
        }
    },
    foreshadowing: {
        requiredFields: ['预期回收窗口', '关联角色'],
        validationMessage: '伏笔素材缺少必要字段：预期回收窗口、关联角色',
        check(content) {
            const missing = [];
            if (!/回收|揭晓|揭示|揭穿|揭底|预期.*章|窗口/.test(content)) missing.push('预期回收窗口');
            if (!/关联|涉及|相关|角色|人物/.test(content)) missing.push('关联角色');
            return { valid: missing.length === 0, missing, message: missing.length > 0 ? `伏笔素材缺少: ${missing.join('、')}` : '' };
        }
    }
};

const TYPE_INFERENCE_RULES = [
    { keywords: ['结构', '功能', '触发', '装置', '机制', '导流', '净化', '过滤', '保温', '传导'], suggestedType: 'mechanism' },
    { keywords: ['身份', '性格', '动机', '角色', '人物', '行为模式', '内在矛盾'], suggestedType: 'character' },
    { keywords: ['边界', '法则', '世界观', '设定', '规则', '违反后果'], suggestedType: 'worldview' },
    { keywords: ['升级', '突破', '战力', '代价', '限制', '反噬'], suggestedType: 'power-system' },
    { keywords: ['预期回收', '伏笔', '悬念', '钩子', '待回收', '揭示'], suggestedType: 'foreshadowing' },
    { keywords: ['关系', '羁绊', '互动', '信任', '对立'], suggestedType: 'relationship' }
];

function classifyMaterialType(type) {
    if (WORLDVIEW_TYPES.has(type)) return 'worldview';
    if (CHARACTER_TYPES.has(type)) return 'character';
    if (CRAFT_TYPES.has(type)) return 'craft';
    return 'other';
}

function isValidType(type) {
    return VALID_MATERIAL_TYPES.includes(type);
}

function inferTypeFromContent(name, content) {
    const text = (name + ' ' + content).toLowerCase();
    for (const rule of TYPE_INFERENCE_RULES) {
        const matchCount = rule.keywords.filter(k => text.includes(k)).length;
        if (matchCount >= 2) return rule.suggestedType;
    }
    return null;
}

module.exports = {
    VALID_MATERIAL_TYPES,
    MATERIAL_TYPE_LABELS,
    MATERIAL_TYPE_ICONS,
    MATERIAL_TYPE_COLORS,
    DOMAIN_CATEGORIES,
    WORLDVIEW_TYPES,
    CHARACTER_TYPES,
    CRAFT_TYPES,
    HIERARCHY_RULES,
    MATERIAL_STANDARDS,
    TYPE_INFERENCE_RULES,
    classifyMaterialType,
    isValidType,
    inferTypeFromContent
};
