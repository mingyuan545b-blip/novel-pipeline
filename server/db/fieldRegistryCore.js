/**
 * fieldRegistryCore.js — 核心表字段定义
 * 包含: materials, chapters, projects, api_keys, agent_bindings,
 *       reviews, pipeline_logs, infinite_pipeline_state, quests, timelines, kv_store
 */
module.exports = {
    materials: {
        storeType: 'materials',
        columns: {
            id: { type: 'text', nullable: false, pk: true },
            projectId: { type: 'text', nullable: false, indexed: true, extractorDefault: '' },
            type: { type: 'text', nullable: false, indexed: true, extractorDefault: 'other' },
            name: { type: 'text', nullable: false, indexed: true, extractorDefault: '' },
            parentPlane: { type: 'text', nullable: true, indexed: true, extractorDefault: null },
            parentFaction: { type: 'text', nullable: true, indexed: true, extractorDefault: null },
            archived: { type: 'boolean', nullable: false, indexed: true, extractorDefault: false, extractorTransform: 'bool' },
            dialectRegion: { type: 'text', nullable: true, extractorDefault: null },
            dialectIntensity: { type: 'text', nullable: false, extractorDefault: 'medium' },
            speechStyle: { type: 'text', nullable: true, extractorDefault: null },
            speechStyleIntensity: { type: 'text', nullable: false, extractorDefault: 'medium' },
            namingStyle: { type: 'text', nullable: true, extractorDefault: null },
            namingStyleIntensity: { type: 'text', nullable: false, extractorDefault: 'medium' },
            archetype: { type: 'text', nullable: true, extractorDefault: null },
            currentPlaneId: { type: 'text', nullable: true, extractorDefault: null },
            isLocked: { type: 'boolean', nullable: false, extractorDefault: false, extractorTransform: 'bool' },
            version: { type: 'integer', nullable: false, extractorDefault: 1 },
            sourceChapter: { type: 'integer', nullable: true, extractorDefault: null },
            roleLevel: { type: 'text', nullable: true, indexed: true, extractorDefault: null },
            lastAppearChapter: { type: 'integer', nullable: true, indexed: true, extractorDefault: null },
            currentStatus: { type: 'text', nullable: true, indexed: true, extractorDefault: null },
            data: { type: 'text', nullable: false, noExtract: true },
            createdAt: { type: 'timestamptz', nullable: false, noExtract: true },
            updatedAt: { type: 'timestamptz', nullable: false, noExtract: true }
        }
    },
    chapters: {
        storeType: 'chapters',
        columns: {
            id: { type: 'text', nullable: false, pk: true },
            projectId: { type: 'text', nullable: false, indexed: true, extractorDefault: '' },
            chapterNumber: { type: 'integer', nullable: false, extractorDefault: 0 },
            status: { type: 'text', nullable: false, extractorDefault: 'outlined' },
            title: { type: 'text', nullable: false, extractorDefault: '' },
            wordCount: { type: 'integer', nullable: false, extractorDefault: 0 },
            round: { type: 'integer', nullable: false, extractorDefault: 0 },
            data: { type: 'text', nullable: false, noExtract: true },
            createdAt: { type: 'timestamptz', nullable: false, noExtract: true },
            updatedAt: { type: 'timestamptz', nullable: false, noExtract: true }
        }
    },
    projects: {
        storeType: 'projects',
        columns: {
            id: { type: 'text', nullable: false, pk: true },
            mode: { type: 'text', nullable: false, extractorDefault: 'novel' },
            targetChapterCount: { type: 'integer', nullable: true, extractorDefault: null, extractorSource: 'targetChapters' },
            targetWordCount: { type: 'integer', nullable: true, extractorDefault: null },
            data: { type: 'text', nullable: false, noExtract: true },
            createdAt: { type: 'timestamptz', nullable: false, noExtract: true },
            updatedAt: { type: 'timestamptz', nullable: false, noExtract: true }
        }
    },
    api_keys: {
        storeType: 'api-keys',
        columns: {
            id: { type: 'text', nullable: false, pk: true },
            apiKey: { type: 'text', nullable: false, extractorDefault: '' },
            groupId: { type: 'text', nullable: false, extractorDefault: '' },
            model: { type: 'text', nullable: false, extractorDefault: '' },
            provider: { type: 'text', nullable: false, indexed: true, extractorDefault: '' },
            baseURL: { type: 'text', nullable: false, extractorDefault: '' },
            name: { type: 'text', nullable: false, extractorDefault: '' },
            _encrypted: { type: 'boolean', nullable: false, extractorDefault: false, extractorTransform: 'bool' },
            data: { type: 'text', nullable: false, noExtract: true },
            createdAt: { type: 'timestamptz', nullable: false, noExtract: true },
            updatedAt: { type: 'timestamptz', nullable: false, noExtract: true }
        }
    },
    agent_bindings: {
        storeType: 'agent-bindings',
        columns: {
            id: { type: 'text', nullable: false, pk: true },
            agentType: { type: 'text', nullable: false, indexed: true, extractorDefault: '' },
            keyId: { type: 'text', nullable: false, indexed: true, extractorDefault: '' },
            data: { type: 'text', nullable: false, noExtract: true },
            createdAt: { type: 'timestamptz', nullable: false, noExtract: true },
            updatedAt: { type: 'timestamptz', nullable: false, noExtract: true }
        }
    },
    reviews: {
        storeType: 'reviews',
        columns: {
            id: { type: 'text', nullable: false, pk: true },
            chapterId: { type: 'text', nullable: false, indexed: true, extractorDefault: '' },
            projectId: { type: 'text', nullable: false, indexed: true, extractorDefault: '' },
            reviewType: { type: 'text', nullable: false, indexed: true, extractorDefault: 'first-review' },
            passed: { type: 'boolean', nullable: false, extractorDefault: false, extractorTransform: 'bool' },
            data: { type: 'text', nullable: false, noExtract: true },
            createdAt: { type: 'timestamptz', nullable: false, noExtract: true },
            updatedAt: { type: 'timestamptz', nullable: false, noExtract: true }
        }
    },
    pipeline_logs: {
        storeType: 'pipeline-logs',
        columns: {
            id: { type: 'text', nullable: false, pk: true },
            projectId: { type: 'text', nullable: false, indexed: true, extractorDefault: '' },
            chapterId: { type: 'text', nullable: true, indexed: true, extractorDefault: null },
            step: { type: 'text', nullable: true, extractorDefault: null },
            status: { type: 'text', nullable: false, extractorDefault: 'running' },
            round: { type: 'integer', nullable: false, extractorDefault: 0 },
            data: { type: 'text', nullable: false, noExtract: true },
            createdAt: { type: 'timestamptz', nullable: false, noExtract: true },
            updatedAt: { type: 'timestamptz', nullable: false, noExtract: true }
        }
    },
    infinite_pipeline_state: {
        storeType: 'infinite-pipeline-state',
        columns: {
            id: { type: 'text', nullable: false, pk: true },
            projectId: { type: 'text', nullable: false, indexed: true, extractorDefault: '' },
            running: { type: 'boolean', nullable: false, extractorDefault: false, extractorTransform: 'bool' },
            phase: { type: 'text', nullable: true, extractorDefault: null },
            data: { type: 'text', nullable: false, noExtract: true },
            createdAt: { type: 'timestamptz', nullable: false, noExtract: true },
            updatedAt: { type: 'timestamptz', nullable: false, noExtract: true }
        }
    },
    quests: {
        storeType: 'quests',
        columns: {
            id: { type: 'text', nullable: false, pk: true },
            projectId: { type: 'text', nullable: false, indexed: true, extractorDefault: '' },
            parentId: { type: 'text', nullable: true, indexed: true, extractorDefault: null },
            status: { type: 'text', nullable: false, indexed: true, extractorDefault: 'planned' },
            priority: { type: 'text', nullable: false, extractorDefault: 'normal' },
            data: { type: 'text', nullable: false, noExtract: true },
            createdAt: { type: 'timestamptz', nullable: false, noExtract: true },
            updatedAt: { type: 'timestamptz', nullable: false, noExtract: true }
        }
    },
    timelines: {
        storeType: 'timelines',
        columns: {
            id: { type: 'text', nullable: false, pk: true },
            projectId: { type: 'text', nullable: false, indexed: true, extractorDefault: '' },
            eventType: { type: 'text', nullable: false, indexed: true, extractorDefault: 'plot' },
            importance: { type: 'text', nullable: false, extractorDefault: 'normal' },
            isKeyEvent: { type: 'boolean', nullable: false, extractorDefault: false, extractorTransform: 'bool' },
            data: { type: 'text', nullable: false, noExtract: true },
            createdAt: { type: 'timestamptz', nullable: false, noExtract: true },
            updatedAt: { type: 'timestamptz', nullable: false, noExtract: true }
        }
    }
};
