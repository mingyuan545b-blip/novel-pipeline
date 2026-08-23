/**
 * fieldRegistryRelation.js — 实体关系/绑定/历史/工艺表字段定义
 * 与PG schema(knowledgeSchemaEntity.js + knowledgeSchemaFacts.js)完全对齐
 */
module.exports = {
    entity_relations: {
        storeType: 'entity-relations',
        columns: {
            id: { type: 'text', nullable: false, pk: true },
            projectId: { type: 'text', nullable: false, indexed: true, extractorDefault: '' },
            fromEntityId: { type: 'text', nullable: false, indexed: true, extractorDefault: '' },
            toEntityId: { type: 'text', nullable: false, indexed: true, extractorDefault: '' },
            relType: { type: 'text', nullable: false, indexed: true, extractorDefault: '' },
            relLabel: { type: 'text', nullable: false, extractorDefault: '' },
            strength: { type: 'integer', nullable: false, extractorDefault: 50 },
            trustLevel: { type: 'integer', nullable: false, extractorDefault: 50 },
            startChapter: { type: 'integer', nullable: false, indexed: true, extractorDefault: 0 },
            endChapter: { type: 'integer', nullable: true, extractorDefault: null },
            isSecret: { type: 'boolean', nullable: false, extractorDefault: false, extractorTransform: 'bool' },
            cognitiveOnly: { type: 'boolean', nullable: false, extractorDefault: false, extractorTransform: 'bool' },
            notes: { type: 'text', nullable: false, extractorDefault: '' },
            data: { type: 'jsonb', nullable: false, noExtract: true },
            createdAt: { type: 'timestamptz', nullable: false, noExtract: true },
            updatedAt: { type: 'timestamptz', nullable: false, noExtract: true }
        }
    },
    entity_binds: {
        storeType: 'entity-binds',
        columns: {
            id: { type: 'text', nullable: false, pk: true },
            projectId: { type: 'text', nullable: false, indexed: true, extractorDefault: '' },
            entityId: { type: 'text', nullable: false, indexed: true, extractorDefault: '' },
            targetEntityId: { type: 'text', nullable: false, indexed: true, extractorDefault: '' },
            bindType: { type: 'text', nullable: false, extractorDefault: '' },
            bindStatus: { type: 'text', nullable: false, extractorDefault: 'active' },
            permanence: { type: 'text', nullable: false, extractorDefault: 'semi-permanent' },
            acquiredChapter: { type: 'integer', nullable: false, extractorDefault: 0 },
            lostChapter: { type: 'integer', nullable: true, extractorDefault: null },
            masteryLevel: { type: 'text', nullable: false, extractorDefault: '' },
            masteryProgress: { type: 'integer', nullable: false, extractorDefault: 0 },
            personalNotes: { type: 'text', nullable: false, extractorDefault: '' },
            customName: { type: 'text', nullable: false, extractorDefault: '' },
            slotPosition: { type: 'text', nullable: false, extractorDefault: '' },
            bindOrder: { type: 'integer', nullable: false, extractorDefault: 0 },
            data: { type: 'jsonb', nullable: false, noExtract: true },
            createdAt: { type: 'timestamptz', nullable: false, noExtract: true },
            updatedAt: { type: 'timestamptz', nullable: false, noExtract: true }
        }
    },
    entity_state_history: {
        storeType: 'entity-state-history',
        columns: {
            id: { type: 'text', nullable: false, pk: true },
            entityId: { type: 'text', nullable: false, indexed: true, extractorDefault: '' },
            projectId: { type: 'text', nullable: false, indexed: true, extractorDefault: '' },
            chapterNumber: { type: 'integer', nullable: false, indexed: true, extractorDefault: 0 },
            baseState: { type: 'jsonb', nullable: false, extractorDefault: '{}', extractorTransform: 'jsonOrString' },
            genreState: { type: 'jsonb', nullable: false, extractorDefault: '{}', extractorTransform: 'jsonOrString' },
            delta: { type: 'jsonb', nullable: false, extractorDefault: '{}', extractorTransform: 'jsonOrString' },
            changedFields: { type: 'jsonb', nullable: false, extractorDefault: '[]', extractorTransform: 'jsonOrString' },
            bindsSnapshot: { type: 'jsonb', nullable: false, extractorDefault: '[]', extractorTransform: 'jsonOrString' },
            relationsSnapshot: { type: 'jsonb', nullable: false, extractorDefault: '[]', extractorTransform: 'jsonOrString' },
            briefText: { type: 'text', nullable: false, extractorDefault: '' },
            summaryText: { type: 'text', nullable: false, extractorDefault: '' },
            detailText: { type: 'text', nullable: false, extractorDefault: '' },
            isValid: { type: 'boolean', nullable: false, indexed: true, extractorDefault: true, extractorTransform: 'boolNotFalse' },
            computedAt: { type: 'timestamptz', nullable: false, extractorDefault: null, extractorTransform: 'timestamp' },
            data: { type: 'jsonb', nullable: false, noExtract: true },
            createdAt: { type: 'timestamptz', nullable: false, noExtract: true },
            updatedAt: { type: 'timestamptz', nullable: false, noExtract: true }
        }
    },
    craft_materials: {
        storeType: 'craft-materials',
        columns: {
            id: { type: 'text', nullable: false, pk: true },
            projectId: { type: 'text', nullable: false, indexed: true, extractorDefault: '' },
            craftType: { type: 'text', nullable: false, indexed: true, extractorDefault: '' },
            name: { type: 'text', nullable: false, indexed: true, extractorDefault: '' },
            content: { type: 'text', nullable: false, extractorDefault: '' },
            archived: { type: 'text', nullable: false, extractorDefault: '' },
            tags: { type: 'jsonb', nullable: false, extractorDefault: '[]', extractorTransform: 'jsonOrString' },
            metadata: { type: 'jsonb', nullable: false, extractorDefault: '{}', extractorTransform: 'jsonOrString' },
            data: { type: 'jsonb', nullable: false, noExtract: true },
            createdAt: { type: 'timestamptz', nullable: false, noExtract: true },
            updatedAt: { type: 'timestamptz', nullable: false, noExtract: true }
        }
    }
};
