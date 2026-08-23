const { queryAll, queryOne, runSql, safeParse, extractMaterialFields, extractChapterFields, extractProjectFields, extractKvFields } = require('../../server/db/dbHelpers');

describe('dbHelpers', () => {
    describe('safeParse', () => {
        it('should parse valid JSON', () => {
            expect(safeParse('{"a":1}')).toEqual({ a: 1 });
        });

        it('should return null for invalid JSON', () => {
            expect(safeParse('not json')).toBeNull();
        });

        it('should return null for null/undefined', () => {
            expect(safeParse(null)).toBeNull();
            expect(safeParse(undefined)).toBeNull();
        });

        it('should return null for empty string', () => {
            expect(safeParse('')).toBeNull();
        });
    });

    describe('extractMaterialFields', () => {
        it('should extract all material fields', () => {
            const data = { id: 'm1', projectId: 'p1', type: 'character', name: 'Alice', parentPlane: 'earth', parentFaction: 'guild1', archived: true, extra: 'field' };
            const result = extractMaterialFields(data);
            expect(result.id).toBe('m1');
            expect(result.projectId).toBe('p1');
            expect(result.type).toBe('character');
            expect(result.name).toBe('Alice');
            expect(result.parentPlane).toBe('earth');
            expect(result.parentFaction).toBe('guild1');
            expect(result.archived).toBe(1);
            expect(result.data).toContain('"extra":"field"');
        });

        it('should use defaults for missing fields', () => {
            const data = { id: 'm2' };
            const result = extractMaterialFields(data);
            expect(result.projectId).toBe('');
            expect(result.type).toBe('other');
            expect(result.name).toBe('');
            expect(result.archived).toBe(0);
        });
    });

    describe('extractChapterFields', () => {
        it('should extract chapter fields', () => {
            const data = { id: 'ch1', projectId: 'p1', chapterNumber: 5, status: 'completed' };
            const result = extractChapterFields(data);
            expect(result.id).toBe('ch1');
            expect(result.projectId).toBe('p1');
            expect(result.chapterNumber).toBe(5);
            expect(result.status).toBe('completed');
        });

        it('should use defaults', () => {
            const data = { id: 'ch2' };
            const result = extractChapterFields(data);
            expect(result.chapterNumber).toBe(0);
            expect(result.status).toBe('outlined');
        });
    });

    describe('extractProjectFields', () => {
        it('should extract project fields', () => {
            const data = { id: 'p1', name: 'My Novel' };
            const result = extractProjectFields(data);
            expect(result.id).toBe('p1');
            expect(result.data).toContain('"name":"My Novel"');
        });
    });

    describe('extractKvFields', () => {
        it('should extract kv fields with type', () => {
            const data = { id: 'k1', value: 'test' };
            const result = extractKvFields('reviews', data);
            expect(result.type).toBe('reviews');
            expect(result.id).toBe('k1');
            expect(result.data).toContain('"value":"test"');
        });
    });
});
