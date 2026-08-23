const {
    matchSubplaneForChapter, buildSubplaneChapterMap,
    detectLockedSubplaneMentions, validateVolumeRhythm
} = require('../../server/services/pipeline/outlineRhythmMatchers');

describe('outlineRhythmMatchers - branch coverage', () => {
    describe('matchSubplaneForChapter', () => {
        test('matches by scene with full name', () => {
            const result = matchSubplaneForChapter(
                { outline: '内容', title: '标题', scene: '小世界···幽冥界' },
                ['小世界···幽冥界'],
                '小世界···幽冥界', '幽冥界'
            );
            expect(result).toBe('小世界···幽冥界');
        });

        test('matches by scene with short name', () => {
            const result = matchSubplaneForChapter(
                { outline: '内容', title: '标题', scene: '幽冥界' },
                ['小世界···幽冥界'],
                '小世界···幽冥界', '幽冥界'
            );
            expect(result).toBe('小世界···幽冥界');
        });

        test('matches by scene including short name', () => {
            const result = matchSubplaneForChapter(
                { outline: '内容', title: '标题', scene: '前往幽冥界探险' },
                ['小世界···幽冥界'],
                '小世界···幽冥界', '幽冥界'
            );
            expect(result).toBe('小世界···幽冥界');
        });

        test('matches by scene with current volume subplane', () => {
            const result = matchSubplaneForChapter(
                { outline: '内容', title: '标题', scene: '天界' },
                [],
                '小世界···天界', '天界'
            );
            expect(result).toBe('小世界···天界');
        });

        test('matches by outline text containing short name', () => {
            const result = matchSubplaneForChapter(
                { outline: '在幽冥界中探索', title: '标题' },
                ['小世界···幽冥界'],
                null, null
            );
            expect(result).toBe('小世界···幽冥界');
        });

        test('matches by outline text containing full name', () => {
            const result = matchSubplaneForChapter(
                { outline: '进入小世界···幽冥界', title: '标题' },
                ['小世界···幽冥界'],
                null, null
            );
            expect(result).toBe('小世界···幽冥界');
        });

        test('matches by current volume subplane in text', () => {
            const result = matchSubplaneForChapter(
                { outline: '在天界中探索', title: '标题' },
                [],
                '小世界···天界', '天界'
            );
            expect(result).toBe('小世界···天界');
        });

        test('returns null when no match', () => {
            const result = matchSubplaneForChapter(
                { outline: '在主世界中', title: '标题', scene: '主世界' },
                ['小世界···幽冥界'],
                null, null
            );
            expect(result).toBeNull();
        });

        test('returns null when scene is 主世界', () => {
            const result = matchSubplaneForChapter(
                { outline: '内容', title: '标题', scene: '主世界' },
                ['小世界···幽冥界'],
                null, null
            );
            expect(result).toBeNull();
        });
    });

    describe('buildSubplaneChapterMap', () => {
        test('builds map from outlines', () => {
            const outlines = [
                { num: 1, outline: '在幽冥界中', title: '第一章', scene: '幽冥界' },
                { num: 2, outline: '主世界', title: '第二章', scene: '主世界' },
            ];
            const result = buildSubplaneChapterMap(outlines, ['小世界···幽冥界'], '小世界···幽冥界', '幽冥界');
            expect(result['小世界···幽冥界']).toContain(1);
            expect(result['小世界···幽冥界']).not.toContain(2);
        });

        test('returns empty map for no matches', () => {
            const result = buildSubplaneChapterMap(
                [{ num: 1, outline: '主世界', title: '第一章' }],
                [], null, null
            );
            expect(Object.keys(result)).toHaveLength(0);
        });
    });

    describe('detectLockedSubplaneMentions', () => {
        test('detects locked subplane in scene', () => {
            const outlines = [
                { num: 5, outline: '内容', title: '标题', scene: '天界' },
            ];
            const subplaneMats = [
                { name: '小世界···天界', isLocked: true }
            ];
            const result = detectLockedSubplaneMentions(outlines, 3, subplaneMats, '小世界···幽冥界', '幽冥界');
            expect(result['小世界···天界']).toContain(5);
        });

        test('skips chapters before existingCount', () => {
            const outlines = [
                { num: 1, outline: '内容', title: '标题', scene: '天界' },
                { num: 5, outline: '内容', title: '标题', scene: '天界' },
            ];
            const subplaneMats = [
                { name: '小世界···天界', isLocked: true }
            ];
            const result = detectLockedSubplaneMentions(outlines, 3, subplaneMats, '小世界···幽冥界', '幽冥界');
            expect(result['小世界···天界']).not.toContain(1);
            expect(result['小世界···天界']).toContain(5);
        });

        test('skips current volume subplane', () => {
            const outlines = [
                { num: 5, outline: '内容', title: '标题', scene: '幽冥界' },
            ];
            const subplaneMats = [
                { name: '小世界···幽冥界', isLocked: true }
            ];
            const result = detectLockedSubplaneMentions(outlines, 3, subplaneMats, '小世界···幽冥界', '幽冥界');
            expect(Object.keys(result)).toHaveLength(0);
        });

        test('skips unlocked subplanes', () => {
            const outlines = [
                { num: 5, outline: '内容', title: '标题', scene: '天界' },
            ];
            const subplaneMats = [
                { name: '小世界···天界', isLocked: false }
            ];
            const result = detectLockedSubplaneMentions(outlines, 3, subplaneMats, '小世界···幽冥界', '幽冥界');
            expect(Object.keys(result)).toHaveLength(0);
        });

        test('skips 主世界 scenes', () => {
            const outlines = [
                { num: 5, outline: '内容', title: '标题', scene: '主世界' },
            ];
            const subplaneMats = [
                { name: '小世界···天界', isLocked: true }
            ];
            const result = detectLockedSubplaneMentions(outlines, 3, subplaneMats, '小世界···幽冥界', '幽冥界');
            expect(Object.keys(result)).toHaveLength(0);
        });

        test('skips chapters without scene', () => {
            const outlines = [
                { num: 5, outline: '内容', title: '标题' },
            ];
            const subplaneMats = [
                { name: '小世界···天界', isLocked: true }
            ];
            const result = detectLockedSubplaneMentions(outlines, 3, subplaneMats, '小世界···幽冥界', '幽冥界');
            expect(Object.keys(result)).toHaveLength(0);
        });
    });

    describe('validateVolumeRhythm', () => {
        test('flags multiple subplanes in one volume', () => {
            const subplaneChapters = {
                '小世界···幽冥界': [1, 2, 3],
                '小世界···天界': [4, 5, 6],
            };
            const allOutlines = Array.from({ length: 30 }, (_, i) => ({
                num: i + 1, outline: '内容', title: '标题', scene: '主世界'
            }));
            const issues = validateVolumeRhythm(0, 30, allOutlines, subplaneChapters);
            expect(issues.some(i => i.includes('违反一卷一小世界规则'))).toBe(true);
        });

        test('flags too few subplane chapters in full volume', () => {
            const subplaneChapters = {
                '小世界···幽冥界': [1, 2],
            };
            const allOutlines = Array.from({ length: 30 }, (_, i) => ({
                num: i + 1, outline: '内容', title: '标题', scene: '主世界'
            }));
            const issues = validateVolumeRhythm(0, 30, allOutlines, subplaneChapters);
            expect(issues.some(i => i.includes('几乎无小世界内容'))).toBe(true);
        });

        test('warns for partial volume with few subplane chapters', () => {
            const subplaneChapters = {
                '小世界···幽冥界': [1],
            };
            const allOutlines = Array.from({ length: 10 }, (_, i) => ({
                num: i + 1, outline: '内容', title: '标题', scene: '主世界'
            }));
            const issues = validateVolumeRhythm(0, 10, allOutlines, subplaneChapters);
            // Partial volume, should warn but not error
            expect(issues).toBeDefined();
        });

        test('no issues for single subplane with enough chapters', () => {
            const subplaneChapters = {
                '小世界···幽冥界': Array.from({ length: 15 }, (_, i) => i + 1),
            };
            const allOutlines = Array.from({ length: 30 }, (_, i) => ({
                num: i + 1, outline: '内容', title: '标题',
                scene: i < 15 ? '幽冥界' : '主世界'
            }));
            const issues = validateVolumeRhythm(0, 30, allOutlines, subplaneChapters);
            expect(issues.some(i => i.includes('违反一卷一小世界规则'))).toBe(false);
        });
    });
});
