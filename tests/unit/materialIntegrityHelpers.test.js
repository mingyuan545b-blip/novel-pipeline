const {
    checkDuplicates, buildIntegrityStats
} = require('../../server/services/materialIntegrityHelpers');

describe('materialIntegrityHelpers', () => {
    describe('checkDuplicates', () => {
        test('returns empty for no duplicates', () => {
            const mats = [
                { id: '1', name: '张三', type: 'character' },
                { id: '2', name: '李四', type: 'character' },
            ];
            expect(checkDuplicates(mats)).toEqual([]);
        });
        test('detects same-name same-type duplicates', () => {
            const mats = [
                { id: '1', name: '张三', type: 'character' },
                { id: '2', name: '张三', type: 'character' },
            ];
            const issues = checkDuplicates(mats);
            expect(issues).toHaveLength(1);
            expect(issues[0].type).toBe('duplicate');
            expect(issues[0].fix).toBe('merge');
        });
        test('allows same-name different-type', () => {
            const mats = [
                { id: '1', name: '宝剑', type: 'equipment' },
                { id: '2', name: '宝剑', type: 'technique' },
            ];
            expect(checkDuplicates(mats)).toEqual([]);
        });
        test('detects 3+ duplicates', () => {
            const mats = [
                { id: '1', name: '张三', type: 'character' },
                { id: '2', name: '张三', type: 'character' },
                { id: '3', name: '张三', type: 'character' },
            ];
            const issues = checkDuplicates(mats);
            expect(issues).toHaveLength(1);
            expect(issues[0].materialIds).toHaveLength(3);
        });
    });

    describe('buildIntegrityStats', () => {
        test('counts total and by type', () => {
            const mats = [
                { id: '1', name: '张三', type: 'character' },
                { id: '2', name: '宝剑', type: 'equipment' },
                { id: '3', name: '李四', type: 'character', parentPlane: 'sp1' },
            ];
            const stats = buildIntegrityStats(mats);
            expect(stats.total).toBe(3);
            expect(stats.byType.character).toBe(2);
            expect(stats.byType.equipment).toBe(1);
        });
        test('counts by plane', () => {
            const mats = [
                { id: '1', name: '张三', type: 'character' },
                { id: '2', name: '李四', type: 'character', parentPlane: '天界' },
            ];
            const stats = buildIntegrityStats(mats);
            expect(stats.byPlane['主世界']).toBe(1);
            expect(stats.byPlane['天界']).toBe(1);
        });
        test('counts character mainWorld vs subPlane', () => {
            const mats = [
                { id: '1', name: '张三', type: 'character' },
                { id: '2', name: '李四', type: 'character', parentPlane: '天界' },
            ];
            const stats = buildIntegrityStats(mats);
            expect(stats.characters.mainWorld).toBe(1);
            expect(stats.characters.subPlane).toBe(1);
        });
        test('handles empty materials', () => {
            const stats = buildIntegrityStats([]);
            expect(stats.total).toBe(0);
            expect(stats.byPlane['主世界']).toBe(0);
        });
        test('counts equipment without parentPlane', () => {
            const mats = [{ id: '1', name: '宝剑', type: 'equipment' }];
            const stats = buildIntegrityStats(mats);
            expect(stats.byPlane['主世界']).toBe(1);
        });
    });
});
