const BASE_CONCEPT_REGISTRY = [
    { id: 'pov-lock', label: '视角锁定', keywords: ['第三人称有限视角', '限知视角'], threshold: 4, severity: 'high', fix: '保留模板中的精简版，移除风格配置中的重复版' },
    { id: 'word-count', label: '字数要求', keywords: ['字数要求', '字数硬性', '目标字数', '宁可多写', '最低字数', '字数纪律'], threshold: 4, severity: 'high', fix: '合并所有字数要求为一处，保留基座中的[WORD_LIMITS]和模板中的精简版' },
    { id: 'hook-chapter', label: '章末钩子', keywords: ['章末钩子', '章末悬念', '悬念钩子', '每章结尾必须设置悬念'], threshold: 3, severity: 'medium', fix: '保留约束注入或模板中的一处即可' },
    { id: 'show-not-tell', label: '展示代替告知', keywords: ['展示代替告知', '感官细节', '感官锚定', '非视觉感官'], threshold: 3, severity: 'medium', fix: '保留约束注入或风格配置中的一处即可' },
    { id: 'dialogue-ratio', label: '对话比例', keywords: ['对话比例', '对话占比', '对话密度'], threshold: 3, severity: 'medium', fix: '保留模板或风格配置中的一处即可' },
    { id: 'terminology-dimming', label: '术语降频', keywords: ['术语降频', '术语消光', '专业术语', '术语密度'], threshold: 3, severity: 'medium', fix: '保留风格配置中的术语降频规则即可' },
    { id: 'character-consistency', label: '角色一致性', keywords: ['角色一致性', '角色行为一致', '人物性格', '角色口吻', '说话语气'], threshold: 4, severity: 'high', fix: '合并角色一致性要求为一处，保留素材卡+风格配置中的精简版' },
    { id: 'no-ai-patterns', label: '反AI痕迹', keywords: ['反AI痕迹', 'AI痕迹', '机器味', '模板化', '套路化', '去AI'], threshold: 3, severity: 'medium', fix: '保留审核规则中的反AI检查即可' },
    { id: 'cliffhanger', label: '断章', keywords: ['断章', '章末钩子', '悬念结尾', '结尾悬念'], threshold: 3, severity: 'medium', fix: '保留约束注入中的一处即可' },
    { id: 'forbidden-topics', label: '禁忌话题', keywords: ['禁忌话题', '禁止描写', '红线', '不得出现'], threshold: 3, severity: 'low', fix: '保留约束注入中的一处即可' }
];

const GENRE_CONCEPT_REGISTRIES = {
    'baby': [
        { id: 'baby-perspective', label: '萌宝视角', keywords: ['萌宝视角', '婴儿视角', '宝宝视角', '幼崽视角'], threshold: 3, severity: 'high', fix: '保留题材插件中的视角规则即可' },
        { id: 'baby-forbidden', label: '萌宝禁忌', keywords: ['恐怖描写', '血腥描写', '暴力描写', '阴暗环境'], threshold: 3, severity: 'high', fix: '保留题材插件中的禁忌规则即可' }
    ],
};

const INFLATION_RULES = [
    { pattern: /【[^】]*】[^【]*【[^】]*】/g, desc: '嵌套标记块', severity: 'low' },
    { pattern: /最高优先级[^。！？\n]{0,5}[。！？\n]/g, desc: '"最高优先级"滥用', severity: 'medium', maxCount: 3 },
    { pattern: /极其重要[^。！？\n]{0,5}[。！？\n]/g, desc: '"极其重要"滥用', severity: 'medium', maxCount: 3 },
    { pattern: /必须遵守[^。！？\n]{0,5}[。！？\n]/g, desc: '"必须遵守"滥用', severity: 'low', maxCount: 5 },
    { pattern: /严禁[^。！？\n]{0,3}[。！？\n]/g, desc: '"严禁"滥用', severity: 'low', maxCount: 5 },
];

function getConceptRegistry(genreId) {
    const base = [...BASE_CONCEPT_REGISTRY];
    if (genreId && GENRE_CONCEPT_REGISTRIES[genreId]) {
        base.push(...GENRE_CONCEPT_REGISTRIES[genreId]);
    }
    return base;
}

module.exports = { BASE_CONCEPT_REGISTRY, GENRE_CONCEPT_REGISTRIES, INFLATION_RULES, getConceptRegistry };
