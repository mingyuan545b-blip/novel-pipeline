/**
 * genrePluginSpec.js — 题材插件结构化规范
 *
 * 设计理念：题材插件 = 索引(index) + 多个部分(parts)
 * 类比HTML：index是骨架，parts是head/body/sections
 *
 * 目录结构：
 *   genres/
 *     high-martial-crossplane/
 *       index.js          — 入口，组合各部分（≤80行）
 *       foundation.js     — 基础约束+铁律（≤100行）
 *       styleProfile.js   — 风格配置+genreBase（≤80行）
 *       entitySchema.js   — 实体Schema+状态键（≤80行）
 *       qualityChecks.js  — 质量检查开关+方言配置（≤60行）
 *       writerHints.js    — 写作提示+扩展策略（≤100行）
 *       constraintPresets.js — 约束预设（≤100行）
 *       materialTemplates.js — 素材模板+命名规则（≤80行）
 *       contentValidation.js — 内容验证函数（≤100行）
 *       dedupRules.js     — 去重规则（≤60行）
 *       reviewRules.js    — 审核规则（≤150行）
 *       detectorsCore.js  — 核心检测器（≤200行）
 *       detectorsExtra.js — 扩展检测器（≤100行）
 *       detectors.js      — 检测器组合入口（≤30行）
 *       interceptors.js   — 拦截器函数（≤150行）
 *
 * 加载机制：
 *   1. genreConfig.js扫描genres/目录
 *   2. 遇到目录→读取index.js
 *   3. 遇到文件→直接require（向后兼容旧格式）
 *   4. index.js调用assembleGenre()组合各部分
 *
 * 校验机制：
 *   - 每个part有schema定义，缺失字段自动从baseGenreTemplate填充
 *   - 新增题材只需创建目录+index.js+必要parts
 *   - 不需要的parts直接不创建，系统自动使用默认值
 *   - validateGenre()在加载时自动校验完整性
 */

const GENRE_PART_SCHEMA = {
    foundation: {
        required: ['additionalConstraints', 'additionalFoundationRules'],
        optional: ['skipConstraints', 'systemMechanismDimming', 'systemMechanismTarget'],
        description: '基础约束和铁律'
    },
    styleProfile: {
        required: ['key', 'label', 'povRule', 'dialogueRule', 'behaviorRule', 'toneRule'],
        optional: ['titleRule', 'reviewFocus', 'materialFocus', 'constraintOverrides', 'characterRefRules'],
        description: '风格配置'
    },
    genreBase: {
        required: [],
        optional: ['BEHAVIOR_APPEND', 'REQUIRED_CONSTRAINT_OVERRIDES', 'TONE_APPEND', 'REVIEW_APPEND'],
        description: '题材基底行为/语气/审核追加规则'
    },
    entitySchema: {
        required: [],
        optional: ['entityTypes', 'genreStateKeys', 'relationTypes', 'relationTypeKeywords', 'narrativePhases', 'milestones'],
        description: '实体Schema和状态键'
    },
    qualityChecks: {
        required: [],
        optional: ['onomatopoeia', 'visualAnchors', 'motherChildDialogue', 'modernSlangExtra'],
        description: '质量检查开关'
    },
    dialectConfig: {
        required: [],
        optional: ['defaultIntensity', 'highTensionOverride', 'reviewCheck', 'rules'],
        description: '方言配置'
    },
    writerHints: {
        required: [],
        optional: ['terminologyDimming', 'wordCountExpand'],
        description: '写作提示和扩展策略'
    },
    constraintPresets: {
        required: [],
        optional: ['*'],
        description: '约束预设（键值对，键为约束ID）'
    },
    materialTemplates: {
        required: [],
        optional: ['character', 'faction', 'worldview', 'equipment', 'power-system', 'craft'],
        description: '素材模板和命名规则'
    },
    contentValidation: {
        required: [],
        optional: ['onMaterialCreate', 'onChapterContent'],
        description: '内容验证函数'
    },
    dedupRules: {
        required: [],
        optional: ['*'],
        description: '去重规则数组'
    },
    reviewRules: {
        required: [],
        optional: ['firstReview', 'secondReview', 'reviser', 'finalEditor'],
        description: '审核规则'
    },
    detectors: {
        required: [],
        optional: ['perspective', 'terminology', 'onomatopoeia', 'visualAnchors', 'motherChildDialogue', 'modernSlang'],
        description: '检测器函数'
    },
    interceptors: {
        required: [],
        optional: ['firstReview', 'secondReview'],
        description: '拦截器函数'
    }
};

/**
 * 组装题材插件
 * @param {object} config - { id, label, patterns, genreProfileIds, modules, ... }
 * @param {object} parts - { foundation, styleProfile, genreBase, entitySchema, ... }
 * @returns {object} 完整的题材插件对象
 *
 * 阶段1扩展：config.modules 支持功能模块组装
 * - modules为可选数组，不传时enabledModules=[]（向后兼容）
 * - 模块内容合并到genre现有字段（constraintPresets/genreStateKeys等）
 * - 模块元信息保存在genre.enabledModules，agent可查询
 */
function assembleGenre(config, parts = {}) {
    const { createGenre } = require('./baseGenreTemplate');
    const { assembleModules } = require('./genreModuleAssembler');

    const overrides = {
        id: config.id,
        label: config.label,
        patterns: config.patterns || [],
        genreProfileIds: config.genreProfileIds || [],
    };

    // 直接赋值的配置字段
    const directFields = [
        'stateSchema', 'kvImportantKeys', 'incompatibleConstraints',
        'requiredConstraints', 'agentMaterialAccess', 'perspective',
        'techJargon', 'pipelineConfig', 'pacingConfig',
        'characterProfile', 'materialRules', 'milestones'
    ];
    for (const field of directFields) {
        if (config[field] !== undefined) overrides[field] = config[field];
    }

    // 组装各part
    const partMappings = [
        ['foundation', 'foundation'],
        ['styleProfile', 'styleProfile'],
        ['genreBase', 'genreBase'],
        ['entitySchema', 'entitySchema'],
        ['qualityChecks', 'qualityChecks'],
        ['dialectConfig', 'dialectConfig'],
        ['writerHints', 'writerHints'],
        ['constraintPresets', 'constraintPresets'],
        ['materialTemplates', 'materialTemplates'],
        ['dedupRules', 'dedupRules'],
        ['reviewRules', 'reviewRules'],
        ['detectors', 'detectors'],
        ['interceptors', 'interceptors'],
    ];

    for (const [partKey, genreKey] of partMappings) {
        if (parts[partKey] !== undefined) {
            overrides[genreKey] = parts[partKey];
        }
    }

    // contentValidation → newContentValidation (命名映射)
    if (parts.contentValidation !== undefined) {
        overrides.newContentValidation = parts.contentValidation;
    }

    const genre = createGenre(overrides);

    // 阶段1新增：功能模块组装（向后兼容，无modules时enabledModules=[]）
    const modules = (config.modules && Array.isArray(config.modules)) ? config.modules : [];
    assembleModules(genre, modules);

    return genre;
}

module.exports = { GENRE_PART_SCHEMA, assembleGenre };
