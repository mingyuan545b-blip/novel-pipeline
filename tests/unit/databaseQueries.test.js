const { initDatabaseAsync, resetForTesting, getDatabase, queryMaterialsByProject, queryChaptersByProject, countItemsByType } = require('../../server/db/database');

describe('database SQL-level queries', () => {
    beforeAll(async () => {
        await initDatabaseAsync(':memory:');
    });

    beforeEach(() => {
        resetForTesting();
    });

    test('queryMaterialsByProject returns only matching project materials', () => {
        const db = getDatabase();
        const mat1 = JSON.stringify({ id: 'm1', projectId: 'proj1', type: 'character', name: 'Alice', parentPlane: null, parentFaction: null, archived: 0 });
        const mat2 = JSON.stringify({ id: 'm2', projectId: 'proj2', type: 'character', name: 'Bob', parentPlane: null, parentFaction: null, archived: 0 });
        const mat3 = JSON.stringify({ id: 'm3', projectId: 'proj1', type: 'worldview', name: 'World', parentPlane: null, parentFaction: null, archived: 0 });
        const insertMat = db.prepare('INSERT INTO materials (id, projectId, type, name, parentPlane, parentFaction, archived, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
        insertMat.run(['m1', 'proj1', 'character', 'Alice', null, null, 0, mat1]);
        insertMat.run(['m2', 'proj2', 'character', 'Bob', null, null, 0, mat2]);
        insertMat.run(['m3', 'proj1', 'worldview', 'World', null, null, 0, mat3]);

        const result = queryMaterialsByProject('proj1');
        expect(result.length).toBe(2);
        expect(result.every(m => m.projectId === 'proj1')).toBe(true);
    });

    test('queryMaterialsByProject with type filter', () => {
        const db = getDatabase();
        const mat1 = JSON.stringify({ id: 'm1', projectId: 'proj1', type: 'character', name: 'Alice', parentPlane: null, parentFaction: null, archived: 0 });
        const mat2 = JSON.stringify({ id: 'm2', projectId: 'proj1', type: 'worldview', name: 'World', parentPlane: null, parentFaction: null, archived: 0 });
        const insertMat = db.prepare('INSERT INTO materials (id, projectId, type, name, parentPlane, parentFaction, archived, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
        insertMat.run(['m1', 'proj1', 'character', 'Alice', null, null, 0, mat1]);
        insertMat.run(['m2', 'proj1', 'worldview', 'World', null, null, 0, mat2]);

        const result = queryMaterialsByProject('proj1', { type: 'character' });
        expect(result.length).toBe(1);
        expect(result[0].type).toBe('character');
    });

    test('queryMaterialsByProject with archived filter', () => {
        const db = getDatabase();
        const mat1 = JSON.stringify({ id: 'm1', projectId: 'proj1', type: 'character', name: 'Alice', parentPlane: null, parentFaction: null, archived: 0 });
        const mat2 = JSON.stringify({ id: 'm2', projectId: 'proj1', type: 'character', name: 'Bob', parentPlane: null, parentFaction: null, archived: 1 });
        const insertMat = db.prepare('INSERT INTO materials (id, projectId, type, name, parentPlane, parentFaction, archived, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
        insertMat.run(['m1', 'proj1', 'character', 'Alice', null, null, 0, mat1]);
        insertMat.run(['m2', 'proj1', 'character', 'Bob', null, null, 1, mat2]);

        const result = queryMaterialsByProject('proj1', { archived: false });
        expect(result.length).toBe(1);
        expect(result[0].name).toBe('Alice');
    });

    test('queryChaptersByProject returns sorted by chapterNumber', () => {
        const db = getDatabase();
        const ch1 = JSON.stringify({ id: 'c1', projectId: 'proj1', chapterNumber: 3, status: 'approved' });
        const ch2 = JSON.stringify({ id: 'c2', projectId: 'proj1', chapterNumber: 1, status: 'outlined' });
        const ch3 = JSON.stringify({ id: 'c3', projectId: 'proj1', chapterNumber: 2, status: 'written' });
        const insertCh = db.prepare('INSERT INTO chapters (id, projectId, chapterNumber, status, data) VALUES (?, ?, ?, ?, ?)');
        insertCh.run(['c1', 'proj1', 3, 'approved', ch1]);
        insertCh.run(['c2', 'proj1', 1, 'outlined', ch2]);
        insertCh.run(['c3', 'proj1', 2, 'written', ch3]);

        const result = queryChaptersByProject('proj1');
        expect(result.length).toBe(3);
        expect(result[0].chapterNumber).toBe(1);
        expect(result[1].chapterNumber).toBe(2);
        expect(result[2].chapterNumber).toBe(3);
    });

    test('queryChaptersByProject with status filter', () => {
        const db = getDatabase();
        const ch1 = JSON.stringify({ id: 'c1', projectId: 'proj1', chapterNumber: 1, status: 'approved' });
        const ch2 = JSON.stringify({ id: 'c2', projectId: 'proj1', chapterNumber: 2, status: 'outlined' });
        const insertCh = db.prepare('INSERT INTO chapters (id, projectId, chapterNumber, status, data) VALUES (?, ?, ?, ?, ?)');
        insertCh.run(['c1', 'proj1', 1, 'approved', ch1]);
        insertCh.run(['c2', 'proj1', 2, 'outlined', ch2]);

        const result = queryChaptersByProject('proj1', { status: 'approved' });
        expect(result.length).toBe(1);
        expect(result[0].status).toBe('approved');
    });

    test('countItemsByType returns correct count', () => {
        const db = getDatabase();
        const mat1 = JSON.stringify({ id: 'm1', projectId: 'proj1', type: 'character', name: 'A', parentPlane: null, parentFaction: null, archived: 0 });
        const mat2 = JSON.stringify({ id: 'm2', projectId: 'proj1', type: 'worldview', name: 'B', parentPlane: null, parentFaction: null, archived: 0 });
        const insertMat = db.prepare('INSERT INTO materials (id, projectId, type, name, parentPlane, parentFaction, archived, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
        insertMat.run(['m1', 'proj1', 'character', 'A', null, null, 0, mat1]);
        insertMat.run(['m2', 'proj1', 'worldview', 'B', null, null, 0, mat2]);

        expect(countItemsByType('materials')).toBe(2);
    });

    test('queryMaterialsByProject returns empty for non-existent project', () => {
        const result = queryMaterialsByProject('nonexistent');
        expect(result).toEqual([]);
    });

    test('queryChaptersByProject returns empty for non-existent project', () => {
        const result = queryChaptersByProject('nonexistent');
        expect(result).toEqual([]);
    });
});
