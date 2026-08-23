const store = require('../../store');
const logger = require('../../shared/logger');
const { _recomputePromptTexts } = require('./formatters');
const { detectGenreId } = require('./entityCRUD');

const ENTITY_TYPE = 'entities';

async function addRelation(center, projectId, fromEntityId, toEntityId, relType, relLabel, options = {}) {
    const existing = await findRelation(fromEntityId, toEntityId, relType);
    if (existing) {
        return await updateRelation(existing.id, {
            relLabel: relLabel || existing.relLabel,
            strength: options.strength ?? existing.strength,
            trustLevel: options.trustLevel ?? existing.trustLevel,
            notes: options.notes || existing.notes
        });
    }

    const id = options.id || `rel-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const relation = {
        id, projectId, fromEntityId, toEntityId,
        relType: relType || 'other', relLabel: relLabel || '',
        strength: options.strength ?? 50, trustLevel: options.trustLevel ?? 50,
        startChapter: options.startChapter || 0, endChapter: options.endChapter ?? null,
        isSecret: options.isSecret || false, cognitiveOnly: options.cognitiveOnly || false,
        notes: options.notes || '', data: {},
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    };

    await store.setItem('entity-relations', id, relation);
    logger.info('entityCenter', `Created relation: ${fromEntityId} -> ${toEntityId} (${relType}/${relLabel})`);
    await refreshRelationsSummary(fromEntityId);
    await refreshRelationsSummary(toEntityId);
    return relation;
}

async function findRelation(fromEntityId, toEntityId, relType) {
    const all = await store.queryItems('entity-relations', { fromEntityId });
    return all.find(r => r.toEntityId === toEntityId && (!relType || r.relType === relType)) || null;
}

async function updateRelation(relationId, updates) {
    const relation = await store.getItem('entity-relations', relationId);
    if (!relation) return null;
    for (const [key, value] of Object.entries(updates)) {
        if (key === 'id' || key === 'projectId') continue;
        relation[key] = value;
    }
    relation.updatedAt = new Date().toISOString();
    await store.setItem('entity-relations', relationId, relation);
    return relation;
}

async function getRelationsForEntity(entityId) {
    const outgoing = await store.queryItems('entity-relations', { fromEntityId: entityId });
    const incoming = await store.queryItems('entity-relations', { toEntityId: entityId });
    return [...outgoing, ...incoming.filter(r => !outgoing.find(o => o.id === r.id))];
}

async function getRelationsForProject(projectId) {
    return await store.queryItems('entity-relations', { projectId });
}

async function refreshRelationsSummary(entityId) {
    const entity = await store.getItem(ENTITY_TYPE, entityId);
    if (!entity) return;
    const relations = await getRelationsForEntity(entityId);
    const summary = [];
    for (const r of relations) {
        const otherEntityId = r.fromEntityId === entityId ? r.toEntityId : r.fromEntityId;
        const other = await store.getItem(ENTITY_TYPE, otherEntityId);
        summary.push({ entityId: otherEntityId, targetName: other?.name || '', relType: r.relType, relLabel: r.relLabel, strength: r.strength });
    }
    entity.relationsSummary = summary;
    _recomputePromptTexts(entity);
    await store.setItem(ENTITY_TYPE, entityId, entity);
}

async function syncRelationshipFromMaterial(center, projectId, relName, content, chapterNumber) {
    const nameParts = relName.split(/[与和及→←↔\-：:]/);
    if (nameParts.length < 2) return null;

    const fromName = nameParts[0].trim();
    const toName = nameParts[nameParts.length - 1].trim();

    const { findEntityByName } = require('./entityCRUD');
    const fromEntity = await findEntityByName(projectId, 'character', fromName);
    const toEntity = await findEntityByName(projectId, 'character', toName);

    if (!fromEntity || !toEntity) {
        logger.warn('entityCenter', `syncRelationship: cannot find entities for "${fromName}" or "${toName}"`);
        return null;
    }

    const relLabel = relName.includes('：') ? relName.split('：').pop().trim() :
                     relName.includes(':') ? relName.split(':').pop().trim() : content.substring(0, 50);

    let relType = 'other';
    try {
        const genreId = await detectGenreId(projectId);
        const { getGenreRelationTypeKeywords } = require('../../config/genreEntitySchemas');
        const keywords = getGenreRelationTypeKeywords(genreId);
        const text = (relLabel + content).toLowerCase();
        for (const [type, words] of Object.entries(keywords)) {
            if (words.some(w => text.includes(w))) { relType = type; break; }
        }
    } catch (_) { logger.warn('relations', '[entity-relations]', _.message || _); }

    return await addRelation(center, projectId, fromEntity.id, toEntity.id, relType, relLabel, {
        startChapter: chapterNumber || 0, strength: 50, notes: content.substring(0, 200)
    });
}

module.exports = {
    addRelation, findRelation, updateRelation,
    getRelationsForEntity, getRelationsForProject,
    refreshRelationsSummary, syncRelationshipFromMaterial
};
