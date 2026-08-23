const stateKVIndex = require('../../server/services/stateKVIndex');
const store = require('../../server/store');

const testProjectId = 'test-state-kv-project';
const testCharId = 'test-char-001';

beforeEach(async () => {
    await stateKVIndex.setCurrentChapter(testProjectId, 1);
});

afterEach(async () => {
    const items = await store.queryItems('state-kv-index', { projectId: testProjectId });
    for (const item of items) {
        await store.deleteItem('state-kv-index', item.id);
    }
    const states = await store.queryItems('character-states', { projectId: testProjectId });
    for (const state of states) {
        await store.deleteItem('character-states', state.id);
    }
});

describe('stateKVIndex - basic CRUD', () => {
    test('set and get a single value', async () => {
        await stateKVIndex.set(testProjectId, 'character', testCharId, 'hp', 85, 5);
        const value = await stateKVIndex.get(testProjectId, 'character', testCharId, 'hp');
        expect(value).toBe(85);
    });

    test('get returns undefined for missing key', async () => {
        const value = await stateKVIndex.get(testProjectId, 'character', testCharId, 'nonexistent');
        expect(value).toBeUndefined();
    });

    test('set and get string value', async () => {
        await stateKVIndex.set(testProjectId, 'character', testCharId, 'name', '张三', 5);
        const value = await stateKVIndex.get(testProjectId, 'character', testCharId, 'name');
        expect(value).toBe('张三');
    });

    test('set and get array value', async () => {
        await stateKVIndex.set(testProjectId, 'character', testCharId, 'equipment', ['青锋剑', '护心镜'], 5);
        const value = await stateKVIndex.get(testProjectId, 'character', testCharId, 'equipment');
        expect(value).toEqual(['青锋剑', '护心镜']);
    });

    test('set and get object value', async () => {
        await stateKVIndex.set(testProjectId, 'character', testCharId, 'relationships', { 'char-1': '信任', 'char-2': '敌对' }, 5);
        const value = await stateKVIndex.get(testProjectId, 'character', testCharId, 'relationships');
        expect(value).toEqual({ 'char-1': '信任', 'char-2': '敌对' });
    });
});

describe('stateKVIndex - getEntityState', () => {
    test('get all state for an entity', async () => {
        await stateKVIndex.set(testProjectId, 'character', testCharId, 'hp', 80, 5);
        await stateKVIndex.set(testProjectId, 'character', testCharId, 'mp', 60, 5);
        await stateKVIndex.set(testProjectId, 'character', testCharId, 'name', '李四', 5);

        const state = await stateKVIndex.getEntityState(testProjectId, 'character', testCharId);
        expect(state.hp).toBe(80);
        expect(state.mp).toBe(60);
        expect(state.name).toBe('李四');
    });

    test('getEntityState returns null for unknown entity', async () => {
        const state = await stateKVIndex.getEntityState(testProjectId, 'character', 'unknown');
        expect(state).toBeNull();
    });
});

describe('stateKVIndex - updateCharacterState', () => {
    test('update character state with delta', async () => {
        const delta = { hp: 70, mp: 50 };
        const record = await stateKVIndex.updateCharacterState(testProjectId, testCharId, '王五', 5, delta, 'high-martial-comedy');

        expect(record.characterId).toBe(testCharId);
        expect(record.characterName).toBe('王五');
        expect(record.chapterNumber).toBe(5);
        expect(record.stateChangedFields).toContain('hp');
        expect(record.stateChangedFields).toContain('mp');

        const state = await stateKVIndex.getEntityState(testProjectId, 'character', testCharId);
        expect(state.hp).toBe(70);
        expect(state.mp).toBe(50);
        expect(state.name).toBe('王五');
    });

    test('state accumulates across chapters', async () => {
        await stateKVIndex.updateCharacterState(testProjectId, testCharId, '赵六', 1, { hp: 100, mp: 100 }, 'high-martial-comedy');
        await stateKVIndex.updateCharacterState(testProjectId, testCharId, '赵六', 3, { hp: 80 }, 'high-martial-comedy');
        await stateKVIndex.updateCharacterState(testProjectId, testCharId, '赵六', 5, { hp: 60, mp: 70 }, 'high-martial-comedy');

        const state = await stateKVIndex.getEntityState(testProjectId, 'character', testCharId);
        expect(state.hp).toBe(60);
        expect(state.mp).toBe(70);
    });

    test('getLatestState merges deltas correctly', async () => {
        await stateKVIndex.updateCharacterState(testProjectId, testCharId, '钱七', 1, { hp: 100, mp: 100, combatPower: 500 }, 'high-martial-comedy');
        await stateKVIndex.updateCharacterState(testProjectId, testCharId, '钱七', 3, { hp: 80, combatPower: 800 }, 'high-martial-comedy');

        const state = await stateKVIndex.getLatestState(testProjectId, testCharId, 3);
        expect(state.hp).toBe(80);
        expect(state.mp).toBe(100);
        expect(state.combatPower).toBe(800);
    });
});

describe('stateKVIndex - hot index', () => {
    test('hot flag set for recent chapters', async () => {
        await stateKVIndex.setCurrentChapter(testProjectId, 10);
        await stateKVIndex.set(testProjectId, 'character', testCharId, 'hp', 80, 10);

        const hotIndex = await stateKVIndex.getHotIndex(testProjectId, 10, ['character']);
        expect(hotIndex.character[testCharId]).toBeDefined();
        expect(hotIndex.character[testCharId].hp).toBe(80);
    });

    test('cold entries excluded from hot index', async () => {
        await stateKVIndex.setCurrentChapter(testProjectId, 20);
        await stateKVIndex.set(testProjectId, 'character', testCharId, 'hp', 80, 5);

        const hotIndex = await stateKVIndex.getHotIndex(testProjectId, 20, ['character']);
        expect(hotIndex.character[testCharId]).toBeUndefined();
    });
});

describe('stateKVIndex - generateBriefSummary', () => {
    test('generates brief summary for high-martial genre', async () => {
        await stateKVIndex.setCurrentChapter(testProjectId, 5);
        await stateKVIndex.updateCharacterState(testProjectId, testCharId, '叶凡', 5, {
            hp: 85, mp: 60, combatPower: 1200, cultivationStage: '筑基三层', factionName: '青云宗'
        }, 'high-martial-comedy');

        const summary = await stateKVIndex.generateBriefSummary(testProjectId, 5, 'high-martial-comedy');
        expect(summary).toContain('叶凡');
        expect(summary).toContain('筑基三层');
    });

    test('returns default message when no data', async () => {
        const summary = await stateKVIndex.generateBriefSummary(testProjectId, 1, 'high-martial-comedy');
        expect(summary).toContain('无热点角色状态');
    });
});

describe('stateKVIndex - updateAfterOperations', () => {
    test('updates KV index from operations', async () => {
        await stateKVIndex.setCurrentChapter(testProjectId, 5);
        const operations = [
            { scope: 'character', entityKey: 'char-1', data: { hp: 75, position: '执事' } },
            { scope: 'worldview', entityKey: '修仙境界', data: { evolution: 'expansion', detail: '新增大乘期' } }
        ];

        await stateKVIndex.updateAfterOperations(testProjectId, 5, operations);

        const charState = await stateKVIndex.getEntityState(testProjectId, 'character', 'char-1');
        expect(charState.hp).toBe(75);
        expect(charState.position).toBe('执事');
    });
});

describe('stateKVIndex - getStateHistory', () => {
    test('returns history records sorted by chapter', async () => {
        await stateKVIndex.updateCharacterState(testProjectId, testCharId, '孙八', 1, { hp: 100 }, 'high-martial-comedy');
        await stateKVIndex.updateCharacterState(testProjectId, testCharId, '孙八', 3, { hp: 80 }, 'high-martial-comedy');
        await stateKVIndex.updateCharacterState(testProjectId, testCharId, '孙八', 5, { hp: 60 }, 'high-martial-comedy');

        const history = await stateKVIndex.getStateHistory(testProjectId, testCharId, 1, 5);
        expect(history.length).toBe(3);
        expect(history[0].chapterNumber).toBe(1);
        expect(history[1].chapterNumber).toBe(3);
        expect(history[2].chapterNumber).toBe(5);
    });

    test('filters by chapter range', async () => {
        await stateKVIndex.updateCharacterState(testProjectId, testCharId, '周九', 1, { hp: 100 }, 'high-martial-comedy');
        await stateKVIndex.updateCharacterState(testProjectId, testCharId, '周九', 3, { hp: 80 }, 'high-martial-comedy');
        await stateKVIndex.updateCharacterState(testProjectId, testCharId, '周九', 5, { hp: 60 }, 'high-martial-comedy');

        const history = await stateKVIndex.getStateHistory(testProjectId, testCharId, 2, 4);
        expect(history.length).toBe(1);
        expect(history[0].chapterNumber).toBe(3);
    });
});
