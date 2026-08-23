export const ROLE_COLORS = { protagonist: '#ffd700', supporting: '#00c8ff', npc: '#888' };
export const ROLE_LABELS = { protagonist: '主角', supporting: '配角', npc: 'NPC' };
export const ROLE_PRIORITY = { protagonist: 3, supporting: 2, npc: 1 };
export const RARITY_COLORS = { common: '#888', uncommon: '#4ecdc4', rare: '#00c8ff', epic: '#a29bfe', legendary: '#ffd700' };
export const RARITY_LABELS = { common: '普通', uncommon: '优秀', rare: '稀有', epic: '史诗', legendary: '传说' };
export const MASTERY_MAP = { '初学': 10, '小成': 30, '大成': 60, '圆满': 85, '化境': 100 };
export const GROWTH_COLORS = { '幼体': '#4ecdc4', '成长体': '#00c8ff', '成熟体': '#a29bfe', '完全体': '#ffd700', '超凡体': '#ff6b9d' };
export const SERVANT_LABELS = { retainer: '家臣', guard: '护卫', maid: '侍女', assassin: '刺客', steward: '管家', spy: '间谍' };
export const REL_TYPE_COLORS = { ally: '#4ecdc4', enemy: '#ff6b9d', mentor: '#a29bfe', lover: '#ff6b9d', rival: '#ff9f43', subordinate: '#00c8ff', master: '#ffd700', family: '#4ecdc4' };
export const REL_TYPE_LABELS = { ally: '盟友', enemy: '敌人', mentor: '导师', lover: '恋人', rival: '对手', subordinate: '下属', master: '师父', family: '家人' };
export const SCOPE_ICONS = { character: '👤', worldview: '🌍', chapter: '📖', other: '📋' };
export const SCOPE_LABELS = { character: '角色', worldview: '世界观', chapter: '章节', other: '其他' };
export const GENRE_LABELS = { 'high-martial': '修仙玄幻', 'urban-reality': '都市现实', 'sci-fi-apocalypse': '科幻末世' };
export const GENRE_COLORS = { 'high-martial': '#00c8ff', 'urban-reality': '#ff6b9d', 'sci-fi-apocalypse': '#a29bfe' };

export const TABS = [
    { key: 'characters', icon: '👤', label: '角色' },
    { key: 'chronicle', icon: '📜', label: '编年史' },
    { key: 'worldscope', icon: '🌐', label: '世界域' },
    { key: 'cross-world-trace', icon: '🔮', label: '跨世界溯源' },
    { key: 'knowledge', icon: '👁', label: '限知' },
    { key: 'equipment', icon: '⚔', label: '装备' },
    { key: 'techniques', icon: '📖', label: '功法' },
    { key: 'pets', icon: '🐾', label: '宠物' },
    { key: 'servants', icon: '🧑‍💼', label: '仆人' },
    { key: 'relations', icon: '🔗', label: '关系' },
    { key: 'state-tracking', icon: '⚡', label: '状态追踪' },
    { key: 'summary', icon: '📝', label: '摘要' },
    { key: 'system', icon: '⚙', label: '系统' },
];

/** 思维导图式分组导航 - 层级展示 */
export const TAB_GROUPS = [
    {
        id: 'character-world', icon: '👤', label: '角色世界', color: 'var(--neon-cyan)',
        children: [
            { key: 'characters', icon: '👤', label: '角色' },
            { key: 'chronicle', icon: '📜', label: '编年史' },
            { key: 'knowledge', icon: '👁', label: '限知' },
        ]
    },
    {
        id: 'items', icon: '⚔', label: '物品装备', color: 'var(--neon-orange)',
        children: [
            { key: 'equipment', icon: '⚔', label: '装备' },
            { key: 'techniques', icon: '📖', label: '功法' },
            { key: 'pets', icon: '🐾', label: '宠物' },
            { key: 'servants', icon: '🧑‍💼', label: '仆人' },
        ]
    },
    {
        id: 'world-relations', icon: '🌐', label: '世界关系', color: 'var(--neon-purple)',
        children: [
            { key: 'worldscope', icon: '🌐', label: '世界域' },
            { key: 'cross-world-trace', icon: '🔮', label: '跨世界溯源' },
            { key: 'relations', icon: '🔗', label: '关系' },
        ]
    },
    {
        id: 'tracking', icon: '⚡', label: '追踪系统', color: 'var(--neon-green)',
        children: [
            { key: 'state-tracking', icon: '⚡', label: '状态追踪' },
            { key: 'summary', icon: '📝', label: '摘要' },
            { key: 'system', icon: '⚙', label: '系统' },
        ]
    },
];

export const STATS_CONFIG = [
    { key: 'characters', label: '角色', color: 'var(--neon-cyan)', icon: '👤' },
    { key: 'equipment', label: '装备', color: 'var(--neon-orange)', icon: '⚔' },
    { key: 'techniques', label: '功法', color: 'var(--neon-purple)', icon: '📜' },
    { key: 'pets', label: '宠物', color: 'var(--neon-green)', icon: '🐾' },
    { key: 'servants', label: '仆人', color: 'var(--neon-pink)', icon: '🧑‍💼' },
];

export const SCOPE_BORDER_COLORS = {
    character: 'var(--neon-pink)',
    worldview: 'var(--neon-cyan)',
    chapter: 'var(--neon-purple)',
};

export const CONFIDENCE_LABELS = { certain: '确信', suspect: '怀疑', misinformed: '误信', unknown: '未知' };
export const CONFIDENCE_COLORS = { certain: '#4ecdc4', suspect: '#ffd700', misinformed: '#ff6b9d', unknown: '#888' };
export const SOURCE_HOW_LABELS = { witnessed: '亲眼', told: '听说', inferred: '推理', discovered: '发现' };
