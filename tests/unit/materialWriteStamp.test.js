/**
 * materialWriteOwnership（P1-4c 素材写入留痕）单元测试
 * 覆盖：写入权判定 / 留痕字段口径 / 创建与更新动作实际打标
 */
jest.mock('../../server/store', () => ({ getItem: jest.fn(), setItem: jest.fn(), queryItems: jest.fn() }));
jest.mock('../../server/services/materialValidator', () => ({ validateMaterial: jest.fn(() => ({ valid: true, errors: [] })) }));
jest.mock('../../server/services/genreConfig', () => ({ validateNewMaterial: jest.fn(() => ({ valid: true })) }));
jest.mock('../../server/services/pipeline/steps/materialUpdateHelpers', () => ({ ensureOutputDir: jest.fn() }));
jest.mock('../../server/services/pipeline/steps/materialCreateHelpers', () => ({
    populateCharacterFields: jest.fn(), populateTypeSpecificFields: jest.fn(), syncToRegistries: jest.fn()
}));
jest.mock('../../server/shared/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));

const store = require('../../server/store');
const { MATERIAL_WRITER_ID, isMaterialWriter, buildWriteStamp } = require('../../server/config/materialWriteOwnership');
const { handleUpdateAction, handleArchiveAction } = require('../../server/services/pipeline/steps/materialActions');
const { handleCreateAction } = require('../../server/services/pipeline/steps/materialCreateAction');

describe('materialWriteOwnership - 写入权与留痕口径', () => {
    test('只有 material-manager 拥有素材写入权', () => {
        expect(MATERIAL_WRITER_ID).toBe('material-manager');
        expect(isMaterialWriter('material-manager')).toBe(true);
        for (const a of ['writer', 'reviser', 'first-review', 'polisher', 'final-editor', 'reader']) {
            expect(isMaterialWriter(a)).toBe(false);
        }
    });

    test('留痕字段固定为 lastWriter + lastUpdatedChapter（口径唯一）', () => {
        expect(buildWriteStamp(7)).toEqual({ lastWriter: 'material-manager', lastUpdatedChapter: 7 });
        expect(buildWriteStamp()).toEqual({ lastWriter: 'material-manager', lastUpdatedChapter: 0 });
    });
});

describe('素材更新/归档动作打留痕', () => {
    beforeEach(() => jest.clearAllMocks());

    test('更新素材写入 lastWriter/lastUpdatedChapter', async () => {
        store.setItem.mockResolvedValue();
        const existing = { id: 'm1', type: 'catchphrase', name: '再算一遍', currentContent: '旧', version: 1 };
        const ok = await handleUpdateAction({ content: '新', reason: 'ch5更新' }, existing, { chapterNumber: 5 }, 'p1', {});

        expect(ok).toBe(true);
        const saved = store.setItem.mock.calls[0][2];
        expect(saved).toMatchObject({ lastWriter: 'material-manager', lastUpdatedChapter: 5, version: 2 });
    });

    test('归档素材同样留痕（可查"谁在哪一章退场的"）', async () => {
        store.setItem.mockResolvedValue();
        const existing = { id: 'm2', type: 'equipment', name: '旧钥匙', version: 3 };
        await handleArchiveAction({ reason: '报废' }, existing, { chapterNumber: 12 }, 'p1');

        const saved = store.setItem.mock.calls[0][2];
        expect(saved).toMatchObject({ archived: true, lastWriter: 'material-manager', lastUpdatedChapter: 12, version: 4 });
    });

    test('章节号缺失时退回素材自身的最后写入章（不回退成 0 丢信息）', async () => {
        store.setItem.mockResolvedValue();
        const existing = { id: 'm3', type: 'worldview', name: '雾港', version: 1, lastUpdatedChapter: 8 };
        await handleUpdateAction({ content: '补充', reason: 'r' }, existing, {}, 'p1', {});

        expect(store.setItem.mock.calls[0][2].lastUpdatedChapter).toBe(8);
    });
});

describe('素材创建动作打留痕', () => {
    beforeEach(() => jest.clearAllMocks());

    test('新建素材写入 lastWriter/lastUpdatedChapter（谁建的、哪一章建的）', async () => {
        store.setItem.mockResolvedValue();
        const result = await handleCreateAction(
            { type: 'equipment', name: '断刃', content: '一柄缺口短刀', reason: 'ch3登场' },
            { chapterNumber: 3 }, 'p1', {}
        );

        expect(result).toMatchObject({ type: 'equipment' });
        const saved = store.setItem.mock.calls[0][2];
        expect(saved).toMatchObject({ lastWriter: 'material-manager', lastUpdatedChapter: 3, sourceChapter: 3 });
    });

    test('章节号缺失时留痕落到 0（不写 undefined，便于查询）', async () => {
        store.setItem.mockResolvedValue();
        await handleCreateAction({ type: 'location', name: '雾港', content: '大雾港口' }, {}, 'p1', {});

        expect(store.setItem.mock.calls[0][2].lastUpdatedChapter).toBe(0);
    });
});
