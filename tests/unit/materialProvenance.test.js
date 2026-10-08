/**
 * T2 验收：素材"出身"不可变 + changeLog 口径统一
 *
 * 验收标准（硬断言，不看日志）：
 *  A. 第1章创建 → 第8章更新后，provenance.createdChapter **必须仍为 1**（旧实现会变 8）
 *  B. lastUpdatedChapter/lastAppearChapter **必须为 8**（"最近变化章"仍可查）
 *  C. sourceChapter 不再被更新覆盖
 *  D. changeLog 每条都是 v2（v=2 + action + at）；新旧混存时全部归一
 *  E. 初始素材（建项时生成）必须带 origin=outline + createdChapter=0
 *  F. provenance 只写一次：第二次更新不得改写 createdAt/origin
 *  G. validateProvenance 能识别缺字段的脏数据
 */
jest.mock('../../server/store', () => ({ getItem: jest.fn(), setItem: jest.fn(), queryItems: jest.fn() }));
jest.mock('../../server/shared/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));
jest.mock('../../server/services/materialValidator', () => ({ validateMaterial: jest.fn(() => ({ valid: true, errors: [] })) }));
jest.mock('../../server/services/genreConfig', () => ({ validateNewMaterial: jest.fn(() => ({ valid: true })) }));
jest.mock('../../server/services/pipeline/steps/materialUpdateHelpers', () => ({ ensureOutputDir: jest.fn() }));
jest.mock('../../server/services/pipeline/steps/materialCreateHelpers', () => ({
    populateCharacterFields: jest.fn(), populateTypeSpecificFields: jest.fn(), syncToRegistries: jest.fn(),
}));

const store = require('../../server/store');
const prov = require('../../server/config/materialProvenance');
const repo = require('../../server/services/materialRepository');
const { handleCreateAction } = require('../../server/services/pipeline/steps/materialCreateAction');
const { handleUpdateAction, handleArchiveAction } = require('../../server/services/pipeline/steps/materialActions');

const savedOf = (id) => store.setItem.mock.calls.filter(c => c[1] === id).pop()[2];

beforeEach(() => jest.clearAllMocks());

describe('T2-A~F 端到端：创建→更新→归档 全链路出身不变', () => {
    test('A+B+C+F. 第1章创建、第8章更新：创建章节=1，最近变化=8，provenance 只写一次', async () => {
        store.setItem.mockResolvedValue(true);
        // ch1 创建
        const created = await handleCreateAction(
            { type: 'character', name: '林婉', content: '【身份】外门弟子', reason: 'ch1登场' },
            { chapterNumber: 1 }, 'p1', {}
        );
        const r1 = savedOf(created.id);
        expect(r1.provenance.createdChapter).toBe(1);
        expect(r1.provenance.origin).toBe('chapter');
        expect(r1.sourceChapter).toBe(1);
        const createdAt = r1.provenance.createdAt;

        // ch8 更新同一素材
        const ok = await handleUpdateAction(
            { content: '【身份】内门弟子', reason: 'ch8晋升' }, r1, { chapterNumber: 8 }, 'p1', {}
        );
        expect(ok).toBe(true);
        const r2 = savedOf(created.id);

        expect(r2.provenance.createdChapter).toBe(1);        // A：创建章节不可变
        expect(r2.provenance.origin).toBe('chapter');        // F：出身不可变
        expect(r2.provenance.createdAt).toBe(createdAt);     // F：创建时间不可变
        expect(r2.lastUpdatedChapter).toBe(8);               // B：最近变化章
        expect(r2.lastAppearChapter).toBe(8);
        expect(r2.sourceChapter).toBe(1);                    // C：不再被覆盖
        expect(r2.currentContent).toContain('内门弟子');
    });

    test('D. changeLog 新旧混存 → 全部归一到 v2', async () => {
        store.setItem.mockResolvedValue(true);
        const legacy = {
            id: 'm-legacy', projectId: 'p1', type: 'worldview', name: '雾港', currentContent: '旧',
            version: 3, sourceChapter: 2,
            changeLog: [
                { from: '', to: '初版', reason: 'Initial creation', timestamp: '2026-01-01T00:00:00.000Z' },
                { action: 'created', reason: 'ch2新增', at: '2026-01-02T00:00:00.000Z' },
                { type: 'repair-update', timestamp: '2026-01-03T00:00:00.000Z', oldContent: 'a', newContent: 'b' },
            ],
        };
        await handleUpdateAction({ content: '新', reason: 'ch9修订' }, legacy, { chapterNumber: 9 }, 'p1', {});
        const r = savedOf('m-legacy');

        expect(r.changeLog.length).toBe(4);
        for (const e of r.changeLog) {
            expect(e.v).toBe(2);
            expect(typeof e.action).toBe('string');
            expect(e.action.length).toBeGreaterThan(0);
            expect(typeof e.at).toBe('string');
        }
        expect(r.changeLog[0].from).toBe('');                 // 保留原始 from
        expect(r.changeLog[2].action).toBe('repair-update');  // type → action
        expect(r.changeLog[3]).toMatchObject({ action: 'updated', chapter: 9, writer: 'material-manager', reason: 'ch9修订' });
    });

    test('归档同样保留出身 + 留痕可查', async () => {
        store.setItem.mockResolvedValue(true);
        const mat = {
            id: 'm-arch', projectId: 'p1', type: 'equipment', name: '断刃', version: 2, sourceChapter: 3,
            provenance: prov.buildProvenance({ origin: 'chapter', chapter: 3, at: '2026-01-01T00:00:00.000Z' }),
        };
        await handleArchiveAction({ reason: '报废', action: 'retire' }, mat, { chapterNumber: 12 }, 'p1');
        const r = savedOf('m-arch');
        expect(r).toMatchObject({ archived: true, lastWriter: 'material-manager', lastUpdatedChapter: 12, version: 3 });
        expect(r.provenance.createdChapter).toBe(3);
        const last = r.changeLog[r.changeLog.length - 1];
        expect(last).toMatchObject({ v: 2, action: 'retire', chapter: 12, reason: '报废' });
    });
});

describe('T2-E 初始素材出身', () => {
    test('建项时生成的素材：origin=outline / createdChapter=0', () => {
        const rec = repo.buildNewMaterialRecord({
            projectId: 'p1', type: 'character', name: '沈砚', content: '主角', chapter: 0, origin: prov.ORIGINS.OUTLINE,
        });
        expect(rec.provenance).toMatchObject({ origin: 'outline', createdChapter: 0 });
        expect(rec.sourceChapter).toBe(0);
        expect(rec.changeLog[0]).toMatchObject({ v: 2, action: 'created', chapter: 0 });
    });
});

describe('T2 纯函数：provenance 模型', () => {
    test('G. validateProvenance 识别脏数据', () => {
        expect(prov.validateProvenance({}).ok).toBe(false);
        expect(prov.validateProvenance({ provenance: { createdChapter: 0, createdAt: 'not-a-date' } }).missing).toEqual(['createdAt', 'origin']);
        const good = { provenance: prov.buildProvenance({ origin: 'chapter', chapter: 5 }) };
        expect(prov.validateProvenance(good)).toEqual({ ok: true, missing: [] });
    });

    test('ensureProvenance 补齐存量数据且不覆盖已有值', () => {
        const legacy = { sourceChapter: 6, createdAt: '2026-01-01T00:00:00.000Z' };
        prov.ensureProvenance(legacy);
        expect(legacy.provenance.createdChapter).toBe(6);
        expect(legacy.provenance.createdAt).toBe('2026-01-01T00:00:00.000Z');

        const has = { provenance: prov.buildProvenance({ origin: 'outline', chapter: 0 }) };
        const before = JSON.stringify(has.provenance);
        prov.ensureProvenance(has);
        expect(JSON.stringify(has.provenance)).toBe(before);
    });

    test('normalizeChangeLog 丢弃无法归一的脏条目而不是污染数据', () => {
        expect(prov.normalizeChangeLog([null, 'x', { reason: '没有时间戳' }])).toEqual([]);
    });
});
