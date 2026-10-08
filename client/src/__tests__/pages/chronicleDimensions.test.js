import { DIMENSIONS, itemsOf, dimensionCounts, dimensionsForLevel, dimensionKeysForLevel } from '../../pages/entitycenter/chronicleDimensions';

describe('chronicleDimensions', () => {
    test('9 个维度定义（2026-10-08 增"口头禅名梗"）', () => {
        expect(DIMENSIONS.map(d => d.key)).toEqual(
            ['stance', 'shift', 'psychology', 'daily', 'highlight', 'quote', 'catchphrase', 'deed', 'relation']
        );
    });
    test('itemsOf 口头禅/名梗', () => {
        const e = { chapterNumber: 4, entityName: '陈梦飞', catchphrases: [{ text: '这账，平了才叫结', trigger: '面对赖账的人时', why: '记账人的世界观' }] };
        const it = itemsOf(e, 'catchphrase');
        expect(it).toHaveLength(1);
        expect(it[0]).toMatchObject({ scene: '面对赖账的人时', text: '「这账，平了才叫结」', note: '记账人的世界观' });
    });
    test('itemsOf 标量维度', () => {
        const e = { chapterNumber: 5, entityName: '沈砚', stance: '查真相', innerConflict: '怕被算清' };
        const it = itemsOf(e, 'stance');
        expect(it).toHaveLength(1);
        expect(it[0]).toMatchObject({ chapter: 5, entity: '沈砚', text: '查真相' });
        expect(it[0].note).toContain('怕被算清');
    });
    test('itemsOf 名言兼容对象与字符串', () => {
        const e = { chapterNumber: 3, entityName: '卡蜜尔', quotes: [{ scene: '回望', quote: '我曾踏足山巅', why: '态度' }, '人生如棋'] };
        const it = itemsOf(e, 'quote');
        expect(it).toHaveLength(2);
        expect(it[0]).toMatchObject({ scene: '回望', text: '“我曾踏足山巅”', note: '态度' });
        expect(it[1].text).toBe('“人生如棋”');
    });
    test('itemsOf 高光与关系', () => {
        const e = { chapterNumber: 2, entityName: 'A', highlights: [{ scene: '雨夜', what: '立誓', why: '驱动' }], relations: [{ target: 'B', from: '陌生', to: '盟友', reason: '共患难' }] };
        expect(itemsOf(e, 'highlight')[0]).toMatchObject({ scene: '雨夜', text: '立誓' });
        expect(itemsOf(e, 'relation')[0].text).toContain('陌生 → 盟友');
    });
    test('档位收敛展示维度（修"基础/精简/完整都一个样"）', () => {
        expect(dimensionKeysForLevel('minimal')).toEqual(['stance']);
        expect(dimensionKeysForLevel('basic')).toEqual(['stance', 'daily', 'psychology']);
        expect(dimensionKeysForLevel('full')).toHaveLength(9);
        // 三个档位展示面必须互不相同
        expect(dimensionsForLevel('minimal').map(d => d.key)).not.toEqual(dimensionsForLevel('basic').map(d => d.key));
        expect(dimensionsForLevel('basic').map(d => d.key)).not.toEqual(dimensionsForLevel('full').map(d => d.key));
        // 未知档位按完整处理
        expect(dimensionKeysForLevel(undefined)).toHaveLength(9);
    });
    test('dimensionCounts 按档位只统计可见维度', () => {
        const data = [{ stance: 'x', quotes: ['a'], deeds: ['d'] }];
        const basic = dimensionCounts(data, 'basic');
        expect(basic.stance).toBe(1);
        expect(basic.quote).toBeUndefined();
        expect(dimensionCounts(data, 'full').quote).toBe(1);
    });
    test('dimensionCounts 汇总', () => {
        const data = [
            { stance: 'x', quotes: ['a', 'b'] },
            { stance: 'y', deeds: ['d'] }
        ];
        const c = dimensionCounts(data);
        expect(c.stance).toBe(2);
        expect(c.quote).toBe(2);
        expect(c.deed).toBe(1);
        expect(c.highlight).toBe(0);
    });
});
