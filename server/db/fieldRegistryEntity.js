/**
 * fieldRegistryEntity.js — 实体核心表字段定义
 * 包含: entity_registry, entities, character_states, state_kv_index,
 *       character_state_cache, knowledge_facts, knowledge_access
 */
module.exports = {
    entity_registry: {
        storeType: 'entity-registry',
        columns: {
            id: { type: 'text', nullable: false, pk: true },
            projectId: { type: 'text', nullable: false, indexed: true, extractorDefault: '' },
            entityType: { type: 'text', nullable: false, indexed: true, extractorDefault: 'character' },
            name: { type: 'text', nullable: false, indexed: true, extractorDefault: '' },
            briefName: { type: 'text', nullable: false, extractorDefault: '' },
            roleLevel: { type: 'text', nullable: false, indexed: true, extractorDefault: 'npc' },
            isActive: { type: 'boolean', nullable: false, extractorDefault: true, extractorTransform: 'boolNotFalse' },
            firstAppearChapter: { type: 'integer', nullable: true, extractorDefault: null, extractorTransform: 'nullish' },
            lastAppearChapter: { type: 'integer', nullable: true, indexed: true, extractorDefault: null, extractorTransform: 'nullish' },
            appearCount: { type: 'integer', nullable: false, extractorDefault: 0 },
            parentPlane: { type: 'text', nullable: true, extractorDefault: null },
            parentFaction: { type: 'text', nullable: true, extractorDefault: null },
            tags: { type: 'text', nullable: false, extractorDefault: '[]', extractorTransform: 'jsonOrString' },
            description: { type: 'text', nullable: false, extractorDefault: '' },
            data: { type: 'text', nullable: false, noExtract: true },
            createdAt: { type: 'timestamptz', nullable: false, noExtract: true },
            updatedAt: { type: 'timestamptz', nullable: false, noExtract: true }
        }
    },
    entities: {
        storeType: 'entities',
        columns: {
            id: { type: 'text', nullable: false, pk: true },
            projectId: { type: 'text', nullable: false, indexed: true, extractorDefault: '' },
            entityType: { type: 'text', nullable: false, indexed: true, extractorDefault: 'character' },
            name: { type: 'text', nullable: false, indexed: true, extractorDefault: '' },
            briefName: { type: 'text', nullable: false, extractorDefault: '' },
            roleLevel: { type: 'text', nullable: false, indexed: true, extractorDefault: 'npc' },
            genreId: { type: 'text', nullable: true, indexed: true, extractorDefault: '' },
            isActive: { type: 'boolean', nullable: false, extractorDefault: true, extractorTransform: 'boolNotFalse' },
            isLocked: { type: 'boolean', nullable: false, extractorDefault: false, extractorTransform: 'bool' },
            firstAppearChapter: { type: 'integer', nullable: true, extractorDefault: null, extractorTransform: 'nullish' },
            lastAppearChapter: { type: 'integer', nullable: true, extractorDefault: null, extractorTransform: 'nullish' },
            appearCount: { type: 'integer', nullable: false, extractorDefault: 0 },
            parentEntityId: { type: 'text', nullable: true, extractorDefault: null },
            tags: { type: 'text', nullable: false, extractorDefault: '[]', extractorTransform: 'jsonOrString' },
            hp: { type: 'integer', nullable: false, extractorDefault: 100 },
            combatPower: { type: 'integer', nullable: false, extractorDefault: 0 },
            position: { type: 'text', nullable: false, extractorDefault: '' },
            factionName: { type: 'text', nullable: false, extractorDefault: '' },
            personality: { type: 'text', nullable: false, extractorDefault: '' },
            speakingTone: { type: 'text', nullable: false, extractorDefault: '' },
            signatureDetail: { type: 'text', nullable: false, extractorDefault: '' },
            genreState: { type: 'text', nullable: false, extractorDefault: '{}', extractorTransform: 'jsonOrString' },
            profile: { type: 'text', nullable: false, extractorDefault: '{}', extractorTransform: 'jsonOrString' },
            bindsSummary: { type: 'text', nullable: false, extractorDefault: '[]', extractorTransform: 'jsonOrString' },
            relationsSummary: { type: 'text', nullable: false, extractorDefault: '[]', extractorTransform: 'jsonOrString' },
            briefText: { type: 'text', nullable: false, extractorDefault: '' },
            briefTokens: { type: 'integer', nullable: false, extractorDefault: 0 },
            summaryText: { type: 'text', nullable: false, extractorDefault: '' },
            summaryTokens: { type: 'integer', nullable: false, extractorDefault: 0 },
            detailText: { type: 'text', nullable: false, extractorDefault: '' },
            detailTokens: { type: 'integer', nullable: false, extractorDefault: 0 },
            sourceContent: { type: 'text', nullable: false, extractorDefault: '' },
            version: { type: 'integer', nullable: false, extractorDefault: 1 },
            sourceChapter: { type: 'integer', nullable: true, extractorDefault: null },
            archived: { type: 'text', nullable: false, extractorDefault: '' },
            data: { type: 'jsonb', nullable: false, noExtract: true },
            createdAt: { type: 'timestamptz', nullable: false, noExtract: true },
            updatedAt: { type: 'timestamptz', nullable: false, noExtract: true }
        }
    },
    character_states: {
        storeType: 'character-states',
        columns: {
            id: { type: 'text', nullable: false, pk: true },
            projectId: { type: 'text', nullable: false, indexed: true, extractorDefault: '' },
            characterId: { type: 'text', nullable: false, extractorDefault: '' },
            characterName: { type: 'text', nullable: false, extractorDefault: '' },
            chapterNumber: { type: 'integer', nullable: false, extractorDefault: 0 },
            delta: { type: 'text', nullable: false, extractorDefault: '{}', extractorTransform: 'jsonOrString' },
            stateChangedFields: { type: 'text', nullable: false, extractorDefault: '[]', extractorTransform: 'jsonOrString' },
            previousChapterState: { type: 'text', nullable: true, extractorDefault: null },
            data: { type: 'text', nullable: false, noExtract: true },
            createdAt: { type: 'timestamptz', nullable: false, noExtract: true },
            updatedAt: { type: 'timestamptz', nullable: false, noExtract: true }
        }
    },
    state_kv_index: {
        storeType: 'state-kv-index',
        columns: {
            id: { type: 'text', nullable: false, pk: true },
            projectId: { type: 'text', nullable: false, indexed: true, extractorDefault: '' },
            scope: { type: 'text', nullable: false, extractorDefault: '' },
            entityKey: { type: 'text', nullable: false, extractorDefault: '' },
            dataKey: { type: 'text', nullable: false, extractorDefault: '' },
            dataValue: { type: 'text', nullable: false, extractorDefault: '' },
            dataType: { type: 'text', nullable: false, extractorDefault: 'string' },
            chapterUpdated: { type: 'integer', nullable: false, extractorDefault: 0 },
            isHot: { type: 'boolean', nullable: false, extractorDefault: false, extractorTransform: 'bool' },
            data: { type: 'text', nullable: false, noExtract: true },
            createdAt: { type: 'timestamptz', nullable: false, noExtract: true },
            updatedAt: { type: 'timestamptz', nullable: false, noExtract: true }
        }
    },
    character_state_cache: {
        storeType: 'character-state-cache',
        columns: {
            id: { type: 'text', nullable: false, pk: true },
            characterId: { type: 'text', nullable: false, extractorDefault: '' },
            projectId: { type: 'text', nullable: false, indexed: true, extractorDefault: '' },
            chapterNumber: { type: 'integer', nullable: false, extractorDefault: 0 },
            roleLevel: { type: 'text', nullable: false, extractorDefault: 'npc' },
            briefText: { type: 'text', nullable: false, extractorDefault: '' },
            briefTokens: { type: 'integer', nullable: false, extractorDefault: 0 },
            summaryText: { type: 'text', nullable: false, extractorDefault: '' },
            summaryTokens: { type: 'integer', nullable: false, extractorDefault: 0 },
            detailText: { type: 'text', nullable: false, extractorDefault: '' },
            detailTokens: { type: 'integer', nullable: false, extractorDefault: 0 },
            stateJson: { type: 'text', nullable: false, extractorDefault: '{}', extractorTransform: 'jsonOrString' },
            bindsJson: { type: 'text', nullable: false, extractorDefault: '[]', extractorTransform: 'jsonOrString' },
            relationsJson: { type: 'text', nullable: false, extractorDefault: '[]', extractorTransform: 'jsonOrString' },
            deltaJson: { type: 'text', nullable: false, extractorDefault: '{}', extractorTransform: 'jsonOrString' },
            changedFields: { type: 'text', nullable: false, extractorDefault: '[]', extractorTransform: 'jsonOrString' },
            isValid: { type: 'boolean', nullable: false, extractorDefault: true, extractorTransform: 'boolNotFalse' },
            computedAt: { type: 'timestamptz', nullable: false, extractorDefault: null, extractorTransform: 'timestamp' },
            data: { type: 'text', nullable: false, noExtract: true },
            createdAt: { type: 'timestamptz', nullable: false, noExtract: true },
            updatedAt: { type: 'timestamptz', nullable: false, noExtract: true }
        }
    },
    knowledge_facts: {
        storeType: 'knowledge-facts',
        columns: {
            id: { type: 'text', nullable: false, pk: true },
            projectId: { type: 'text', nullable: false, indexed: true, extractorDefault: '' },
            level: { type: 'text', nullable: false, indexed: true, extractorDefault: 'M2' },
            category: { type: 'text', nullable: false, indexed: true, extractorDefault: 'plot' },
            entityId: { type: 'text', nullable: true, indexed: true, extractorDefault: null },
            chapterNumber: { type: 'integer', nullable: false, indexed: true, extractorDefault: 0 },
            factText: { type: 'text', nullable: false, extractorDefault: '' },
            importance: { type: 'integer', nullable: false, extractorDefault: 50 },
            accessCount: { type: 'integer', nullable: false, extractorDefault: 0 },
            lastAccessedChapter: { type: 'integer', nullable: false, extractorDefault: 0 },
            decayScore: { type: 'real', nullable: false, indexed: true, extractorDefault: 1.0, extractorTransform: 'nullish' },
            expiresAtChapter: { type: 'integer', nullable: true, extractorDefault: null, extractorTransform: 'nullish' },
            data: { type: 'jsonb', nullable: false, noExtract: true },
            createdAt: { type: 'timestamptz', nullable: false, noExtract: true },
            updatedAt: { type: 'timestamptz', nullable: false, noExtract: true }
        }
    },
    knowledge_access: {
        storeType: 'knowledge-access',
        columns: {
            id: { type: 'text', nullable: false, pk: true },
            projectId: { type: 'text', nullable: false, indexed: true, extractorDefault: '' },
            factId: { type: 'text', nullable: false, indexed: true, extractorDefault: '' },
            entityId: { type: 'text', nullable: false, indexed: true, extractorDefault: '' },
            factText: { type: 'text', nullable: false, extractorDefault: '' },
            confidence: { type: 'text', nullable: false, extractorDefault: 'certain' },
            sourceHow: { type: 'text', nullable: false, extractorDefault: '' },
            sinceChapter: { type: 'integer', nullable: false, extractorDefault: 0 },
            notes: { type: 'text', nullable: false, extractorDefault: '' },
            data: { type: 'jsonb', nullable: false, noExtract: true },
            createdAt: { type: 'timestamptz', nullable: false, noExtract: true },
            updatedAt: { type: 'timestamptz', nullable: false, noExtract: true }
        }
    }
};
