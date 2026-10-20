const logger = require('../shared/logger');
const { GENRE_SCHEMAS } = require('./genreStateFields');
const { formatStateForPrompt, createStateDelta, applyStateDelta, buildLabelToKeyMap, normalizeDeltaKeys } = require('./stateSchemaUtils');

/**
 * 角色状态 schema 定义
 * 按题材区分，每个题材有基础字段 + 题材特有字段
 *
 * 角色等级体系：
 * - 主角 (protagonist): 追踪所有状态字段，全程监控
 * - 配角 (supporting): 追踪关键状态字段，重要章节更新
 * - NPC (npc): 仅追踪身份/阵营等基础字段，仅在出场章节更新
 */

const ROLE_LEVELS = {
    protagonist: { key: 'protagonist', label: '主角', icon: '⭐', color: '#ffd700', trackAllFields: true },
    supporting: { key: 'supporting', label: '配角', icon: '🔷', color: '#00c8ff', trackAllFields: false },
    npc: { key: 'npc', label: 'NPC', icon: '👤', color: '#888888', trackAllFields: false },
};

const GENRE_ROLE_STRATEGIES = {};

function getGenreRoleStrategy(genreId) {
    if (GENRE_ROLE_STRATEGIES[genreId]) return GENRE_ROLE_STRATEGIES[genreId];
    try {
        const { getGenreById } = require('../services/genreConfig');
        const genre = getGenreById(genreId);
        if (genre?.stateSchema) {
            const strategy = {};
            for (const [role, config] of Object.entries(genre.stateSchema)) {
                strategy[role] = {
                    trackFields: config.trackFields,
                    minUpdateFrequency: config.minUpdateFrequency,
                    ...(config.importantFields ? { importantFieldOverrides: config.importantFields } : {}),
                    ...(config.basicFields ? { basicFields: config.basicFields } : {})
                };
            }
            GENRE_ROLE_STRATEGIES[genreId] = strategy;
            return strategy;
        }
    } catch (_) { logger.warn('characterStateSchema', '[char-state-schemas]', _.message || _); }  // DEGRADE: 影响=角色状态 Schema 迁移 失败→本步跳过（业务继续，质量/可观测性下降） 可见性=仅日志(logger.warn)
    return null;
}

const BASE_STATE_FIELDS = {
    hp: { key: 'hp', label: '生命值', type: 'number', defaultValue: 100, unit: '%', trackForNpc: false, trackForSupporting: true },
    combatPower: { key: 'combatPower', label: '战力', type: 'number', defaultValue: 0, trackForNpc: false, trackForSupporting: true },
    roleLevel: { key: 'roleLevel', label: '角色等级', type: 'string', defaultValue: 'npc', enum: ['protagonist', 'supporting', 'npc'] },
    position: { key: 'position', label: '职位/身份', type: 'string', defaultValue: '', trackForNpc: true, trackForSupporting: true },
    factionId: { key: 'factionId', label: '阵营ID', type: 'string', defaultValue: '' },
    factionName: { key: 'factionName', label: '阵营', type: 'string', defaultValue: '' },
    personality: { key: 'personality', label: '性格', type: 'string', defaultValue: '' },
    speakingTone: { key: 'speakingTone', label: '说话语气', type: 'string', defaultValue: '' },
    catchphrases: { key: 'catchphrases', label: '口头禅', type: 'array', defaultValue: [] },
    relationships: { key: 'relationships', label: '人际关系', type: 'object', defaultValue: {} },
    subordinates: { key: 'subordinates', label: '下属', type: 'array', defaultValue: [] },
    equipment: { key: 'equipment', label: '装备', type: 'array', defaultValue: [] },
    stateChangedFields: { key: 'stateChangedFields', label: '变更字段', type: 'array', defaultValue: [] },
    signatureDetail: { key: 'signatureDetail', label: '标志性细节', type: 'string', defaultValue: '', trackForNpc: false, trackForSupporting: true },
    protagonistMirror: { key: 'protagonistMirror', label: '主角镜像', type: 'string', defaultValue: '', trackForNpc: false, trackForSupporting: true },
    independentStance: { key: 'independentStance', label: '独立立场', type: 'string', defaultValue: '', trackForNpc: false, trackForSupporting: true },
    fateArc: { key: 'fateArc', label: '命运弧光', type: 'string', defaultValue: '', trackForNpc: false, trackForSupporting: true },
    innerConflict: { key: 'innerConflict', label: '内在矛盾', type: 'string', defaultValue: '', trackForNpc: false, trackForSupporting: true },
};

function resolveGenreId(genreId) {
    return genreId && typeof genreId === 'object' ? genreId.id : genreId;
}

function getCharacterStateSchema(genreId) {
    const resolvedId = resolveGenreId(genreId);
    const genre = GENRE_SCHEMAS[resolvedId];
    const roleStrategy = getGenreRoleStrategy(resolvedId);
    if (!genre) {
        return {
            fields: { ...BASE_STATE_FIELDS },
            thresholds: { hpLow: 30 },
            genre: null,
            genreId: resolvedId,
            roleStrategy: roleStrategy
        };
    }
    return {
        fields: { ...BASE_STATE_FIELDS, ...genre.extraFields },
        thresholds: genre.thresholds,
        genre: genre,
        genreId: resolvedId,
        combatPowerFormula: genre.combatPowerFormula || null,
        roleStrategy: roleStrategy
    };
}

function getFieldsForRoleLevel(genreId, roleLevel) {
    const resolvedId = resolveGenreId(genreId);
    const strategy = GENRE_ROLE_STRATEGIES[resolvedId]?.[roleLevel];
    if (!strategy) {
        return Object.keys(BASE_STATE_FIELDS);
    }
    if (strategy.trackFields === 'all') {
        const genre = GENRE_SCHEMAS[resolvedId];
        return Object.keys({ ...BASE_STATE_FIELDS, ...genre?.extraFields });
    }
    if (strategy.trackFields === 'important') {
        const importantFields = strategy.importantFieldOverrides || [];
        return [...new Set(['hp', 'combatPower', 'factionName', 'position', 'personality', ...importantFields])];
    }
    if (strategy.trackFields === 'basic') {
        return strategy.basicFields || ['name', 'factionName', 'position'];
    }
    return Object.keys(BASE_STATE_FIELDS);
}

function getRoleLevelInfo(level) {
    return ROLE_LEVELS[level] || ROLE_LEVELS.npc;
}

function getAllRoleLevels() {
    return Object.values(ROLE_LEVELS);
}

function getAllGenres() {
    return Object.values(GENRE_SCHEMAS).map(g => ({ id: g.id, label: g.label }));
}

function normalizeDeltaKeysWithSchema(delta, genreId) {
    const resolvedId = resolveGenreId(genreId);
    const schema = getCharacterStateSchema(resolvedId);
    return normalizeDeltaKeys(delta, schema);
}

function buildLabelToKeyMapForGenre(genreId) {
    const resolvedId = resolveGenreId(genreId);
    const schema = getCharacterStateSchema(resolvedId);
    return buildLabelToKeyMap(schema);
}

module.exports = {
    BASE_STATE_FIELDS,
    GENRE_SCHEMAS,
    ROLE_LEVELS,
    GENRE_ROLE_STRATEGIES,
    getCharacterStateSchema,
    getFieldsForRoleLevel,
    getRoleLevelInfo,
    getAllRoleLevels,
    getAllGenres,
    formatStateForPrompt,
    createStateDelta,
    applyStateDelta,
    buildLabelToKeyMap: buildLabelToKeyMapForGenre,
    normalizeDeltaKeys: normalizeDeltaKeysWithSchema
};
