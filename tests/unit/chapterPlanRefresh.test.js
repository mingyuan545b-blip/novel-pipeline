/**
 * chapterPlanRefresh（P1-4b 就近细纲刷新）单元测试
 * 覆盖：幂等跳过 / 缺大纲 / 成功落盘 / 失败保留粗纲 / 缺字段 / 题材偏移 / prompt 取材
 */
jest.mock('../../server/store', () => ({
    getItem: jest.fn(), setItem: jest.fn(), queryItems: jest.fn()
}));
jest.mock('../../server/shared/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));
jest.mock('../../server/services/llm', () => ({ chat: jest.fn() }));
jest.mock('../../server/services/pipeline/constants', () => ({ getOutlineApiConfig: jest.fn().mockResolvedValue({}) }));
jest.mock('../../server/services/pipeline/volumeHelpers', () => ({ getVisibleMaterials: jest.fn() }));
jest.mock('../../server/services/prompts/constraintInjector', () => ({ buildConstraintInjection: jest.fn() }));
jest.mock('../../server/services/prompts/styleInjector', () => ({ buildStyleInjection: jest.fn() }));
jest.mock('../../server/services/pipeline/outlineResponseParser', () => ({ parseTemplateResponse: jest.fn() }));
jest.mock('../../server/services/genreConfig', () => ({ getGenrePlugin: jest.fn(), resolveGenreFromProject: jest.fn() }));

const store = require('../../server/store');
const logger = require('../../server/shared/logger');
const llm = require('../../server/services/llm');
const { getVisibleMaterials } = require('../../server/services/pipeline/volumeHelpers');
const { buildConstraintInjection } = require('../../server/services/prompts/constraintInjector');
const { buildStyleInjection } = require('../../server/services/prompts/styleInjector');
const { parseTemplateResponse } = require('../../server/services/pipeline/outlineResponseParser');
const { getGenrePlugin } = require('../../server/services/genreConfig');
const { refreshNearOutline } = require('../../server/services/pipeline/chapterPlanRefresh');

const chapterWith = (over = {}) => ({ id: 'ch-5', chapterNumber: 5, title: '旧标题', outline: '远景粗纲：主角入城', ...over });

const setup = ({ chapter = chapterWith(), chapters = [], materials = [] } = {}) => {
    store.getItem.mockImplementation(async (coll, id) => (coll === 'chapters' ? chapter : coll === 'projects' ? { id, name: '测试书', genre: 'novel' } : null));
    store.queryItems.mockImplementation(async (coll) => (coll === 'chapters' ? [chapter, ...chapters] : []));
    store.setItem.mockResolvedValue();
    getVisibleMaterials.mockResolvedValue({ materials });
    buildConstraintInjection.mockResolvedValue('约束段');
    buildStyleInjection.mockResolvedValue('风格段');
    getGenrePlugin.mockReturnValue({ foundation: { additionalConstraints: [] } });
    parseTemplateResponse.mockReturnValue({ title: '新标题', outline: '细纲：主角入城遇伏', adjust: '细化了伏击地点' });
    llm.chat.mockResolvedValue({ choices: [{ message: { content: '{}' } }] });
    return chapter;
};

describe('chapterPlanRefresh - 幂等与前置校验', () => {
    beforeEach(() => jest.clearAllMocks());

    test('已细化过（outlineRefinedChapter === 本章）→ 跳过且不调 LLM', async () => {
        setup({ chapter: chapterWith({ outlineRefinedChapter: 5 }) });
        const res = await refreshNearOutline('p1', 5);
        expect(res).toMatchObject({ ok: true, skipped: true });
        expect(llm.chat).not.toHaveBeenCalled();
    });

    test('force=true 时即使已细化也重跑', async () => {
        setup({ chapter: chapterWith({ outlineRefinedChapter: 5 }) });
        const res = await refreshNearOutline('p1', 5, { force: true });
        expect(res.ok).toBe(true);
        expect(res.skipped).toBeUndefined();
        expect(llm.chat).toHaveBeenCalled();
    });

    test('章节不存在 → chapter-not-found', async () => {
        setup();
        store.getItem.mockResolvedValue(null);
        store.queryItems.mockResolvedValue([]);
        const res = await refreshNearOutline('p1', 5);
        expect(res).toMatchObject({ ok: false, reason: 'chapter-not-found' });
    });

    test('无粗纲 → no-outline，不调 LLM', async () => {
        setup({ chapter: chapterWith({ outline: '   ' }) });
        const res = await refreshNearOutline('p1', 5);
        expect(res).toMatchObject({ ok: false, reason: 'no-outline' });
        expect(llm.chat).not.toHaveBeenCalled();
    });
});

describe('chapterPlanRefresh - 成功路径', () => {
    beforeEach(() => jest.clearAllMocks());

    test('细纲替换正文计划、粗纲存入 farOutline、打幂等标记', async () => {
        const chapter = setup();
        const res = await refreshNearOutline('p1', 5);

        expect(res).toMatchObject({ ok: true, title: '新标题', outline: '细纲：主角入城遇伏', adjust: '细化了伏击地点' });
        const saved = store.setItem.mock.calls[0][2];
        expect(saved.outline).toBe('细纲：主角入城遇伏');
        expect(saved.farOutline).toBe('远景粗纲：主角入城');
        expect(saved.outlineRefinedChapter).toBe(5);
        expect(saved.outlineRefinedAt).toBeTruthy();
        expect(saved.outlineAdjust).toBe('细化了伏击地点');
        expect(saved.outlineRefineFailed).toBeUndefined();
        expect(chapter.farOutline).toBe('远景粗纲：主角入城');
    });

    test('已有 farOutline 时不覆盖（重复刷新仍保留最早的粗纲）', async () => {
        setup({ chapter: chapterWith({ farOutline: '最早的粗纲' }) });
        await refreshNearOutline('p1', 5);
        expect(store.setItem.mock.calls[0][2].farOutline).toBe('最早的粗纲');
    });

    test('第1章不传上一章节选；第N章透传上一章正文节选', async () => {
        setup({ chapter: chapterWith({ chapterNumber: 1, outline: '粗纲1' }) });
        await refreshNearOutline('p1', 1);
        expect(llm.chat.mock.calls[0][0][1].content).not.toContain('上一章');

        jest.clearAllMocks();
        setup({ chapters: [{ chapterNumber: 4, content: '第四章正文：主角拿到钥匙' }] });
        await refreshNearOutline('p1', 5);
        const userContent = llm.chat.mock.calls[0][0][1].content;
        expect(userContent).toContain('第4章');
        expect(userContent).toContain('第四章正文：主角拿到钥匙');
        expect(userContent).toContain('【第5章远景粗纲】');
    });

    test('素材按"内容摘要"进入 prompt（就近细纲要能以素材为准）', async () => {
        setup({ materials: [{ type: 'character', name: '林三', currentContent: '谨慎的锁匠' }] });
        await refreshNearOutline('p1', 5);
        const userContent = llm.chat.mock.calls[0][0][1].content;
        expect(userContent).toContain('[character] 林三: 谨慎的锁匠');
    });

    test('onStep 上报 running / passed', async () => {
        setup();
        const onStep = jest.fn();
        await refreshNearOutline('p1', 5, { onStep });
        expect(onStep).toHaveBeenCalledWith(expect.objectContaining({ step: 'near-outline', status: 'running' }));
        expect(onStep).toHaveBeenCalledWith(expect.objectContaining({ step: 'near-outline', status: 'passed' }));
    });

    test('题材偏移时告警但仍采用细纲', async () => {
        setup();
        parseTemplateResponse.mockReturnValue({ title: 'T', outline: '他是总裁，强行带走了她' });
        getGenrePlugin.mockReturnValue({ foundation: { additionalConstraints: [{ id: 'anti-bazong' }] } });
        const res = await refreshNearOutline('p1', 5);

        expect(res.ok).toBe(true);
        expect(res.driftIssues.length).toBeGreaterThan(0);
        expect(store.setItem.mock.calls[0][2].outlineRefineDrift.length).toBeGreaterThan(0);
        expect(logger.warn).toHaveBeenCalled();
    });
});

describe('chapterPlanRefresh - 失败兜底（保留粗纲开写）', () => {
    beforeEach(() => jest.clearAllMocks());

    test('LLM 抛错 → ok=false、保留粗纲并打失败标记', async () => {
        setup();
        llm.chat.mockRejectedValue(new Error('503 overloaded'));
        const res = await refreshNearOutline('p1', 5);

        expect(res).toMatchObject({ ok: false, keptFar: true, error: '503 overloaded' });
        const saved = store.setItem.mock.calls[0][2];
        expect(saved.outline).toBe('远景粗纲：主角入城');
        expect(saved.outlineRefineFailed).toContain('503 overloaded');
        expect(logger.error).toHaveBeenCalled();
    });

    test('响应缺少 outline 字段 → 视为失败而不是写入空细纲', async () => {
        setup();
        parseTemplateResponse.mockReturnValue({ title: '只有标题' });
        const res = await refreshNearOutline('p1', 5);

        expect(res.ok).toBe(false);
        expect(store.setItem.mock.calls[0][2].outline).toBe('远景粗纲：主角入城');
    });

    test('失败标记落盘本身失败时不影响主流程（不抛错）', async () => {
        setup();
        llm.chat.mockRejectedValue(new Error('boom'));
        store.setItem.mockRejectedValue(new Error('db down'));
        await expect(refreshNearOutline('p1', 5)).resolves.toMatchObject({ ok: false });
        expect(logger.warn).toHaveBeenCalled();
    });
});
