const logger = require('../../shared/logger');

const VALID_MATERIAL_TYPES = [
    'character', 'worldview', 'relationship', 'foreshadowing',
    'equipment', 'catchphrase', 'famous-scene', 'power-system',
    'craft', 'mechanism', 'faction', 'sub-plane', 'location',
    'growth-history', 'narrative-bridge', 'institution', 'writing-technique',
    'character-combat'
];

const AGENT_TYPES = [
    'writer', 'reviser', 'polisher', 'intent-planner',
    'first-review', 'second-review', 'fast-review',
    'final-editor', 'material-manager', 'reader'
];

const DETAIL_LEVELS = ['full', 'summary', 'index'];

const GENRE_REQUIRED_FIELDS = [
    'id', 'label', 'patterns', 'foundation',
    'incompatibleConstraints', 'requiredConstraints',
    'styleProfile', 'genreBase', 'agentMaterialAccess'
];

const GENRE_OPTIONAL_FIELDS = [
    'stateSchema', 'kvImportantKeys', 'characterProfile',
    'materialRules', 'milestones', 'pacingConfig', 'pipelineConfig',
    'perspectiveSchema', 'perspective', 'techJargon',
    'qualityChecks', 'writerHints', 'constraintPresets',
    'dedupRules', 'reviewRules', 'detectors', 'interceptors',
    'materialTemplates', 'newContentValidation', 'dialectConfig',
    'genreProfileIds', 'entitySchema', 'enabledModules'
];

const ALL_GENRE_FIELDS = new Set([...GENRE_REQUIRED_FIELDS, ...GENRE_OPTIONAL_FIELDS]);

function validateGenre(genre) {
    const errors = [];
    const warnings = [];

    if (!genre.id) {
        errors.push('缺少必填字段: id');
    }

    for (const field of GENRE_REQUIRED_FIELDS) {
        if (genre[field] === undefined || genre[field] === null) {
            if (field === 'agentMaterialAccess') {
                errors.push(`缺少必填字段: ${field} — 每个题材必须显式声明每个Agent的素材访问权限，不依赖默认值`);
            } else {
                errors.push(`缺少必填字段: ${field}`);
            }
        }
    }

    for (const key of Object.keys(genre)) {
        if (key === 'isMatch') continue;
        if (!ALL_GENRE_FIELDS.has(key)) {
            warnings.push(`未知字段: "${key}" — 不在genre schema中，可能是拼写错误或废弃字段`);
        }
    }

    if (genre.agentMaterialAccess) {
        const ama = genre.agentMaterialAccess;
        for (const agentType of AGENT_TYPES) {
            if (!ama[agentType]) {
                errors.push(`agentMaterialAccess 缺少Agent: "${agentType}" — 必须为所有${AGENT_TYPES.length}个Agent显式声明`);
            }
        }
        for (const [agentType, config] of Object.entries(ama)) {
            if (!AGENT_TYPES.includes(agentType)) {
                warnings.push(`agentMaterialAccess 包含未知Agent: "${agentType}"`);
            }
            if (!config.needs || !Array.isArray(config.needs)) {
                errors.push(`agentMaterialAccess["${agentType}"].needs 必须是数组`);
            } else {
                for (const matType of config.needs) {
                    if (!VALID_MATERIAL_TYPES.includes(matType)) {
                        warnings.push(`agentMaterialAccess["${agentType}"].needs 包含未知素材类型: "${matType}"`);
                    }
                }
            }
            if (!config.detail || !DETAIL_LEVELS.includes(config.detail)) {
                errors.push(`agentMaterialAccess["${agentType}"].detail 必须是 full/summary/index 之一`);
            }
        }

        if (genre.styleProfile?.materialFocus) {
            const mf = genre.styleProfile.materialFocus;
            const activeTypes = new Set([...(mf.primary || []), ...(mf.secondary || [])]);
            const skipTypes = new Set(mf.skip || []);
            for (const [agentType, config] of Object.entries(ama)) {
                // R7 修复 BUG: 原代码未校验 needs 是否为数组，非数组值会触发 TypeError 崩溃
                if (!Array.isArray(config.needs)) continue;
                const leaked = config.needs.filter(t => skipTypes.has(t));
                if (leaked.length > 0) {
                    errors.push(`agentMaterialAccess["${agentType}"].needs 包含skip类型: [${leaked.join(', ')}]`);
                }
                const extra = config.needs.filter(t => !activeTypes.has(t) && !skipTypes.has(t));
                if (extra.length > 0) {
                    warnings.push(`agentMaterialAccess["${agentType}"].needs 包含未在materialFocus中声明的类型: [${extra.join(', ')}]`);
                }
            }
        }
    }

    if (genre.styleProfile?.materialFocus) {
        const mf = genre.styleProfile.materialFocus;
        const allDeclared = [...(mf.primary || []), ...(mf.secondary || []), ...(mf.skip || [])];
        for (const t of allDeclared) {
            if (!VALID_MATERIAL_TYPES.includes(t)) {
                warnings.push(`materialFocus 包含未知素材类型: "${t}"`);
            }
        }
        if (genre.agentMaterialAccess) {
            const coveredByAgent = new Set();
            for (const config of Object.values(genre.agentMaterialAccess)) {
                // R7 修复 BUG: 原代码未校验 needs 是否为数组，非数组值会触发 TypeError 崩溃
                if (Array.isArray(config.needs)) config.needs.forEach(t => coveredByAgent.add(t));
            }
            for (const t of [...(mf.primary || []), ...(mf.secondary || [])]) {
                if (!coveredByAgent.has(t)) {
                    warnings.push(`素材类型 "${t}" 在materialFocus中声明但无Agent覆盖`);
                }
            }
        }
    }

    if (errors.length > 0) {
        logger.error('baseGenreTemplate', `\n❌ 题材插件验证失败 [${genre.id || 'UNKNOWN'}]:`);
        errors.forEach(e => logger.error('baseGenreTemplate', `   ❌ ${e}`));
        warnings.forEach(w => logger.warn('baseGenreTemplate', `   ⚠️ ${w}`));
    } else if (warnings.length > 0) {
        logger.warn('baseGenreTemplate', `\n⚠️ 题材插件验证警告 [${genre.id}]:`);
        warnings.forEach(w => logger.warn('baseGenreTemplate', `   ⚠️ ${w}`));
    } else {
        logger.info('baseGenreTemplate', `✅ 题材插件验证通过 [${genre.id}]`);
    }

    return { valid: errors.length === 0, errors, warnings };
}

module.exports = {
    validateGenre,
    VALID_MATERIAL_TYPES,
    AGENT_TYPES,
    DETAIL_LEVELS,
    GENRE_REQUIRED_FIELDS,
    GENRE_OPTIONAL_FIELDS
};
