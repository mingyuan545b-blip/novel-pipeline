const {
    matchSubplaneForChapter, buildSubplaneChapterMap,
    detectLockedSubplaneMentions, validateVolumeRhythm
} = require('../../server/services/pipeline/outlineRhythmMatchers');

describe('outlineRhythmMatchers', () => {
    describe('matchSubplaneForChapter', () => {
        test('returns null when no subplane names provided', () => {
            expect(matchSubplaneForChapter({ outline: '测试', title: '第一章' }, [], null, null)).toBeNull();
        });
        test('matches by scene field', () => {
            const result = matchSubplaneForChapter(
                { outline: '内容', title: '第一章', scene: '小世界·幽冥界' },
                ['小世界·幽冥界'], null, null
            );
            expect(result).toBe('小世界·幽冥界');
        });
        test('matches by scene short name', () => {
            const result = matchSubplaneForChapter(
                { outline: '内容', title: '第一章', scene: '幽冥界' },
                ['小世界·幽冥界'], null, null
            );
            expect(result).toBe('小世界·幽冥界');
        });
        test('matches by outline text', () => {
            const result = matchSubplaneForChapter(
                { outline: '主角进入幽冥界探索', title: '第一章' },
                ['小世界·幽冥界'], null, null
            );
            expect(result).toBe('小世界·幽冥界');
        });
        test('matches by currentVolSubplaneName', () => {
            const result = matchSubplaneForChapter(
                { outline: '主角进入幽冥界', title: '第一章' },
                [], '小世界·幽冥界', '幽冥界'
            );
            expect(result).toBe('小世界·幽冥界');
        });
        test('returns null for 主世界 scene', () => {
            const result = matchSubplaneForChapter(
                { outline: '内容', title: '第一章', scene: '主世界' },
                ['小世界·幽冥界'], null, null
            );
            expect(result).toBeNull();
        });
    });

    describe('buildSubplaneChapterMap', () => {
        test('returns empty map for empty outlines', () => {
            expect(buildSubplaneChapterMap([], [], null, null)).toEqual({});
        });
        test('groups chapters by subplane', () => {
            const outlines = [
                { num: 1, outline: '进入幽冥界', title: '第一章', scene: '幽冥界' },
                { num: 2, outline: '主世界', title: '第二章', scene: '主世界' },
                { num: 3, outline: '幽冥界战斗', title: '第三章', scene: '幽冥界' },
            ];
            const result = buildSubplaneChapterMap(outlines, ['小世界·幽冥界'], null, null);
            expect(result['小世界·幽冥界']).toEqual([1, 3]);
        });
    });

    describe('detectLockedSubplaneMentions', () => {
        test('returns empty for no locked mentions', () => {
            const outlines = [{ num: 5, outline: '主世界内容', title: '第五章', scene: '主世界' }];
            const result = detectLockedSubplaneMentions(outlines, 3, [], null, null);
            expect(result).toEqual({});
        });
        test('skips chapters at or before existingCount', () => {
            const outlines = [{ num: 3, outline: '进入幽冥界', title: '第三章', scene: '幽冥界' }];
            const materials = [{ name: '小世界·幽冥界', isLocked: true }];
            const result = detectLockedSubplaneMentions(outlines, 3, materials, null, null);
            expect(result).toEqual({});
        });
        test('detects locked subplane mentions', () => {
            const outlines = [{ num: 5, outline: '进入幽冥界', title: '第五章', scene: '幽冥界' }];
            const materials = [{ name: '小世界·幽冥界', isLocked: true }];
            const result = detectLockedSubplaneMentions(outlines, 3, materials, '小世界·天界', '天界');
            expect(result['小世界·幽冥界']).toEqual([5]);
        });
        test('skips current volume subplane', () => {
            const outlines = [{ num: 5, outline: '进入天界', title: '第五章', scene: '天界' }];
            const materials = [{ name: '小世界·天界', isLocked: true }];
            const result = detectLockedSubplaneMentions(outlines, 3, materials, '小世界·天界', '天界');
            expect(result).toEqual({});
        });
    });

    describe('validateVolumeRhythm', () => {
        test('returns empty issues for no subplanes', () => {
            const issues = validateVolumeRhythm(0, 30, [], {});
            expect(issues).toEqual([]);
        });
        test('detects multiple subplanes in one volume', () => {
            const subplaneChapters = {
                '小世界·幽冥界': [1, 2, 3, 4, 5],
                '小世界·天界': [6, 7, 8, 9, 10]
            };
            const issues = validateVolumeRhythm(0, 30, [], subplaneChapters);
            expect(issues.length).toBeGreaterThan(0);
            expect(issues[0]).toContain('2个小世界');
        });
        test('warns about too few subplane chapters', () => {
            const subplaneChapters = { '小世界·幽冥界': [1, 2] };
            const issues = validateVolumeRhythm(0, 30, [], subplaneChapters);
            expect(issues.some(i => i.includes('仅有2章'))).toBe(true);
        });
        test('accepts adequate subplane chapters', () => {
            const subplaneChapters = { '小世界·幽冥界': Array.from({ length: 15 }, (_, i) => i + 1) };
            const issues = validateVolumeRhythm(0, 30, [], subplaneChapters);
            expect(issues.filter(i => i.includes('仅有'))).toEqual([]);
        });
    });
});
