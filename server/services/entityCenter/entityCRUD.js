/**
 * 实体CRUD核心模块
 * 负责实体的创建、查询、更新、删除等基础操作
 */
const store = require('../../store');
const { validateGenreState, buildGenreStateDefaults } = require('../../config/genreEntitySchemas');
const logger = require('../../shared/logger');
const { _recomputePromptTexts } = require('./formatters');
const { migrateIsActive, isValidTransition } = require('./entityLifecycle');
const { syncToRegistry, resolveBehaviorRules, injectBehaviorRulesFromGenre, mergeExistingEntity, getEntityStats } = require('./entityBehaviorRules');
const { detectGenreId } = require('./entityGenreDetect');

const ENTITY_TYPE = 'entities';
// 双主角题材白名单（仅保留通过质量门禁的题材）
const DUAL_PROTAGONIST_GENRE_IDS = new Set([]);

async function getOrCreateEntity(center, projectId, entityType, name, defaults = {}) {
    let existing = await findEntityByName(projectId, entityType, name);
    if (existing) return await mergeExistingEntity(center, existing, defaults);

    if (name && entityType === 'character') {
        existing = await _fuzzyMatchCharacter(projectId, name);
        if (existing) return await mergeExistingEntity(center, existing, defaults);
    }

    if (defaults.roleLevel === 'protagonist' && entityType === 'character') {
        defaults = await enforceProtagonistLimit(projectId, defaults);
    }

    const id = defaults.id || `${entityType}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const genreId = defaults.genreId || await detectGenreId(projectId);

    const chapterSource = defaults.sourceChapter || defaults.firstAppearChapter || null;
    const entity = {
        id, projectId, entityType, name, briefName: name.substring(0, 4),
        roleLevel: defaults.roleLevel || 'npc', genreId,
        lifecycleState: defaults.lifecycleState || 'active',
        isActive: true, isLocked: false,
        firstAppearChapter: chapterSource, lastAppearChapter: defaults.lastAppearChapter || chapterSource,
        appearCount: 1, parentEntityId: defaults.parentEntityId || null,
        tags: defaults.tags || [], hp: defaults.hp ?? 100, combatPower: defaults.combatPower ?? 0,
        position: defaults.position || '', factionName: defaults.factionName || '',
        // 副本归属（见 docs/design/实体中心-副本归属与带出机制.md）：属于哪个世界/副本 + 特定位置 + 绑定媒介
        scopeWorldId: defaults.scopeWorldId || 'main-world', locationSlot: defaults.locationSlot || '',
        bindMedium: defaults.bindMedium || '',
        personality: defaults.personality || '', speakingTone: defaults.speakingTone || '',
        signatureDetail: defaults.signatureDetail || '', craftStyle: defaults.craftStyle || '',
        // 人物魅力系统4维度（参考蛊真人方源设计）
        charisma: defaults.charisma || '',           // 人格魅力：核心魅力特质
        philosophy: defaults.philosophy || '',       // 哲学观：核心信念和价值观
        quoteLibrary: defaults.quoteLibrary || [],   // 金句库：预设代表性金句+适用场景
        highlightScenes: defaults.highlightScenes || [], // 高光时刻：名场面/高光场景（运行期由编年史回流）
        entranceDesign: defaults.entranceDesign || '', // 出场设计：出场方式和标志性场景
        genreState: defaults.genreState || (genreId ? buildGenreStateDefaults(genreId) : {}),
        profile: defaults.profile || {}, bindsSummary: [], relationsSummary: [],
        behaviorRules: defaults.behaviorRules || '',
        sourceContent: defaults.sourceContent || defaults.currentContent || defaults.initialContent || '',
        version: 1, sourceChapter: chapterSource, archived: '', data: {}
    };

    _recomputePromptTexts(entity);
    await store.setItem(ENTITY_TYPE, id, entity);
    logger.info('entityCenter', `Created entity: ${entityType}/${name} (${id})`);

    await syncToRegistry(entity);
    return entity;
}

async function findEntityByName(projectId, entityType, name) {
    const all = await store.queryItems(ENTITY_TYPE, { projectId, entityType });
    return all.find(e => e.name === name && e.lifecycleState !== 'archived' && !e.archived) || null;
}

async function findEntityById(entityId) {
    return await store.getItem(ENTITY_TYPE, entityId);
}

async function getEntitiesForProject(projectId, options = {}) {
    const filter = { projectId };
    if (options.entityType) filter.entityType = options.entityType;
    if (options.roleLevel) filter.roleLevel = options.roleLevel;
    const all = await store.queryItems(ENTITY_TYPE, filter);

    for (const e of all) {
        if (!e.lifecycleState) e.lifecycleState = migrateIsActive(e.isActive, e.archived);
    }

    if (options.lifecycleStates) {
        return all.filter(e => options.lifecycleStates.includes(e.lifecycleState));
    }
    return all.filter(e => e.lifecycleState !== 'archived' || options.includeArchived);
}

async function updateEntity(entityId, updates) {
    const entity = await store.getItem(ENTITY_TYPE, entityId);
    if (!entity) { logger.warn('entityCenter', `Entity not found: ${entityId}`); return null; }

    const genreStateUpdates = updates.genreState;
    if (genreStateUpdates && entity.genreId) {
        const errors = validateGenreState(entity.genreId, genreStateUpdates);
        if (errors.length > 0) logger.warn('entityCenter', `GenreState validation errors for ${entity.name}: ${errors.join(', ')}`);
    }

    for (const [key, value] of Object.entries(updates)) {
        if (key === 'id' || key === 'projectId' || key === 'entityType') continue;
        if (key === 'genreState' && typeof value === 'object') { entity.genreState = { ...entity.genreState, ...value }; }
        else if (key === 'profile' && typeof value === 'object') { entity.profile = { ...entity.profile, ...value }; }
        else if (key === 'tags' && Array.isArray(value)) { entity.tags = value; }
        else { entity[key] = value; }
    }

    entity.version = (entity.version || 1) + 1;
    entity.updatedAt = new Date().toISOString();
    _recomputePromptTexts(entity);
    await store.setItem(ENTITY_TYPE, entityId, entity);
    await syncToRegistry(entity);
    return entity;
}

async function recordAppearance(entityId, chapterNumber) {
    const entity = await store.getItem(ENTITY_TYPE, entityId);
    if (!entity) return;
    entity.lastAppearChapter = Math.max(entity.lastAppearChapter || 0, chapterNumber);
    entity.appearCount = (entity.appearCount || 0) + 1;
    if (!entity.firstAppearChapter) entity.firstAppearChapter = chapterNumber;
    entity.updatedAt = new Date().toISOString();
    await store.setItem(ENTITY_TYPE, entityId, entity);
    await syncToRegistry(entity);
}

async function archiveEntity(entityId, archiveStatus = 'retire') {
    const targetState = archiveStatus === 'retire' ? 'archived' : (archiveStatus || 'archived');
    await transitionLifecycle(entityId, targetState, archiveStatus);
}

async function transitionLifecycle(entityId, toState, reason = '') {
    const entity = await store.getItem(ENTITY_TYPE, entityId);
    if (!entity) return null;
    const fromState = entity.lifecycleState || migrateIsActive(entity.isActive, entity.archived);
    if (fromState === toState) return entity;
    if (!isValidTransition(entity.entityType, fromState, toState, entity.bindType)) {
        logger.warn('entityCenter', `Invalid lifecycle transition: ${entity.name} ${fromState}→${toState}`);
        return null;
    }
    entity.lifecycleState = toState;
    entity.isActive = toState === 'active' || toState === 'injured';
    if (toState === 'archived') entity.archived = reason || 'retire';
    entity.updatedAt = new Date().toISOString();

    if (!entity.data) entity.data = {};
    if (!entity.data.lifecycleHistory) entity.data.lifecycleHistory = [];
    entity.data.lifecycleHistory.push({ from: fromState, to: toState, reason, chapter: entity.lastAppearChapter || 0, timestamp: new Date().toISOString() });

    await store.setItem(ENTITY_TYPE, entityId, entity);
    await syncToRegistry(entity);
    logger.info('entityCenter', `Lifecycle: ${entity.name} ${fromState}→${toState} (${reason})`);
    return entity;
}

async function _fuzzyMatchCharacter(projectId, name) {
    const normalizedName = name.toLowerCase().replace(/[\s\-_··]/g, '');
    // 空名/单字名不参与模糊匹配：''.includes(x) 恒真，会把任意新角色并进"无名实体"
    if (normalizedName.length < 2) return null;
    const allChars = await store.queryItems(ENTITY_TYPE, { projectId, entityType: 'character' });
    const match = allChars.find(e => {
        if (e.lifecycleState === 'archived' || e.archived) return false;
        const eName = (e.name || '').toLowerCase().replace(/[\s\-_··]/g, '');
        if (eName.length < 2) return false;
        return eName === normalizedName || eName.includes(normalizedName) || normalizedName.includes(eName);
    });
    if (match) logger.info('entityCenter', `Fuzzy match: "${name}" -> existing "${match.name}" (${match.id})`);
    return match || null;
}

async function enforceProtagonistLimit(projectId, defaults, options = {}) {
    const allChars = await store.queryItems(ENTITY_TYPE, { projectId, entityType: 'character' });
    // excludeEntityId：升级已有角色时，把自己排除在"已占位的主角"之外
    const existingProtagonists = allChars.filter(e =>
        e.roleLevel === 'protagonist' && e.lifecycleState !== 'archived' && !e.archived &&
        e.id !== options.excludeEntityId);
    const genreId = await detectGenreId(projectId);
    const maxProtagonists = DUAL_PROTAGONIST_GENRE_IDS.has(genreId) ? 2 : 1;
    if (existingProtagonists.length >= maxProtagonists) {
        logger.info('entityCenter', `Protagonist limit(${maxProtagonists}) reached, downgrading to supporting`);
        defaults.roleLevel = 'supporting';
    }
    return defaults;
}

module.exports = {
    enforceProtagonistLimit,
    getOrCreateEntity, findEntityByName, findEntityById, getEntitiesForProject,
    updateEntity, recordAppearance, archiveEntity, transitionLifecycle,
    detectGenreId, syncToRegistry, mergeExistingEntity, getEntityStats,
    resolveBehaviorRules, injectBehaviorRulesFromGenre,
};
