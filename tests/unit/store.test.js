const { initDatabaseAsync, closeDatabase, getDatabase } = require('../../server/db/database');
const store = require('../../server/db/store');
const { VALID_MATERIAL_TYPES, HIERARCHY_RULES, MATERIAL_STANDARDS, CRAFT_TYPES, WORLDVIEW_TYPES, CHARACTER_TYPES } = require('../../server/config/materialTypes');

let db;

beforeAll(async () => {
    db = await initDatabaseAsync(':memory:');
});

afterAll(() => {
    closeDatabase();
});

describe('SQLite Store - CRUD Operations', () => {
    test('setItem and getItem for projects', () => {
        const project = {
            id: 'test-proj-1',
            name: '测试项目',
            mode: 'novel',
            description: '测试描述'
        };
        store.setItem('projects', 'test-proj-1', project);
        const retrieved = store.getItem('projects', 'test-proj-1');
        expect(retrieved).not.toBeNull();
        expect(retrieved.name).toBe('测试项目');
        expect(retrieved.mode).toBe('novel');
        expect(retrieved.createdAt).toBeDefined();
        expect(retrieved.updatedAt).toBeDefined();
    });

    test('setItem and getItem for materials', () => {
        const material = {
            id: 'test-mat-1',
            projectId: 'test-proj-1',
            type: 'worldview',
            name: '修仙世界',
            currentContent: '灵气复苏，修仙者众',
            parentPlane: null
        };
        store.setItem('materials', 'test-mat-1', material);
        const retrieved = store.getItem('materials', 'test-mat-1');
        expect(retrieved).not.toBeNull();
        expect(retrieved.type).toBe('worldview');
        expect(retrieved.name).toBe('修仙世界');
        expect(retrieved.projectId).toBe('test-proj-1');
    });

    test('setItem and getItem for chapters', () => {
        const chapter = {
            id: 'test-ch-1',
            projectId: 'test-proj-1',
            chapterNumber: 1,
            status: 'outlined',
            outline: '主角出场',
            content: ''
        };
        store.setItem('chapters', 'test-ch-1', chapter);
        const retrieved = store.getItem('chapters', 'test-ch-1');
        expect(retrieved).not.toBeNull();
        expect(retrieved.chapterNumber).toBe(1);
        expect(retrieved.status).toBe('outlined');
    });

    test('setItem and getItem for kv_store types', () => {
        const log = {
            id: 'test-log-1',
            projectId: 'test-proj-1',
            step: 'writer',
            result: 'success'
        };
        store.setItem('pipeline-logs', 'test-log-1', log);
        const retrieved = store.getItem('pipeline-logs', 'test-log-1');
        expect(retrieved).not.toBeNull();
        expect(retrieved.step).toBe('writer');
    });

    test('getItem returns null for non-existent item', () => {
        const result = store.getItem('projects', 'non-existent');
        expect(result).toBeNull();
    });
});

describe('SQLite Store - listItems', () => {
    beforeAll(() => {
        for (let i = 1; i <= 5; i++) {
            store.setItem('chapters', `list-ch-${i}`, {
                id: `list-ch-${i}`,
                projectId: 'list-proj',
                chapterNumber: i,
                status: i <= 3 ? 'outlined' : 'approved',
                outline: `第${i}章大纲`
            });
        }
    });

    test('listItems returns all items of a type', () => {
        const chapters = store.listItems('chapters');
        expect(chapters.length).toBeGreaterThanOrEqual(5);
    });

    test('listItems for kv_store type filters correctly', () => {
        store.setItem('reviews', 'rev-1', { id: 'rev-1', rating: 5 });
        store.setItem('reviews', 'rev-2', { id: 'rev-2', rating: 3 });
        const reviews = store.listItems('reviews');
        expect(reviews.length).toBe(2);
    });
});

describe('SQLite Store - queryItems', () => {
    beforeAll(() => {
        store.setItem('materials', 'q-mat-1', {
            id: 'q-mat-1', projectId: 'q-proj', type: 'character', name: '角色A', parentFaction: 'fac-1'
        });
        store.setItem('materials', 'q-mat-2', {
            id: 'q-mat-2', projectId: 'q-proj', type: 'worldview', name: '世界观B', parentPlane: null
        });
        store.setItem('materials', 'q-mat-3', {
            id: 'q-mat-3', projectId: 'other-proj', type: 'character', name: '角色C', parentFaction: 'fac-2'
        });
    });

    test('queryItems with object filter', () => {
        const chars = store.queryItems('materials', { projectId: 'q-proj', type: 'character' });
        expect(chars.length).toBe(1);
        expect(chars[0].name).toBe('角色A');
    });

    test('queryItems with function filter', () => {
        const mats = store.queryItems('materials', m => m.projectId === 'q-proj');
        expect(mats.length).toBe(2);
    });

    test('queryItems with no filter returns all', () => {
        const all = store.queryItems('materials');
        expect(all.length).toBeGreaterThanOrEqual(3);
    });
});

describe('SQLite Store - deleteItem', () => {
    test('deleteItem removes item', () => {
        store.setItem('projects', 'del-proj', { id: 'del-proj', name: '待删除' });
        expect(store.getItem('projects', 'del-proj')).not.toBeNull();
        const result = store.deleteItem('projects', 'del-proj');
        expect(result).toBe(true);
        expect(store.getItem('projects', 'del-proj')).toBeNull();
    });

    test('deleteItem returns false for non-existent item', () => {
        const result = store.deleteItem('projects', 'non-existent');
        expect(result).toBe(false);
    });
});

describe('SQLite Store - Foundation Material Protection', () => {
    test('worldview without parentPlane is foundation', () => {
        const mat = { id: 'f-mat-1', type: 'worldview', name: '主世界', currentContent: '内容', parentPlane: null };
        store.setItem('materials', 'f-mat-1', mat);
        expect(store.isFoundationMaterial(mat)).toBe(true);
    });

    test('character with sourceChapter is not foundation', () => {
        const mat = { id: 'f-mat-2', type: 'character', name: '新角色', sourceChapter: 5 };
        expect(store.isFoundationMaterial(mat)).toBe(false);
    });

    test('isFoundation=true overrides other rules', () => {
        const mat = { id: 'f-mat-3', type: 'other', name: '特殊', isFoundation: true, sourceChapter: 3 };
        expect(store.isFoundationMaterial(mat)).toBe(true);
    });

    test('isFoundation=false overrides other rules', () => {
        const mat = { id: 'f-mat-4', type: 'worldview', name: '非基底', isFoundation: false, parentPlane: null };
        expect(store.isFoundationMaterial(mat)).toBe(false);
    });

    test('faction with parentPlane=null is foundation', () => {
        const mat = { id: 'f-mat-5', type: 'faction', name: '主势力', parentPlane: null };
        expect(store.isFoundationMaterial(mat)).toBe(true);
    });

    test('faction with parentPlane set is not foundation', () => {
        const mat = { id: 'f-mat-6', type: 'faction', name: '次位面势力', parentPlane: 'sp-1' };
        expect(store.isFoundationMaterial(mat)).toBe(false);
    });

    test('cannot delete foundation material', () => {
        const mat = { id: 'f-mat-7', projectId: 'fp', type: 'worldview', name: '受保护', parentPlane: null };
        store.setItem('materials', 'f-mat-7', mat);
        const result = store.deleteItem('materials', 'f-mat-7');
        expect(result).toBe(false);
        expect(store.getItem('materials', 'f-mat-7')).not.toBeNull();
    });
});

describe('SQLite Store - Update Operations', () => {
    test('setItem updates existing item', () => {
        store.setItem('projects', 'upd-proj', { id: 'upd-proj', name: '原始名称' });
        store.setItem('projects', 'upd-proj', { id: 'upd-proj', name: '更新名称' });
        const retrieved = store.getItem('projects', 'upd-proj');
        expect(retrieved.name).toBe('更新名称');
    });

    test('setItem preserves createdAt on update', async () => {
        store.setItem('projects', 'time-proj', { id: 'time-proj', name: '时间测试' });
        const first = store.getItem('projects', 'time-proj');
        const firstCreatedAt = first.createdAt;

        await new Promise(r => setTimeout(r, 10));

        store.setItem('projects', 'time-proj', { id: 'time-proj', name: '时间测试2', createdAt: firstCreatedAt });
        const second = store.getItem('projects', 'time-proj');
        expect(second.createdAt).toBe(firstCreatedAt);
        expect(second.updatedAt).not.toBe(firstCreatedAt);
    });
});

describe('SQLite Store - Data Integrity', () => {
    test('Chinese characters preserved correctly', () => {
        const data = {
            id: 'cn-test',
            projectId: 'cn-proj',
            type: 'character',
            name: '张三丰',
            currentContent: '核心欲望：修仙成道。内在矛盾：凡尘未了。行为模式：隐忍不发。'
        };
        store.setItem('materials', 'cn-test', data);
        const retrieved = store.getItem('materials', 'cn-test');
        expect(retrieved.name).toBe('张三丰');
        expect(retrieved.currentContent).toContain('核心欲望');
    });

    test('large content stored and retrieved', () => {
        const longContent = '这是一段很长的内容。'.repeat(500);
        const data = {
            id: 'large-test',
            projectId: 'large-proj',
            type: 'chapter',
            name: '长章节',
            content: longContent
        };
        store.setItem('chapters', 'large-test', data);
        const retrieved = store.getItem('chapters', 'large-test');
        expect(retrieved.content.length).toBe(longContent.length);
    });

    test('special characters preserved', () => {
        const data = {
            id: 'special-test',
            name: '特殊字符 <>&"\'',
            content: '引号"测试"和<标签>以及&符号'
        };
        store.setItem('projects', 'special-test', data);
        const retrieved = store.getItem('projects', 'special-test');
        expect(retrieved.name).toContain('<>&"\'');
        expect(retrieved.content).toContain('"测试"');
    });
});
