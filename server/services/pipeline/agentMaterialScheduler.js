/** Agent素材统一调度器 — Context Commander动态决策+大纲意图+世界观分类加载 */
const { resolveContext } = require('./contextCommander');
const { detectConflicts, buildResolvedConstraints } = require('./constraintConflictDetector');
const { _loadEntityRules, _loadGenreRules, _loadGlobalRules, _loadKnowledgeAccess, buildStateJson, getLifecycleStates } = require('./agentMaterialHelpers');
const { selectItems } = require('./schedulerStrategy');
const { resolveWorldviewLoadDepth, classifyMaterial } = require('./worldviewClassification');
const { resolveDepth } = require('./contextDepthConstants');
const { resolveMaterialIntentPriority } = require('./intentDepthResolver');
const { _resolveEntityDepth, formatEntityByDepth, formatMaterialByDepth } = require('./agentMaterialFormatter');
const logger = require('../../shared/logger');

async function scheduleMaterials(agentType, params) {
    const { projectId, chapter, materials, ctx, project, genre } = params;
    const context = await resolveContext(agentType, params);
    if (context.materialNeeds.length === 0) {
        logger.warn('materialScheduler', `No context resolved for agent: ${agentType}`);
        return { materials: {}, constraints: '', conflicts: [], stats: { agentType, loaded: 0 } };
    }

    const outlineText = (chapter?.outline || '').substring(0, 2000).toLowerCase();
    const activeMats = (materials || []).filter(m => m.projectId === projectId && !m.archived);
    const intentResult = context.intentResult;
    const loadedMaterials = {};
    const droppedTypes = [];
    let totalLoaded = 0;
    let actualChars = 0;

    for (const need of context.materialNeeds) {
        // 预算降级判定为"整类不需要"：本章不注入该类，避免无谓token
        if (need.dropped) {
            loadedMaterials[need.type] = [];
            droppedTypes.push(need.type);
            continue;
        }
        const result = await _loadByNeed(need, activeMats, outlineText, ctx, chapter, projectId, agentType, intentResult);
        loadedMaterials[need.type] = result.items;
        totalLoaded += result.items.length;
        actualChars += result.items.reduce((sum, it) => sum + (it.content?.length || 0), 0);
    }

    const constraints = await _loadConstraints(agentType, projectId, ctx, project, genre);
    const stats = {
        agentType, loaded: totalLoaded, budget: context.totalBudget,
        actualChars, droppedTypes,
        plannedChars: context.budgetAssessment?.plannedChars ?? null,
        budgetStatus: context.budgetAssessment?.status?.level ?? null,
        contextMeta: context.meta,
    };

    return { materials: loadedMaterials, constraints, conflicts: constraints.conflicts, stats };
}

async function _loadByNeed(need, activeMats, outlineText, ctx, chapter, projectId, agentType, intentResult) {
    if (need.source === 'entity-center') {
        return _loadFromEntityCenter(need, ctx, chapter, projectId, agentType, outlineText, intentResult);
    }
    if (need.source === 'knowledge-access') {
        return _loadKnowledgeAccess(need, projectId, chapter);
    }
    return _loadFromMaterials(need, activeMats, outlineText, intentResult);
}

async function _loadFromEntityCenter(need, ctx, chapter, projectId, agentType, outlineText, intentResult) {
    const items = [];
    try {
        const entityCenter = require('../entityCenter');
        const lifecycleFilter = need.type === 'character' ? getLifecycleStates(agentType) : null;
        const options = { entityType: need.type };
        if (lifecycleFilter) options.lifecycleStates = lifecycleFilter;

        const entities = await entityCenter.getEntitiesForProject(projectId, options);
        const budget = need.budget || 4000;

        for (const entity of entities) {
            const depth = _resolveEntityDepth(entity, need.resolvedDepth || need.detail, outlineText, intentResult);
            const text = formatEntityByDepth(entity, depth);
            const stateJson = need.type === 'character'
                ? await buildStateJson(entity, projectId)
                : buildStateJson(entity);
            items.push({
                name: entity.name, type: need.type, content: text || '',
                roleLevel: entity.roleLevel,
                position: entity.position || null,
                lifecycleState: entity.lifecycleState || 'active',
                refNames: entity.profile?.refNames || entity.refNames || null,
                stateJson,
                bindsSummary: entity.bindsSummary || [],
                parentPlane: entity.profile?.parentPlane || entity.parentPlane || null,
                source: 'entity-center',
                depth,
            });
        }
        return { items: selectItems(items, need, budget) };
    } catch (e) {
        logger.warn('materialScheduler', `Entity center load failed for ${need.type}: ${e.message}`);
    }
    return { items };
}

async function _loadFromMaterials(need, activeMats, outlineText, intentResult) {
    const items = [];
    const typeMats = activeMats.filter(m => m.type === need.type);
    const budget = need.budget || 1000;

    const filtered = need.matchOutline
        ? typeMats.filter(m => {
            const nameLower = m.name.toLowerCase();
            return outlineText.includes(nameLower) || nameLower.split(/[-\s]/).some(n => n.length >= 2 && outlineText.includes(n));
        })
        : typeMats;

    // 意图提及的伏笔/关系优先排序
    const sorted = _sortByIntentPriority(filtered, intentResult);

    const limited = need.maxItems ? sorted.slice(0, need.maxItems) : sorted;

    for (const m of limited) {
        const worldviewDepth = resolveWorldviewLoadDepth(m, outlineText);
        if (worldviewDepth === null) {
            const cls = classifyMaterial(m);
            if (cls.worldviewDepth) continue;
        }
        const depth = worldviewDepth || need.resolvedDepth || resolveDepth(need.detail);
        const content = formatMaterialByDepth(m, depth);
        items.push({
            name: m.name, type: m.type, content: content || '',
            roleLevel: m.roleLevel || null,
            position: m.position || null,
            parentPlane: m.parentPlane, parentFaction: m.parentFaction,
            source: 'materials', depth,
        });
    }
    return { items: selectItems(items, need, budget) };
}

/** 按意图优先级排序：意图提及的素材排在前面 */
function _sortByIntentPriority(mats, intentResult) {
    if (!intentResult) return mats;
    return [...mats].sort((a, b) => {
        const prioA = resolveMaterialIntentPriority(a, intentResult);
        const prioB = resolveMaterialIntentPriority(b, intentResult);
        return prioB - prioA; // 高优先级在前
    });
}

async function _loadConstraints(agentType, projectId, ctx, project, genre) {
    const entityRules = await _loadEntityRules(projectId);
    const genreRules = _loadGenreRules(genre);
    const globalRules = await _loadGlobalRules(projectId, ctx);

    const { conflicts, resolved, log } = detectConflicts({ projectId, entityRules, genreRules, globalRules });
    const resolvedText = buildResolvedConstraints({ projectId, entityRules, genreRules, globalRules });

    if (log.length > 0) {
        for (const entry of log) logger.info('materialScheduler', entry);
    }

    return { text: resolvedText, conflicts, resolved, source: resolved.source };
}

module.exports = { scheduleMaterials };
