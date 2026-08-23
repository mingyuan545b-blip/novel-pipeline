const RULE_LAYERS = {
    L1: { name: 'hard_facts', precedence: 100, scope: 'global', description: '硬事实层 - 世界观铁律、核心设定、战力体系规则' },
    L2: { name: 'author_intent', precedence: 80, scope: 'book', description: '作者意图层 - 创作方向、主题基调、角色核心定位' },
    L3: { name: 'planning', precedence: 60, scope: 'arc', description: '规划层 - 卷级大纲、章节大纲、情节走向' },
    L4: { name: 'current_task', precedence: 70, scope: 'local', description: '当前任务层 - 本章写作指令、即时调整、审核反馈' }
};

const OVERRIDE_EDGES = [
    { from: 'L4', to: 'L3', allowed: true, scope: 'current_chapter', description: '当前任务可覆盖规划（如审核反馈要求修改大纲走向）' },
    { from: 'L4', to: 'L2', allowed: false, scope: 'current_chapter', description: '当前任务不可覆盖作者意图（不能违背创作方向和主题）' },
    { from: 'L4', to: 'L1', allowed: false, scope: 'current_chapter', description: '当前任务不可覆盖硬事实（不能违反世界观铁律）' },
    { from: 'L3', to: 'L2', allowed: false, scope: 'current_arc', description: '规划不可覆盖作者意图' },
    { from: 'L3', to: 'L1', allowed: false, scope: 'current_arc', description: '规划不可覆盖硬事实' },
    { from: 'L2', to: 'L1', allowed: false, scope: 'book', description: '作者意图不可覆盖硬事实' }
];

const RULE_SECTIONS = {
    hard: ['worldview', 'power-system', 'character-core', 'worldview-rules'],
    soft: ['author-intent', 'current-focus', 'volume-outline', 'chapter-outline'],
    diagnostic: ['anti-ai-checks', 'continuity-audit', 'style-regression', 'hook-budget']
};

module.exports = { RULE_LAYERS, OVERRIDE_EDGES, RULE_SECTIONS };
