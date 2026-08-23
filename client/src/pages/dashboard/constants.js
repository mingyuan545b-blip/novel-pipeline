export const LAYOUT_KEY = 'dashboard-layout';

export const DEFAULT_LAYOUT = {
    left: ['flavor', 'style', 'constraints', 'remediation', 'styleGuide'],
    right: ['worldview', 'worldviewProfile', 'quickActions']
};

export const MODE_LABELS = {
    novel: { icon: '📖', label: '长篇', color: 'var(--neon-blue)' }
};

export const SUBGENRE_LABELS = {
    'tomato-revenge': '🔥复仇',
    'tomato-sweet': '💕甜宠',
    'tomato-mystery': '🔍悬疑',
    'tomato-system': '⚙系统',
    'tomato-talisman': '🐉符咒'
};

export const FILE_TYPE_LABELS = {
    character: '👤 人物设定',
    relationship: '🔗 人物关系',
    worldview: '🌍 世界观/背景',
    location: '🏰 地点/势力',
    equipment: '⚔ 装备/道具',
    'power-system': '⚡ 战力体系',
    plot: '📜 剧情/事件',
    other: '📦 其他元素'
};

export const CLEANUP_ITEMS = [
    { key: 'chapters', label: '📖 主线章节', danger: true },
    { key: 'timelines', label: '⏱ 时间轴' },
    { key: 'materials', label: '📦 素材库' },
    { key: 'knowledge', label: '🧠 知识库' },
    { key: 'outlines', label: '📋 大纲' },
    { key: 'logs', label: '📄 输出日志' },
    { key: 'remediation', label: '🔧 整改规则' }
];

export const STYLE_RULE_LABELS = {
    narrativePacing: '节奏',
    descriptionStyle: '描写',
    dialogueStyle: '对话',
    emotionalTone: '情感',
    humorLevel: '幽默'
};

export function loadLayout() {
    try {
        const saved = localStorage.getItem(LAYOUT_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            const allCards = [...DEFAULT_LAYOUT.left, ...DEFAULT_LAYOUT.right];
            const savedAll = [...(parsed.left || []), ...(parsed.right || [])];
            const missing = allCards.filter(c => !savedAll.includes(c));
            const extra = savedAll.filter(c => !allCards.includes(c));
            if (missing.length === 0 && extra.length === 0) return parsed;
        }
    } catch { /* parse error */ }
    return DEFAULT_LAYOUT;
}

export function saveLayout(layout) {
    try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout)); } catch { /* storage error */ }
}
