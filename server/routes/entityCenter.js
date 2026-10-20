const { v4: uuidv4 } = require('uuid');
const logger = require('../shared/logger');
const store = require('../store');
const router = require('express').Router();
const entityCenterRepairRoutes = require('./entityCenterRepairRoutes');
const { ERROR_CODES } = require('../shared/errorCodes');

const { NOT_FOUND, INTERNAL_ERROR } = ERROR_CODES;

const ENTITY_TYPES = [
    { path: '/entity-registry', storeType: 'entity-registry' },
    { path: '/entities', storeType: 'entities' },
    { path: '/item-definitions', storeType: 'item-definitions' },
    { path: '/character-binds', storeType: 'character-binds' },
    { path: '/character-relations', storeType: 'character-relations' },
    { path: '/pet-entities', storeType: 'pet-entities' },
    { path: '/servant-entities', storeType: 'servant-entities' }
];

const PROTECTED_FIELDS = ['id', 'projectId', 'createdAt'];

/**
 * 当更新 entities 表的 character 时，自动同步到 entity-registry
 * （前端读 registry 展示，避免 character 更新后 registry 数据陈旧）
 */
async function syncCharacterToRegistry(updated) {
    try {
        const { _recomputePromptTexts } = require('../services/entityCenter/formatters');
        const { syncToRegistry } = require('../services/entityCenter/entityBehaviorRules');
        _recomputePromptTexts(updated);
        logger.info('entityCenter', `[PUT /entities] syncToRegistry triggered for ${updated.name} (charisma=${!!updated.charisma})`);
        await syncToRegistry(updated, true);
        logger.info('entityCenter', `[PUT /entities] syncToRegistry completed for ${updated.name}`);
    } catch (syncErr) {
        logger.warn('entityCenter', `[PUT /entities] syncToRegistry failed: ${syncErr.message}`);
    }
}

function createCrudRoutes(pathPrefix, storeType) {
    router.get(pathPrefix, async (req, res) => {
        try {
            const { projectId, entityType, lifecycleStates, includeArchived } = req.query;
            if (storeType === 'entities' && projectId) {
                const { getEntitiesForProject } = require('../services/entityCenter/entityCRUD');
                const options = {};
                if (entityType) options.entityType = entityType;
                if (lifecycleStates) options.lifecycleStates = lifecycleStates.split(',');
                if (includeArchived === 'true') options.includeArchived = true;
                const items = await getEntitiesForProject(projectId, options);
                return res.json(items);
            }
            const filter = projectId ? { projectId } : {};
            const items = await store.queryItems(storeType, filter);
            res.json(items);
        } catch (err) {
            return res.apiError(INTERNAL_ERROR.statusCode, `Failed to list ${storeType}`, INTERNAL_ERROR.code, { message: err.message });
        }
    });

    router.get(`${pathPrefix}/:id`, async (req, res) => {
        try {
            const item = await store.getItem(storeType, req.params.id);
            if (!item) return res.apiError(NOT_FOUND.statusCode, `${storeType} not found`, NOT_FOUND.code);
            res.json(item);
        } catch (err) {
            return res.apiError(INTERNAL_ERROR.statusCode, `Failed to get ${storeType}`, INTERNAL_ERROR.code, { message: err.message });
        }
    });

    router.post(pathPrefix, async (req, res) => {
        try {
            if (storeType === 'entity-registry' && req.body.name && req.body.projectId && req.body.entityType) {
                const existing = await store.queryItems(storeType, {
                    projectId: req.body.projectId, entityType: req.body.entityType, name: req.body.name
                });
                if (existing && existing.length > 0) {
                    const now = new Date().toISOString();
                    const bodySafe = { ...req.body };
                    for (const f of PROTECTED_FIELDS) delete bodySafe[f];
                    const updated = { ...existing[0], ...bodySafe, id: existing[0].id, projectId: existing[0].projectId, createdAt: existing[0].createdAt, updatedAt: now };
                    await store.setItem(storeType, existing[0].id, updated);
                    return res.json(updated);
                }
            }
            const id = uuidv4();
            const now = new Date().toISOString();
            const item = { id, projectId: req.body.projectId || null, ...req.body, id, createdAt: now, updatedAt: now };
            await store.setItem(storeType, id, item);
            res.apiOk(item, null, 201);
        } catch (err) {
            return res.apiError(INTERNAL_ERROR.statusCode, `Failed to create ${storeType}`, INTERNAL_ERROR.code, { message: err.message });
        }
    });

    router.put(`${pathPrefix}/:id`, async (req, res) => {
        try {
            const existing = await store.getItem(storeType, req.params.id);
            logger.info('entityCenter', `[PUT ${pathPrefix}] id=${req.params.id} storeType=${storeType} entityType=${existing?.entityType} hasCharisma=${!!existing?.charisma}`);
            if (!existing) return res.apiError(NOT_FOUND.statusCode, `${storeType} not found`, NOT_FOUND.code);
            const now = new Date().toISOString();
            const bodySafe = { ...req.body };
            for (const f of PROTECTED_FIELDS) delete bodySafe[f];
            const updated = { ...existing, ...bodySafe, id: existing.id, projectId: existing.projectId, createdAt: existing.createdAt, updatedAt: now };
            await store.setItem(storeType, existing.id, updated);
            if (storeType === 'entities' && existing.entityType === 'character') {
                await syncCharacterToRegistry(updated);
            }
            res.json(updated);
        } catch (err) {
            return res.apiError(INTERNAL_ERROR.statusCode, `Failed to update ${storeType}`, INTERNAL_ERROR.code, { message: err.message });
        }
    });

    router.delete(`${pathPrefix}/:id`, async (req, res) => {
        try {
            const existing = await store.getItem(storeType, req.params.id);
            if (!existing) return res.apiError(NOT_FOUND.statusCode, `${storeType} not found`, NOT_FOUND.code);
            if (storeType === 'entity-registry' && existing.entityType === 'character' && existing.name) {
                try {
                    const entityCenter = require('../services/entityCenter');
                    const entity = await entityCenter.findEntityByName(existing.projectId, 'character', existing.name);
                    if (entity) await store.deleteItem('entities', entity.id);
                } catch (_) { logger.warn('entityCenter', _.message || _); }  // DEGRADE: 影响=require 失败→本步跳过（业务继续，质量/可观测性下降） 可见性=仅日志(logger.warn)
            }
            const deleted = await store.deleteItem(storeType, req.params.id);
            if (!deleted) return res.apiError(NOT_FOUND.statusCode, `${storeType} not found`, NOT_FOUND.code);
            res.json({ success: true });
        } catch (err) {
            return res.apiError(INTERNAL_ERROR.statusCode, `Failed to delete ${storeType}`, INTERNAL_ERROR.code, { message: err.message });
        }
    });
}

ENTITY_TYPES.forEach(({ path, storeType }) => createCrudRoutes(path, storeType));
router.use(entityCenterRepairRoutes);

module.exports = router;
