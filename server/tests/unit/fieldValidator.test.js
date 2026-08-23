const { validateRequired, validateMaterial, fillDefaults, getRequiredFields } = require('../../db/fieldValidator');

describe('fieldValidator', () => {
    test('getRequiredFields returns non-empty array for materials', () => {
        const fields = getRequiredFields('materials');
        expect(fields.length).toBeGreaterThan(0);
        const names = fields.map(f => f.name);
        expect(names).toContain('projectId');
        expect(names).toContain('type');
        expect(names).toContain('name');
    });

    test('getRequiredFields returns empty for unknown table', () => {
        const fields = getRequiredFields('nonexistent');
        expect(fields).toEqual([]);
    });

    test('validateMaterial passes for complete data', () => {
        const data = { projectId: 'p1', type: 'character', name: '张三', archived: false, isLocked: false, version: 1 };
        const result = validateMaterial(data);
        expect(result.valid).toBe(true);
        expect(result.missing).toEqual([]);
    });

    test('validateMaterial fails for missing projectId', () => {
        const data = { type: 'character', name: '张三' };
        const result = validateMaterial(data);
        expect(result.valid).toBe(false);
        expect(result.missing).toContain('projectId');
    });

    test('validateMaterial fails for missing name', () => {
        const data = { projectId: 'p1', type: 'character' };
        const result = validateMaterial(data);
        expect(result.valid).toBe(false);
        expect(result.missing).toContain('name');
    });

    test('fillDefaults fills missing required fields with defaults', () => {
        const data = { projectId: 'p1', name: 'test' };
        const filled = fillDefaults('materials', data);
        expect(filled.type).toBe('other');
        expect(filled.version).toBe(1);
        expect(filled.projectId).toBe('p1');
    });

    test('fillDefaults does not override existing values', () => {
        const data = { projectId: 'p1', type: 'character', name: 'test', version: 5 };
        const filled = fillDefaults('materials', data);
        expect(filled.type).toBe('character');
        expect(filled.version).toBe(5);
    });

    test('fillDefaults returns new object without modifying original', () => {
        const data = { projectId: 'p1', name: 'test' };
        const filled = fillDefaults('materials', data);
        expect(filled).not.toBe(data);
        expect(data.type).toBeUndefined();
        expect(filled.type).toBe('other');
    });

    test('validateRequired works for other registered tables', () => {
        const result = validateRequired('chapters', { projectId: 'p1', chapterNumber: 1, title: 'test', status: 'outlined', round: 1 });
        expect(result.valid).toBe(true);
    });
});
