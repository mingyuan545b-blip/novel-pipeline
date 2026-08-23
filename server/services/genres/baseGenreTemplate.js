const { validateGenre } = require('./genreValidator');

function deepMerge(target, source) {
    for (const key of Object.keys(source)) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            target[key] = target[key] || {};
            deepMerge(target[key], source[key]);
        } else {
            target[key] = source[key];
        }
    }
    return target;
}

const BASE_GENRE_TEMPLATE = {
    id: '',
    label: '',
    patterns: [],

    stateSchema: {
        protagonist: { trackFields: 'all', minUpdateFrequency: 'every-chapter' },
        supporting: {
            trackFields: 'important', minUpdateFrequency: 'appearance-chapter',
            importantFields: ['factionName', 'position', 'personality', 'speakingTone']
        },
        npc: { trackFields: 'basic', minUpdateFrequency: 'appearance-chapter', basicFields: ['name', 'factionName', 'position'] }
    },

    kvImportantKeys: ['name', 'hp', 'combatPower', 'position', 'factionName', 'speakingTone'],

    characterProfile: {
        protagonistTags: [
            '【年龄】具体年龄', '【外貌】身高体型、面容特征、标志性穿着',
            '【性格】至少3个性格特征词+1段行为表现描述', '【说话语气】声音特征+语言习惯',
            '【核心欲望】角色最深层想要什么', '【内在矛盾】角色内心的矛盾冲突',
            '【行为模式】面对问题的典型反应方式', '【身份/职位】在故事世界中的位置',
            '【与主角关系】填写"主角本人"', '【成长弧光】主角从开头到结尾的性格/能力变化轨迹',
            '【标志性动作】主角的招牌动作或口头禅'
        ],
        protagonistWordCount: 400,
        protagonistExample: '【年龄】[具体年龄]【外貌】[身高体型+面容特征+标志性穿着]【性格】[3个性格特征词]+[1段行为表现描述]【说话语气】[声音特征+语言习惯]【核心欲望】[角色最深层想要什么]【内在矛盾】[角色内心的矛盾冲突]【行为模式】[面对问题的典型反应方式]【身份/职位】[在故事世界中的位置]【与主角关系】主角本人【成长弧光】[从开头到结尾的性格/能力变化轨迹]【标志性动作】[招牌动作或口头禅]',
        supportingTags: [
            '【年龄】具体年龄', '【外貌】1-2句标志性外貌特征',
            '【性格】2-3个性格特征词+简短行为描述', '【说话语气】语言习惯（1句即可）',
            '【核心欲望】角色最深层想要什么', '【身份/职位】在故事世界中的位置',
            '【与主角关系】和主角的关系定位+互动模式', '【出场功能】叙事功能（导师/对手/盟友/信息源）'
        ],
        supportingWordCount: 250,
        supportingExample: '【年龄】[具体年龄]【外貌】[1-2句标志性外貌特征]【性格】[2-3个性格特征词]+[简短行为描述]【说话语气】[语言习惯（1句即可）]【核心欲望】[角色最深层想要什么]【身份/职位】[在故事世界中的位置]【与主角关系】[和主角的关系定位+互动模式]【出场功能】[叙事功能（导师/对手/盟友/信息源）]',
        supportingWriterPrinciples: '', supportingOrganizerDimensions: '',
        supportingTrackingFields: [], supportingRegistrarNoteFields: [],
        npcTags: [
            '【外貌】1句标志性特征（让人记住的辨识点）', '【说话语气】语言习惯（1句即可）',
            '【身份/职位】在故事世界中的位置', '【出场功能】这个NPC在故事中承担什么功能'
        ],
        npcWordCount: 80,
        npcExample: '【外貌】[1句标志性特征]【说话语气】[语言习惯]【身份/职位】[位置]【出场功能】[功能]',
        worldviewTemplate: '', namingTemplate: '', flavorTemplate: ''
    },

    materialRules: {
        worldview: '必须包含 边界条件 + 违反后果',
        'power-system': '必须包含 升级条件 + 代价/限制',
        foreshadowing: '必须包含 预期回收窗口 + 关联角色'
    },

    milestones: {},
    pacingConfig: { openingHookRange: 100 },

    pipelineConfig: {
        targetMinWords: 2200, targetMaxWords: 2800, rejectMinWords: 1800,
        maxChapterWords: 3500, maxRounds: 7, totalChapters: 100,
        requireCliffhanger: true, requireTrendingMemes: false, skipSecondReview: false,
        rangeScale: 1.0, milestones: {},
        validation: { openingHookRange: 100, dialogueRatioMax: 0.28, reversalRequired: false, sweetPointRequired: false }
    },

    perspectiveSchema: {
        fields: '"perspective":"protagonist/narrator/other"',
        label: '视角：protagonist/narrator/other',
        values: ['protagonist', 'narrator', 'other']
    },

    isMatch(styleProfile) {
        const text = [styleProfile?.key, styleProfile?.label, styleProfile?.description, styleProfile?.genre, styleProfile?.styleTemplateId].filter(Boolean).join(' ');
        return this.patterns.some(p => text.includes(p));
    },

    foundation: {}, incompatibleConstraints: [], requiredConstraints: [],
    styleProfile: {}, genreBase: {}, perspective: null,
    techJargon: { terms: [] },
    qualityChecks: { onomatopoeia: { enabled: false }, visualAnchors: { enabled: false }, motherChildDialogue: { enabled: false }, modernSlangExtra: false },
    writerHints: {}, detectors: null, interceptors: null, reviewRules: null,
    dedupRules: null, constraintPresets: null, newContentValidation: null, agentMaterialAccess: null,
    enabledModules: []
};

function createGenre(overrides) {
    const genre = Object.create(BASE_GENRE_TEMPLATE);

    genre.stateSchema = {
        protagonist: { ...BASE_GENRE_TEMPLATE.stateSchema.protagonist },
        supporting: { ...BASE_GENRE_TEMPLATE.stateSchema.supporting },
        npc: { ...BASE_GENRE_TEMPLATE.stateSchema.npc }
    };
    genre.kvImportantKeys = [...BASE_GENRE_TEMPLATE.kvImportantKeys];
    genre.characterProfile = deepMerge({}, BASE_GENRE_TEMPLATE.characterProfile);
    genre.materialRules = { ...BASE_GENRE_TEMPLATE.materialRules };
    genre.milestones = { ...BASE_GENRE_TEMPLATE.milestones };
    genre.pacingConfig = { ...BASE_GENRE_TEMPLATE.pacingConfig };
    genre.pipelineConfig = deepMerge({}, BASE_GENRE_TEMPLATE.pipelineConfig);
    genre.patterns = [];
    genre.incompatibleConstraints = [];
    genre.requiredConstraints = [];
    genre.enabledModules = [];

    if (overrides) {
        for (const key of Object.keys(overrides)) {
            if (key === 'stateSchema' && overrides.stateSchema) {
                for (const role of Object.keys(overrides.stateSchema)) {
                    genre.stateSchema[role] = { ...genre.stateSchema[role], ...overrides.stateSchema[role] };
                }
            } else if (key === 'characterProfile' && overrides.characterProfile) {
                genre.characterProfile = deepMerge(genre.characterProfile, overrides.characterProfile);
            } else if (key === 'materialRules' && overrides.materialRules) {
                genre.materialRules = { ...genre.materialRules, ...overrides.materialRules };
            } else if (key === 'milestones' && overrides.milestones) {
                genre.milestones = { ...genre.milestones, ...overrides.milestones };
            } else if (key === 'pacingConfig' && overrides.pacingConfig) {
                genre.pacingConfig = { ...genre.pacingConfig, ...overrides.pacingConfig };
            } else if (key === 'pipelineConfig' && overrides.pipelineConfig) {
                const base = deepMerge({}, genre.pipelineConfig);
                genre.pipelineConfig = deepMerge(base, overrides.pipelineConfig);
            } else if (key === 'kvImportantKeys' && overrides.kvImportantKeys) {
                genre.kvImportantKeys = [...overrides.kvImportantKeys];
            } else {
                genre[key] = overrides[key];
            }
        }
    }

    validateGenre(genre);
    return genre;
}

module.exports = { BASE_GENRE_TEMPLATE, createGenre, deepMerge };
