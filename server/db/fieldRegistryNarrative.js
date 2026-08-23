/**
 * fieldRegistryNarrative.js — 叙事/时间线/伏笔/一致性表字段定义
 * 与PG schema(knowledgeSchemaFacts.js)完全对齐
 */
module.exports = {
    foreshadow_ledger: {
        storeType: 'foreshadow-ledger',
        columns: {
            id: { type: 'text', nullable: false, pk: true },
            projectId: { type: 'text', nullable: false, indexed: true, extractorDefault: '' },
            name: { type: 'text', nullable: false, extractorDefault: '' },
            description: { type: 'text', nullable: false, extractorDefault: '' },
            status: { type: 'text', nullable: false, indexed: true, extractorDefault: 'planted' },
            plantChapter: { type: 'integer', nullable: false, indexed: true, extractorDefault: 0 },
            lastAdvanceChapter: { type: 'integer', nullable: false, extractorDefault: 0 },
            resolveChapter: { type: 'integer', nullable: true, extractorDefault: null },
            expectedResolveWindow: { type: 'text', nullable: false, extractorDefault: '' },
            importance: { type: 'text', nullable: false, indexed: true, extractorDefault: 'normal' },
            relatedEntityIds: { type: 'jsonb', nullable: false, extractorDefault: '[]', extractorTransform: 'jsonOrString' },
            relatedPlotThreads: { type: 'jsonb', nullable: false, extractorDefault: '[]', extractorTransform: 'jsonOrString' },
            advanceLog: { type: 'jsonb', nullable: false, extractorDefault: '[]', extractorTransform: 'jsonOrString' },
            resolutionNotes: { type: 'text', nullable: false, extractorDefault: '' },
            data: { type: 'jsonb', nullable: false, noExtract: true },
            createdAt: { type: 'timestamptz', nullable: false, noExtract: true },
            updatedAt: { type: 'timestamptz', nullable: false, noExtract: true }
        }
    },
    timeline: {
        storeType: 'timeline-events',
        columns: {
            id: { type: 'text', nullable: false, pk: true },
            projectId: { type: 'text', nullable: false, indexed: true, extractorDefault: '' },
            chapterNumber: { type: 'integer', nullable: false, indexed: true, extractorDefault: 0 },
            eventTime: { type: 'text', nullable: false, indexed: true, extractorDefault: '' },
            eventType: { type: 'text', nullable: false, indexed: true, extractorDefault: 'event' },
            actorIds: { type: 'jsonb', nullable: false, extractorDefault: '[]', extractorTransform: 'jsonOrString' },
            locationId: { type: 'text', nullable: false, extractorDefault: '' },
            description: { type: 'text', nullable: false, extractorDefault: '' },
            precedingEventIds: { type: 'jsonb', nullable: false, extractorDefault: '[]', extractorTransform: 'jsonOrString' },
            duration: { type: 'text', nullable: false, extractorDefault: '' },
            significance: { type: 'text', nullable: false, extractorDefault: 'normal' },
            data: { type: 'jsonb', nullable: false, noExtract: true },
            createdAt: { type: 'timestamptz', nullable: false, noExtract: true },
            updatedAt: { type: 'timestamptz', nullable: false, noExtract: true }
        }
    },
    narrative_state: {
        storeType: 'narrative-state',
        columns: {
            id: { type: 'text', nullable: false, pk: true },
            projectId: { type: 'text', nullable: false, indexed: true, extractorDefault: '' },
            chapterNumber: { type: 'integer', nullable: false, extractorDefault: 0 },
            phase: { type: 'text', nullable: false, indexed: true, extractorDefault: 'setup' },
            tension: { type: 'integer', nullable: false, extractorDefault: 50 },
            pacing: { type: 'text', nullable: false, extractorDefault: 'moderate' },
            activePlotThreads: { type: 'jsonb', nullable: false, extractorDefault: '[]', extractorTransform: 'jsonOrString' },
            completedPlotThreads: { type: 'jsonb', nullable: false, extractorDefault: '[]', extractorTransform: 'jsonOrString' },
            milestone: { type: 'text', nullable: false, extractorDefault: '' },
            emotionalArc: { type: 'jsonb', nullable: false, extractorDefault: '{}', extractorTransform: 'jsonOrString' },
            readerExpectation: { type: 'jsonb', nullable: false, extractorDefault: '{}', extractorTransform: 'jsonOrString' },
            notes: { type: 'text', nullable: false, extractorDefault: '' },
            data: { type: 'jsonb', nullable: false, noExtract: true },
            createdAt: { type: 'timestamptz', nullable: false, noExtract: true },
            updatedAt: { type: 'timestamptz', nullable: false, noExtract: true }
        }
    },
    consistency_checks: {
        storeType: 'consistency-checks',
        columns: {
            id: { type: 'text', nullable: false, pk: true },
            projectId: { type: 'text', nullable: false, indexed: true, extractorDefault: '' },
            chapterNumber: { type: 'integer', nullable: false, indexed: true, extractorDefault: 0 },
            checkType: { type: 'text', nullable: false, extractorDefault: 'name' },
            severity: { type: 'text', nullable: false, indexed: true, extractorDefault: 'warning' },
            entityId: { type: 'text', nullable: true, extractorDefault: null },
            description: { type: 'text', nullable: false, extractorDefault: '' },
            expectedValue: { type: 'text', nullable: false, extractorDefault: '' },
            actualValue: { type: 'text', nullable: false, extractorDefault: '' },
            isResolved: { type: 'boolean', nullable: false, indexed: true, extractorDefault: false, extractorTransform: 'bool' },
            resolvedChapter: { type: 'integer', nullable: true, extractorDefault: null },
            data: { type: 'jsonb', nullable: false, noExtract: true },
            createdAt: { type: 'timestamptz', nullable: false, noExtract: true },
            updatedAt: { type: 'timestamptz', nullable: false, noExtract: true }
        }
    },
    memory_layers: {
        storeType: 'memory-layers',
        columns: {
            id: { type: 'text', nullable: false, pk: true },
            projectId: { type: 'text', nullable: false, indexed: true, extractorDefault: '' },
            layer: { type: 'text', nullable: false, indexed: true, extractorDefault: 'M0' },
            data: { type: 'jsonb', nullable: false, noExtract: true },
            createdAt: { type: 'timestamptz', nullable: false, noExtract: true },
            updatedAt: { type: 'timestamptz', nullable: false, noExtract: true }
        }
    }
};
