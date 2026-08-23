const store = require('../../store');
const logger = require('../../shared/logger');
const { _recomputePromptTexts } = require('./formatters');
const crud = require('./entityCRUD');
const queries = require('./entityQueries');
const rels = require('./relations');

const ENTITY_TYPE = 'entities';
const STATE_HISTORY_TYPE = 'entity-state-history';

class EntityCenter {
    async getOrCreateEntity(projectId, entityType, name, defaults = {}) {
        return crud.getOrCreateEntity(this, projectId, entityType, name, defaults);
    }
    async findEntityByName(projectId, entityType, name) { return crud.findEntityByName(projectId, entityType, name); }
    async findEntityById(entityId) { return crud.findEntityById(entityId); }
    async getEntitiesForProject(projectId, options = {}) { return crud.getEntitiesForProject(projectId, options); }
    async updateEntity(entityId, updates) { return crud.updateEntity(entityId, updates); }
    async recordAppearance(entityId, chapterNumber) { return crud.recordAppearance(entityId, chapterNumber); }
    async archiveEntity(entityId, archiveStatus) { return crud.archiveEntity(entityId, archiveStatus); }
    async getEntityStats(projectId) { return crud.getEntityStats(projectId); }

    async saveStateSnapshot(entityId, chapterNumber, delta = {}, changedFields = []) {
        const entity = await store.getItem(ENTITY_TYPE, entityId);
        if (!entity) return null;
        const snapshotId = `snap-${entityId}-ch${chapterNumber}`;

        // 检查是否有变化，无变化则跳过
        const prevSnapshot = await this.getStateSnapshot(entityId, chapterNumber);
        if (prevSnapshot) {
            const hasDelta = Object.keys(delta).length > 0 || changedFields.length > 0;
            const prevBehaviorRules = prevSnapshot.data?.behaviorRules || '';
            const behaviorChanged = entity.behaviorRules !== prevBehaviorRules;
            if (!hasDelta && !behaviorChanged) return prevSnapshot; // 无变化不动
        }

        const snapshot = {
            id: snapshotId, entityId, projectId: entity.projectId, chapterNumber,
            baseState: { hp: entity.hp, combatPower: entity.combatPower, position: entity.position, factionName: entity.factionName, personality: entity.personality, speakingTone: entity.speakingTone, signatureDetail: entity.signatureDetail },
            genreState: { ...entity.genreState }, delta, changedFields,
            bindsSnapshot: [...(entity.bindsSummary || [])], relationsSnapshot: [...(entity.relationsSummary || [])],
            briefText: entity.briefText, summaryText: entity.summaryText, detailText: entity.detailText,
            isValid: true, computedAt: new Date().toISOString(),
            // behaviorRules放入data字段，PG表entity_state_history没有独立列
            data: { behaviorRules: entity.behaviorRules || '' }
        };
        await store.setItem(STATE_HISTORY_TYPE, snapshotId, snapshot);
        return snapshot;
    }

    async getStateSnapshot(entityId, chapterNumber) {
        return await store.getItem(STATE_HISTORY_TYPE, `snap-${entityId}-ch${chapterNumber}`);
    }

    async getLatestSnapshot(entityId) {
        const all = await store.queryItems(STATE_HISTORY_TYPE, { entityId, isValid: true });
        if (all.length === 0) return null;
        all.sort((a, b) => (b.chapterNumber || 0) - (a.chapterNumber || 0));
        return all[0];
    }

    async getForIntentPlanner(projectId, chapterNumber) {
        return queries.getForIntentPlanner(projectId, (pid, opts) => this.getEntitiesForProject(pid, opts));
    }

    async getForWriter(projectId, chapterNumber, tokenBudget) {
        return queries.getForWriter(projectId, chapterNumber, tokenBudget, (pid, opts) => this.getEntitiesForProject(pid, opts));
    }

    async getForReviewer(projectId, chapterNumber) {
        return queries.getForReviewer(projectId, chapterNumber, (pid, opts) => this.getEntitiesForProject(pid, opts));
    }

    _buildStateJson(entity) { return queries.buildStateJson(entity); }

    async invalidateForProject(projectId) {
        logger.info('entityCenter', `Entities are single-source-of-truth, no invalidation needed for project ${projectId}`);
    }

    async addRelation(projectId, fromEntityId, toEntityId, relType, relLabel, options = {}) {
        return rels.addRelation(this, projectId, fromEntityId, toEntityId, relType, relLabel, options);
    }
    async findRelation(fromEntityId, toEntityId, relType) { return rels.findRelation(fromEntityId, toEntityId, relType); }
    async updateRelation(relationId, updates) { return rels.updateRelation(relationId, updates); }
    async getRelationsForEntity(entityId) { return rels.getRelationsForEntity(entityId); }
    async getRelationsForProject(projectId) { return rels.getRelationsForProject(projectId); }
    async _refreshRelationsSummary(entityId) { return rels.refreshRelationsSummary(entityId); }
    async syncRelationshipFromMaterial(projectId, relName, content, chapterNumber) {
        return rels.syncRelationshipFromMaterial(this, projectId, relName, content, chapterNumber);
    }

    async _detectGenreId(projectId) { return crud.detectGenreId(projectId); }
    async _mergeExistingEntity(existing, defaults) { return crud.mergeExistingEntity(this, existing, defaults); }
    async _syncToRegistry(entity) { return crud.syncToRegistry(entity); }
    async injectBehaviorRulesFromGenre(projectId) { return crud.injectBehaviorRulesFromGenre(projectId); }
    async _allowsDualProtagonist(projectId) {
        // 双主角题材白名单已清空（保留题材均无双主角设定）
        return false;
    }
}

module.exports = new EntityCenter();
