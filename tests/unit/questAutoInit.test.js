const { detectEventType, inferStoryTime, extractLocation, isKeyEvent } = require('../../server/routes/questAutoInit');

describe('questAutoInit helpers', () => {
    describe('detectEventType', () => {
        test('detects conflict type', () => {
            expect(detectEventType('两人展开激烈战斗')).toBe('conflict');
        });

        test('detects revelation type', () => {
            expect(detectEventType('真相终于揭示')).toBe('revelation');
        });

        test('detects foreshadow type', () => {
            expect(detectEventType('这里埋下伏笔')).toBe('foreshadow');
        });

        test('detects resolution type', () => {
            expect(detectEventType('危机终于化解')).toBe('resolution');
        });

        test('detects character type', () => {
            expect(detectEventType('角色内心成长')).toBe('character');
        });

        test('detects world type', () => {
            expect(detectEventType('世界观设定展开')).toBe('world');
        });

        test('defaults to plot', () => {
            expect(detectEventType('普通剧情推进')).toBe('plot');
        });

        test('handles empty input', () => {
            expect(detectEventType('')).toBe('plot');
        });
    });

    describe('inferStoryTime', () => {
        test('returns stage format for default genre', () => {
            const result = inferStoryTime(10, {});
            expect(result).toContain('阶段');
        });

        test('returns week format for urban genre', () => {
            const result = inferStoryTime(10, { styleProfile: { genre: '都市' } });
            expect(result).toContain('周');
        });

        test('returns period format for cultivation genre', () => {
            const result = inferStoryTime(10, { styleProfile: { genre: '高武' } });
            expect(result).toContain('期');
        });
    });

    describe('extractLocation', () => {
        test('extracts location from context', () => {
            expect(extractLocation('他来到天机阁')).toContain('天机阁');
        });

        test('returns empty for no location', () => {
            expect(extractLocation('他思考了很久')).toBe('');
        });

        test('handles empty input', () => {
            expect(extractLocation('')).toBe('');
        });
    });

    describe('isKeyEvent', () => {
        test('early chapters are key events', () => {
            expect(isKeyEvent('some text', 1)).toBe(true);
            expect(isKeyEvent('some text', 3)).toBe(true);
        });

        test('detects key event keywords', () => {
            expect(isKeyEvent('这是一个关键转折', 10)).toBe(true);
        });

        test('non-key events return false', () => {
            expect(isKeyEvent('普通的一天', 10)).toBe(false);
        });
    });
});
