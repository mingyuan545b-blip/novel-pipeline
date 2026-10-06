import { normalizeWorldId, toProjectWorld, mergeWorldsWithContracts, contractOf } from '../../pages/entitycenter/worldContractUtils';

describe('worldContractUtils', () => {
    test('normalizeWorldId 主世界归一', () => {
        expect(normalizeWorldId({ id: 'main-world', name: '主世界' })).toBe('main-world');
        expect(normalizeWorldId({ id: 'x', name: '主世界（某某）' })).toBe('main-world');
        expect(normalizeWorldId({ id: 'dungeon-1', name: '白骨道' })).toBe('dungeon-1');
    });
    test('toProjectWorld 合法化非法字段', () => {
        const w = toProjectWorld({ id: 'w1', name: '界', type: 'bogus', powerSystem: ['tech', 'nope'] });
        expect(w.type).toBe('sub');
        expect(w.powerSystem).toEqual(['tech']);
        expect(w.carryOutPolicy).toBe('native');
    });
    test('mergeWorldsWithContracts 按归一 id 去重，项目配置优先', () => {
        const merged = mergeWorldsWithContracts(
            [{ id: 'main-world', name: '主世界', carryOutPolicy: 'medium', channelTag: 'T' }],
            [{ id: '主世界', name: '主世界' }, { id: 'dungeon-1', name: '白骨道' }]
        );
        expect(merged).toHaveLength(2);
        expect(merged.find(w => w.id === 'main-world').carryOutPolicy).toBe('medium');
        expect(merged.find(w => w.id === 'dungeon-1')).toBeTruthy();
    });
    test('contractOf 取契约/缺省', () => {
        const pw = [{ id: 'dungeon-1', carryOutPolicy: 'medium', channelTag: '白骨道', exitMethod: '通关' }];
        expect(contractOf(pw, { id: 'dungeon-1' })).toMatchObject({ carryOutPolicy: 'medium', channelTag: '白骨道' });
        expect(contractOf(pw, { id: 'other' })).toMatchObject({ carryOutPolicy: 'native' });
    });
});
