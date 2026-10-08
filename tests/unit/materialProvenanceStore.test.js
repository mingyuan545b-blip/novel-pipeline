/**
 * T2 验收（真实存储往返）：provenance / changeLog v2 必须能真的落库再读回
 *
 * 为什么必须有这层：materialRepository 在内存里拼出来的对象好看，
 * 但 PG/SQLite 写入器会**按列抽取**字段（sourceChapter/lastAppearChapter/version 是真列，
 * provenance/changeLog 走 data JSON 列）。内存断言过了、落库后丢字段 = 假通过。
 */
const { initDatabaseAsync, closeDatabase } = require('../../server/db/database');
const sqliteStore = require('../../server/db/store');
const { isFoundationMaterialCheck } = require('../../server/db/storeCommon');
const repo = require('../../server/services/materialRepository');
const prov = require('../../server/config/materialProvenance');

beforeAll(async () => { await initDatabaseAsync(':memory:'); });
afterAll(() => { closeDatabase(); });

// repository.save 走 store.js（本项目唯一写入出口）→ 测试里用 sqliteStore 直连做等价往返
async function persistAndReadBack(record) {
    await sqliteStore.setItem('materials', record.id, record);
    return sqliteStore.getItem('materials', record.id);
}

describe('T2 真实落库往返', () => {
    test('创建记录：provenance + changeLog v2 经存储后完整保留', async () => {
        const rec = repo.buildNewMaterialRecord({
            id: 'rt-1', projectId: 'p-rt', type: 'character', name: '林婉',
            content: '【身份】外门弟子', chapter: 3, origin: prov.ORIGINS.CHAPTER, reason: 'ch3登场',
        });
        const back = await persistAndReadBack(rec);

        expect(back.provenance).toMatchObject({ createdChapter: 3, origin: 'chapter' });
        expect(back.provenance.createdAt).toBeTruthy();
        expect(back.changeLog).toHaveLength(1);
        expect(back.changeLog[0]).toMatchObject({ v: 2, action: 'created', chapter: 3, writer: 'material-manager' });
        expect(back.sourceChapter).toBe(3);          // 真列
        expect(back.version).toBe(1);
        expect(back.currentContent).toContain('外门弟子');
    });

    test('更新记录：落库后创建章节仍是 1、最近变化是 8（核心 T2 断言）', async () => {
        const created = repo.buildNewMaterialRecord({
            id: 'rt-2', projectId: 'p-rt', type: 'character', name: '沈砚', content: 'v1', chapter: 1,
        });
        await persistAndReadBack(created);

        const updated = repo.buildUpdatedMaterialRecord(created, { currentContent: 'v8' }, { chapter: 8, reason: 'ch8晋升' });
        const back = await persistAndReadBack(updated);

        expect(back.provenance.createdChapter).toBe(1);
        expect(back.provenance.createdAt).toBe(created.provenance.createdAt);
        expect(back.lastUpdatedChapter).toBe(8);
        expect(back.sourceChapter).toBe(1);
        expect(back.version).toBe(2);
        expect(back.changeLog.map(e => e.v)).toEqual([2, 2]);
        expect(back.changeLog.map(e => e.chapter)).toEqual([1, 8]);
    });

    test('多次更新后 provenance 不被任何一次改写（10 章滚动）', async () => {
        let rec = repo.buildNewMaterialRecord({ id: 'rt-3', projectId: 'p-rt', type: 'equipment', name: '断刃', content: 'v1', chapter: 2 });
        await persistAndReadBack(rec);
        const createdChapter = rec.provenance.createdChapter;
        for (let ch = 3; ch <= 12; ch++) {
            rec = repo.buildUpdatedMaterialRecord(rec, { currentContent: `v${ch}` }, { chapter: ch, reason: `ch${ch}` });
            await persistAndReadBack(rec);
        }
        const back = await sqliteStore.getItem('materials', 'rt-3');
        expect(back.provenance.createdChapter).toBe(createdChapter);
        expect(back.sourceChapter).toBe(2);
        expect(back.lastUpdatedChapter).toBe(12);
        expect(back.version).toBe(11);
    });

    test('回归：初始素材 sourceChapter=0 仍被判定为"基底素材"（不改变既有分类行为）', async () => {
        const rec = repo.buildNewMaterialRecord({
            id: 'rt-4', projectId: 'p-rt', type: 'worldview', name: '雾港', content: '大雾', chapter: 0, origin: prov.ORIGINS.OUTLINE,
        });
        const back = await persistAndReadBack(rec);
        expect(back.sourceChapter).toBe(0);
        expect(isFoundationMaterialCheck(back, () => null)).toBe(true);
    });
});
