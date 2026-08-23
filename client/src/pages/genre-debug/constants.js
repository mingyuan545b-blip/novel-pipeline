export const DETAIL_LABELS = {
    full: '完整', summary: '摘要', minimal: '最小', index: '索引', none: '无',
};

export const TAB_LIST = [
    { key: 'agents', label: 'Agent配置', icon: '🤖' },
    { key: 'constraints', label: '约束词管理', icon: '🔒' },
    { key: 'modules', label: '约束模块', icon: '🧩' },
    { key: 'foundation', label: '基础规则', icon: '📐' },
    { key: 'style', label: '风格配置', icon: '🎨' },
];

export const SCOPE_COLORS = {
    'universal': { bg: 'rgba(0,240,255,0.1)', color: 'var(--neon-cyan)', label: '通用' },
    'writer-only': { bg: 'rgba(255,0,60,0.1)', color: 'var(--neon-red)', label: '执笔人专属' },
    'craft': { bg: 'rgba(0,255,100,0.1)', color: 'var(--neon-green)', label: '写作技法' },
    'output-novel': { bg: 'rgba(255,165,0,0.1)', color: 'var(--neon-orange)', label: '输出格式' },
};

export const AGENT_TYPE_LABELS = {
    writer: '✍ 执笔人', reviser: '🔧 返修员', polisher: '✦ 润色师',
    'first-review': '✓ 初审', 'second-review': '★ 复审', 'fast-review': '⚡ 快审',
    'final-editor': '♛ 定稿人', 'material-manager': '⬡ 素材管理',
    'intent-planner': '📋 意图规划', reader: '📖 阅读者', 'consistency-constraints': '🔒 一致性约束',
};

export const STYLE_FIELDS = [
    { key: 'povRule', label: '视角规则', icon: '👁', desc: '叙事视角约束（如：第三人称限知视角）' },
    { key: 'dialogueRule', label: '对话规则', icon: '💬', desc: '对话风格约束（如：匠人术语+生活化表达）' },
    { key: 'behaviorRule', label: '行为规则', icon: '🎭', desc: '角色行为描写约束（如：用动作暗示情感）' },
    { key: 'toneRule', label: '基调规则', icon: '🎵', desc: '文风基调约束（如：温暖治愈+细腻）' },
    { key: 'titleRule', label: '标题规则', icon: '📝', desc: '章节标题命名约束（如：画面感+吸引力）' },
];
