/**
 * T1 验收（端到端）：素材管理失败 → 显式标记 → L2 兜底真的接管
 *
 * 验收标准：
 *  1. 不可解析输出 → handleMaterialManager **抛错**（errorCode=MATERIAL_MANAGER_OUTPUT_UNPARSABLE）
 *  2. 失败时：章节 materialManagerFailed=true / status 保持 approved（**不得** material-updated）
 *  3. 失败时：**不得** markChapterProcessed（不伪装"本章素材已处理"）
 *  4. 失败时：**不得** syncKnowledgeBase（不往知识库写半成品）
 *  5. 该章节状态 → materialGate 判定为"缺口"，拦截下一章开工
 *  6. 该章节 → catchupMaterialManager 选中补跑（L2 接管）
 *  7. 成功但空更新（合法）→ 不得误判失败
 */
jest.mock('../../server/store', () => ({
    getItem: jest.fn(), setItem: jest.fn(), queryItems: jest.fn().mockResolvedValue([]),
}));
jest.mock('../../server/shared/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));
jest.mock('../../server/services/pipeline/steps/materialLifecycle', () => ({
    getMaterialLifecycle: jest.fn(), getCurrentVolumeSubplaneId: jest.fn().mockResolvedValue(null),
    cleanChapterMaterials: jest.fn(), getActiveMaterials: jest.fn(() => []),
    getMaterialSummary: jest.fn(() => ({ summary: '空', totalCount: 0 })),
    getArchiveHints: jest.fn(() => ''), getLockedEntities: jest.fn(() => ({ lockedSubplaneIds: [], lockedFactionIds: [] })),
    getDynamicMaxMaterials: jest.fn(() => 30),
}));
jest.mock('../../server/services/pipeline/steps/materialArchive', () => ({
    autoArchiveStaleMaterials: jest.fn().mockResolvedValue([]), autoArchiveForExpansion: jest.fn().mockResolvedValue([]),
}));
jest.mock('../../server/services/pipeline/steps/materialPromptBuilder', () => ({ buildMaterialManagerPrompt: jest.fn().mockResolvedValue('prompt') }));
jest.mock('../../server/services/pipeline/steps/materialUpdateProcessor', () => ({
    FIELD_TRANSLATIONS: {}, processUpdates: jest.fn().mockResolvedValue([]),
}));
jest.mock('../../server/services/pipeline/steps/materialPostProcessor', () => ({
    syncForeshadowHooks: jest.fn(), updateChapterStatus: jest.fn((ch) => { ch.status = 'material-updated'; }),
    saveChapter: jest.fn().mockResolvedValue(), extractTimelineAndForeshadow: jest.fn().mockResolvedValue(),
    rebuildIndexes: jest.fn(),
}));
jest.mock('../../server/services/characterStateCache', () => ({ invalidateForProject: jest.fn() }));
jest.mock('../../server/services/websocket', () => ({ broadcastToProject: jest.fn() }));
jest.mock('../../server/services/dataContext', () => ({
    getDataContext: jest.fn().mockResolvedValue({ getProject: jest.fn().mockResolvedValue({ id: 'p1', styleProfile: {} }) }),
    resetDataContext: jest.fn(),
}));
jest.mock('../../server/services/stateKVIndex', () => ({ markChapterProcessed: jest.fn().mockResolvedValue() }));
jest.mock('../../server/services/pipeline/knowledgeSyncService', () => ({ syncKnowledgeBase: jest.fn().mockResolvedValue() }));

const store = require('../../server/store');
const stateKVIndex = require('../../server/services/stateKVIndex');
const { syncKnowledgeBase } = require('../../server/services/pipeline/knowledgeSyncService');
const { saveChapter } = require('../../server/services/pipeline/steps/materialPostProcessor');
const { handleMaterialManager } = require('../../server/services/pipeline/steps/materialManager');
const { UNPARSABLE_CODE } = require('../../server/services/pipeline/steps/materialUpdateApplier');
const { evaluateGate } = require('../../server/services/pipeline/materialGate');
const { catchupMaterialManager } = require('../../server/services/pipeline/materialManagerCatchup');

const runParams = (response) => ({
    projectId: 'p1',
    chapter: { id: 'ch-7', chapterNumber: 7, status: 'approved', content: '正文正文正文' },
    materials: [],
    agentContext: {},
    context: {},
    runAgent: jest.fn().mockResolvedValue({ response }),
    saveAgentOutput: jest.fn(),
});

beforeEach(() => jest.clearAllMocks());

describe('T1 失败显式化（handleMaterialManager）', () => {
    test('1+2+3+4. 不可解析 → 抛错 + 打失败标记 + 不写 processed/知识库', async () => {
        const params = runParams('模型没按格式输出，这不是 JSON 也没有 markdown 结构');
        await expect(handleMaterialManager(params)).rejects.toMatchObject({ code: UNPARSABLE_CODE });

        expect(params.chapter.materialManagerFailed).toBe(true);
        expect(params.chapter.materialManagerError).toBeTruthy();
        expect(params.chapter.status).toBe('approved');       // 绝不是 material-updated
        expect(stateKVIndex.markChapterProcessed).not.toHaveBeenCalled();
        expect(syncKnowledgeBase).not.toHaveBeenCalled();
        expect(saveChapter).toHaveBeenCalled();
        expect(saveChapter.mock.calls[0][0].materialManagerFailed).toBe(true);
    });

    test('T3. 不合规条目被丢弃 → 必须留在章节上可见（materialManagerDroppedUpdates）', async () => {
        const params = runParams(JSON.stringify({ updates: [
            { type: 'equipment', name: '断刃', action: 'create', content: '合规' },
            { type: '不存在的类型', name: '坏条目', action: '新增', content: '' },
        ] }));
        await handleMaterialManager(params);
        expect(params.chapter.materialManagerDroppedUpdates).toBe(1);
        expect(params.chapter.materialManagerInvalidCodes).toContain('MS-BAD-TYPE');
        // 合规的那条仍然被处理（不因一条坏就整章作废）
        expect(params.chapter.materialManagerFailed).toBeUndefined();
    });

    test('7. 合法空更新 → 不抛错，照常完成', async () => {
        const params = runParams('{"updates":[],"archiveLog":[]}');
        await expect(handleMaterialManager(params)).resolves.toMatchObject({ passed: true });
        expect(params.chapter.materialManagerFailed).toBeUndefined();
        expect(stateKVIndex.markChapterProcessed).toHaveBeenCalled();
    });
});

describe('T1 L2 兜底真的接管', () => {
    test('5. 失败章 → materialGate 判定为缺口，拦截第8章开工', () => {
        const chapters = [
            { id: 'ch-7', chapterNumber: 7, status: 'approved', materialManagerFailed: true, _matManagerRetries: 0 },
            { id: 'ch-8', chapterNumber: 8, status: 'outlined' },
        ];
        const gate = evaluateGate(chapters, 8);
        expect(gate.ready).toBe(false);
        expect(gate.blockedBy.map(g => g.chapterNumber)).toEqual([7]);
        expect(gate.report).toContain('第7章素材未归档');
    });

    test('6. 失败章 → catchupMaterialManager 选中它补跑', async () => {
        const chapters = [
            { id: 'ch-7', chapterNumber: 7, status: 'approved', materialManagerFailed: true, materialManagerOutput: null },
            { id: 'ch-3', chapterNumber: 3, status: 'material-updated', materialManagerOutput: '{}' },
        ];
        const runPipelineStep = jest.fn().mockResolvedValue({ feedback: { summary: '素材管理完成: 创建 1 项' } });
        await catchupMaterialManager('p1', chapters, runPipelineStep, {});

        expect(runPipelineStep).toHaveBeenCalledTimes(1);
        expect(runPipelineStep.mock.calls[0][2]).toBe('material-manager');   // 步名
        const saved = store.setItem.mock.calls.find(c => c[1] === 'ch-7')[2];
        expect(saved.materialManagerFailed).toBe(false);
        expect(saved.status).toBe('material-updated');
    });
});
