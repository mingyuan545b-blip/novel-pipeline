/**
 * T5 验收：零成本预判 + 正文压缩（省 token，且绝不误杀）
 *
 * 验收标准（硬断言）：
 *  1. 真·过渡章（短正文、无触发词、未碰任何已有素材）→ needsLLM=false（可跳过，省 1 次调用）
 *  2. **任何**变化信号命中 → needsLLM=true：退场/伏笔回收/获得/晋升/结盟/首次登场/损毁
 *  3. 命中已有素材名 → needsLLM=true（哪怕没有触发词）
 *  4. 长正文 + 零信号 → needsLLM=true（安全默认：不敢确信"没变化"）
 *  5. 压缩率可量化：压缩后正文显著短于原文，且**含信号的句子必须留**
 *  6. 压缩后为空 → 返回 null（调用方必须回退全文，不允许拿空摘要糊弄模型）
 *  7. 跳过路径的端到端：开关开启且无信号 → **runAgent 一次都不能被调用**
 */
jest.mock('../../server/store', () => ({ getItem: jest.fn(), setItem: jest.fn(), queryItems: jest.fn().mockResolvedValue([]) }));
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
jest.mock('../../server/services/pipeline/steps/materialUpdateProcessor', () => ({ FIELD_TRANSLATIONS: {}, processUpdates: jest.fn().mockResolvedValue([]) }));
jest.mock('../../server/services/characterStateCache', () => ({ invalidateForProject: jest.fn() }));
jest.mock('../../server/services/websocket', () => ({ broadcastToProject: jest.fn() }));
jest.mock('../../server/services/stateKVIndex', () => ({ markChapterProcessed: jest.fn().mockResolvedValue() }));
// dataContext 必须在模块级 mock（materialManager 在 require 时就解构了 getDataContext，
// 事后 spyOn 是空转 —— 这个坑正是由"开关必须真的生效"这条验收断言抓出来的）
const mockProjectHolder = { current: { id: 'p1', styleProfile: {}, features: {} } };
jest.mock('../../server/services/dataContext', () => ({
    getDataContext: jest.fn(async () => ({ getProject: async () => mockProjectHolder.current })),
    resetDataContext: jest.fn(),
}));

const { precheckChangeSignals, buildChangeDigest } = require('../../server/services/pipeline/steps/materialChangePrecheck');
const { handleMaterialManager } = require('../../server/services/pipeline/steps/materialManager');
const { updateChapterStatus } = require('../../server/services/pipeline/steps/materialPostProcessor');

const MATERIALS = [
    { id: 'm1', projectId: 'p1', type: 'character', name: '沈砚', archived: false },
    { id: 'm2', projectId: 'p1', type: 'foreshadowing', name: '白色飞鸟', archived: false },
];

const plainChapter = '他走进院子。风吹过树梢。天色渐渐暗了下来。远处传来几声鸟叫。他坐了下来，拿起茶杯。';

describe('T5-1~4 预判：宁可漏判不可误杀', () => {
    test('1. 真·过渡章 → 可以跳过（needsLLM=false）', () => {
        const r = precheckChangeSignals(plainChapter, MATERIALS);
        expect(r.needsLLM).toBe(false);
        expect(r.reasons).toEqual([]);
    });

    test('2. 各类变化信号全部命中 → 必须走 LLM', () => {
        const cases = {
            '退场': '老陈死了。',
            '伏笔回收': '那件事终于真相大白。',
            '获得物': '他在废墟里捡到一枚铜牌。',
            '晋升': '他一举突破到筑基期。',
            '结盟': '两人于是结盟。',
            '首次登场': '一个陌生女子首次登场。',
            '损毁': '那把剑当场折断。',
        };
        for (const [label, text] of Object.entries(cases)) {
            const r = precheckChangeSignals(text, MATERIALS);
            expect([label, r.needsLLM]).toEqual([label, true]);
        }
    });

    test('3. 命中已有素材名 → 必须走 LLM（哪怕没有任何触发词）', () => {
        const r = precheckChangeSignals('沈砚抬头看了一眼。天亮了。', MATERIALS);
        expect(r.needsLLM).toBe(true);
        expect(r.hitMaterials).toContain('沈砚');
    });

    test('4. 长正文 + 零信号 → 必须走 LLM（不敢确信没变化）', () => {
        const long = '这是一个很长的段落，用来把正文撑到阈值以上。'.repeat(60);
        expect(long.length).toBeGreaterThan(1200);
        const r = precheckChangeSignals(long, MATERIALS);
        expect(r.needsLLM).toBe(true);
        expect(r.reasons.join()).toContain('无法确信');
    });

    test('4b. 空素材库 + 短正文 + 零信号 → 跳过', () => {
        expect(precheckChangeSignals(plainChapter, []).needsLLM).toBe(false);
    });
});

describe('T5-5/6 正文压缩', () => {
    test('5. 压缩率可量化，且含信号句必须保留', () => {
        const long = '无关的风景描写。'.repeat(120) + '老陈死了。' + '又一段无关的描写。'.repeat(60);
        const d = buildChangeDigest(long, MATERIALS);
        expect(d).not.toBeNull();
        expect(d.text).toContain('老陈死了');
        expect(d.kept).toBeLessThan(d.total);
        expect(d.text.length).toBeLessThan(long.length * 0.5);   // 至少压掉一半
    });

    test('5b. 命中素材名的段落也必须保留', () => {
        const long = '无内容。'.repeat(100) + '沈砚站在桥头，一言不发。' + '无内容。'.repeat(100);
        const d = buildChangeDigest(long, MATERIALS);
        expect(d.text).toContain('沈砚站在桥头');
    });

    test('6. 压缩后为空 → 返回 null（调用方必须回退全文）', () => {
        expect(buildChangeDigest(plainChapter, MATERIALS)).toBeNull();
        expect(buildChangeDigest('', MATERIALS)).toBeNull();
    });

    test('6b. 超长内容有硬上限（不把压缩变成另一种膨胀）', () => {
        const long = ('老陈死了。' + '无关内容。'.repeat(50)).repeat(20);
        const d = buildChangeDigest(long, MATERIALS, 300);
        expect(d.text.length).toBeLessThanOrEqual(300 * 3 + 40);
    });

    test('5c. 信号句不因预算被丢（后半章的信号必须留 —— 防位置偏置）', () => {
        const long = '无关内容。'.repeat(200) + '第末段：老陈死了。' + '无关内容。'.repeat(200);
        const d = buildChangeDigest(long, MATERIALS, 200);
        expect(d.text).toContain('老陈死了');
    });

    test('5d. 预算充足时上下文句照常补齐（保留可读性）', () => {
        const d = buildChangeDigest('前一句。老陈死了。后一句。', MATERIALS, 1500);
        expect(d.text).toContain('前一句');
        expect(d.text).toContain('后一句');
    });
});

describe('T5-7 跳过路径端到端（省一次 LLM 调用）', () => {
    const runWith = async (chapterContent, features) => {
        const runAgent = jest.fn().mockResolvedValue({ response: '{"updates":[]}' });
        const chapter = { id: 'ch-9', chapterNumber: 9, status: 'approved', content: chapterContent };
        const params = {
            projectId: 'p1', chapter, materials: [],
            agentContext: {}, context: {}, runAgent, saveAgentOutput: jest.fn(),
        };
        mockProjectHolder.current = { id: 'p1', styleProfile: {}, features };
        const r = await handleMaterialManager(params);
        return { r, runAgent, chapter };
    };

    test('开关开启 + 零信号 → runAgent 0 次调用，章节仍被正确归档', async () => {
        const { r, runAgent, chapter } = await runWith(plainChapter, { enableMaterialPrecheck: true });
        expect(runAgent).not.toHaveBeenCalled();                 // ← 省下这一次调用
        expect(r.skipped).toBe(true);
        expect(chapter.materialManagerSkipped).toBe(true);
        expect(chapter.status).toBe('material-updated');         // 归档三件套完成，门槛不误判
        expect(require('../../server/services/stateKVIndex').markChapterProcessed).toHaveBeenCalled();
    });

    test('开关开启 + 有信号 → 照常调 LLM（不因省 token 丢素材）', async () => {
        const { r, runAgent } = await runWith('老陈死了，沈砚收起了那把断刃。', { enableMaterialPrecheck: true });
        expect(runAgent).toHaveBeenCalledTimes(1);
        expect(r.skipped).toBeUndefined();
    });

    test('开关关闭（默认）→ 行为不变，绝不跳过', async () => {
        const { r, runAgent } = await runWith(plainChapter, {});
        expect(runAgent).toHaveBeenCalledTimes(1);
        expect(r.skipped).toBeUndefined();
    });

    test('开关开启 + 有信号但无压缩空间 → 回退全文（digest 为空时不投喂空稿）', async () => {
        const { runAgent } = await runWith('老陈死了。沈砚离开了。', { enableMaterialPrecheck: true });
        const sentContext = runAgent.mock.calls[0][1];
        expect(sentContext.chapterContent).toContain('老陈死了');
    });
});

void updateChapterStatus;
