const PROBLEM_PATTERNS = [
    { id: 'tech-jargon-not-dedim', keywords: ['术语未降维', '科技降维', '术语直接暴露', '专业术语', '科技术语', '技术名词未经角色感官过滤', '术语降维不彻底', '术语降维'], category: '术语降维', rootCause: 'behaviorRule中术语降维指导不够具体', targetField: 'behaviorRule', targetCollection: 'style-profiles' },
    { id: 'adult-perspective-leak', keywords: ['视角偏移', '视角越界', '全知旁白', '成人心理动词', '成人内心', '视角一致性', '成人技术报告口吻', '视角混入', '叙述视角微偏移', '成人视角'], category: '视角违规', rootCause: 'povRule中视角禁用词列表不够精确或成人/幼崽语境区分不够', targetField: 'povRule', targetCollection: 'style-profiles' },
    { id: 'word-count-insufficient', keywords: ['字数不足', '字数严重不足', '字数未达标', '纯正文字数'], category: '字数不足', rootCause: '字数约束在user prompt中被截断或不够强调', targetField: 'foundation', targetCollection: 'foundation-prompts' },
    { id: 'content-repetition', keywords: ['重复粘贴', '防重复', '段落重复', '动作描写轻微原地循环', '动作循环', '重复'], category: '内容重复', rootCause: '防重复规则不够具体或与字数扩展规则冲突', targetField: 'foundation', targetCollection: 'foundation-prompts' },
    { id: 'hook-weak-ending', keywords: ['章末钩子', '收束张力', '悬念钩子', '结尾', '章末悬念', '收束偏静态', '末段张力'], category: '章末钩子', rootCause: 'toneRule中钩子要求不够具体', targetField: 'toneRule', targetCollection: 'style-profiles' },
    { id: 'horror-description', keywords: ['恐怖', '阴森', '诡异', '克苏鲁'], category: '恐怖描写', rootCause: 'toneRule中恐怖禁用词不够全面', targetField: 'toneRule', targetCollection: 'style-profiles' },
    { id: 'info-dump', keywords: ['信息注入节奏', '信息倾倒', '说明书式', '理论说明占比', '平铺直叙'], category: '信息注入节奏', rootCause: 'foundation中展示代替告知规则不够具体', targetField: 'foundation', targetCollection: 'foundation-prompts' },
    { id: 'baby-cute-missing', keywords: ['萌感', '萌宝交互', '幼崽萌感', '幼崽行为'], category: '萌感缺失', rootCause: 'behaviorRule中萌感行为要求不够具体', targetField: 'behaviorRule', targetCollection: 'style-profiles' },
    { id: 'dialogue-style', keywords: ['对话', '台词书面化', '成人对话', '儿童化表达', '对话降维', '沟通未匹配幼崽认知'], category: '对话风格', rootCause: 'dialogueRule中对话规范不够具体', targetField: 'dialogueRule', targetCollection: 'style-profiles' },
    { id: 'character-consistency', keywords: ['角色命名', '角色称呼', '代词', '物品设定前后矛盾', '设定矛盾'], category: '角色一致性', rootCause: 'characterRefRules中称呼规范不够具体', targetField: 'characterRefRules', targetCollection: 'style-profiles' }
];

const OPTIMIZER_LIMITS = {
    MIN_CHAPTERS_PATTERN: 3,
    MAX_MODIFICATION_CHARS: 200,
    MAX_DAILY_OPTIMIZATIONS: 1,
    COOLDOWN_CHAPTERS: 3,
    MAX_CUMULATIVE_MODIFICATIONS: 10,
    MIN_HEALTH_SCORE_AFTER: 70,
    TOKEN_DELTA_MAX: 50
};

module.exports = { PROBLEM_PATTERNS, OPTIMIZER_LIMITS };
