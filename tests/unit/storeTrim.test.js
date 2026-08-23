const { trimItemData } = require('../../server/db/storeTrim');
const { STORE_SIZE_LIMITS, STORE_TRIMMING } = require('../../server/config/systemConfig');

describe('storeTrim', () => {
    describe('trimItemData - chapters', () => {
        it('should truncate writerOutput when exceeding outputTruncateLength', () => {
            const data = { id: 'ch1', writerOutput: 'A'.repeat(15000) };
            const result = trimItemData('chapters', data);
            expect(result.writerOutput.length).toBeLessThan(15000);
            expect(result.writerOutput).toContain('...[truncated]');
        });

        it('should always apply field-level truncation even if under size limit', () => {
            const data = { id: 'ch1', writerOutput: 'B'.repeat(10000) };
            const result = trimItemData('chapters', data);
            expect(result.writerOutput.length).toBeLessThan(10000);
        });

        it('should trim history to chapterHistoryKeep', () => {
            const data = { id: 'ch1', history: Array(20).fill({ round: 1, content: 'test' }) };
            const result = trimItemData('chapters', data);
            expect(result.history.length).toBe(STORE_TRIMMING.chapterHistoryKeep);
        });

        it('should not modify data within limits', () => {
            const data = { id: 'ch1', writerOutput: 'short text', history: [{ round: 1 }] };
            const result = trimItemData('chapters', data);
            expect(result.writerOutput).toBe('short text');
            expect(result.history.length).toBe(1);
        });
    });

    describe('trimItemData - materials', () => {
        it('should trim changeLog to materialChangeLogKeep', () => {
            const data = { id: 'm1', changeLog: Array(100).fill({ action: 'update' }) };
            const result = trimItemData('materials', data);
            expect(result.changeLog.length).toBe(STORE_TRIMMING.materialChangeLogKeep);
        });

        it('should truncate currentContent when exceeding materialContentMaxLen', () => {
            const data = { id: 'm1', currentContent: 'X'.repeat(60000) };
            const result = trimItemData('materials', data);
            expect(result.currentContent.length).toBeLessThan(60000);
            expect(result.currentContent).toContain('...[truncated]');
        });
    });

    describe('trimItemData - projects', () => {
        it('should trim chapters array to projectChaptersKeep', () => {
            const data = { id: 'p1', chapters: Array(300).fill({ number: 1 }) };
            const result = trimItemData('projects', data);
            expect(result.chapters.length).toBe(STORE_TRIMMING.projectChaptersKeep);
        });

        it('should trim description to projectDescriptionMaxLength', () => {
            const data = { id: 'p1', description: 'D'.repeat(6000) };
            const result = trimItemData('projects', data);
            expect(result.description.length).toBeLessThanOrEqual(STORE_TRIMMING.projectDescriptionMaxLength);
        });
    });
});
