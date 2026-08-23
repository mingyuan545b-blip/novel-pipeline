// genreEntitySchemas.js - 从genrePlugin动态生成，无重复手写
// 每个题材的entitySchema数据定义在对应的genre插件文件中
// 本文件提供统一的查询API

const { getRegisteredGenres } = require('../services/genreConfig');

const DEFAULT_SCHEMA = {
    id: 'default',
    label: '通用',
    entityTypes: ['character', 'location', 'relationship', 'foreshadowing', 'equipment', 'faction', 'worldview'],
    genreStateKeys: {},
    relationTypes: ['ally', 'enemy', 'rival', 'family', 'friend', 'subordinate', 'mentor'],
    relationTypeKeywords: {
        'ally': ['盟友', '合作', '友好', '信任'],
        'enemy': ['敌人', '敌对', '对抗', '仇', '恨'],
        'rival': ['对手', '竞争'],
        'family': ['家人', '父母', '兄弟', '姐妹'],
        'friend': ['朋友', '友谊', '闺蜜'],
        'subordinate': ['下属', '手下'],
        'mentor': ['导师', '师父', '师傅']
    },
    narrativePhases: ['setup', 'rising', 'climax', 'falling', 'resolution'],
    milestones: {}
};

function _buildSchemaFromGenre(genre) {
    const es = genre.entitySchema || {};
    return {
        id: genre.id,
        label: genre.label,
        entityTypes: es.entityTypes || DEFAULT_SCHEMA.entityTypes,
        genreStateKeys: es.genreStateKeys || {},
        relationTypes: es.relationTypes || DEFAULT_SCHEMA.relationTypes,
        relationTypeKeywords: es.relationTypeKeywords || {},
        narrativePhases: es.narrativePhases || DEFAULT_SCHEMA.narrativePhases,
        milestones: es.milestones || genre.milestones || {}
    };
}

function _getGenreById(genreId) {
    try {
        const registry = getRegisteredGenres();
        return registry.find(g => g.id === genreId) || null;
    } catch (_) {
        return null;
    }
}

function getGenreEntitySchema(genreId) {
    const genre = _getGenreById(genreId);
    if (genre && genre.entitySchema) {
        return _buildSchemaFromGenre(genre);
    }
    return DEFAULT_SCHEMA;
}

function getGenreStateKeys(genreId) {
    const schema = getGenreEntitySchema(genreId);
    return schema.genreStateKeys || {};
}

function getGenreRelationTypes(genreId) {
    const schema = getGenreEntitySchema(genreId);
    return schema.relationTypes || [];
}

function getGenreRelationTypeKeywords(genreId) {
    const schema = getGenreEntitySchema(genreId);
    return schema.relationTypeKeywords || {};
}

function getGenreNarrativePhases(genreId) {
    const schema = getGenreEntitySchema(genreId);
    return schema.narrativePhases || [];
}

function getGenreMilestones(genreId) {
    const schema = getGenreEntitySchema(genreId);
    return schema.milestones || {};
}

function getAllGenreSchemas() {
    try {
        const registry = getRegisteredGenres();
        return registry.filter(g => g.entitySchema).map(g => _buildSchemaFromGenre(g));
    } catch (_) {
        return [];
    }
}

function buildGenreStateDefaults(genreId) {
    const keys = getGenreStateKeys(genreId);
    const defaults = {};
    for (const [key, config] of Object.entries(keys)) {
        defaults[key] = config.default;
    }
    return defaults;
}

function validateGenreState(genreId, genreState) {
    const keys = getGenreStateKeys(genreId);
    const errors = [];
    for (const [key, config] of Object.entries(keys)) {
        if (genreState[key] !== undefined && config.type === 'number' && typeof genreState[key] !== 'number') {
            errors.push(`${key} should be number, got ${typeof genreState[key]}`);
        }
    }
    return errors;
}

module.exports = {
    DEFAULT_SCHEMA,
    getGenreEntitySchema,
    getGenreStateKeys,
    getGenreRelationTypes,
    getGenreRelationTypeKeywords,
    getGenreNarrativePhases,
    getGenreMilestones,
    getAllGenreSchemas,
    buildGenreStateDefaults,
    validateGenreState
};
